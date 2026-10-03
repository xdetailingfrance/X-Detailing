# Workflow opérateur verrouillé

> Couvre §12 (verrouillage obligatoire), §13 (photos avant), §14 (prestation),
> §15 (photos après), §16 (encaissement), §17 (fin), §30 (traçabilité).
> Implémentation : `src/server/workflow/`.

## 1. Machine à états

Le §12 est une exigence de **conformité**, pas d'ergonomie : le workflow doit être
« impossible à contourner ». Il est donc implémenté comme une machine à états **côté
serveur**, jamais comme une simple logique d'affichage. Masquer un bouton ne verrouille
rien — toute transition passe par une fonction unique qui vérifie ses gardes.

```
  DRAFT ──────────────► PENDING_ASSIGNMENT ──────► ASSIGNED ──────► CONFIRMED
   (§3 saisie)            (§35 moteur)           (proposition)     (acompte §2)
                                                                        │
                                                                        ▼
   COMPLETED ◄──── PAYMENT ◄──── PHOTOS_AFTER ◄──── IN_PROGRESS ◄─── ARRIVED ◄─── EN_ROUTE
    (§17)          (§16)            (§15)              (§14)          (§12)      (§11 GPS)
                                                            ▲
                                                     PHOTOS_BEFORE (§13)

  CANCELLED / NO_SHOW : accessibles depuis tout état antérieur à IN_PROGRESS.
```

## 2. Gardes — la traduction littérale du §12

| Transition | Garde serveur | Règle CDC |
|---|---|---|
| `CONFIRMED → EN_ROUTE` | RDV du jour, opérateur assigné = appelant | §11 |
| `EN_ROUTE → ARRIVED` | — (le GPS s'arrête ici) | §11 |
| `ARRIVED → PHOTOS_BEFORE` | `arrivedAt` non nul | « pas d'arrivée validée = pas de photos avant » |
| `PHOTOS_BEFORE → IN_PROGRESS` | ≥ 4 photos `BEFORE` couvrant les 4 emplacements requis | « pas de photos avant validées = pas de démarrage » |
| `IN_PROGRESS → PHOTOS_AFTER` | `startedAt` non nul | « pas de prestation démarrée = pas de photos après » |
| `PHOTOS_AFTER → PAYMENT` | ≥ 4 photos `AFTER` validées | « pas de photos après validées = pas d'encaissement » |
| `PAYMENT → COMPLETED` | somme encaissée == total dû, écart = 0 | « pas de paiement validé = pas de terminaison » |

Chaque transition, dans une **seule opération atomique** :
1. relit le rendez-vous ;
2. vérifie la garde, puis écrit **sous condition de l'état source** — `updateMany` avec le
   statut attendu dans le `where` est atomique en PostgreSQL, ce qui évite un verrou
   explicite : deux appuis simultanés sur « J'ai terminé » ne peuvent pas produire deux
   clôtures ;
3. écrit le nouvel état + l'horodatage dédié (`arrivedAt`, `startedAt`, `finishedAt`…) ;
4. insère un `AppointmentEvent` (§12 « chaque étape est horodatée ») ;
5. insère un `AuditLog` (§30) ;
6. déclenche les alertes et notifications éventuelles (§27).

Une garde qui échoue lève une erreur typée avec un message destiné à l'opérateur
(« 2 photos avant manquantes : arrière, intérieur »), pas une 500.

## 3. Photos (§13, §15)

- Emplacements obligatoires : `FRONT_LEFT`, `FRONT_RIGHT`, `REAR`, `INTERIOR`.
  Des emplacements supplémentaires sont configurables par prestation.
- **Capture in-app** : `<input capture="environment">` + vérification serveur de
  `capturedInApp`, de l'horodatage EXIF et de l'écart avec `arrivedAt`. Une photo dont
  l'horodatage précède l'arrivée est refusée — c'est ce qui empêche la réutilisation
  d'anciennes photos de galerie (§13).
- Position GPS attachée à chaque photo, comparée à l'adresse du RDV.
- Les photos alimentent la **fiche digitale du véhicule** (§26) : avant/après conservés
  de façon permanente, rattachés au véhicule et non au seul rendez-vous.

### Comment c'est vérifié
Un drapeau « prise dans l'app » envoyé par le navigateur se falsifie en une ligne. Le seul
signal qui vaille est l'horodatage `DateTimeOriginal` écrit par le capteur : il est lu
**côté serveur** (`src/server/photos.ts`, parseur EXIF sans dépendance) et comparé à
l'heure d'arrivée. Une photo antérieure de plus de 15 minutes est refusée, avec un message
qui dit quoi faire.

L'absence d'EXIF n'est pas un refus — certains navigateurs retirent les métadonnées — mais
elle est enregistrée dans le journal du rendez-vous, comme l'est un import déclaré depuis
la galerie.

### Limite assumée
Le web ne permet pas de *garantir* qu'un fichier vient du capteur. La combinaison
horodatage + position + délai depuis l'arrivée rend la fraude détectable et traçable, pas
impossible. Une app native (Capacitor) serait nécessaire pour un verrou dur.

## 4. Encaissement (§16)

Le système distingue en permanence : **acompte encaissé**, **solde dû**, **total**,
**mode de paiement**, **bénéficiaire des fonds**.

```
total = prix prestation + options
solde = total − acomptes encaissés

Espèces : l'opérateur saisit montant attendu et montant reçu.
          écart ≠ 0  →  alerte critique au central (§27)
                    →  clôture bloquée (§16)
                    →  seul le patron peut régulariser : « complément récupéré »
                       ou « écart assumé », dans les deux cas journalisé (§30)
Carte   : lien de paiement envoyé depuis la PWA ; transition sur webhook confirmé,
          jamais sur un clic opérateur.
```

Le champ `beneficiary` (X Detailing ou opérateur) est porté par chaque paiement : c'est
lui qui alimente le rapprochement des commissions (§18) et détermine qui doit quoi à qui.

## 5. Commission (§18)

- 18 % du CA de lavage, taux stocké **par opérateur** (`Operator.commissionRate`) pour
  absorber une future dérogation sans migration.
- Calculée à la transition `COMPLETED`, figée dans `Commission` — un changement de taux
  ne réécrit jamais le passé.
- Les dépenses publicitaires en sont exclues (§18) et suivies séparément dans `AdSpend`,
  plafonnées à 150 €/mois par opérateur (§19), le surplus étant porté par X Detailing.

## 6. Traçabilité (§30)

`AuditLog` est **append-only** : aucune route d'écriture ni de suppression n'est exposée,
et aucun code applicatif n'en fait d'`UPDATE`. Chaque entrée porte acteur, horodatage,
action, entité, et l'état avant/après.

Actions journalisées : création/modification de RDV, exécution du moteur d'affectation,
changement d'opérateur, démarrage GPS, arrivée, chaque lot de photos, début/fin de
prestation, chaque paiement, annulation, et toute modification administrative.
