# X Detailing OS

Système d'exploitation du réseau X Detailing : acquisition, réservation, affectation
intelligente, exécution, paiement, commission, qualité et pilotage central.

Implémente le cahier des charges V2 (39 sections). **Les six phases du §37 sont
livrées** : base de données complète, moteur d'affectation, back-office central, site
client, CRM, application opérateur avec workflow verrouillé, suivi GPS temps réel,
statistiques réseau, météo, qualité, comptes entreprise et automatisations.

## Démarrer

```bash
npm install
npm run db:dev        # serveur PostgreSQL local (aucun Docker requis) — laisser tourner
npm run db:migrate    # applique le schéma
npm run db:seed       # réseau lyonnais de démonstration
npm run dev
```

`npm run db:dev` affiche une chaîne de connexion. Si le port diffère de celui de `.env`,
mettez `DATABASE_URL` à jour (utilisez `127.0.0.1`, pas `localhost` : le serveur n'écoute
qu'en IPv4).

Connexion : `patron@xdetailing.fr` / `xdetailing` (patron) ou
`conseiller@xdetailing.fr` / `xdetailing` (conseiller téléphone).

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests du moteur d'affectation |
| `npm run typecheck` | Vérification TypeScript |
| `npm run probe` | Exécute le moteur sur les données réelles et affiche le classement |
| `npm run check` | État du système : dernier RDV, runs archivés, journal d'audit |
| `npm run verify:workflow` | Déroule le workflow §12 → §18 sur une prestation du jour |
| `npm run verify:tracking` | Vérifie la règle de confidentialité GPS du §11 |
| `npm run demo:trajet` | Met une prestation en trajet, pour voir la carte live |
| `npm run purge:tracking` | Supprime les traces de déplacement expirées (§31) |
| `npm run check:meteo` | Contrôle météo des prestations à venir (§9) |
| `npm run verify:phase5` | Vérifie revente de créneau, Wash Now, avis et statistiques |
| `npm run verify:phase6` | Vérifie automatisations, fidélité, facturation et régions |
| `npm run bench` | Mesure le moteur d'affectation et les requêtes du back-office |
| `npm run db:studio` | Explorateur de base Prisma |

## Ce qui est livré — phase 6

- **Comptes entreprise** (§24) — flotte, sites multiples, responsables, fréquence de
  lavage et CA annuel.
- **Facturation mensuelle** (§24) — préparation, émission numérotée, TVA figée sur la
  facture. Une prestation déjà facturée ne peut pas l'être deux fois.
- **Fidélité** — règle paramétrable, désactivée par défaut : le cahier des charges ne fixe
  pas la mécanique, c'est une décision commerciale. Les récompenses acquises restent dues
  même si la règle change.
- **Automatisations** — six tâches nommées avec intervalle et trace d'exécution,
  déclenchées par `/api/cron`. L'écran de pilotage signale les tâches en retard.
- **Multi-régions** — les secteurs se rattachent à une région.
- **Montée en charge vérifiée** — 250 opérateurs affectés en 5 ms.

## Ce qui est livré — phase 5

- **Statistiques réseau** (§22) — CA, prestations, panier, remplissage, trajet, kilomètres,
  ponctualité, avis et annulations, comparables par opérateur et par secteur.
- **Analyse de la répartition** (§5) — indice de Gini sur le CA, écart entre extrêmes, et
  taux de suivi des propositions du moteur. Un taux de choix manuels élevé signale un
  moteur mal réglé.
- **Météo** (§9) — Open-Meteo, sans clé. Une prestation extérieure menacée par la pluie ou
  le gel déclenche une proposition de reprogrammation ; **le client garde la décision**.
- **Revente de créneau** (§8) — à l'annulation, les clients proches ou flexibles sont
  identifiés et sollicités, avec une offre qui expire avant le créneau.
- **Laver maintenant** (§7) — créneaux réellement tenables dans les 4 heures.
- **Avis et qualité** (§25) — page d'avis publique, score qualité explicable en 4 axes,
  très bons avis orientés vers Google, avis faibles alertés au central.

## Ce qui est livré — phase 4

- **Suivi GPS temps réel** (§11) — émission depuis l'application opérateur, toutes les
  15 secondes, **uniquement pendant le trajet**.
- **Confidentialité par le serveur** — un ping hors trajet est refusé et l'application
  reçoit l'ordre d'arrêter d'émettre. La garantie ne repose pas sur le téléphone.
- **Suivi client** — position, distance restante, heure d'arrivée et carte, sur le lien
  de réservation. Le client ne voit que le prénom de l'opérateur.
- **« Vous êtes presque arrivé »** — notification unique à l'approche.
- **Carte du réseau** (§20) — positions, rendez-vous en cours et suivant, retards prévus.
- **Purge des traces** (§31) — `npm run purge:tracking`, à programmer en tâche quotidienne.

## Ce qui est livré — phase 3

- **Application opérateur** (§32) — PWA installable, agenda du jour, itinéraire, écran
  utilisable à une main.
- **Workflow verrouillé** (§12) — machine à états côté serveur. Les six interdits du
  cahier des charges ont chacun leur test : masquer un bouton ne verrouille rien.
- **Preuves photo** (§13, §15) — quatre vues obligatoires avant et après, avec
  vérification de l'horodatage EXIF **côté serveur** contre l'heure d'arrivée.
- **Encaissement** (§16) — espèces avec contrôle d'écart, lien de paiement, distinction
  acompte / solde / total / bénéficiaire. Un écart bloque la clôture ; seul le patron
  régularise, et la décision est journalisée.
- **Commission** (§18) — 18 % figés à la clôture, au taux en vigueur pour cet opérateur.
- **Fiche digitale du véhicule** (§26) — historique permanent avec ses preuves photo.

## Ce qui est livré — phase 2

- **Site client** (§2) — tunnel de réservation en 5 étapes à la charte de la marque,
  tarif et durée calculés en direct, acompte de 30 %.
- **Créneaux réellement disponibles** — chaque horaire proposé a été validé contre la
  tournée de chaque opérateur ; 2 appels cartographiques pour toute la journée.
- **CRM** (§23) — fiches clients, historique, véhicules, adresses, avis, dépenses, et
  « refaire la même prestation » en un clic.
- **Relances** (§23) — clients sans lavage depuis 60 jours, avec consentement vérifié et
  délai anti-spam de 30 jours.
- **Leads** (§19) — webhook signé et dédupliqué, coût par lead, conversion, CA généré par
  campagne, et création du RDV depuis le lead en conservant la source.

## Ce qui est livré — phase 1

- **Schéma central** — 35 modèles, 24 énumérations, couvrant les 6 phases du §37.
- **Moteur d'affectation** (§4, §35, §39) — contraintes dures, score pondéré sur 5 axes,
  garde-fou anti-détour, 9 tests.
- **Prise de RDV téléphonique** (§3) — saisie client, tarif et durée automatiques,
  « Trouver le meilleur opérateur », validation ou choix manuel.
- **Tableau de bord réseau** (§20) — CA, commission 18 %, panier moyen, répartition par
  opérateur, encaissements, alertes.
- **Planning global** (§21) — tournées de tous les opérateurs, détection des conflits et
  des trajets irréalistes.
- **Fiches opérateurs** (§22, §28, §29) — statistiques, horaires, périmètre, Kangoo ;
  création d'un opérateur immédiatement opérationnel.
- **Réglages du moteur** (§4, §6) — pondération et marges modifiables sans redéploiement.
- **Audit** (§30) — journal append-only, chaque exécution du moteur archivée et rejouable.

## Ce qui n'est pas livré

Le paiement en ligne réel (§38 point 5), qui attend l'arbitrage juridique et comptable —
l'interface existe, l'implémentation Stripe non.

## Automatisations

Six tâches tournent sur `/api/cron`, protégé par `CRON_SECRET`. Branchez n'importe quel
ordonnanceur — cron système, Vercel Cron, GitHub Actions :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://votre-domaine/api/cron
```

Un appel toutes les 15 minutes suffit : chaque tâche a son propre intervalle et ignore
les appels trop rapprochés. L'écran `/admin/automatisations` signale celles qui ne
tournent plus.
Voir [docs/ROADMAP.md](docs/ROADMAP.md).

## Marque

Charte extraite du logo fourni : fond noir, violet `#8008F8`, typographie chrome.
Les fichiers détourés sont dans `public/marque/`. Le site client est sombre, le
back-office reste clair — voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §5 bis.

## Aucun prestataire externe requis

Le système fonctionne sans compte tiers : géocodage OpenStreetMap, temps de trajet
estimés localement, paiements enregistrés manuellement. Chaque service est derrière une
interface (`src/lib/providers/`) — basculer sur Google Maps ou Stripe se fait par variable
d'environnement, sans toucher au moteur.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — stack, surfaces, abstractions, sécurité
- [Moteur d'affectation](docs/MOTEUR-AFFECTATION.md) — contraintes, score, garde-fou
- [Workflow verrouillé](docs/WORKFLOW.md) — machine à états, preuves, encaissement
- [Roadmap](docs/ROADMAP.md) — phases et traçabilité des 39 sections
