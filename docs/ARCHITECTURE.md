# X Detailing OS — Architecture technique

> Document de référence. Traduit le cahier des charges V2 (39 sections) en décisions
> d'ingénierie. Toute divergence entre ce document et le code est un bug de l'un des deux.

## 1. Principe directeur

Le CDC (§34) demande un **système d'exploitation**, pas un agenda. La conséquence
architecturale est unique et structurante :

> **Une seule base relationnelle, un seul moteur métier, trois surfaces.**

Rien dans le code ne doit supposer « un opérateur », « un secteur » ou « une ville ».
Le passage de 3 à 50 opérateurs (§1) doit être une insertion en base, pas un déploiement.

## 2. Stack

| Couche | Choix | Justification |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript) | Les 3 surfaces dans un seul codebase, un seul modèle d'auth, un seul déploiement. Server Actions = moins d'API à écrire pour le back-office. |
| Base | PostgreSQL | Contraintes d'intégrité, transactions, requêtes analytiques (§20, §22), `tstzrange` pour la détection de conflits de planning. |
| ORM | Prisma | Schéma unique versionné, migrations, typage bout-en-bout. |
| Style | Tailwind CSS | Back-office dense + PWA mobile-first sans surcoût de design system. |
| Auth | Sessions JWT httpOnly (`jose`) + RBAC | Aucune dépendance lourde ; 3 rôles seulement (§31). |
| Temps réel | SSE (Server-Sent Events) | Suffisant pour GPS live et statuts (§11, §33) ; unidirectionnel serveur→client, pas de WebSocket à opérer. |
| Tests | `node:test` natif | Le moteur d'affectation est du TypeScript pur : testable sans infra. |

### Pourquoi pas un backend séparé
Le CDC n'impose aucune contrainte qui le justifie. Un backend distinct doublerait le
modèle de données et les règles d'autorisation, pour un bénéfice nul à cette échelle.
Le moteur métier est isolé dans `src/server/` — il reste extractible si le besoin apparaît.

## 3. Les trois surfaces

```
                        ┌──────────────────────────────┐
                        │   PostgreSQL (base unique)   │
                        └──────────────┬───────────────┘
                                       │ Prisma
                        ┌──────────────┴───────────────┐
                        │      src/server/ — noyau     │
                        │  assignment · workflow ·     │
                        │  pricing · commission ·      │
                        │  audit · alerts              │
                        └──────────────┬───────────────┘
             ┌─────────────────────────┼─────────────────────────┐
             │                         │                         │
     ┌───────┴────────┐       ┌────────┴────────┐      ┌─────────┴────────┐
     │   /  (client)  │       │  /pro  (PWA)    │      │ /admin (central) │
     │  §2 booking    │       │  §10→17 workflow│      │ §3 §20 §21 §22   │
     │  §11 suivi     │       │  §11 GPS émis   │      │ §35 affectation  │
     └────────────────┘       └─────────────────┘      └──────────────────┘
```

| Surface | Route | Auth | Rôle CDC |
|---|---|---|---|
| Site client | `/` | anonyme + magic-link | §2 réservation 2 min, §7 Laver maintenant, §11 suivi opérateur, §23 « refaire la même prestation » |
| PWA opérateur | `/pro` | `OPERATOR` | §10 agenda, §11 GPS, §12→17 workflow verrouillé, caméra, push |
| Back-office | `/admin` | `ADMIN` / `DISPATCHER` | §3 RDV téléphone, §20 dashboard, §21 planning global, §22 stats, §28 création opérateur |

## 4. Arborescence

```
src/
  app/
    (public)/              Site client + tunnel de réservation
    pro/                   PWA opérateur (manifest, service worker, caméra, géoloc)
    admin/                 Back-office
    api/                   Webhooks (paiement, leads Meta), SSE, endpoints PWA
  server/
    assignment/            §4 §35 — moteur « Trouver le meilleur opérateur »
      engine.ts            orchestration
      constraints.ts       contraintes dures (faisabilité)
      scoring.ts           score pondéré + garde-fou anti-détour
      types.ts
    workflow/              §12 — machine à états verrouillée
      state-machine.ts     transitions autorisées + gardes
      guards.ts            « pas de photos avant = pas de démarrage »
    pricing/               §2 — tarif + durée depuis la grille
    commission/            §18 — 18 % + rapprochement acompte/solde
    dispatch/              §8 revente de créneau, §7 Wash Now
    quality/               §25 score qualité, §27 alertes
    audit/                 §30 journal
    db.ts                  client Prisma singleton
  lib/
    providers/             §32 — abstraction prestataires externes
      geo/                 géocodage + matrice de temps + ETA
      payments/            acompte, lien de paiement, espèces
      notifications/       SMS / e-mail / push
      weather/             §9
      storage/             photos §13 §15
    auth/                  sessions, RBAC
  components/
prisma/
  schema.prisma
  seed.ts
docs/
```

**Règle d'import** : `src/app/**` peut importer `src/server/**`. L'inverse est interdit.
Le noyau métier ne connaît ni React, ni Next, ni HTTP.

## 5. Abstraction des prestataires externes

Aucun prestataire n'est acté. Chaque service externe est derrière une interface, avec
une implémentation locale fonctionnelle par défaut — **le système tourne sans aucun
compte tiers**, ce qui permet de développer et tester le moteur avant de signer quoi que ce soit.

```ts
interface GeoProvider {
  geocode(address: string): Promise<GeocodeResult>
  travelMatrix(origins: LatLng[], destinations: LatLng[], departAt: Date): Promise<TravelMatrix>
}
```

| Interface | Implémentation par défaut | Bascule production |
|---|---|---|
| `GeoProvider` | Nominatim (géocodage, mis en cache en base) + haversine × facteur routier × profil de vitesse horaire | Google Distance Matrix (trafic réel) ou Mapbox |
| `PaymentProvider` | `ManualPaymentProvider` — lien de paiement factice, encaissement espèces réel | Stripe / Stripe Connect |
| `NotificationProvider` | `ConsoleNotificationProvider` (journalisé en base) | Brevo, Twilio, Web Push |
| `WeatherProvider` | `NullWeatherProvider` | Open-Meteo (gratuit, sans clé) |
| `StorageProvider` | disque local | S3 / R2 |

Sélection par variable d'environnement (`GEO_PROVIDER=haversine|google|mapbox`).
**Toute la logique d'affectation est indépendante du fournisseur** : elle consomme des
minutes et des kilomètres, pas une API.

### Coût du choix par défaut
Le haversine surestime la faisabilité en zone dense et la sous-estime en zone rurale.
Acceptable en Phase 1 (validation de l'algorithme), à basculer sur Google avant mise en
production réelle — la marge de sécurité configurable (§6) absorbe l'écart en attendant.

## 6. Temps réel

| Flux | Mécanisme | Fréquence |
|---|---|---|
| Position GPS opérateur (§11) | `POST /api/pro/tracking` depuis la PWA | 15 s, **uniquement entre « Démarrer le trajet » et « Je suis arrivé »** |
| Suivi client + carte patron | SSE `/api/track/:ref` et `/api/admin/live` | push à chaque ping |
| Statuts RDV (§33) | SSE + revalidation Next | immédiat |

Le GPS n'émet jamais en dehors d'un trajet actif (§11, §31). Ce n'est pas une option de
configuration : la PWA ne démarre le watcher qu'après transition `EN_ROUTE` et l'arrête
sur `ARRIVED`.

## 7. Sécurité, rôles et RGPD (§31)

- 4 rôles : `ADMIN` (patron), `DISPATCHER` (conseiller téléphone), `OPERATOR`, `CUSTOMER`.
- Un opérateur ne lit que **ses** RDV et **ses** clients ; filtrage au niveau du noyau,
  jamais dans le composant.
- Coordonnées client masquées dans la PWA jusqu'à J-1 du rendez-vous.
- `TrackingPing` purgé à 30 jours ; photos conservées selon `PHOTO_RETENTION_DAYS`.
- `AuditLog` immuable (append-only, aucune route d'écriture exposée) — §30.

## 8. Performance (§33)

- Tunnel de réservation : rendu serveur, pas de librairie de carte sur le chemin critique.
- Matrice de temps : appel unique multi-origines pour tous les candidats, jamais N appels.
- Cache géocodage en base (une adresse n'est géocodée qu'une fois).
- Index Postgres sur `(operatorId, scheduledStart)`, `(status, scheduledStart)`, `(sectorId, scheduledStart)`.
- Objectif moteur d'affectation : < 2 s pour 50 opérateurs (§33).

## 9. Documents liés

- [Moteur d'affectation](MOTEUR-AFFECTATION.md) — §4, §5, §6, §35, §39
- [Workflow verrouillé](WORKFLOW.md) — §12 → §17, §30
- [Roadmap & traçabilité](ROADMAP.md) — §37 + couverture des 39 sections
