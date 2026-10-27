# Back-office X Detailing — audit et plan de développement

Document de travail pour la construction du back-office tout-en-un (cahier
des charges « Création d'un back-office professionnel tout-en-un »). Il est
mis à jour à chaque étape livrée : voir `02-journal-des-etapes.md`.

## 1. Audit de l'existant

### Stack

| Élément | Existant | Verdict |
| --- | --- | --- |
| Framework | Next.js 16.3 (App Router), React 19, TypeScript, Tailwind 4 | Adapté, conservé |
| Backend | Route handlers Next.js (`src/app/api/**`) + Server Components | Adapté, conservé |
| Données | **Magasin en mémoire** (`src/lib/store.ts`, `globalThis.xdStore`) préchargé avec des données de démo| **Bloquant** : rien n'est persistant, chaque instance Vercel a sa copie |
| Schéma cible | `prisma/schema.prisma` (PostgreSQL, Prisma 7 + adapter `pg`) et 4 migrations, en retard sur le code | À compléter et brancher |
| Authentification | Maison : bcrypt + JWT signé (`jose`) en cookie httpOnly, RBAC dans `src/middleware.ts` | Bonne base. Désactivée par défaut (`DISABLE_AUTH`), convention `middleware` dépréciée en Next 16 (→ `proxy`) |
| Rôles | OWNER, COMMERCIAL, OPERATEUR | À étendre : RESPONSABLE, COMPTABLE, permissions fines |
| Paiement | Stripe Checkout pour l'acompte en ligne + webhook signé, idempotent | Bonne base, à étendre (solde,liens, remboursements) |
| SMS | Twilio REST (sinon simulé, journalisé) + cron rappel de la veille | Bonne base, à brancher sur le moteurd'automatisations |
| Géocodage | Base Adresse Nationale (`src/lib/geo.ts`), distances à vol d'oiseau | À compléter par un fournisseur d'itinéraires |
| GPS | **Simulé** (`GpsLiveSimule.tsx`) | À remplacer par de vraies positions |
| Photos / signatures | Photos **simulées** (case cochée, pas de fichier), signatures en data URL dans le RDV, 4angles | À refaire : 8 photos réelles, stockage objet |
| Facturation | Numéro `XD-année-xxxxxx` posé à la clôture, pas de document | À créer (factures, avoirs, TVA) |
| Comptabilité | Page Finances : CA jour/semaine/mois, dépenses mensuelles globales | À créer (dépenses détaillées, justificatifs, exports) |
| IA | Lola : Claude (`@anthropic-ai/sdk`), 15 outils, boucle tool-use manuelle, moteur local sans clé, réveil vocal | Réutilisée telle quelle, à brancher sur les nouvelles données et permissions |
| Tests automatisés | Aucun dans le dépôt (tests Playwright ponctuels hors dépôt) | À créer |
| Déploiement | Vercel, cron `vercel.json` | Conservé |

### Fonctionnalités déjà opérationnelles (à préserver)

- Site public : réservation en 6 étapes, créneaux réels, options, acompte Stripe.
- Back-office : tableau de bord, planning, clients, RDV (création, affectation
  avec moteur « meilleur opérateur »), devis (pipeline, lien public, acceptation),
  opérateurs, packs & tarifs, finances, journal SMS.
- Espace opérateur : workflow verrouillé (route → contrôle signé → photos →
  lavage → photos → signature → paiement → clôture).
- Page de suivi client `/suivi/[token]` avec note de satisfaction.
- Lola sur l'accueil du back-office.

### Problèmes identifiés

1. **Persistance** : données en mémoire, perdues au redémarrage ; incompatible
   avec des paiements, des factures ou une comptabilité.
2. **Fuseau horaire** : les créneaux et les dates affichées dépendent du fuseau
   du serveur (UTC sur Vercel).
3. **Accès** : back-office ouvert par défaut, mot de passe de démo commun dans le code.
4. **Données de démo mêlées aux données réelles** (règle 20 du cahier des charges).
5. **Simulations présentées dans l'interface** (GPS, photos, lien de paiement en fin
   de prestation) : à remplacer par de vraies intégrations ou à étiqueter.
6. Pas de piste d'audit, pas de tests automatisés.

## 2. Conception

### Modules (navigation latérale)

Vue d'ensemble · Commercial et CRM · Leads Meta Ads · Clients · Devis ·
Réservations · Planning · Opérateurs · Suivi GPS · Interventions ·
Facturation · Comptabilité · Dépenses · Marketing · Automatisations · Lola IA
· Rapports · Paramètres.

### Modèle de données (cible)

- **Socle** : Utilisateur, Role/Permission, JournalAudit, Parametre.
- **Clients** : Client, Adresse, Vehicule, Consentement, Interaction.
- **Commercial** : Lead (source Meta, campagne, formulaire, réponses), EtapePipeline,
  Tache/Relance, Devis + LigneDevis (numéro unique), GrilleTarifaire (Pack,
  PackTarif, Option, Prestation de polissage).
- **Opérations** : RendezVous (réservation), Intervention (dossier qualité),
  Photo (8 avant / 8 après, fichier stocké), Signature, Operateur,
  Disponibilite/Indisponibilite, Vehicule de flotte (camionnette), Equipe, Secteur.
- **Déplacements** : Course (départ, arrivée, ETA), PositionGps (points),
  LienSuivi (jeton temporaire).
- **Argent** : Paiement (carte, espèces, partiel, idempotence par référence
  prestataire), Facture + LigneFacture, Avoir, Depense + Justificatif,
  ExportComptable.
- **Marketing** : CampagneMeta, StatistiqueMeta (quotidienne), attribution
  Lead → Devis → Réservation → Facture.
- **Automatisations** : RegleAutomatisation (déclencheur, conditions, actions,
  actif), ExecutionAutomatisation (historique, reprise), Sms, Email.

### Rôles

| Rôle | Périmètre |
| --- | --- |
| DIRECTEUR (OWNER) | Tout, paramètres, procédures exceptionnelles |
| RESPONSABLE | Opérations et planning, selon permissions |
| COMMERCIAL | Leads, clients, devis, relances, réservations ; pas de finances |
| OPERATEUR | Ses missions et les clients de ses missions uniquement |
| COMPTABLE | Factures, paiements, dépenses, justificatifs, exports ; pas de GPS ni CRM |

Permissions vérifiées côté serveur (proxy + chaque route), personnalisables par
utilisateur. Lola agit avec les permissions de l'utilisateur qui lui parle.

### Intégrations externes à configurer

| Fonction | Fournisseur proposé | À fournir |
| --- | --- | --- |
| Base de données | PostgreSQL (Neon, Supabase ou Vercel Postgres) | `DATABASE_URL` |
| Photos, justificatifs, PDF | Vercel Blob (ou S3) | `BLOB_READ_WRITE_TOKEN` |
| Leads et statistiques Meta | Graph API Meta : webhook `leadgen`, Marketing API | Application Meta validée (`leads_retrieval`, `ads_read`, `pages_manage_metadata`), jeton de page, `META_APP_SECRET`, `META_VERIFY_TOKEN` |
| Cartes, itinéraires, ETA | Mapbox (ou Google Maps Platform) | `MAPBOX_TOKEN` (public restreint) + clé serveur |
| SMS | Twilio (déjà intégré) | `TWILIO_*`, expéditeur alphanumérique « XDetailing » |
| E-mail | Resend (ou Brevo) | `RESEND_API_KEY`, domaine vérifié |
| Paiement carte | Stripe (déjà intégré) : liens de paiement, Tap to Pay sur iPhone | Clés Stripe, compte Terminal pour l'encaissement en main propre |
| GPS en arrière-plan | Application mobile opérateur (Expo / React Native) | Comptes Apple Developer et Google Play |
| IA | Claude (déjà intégré) | `ANTHROPIC_API_KEY` |

Une page web ne peut pas transmettre la position en continu quand l'écran est
verrouillé ou l'application en arrière-plan : le suivi fiable nécessite
l'application mobile opérateur. La page web sert de solution de départ
(position envoyée tant que la page est ouverte) et l'interface l'indique.

## 3. Plan de développement

| Phase | Contenu | État |
| --- | --- | --- |
| 1 | Audit | Fait (ce document) |
| 2 | Conception | Fait (section 2), affinée module par module |
| 3 | Fondations : base PostgreSQL, fuseau Europe/Paris, journal d'audit, rôles étendus, proxy Next 16, données de démo séparées | Fait (étape 1) |
| 3 bis | Design system sombre premium, navigation 18 rubriques, tableau de bord directeur | Fait (étape 2) |
| 4 | CRM, leads Meta (webhook + reprise), pipeline, devis express 30 s, PDF, relances | À faire |
| 5 | Planning multi-vues, indisponibilités, flotte, interventions, 8 photos réelles, signatures, paiements carte/espèces | À faire |
| 6 | Expérience « Uber » : course, positions GPS réelles, carte, ETA, lien de suivi temporaire, SMS | À faire |
| 7 | Facturation (numérotation, TVA, avoirs), dépenses + justificatifs, espace comptable, exports | À faire |
| 8 | Moteur d'automatisations, Lola branchée sur toutes les données avec permissions | À faire |
| 9 | Tests, sécurité, mobile, déploiement | En continu à chaque phase |

