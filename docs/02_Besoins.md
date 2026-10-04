# 02 — Expression des besoins

> Les identifiants (`BF-xx`, `BNF-xx`, `RG-xx`) sont repris dans les spécifications, l'API et les tests. Un identifiant retiré n'est jamais réutilisé.

---

## 1. Rôles

| Rôle | Code | Création du compte |
| --- | --- | --- |
| Étudiant | `ETUDIANT` | Automatique à la première connexion Google avec une adresse `@etu.uae.ac.ma`, ou création par le staff (toute adresse Google) |
| Externe | `EXTERNE` | Automatique à la première connexion avec **toute autre adresse Google** (gmail, etc.) |
| Organisation | `ORGANISATION` | Créé par le coordinateur ou l'admin |
| Coordinateur des clubs | `COORDINATEUR` | Créé par l'admin |
| Administrateur | `ADMIN` | Initialisé au déploiement |

> **Connexion uniquement avec Google** : la plateforme ne gère aucun mot de passe. Chaque compte, y compris celui d'une organisation, doit donc correspondre à un **compte Google** : adresse `@etu.uae.ac.ma`, gmail.com, ou tout domaine Google Workspace.
>
> **Vocabulaire** :
> - **Adhérent** : étudiant adhérent d'une organisation. La plateforme ne gère pas (encore) de liste d'adhérents : c'est le club qui applique le tarif adhérent au moment d'encaisser.
> - **Membre** (places membres) : personne de l'équipe qui organise l'événement, avec une place réservée sans paiement.
> - **Externe** : personne dont l'adresse Google n'est pas en `@etu.uae.ac.ma`. On distingue uniquement par le **domaine de l'adresse**.
> - **Tarif spécial** : tarif créé par le club mais **non affiché** au public (ex. : « Bureau », « Intervenant »). Seuls les organisateurs le voient et peuvent l'appliquer.

---

## 2. Besoins fonctionnels

### 2.1 Visiteur (non connecté)

| ID | Besoin | Version |
| --- | --- | --- |
| BF-01 | Consulter la liste des événements publiés | V1 |
| BF-02 | Consulter la fiche d'un événement (affiche, description, planning, tarif, places, organisateurs) | V1 |
| BF-03 | Consulter la liste et la page des organisations | V1 |
| BF-04 | Se connecter avec Google : compte étudiant pour une adresse `@etu.uae.ac.ma`, compte externe pour toute autre adresse | V1 |

### 2.2 Étudiant

| ID | Besoin | Version |
| --- | --- | --- |
| BF-10 | Se connecter et se déconnecter avec Google | V1 |
| BF-11 | Compléter son profil : téléphone, niveau. Le nom, le prénom et la photo viennent de Google | V1 |
| BF-12 | S'inscrire en ligne à un événement dont les inscriptions sont ouvertes | V1 |
| BF-13 | S'inscrire au stand en scannant le QR code affiché par l'organisation | V1 |
| BF-14 | Consulter ses inscriptions et leur statut (pré-inscrit, confirmé, liste d'attente) | V1 |
| BF-15 | Afficher son billet QR pour l'entrée | V1 |
| BF-16 | Annuler son inscription **tant qu'elle n'est pas payée**. Après paiement, il doit contacter l'organisation | V1 |
| BF-17 | Suivre (mettre en favori) des organisations et être notifié de leurs événements | V2 |
| BF-18 | Exporter ses événements vers son agenda (.ics) | V2 |
| BF-19 | Donner un avis sur un événement auquel il a assisté | V3 |
| BF-20 | Télécharger une attestation de participation | V3 |
| ~~BF-21~~ | ~~Postuler pour rejoindre une organisation~~ — *retiré pour le moment* | — |

### 2.2 bis Externe

| ID | Besoin | Version |
| --- | --- | --- |
| BF-25 | Se connecter avec n'importe quel compte Google (compte externe créé automatiquement) | V1 |
| BF-26 | Voir tous les événements publiés, et s'inscrire à ceux qui sont **ouverts aux externes** | V1 |
| BF-27 | Gérer ses billets et son profil (téléphone, organisme facultatif), comme un étudiant | V1 |

### 2.3 Organisation (club / association)

| ID | Besoin | Version |
| --- | --- | --- |
| BF-30 | Se connecter avec Google, en utilisant l'adresse de l'organisation | V1 |
| BF-31 | Modifier la page de l'organisation (logo, description, réseaux sociaux) | V1 |
| BF-32 | Créer une demande d'événement : un événement simple (un ou plusieurs créneaux) ou un programme (sous-événements) | V1 |
| BF-33 | Pour chaque créneau, choisir une date, des horaires et un ou plusieurs lieux | V1 |
| BF-34 | Ajouter **directement** une ou plusieurs organisations partenaires, sans invitation ni acceptation | V1 |
| BF-35 | Soumettre la demande au coordinateur et suivre la décision | V1 |
| BF-36 | Après validation, compléter et publier : affiche, description, planning (photos), **tarifs** (gratuit, ou une liste de tarifs : adhérent, non-adhérent, externe… et des tarifs spéciaux non affichés comme « Bureau »), **ouverture aux externes**, capacité, **places réservées aux membres**, **téléphone obligatoire ou non** | V1 |
| BF-37 | Choisir le mode d'inscription (stand uniquement, ou en ligne) et ouvrir ou fermer les inscriptions | V1 |
| BF-38 | Ouvrir une session stand qui affiche un QR code dynamique | V1 |
| BF-39 | **Chercher un inscrit par son nom** (ou scanner son billet) et le marquer comme payé | V1 |
| BF-40 | Scanner les billets à l'entrée (check-in par jour) | V1 |
| BF-41 | Exporter la liste des inscrits (Excel) | V1 |
| BF-42 | Annuler un événement (les inscrits sont notifiés) | V1 |
| BF-47 | Attribuer nominativement les places réservées aux membres du club | V1 |
| BF-48 | Annuler l'inscription payée d'un étudiant qui en fait la demande | V1 |
| ~~BF-49~~ | ~~Gérer la liste des adhérents~~ — *reporté : la liste complète des étudiants n'est pas encore disponible* | — |
| BF-50 | Au moment d'encaisser, **choisir le tarif** appliqué au participant, y compris un tarif spécial non affiché | V1 |
| BF-43 | Gérer les membres et leurs rôles | V2 |
| BF-44 | **Trésorerie** : saisir les recettes et dépenses, joindre des justificatifs, voir le solde | V2 |
| BF-45 | Envoyer une annonce aux inscrits d'un événement | V2 |
| ~~BF-46~~ | ~~Lancer une campagne de recrutement~~ — *retiré pour le moment* | — |

### 2.4 Coordinateur des clubs

| ID | Besoin | Version |
| --- | --- | --- |
| BF-60 | Voir les demandes en attente | V1 |
| BF-61 | Valider, refuser ou demander une modification, avec un commentaire | V1 |
| BF-62 | Consulter un calendrier global (par jour et par lieu) pour repérer les conflits | V1 |
| BF-63 | Modifier les créneaux et lieux d'un événement déjà validé | V1 |
| BF-64 | Créer, modifier et désactiver des organisations et leurs comptes | V1 |
| BF-65 | Gérer la liste des lieux | V1 |
| BF-66 | Consulter les statistiques de participation (sans données financières) | V1 |
| BF-68 | **Créer un événement pour n'importe quelle organisation**, puis le compléter et le publier | V1 |
| BF-67 | Déclarer des périodes bloquées (examens, vacances) | V2 |

### 2.5 Administrateur

| ID | Besoin | Version |
| --- | --- | --- |
| BF-80 | Gérer tous les comptes (créer, suspendre, réactiver), avec n'importe quelle adresse Google | V1 |
| ~~BF-81~~ | ~~Gérer les filières~~ — *retiré : pas de gestion des filières* | — |
| BF-82 | Créer les comptes coordinateur | V1 |

---

## 3. Besoins non fonctionnels

| ID | Catégorie | Exigence |
| --- | --- | --- |
| BNF-01 | Mobile | Toutes les pages sont utilisables sur un écran de 360 px ; le scan et le billet sont optimisés pour le mobile |
| BNF-02 | Performance | Page événement en moins de 2 s en 4G ; recherche d'un inscrit et marquage du paiement en moins de 1 s |
| BNF-03 | Concurrence | Aucune surréservation, même avec plusieurs marquages de paiement simultanés |
| BNF-04 | Sécurité | HTTPS, authentification déléguée à Google (aucun mot de passe stocké), billets non devinables |
| BNF-05 | Confidentialité | Les données financières d'une organisation sont inaccessibles aux autres organisations, au coordinateur et à l'administrateur (voir RG-21) |
| BNF-06 | Données personnelles | Collecte minimale : le téléphone n'est demandé que si un événement l'exige, et il n'est visible que par les organisateurs de cet événement. Un étudiant peut demander la suppression de son compte (loi 09-08) |
| BNF-07 | Disponibilité | Service disponible pendant les heures de stand et d'événements ; sauvegarde quotidienne de la base |
| BNF-08 | Accessibilité | Contrastes suffisants, navigation au clavier sur les formulaires, textes alternatifs sur les affiches |
| BNF-09 | Langue | Français en V1 ; une structure qui permet d'ajouter l'arabe et l'anglais plus tard |
| BNF-10 | Maintenabilité | Code TypeScript typé, documentation à jour, tests sur les règles de gestion |

---

## 4. Règles de gestion

### Comptes

- **RG-01** — La connexion se fait **uniquement avec Google**, avec une adresse vérifiée par Google. À la première connexion :
  - un compte déjà créé par le staff avec cette adresse est **activé** et garde le rôle choisi par le staff ;
  - sinon, une adresse `@etu.uae.ac.ma` crée un compte `ETUDIANT` ;
  - sinon, toute autre adresse crée un compte `EXTERNE`.
- ~~**RG-35**~~ — *Retiré pour le moment : on distingue étudiants et externes uniquement par le domaine de l'adresse (`@etu.uae.ac.ma`). À revoir quand la liste des étudiants de l'ENSA sera disponible.*
- **RG-02** — Le coordinateur ou l'administrateur peut créer un compte avec **n'importe quelle adresse Google** (gmail.com, etc.).
- **RG-03** — En V1, chaque organisation (club ou association) possède **un seul compte de connexion**.
- **RG-24** — Un compte suspendu ne peut ni se connecter ni s'inscrire à un événement.
- **RG-31** — Un externe voit tous les événements publiés, mais ne peut s'inscrire **qu'aux événements ouverts aux externes** (`ouvert_externes`). Sur les autres, le bouton indique « Réservé aux étudiants de l'ENSA ».

### Événements

- **RG-04** — Un événement a **une organisation principale** et zéro ou plusieurs **partenaires**.
  - Les partenaires sont ajoutés **directement**, sans invitation ni acceptation : les clubs se sont mis d'accord en amont.
  - Seule la principale (ou le coordinateur, RG-27) peut modifier et soumettre l'événement.
  - Les partenaires le voient dans leur espace et sur leur page publique.
- **RG-05** — Structure d'un événement :
  - **Événement simple** : un ou plusieurs créneaux, avec **une seule inscription** qui couvre tous les jours.
  - **Programme** : un événement parent **sans créneau ni inscription propres**, composé de **sous-événements**, chacun avec ses créneaux et sa propre inscription.
  - Profondeur maximale : 1 (un sous-événement ne peut pas avoir de sous-événements).
- **RG-06** — Un créneau a une date, une heure de début inférieure à l'heure de fin, et **au moins un lieu**. Le lieu « Autre » exige une précision en texte libre.
- **RG-07** — Une demande soumise passe à `EN_ATTENTE`. Le coordinateur décide : `VALIDE`, `REFUSE` ou `MODIF_DEMANDEE`. Le commentaire est obligatoire pour un refus ou une demande de modification. Pour un programme, la décision s'applique au parent et à tous ses sous-événements.
- **RG-27** — Le coordinateur peut **créer un événement pour n'importe quelle organisation** (il choisit l'organisation principale et les partenaires). Cet événement est **directement `VALIDE`**. L'organisation principale et le coordinateur peuvent ensuite le compléter et le publier.
- **RG-08** — Après validation, les créneaux et les lieux sont **verrouillés** pour l'organisation. Seul le coordinateur peut les modifier.
- **RG-09** — Un événement ne peut être publié que s'il est `VALIDE`. Après validation, l'organisation modifie librement la description, l'affiche, le planning, les tarifs, l'ouverture aux externes, la capacité et les places membres. Les tarifs ne changent pas pour les inscriptions déjà enregistrées (RG-32). La capacité ne peut pas descendre sous le nombre d'inscriptions confirmées.
- **RG-10** — Il n'y a pas de détection automatique des conflits de lieux. Le coordinateur dispose d'un calendrier par jour et par lieu.

### Places

- **RG-29** — L'organisation peut **réserver dès le départ des places pour ses membres** :
  - `places_membres` ≤ `capacite` ;
  - **places publiques** = `capacite` − `places_membres` ;
  - les places membres peuvent être attribuées nominativement à des étudiants inscrits sur la plateforme, sans paiement (`source = MEMBRE`). Une place non attribuée reste réservée ;
  - les externes partagent les places publiques avec les étudiants.

### Tarifs

- **RG-36** — Un événement est soit **gratuit**, soit **payant** avec une **liste de tarifs** (libellé + prix en DH, ≥ 0) :
  - la plateforme propose par défaut « Adhérent », « Non-adhérent » et, si l'événement est ouvert aux externes, « Externe » ;
  - le club peut renommer, supprimer ou ajouter des tarifs ;
  - chaque tarif est **affiché** ou **non affiché**. Les tarifs non affichés (ex. : « Bureau · 0 DH ») ne sont visibles que par les organisateurs ;
  - au moins un tarif doit être affiché.
- **RG-32** — La plateforme **ne calcule pas** le tarif d'un participant. Au moment d'encaisser, l'organisation **choisit le tarif** à appliquer ; le montant encaissé est le prix de ce tarif.
- **RG-33** — Un tarif à 0 DH (ex. : « Bureau ») confirme l'inscription sans encaissement.
- ~~**RG-34**~~ — *Retiré pour le moment (pas de liste d'adhérents).*

### Inscriptions et paiement

- **RG-28** — Si l'événement exige un **numéro de téléphone**, l'étudiant doit en renseigner un (enregistré dans son profil) avant de pouvoir s'inscrire.
- **RG-11** — Événement **gratuit** :
  - L'inscription est `CONFIRMEE` s'il reste une place publique.
  - Sinon, elle passe en `LISTE_ATTENTE` si la liste d'attente est activée.
  - Sinon, elle est refusée (« complet »).
- **RG-12** — Événement **payant** : l'inscription est créée en `PRE_INSCRITE`, en ligne ou au stand. Elle **ne bloque aucune place** et reste sans tarif jusqu'à l'encaissement.
  - La liste d'attente n'est proposée que pour les événements gratuits.
- **RG-13** — Marquer une pré-inscription comme payée, avec le tarif choisi (RG-32), la fait passer à `CONFIRMEE`, **uniquement si** le nombre de confirmés publics est inférieur au nombre de places publiques. Cette opération est atomique.
- **RG-14** — Modes d'inscription :
  - `STAND` : l'inscription n'est possible que via le QR du stand.
  - `EN_LIGNE` : l'étudiant s'inscrit seul, puis paie au stand, où le club le retrouve **par son nom** (ou en scannant son billet) et le marque payé.
  - Dans les deux modes, une session stand peut être ouverte.
- **RG-25** — Le drapeau « inscriptions ouvertes » ne concerne que les **nouvelles inscriptions en ligne**. Marquer un paiement reste possible quand les inscriptions sont fermées.
- **RG-15** — Le QR du stand est **dynamique** : il est renouvelé toutes les 30 s. Le serveur accepte la fenêtre courante et la précédente.
- **RG-16** — Un étudiant n'a qu'une seule inscription par événement ou sous-événement.
- **RG-17** — Annulation :
  - **Par l'étudiant** : possible pour une inscription `PRE_INSCRITE`, en `LISTE_ATTENTE`, ou `CONFIRMEE` **gratuite**. **Impossible après paiement** : la plateforme lui indique de contacter l'organisation.
  - **Par l'organisation** : l'organisation qui a encaissé peut annuler une inscription payée. La place est libérée ; le remboursement éventuel est géré hors plateforme.
  - Quand une place gratuite se libère, le premier inscrit en liste d'attente est promu et notifié.
- **RG-18** — En collaboration, **chaque organisation encaisse pour son propre compte**. Un paiement est attribué à l'organisation qui l'a marqué.
- **RG-26** — Pour un événement payant, quand toutes les places publiques sont confirmées, les pré-inscrits restants sont notifiés que l'événement est complet.

### Billets et présence

- **RG-19** — Le check-in n'est possible que pour une inscription `CONFIRMEE`, le jour du créneau, et une seule fois par créneau.
- **RG-20** — Le billet contient un jeton aléatoire non devinable, jamais un identifiant séquentiel.

### Confidentialité

- **RG-21** — Les transactions de trésorerie, les justificatifs et les montants encaissés par une organisation ne sont visibles **que par cette organisation**. Ils sont refusés aux autres organisations, y compris aux partenaires d'une collaboration, au coordinateur et à l'administrateur.
- **RG-22** — Le coordinateur voit les statistiques de participation (inscrits, confirmés, présents) mais aucun montant.
- **RG-30** — Le numéro de téléphone d'un étudiant n'est visible que par les organisateurs des événements **qui l'exigent** et auxquels il est inscrit.

> **Remarque** : les tarifs affichés d'un événement sont publics. Le nombre de confirmés multiplié par le tarif donne donc une estimation de la billetterie. La partie réellement confidentielle est la **trésorerie** : dépenses, recettes, justificatifs, répartition entre organisations.

### Feedback (V3)

- **RG-23** — Un étudiant ne peut donner un avis que s'il a au moins une présence enregistrée à l'événement.
