# X Detailing — site

Une page, et c'est tout : la promesse, le formulaire de réservation, les deux
formules avec leur contenu et les options, la carte, les informations légales.
Les réservations arrivent par e-mail, via Web3Forms. La base Postgres ne garde
que les créneaux réservés : trois départs par jour, et un créneau pris n'est plus
proposé à personne.

## Démarrer

```bash
npm install
npm run dev
```

Sans clé Web3Forms, l'envoi du formulaire est simulé en développement : le message
s'affiche dans la console du serveur. Sans `DATABASE_URL`, les réservations sont
gardées en mémoire du serveur de dev (perdues au redémarrage). Pour une vraie base
en local, poser `DATABASE_URL` dans `.env.local`.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Construction pour la mise en ligne |
| `npm run lint` | Vérification ESLint |
| `npm run typecheck` | Vérification TypeScript |

## Où changer quoi

| Quoi | Où |
|---|---|
| Prix, contenu des formules, options | `src/lib/catalogue.ts` |
| Heures des créneaux, jours ouverts, délai minimal | `src/lib/creneaux.ts` |
| Nom, téléphone, fiche Google, siège social | `src/lib/business.ts` |
| Textes de la page | `src/components/hero.tsx`, `devis.tsx`, `carte.tsx`, `footer.tsx` |
| Titre et description Google | `src/app/layout.tsx` |
| Charte (couleurs, police, boutons) | `src/app/globals.css` |
| Formulaire, e-mail et verrou des créneaux | `src/components/devis.tsx`, `src/app/actions.ts`, `src/lib/db.ts` |

La police est SF Pro Display sur Mac, iPhone et iPad, et Inter ailleurs : Apple ne
licencie pas SF Pro pour le web, elle ne peut donc pas être servie depuis le site.

## Pages secondaires

- `/gestion` — réservations à venir et libération d'un créneau, derrière le mot de
  passe `GESTION_MOT_DE_PASSE`. Reliée nulle part, hors index.
- `/devenir-operateur` et `/candidature` — landing de recrutement, avec sa propre
  charte. Les candidatures arrivent aussi par e-mail.

## Mise en ligne

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Marque

Fond noir, violet `#8008F8`, typographie chrome. Les fichiers détourés sont dans
`public/marque/`. Le site est clair ; le favicon reste sur fond noir.

## Historique

La version précédente — réservation en ligne, back-office, application opérateur,
base PostgreSQL — reste dans l'historique Git, jusqu'au commit `49d7ca2`.
