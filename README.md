# ZoyaEdge V5 — L'Intelligence Comportementale au Service du Trading

ZoyaEdge est une plateforme SaaS ultra-performante conçue pour les traders de compte propre et les fonds spéculatifs. Elle combine un journal de trading institutionnel avec un moteur d'Intelligence Artificielle (Gemini V2) pour auditer les performances, détecter les biais psychologiques et imposer une discipline de fer.

---

## 🚀 Évolutions Récentes (Advancements)

ZoyaEdge V5 a franchi des étapes critiques de maturité technologique :

### 1. Architecture de Paiement Multiservices & Sécurisée
*   **Validation Serveur (Anti-Fraude)** : Toutes les transactions passent par une couche de validation en `server.ts`. Le serveur recalcule les prix (Base + TVA + Frais) en temps réel avant de soumettre la requête à la passerelle, empêchant toute manipulation du montant par le client.
*   **Abstraction des Passerelles** : Intégration de la passerelle **ARAKA** (RDC) avec un système de **Polling Sécurisé**. Le serveur interroge directement l'API de reporting pour confirmer le succès du paiement, sans faire confiance aux données envoyées par le front-end.
*   **Système d'Essai Gratuit Sécurisé** : L'activation des 7 jours d'essai est désormais verrouillée côté serveur. Un utilisateur ne peut l'activer qu'une seule fois, avec vérification immédiate des métadonnées Firestore.

### 2. Moteur IA & Credit Scoring
*   **Routing des Modèles par Plan** : Les analyses **STANDARD** utilisent Gemini Flash (rapide/efficace), tandis que le mode **DETAILED** (Advanced Analytics) est réservé aux membres **Premium**.
*   **Gestion des Crédits** : Déduction automatique des crédits IA lors de chaque analyse, avec bypass illimité pour les plans Premium. Cache intelligent pour éviter de consommer des crédits sur les mêmes données.

### 3. Contrôle Global & Maintenance
*   **Mode Maintenance Dynamique** : Activé via `app_settings` dans Firestore. Il bloque l'accès à l'application avec un écran d'attente stylisé, tout en permettant aux **Super Admins** de continuer à travailler et tester la plateforme.
*   **Super Admin Access** : Accès privilégié défini par email au niveau des règles de sécurité Firebase, permettant de modifier les paramètres globaux (Taux de change, Frais, Maintenance) sans redéployer le code.

---

## 🔒 Sécurité : L'Approche "Fortress"

ZoyaEdge utilise une architecture de sécurité à plusieurs niveaux :

1.  **Firebase Rules (Périmètre Externe)** :
    *   **RBAC (Role-Based Access Control)** : Séparation stricte entre les rôles `user`, `agent`, et `admin`.
    *   **Immuabilité** : Les champs sensibles comme `userId` ou `plan` lors du paiement ne peuvent plus être modifiés une fois créés.
    *   **Isolation des PII** : Accès restreint aux données personnelles.
2.  **Server Proxy (Périmètre Interne)** :
    *   Le client ne communique **jamais** directement avec les APIs tierces (Gemini, Araka). Le serveur Express agit comme une barrière de confiance, cachant les secrets et validant chaque requête via `idTokens` Firebase.
3.  **Validation d'Identité (Ownership Check)** : Chaque vérification de paiement vérifie que l'UID de l'utilisateur correspond au propriétaire de la transaction en base de données.

---

## 💸 Extension : Gérer d'autres Passerelles (Multipayment)

L'architecture est prête pour le scaling international :

### Comment ajouter un nouveau pays / une nouvelle devise ?

1.  **Configuration dans Firestore** : Ajoutez les IDs de page de paiement dans `app_settings/global` pour la nouvelle devise/pays (ex: `STRIPE_PAGE_ID` pour l'international).
2.  **Mise à jour du Serveur (`server.ts`)** :
    *   Créez un nouvel endpoint `/api/payments/votre-passerelle/pay`.
    *   Utilisez le middleware `finalizePayment` existant pour l'activation automatique de l'abonnement en cas de succès.
3.  **Middleware de Prix** : Le système de calcul de prix prend déjà en compte la `currency` (USD, CDF, etc.) et le `exchangeRate` stocké en base de données. Il suffit d'injecter la nouvelle logique de redirection vers votre passerelle.

---

## 🛠 Stack Technique

*   **Frontend**: React 19, Vite, Tailwind CSS 4, Framer Motion (Animations Premium).
*   **Backend**: Node.js/Express (Point de vérité unique).
*   **Database**: Firestore (NoSQL temps réel).
*   **Auth**: Firebase Auth (Google & Email/Password).
*   **IA**: Google Gemini 1.5/2.0 SDK.

---

## 📦 Installation & Déploiement

1.  **Clonage & Dépendances** :
    ```bash
    npm install
    ```
2.  **Configuration Environnement** : Créez un `.env` basé sur `.env.example`.
3.  **Déploiement Rules** : Déployez `firestore.rules` via la Firebase CLI.
4.  **Lancement** :
    ```bash
    npm run dev
    ```

---

## 🤝 Maintenance Évolutive

Pour maintenir l'application :
*   **Paramètres Financiers** : Directement modifiables via l'onglet **Finance** du portail Admin (ou via Firestore pour les Super Admins).
*   **Logs & Audit** : Le serveur logue toutes les tentatives de fraude de prix ou d'accès non autorisé.

---

© 2026 ZoyaEdge. Construit pour les Traders, propulsé par l'IA.
