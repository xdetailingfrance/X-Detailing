# Journal des étapes

## Étape 1 — Fondations : base de données, heure de Paris, rôles, audit

### Ce qui a été développé

- **Base PostgreSQL réelle** à la place du magasin en mémoire : schéma
  complet (`prisma/schema.prisma`, migration `socle`), accès et conversions
  dans `src/lib/db.ts`. Toutes les pages, routes et Lola lisent et
  écrivent en base.
- **Intégrité des données** :
  - verrou optimiste sur les rendez-vous (une modification concurrente
    n'écrase rien, réponse 409) ;
  - historique des RDV et des devis en ajout seul ;
  - réservation en ligne sous verrou par journée : deux clients ne peuvent
    pas prendre le même créneau ;
  - paiements Stripe idempotents (retour client et webhook simultanés :
    un seul enregistrement, un seul SMS).
- **Heure de Paris** partout (`src/lib/heure.ts`) : créneaux, plannings,
  SMS, Lola, écrans, y compris sur un serveur en UTC.
- **Rôles** : directeur, responsable, commercial, opérateur, comptable,
  avec permissions centralisées (`src/lib/permissions.ts`), vérifiées par
  `src/proxy.ts` (convention Next 16, remplace `middleware.ts`).
- **Journal d'audit** (`JournalAudit`, `/back-office/journal`) : connexions,
  paiements, tarifs, affectations, annulations, créations.
- **Données de démonstration séparées** : catalogue réel (`npm run
  db:catalogue`) et démo (`npm run db:demo`, identifiants `demo-…`,
  suppression en une commande). Script de création de vrais comptes.
- **Corrections** :
  - l'acompte des devis était « payé » par un bouton de simulation : il
    passe désormais par Stripe Checkout, sinon il reste à régler ;
  - les finances comptaient tous les acomptes comme encaissés : seuls ceux
    validés par Stripe le sont ;
  - le montant restant dû côté opérateur et client ne déduit l'acompte que
    s'il a été payé ;
  - réservation : choisir une heure sans cliquer sur le jour proposé par
    défaut laissait l'étape des coordonnées vide ;
  - le back-office ne peut plus forcer un statut de terrain (en route,
    photos…) hors du workflow opérateur.
- **Tests automatisés** (`npm test`, 18 tests) contre une vraie base.

### Fichiers principaux

`prisma/schema.prisma`, `prisma/migrations/*_socle`, `prisma/catalogue.ts`,
`prisma/seedData.ts`, `prisma/seed.ts`, `scripts/creer-utilisateur.ts`,
`src/lib/{db,types,heure,audit,permissions,queries,rendezVous,clients,devis,sms,paiement,workflow,affectation,disponibilites,lola,lolaOutils}.ts`,
`src/proxy.ts`, toutes les routes `src/app/api/**` et pages du back-office,
de l'espace opérateur, du suivi et des devis, `tests/*.test.ts`.

### Tests effectués

- Lint, typage, build de production.
- `npm test` : 18 tests réussis (heure de Paris et changements d'heure,
  prix et quantités, créneaux, verrou optimiste, historique, réservation
  simultanée, paiement idempotent, workflow avec photos et signatures,
  permissions, outils de Lola).
- Navigateur (iPhone 14 et ordinateur) : réservation complète avec
  options, retour arrière sans perte, enregistrement en base à la bonne
  heure, SMS de confirmation.
- Stripe (serveur Stripe simulé localement) : paiement réussi, annulation,
  retour falsifié refusé ; webhook signé (mauvaise signature refusée,
  non-payé ignoré, rejeu sans doublon, acompte de devis).
- Connexion réelle avec chacun des 5 rôles : accès et refus vérifiés sur
  chaque rubrique et sur l'API.
- Les 20 pages répondent sans erreur.

### Intégrations qui attendent des identifiants

- `DATABASE_URL` (obligatoire), `SESSION_SECRET` et `DISABLE_AUTH=false`.
- Stripe (clés + webhook), Twilio, Claude : inchangés, facultatifs.

### Prochaine étape

Phase 3 bis : design system sombre premium, navigation en 18 rubriques,
tableau de bord du directeur (CA facturé / encaissé / à recevoir distincts,
filtres par période, opérateur, prestation et source).

## Étape 2 — Back-office : navigation, thème et tableau de bord du directeur

### Ce qui a été développé

- **Navigation en 18 rubriques** groupées (Pilotage, Commercial,
  Opérations, Argent, Outils), avec pictogrammes, bouton « Nouvelle
  réservation », menu en tiroir sur téléphone. Chaque rubrique n'apparaît
  qu'avec la permission du rôle (vérifiée aussi côté serveur).
- **Thème sombre premium** (noir, anthracite, accents violets) : panneaux,
  cartes statistiques, champs.
- **Vue d'ensemble du directeur** sur les données réelles :
  - argent : CA réservé, CA réalisé, encaissé vérifié (Stripe), espèces et
    carte déclarées par les opérateurs, reste à recevoir, dépenses du mois,
    résultat et coût pub par réservation marqués « Estimation »,
    trésorerie « banque non connectée » ;
  - activité : réservations du jour, à venir, sans opérateur, opérateurs
    actifs, prestations terminées, devis envoyés, taux de transformation,
    leads Meta « non connecté » ;
  - graphique CA réservé / réalisé sur 12 semaines, 12 mois ou 5 ans
    (infobulle, légende, vue tableau, couleurs validées pour les
    daltoniens) ;
  - filtres : période (jour, semaine, mois, année, personnalisée),
    opérateur, prestation, source ; repliés sur téléphone.
  Les montants ne sont visibles qu'avec la permission « finances ».
- **Nouvelles rubriques opérationnelles** : Réservations (liste filtrable,
  appel en un clic), Interventions (signatures, photos, paiement de chaque
  dossier), Automatisations (règles en service, état, envois sur 30 jours),
  Lola IA (plein écran), Paramètres (catalogue, journal d'audit, état des
  intégrations, comptes).
- **Rubriques à venir** (CRM, Leads Meta, GPS, Facturation, Dépenses,
  Marketing, Rapports) : page qui décrit le module, sa phase et ce qu'il
  faut fournir pour l'activer — aucune donnée fictive.

### Tests effectués

- `npm test` : 20 tests réussis (2 nouveaux sur les indicateurs : les cinq
  notions d'argent ne se confondent pas ; bornes de période en heure de
  Paris).
- Lint, typage, build ; les 14 nouvelles pages répondent sans erreur.
- Connexion réelle : le commercial ne voit aucun montant et n'accède ni à
  la facturation ni aux paramètres ; le directeur voit tout.
- Captures ordinateur (1440 × 900) et iPhone 14 vérifiées.

### Prochaine étape

Phase 4 : CRM et pipeline commercial, devis express en 30 secondes (PDF,
envoi SMS/e-mail, relances), préparation de la réception des leads Meta.

