# Mettre le site en ligne

Le projet est hébergé sur Vercel. La base Postgres (Neon) ne garde qu'une chose :
les créneaux réservés, pour qu'un créneau pris ne soit plus proposé à personne.

## 0. La base de données

`DATABASE_URL` doit être posée sur Vercel (c'est déjà le cas si l'intégration Neon
est restée en place ; sinon `vercel env add DATABASE_URL production` avec la chaîne
de connexion « pooled » de Neon). La table `reservation` se crée toute seule au
premier appel : rien à migrer.

## 1. La clé Web3Forms

Créer une clé sur [web3forms.com](https://web3forms.com) avec l'adresse e-mail qui
doit recevoir les demandes, puis la poser sur Vercel :

```bash
vercel env add WEB3FORMS_ACCESS_KEY production
```

Sans elle, le formulaire répond « L'envoi n'a pas abouti » en production.

## 2. Déployer

```bash
vercel deploy --prod
```

## 3. Vérifier

- Dérouler le formulaire jusqu'à la réservation : l'e-mail doit arriver, et le
  créneau choisi doit apparaître « déjà pris » en rechargeant la page.
- `https://xdetailing.fr/sitemap.xml` et `/robots.txt` répondent.
- Le lien « Laisser un avis » ouvre bien le formulaire d'avis de la fiche Google.

## Les variables

| Variable | Rôle | Obligatoire |
|---|---|---|
| `DATABASE_URL` | Postgres : les créneaux réservés | **oui** |
| `WEB3FORMS_ACCESS_KEY` | relais formulaire → boîte e-mail | **oui** |
| `GESTION_MOT_DE_PASSE` | mot de passe de la page `/gestion` | **oui** |
| `NEXT_PUBLIC_SITE_URL` | adresse canonique (par défaut `https://xdetailing.fr`) | non |
| `GOOGLE_REVIEW_URL` | lien court « laisser un avis » de la fiche Google | non |

Les anciennes variables (`AUTH_SECRET`, `CRON_SECRET`, `DEMO_MODE`,
`STORAGE_PROVIDER`…) ne servent plus et peuvent être retirées du projet Vercel.

## Libérer un créneau

Un client annule par téléphone ? Le créneau reste bloqué tant que sa réservation
existe. La page `https://xdetailing.fr/gestion` liste les réservations à venir et
libère un créneau en deux clics. Elle s'ouvre avec le mot de passe posé dans
`GESTION_MOT_DE_PASSE` :

```bash
vercel env add GESTION_MOT_DE_PASSE production
```

La page n'est reliée nulle part sur le site et se déclare hors index.
