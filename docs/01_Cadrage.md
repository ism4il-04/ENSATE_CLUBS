# 01 — Cadrage du projet

> **Projet :** ENSATE Clubs (nom provisoire)
> **Établissement :** ENSA de Tétouan — Université Abdelmalek Essaâdi
> **Statut du document :** v0.1 — brouillon
> **Dernière mise à jour :** 2026-10-01

---

## 1. Contexte

La vie parascolaire de l'école repose sur plusieurs **clubs** et **2 associations**. Aujourd'hui :

- les clubs demandent des dates et des salles au coordinateur des clubs de manière informelle (messages, papier, oral) ;
- la communication des événements passe par Instagram et les groupes WhatsApp ;
- les inscriptions se font surtout **au stand**, avec paiement en espèces, sur des listes papier ou des Google Forms ;
- il n'existe aucune vue globale des événements, des salles occupées ni de la participation des étudiants.

## 2. Problème

| Acteur | Difficulté actuelle |
| --- | --- |
| Coordinateur des clubs | Pas de vue d'ensemble des demandes ni du calendrier ; suivi des validations dispersé |
| Clubs / associations | Listes d'inscrits et de paiements gérées à la main ; pas d'outil de contrôle à l'entrée |
| Étudiants | Information éparpillée ; difficile de savoir quoi, quand, où, et s'il reste des places |

## 3. Objectifs

1. **Centraliser la réservation de dates** : les organisations demandent des créneaux, le coordinateur valide.
2. **Publier les événements** validés avec tous leurs détails (affiche, description, planning, tarifs affichés, places).
3. **Gérer les inscriptions** en ligne et au stand, le paiement au stand et le contrôle d'entrée par QR code.
4. **Donner aux étudiants un espace unique** pour découvrir les événements et gérer leurs billets.
5. *(V2)* Offrir à chaque organisation un **espace trésorerie privé**.

## 4. Périmètre

### Inclus

- Connexion **uniquement avec Google** (aucun mot de passe) : étudiants `@etu.uae.ac.ma`, organisations, coordinateur, administrateur.
- Événements simples (un ou plusieurs jours) et **programmes** (événement composé de sous-événements).
- Collaborations entre plusieurs organisations (partenaires ajoutés directement).
- Places réservées aux membres du club ; numéro de téléphone exigé pour certains événements.
- Lieux de l'école (salles, amphi, salle de lecture, toute l'école, lieu spécifique).
- Inscriptions en ligne et au stand, paiement marqué au stand, billets QR, check-in.
- Trésorerie privée par organisation (V2).

### Exclus (pour l'instant)

- **Paiement en ligne** : le paiement se fait en espèces au stand.
- **Détection automatique des conflits de salles** : les conflits sont rares et le coordinateur les gère manuellement à partir de la vue calendrier.
- **Application mobile native** : une application web adaptée au mobile (PWA) suffit.
- **Recrutement / candidatures aux clubs** (ex-BF-21) : pas pour le moment.
- **Gestion des filières** : aucune.

## 5. Acteurs

| Acteur | Description |
| --- | --- |
| **Étudiant** | Consulte les événements, s'inscrit, présente son billet |
| **Organisation** (club ou association) | V1 : un compte unique par organisation, accessible avec l'email de l'organisation |
| **Membre d'organisation** *(V2)* | Compte personnel avec un rôle dans l'organisation (président, trésorier…) |
| **Coordinateur des clubs** | Valide les demandes, gère les organisations et les lieux ; peut aussi créer des événements pour n'importe quelle organisation |
| **Administrateur** | Gère les comptes et la configuration technique |

## 6. Contraintes

- **Authentification** : connexion **uniquement avec Google**. Un compte étudiant est créé automatiquement à la première connexion avec une adresse `@etu.uae.ac.ma` ; toute autre adresse Google crée un compte **externe**, qui ne peut s'inscrire qu'aux événements ouverts aux externes. Les comptes créés par le coordinateur ou l'administrateur peuvent utiliser n'importe quelle adresse Google (gmail.com, etc.). L'adresse d'une organisation doit donc être un compte Google.
- **Confidentialité financière** : les données de trésorerie d'une organisation ne sont visibles **que par cette organisation**, ni par le coordinateur, ni par l'administrateur.
- **Usage mobile** : la grande majorité des utilisateurs viendra depuis un téléphone (scan au stand, billet à l'entrée).
- **Données personnelles** : conformité à la loi marocaine 09-08 (CNDP), avec une collecte minimale.
- **Budget** : hébergement gratuit ou à très faible coût au démarrage.

## 7. Phasage

| Version | Contenu |
| --- | --- |
| **V1 — MVP** | Comptes et authentification ; organisations ; lieux ; demande de créneaux et validation ; événements simples et programmes ; collaborations ; création d'événements par le coordinateur ; publication (affiche, planning, places membres, téléphone requis) ; inscriptions en ligne et au stand ; paiement au stand ; billets QR ; check-in |
| **V2** | Comptes membres et rôles ; **trésorerie privée** ; organisations favorites ; notifications in-app ; annonces aux inscrits ; export calendrier (.ics) ; périodes bloquées |
| **V3** | Feedback après événement ; attestations de participation ; statistiques avancées |

## 8. Indicateurs de succès

- 100 % des demandes de dates passent par la plateforme dès le deuxième semestre d'utilisation.
- Au moins 70 % des événements utilisent le check-in QR.
- Temps moyen de validation d'une demande inférieur à 72 h.
- Au moins 50 % des étudiants ont un compte actif à la fin de la première année.

## 9. Risques

| Risque | Impact | Mitigation |
| --- | --- | --- |
| Faible adoption par les étudiants | Fort | Stand = point d'entrée naturel (inscription via QR), relais par les clubs |
| Clubs qui continuent sur papier | Moyen | Inscription et check-in plus rapides que le papier ; export Excel |
| Fuite de données financières | Fort | Contrôle d'accès strict, justificatifs en stockage privé (voir 05) |
| Réseau faible au stand | Moyen | Pages légères ; recherche manuelle de l'étudiant si le scan échoue |
| Départ de l'équipe de développement | Moyen | Documentation (ce dossier), stack courante, code lisible |
| L'université bloque les applications tierces sur les comptes Google `etu.uae.ac.ma` | Fort | **Tester la connexion avec un vrai compte étudiant dès le début** ; sinon, demander l'autorisation à l'administrateur Google Workspace de l'université |

## 10. Journal des décisions

| Date | Décision |
| --- | --- |
| 2026-10-01 | Clubs et associations sont modélisés ensemble comme des « organisations » |
| 2026-10-01 | V1 : un compte de connexion par organisation (email de l'organisation) |
| 2026-10-01 | Les comptes créés par le staff acceptent tout domaine email |
| 2026-10-01 | Pas de détection automatique des conflits de salles |
| 2026-10-01 | Une pré-inscription non payée **ne bloque pas** de place |
| 2026-10-01 | Événement multi-jours : l'organisation choisit entre un « événement simple » (inscription unique) et un « programme » (sous-événements avec inscriptions séparées) |
| 2026-10-01 | En collaboration, chaque organisation encaisse et gère son argent séparément |
| 2026-10-01 | Trésorerie invisible pour le coordinateur et l'administrateur |
| 2026-10-02 | Connexion **uniquement avec Google**, aucun mot de passe |
| 2026-10-02 | Certains événements exigent un numéro de téléphone |
| 2026-10-02 | Un étudiant ne peut plus annuler après paiement : il contacte l'organisation, qui annule |
| 2026-10-02 | Collaboration : partenaires ajoutés directement, sans invitation |
| 2026-10-02 | Le coordinateur peut créer un événement pour n'importe quelle organisation (directement validé) |
| 2026-10-02 | Places réservées aux membres du club, définies dès la publication |
| 2026-10-02 | Pas de recrutement (ex-BF-21) pour le moment ; pas de gestion des filières |
| 2026-10-05 | Tarifs : gratuit, ou liste de tarifs (adhérent, non-adhérent, externe…) dont certains peuvent être non affichés (ex. « Bureau ») |
| 2026-10-05 | Certains événements sont ouverts aux externes : toute adresse Google crée un compte `EXTERNE` |
| 2026-10-05 | Pas de liste d'adhérents pour l'instant : le club choisit le tarif de chaque participant au moment d'encaisser |
| 2026-10-05 | Étudiant ou externe : déterminé uniquement par le domaine de l'adresse (`@etu.uae.ac.ma`) |
