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

### 3. Variables d'environnement

`.env.local` a été créé avec un `AUTH_SECRET` aléatoire. Complète les autres valeurs (voir `.env.example`), dont `ADMIN_EMAIL` : l'adresse Google du premier administrateur. Ne colle jamais ces valeurs dans un chat ou un ticket.

### 4. Lancer

```bash
npm install
npm run db:push              # crée les tables sur la branche dev
npm run db:seed -- --demo    # lieux, compte admin et événements de démonstration
npm run dev                  # http://localhost:3000
```

### Connexion de démonstration (local)

Pour tester sans Google, ajoute `AUTH_DEV_LOGIN=1` dans `.env.local` puis lance `npm run db:seed -- --demo` : la page `/connexion` affiche des boutons pour entrer comme étudiant, externe, club, coordinateur ou admin. Ce mode est **ignoré en production** (`NODE_ENV=production`) et ne donne accès qu'aux comptes de démonstration existants.

> Après un `npm run build`, supprime `.next` avant de relancer `npm run dev` (cache de build partagé).

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
| Public / étudiant | `/` accueil · `/evenements/[slug]` fiche (et programme) · `/clubs` · `/clubs/[slug]` · `/connexion` · `/moi/billets` · `/moi/billets/[id]` (QR, hors ligne) · `/moi/profil` · `/stand/[session]` (inscription au stand) |
| Club (`/org`) | Mes événements · assistant de demande · publication (tarifs affichés / masqués, externes, places) · inscrits et encaissement · export CSV · stand (QR dynamique, caisse) · contrôle d'entrée (caméra) · profil |
| Coordinateur (`/coord`) | Demandes et décisions · créer pour un club · calendrier · tous les événements · modification des créneaux · organisations · lieux · statistiques (sans montants) |
| Admin (`/admin`) | Comptes : création (toute adresse Google), suspension |

À venir : envoi direct des affiches (Cloudinary), emails de notification, trésorerie privée (V2), routes `/api/v1` pour une future application mobile.

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
