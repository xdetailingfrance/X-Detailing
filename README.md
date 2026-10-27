# X Detailing OS

Logiciel métier de X Detailing (lavage et detailing automobile à domicile) :
site de réservation, back-office, espace opérateur, assistante Lola. Le plan
de construction du back-office tout-en-un et le journal de chaque étape
livrée sont dans [`docs/back-office/`](docs/back-office/).

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript), React 19,
  Tailwind 4 — site, back-office, espace opérateur et API.
- **PostgreSQL + Prisma 7** (`prisma/schema.prisma`, client généré dans
  `src/generated/prisma`) : source de vérité unique. Accès et conversions
  dans `src/lib/db.ts` (montants Decimal → nombres, verrou optimiste des
  RDV, historique en ajout seul).
- Heure de Paris partout (`src/lib/heure.ts`), quel que soit le fuseau du
  serveur (Vercel tourne en UTC).
- Authentification maison : bcrypt + JWT signé (`jose`) en cookie httpOnly.
  Rôles et permissions dans `src/lib/permissions.ts`, vérifiés par
  `src/proxy.ts` sur chaque page et API, puis dans les pages sensibles.
- Piste d'audit (`JournalAudit`, page `/back-office/journal`).
- Stripe Checkout (acomptes), Twilio (SMS), Claude (Lola) : facultatifs.

## Démarrage local

Prérequis : Node 22 et une base PostgreSQL.

```bash
npm install                     # génère aussi le client Prisma
cp .env.example .env            # puis renseigner DATABASE_URL
npm run db:migrate              # crée les tables
npm run db:catalogue            # prestations, prix, options (vraies données)
npm run db:demo                 # facultatif : données de démonstration
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

### Données réelles et données de démonstration

- `npm run db:catalogue` charge le catalogue réel (prestations, grille de
  prix, options, secteurs). Idempotent : ne modifie jamais un prix déjà
  changé dans le back-office.
- `npm run db:demo` ajoute des données fictives (identifiants `demo-…`,
  e-mails `@demo.xdetailing.fr`, mot de passe `xdetailing-demo-2024`).
- `npm run db:demo:supprimer` les retire toutes, sans toucher aux données
  réelles. **À faire avant l'ouverture au public.**
- `npm run creer-utilisateur -- <email> <ROLE> [operateurId]` crée un vrai
  compte (le mot de passe est demandé dans le terminal, 12 caractères
  minimum). Rôles : `OWNER` (directeur), `RESPONSABLE`, `COMMERCIAL`,
  `OPERATEUR`, `COMPTABLE`.

### Connexion

Par défaut (`DISABLE_AUTH` absent), le back-office s'ouvre sans mot de
passe en session directeur : mode développement, signalé par un bandeau.
En production, définir `DISABLE_AUTH=false` et `SESSION_SECRET`.

| Rôle | Accès |
| --- | --- |
| Directeur (`OWNER`) | Tout : finances, tarifs, opérateurs, journal d'audit, son espace opérateur |
| Responsable | Planning, RDV, clients, devis, SMS, opérateurs, Lola |
| Commercial | Planning, RDV, clients, devis, SMS, Lola — jamais les finances |
| Comptable | Finances uniquement |
| Opérateur | Son espace `/operateur` (ses missions) |

La page `/demo` permet de prévisualiser chaque rôle tant que la connexion
est désactivée.

### Tests

```bash
npm run lint
npx tsc --noEmit
DATABASE_URL=postgresql://…/xdetailing_test npm test   # base dédiée, vidée par les tests
npm run build
```

`npm test` lance les tests de règles métier contre une vraie base de test
(son nom doit contenir « test ») : heure de Paris, prix, créneaux, verrous,
réservation simultanée, paiement idempotent, workflow opérateur,
permissions, outils de Lola.

## Déploiement (Vercel)

1. Importer le dépôt dans Vercel (framework Next.js). Build Command :
   `npm run vercel-build` (à saisir dans les réglages du projet).
2. Base PostgreSQL : Storage → Create Database → Neon → Connect.
   `DATABASE_URL` est alors renseignée automatiquement. Pour partager
   une base existante sans toucher à ses tables, ajouter
   `DATABASE_SCHEMA=backoffice`.
3. Variables d'environnement (Production) :
   - `DISABLE_AUTH=false` et `SESSION_SECRET` (`openssl rand -hex 32`) ;
   - `CRON_SECRET` (rappels SMS de la veille) ;
   - `DIRECTEUR_EMAIL` et `DIRECTEUR_MOT_DE_PASSE` (12 caractères
     minimum) : le premier compte directeur est créé au build s'il n'en
     existe aucun, puis plus jamais modifié ;
   - facultatives : voir `.env.example` (Stripe, Twilio, Claude).
4. Déployer. `npm run vercel-build` génère le client Prisma, applique
   les migrations, charge le catalogue réel (création seule, les prix
   modifiés ne sont jamais écrasés), crée le premier directeur, puis
   lance `next build`. Aucune donnée de démonstration n'est chargée.
5. Redéployer après l'ajout de la clé Stripe (la page d'accueil est
   générée au build).

## Fonctionnalités couvertes (Phase 1)

- **RBAC réel** (`src/proxy.ts`, `src/lib/permissions.ts`, `src/lib/auth.ts`, `src/lib/session.ts`) :
  cinq rôles (OWNER, RESPONSABLE, COMMERCIAL, OPERATEUR, COMPTABLE), vérifiés côté serveur sur
  chaque page **et** chaque route API — un Commercial ne peut récupérer le
  CA ni les commissions par aucun endpoint, même en appelant l'API
  directement. Un OWNER peut être en plus lié à sa fiche opérateur
  (lancement solo, ex. Mathieu) et bascule librement entre back-office et
  son espace opérateur.
- **Finances** (`/back-office/finances`, OWNER uniquement) : CA jour/semaine/
  mois, commission réseau (18 %), acomptes encaissés, soldes restants, CA par
  opérateur, et dépenses fixes/publicité éditables par mois avec marge nette
  estimée.
- **Espace Opérateur** (`/operateur`) : « Ma semaine » (nombre de RDV placés,
  jamais le CA), détail par jour (client, adresse, véhicule, pack, options,
  durée, statut), et **reste à payer** uniquement — jamais le montant de
  l'acompte (encaissé par X Detailing).
- **Workflow verrouillé opérateur** (`/operateur/rendez-vous/[id]`) : route
  démarrée avec GPS live **simulé** (animation, aucune API de cartographie
  réelle) → arrivée → contrôle véhicule/prix + signature client (canvas) →
  4 photos avant obligatoires (simulées, pas d'accès caméra réel) →
  prestation → 4 photos après + signature de fin → paiement (carte avec lien
  SMS simulé, ou espèces avec vérification) → facture générée → clôture.
  Toutes les transitions sont validées côté serveur
  (`src/lib/workflow.ts`) : jamais un statut envoyé "tel quel" par le
  client. Chaque RDV a un lien public de suivi `/suivi/[token]` (jeton non
  deviné, sans authentification) où le client voit le GPS live simulé et
  peut noter sa prestation une fois clôturée.
- **Devis & pipeline Commercial** (`/back-office/devis`, Commercial et
  OWNER) : création d'un devis (prix calculé côté serveur), envoi simulé,
  page de consultation publique `/devis/[token]` (acceptation + paiement
  d'acompte simulé côté client), puis conversion en rendez-vous une fois
  l'acompte payé — la fiche RDV créée réutilise le moteur d'affectation
  existant « TROUVER LE MEILLEUR OPÉRATEUR ».
- **Clients** : fiche client, adresse, véhicule avec catégorie et plaque
  facultative (`/back-office/clients`).
- **Opérateurs** (OWNER uniquement) : création, secteur, horaires, statut
  actif/suspendu (`/back-office/operateurs`).
- **Packs & Tarifs** (OWNER uniquement, `/back-office/packs`) : grille de prix
  administrable par pack × catégorie de véhicule, options avec prix propre.
  Modifier un tarif n'affecte jamais les RDV déjà créés (le prix est figé sur
  le RDV au moment de la réservation).
- **Rendez-vous** : création manuelle avec calcul serveur du prix (pack +
  catégorie du véhicule + options) et de l'acompte (10 %, jamais transmis par
  le client), fiche RDV avec affectation (`/back-office/rendez-vous/[id]`).
- **Moteur d'affectation** (`src/lib/affectation.ts`) : analyse tous les
  opérateurs actifs, filtre ceux dont la tournée resterait faisable (trajet +
  marge de sécurité respectés), puis classe les candidats selon proximité/
  trajet 40 %, disponibilité 25 %, charge de travail 20 %, équilibre du CA
  10 %, qualité 5 %. Le CA par opérateur n'est renvoyé par l'API que si
  l'appelant est OWNER.
- **Planning global** (`/back-office/planning`) : vue jour par opérateur.
- **Lola, l'assistante vocale de l'écran d'accueil** (`/back-office`, OWNER
  et Commercial ; `src/components/lola/`, `src/lib/lola.ts`,
  `src/lib/lolaOutils.ts`) : une planète animée qui respire au repos, émet
  des ondes quand elle écoute et pulse au rythme de sa voix. Elle se
  réveille quand on dit son prénom (« Lola » seul, ou « Lola, qu'est-ce qui
  se passe aujourd'hui ? » d'une traite) ou quand on la touche. Chaque
  rendez-vous ou SMS dont elle parle apparaît en animation au moment où
  elle l'annonce.
  - **Avec `ANTHROPIC_API_KEY`** (Claude, en tool use) : elle répond à tout
    ce qui touche X Detailing (planning, opérateurs, clients, devis,
    tarifs, SMS, finances pour le patron uniquement) et **agit** : crée
    des clients (adresse géolocalisée via la Base Adresse Nationale), met
    des RDV au planning, affecte les opérateurs (moteur « meilleur
    opérateur » ou choix imposé, chevauchements signalés), déplace ou
    annule, transforme un devis payé en RDV, envoie des SMS et les
    rappels de la veille. Avant toute action, elle récapitule et demande
    « Je confirme ? ». Mêmes règles que le back-office (prix recalculés
    côté serveur, droits par rôle).
  - **Sans clé** : un moteur intégré lit le planning (aujourd'hui, demain,
    un jour, un opérateur, la semaine, RDV non affectés) mais n'agit pas.
  - Reconnaissance vocale du navigateur (Chrome/Edge recommandés), champ
    texte en secours ; le navigateur exige un premier clic sur la page
    avant que Lola puisse parler.
- **Page d'accueil publique et réservation en ligne immersive** (`/`,
  `src/components/accueil/`) :
  - *Thème* : site en fond blanc (encre, violet), l'ouverture restant sur
    noir ; sur blanc, le mot DETAILING du logo passe en noir.
  - *Animation d'accueil* : après l'ouverture, le titre monte mot par mot
    et l'utilitaire traverse la page, sa traînée devenant le trait du titre.
  - *Ouverture* : le logo officiel (`public/marque/`, découpé sans
    retouche par `scripts/calques-logo.py`) — un X violet se dessine sur
    fond noir, se révèle en métal avec reflets, « DETAILING » apparaît, puis
    le logo rejoint l'en-tête et les prestations apparaissent. Passable d'un
    tap, jouée une fois par session, ignorée si « réduire les animations ».
  - *Parcours* (`ExperiencePrestations.tsx`) : prestation → véhicule →
    options (prix mis à jour instantanément, récapitulatif) → créneau →
    coordonnées → confirmation. Un utilitaire de service aux couleurs X
    Detailing (silhouette type Kangoo, logo officiel, sans badge
    constructeur) traverse l'écran au choix de la prestation, roule d'étape
    en étape sur la route de progression et arrive devant le domicile
    avant les coordonnées ; après l'enregistrement réel, scène finale
    (voiture propre, agent qui remercie) puis référence et récapitulatif.
    Retour arrière à chaque étape sans perte de saisie.
  - *Réservation* (`/api/reservation`, `/api/reservation/creneaux`,
    publiques) : réutilise le système existant (fiche client retrouvée
    par téléphone, RDV `SITE_CLIENT` en attente, prix + options + acompte
    recalculés côté serveur, SMS de confirmation). Créneaux fixes 8h30,
    11h30 et 15h, le samedi 9h et 12h,
    fermé le dimanche (`HEURES_CRENEAUX`), proposés seulement si un opérateur
    est libre d'après les horaires et le planning réels
    (`src/lib/disponibilites.ts`).
  - *Paiement* (`src/lib/paiement.ts`) : avec `STRIPE_SECRET_KEY`, l'acompte
    de 10 % est payé par Stripe Checkout. Le RDV bloque son créneau 30 min ;
    la confirmation (écran final, SMS) n'a lieu qu'après validation réelle
    par Stripe — au retour du client (`/api/reservation/paiement`, statut
    relu chez Stripe) ou par le webhook signé `/api/stripe/webhook`
    (`STRIPE_WEBHOOK_SECRET`). Paiement annulé ou expiré : RDV annulé,
    créneau libéré. Sans clé Stripe : réservation enregistrée sans
    paiement en ligne (indiqué au client), rien n'est simulé.
  - Prestations et options affichées = grille Packs & Tarifs
    (`src/lib/prestationsPubliques.ts`).
- **Back-office et Lola sur téléphone** : sous 768 px, le menu latéral
  devient une barre du haut avec un menu tiroir
  (`src/app/back-office/NavBackOffice.tsx`), les tableaux défilent
  horizontalement, les formulaires passent sur une colonne, le planning
  empile les opérateurs et le pipeline des devis défile colonne par
  colonne. Sur l'accueil, Lola s'affiche planète, puis cartes, puis
  saisie ; un bouton « Lola » flottant
  (`src/components/lola/LolaRaccourci.tsx`) sur les autres pages ramène à
  l'accueil avec Lola à l'écoute.
- **SMS automatiques** (`src/lib/sms.ts`, journal `/back-office/sms`) :
  confirmation au client à la création d'un RDV, détail de la mission à
  l'opérateur et prénom de l'opérateur au client à l'affectation, SMS de
  déplacement/annulation et rappels de la veille (chaque soir via Vercel
  Cron, `vercel.json` + `CRON_SECRET`). Envoi réel via Twilio
  (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`), sinon
  simulé et consigné dans le journal et l'historique du RDV. Un seul
  rappel par RDV, même si la tâche est relancée.
- **Tableau de bord** (`/back-office`) : RDV du jour, opérateurs actifs —
  volontairement sans aucune donnée financière (accessible au Commercial).

### Limites connues (à lever dans les phases suivantes)

- Distance/temps de trajet estimés par formule haversine + vitesse moyenne ;
  à remplacer par un vrai service cartographique (matrices de temps, trafic
  réel).
- Géocodage automatique par la Base Adresse Nationale ; sans réponse
  (3 s), l'adresse reste non géolocalisée et l'opérateur se choisit à la main.
- Score qualité/fiabilité de l'opérateur (5 % de la pondération) non encore
  branché sur de vrais avis clients.
- Dans l'espace opérateur, le GPS live, les photos (case cochée, pas de
  fichier) et le lien de paiement de fin de prestation sont encore
  **simulés** ; ils seront remplacés aux phases 5 et 6 du plan
  (`docs/back-office/01-audit-et-plan.md`). Les acomptes en ligne
  (réservation et devis) passent, eux, par Stripe sans aucune simulation.
- Pas encore couverts (nécessitent des intégrations externes ou une UI
  conséquente — à prioriser avec le client) :
  - Réservation client public (site) + parcours "2 minutes".
  - IA photo (analyse client direct + recommandation de packs/options).
  - Photos client facultatives avant RDV + SMS de confirmation à la
    réservation (distinct des photos avant/après de la prestation, déjà
    couvertes).
  - Impayés (dossier de preuve), historisation complète des versions de prix
    et signatures au-delà de l'historique simple déjà journalisé sur chaque
    RDV/devis.
- Mots de passe de démo identiques pour tous les comptes seed : à ne
  **jamais** utiliser tels quels en production ; prévoir une procédure de
  création de compte/réinitialisation avant tout déploiement réel.

