# ensate/clubs

Plateforme parascolaire de l'ENSA de Tétouan : réservation de dates par les clubs, validation par le coordinateur, publication des événements, inscriptions en ligne et au stand, billets QR.

- **Spécifications** : [docs/](docs/) (cadrage, besoins, fonctionnalités, architecture, base de données, API, tests).
- **Stack** : Next.js 16 (App Router) · Neon Postgres + Drizzle · Auth.js (Google uniquement) · Tailwind 4 · PWA.

## Démarrage

### 1. Base de données Neon (dev ≠ production)

1. Crée un projet sur [neon.tech](https://neon.tech) (région Europe).
2. Crée une **branche `dev`** à partir de `main`.
3. Copie la chaîne de connexion **pooled** de la branche `dev` dans `.env.local` (`DATABASE_URL`).
   La chaîne de `main` (production) ne va **que** dans Vercel, jamais dans `.env.local`.

### 2. Connexion Google

Dans [Google Cloud Console](https://console.cloud.google.com/) → *API et services* → *Identifiants* :

1. Écran de consentement OAuth : type **Externe**, scopes `openid`, `email`, `profile`.
2. *Créer des identifiants* → **ID client OAuth** → *Application Web*.
3. URI de redirection autorisée : `http://localhost:3000/api/auth/callback/google` (ajoute plus tard celle du domaine de production).
4. Copie l'ID et le secret dans `.env.local` (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`).

> ⚠️ Teste tôt avec un **vrai compte `@etu.uae.ac.ma`** : l'université peut bloquer les applications tierces.

### 3. Images (facultatif)

Crée un compte gratuit sur [cloudinary.com](https://cloudinary.com) et copie *Cloud name*, *API Key* et *API Secret* dans `.env.local` (`CLOUDINARY_*`). Les clubs peuvent alors envoyer affiche, photos du planning et logo depuis leur téléphone ou leur PC ; les images sont redimensionnées et converties automatiquement. Sans ces valeurs, ils collent un lien https vers l'image.

### 4. Emails (facultatif en local)

Crée un compte sur [resend.com](https://resend.com), vérifie le domaine d'envoi, puis renseigne `RESEND_API_KEY` et `EMAIL_FROM` dans `.env.local`. Sans clé, chaque email est seulement affiché dans le terminal de `npm run dev` (destinataire masqué et sujet).

Emails envoyés :
- **demande soumise** : au coordinateur ;
- **partenaires ajoutés** : aux partenaires ;
- **décision** : au club ;
- **inscription** : confirmation, pré-inscription ou liste d'attente ;
- **paiement reçu** et **place membre attribuée** ;
- **place libérée** : depuis la liste d'attente ;
- **événement complet** : aux pré-inscrits ;
- **créneaux modifiés** et **événement annulé**.

Ils partent après la réponse (`after()`) : un échec d'envoi n'annule jamais l'action.

### 5. Variables d'environnement

`.env.local` a été créé avec un `AUTH_SECRET` aléatoire. Complète les autres valeurs (voir `.env.example`), dont `ADMIN_EMAIL` : l'adresse Google du premier administrateur. Ne colle jamais ces valeurs dans un chat ou un ticket.

### 6. Lancer

```bash
npm install
npm run db:push              # crée les tables sur la branche dev
npm run db:seed -- --demo    # lieux, compte admin et événements de démonstration
npm run dev                  # http://localhost:3000
```

### Connexion de démonstration (local)

Pour tester sans Google, ajoute `AUTH_DEV_LOGIN=1` dans `.env.local` puis lance `npm run db:seed -- --demo` : la page `/connexion` affiche des boutons pour entrer comme étudiant, externe, club, coordinateur ou admin. Ce mode est **ignoré en production** (`NODE_ENV=production`) et ne donne accès qu'aux comptes de démonstration existants.

> Après un `npm run build`, supprime `.next` avant de relancer `npm run dev` (cache de build partagé).

## Déploiement (Vercel)

À faire une seule fois, dans cet ordre :

1. **GitHub** : pousse la branche `main` sur ton dépôt (privé de préférence). Le travail continue sur `dev` ; chaque fusion dans `main` redéploie le site.
2. **Base de production** : dans Neon, la branche `main` du projet sert à la production. Applique le schéma, puis crée les lieux et le compte admin. Mets la chaîne de connexion **seulement** dans la commande, jamais dans `.env.local` :
   ```bash
   DATABASE_URL="<chaîne pooled de la branche main>" npx drizzle-kit push
   DATABASE_URL="<chaîne pooled de la branche main>" ADMIN_EMAIL="<ton adresse Google>" npm run db:seed
   ```
   Le seed refuse `--demo` sur une autre base que celle de `.env.local` : aucune donnée fictive ne peut arriver en production.
3. **Vercel** : *Add New → Project*, importe le dépôt et garde le framework Next.js détecté. Ajoute les variables d'environnement (*Production*) :

   | Variable | Valeur |
   | --- | --- |
   | `DATABASE_URL` | chaîne **pooled** de la branche `main` de Neon |
   | `AUTH_SECRET` | nouveau secret, différent de celui de développement : `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`, à coller directement dans Vercel |
   | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | client OAuth Google |
   | `CRON_SECRET` | nouveau secret aléatoire (la tâche planifiée l'envoie automatiquement) |
   | `RESEND_API_KEY`, `EMAIL_FROM` | emails (domaine vérifié chez Resend) |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | envoi d'images (facultatif) |
   | `APP_URL` | adresse publique, ex. `https://clubs.ensate.ma` (sinon l'adresse Vercel de production) |

   **Ne jamais** définir `AUTH_DEV_LOGIN` sur Vercel. Elle serait de toute façon ignorée en production.
4. **Google Cloud Console** : ajoute l'URI de redirection `https://<ton domaine>/api/auth/callback/google`, et passe l'écran de consentement en production.
5. **Domaine** (facultatif) : *Settings → Domains* sur Vercel, puis mets à jour `APP_URL` et l'URI Google.
6. **Vérifications après déploiement** :
   - connexion avec un compte `@etu.uae.ac.ma` et avec le compte admin ;
   - *Settings → Cron Jobs* : la tâche `/api/cron/maintenance` apparaît ;
   - en-têtes de sécurité présents (`curl -I https://<domaine>`).

> Tâche planifiée (`vercel.json`) : chaque nuit à 3 h UTC, les événements passés deviennent « Terminé » et les stands expirés sont fermés. Le plan gratuit de Vercel limite les crons à un par jour. Les listes publiques masquent déjà les événements passés en temps réel.
>
> Hors Vercel (`next start` sur un serveur), ajoute `AUTH_TRUST_HOST=true` (ou `AUTH_URL`), sinon Auth.js refuse l'hôte.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (localhost uniquement) |
| `npm run build` / `npm start` | Build et serveur de production (active le service worker) |
| `npm run typecheck` · `npm run lint` | Vérifications |
| `npm run db:push` | Applique `src/server/db/schema.ts` à la base de `.env.local` |
| `npm run db:seed [-- --demo]` | Données initiales (n'efface rien) |
| `npm run db:studio` | Explorer la base |
| `npm run icons` | Régénère les icônes PWA |

## PWA

- Manifest : `src/app/manifest.ts` · service worker : `public/sw.js` (enregistré en production uniquement).
- Les billets ouverts une fois restent consultables **hors ligne** ; ils sont effacés de l'appareil à la déconnexion.
- L'installation sur téléphone exige HTTPS : teste-la sur un déploiement Vercel (ou `next dev --experimental-https`).
- **Application mobile plus tard** : la logique métier est dans `src/server/services` ; une app (Expo / React Native ou Capacitor) pourra s'appuyer sur des routes `/api/v1` (contrat dans `docs/07_API.md`).

## Ce qui est en place

| Espace | Pages |
| --- | --- |
| Public / étudiant | `/` accueil · `/evenements/[slug]` fiche (et programme, export agenda `.ics`) · `/clubs` · `/clubs/[slug]` (suivre un club) · `/connexion` · `/moi/billets` · `/moi/billets/[id]` (QR, hors ligne, annonces) · `/moi/profil` (clubs suivis, organisme des externes) · `/stand/[session]` (inscription au stand) |
| Club (`/org`) | Mes événements · assistant de demande · publication (tarifs affichés / masqués, externes, places, affiche et planning) · inscrits et encaissement (recherche par nom ou scan du billet) · export CSV · stand (QR dynamique, caisse) · contrôle d'entrée (caméra) · annulation · annonces aux inscrits · **trésorerie privée** (recettes, dépenses, justificatifs, billetterie, export) · profil |
| Coordinateur (`/coord`) | Demandes et décisions · créer pour un club · compléter et publier à la place d'un club · calendrier · tous les événements · modification des créneaux · annulation · organisations (création, modification, désactivation) · lieux · périodes bloquées · statistiques (sans montants) |
| Admin (`/admin`) | Comptes : création (toute adresse Google), suspension |

Images : envoi direct vers Cloudinary (affiche, planning, logo), signé par `/api/upload` (dossiers et formats imposés, pas de SVG).

Emails : `src/server/email` (gabarits HTML + texte, envoi groupé via Resend). Annulation d'un événement par le club principal ou le coordinateur : billets invalidés, stand fermé, inscrits prévenus.

Trésorerie (`/org/tresorerie`) : réservée au compte de l'organisation par `requireFinance()` ; coordinateur et admin reçoivent 403. Les justificatifs sont envoyés en Cloudinary `authenticated` et ouverts par un lien de téléchargement signé valable 5 minutes.

Équipe (`/org/membres`) : président·e, trésorier·e et membres, chacun avec son compte Google ; droits par capacité (`gerer`, `caisse`, `finance`) dans `requireOrganisation()`.

À venir : routes `/api/v1` pour une future application mobile.

> La caméra (contrôle d'entrée) exige HTTPS ou `localhost` : pour tester sur un téléphone, passe par un déploiement Vercel.

## Organisation du code

```text
src/
├── app/
│   ├── (site)/           accueil, événements, clubs, mes billets, profil
│   ├── org/              espace club
│   ├── coord/            espace coordinateur
│   ├── admin/            comptes
│   ├── stand/            page d'inscription au stand (étudiant)
│   ├── connexion/        connexion Google
│   ├── api/              Auth.js, jeton et entrée du stand
│   ├── manifest.ts       PWA
│   └── hors-ligne/       page hors connexion
├── auth.ts               Google + règles RG-01 (étudiant / externe / compte créé par le staff)
├── proxy.ts              garde de navigation (/moi, /org, /coord, /admin)
├── components/           UI (site, events, org, coord, space, ui)
├── lib/                  formats, dates (heure de Tétouan), statuts
└── server/
    ├── db/               schéma Drizzle, client HTTP, transactions (verrous)
    ├── services/         règles métier : inscriptions, demandes, publication, caisse, stand, contrôle, coordination, admin
    ├── actions/          Server Actions (revérifient toujours les droits)
    ├── queries/          lectures
    └── permissions.ts    requireRole, requireOrganisation, roleOnEvent
```
