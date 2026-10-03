# Moteur d'affectation — « TROUVER LE MEILLEUR OPÉRATEUR »

> Couvre §4 (moteur intelligent), §5 (optimisation CA réseau), §6 (réservation par
> adresse), §35 (fonction prioritaire) et §39 (règle d'or).
> Implémentation : `src/server/assignment/`.

## 1. Contrat

```ts
type AssignmentRequest = {
  lat: number; lng: number; address: string
  start: Date; durationMin: number
  serviceId: string; vehicleClass: VehicleClass
  priceCents: number
  excludeOperatorIds?: string[]
}

type AssignmentResult = {
  candidates: Candidate[]      // éligibles, triés par score décroissant
  rejected: Rejection[]        // non éligibles + raison lisible
  computedAt: Date
  weights: ScoreWeights        // poids effectifs au moment du calcul
}

type Candidate = {
  operatorId: string; operatorName: string
  score: number                // 0 → 100
  breakdown: Record<ScoreAxis, { raw: number; weighted: number }>
  travelMin: number; distanceKm: number; etaAt: Date
  originLabel: string          // « depuis RDV de 10h30, Rue X » ou « depuis domicile »
  slackBeforeMin: number; slackAfterMin: number
  jobsToday: number; revenueTodayCents: number; revenueWeekCents: number
  fillRate: number             // §5 — taux de remplissage de la journée
  flags: string[]              // « marge serrée », « hors secteur habituel »
}
```

Le moteur est une **fonction pure** : il reçoit un instantané (opérateurs, tournées,
matrice de temps, réglages) et retourne un classement. Aucun accès base, aucun effet de
bord. C'est ce qui le rend testable et rejouable — chaque exécution est archivée dans
`AssignmentRun` pour audit (§30) et analyse d'équité (§5).

## 2. Étape 1 — Contraintes dures (élimination)

Un opérateur est éliminé, avec motif explicite, si **une seule** condition échoue.
L'ordre est délibéré : du moins coûteux au plus coûteux à évaluer.

| # | Contrainte | Motif retourné |
|---|---|---|
| 1 | Statut `ACTIVE` | « opérateur suspendu » |
| 2 | Sait faire la prestation (`OperatorService`) | « prestation non autorisée » |
| 3 | Travaille ce jour, créneau dans les horaires | « hors horaires » |
| 4 | Créneau hors pause déjeuner | « pause » |
| 5 | Pas d'absence/congé chevauchant | « absent » |
| 6 | Aucun chevauchement avec un RDV existant | « déjà occupé à 14h00 » |
| 7 | **Trajet amont faisable** | « trajet impossible depuis le RDV de 13h (28 min, marge 4 min) » |
| 8 | **Trajet aval faisable** | « mettrait en retard le RDV de 16h » |
| 9 | Distance ≤ `maxTravelMin` (réglage réseau) | « trop loin (52 min) » |

### Contraintes 7 et 8 — le cœur du §6

```
        RDV précédent                    NOUVEAU RDV                  RDV suivant
  ┌──────────────────┐            ┌──────────────────┐          ┌──────────────┐
  │  fin 13h30       │            │  14h15 → 15h45   │          │ début 16h30  │
  └────────┬─────────┘            └───┬──────────┬───┘          └──────┬───────┘
           │   trajet 22 min + marge  │          │  trajet 18 min + marge
           └──────────────────────────┘          └─────────────────────┘
              13h30 + 22 + 10 = 14h02 ≤ 14h15 ✓      15h45 + 18 + 10 = 16h13 ≤ 16h30 ✓
```

- `marge` = `travelSafetyMarginMin`, **configurable par X Detailing** (§6), défaut 10 min.
- Le point de départ est le **RDV précédent réel**, pas le domicile de l'opérateur — c'est
  la différence explicite exigée par le §4 (« au lieu de choisir uniquement selon leur
  domicile ou leur secteur »).
- Sans RDV précédent dans la journée : départ du domicile. Sans RDV suivant : pas de
  contrainte aval.
- Un créneau impossible est **refusé automatiquement** ; une marge < `tightMarginMin`
  (défaut 15 min) passe mais lève le flag « marge serrée » (§6).

## 3. Étape 2 — Score pondéré

Poids par défaut (§4, modifiables sans redéploiement via la table `Setting`) :

| Axe | Poids | Calcul (normalisé 0→1) |
|---|---|---|
| `proximity` | **40 %** | `1 − travelMin / maxTravelMin` |
| `availability` | **25 %** | confort des marges — à quel point le RDV tient sans tension |
| `workload` | **20 %** | `1 − jobsToday / targetJobsPerDay` |
| `revenueBalance` | **10 %** | `1 − (CA semaine − min) / (max − min)` sur les candidats retenus |
| `quality` | **5 %** | `qualityScore / 100` (§25) |

`score = Σ (axe × poids) × 100`, arrondi à l'entier.

### `availability` — pourquoi ce n'est pas « est-il libre »
La contrainte dure a déjà répondu à « est-il libre ». Cet axe mesure **la qualité de la
tournée résultante** : insérer un RDV à 14h chez un opérateur qui finit à 13h30 à 5 min de
là est excellent ; le même RDV chez un opérateur libre toute la journée mais qui devra
faire deux fois 40 min à vide est mauvais. Formule : `1 − tempsMortAjouté / durééePrestation`,
borné à [0,1].

### `revenueBalance` — §5
Rang du CA de la semaine **parmi les candidats retenus uniquement**, pas parmi tout le
réseau : comparer un opérateur de Lyon à un opérateur de Marseille n'a aucun sens pour ce
rendez-vous. Le moins chargé obtient 1, le plus chargé 0.

## 4. Le garde-fou anti-détour (§4 et §39)

> « Le CA ne doit jamais faire envoyer un opérateur beaucoup plus loin lorsque cela
> dégrade fortement le trajet ou la faisabilité. » (§4)
> « L'équilibrage du CA ne doit pas créer des trajets absurdes. » (§39)

Un simple score pondéré viole cette règle : avec 30 % cumulés sur charge + CA, un
opérateur à 45 min peut battre un opérateur à 10 min. Le garde-fou est donc **structurel**,
pas une question de réglage des poids.

**Règle de cohorte comparable :**

```
bestTravel = min(travelMin) parmi les candidats éligibles

Un candidat est « comparable » si :
    travelMin ≤ bestTravel + comparableBandMin        (défaut 12 min)

→ Candidat comparable      : score complet, tous axes actifs.
→ Candidat non comparable  : axes `workload` et `revenueBalance` forcés à 0.
                             Leurs poids (30 %) sont redistribués sur `proximity`.
```

Conséquence : l'équilibrage du CA **départage** des candidats réellement interchangeables
(§35 : « l'équilibrage du CA sert à départager les candidats réellement comparables »),
mais ne peut jamais faire gagner un candidat nettement plus éloigné. `comparableBandMin`
est le seul levier de cette règle, et il est exposé dans les réglages réseau.

## 5. Sortie

Le back-office affiche les **3 meilleurs candidats** (§4) avec, pour chacun : score,
distance, ETA, nombre de prestations du jour, CA jour/semaine, indicateur de remplissage
vert/orange/rouge (§5), et le détail du score axe par axe.

Le patron garde **toujours** la main : bouton de validation, et sélection manuelle d'un
autre opérateur, y compris hors du top 3 (§4, §35). Un choix manuel est enregistré avec
`manualOverride = true` — ce qui permet, à terme, de mesurer l'écart entre le moteur et le
jugement humain et de recalibrer les poids.

## 6. Réglages réseau (table `Setting`)

| Clé | Défaut | Effet |
|---|---|---|
| `assignment.weights` | 40/25/20/10/5 | Pondération des axes |
| `assignment.travelSafetyMarginMin` | 10 | Marge de sécurité entre deux RDV (§6) |
| `assignment.tightMarginMin` | 15 | Seuil du flag « marge serrée » |
| `assignment.maxTravelMin` | 45 | Au-delà : élimination |
| `assignment.comparableBandMin` | 12 | Largeur de la cohorte comparable (§39) |
| `assignment.targetJobsPerDay` | 5 | Base du taux de remplissage (§5) |
| `assignment.candidatesReturned` | 3 | Nombre de propositions affichées |

## 7. Tests

`src/server/assignment/engine.test.ts` couvre les cas que le CDC décrit nommément :

1. Opérateur proche mais déjà occupé → éliminé (§4).
2. Opérateur proche à vol d'oiseau mais tournée infaisable → éliminé (§6, §39).
3. Deux opérateurs équivalents, CA différent → le moins chargé gagne (§5).
4. Opérateur avec faible CA mais 30 min plus loin → **ne gagne pas** (§4, §39) — garde-fou.
5. Marge de sécurité configurée à 0 vs 20 min → l'éligibilité change.
6. Scénario §36 complet → classement de trois candidats avec scores distincts.
7. Opérateur suspendu / sans la compétence → éliminé (§28, §4).
8. Créneau à cheval sur la pause déjeuner → refusé (§4).
9. 20 opérateurs → exactement 2 appels cartographiques (§33).

Les neuf passent : `npm test`.
