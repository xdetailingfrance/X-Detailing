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
    pricing/               §2 — tarif + durée depuis la grille
    audit/                 §30 journal append-only
    dashboard.ts           §20 agrégats du tableau de bord
    planning.ts            §21 tournées + détection de conflits
    geocoding.ts           géocodage avec cache persistant
    settings.ts            réglages réseau modifiables à chaud
    time.ts                horaires locaux, fuseau Europe/Paris
    db.ts                  client Prisma singleton
    workflow/              §12 machine à états verrouillée      — phase 3
    commission/            §18 commission + rapprochement       — phase 3
    dispatch/              §8 revente de créneau, §7 Wash Now   — phase 5
    quality/               §25 score qualité, §27 alertes       — phase 5
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

| Interface | Implémentation par défaut | Bascule production | État |
|---|---|---|---|
| `GeoProvider` | Nominatim (géocodage, mis en cache en base) + haversine × facteur routier × profil de vitesse horaire | `GoogleGeoProvider` écrit, à activer par variable d'environnement ; Mapbox à ajouter | **livré** |
| `PaymentProvider` | `ManualPaymentProvider` — lien de paiement interne, encaissement espèces réel | Stripe / Stripe Connect | **interface livrée**, implémentation Stripe en phase 3 |
| `NotificationProvider` | `ConsoleNotificationProvider` | Brevo, Twilio, Web Push | **interface livrée**, envoi réel en phase 2 |
| `WeatherProvider` | — | Open-Meteo (gratuit, sans clé) | phase 5 (§9) |
| `StorageProvider` | — | disque local, puis S3 / R2 | phase 3 (§13) |

Les interfaces non encore nécessaires ne sont pas créées à vide : une interface sans
appelant se périme avant d'être utilisée. Elles arrivent avec la phase qui les consomme.

Sélection par variable d'environnement (`GEO_PROVIDER=haversine|google|mapbox`).
**Toute la logique d'affectation est indépendante du fournisseur** : elle consomme des
minutes et des kilomètres, pas une API.

### Coût du choix par défaut
Le haversine surestime la faisabilité en zone dense et la sous-estime en zone rurale.
Acceptable en Phase 1 (validation de l'algorithme), à basculer sur Google avant mise en
production réelle — la marge de sécurité configurable (§6) absorbe l'écart en attendant.

## 5 bis. Identité de marque

La charte est extraite du logo fourni, pas inventée : couleurs échantillonnées sur le
fichier source.

| Rôle | Valeur | Usage |
|---|---|---|
| Fond | `#000000` | Site client, écran de connexion |
| Violet cœur | `#8008F8` | Seule couleur d'accent du système |
| Violet arête | `#B880F8` | Lueurs, survols, textes d'accent sur fond noir |
| Chrome | `#F4F4F7` → `#6F7180` | Texte du mot-symbole et hiérarchie sur fond noir |

**Le site client est sombre, le back-office reste clair.** Ce n'est pas une incohérence :
le site client est une vitrine consultée sur smartphone, où le noir porte la marque ; le
back-office est un outil de travail dense, lu des heures durant en plein jour, où le fond
clair fatigue moins et fait mieux ressortir les couleurs de signalement (retard, conflit,
alerte). Le violet de la marque est l'accent des deux.

Le logo est détouré par luminance (`public/marque/`) : le fond noir devient transparent,
ce qui préserve les halos violets et permet de le poser sur n'importe quel fond sombre.
Sur fond clair, le mot-symbole chrome disparaîtrait — d'où la pastille noire dans
l'en-tête du back-office.

## 6. Temps réel

| Flux | Mécanisme | Fréquence |
|---|---|---|
| Position GPS opérateur (§11) | `POST /api/pro/tracking` depuis la PWA | 15 s, **uniquement entre « Démarrer le trajet » et « Je suis arrivé »** |
| Suivi client | SSE `/api/track/:token` | 5 s |
| Carte du réseau | SSE `/api/admin/live` | 5 s |

SSE plutôt que WebSocket : le besoin est unidirectionnel — le serveur pousse, le client
n'envoie rien — et SSE traverse les proxies sans négociation, se reconnecte seul, et ne
demande aucune infrastructure supplémentaire.

### La confidentialité est une règle serveur, pas un réglage

Le GPS n'émet jamais en dehors d'un trajet actif (§11, §31). Deux verrous indépendants,
à dessein :

1. l'application ne monte l'émetteur que lorsque le rendez-vous est `EN_ROUTE` ;
2. **le serveur refuse tout ping dont le rendez-vous n'est pas `EN_ROUTE`**, et répond en
   demandant explicitement l'arrêt de l'émission.

Le second suffit seul : la confidentialité ne doit pas reposer sur le bon comportement du
téléphone. Le premier évite simplement d'épuiser la batterie pour rien.

### Coût de l'ETA

Recalculer l'heure d'arrivée à chaque position coûterait 240 appels cartographiques par
heure et par opérateur. Elle n'est donc recalculée que si plus de 60 secondes se sont
écoulées **ou** si l'opérateur a parcouru plus de 300 mètres.

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

## 8 bis. Automatisations

Six tâches récurrentes (météo, purge GPS, demandes d'avis, relances, expiration des
offres, fidélité) vivent dans `src/server/jobs/`. Chacune déclare un intervalle minimal
et laisse une trace `JobRun`.

**Le déclenchement est externe**, sur `/api/cron` protégé par un secret. Un ordonnanceur
embarqué dans le processus web lierait les tâches à une instance unique : à la première
mise à l'échelle horizontale, soit elles tourneraient en double, soit elles cesseraient
de tourner. Externaliser le déclencheur rend le système indifférent au nombre d'instances.

Une tâche dont on ne sait pas si elle a tourné ne vaut pas mieux qu'une tâche absente :
l'écran `/admin/automatisations` signale celles qui n'ont jamais tourné ou dont
l'intervalle est dépassé de plus de moitié.

## 8 ter. Montée en charge (§1, §33)

Mesuré par `npm run bench` :

| Réseau | Affectation |
|---|---|
| 5 opérateurs | 2 ms |
| 50 opérateurs | 1 ms |
| 250 opérateurs | 5 ms |

Le moteur est linéaire en nombre d'opérateurs et n'émet que deux appels cartographiques
quelle que soit la taille du réseau. Avec le fournisseur local, le calcul domine et reste
négligeable ; avec Google, ce sont les deux appels réseau qui dominent — environ 300 ms,
indépendamment du nombre d'opérateurs. Le §33 demande « quelques secondes » : la marge
est de trois ordres de grandeur.

## 9. Documents liés

- [Moteur d'affectation](MOTEUR-AFFECTATION.md) — §4, §5, §6, §35, §39
- [Workflow verrouillé](WORKFLOW.md) — §12 → §17, §30
- [Roadmap & traçabilité](ROADMAP.md) — §37 + couverture des 39 sections
