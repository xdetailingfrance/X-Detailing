# Passation — site X Detailing et back-office

À lire en premier, par le développeur ou par son assistant (Claude).
Le site public et le back-office forment **une seule application
Next.js** : le back-office partage la base, les règles de prix, les
créneaux et le paiement avec le site. On ne peut pas les séparer.

## 1. Où est le code

- Dépôt GitHub : `mcaumeil33360-lab/X-detailing-App`.
- Branche à jour : `claude/instagram-reel-review-652vfl` (à fusionner
  dans `main` ou à choisir comme branche de production Vercel).
- Archive jointe : même contenu que cette branche.

## 2. Ce qui est fait

**Site public**
- Réservation en 6 étapes, créneaux du site actuel : 8h30, 11h30, 15h
  en semaine, 9h et 12h le samedi, fermé le dimanche.
- Options par rubrique, avec quantités.
- Acompte de 10 % par Stripe Checkout. La réservation n'est confirmée
  qu'une fois le paiement validé par Stripe : jamais de faux paiement.
- Écran d'introduction avec le logo officiel. Le logo ne doit pas être
  modifié.

**Fondations du back-office (étape 1)**
- PostgreSQL via Prisma 7 (`prisma/schema.prisma`, une migration
  `socle`).
- Heure de Paris partout (`src/lib/heure.ts`), même sur un serveur en
  UTC.
- 5 rôles : directeur, responsable, commercial, opérateur, comptable.
  Les permissions sont dans `src/lib/permissions.ts` et vérifiées par
  `src/proxy.ts` (Next 16 : `proxy.ts` remplace `middleware.ts`).
- Journal d'audit (`/back-office/journal`).
- Verrou optimiste sur les rendez-vous ; historique en ajout seul.
- Réservation sous verrou par journée : pas de double réservation.
- Paiements Stripe idempotents (retour client et webhook simultanés).
- Catalogue réel séparé des données de démonstration (identifiants
  `demo-…`, supprimables en une commande).

**Interface du back-office (étape 2)**
- Navigation en 18 rubriques, thème sombre.
- Tableau de bord du directeur :
  - CA réservé, CA réalisé, encaissé vérifié par Stripe, espèces et
    carte déclarées, reste à recevoir ;
  - graphique, et filtres par période, opérateur, prestation et source.
- Rubriques en service : Réservations, Planning, Clients, Devis,
  Opérateurs, Interventions (photos, signatures, paiement),
  Automatisations, Lola IA, Finances, Paramètres, Journal.
- Rubriques annoncées « bientôt », sans aucune donnée fictive : CRM,
  Leads Meta, Suivi GPS, Facturation, Dépenses, Marketing, Rapports.

**Déploiement**
- Le build Vercel applique les migrations et charge le catalogue réel
  (création seule, les prix modifiés ne sont jamais écrasés).
- Il crée aussi le premier compte directeur à partir de
  `DIRECTEUR_EMAIL` et `DIRECTEUR_MOT_DE_PASSE`, s'il n'en existe
  aucun.
- `DATABASE_SCHEMA` (facultatif) range toutes les tables dans un
  schéma séparé, pour partager une base existante sans toucher à ses
  tables.

Le détail de chaque étape et le plan complet sont dans `docs/back-office/`
(`01-audit-et-plan.md`, `02-journal-des-etapes.md`).

## 3. Lancer en local

```bash
npm install
cp .env.example .env         # renseigner DATABASE_URL (PostgreSQL)
npx prisma migrate deploy
npm run db:catalogue          # vrai catalogue
npm run db:demo               # facultatif : données de démonstration
npm run dev
```

Tests (base dont le nom contient « test », vidée par les tests) :

```bash
DATABASE_URL=postgresql://…/xdetailing_test npm test   # 20 tests
npx tsc --noEmit && npm run lint
```

## 4. Mettre en ligne sur Vercel

1. Importer le dépôt (framework Next.js). Build Command :
   `npm run vercel-build`.
2. Storage → Create Database → Neon → Connect. `DATABASE_URL` est alors
   renseignée automatiquement.
3. Variables d'environnement (Production) :

    | Variable | Valeur |
    | --- | --- |
    | `DISABLE_AUTH` | `false` |
    | `SESSION_SECRET` | aléatoire, `openssl rand -hex 32` |
    | `CRON_SECRET` | aléatoire, `openssl rand -hex 32` |
    | `DIRECTEUR_EMAIL` | `xdetailingfrance@gmail.com` |
    | `DIRECTEUR_MOT_DE_PASSE` | choisi par Mathieu, 12 caractères min. |
    | `DATABASE_SCHEMA` | seulement si la base est partagée : `backoffice` |
    | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | facultatif (acompte en ligne) |
    | `TWILIO_*`, `ANTHROPIC_API_KEY` | facultatif (SMS réels, Lola) |

4. Déployer, puis se connecter sur `/login` avec le compte directeur.
5. Stripe : webhook vers `https://<domaine>/api/stripe/webhook`
   (événements listés dans `.env.example`). Redéployer après l'ajout de
   la clé : la page d'accueil est générée au build.

## 5. Règles à respecter (demandées par Mathieu)

- Ne pas redessiner le logo, ni changer sa forme ou sa typographie.
- N'inventer aucun prix, aucune disponibilité, aucune fonctionnalité de
  paiement.
- Ne jamais simuler un paiement réussi, une intégration, un suivi GPS
  ou une confirmation : sans connexion réelle, l'interface l'indique.
- Distinguer les estimations des chiffres comptables.
- Aucune clé secrète dans le navigateur ni dans le code source.
- Ne jamais marquer une fonctionnalité comme terminée si elle n'est ni
  implémentée ni testée.
- Avancer étape par étape, en documentant chaque étape dans
  `docs/back-office/02-journal-des-etapes.md`.

## 6. Prochaines étapes

| Phase | Contenu |
| --- | --- |
| 4 | CRM et pipeline, devis express en 30 s (PDF, SMS/e-mail, relances), réception des leads Meta |
| 5 | Planning multi-vues, indisponibilités, flotte, 8 photos réelles avant/après (stockage Vercel Blob), signatures, paiements carte/espèces |
| 6 | Suivi « Uber » : positions GPS réelles, carte, heure d'arrivée, lien de suivi temporaire |
| 7 | Facturation (numérotation, TVA, avoirs), dépenses et justificatifs, espace comptable, exports |
| 8 | Moteur d'automatisations, Lola branchée sur toutes les données avec permissions |

Questions encore ouvertes avec Mathieu :
- « Traitement du cuir » et « Traitement du cuir, hors sièges » doivent-ils
  s'exclure l'un l'autre ?

## 7. Note pour Next.js 16

Cette version de Next.js change des API par rapport aux versions
connues (voir `AGENTS.md`). Lire le guide correspondant dans
`node_modules/next/dist/docs/` avant de modifier le code.

