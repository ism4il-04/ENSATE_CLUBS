# 07 — API

> Ce document est le **contrat fonctionnel** des opérations. Chaque opération correspond à un service métier (`src/server/services`). L'interface web peut l'appeler via une Server Action, et elle est aussi exposée en REST sous `/api/v1` pour le scan au stand, le check-in et une éventuelle application mobile.

---

## 1. Conventions

- **Format** : JSON, en UTF-8. Les dates sont en ISO 8601 avec fuseau (`2026-10-14T14:00:00+01:00`).
- **Authentification** : cookie de session. Les routes publiques sont marquées 🌐.
- **Identifiants** : UUID. Les pages publiques utilisent le `slug`.
- **Pagination** : `?page=1&taille=20`. La réponse a la forme `{ "donnees": [...], "page": 1, "taille": 20, "total": 134 }`.
- **Montants** : chaînes décimales (`"30.00"`), en dirhams.

### Format d'erreur

```json
{ "erreur": { "code": "EVENEMENT_COMPLET", "message": "Il n'y a plus de place pour cet événement." } }
```

| HTTP | Code | Cas |
| --- | --- | --- |
| 401 | `NON_AUTHENTIFIE` | Pas de session |
| 403 | `ACCES_REFUSE` | Rôle ou périmètre insuffisant, y compris un coordinateur ou un admin qui tente d'accéder à la trésorerie |
| 404 | `INTROUVABLE` | Ressource inexistante **ou** non visible pour l'appelant |
| 409 | `EMAIL_DEJA_UTILISE`, `DEJA_INSCRIT`, `DEJA_PRESENT` | Conflit |
| 422 | `VALIDATION` | Données invalides (détails par champ dans `erreur.champs`) |
| 403 | `COMPTE_NON_AUTORISE` | Connexion Google refusée : adresse non vérifiée par Google ou compte suspendu (RG-01, RG-24) |
| 403 | `RESERVE_ETUDIANTS_ENSA` | Un externe tente de s'inscrire à un événement non ouvert aux externes (RG-31) |
| 422 | `INSCRIPTIONS_FERMEES`, `INSCRIPTION_STAND_UNIQUEMENT`, `EVENEMENT_COMPLET`, `PROGRAMME_SANS_INSCRIPTION`, `TELEPHONE_REQUIS` | Inscription impossible |
| 422 | `JETON_STAND_INVALIDE`, `SESSION_STAND_FERMEE` | Stand |
| 422 | `TRANSITION_INVALIDE`, `CRENEAUX_VERROUILLES`, `COMMENTAIRE_OBLIGATOIRE`, `CAPACITE_INSUFFISANTE` | Cycle de vie d'un événement |
| 422 | `BILLET_INVALIDE`, `NON_CONFIRMEE`, `CRENEAU_HORS_JOUR` | Check-in |
| 422 | `PAIEMENT_AUTRE_ORGANISATION` | Annulation d'un paiement ou d'une inscription payée, encaissé par une autre organisation |
| 422 | `ANNULATION_APRES_PAIEMENT` | L'étudiant tente d'annuler une inscription payée (RG-17) |
| 422 | `PLACES_MEMBRES_EPUISEES` | Toutes les places membres sont déjà attribuées (RG-29) |
| 429 | `TROP_DE_REQUETES` | Limitation de débit |

---

## 2. Authentification et compte

> Connexion **uniquement avec Google**. Les routes `/auth/*` sont fournies par la bibliothèque d'authentification. Le service métier n'intervient qu'au retour de Google, pour appliquer RG-01.

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| GET | `/auth/google` | 🌐 | Redirige vers Google. Paramètre `retour` : la page à rouvrir après la connexion |
| GET | `/auth/google/callback` | 🌐 | Retour de Google : applique RG-01 (activation d'un compte créé par le staff, création automatique d'un compte étudiant ou externe, ou refus si l'adresse n'est pas vérifiée), puis ouvre la session |
| POST | `/auth/deconnexion` | Connecté | |
| GET | `/moi` | Connecté | Compte, profil et rôle ; pour un compte organisation, l'organisation liée |
| PATCH | `/moi/profil` | Étudiant, externe | Téléphone, niveau (étudiant), organisme (externe). Le nom et la photo viennent de Google |
| DELETE | `/moi` | Étudiant | Suppression du compte (BNF-06) ; les inscriptions passées sont anonymisées |

**Refus à la connexion** (adresse non vérifiée ou compte suspendu) : redirection vers `/connexion?erreur=COMPTE_NON_AUTORISE`.

**Tarifs côté public** : `GET /evenements/{slug}` renvoie `"gratuit": false, "tarifs": [{ "libelle": "Adhérent", "prix": "30.00" }, …]` avec **uniquement les tarifs affichés**.

---

## 3. Public 🌐

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/evenements` | Événements publiés. Filtres : `du`, `au`, `categorie`, `organisation`, `gratuit` |
| GET | `/evenements/{slug}` | Fiche complète : créneaux, lieux, médias, organisateurs, **places publiques** restantes, téléphone requis ou non ; pour un programme, ses sous-événements |
| GET | `/organisations` | Liste des organisations actives |
| GET | `/organisations/{slug}` | Page d'une organisation + ses événements à venir et passés |
| GET | `/lieux` | Lieux actifs |

---

## 4. Espace étudiant

| Méthode | Route | Description |
| --- | --- | --- |
| POST | `/evenements/{id}/inscriptions` | Inscription en ligne (RG-11, RG-12, RG-14, RG-28). Corps facultatif : `{ "telephone": "06…" }` si l'événement l'exige et que le profil n'en a pas |
| GET | `/stand/{idSession}?t={jeton}` | Vérifie le jeton du stand et pose le cookie « accès stand » ; renvoie l'événement |
| POST | `/stand/{idSession}/inscriptions` | Inscription au stand (exige le cookie « accès stand ») ; même corps facultatif `telephone` |
| GET | `/moi/inscriptions` | Mes inscriptions. Filtre : `periode=a_venir|passees` |
| GET | `/moi/inscriptions/{id}/billet` | Données du billet : jeton, événement, créneaux, présences |
| DELETE | `/moi/inscriptions/{id}` | Annule mon inscription si elle **n'est pas payée** ; sinon 422 `ANNULATION_APRES_PAIEMENT` avec les coordonnées de l'organisation (RG-17) |

**Exemple — `POST /evenements/{id}/inscriptions`**

```json
// 201 — événement payant
{ "idInscription": "a3d2…", "statut": "PRE_INSCRITE", "message": "Payez au stand pour confirmer votre place." }
// 201 — événement gratuit
{ "idInscription": "a3d2…", "statut": "CONFIRMEE", "billet": "/moi/inscriptions/a3d2…/billet" }
// 422
{ "erreur": { "code": "INSCRIPTION_STAND_UNIQUEMENT", "message": "L'inscription se fait au stand du club." } }
```

---

## 5. Espace organisation

> Toutes les routes vérifient que l'organisation connectée est organisatrice de l'événement : principale **ou** partenaire, sauf mention « principale ». Le **coordinateur** a les mêmes droits que la principale sur les routes « Principale » (RG-27), sauf pour le paiement, le stand et le check-in.

### Événements

| Méthode | Route | Accès | Description |
| --- | --- | --- | --- |
| GET | `/org/evenements` | Org | Événements de l'organisation (principale et partenaire). Filtre : `statut` |
| POST | `/org/evenements` | Org | Crée un brouillon : `structure`, `titre`, `categorie`, `descriptionCourte` |
| GET | `/org/evenements/{id}` | Org | Détail + historique des décisions |
| PATCH | `/org/evenements/{id}` | Principale | Modifie les champs autorisés selon le statut (RG-08, RG-09) |
| DELETE | `/org/evenements/{id}` | Principale | Supprime un brouillon |
| POST | `/org/evenements/{id}/sous-evenements` | Principale | Ajoute un sous-événement à un programme |
| PUT | `/org/evenements/{id}/creneaux` | Principale | Remplace la liste des créneaux et de leurs lieux (`BROUILLON` ou `MODIF_DEMANDEE` uniquement) |
| PUT | `/org/evenements/{id}/partenaires` | Principale | Définit la liste des organisations partenaires : ajout **direct**, sans invitation ; les partenaires sont informés par email (RG-04) |
| POST | `/org/evenements/{id}/soumettre` | Principale | → `EN_ATTENTE` (programme : parent + sous-événements) |
| POST | `/org/evenements/{id}/publier` | Principale | `VALIDE` → `PUBLIE` (vérifie les champs obligatoires) |
| POST | `/org/evenements/{id}/annuler` | Principale | → `ANNULE` + notification des inscrits |
| POST | `/org/evenements/{id}/medias/signature` | Principale | Signature pour un envoi direct vers Cloudinary |
| POST | `/org/evenements/{id}/medias` | Principale | Enregistre un média envoyé (`type`, `url`, `idCreneau?`) |
| DELETE | `/org/medias/{id}` | Principale | |

**Exemple — `PUT /org/evenements/{id}/creneaux`**

```json
{
  "creneaux": [
    { "debut": "2026-10-14T14:00:00+01:00", "fin": "2026-10-14T18:00:00+01:00", "libelle": "Jour 1",
      "lieux": [ { "idLieu": "…amphi" }, { "idLieu": "…101" } ] },
    { "debut": "2026-10-15T09:00:00+01:00", "fin": "2026-10-15T12:00:00+01:00", "libelle": "Jour 2",
      "lieux": [ { "idLieu": "…autre", "precision": "Terrain de basket" } ] }
  ]
}
```

### Inscriptions, stand et check-in

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/org/evenements/{id}/inscriptions` | Liste. Filtres : `statut`, `source`, `q` (recherche par nom ou email, **pré-inscrits en premier**). Le téléphone n'est renvoyé que si l'événement l'exige (RG-30), et le montant que pour les paiements encaissés par **l'appelant** (RG-21) |
| GET | `/org/evenements/{id}/inscriptions/export` | Fichier .xlsx |
| PATCH | `/org/evenements/{id}/inscriptions-ouvertes` | `{ "ouvertes": true }` |
| POST | `/org/inscriptions/{id}/paiement` | Marque payé avec le tarif choisi (RG-13, RG-18, RG-32). Corps : `{ "idTarif": "…" }` ; montant encaissé = prix du tarif (0 possible) |
| POST | `/org/paiements/scan` | Marque payé à partir du scan d'un billet. Corps : `{ "tokenBillet": "…" }` |
| DELETE | `/org/inscriptions/{id}/paiement` | Annule un paiement erroné (organisation qui a encaissé uniquement) |
| DELETE | `/org/inscriptions/{id}` | Annule l'inscription d'un étudiant qui en fait la demande ; si elle est payée, seule l'organisation qui a encaissé peut le faire (RG-17) |
| GET | `/org/etudiants?q=` | Recherche d'étudiants par nom ou email (3 caractères minimum, 10 résultats maximum), pour attribuer une place membre |
| POST | `/org/evenements/{id}/places-membres` | Attribue une place membre : `{ "idCompte": "…" }` → inscription `CONFIRMEE`, `source = MEMBRE`, sans paiement (RG-29) |
| POST | `/org/evenements/{id}/stand` | Ouvre une session stand → `{ "idSession": "…", "expiration": "…" }` |
| GET | `/org/stand/{idSession}/jeton` | Jeton courant + secondes restantes (l'écran du stand interroge cette route toutes les 30 s) |
| DELETE | `/org/stand/{idSession}` | Ferme la session |
| POST | `/org/checkin` | Corps : `{ "tokenBillet": "…", "idCreneau": "…" }` (RG-19) |

**Exemple — `POST /org/checkin`**

```json
// 200
{ "resultat": "VALIDE", "etudiant": "Prénom Nom", "creneau": "Jour 2" }
// 409
{ "erreur": { "code": "DEJA_PRESENT", "message": "Déjà scanné à 09:12." } }
```

### Profil de l'organisation

| Méthode | Route | Description |
| --- | --- | --- |
| GET / PATCH | `/org/profil` | Nom affiché, description, logo, couverture, réseaux sociaux |

### Tarifs d'un événement (RG-36)

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/org/evenements/{id}/tarifs` | Tous les tarifs, y compris les non affichés |
| PUT | `/org/evenements/{id}/tarifs` | Remplace la liste : `{ "gratuit": false, "tarifs": [{ "libelle": "Bureau", "prix": "0", "affiche": false }, …] }` (principale ou coordinateur) |

---

## 6. Espace coordinateur

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/coord/demandes` | Événements `EN_ATTENTE` |
| POST | `/coord/evenements` | Crée un événement pour une organisation : `{ "idOrganisationPrincipale": "…", "partenaires": ["…"], "structure": "SIMPLE", "titre": "…", "creneaux": [...] }` → directement `VALIDE` (RG-27) |
| GET | `/coord/evenements/{id}` | Détail + section « Le même jour » |
| POST | `/coord/evenements/{id}/decision` | `{ "decision": "VALIDE" \| "REFUSE" \| "MODIF_DEMANDEE", "commentaire": "…" }` (RG-07) |
| PUT | `/coord/evenements/{id}/creneaux` | Modifie les créneaux d'un événement validé ou publié (RG-08) ; les inscrits sont notifiés |
| GET | `/coord/calendrier?du=&au=&lieu=` | Créneaux des événements validés et publiés |
| GET | `/coord/evenements` | Tous les événements. Filtres : `statut`, `organisation` |
| GET / POST | `/coord/organisations` | Lister / créer : crée aussi le compte avec l'adresse Google de l'organisation (RG-02), qui s'active à la première connexion |
| PATCH | `/coord/organisations/{id}` | Modifier, activer ou désactiver |
| GET / POST / PATCH | `/coord/lieux` | Gérer les lieux |
| GET | `/coord/statistiques?du=&au=` | Par organisation et par événement : inscrits, confirmés, présents. **Aucun montant** (RG-22) |

---

## 7. Espace administrateur

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/admin/comptes` | Filtres : `role`, `statut`, `q` |
| POST | `/admin/comptes` | Crée un compte avec n'importe quelle adresse Google (RG-02), y compris coordinateur |
| PATCH | `/admin/comptes/{id}` | Suspendre ou réactiver, changer de rôle |

---

## 8. Trésorerie (V2)

> Le garde `requireFinance` s'applique à toutes ces routes. Un `COORDINATEUR` ou un `ADMIN` reçoit **403**, quelle que soit l'organisation demandée.

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/org/finances/synthese` | Solde, totaux par événement et par catégorie |
| GET | `/org/finances/transactions` | Filtres : `du`, `au`, `type`, `evenement` |
| POST | `/org/finances/transactions` | Crée une recette ou une dépense |
| PATCH / DELETE | `/org/finances/transactions/{id}` | |
| POST | `/org/finances/justificatifs/signature` | Signature d'envoi Cloudinary `authenticated` |
| GET | `/org/finances/transactions/{id}/justificatif` | Redirige vers une URL signée valable 5 minutes |
| POST | `/org/finances/billetterie/{idEvenement}` | Crée la recette correspondant aux paiements encaissés par l'organisation pour cet événement |
