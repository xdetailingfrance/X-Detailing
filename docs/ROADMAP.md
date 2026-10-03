# Roadmap & traçabilité du cahier des charges

## Phases (§37)

| Phase | Contenu CDC | État |
|---|---|---|
| **1** | Base clients/opérateurs + planning + création manuelle de RDV + moteur d'affectation | **livrée** |
| **2** | Réservation client + acompte + CRM + rappels | **livrée** |
| **3** | PWA opérateur + workflow verrouillé + photos + paiement | **livrée** |
| **4** | GPS live + ETA + carte patron/client | **livrée** |
| **5** | Statistiques réseau + équilibre CA + météo + revente de créneaux + Wash Now | **livrée** |
| **6** | Comptes entreprises, fidélité, automatisations, multi-régions | **livrée** |

Le **schéma de base couvre les 6 phases dès maintenant** (§1 : « conçu pour passer de
quelques opérateurs à plusieurs dizaines sans refonte »). Seules les interfaces sont
livrées par phase. C'est le point le plus important de la roadmap : une migration de
schéma en Phase 4 sur des données de production réelles coûte dix fois ce qu'elle coûte
aujourd'hui.

## Périmètre exact de la Phase 6

- [x] **§24 — comptes entreprise** : flotte, sites multiples, responsables (dont un
      destinataire de facturation), fréquence de lavage et CA annuel
- [x] **§24 — facturation mensuelle** : préparation, émission numérotée, TVA figée sur la
      facture, aucune double facturation possible
- [x] **Fidélité** : règle paramétrable (remise ou prestation offerte), récompenses
      acquises conservées même si la règle change, attribution idempotente
- [x] **Automatisations** : six tâches nommées, intervalle minimal, trace d'exécution,
      endpoint `/api/cron` signé, écran de pilotage qui signale les tâches en retard
- [x] **Multi-régions** : entité `Region` au-dessus des secteurs
- [x] **Montée en charge vérifiée** : 250 opérateurs affectés en 5 ms (`npm run bench`)

Le cahier des charges ne dit rien de la mécanique de fidélité : c'est une décision
commerciale. Le système fournit donc un **réglage**, désactivé par défaut, plutôt qu'une
offre figée.

## Périmètre exact de la Phase 5

- [x] **§22 — statistiques opérateurs** : CA, prestations, panier, remplissage, trajet,
      kilomètres, ponctualité, avis, annulations, comparaison par secteur
- [x] **§5 — analyse de la répartition** : indice de Gini sur le CA, écart entre extrêmes,
      taux de suivi des propositions du moteur, 7 tests
- [x] **§9 — météo** : Open-Meteo (gratuit, sans clé), verdict par fenêtre d'intervention,
      proposition de reprogrammation — **le client garde la décision**, 9 tests
- [x] **§8 — revente de créneau** : à l'annulation, clients proches ou flexibles
      identifiés et sollicités, offre expirant avant le créneau
- [x] **§7 — laver maintenant** : créneaux tenables dans les 4 heures, réutilisant le
      moteur de disponibilité plutôt qu'un calcul parallèle
- [x] **§25 — avis et qualité** : page d'avis publique, score qualité explicable en
      4 axes, très bons avis orientés vers Google, avis faibles alertés au central, 8 tests

Les tâches récurrentes de cette phase sont devenues des tâches nommées en phase 6,
déclenchées par `/api/cron`.

## Périmètre exact de la Phase 4

- [x] **§11 — GPS live** : émission depuis l'application opérateur, à 15 s, **uniquement
      entre « Démarrer le trajet » et « Je suis arrivé »**
- [x] **§11 — confidentialité** : la règle est serveur, pas un réglage. Un ping hors trajet
      est refusé et l'application reçoit l'ordre d'arrêter d'émettre
- [x] **§11 — suivi client** : position, distance restante, heure d'arrivée, carte
- [x] **§11 — « vous êtes presque arrivé »** : notification unique à moins de 400 m
- [x] **§11 §20 — carte patron** : positions, rendez-vous en cours et suivant, retards
- [x] **§27 — alerte retard** au-delà de 10 minutes sur l'heure prévue
- [x] **§31 — purge** des traces de déplacement (`npm run purge:tracking`)
- [x] 13 contrôles de bout en bout (`npm run verify:tracking`)

Hors périmètre Phase 4 : historique de trajet rejouable, optimisation d'itinéraire
multi-arrêts.

## Périmètre exact de la Phase 3

- [x] **§12 — workflow verrouillé** : machine à états serveur, transitions atomiques,
      15 tests couvrant les six interdits nommés par le cahier des charges
- [x] **§13 §15 — photos avant/après** : quatre emplacements obligatoires, vérification de
      l'horodatage EXIF côté serveur, position GPS attachée, 9 tests
- [x] **§16 — encaissement** : espèces avec écart contrôlé, lien de paiement, distinction
      acompte / solde / total / mode / bénéficiaire
- [x] **§16 — régularisation d'écart** par le patron seul, journalisée
- [x] **§17 — clôture** : sept horodatages, récapitulatif automatique au client
- [x] **§18 — commission** figée à la clôture, au taux en vigueur pour cet opérateur
- [x] **§26 — fiche digitale du véhicule** : historique permanent avec preuves photo
- [x] **§27 — alertes** : écart de caisse, photos manquantes, client absent
- [x] **§32 — PWA** : manifeste, agenda opérateur, capture caméra, écran une main
- [x] **§31** : photos servies par route authentifiée, coordonnées client masquées à J-1

Hors périmètre Phase 3 : GPS live (phase 4), paiement en ligne réel (§38 point 5).

## Périmètre exact de la Phase 2

- [x] Site client public à la charte de la marque (noir / violet / chrome)
- [x] **§2 — tunnel de réservation en 5 étapes**, tarif et durée calculés en direct
- [x] **Créneaux réellement disponibles** — validés contre la tournée de chaque opérateur,
      2 appels cartographiques pour toute la journée
- [x] Acompte de 30 % et page de suivi sur jeton aléatoire (non énumérable)
- [x] **§23 — CRM** : fiches, historique, véhicules, adresses, avis, dépenses
- [x] **§23 — « refaire la même prestation »** en un clic depuis la fiche client
- [x] **§23 — relances** : détection des clients sans lavage depuis 60 jours, avec
      garde-fou anti-spam (consentement + délai de 30 jours)
- [x] **§19 — leads** : webhook signé, déduplication, coût par lead, conversion, CA généré
- [x] **§19 — lead → RDV** en un clic, source conservée pour le rapprochement

Hors périmètre Phase 2 : PWA opérateur, GPS, photos, paiement en ligne réel.

## Périmètre exact de la Phase 1

- [x] Schéma complet (35 modèles, 24 énumérations) + migration + jeu de données réaliste
- [x] Abstraction prestataires (géo avec repli local + Google, paiement, notifications)
- [x] Moteur d'affectation + garde-fou anti-détour + 9 tests
- [x] Auth + RBAC 4 rôles
- [x] Back-office : tableau de bord, planning global avec détection de conflits, fiches
      opérateurs, création d'opérateur
- [x] **§3 — Prise de RDV par téléphone + « TROUVER LE MEILLEUR OPÉRATEUR »**
- [x] Réglages réseau éditables (poids du score, marges)

Hors périmètre Phase 1, volontairement : tunnel client public, PWA, GPS, photos,
paiement en ligne, statistiques avancées.

## Traçabilité — les 39 sections

| § | Sujet | Phase | Où |
|---|---|---|---|
| 1 | Architecture générale | 1 | `docs/ARCHITECTURE.md` |
| 2 | Réservation client 2 min | **2** | `app/(public)/reserver` |
| 3 | RDV par X Detailing | **1** | `app/admin/rendez-vous/nouveau` |
| 4 | Moteur d'affectation | **1** | `server/assignment/` |
| 5 | Optimisation CA réseau | **1** + **5** | `server/assignment/scoring.ts`, `server/statistics.ts` |
| 6 | Réservation par adresse | **1** | `server/assignment/constraints.ts` |
| 7 | Laver maintenant | **5** | `server/dispatch/wash-now.ts` |
| 8 | Revente de créneau | **5** | `server/dispatch/slot-resale.ts` |
| 9 | Météo | **5** | `server/weather.ts`, `lib/providers/weather` |
| 10 | Agenda opérateur | **3** | `app/pro` |
| 11 | GPS live | **4** | `server/tracking.ts`, `api/pro/tracking`, `api/track` |
| 12 | Workflow verrouillé | **3** | `server/workflow/` |
| 13 | Photos avant | **3** | `server/photos.ts` |
| 14 | Prestation en cours | **3** | `server/workflow/state-machine.ts` |
| 15 | Photos après | **3** | `server/photos.ts` |
| 16 | Encaissement | **3** | `server/payments.ts` |
| 17 | Fin de prestation | **3** | `server/workflow/state-machine.ts` |
| 18 | Commission 18 % | **3** | `server/commission/` |
| 19 | Leads Meta | **2** | `api/webhooks/meta`, `app/admin/leads` |
| 20 | Tableau de bord | **1** / carte **4** | `app/admin`, `app/admin/carte` |
| 21 | Planning global | **1** | `app/admin/planning` |
| 22 | Statistiques opérateurs | **5** | `app/admin/statistiques` |
| 23 | CRM client | **2** | `app/admin/clients`, `server/crm.ts` |
| 24 | Comptes pro / flottes | **6** | `app/admin/entreprises`, `server/invoicing.ts` |
| 25 | Qualité et avis | **5** | `server/quality/`, `app/(public)/avis` |
| 26 | Fiche digitale véhicule | **3** | `app/admin/vehicules/[id]` |
| 27 | Alertes centralisées | **3** | `server/quality/alerts.ts` |
| 28 | Nouvel opérateur / secteur | **1** | `app/admin/operateurs/nouveau` |
| 29 | Kangoo et matériel | **1** | `FleetVehicle`, fiche opérateur |
| 30 | Traçabilité / audit | **1** | `server/audit/` |
| 31 | RGPD | transverse | `lib/auth/`, politiques de rétention |
| 32 | Architecture technique | **1** | `lib/providers/` |
| 33 | Performance | transverse · **vérifié en 6** | `npm run bench` |
| 34 | Objectif OS | transverse | — |
| 35 | Fonction prioritaire | **1** | `server/assignment/engine.ts` |
| 36 | Scénario téléphone | **1** | test d'intégration |
| 37 | Priorité de développement | — | ce document |
| 38 | Points à valider | **hors logiciel** | voir ci-dessous |
| 39 | Règle d'or | **1** | garde-fou anti-détour |

## §38 — Points bloquants non logiciels

Ces points ne relèvent pas du développement mais **conditionnent la mise en production**.
Ils sont listés ici pour qu'ils ne soient pas oubliés derrière l'avancement technique :

1. Contrats indépendants — absence de lien de subordination. **Le workflow verrouillé et
   le GPS sont précisément les éléments qu'un juge regarderait** pour caractériser une
   subordination. À faire qualifier avant la Phase 4.
2. Qualification juridique du modèle licence/franchise, obligations précontractuelles.
3. Contrat de mise à disposition du Kangoo, compatibilité avec le financement.
4. Assurance : lavage mobile, véhicule, matériel, mise à disposition rémunérée.
5. Flux de paiement : qui encaisse, TVA, facturation, reversements. **Détermine si Stripe
   Connect est nécessaire** — impact direct sur la Phase 3.
6. RGPD : conservation GPS et photos, information des opérateurs et des clients.

Le point 5 est le seul à avoir un impact structurant sur le code. Les autres sont des
conditions de lancement, pas des contraintes d'architecture.
