# 08 — Stratégie de tests

---

## 1. Niveaux de test

| Niveau | Outil | Cible | Quand |
| --- | --- | --- | --- |
| **Unitaire** | Vitest | Fonctions pures : transitions de statut, calcul des places, jeton stand (HMAC), validation de l'email, schémas Zod | À chaque commit (CI) |
| **Intégration** | Vitest + PostgreSQL de test (Docker ou branche Neon) | Services métier avec une vraie base : inscriptions, paiements, check-in, permissions | À chaque pull request (CI) |
| **End-to-end** | Playwright (mobile + desktop) | Parcours complets dans le navigateur (connexion par un fournisseur factice, activé uniquement en test) | Sur l'environnement de preview |
| **Recette** | Manuelle, avec 1 ou 2 clubs pilotes | Un vrai événement de bout en bout | Avant le lancement de la V1 |

**Objectif de couverture** : 100 % des règles de gestion (`RG-xx`) couvertes par au moins un test unitaire ou d'intégration. On ne fixe pas d'objectif en pourcentage de lignes.

---

## 2. Données de test

Le script `tests/fixtures` crée :

- 1 admin, 1 coordinateur ;
- 3 organisations : `club-a`, `club-b`, `asso-c` ;
- 10 étudiants (`etu01…etu10@etu.uae.ac.ma`), dont 1 suspendu ;
- 1 étudiant créé par le staff avec une adresse `@gmail.com` ;
- 1 compte externe (`externe@gmail.com`) ;
- un événement payant avec les tarifs Adhérent 30, Non-adhérent 50, Externe 80 et Bureau 0 (non affiché) ;
- les lieux du seed ;
- des événements dans chaque statut, dont un **programme** avec 2 sous-événements et un événement **en collaboration** (`club-a` principal, `club-b` partenaire) ;
- un événement payant avec `capacite = 10`, `places_membres = 3` et `telephone_requis = true`.

---

## 3. Cas de test par règle de gestion

### Comptes

| ID | Règle | Scénario | Résultat attendu |
| --- | --- | --- | --- |
| T-01 | RG-01 | Première connexion Google avec `x@gmail.com`, sans compte créé par le staff | Compte `EXTERNE` créé |
| T-02 | RG-01 | Première connexion Google avec `X@ETU.UAE.AC.MA` | Compte `ETUDIANT` créé, email en minuscules, nom, prénom et photo repris de Google |
| T-03 | RG-01 | Connexion avec `x@etu.uae.ac.ma.evil.com` | Compte `EXTERNE` (et non étudiant) |
| T-06 | RG-01 | Réponse Google avec `email_verified = false` | Refus |
| T-04 | RG-02 | Le coordinateur crée l'organisation `club@gmail.com`, puis première connexion Google avec cette adresse | Compte activé, `google_sub` enregistré, lié à l'organisation |
| T-07 | RG-01 | Deuxième connexion avec le même `sub` Google | Même compte, pas de doublon |
| T-05 | RG-24 | Un compte suspendu tente de se connecter ou de s'inscrire | Refusé |

### Cycle de vie des événements

| ID | Règle | Scénario | Résultat attendu |
| --- | --- | --- | --- |
| T-10 | RG-04 | Le partenaire tente de modifier ou de soumettre l'événement | 403 |
| T-11 | RG-05 | Création d'un sous-événement sous un sous-événement | Refusée |
| T-12 | RG-05 | Inscription à un `PROGRAMME` | 422 `PROGRAMME_SANS_INSCRIPTION` |
| T-13 | RG-06 | Créneau avec fin ≤ début | 422 |
| T-14 | RG-06 | Lieu « Autre » sans précision | 422 |
| T-15 | RG-06 | Créneau de 21h à 01h le lendemain | Accepté |
| T-16 | RG-07 | Refus sans commentaire | 422 `COMMENTAIRE_OBLIGATOIRE` |
| T-17 | RG-07 | Validation d'un programme | Le parent et tous ses sous-événements passent à `VALIDE` |
| T-18 | RG-08 | L'organisation modifie un créneau d'un événement `VALIDE` | 422 `CRENEAUX_VERROUILLES` |
| T-19 | RG-08 | Le coordinateur modifie ce créneau | 200 + inscrits notifiés |
| T-20 | RG-09 | Publication d'un événement `EN_ATTENTE` | 422 `TRANSITION_INVALIDE` |
| T-21 | RG-09 | Capacité abaissée sous le nombre de confirmés | 422 `CAPACITE_INSUFFISANTE` |
| T-22 | RG-27 | Le coordinateur crée un événement pour `club-a` | Statut `VALIDE`, décision « Créé par le coordinateur » ; `club-a` le voit et peut le publier |
| T-23 | RG-04 | `club-a` ajoute `club-b` comme partenaire | `club-b` voit l'événement immédiatement, sans étape d'acceptation |

### Inscriptions et paiements

| ID | Règle | Scénario | Résultat attendu |
| --- | --- | --- | --- |
| T-30 | RG-11 | Gratuit, capacité 2, 3 inscriptions, liste d'attente active | 2 `CONFIRMEE`, 1 `LISTE_ATTENTE` |
| T-31 | RG-11 | Idem, liste d'attente désactivée | La 3e reçoit 422 `EVENEMENT_COMPLET` |
| T-32 | RG-12 | Payant, capacité 2, 5 inscriptions en ligne | 5 `PRE_INSCRITE`, places restantes = 2 |
| T-33 | RG-13 | Marquage payé de 3 pré-inscrits sur une capacité de 2 | 2 `CONFIRMEE`, le 3e reçoit 422 `EVENEMENT_COMPLET` |
| T-34 | RG-13 / BNF-03 | **Concurrence** : 20 marquages payés **simultanés**, capacité 10 | Exactement 10 `CONFIRMEE` |
| T-35 | RG-14 | Mode `STAND` : inscription en ligne directe | 422 `INSCRIPTION_STAND_UNIQUEMENT` |
| T-36 | RG-25 | Inscriptions fermées : marquage payé d'un pré-inscrit | Accepté |
| T-37 | RG-16 | Double inscription au même événement | 409 `DEJA_INSCRIT` |
| T-38 | RG-17 | Annulation d'un confirmé (gratuit) avec liste d'attente | Le premier en attente devient `CONFIRMEE` et est notifié |
| T-39 | RG-18 | Collaboration : `club-b` marque payé | `id_organisation_encaisse = club-b` |
| T-40 | RG-18 | `club-a` annule un paiement encaissé par `club-b` | 422 `PAIEMENT_AUTRE_ORGANISATION` |
| T-41 | RG-26 | La capacité est atteinte avec des pré-inscrits restants | Ils reçoivent la notification « complet » |
| T-42 | RG-17 | L'étudiant tente d'annuler une inscription payée | 422 `ANNULATION_APRES_PAIEMENT` |
| T-43 | RG-17 | `club-a` (qui a encaissé) annule cette inscription | `ANNULEE`, place publique libérée, `id_annule_par` renseigné |
| T-44 | RG-28 | Inscription à un événement `telephone_requis` sans téléphone | 422 `TELEPHONE_REQUIS` ; avec un téléphone : acceptée, et le téléphone est enregistré dans le profil |
| T-45 | RG-29 | Capacité 10, places membres 3 : marquage payé de 8 pré-inscrits | 7 `CONFIRMEE`, le 8e reçoit 422 `EVENEMENT_COMPLET` |
| T-46 | RG-29 | Attribution de 4 places membres sur 3 | La 4e reçoit 422 `PLACES_MEMBRES_EPUISEES` |
| T-47 | RG-29 | Réduction de `places_membres` sous le nombre déjà attribué | 422 |
| T-48 | RG-14 | Recherche « ben » dans les inscrits | Les pré-inscrits correspondants apparaissent en premier |
| T-49 | RG-31 | Un externe s'inscrit à un événement non ouvert aux externes | 403 `RESERVE_ETUDIANTS_ENSA` |
| T-50 | RG-36 | `GET /evenements/{slug}` d'un événement avec un tarif « Bureau » non affiché | « Bureau » absent de la réponse |
| T-51 | RG-32 | Marquage payé avec le tarif « Adhérent » | `CONFIRMEE`, `montant_paye = 30`, `id_tarif` renseigné |
| T-52 | RG-33 | Marquage payé avec le tarif « Bureau » (0 DH) | `CONFIRMEE`, `montant_paye = 0` |
| T-53 | RG-32 | Marquage payé sans tarif choisi | 422 `VALIDATION` |
| T-54 | RG-36 | Publication d'un événement payant sans aucun tarif affiché | 422 |
| T-55 | RG-36 | Suppression d'un tarif déjà utilisé par une inscription payée | 422 (le tarif peut seulement être masqué) |

### Stand

| ID | Règle | Scénario | Résultat attendu |
| --- | --- | --- | --- |
| T-50 | RG-15 | Jeton de la fenêtre courante | Accepté |
| T-51 | RG-15 | Jeton de la fenêtre précédente (−30 s) | Accepté |
| T-52 | RG-15 | Jeton d'il y a 90 s | 422 `JETON_STAND_INVALIDE` |
| T-53 | RG-15 | Jeton valide, puis création de compte pendant 5 min, puis inscription | Acceptée grâce au cookie « accès stand » |
| T-54 | — | Session fermée ou expirée | 422 `SESSION_STAND_FERMEE` |
| T-55 | — | `GET /org/stand/{id}/jeton` ne renvoie jamais le `secret` | Vérification de la réponse |

### Billets et check-in

| ID | Règle | Scénario | Résultat attendu |
| --- | --- | --- | --- |
| T-60 | RG-19 | Check-in d'un `PRE_INSCRITE` | 422 `NON_CONFIRMEE` |
| T-61 | RG-19 | Deuxième scan sur le même créneau | 409 `DEJA_PRESENT` |
| T-62 | RG-19 | Événement de 3 jours : un scan par jour | 3 présences |
| T-63 | RG-19 | Scan pour le créneau de demain | 422 `CRENEAU_HORS_JOUR` |
| T-64 | RG-20 | Billet d'un autre événement scanné par `club-a` | 422 `BILLET_INVALIDE` |

---

## 4. Tests de sécurité et de confidentialité

| ID | Scénario | Résultat attendu |
| --- | --- | --- |
| S-01 | `club-b` accède aux inscrits d'un événement de `club-a` dont il n'est pas partenaire | 404 |
| S-02 | Un étudiant appelle une route `/org/*` ou `/coord/*` | 403 |
| S-03 | Un étudiant lit le billet d'un autre étudiant via `/moi/inscriptions/{id}/billet` | 404 |
| S-04 | **RG-21** : le coordinateur appelle **chaque** route `/org/finances/*` | 403 partout |
| S-05 | **RG-21** : l'admin appelle **chaque** route `/org/finances/*` | 403 partout |
| S-06 | **RG-21** : le partenaire `club-b` voit les inscrits de la collaboration | Aucun montant encaissé par `club-a` dans la réponse |
| S-07 | **RG-22** : réponse de `/coord/statistiques` | Aucun champ de montant |
| S-08 | URL publique d'un justificatif sans signature | Accès refusé par Cloudinary |
| S-09 | Le fournisseur de connexion factice est absent du build de production | Vérifié en CI |
| S-10 | **RG-30** : `club-a` liste les inscrits d'un événement sans `telephone_requis` | Aucun téléphone dans la réponse |
| S-13 | `/org/etudiants?q=` avec moins de 3 caractères | 422 ; jamais de liste complète des étudiants |
| S-11 | Injection de HTML ou de script dans la description d'un événement | Échappé à l'affichage |
| S-12 | Envoi d'un fichier `.exe` renommé en `.jpg` | Refusé |

> S-04 et S-05 sont **générés automatiquement** à partir de la liste des routes `/org/finances/*`. Ainsi, une nouvelle route ajoutée plus tard est testée d'office.

---

## 5. Tests end-to-end (Playwright)

| ID | Parcours | Appareil |
| --- | --- | --- |
| E-01 | P1 — inscription en ligne → paiement → billet | Mobile (Pixel 7) |
| E-02 | P2 — scan du stand → connexion Google (factice) → inscription → recherche par nom → paiement | Mobile |
| E-03 | P3 — création d'un programme → soumission → validation → publication | Desktop |
| E-04 | P4 — le coordinateur demande une modification → le club resoumet → validation | Desktop |
| E-05 | Check-in d'un événement de 2 jours | Mobile |
| E-06 | Le coordinateur crée un événement pour un club → le club publie | Desktop |
| E-07 | Attribution de places membres → check-in d'un membre | Mobile |

---

## 6. Critères d'acceptation de la V1

- [ ] Tous les tests T-xx et S-xx passent en CI.
- [ ] Connexion Google testée avec un **vrai** compte `@etu.uae.ac.ma` (applications tierces autorisées par l'université).
- [ ] Les parcours E-01 à E-05 passent sur l'environnement de preview.
- [ ] Recette réalisée avec au moins **un club pilote** sur un vrai événement, avec stand et check-in.
- [ ] Le marquage d'un paiement prend moins de 1 s en 4G (mesuré au stand).
- [ ] Les pages publiques ont un score Lighthouse mobile ≥ 90 (performance et accessibilité).
- [ ] Revue de sécurité effectuée (en-têtes, secrets, permissions).
- [ ] Sauvegarde et restauration de la base testées au moins une fois.
