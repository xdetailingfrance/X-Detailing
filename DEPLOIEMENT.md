# Mettre la démonstration en ligne

Le projet Vercel est créé et lié : `prat-enzos-projects/xdetailing-demo`.
Les variables d'environnement sont déjà posées, **sauf la base de données**.

## 1. Créer la base Postgres

Une seule commande, à lancer depuis ce dossier, dans votre terminal — elle est
interactive et vous demandera de confirmer :

```bash
vercel integration add neon
```

Choisissez le plan gratuit et le projet `xdetailing-demo`. Neon crée la base et
renseigne `DATABASE_URL` tout seul.

*Autre voie possible :* créer un compte sur neon.tech ou supabase.com, copier la
chaîne de connexion, puis `vercel env add DATABASE_URL production`.

## 2. Déployer

```bash
vercel deploy --prod
```

Le build applique les migrations avant de compiler (`vercel-build` dans
`package.json`) : la base est prête à la fin du déploiement.

## 3. Générer le jeu de démonstration

Ouvrir `https://<le-domaine>/demo`. La base est vide au premier passage : la page
propose **Générer le jeu de démonstration**. Quelques secondes, puis les quatre
points de vue s'ouvrent sans mot de passe.

C'est ce lien `/demo` qui se partage.

---

## Ce qui change entre le local et l'hébergement

| | En local | En ligne |
|---|---|---|
| Photos | dossier `.data/` | table `StoredFile` — un hébergeur serverless n'a pas de disque durable |
| Flux temps réel | ouverts 30 min | refermés à 50 s, le navigateur se reconnecte seul |
| Tâches récurrentes | `npm run check` à la main | Vercel Cron, une fois par jour à 6 h |

## Les variables

| Variable | Rôle | Posée ? |
|---|---|---|
| `DATABASE_URL` | Postgres | **à faire — étape 1** |
| `AUTH_SECRET` | signature des sessions | oui |
| `CRON_SECRET` | ferme `/api/cron` | oui |
| `DEMO_MODE=1` | ouvre `/demo` | oui |
| `STORAGE_PROVIDER=database` | photos en base | oui |
| `ANTHROPIC_API_KEY` | analyse des photos à la réservation (§13) | non — facultatif |
| `STRIPE_SECRET_KEY` | paiement réel | non — facultatif |

Sans les deux dernières, tout fonctionne : l'analyse photo ne propose simplement
aucune option, et le paiement est simulé. C'est le bon réglage pour une
démonstration.

## Le jour où ce n'est plus une démonstration

Trois gestes, dans cet ordre :

1. **Retirer `DEMO_MODE`.** `/demo` disparaît, avec les sessions sans mot de passe
   et le bouton qui efface la base.
2. **Changer les mots de passe.** Tous les comptes du jeu de données partagent
   `xdetailing`.
3. **Passer les photos sur S3 ou R2.** La table `StoredFile` convient à une
   démonstration et à quelques opérateurs ; au-delà, elle fait grossir les
   sauvegardes pour rien. L'interface `StorageProvider` est prévue pour.
