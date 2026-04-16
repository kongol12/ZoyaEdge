# ZoyaEdge — L'Intelligence Comportementale au Service du Trading

ZoyaEdge est une plateforme d'analyse de performance et de coaching psychologique pour les traders (Forex, Indices, Crypto). Contrairement aux journaux de trading classiques, ZoyaEdge utilise l'Intelligence Artificielle pour détecter les biais cognitifs (FOMO, Revenge Trading, fatigue) et transformer les données brutes en décisions profitables.

---

## 🚀 Stack Technologique

### Frontend
- **React 19** : Interface utilisateur réactive et performante.
- **Vite 6** : Build tool ultra-rapide.
- **Tailwind CSS 4** : Design system moderne et utilitaire.
- **Motion (Framer Motion)** : Animations fluides et transitions premium.
- **Lucide React** : Bibliothèque d'icônes vectorielles.

### Backend & Infrastructure
- **Node.js / Express** : Serveur proxy sécurisé pour l'IA et les Webhooks.
- **Firebase (Firestore, Auth, Storage)** : Base de données temps réel, authentification sécurisée et stockage d'images.
- **Google Gemini 3.1 Flash** : Moteur d'IA pour le coaching et l'analyse comportementale.
- **TypeScript** : Typage statique pour une maintenance robuste.

---

## 🛠 Fonctionnalités Déployées

- **Journal de Trading Intelligent** : Saisie manuelle ou import CSV avec suivi des émotions et des sessions.
- **AI Coach (Zoya AI)** : Analyse en temps réel des séries de pertes et détection des biais psychologiques.
- **Synchronisation MT4/MT5** : Webhook dédié pour l'importation automatique des trades via Expert Advisor (EA).
- **Dashboard Institutionnel** : Métriques avancées (Expectancy, Profit Factor, Winrate par session/paire).
- **Strategy Builder** : Définition et test de règles de trading pour renforcer la discipline.
- **Notebook & Screenshots** : Documentation visuelle de la psychologie de marché.
- **Console Admin** : Gestion des utilisateurs, des abonnements et monitoring système.

---

## 🏗 Architecture Réelle

L'application suit une architecture **Full-Stack Hybride** :

1. **Client-Side SPA** : Gère l'UI, la visualisation de données et les écouteurs Firestore temps réel.
2. **Server-Side Proxy (Express)** : 
   - Sécurise les clés API (Gemini, Firebase Admin).
   - Gère les Webhooks entrants des plateformes de trading.
   - Effectue les appels IA complexes pour éviter d'exposer la logique métier.
3. **Firebase Security Rules** : Couche de sécurité granulaire (RBAC) garantissant que chaque utilisateur n'accède qu'à ses propres données.

---

## 📂 Structure des Fichiers

```text
├── src/
│   ├── components/       # Composants UI (Atoms, Molecules, Organisms)
│   ├── hooks/            # Hooks React personnalisés
│   ├── lib/              # Logique métier, config Firebase, moteurs de calcul
│   ├── pages/            # Pages de l'application (Client, Admin, Auth)
│   ├── types.ts          # Définitions TypeScript globales
│   └── index.css         # Styles globaux et configuration Tailwind
├── server.ts             # Point d'entrée du serveur Express (Backend)
├── firestore.rules       # Règles de sécurité de la base de données
├── firebase-blueprint.json # Schéma de données IR (Référence)
├── metadata.json         # Métadonnées de l'application
└── vite.config.ts        # Configuration du build frontend
```

---

## ⚠️ Fichiers Sensibles

- `.env` : Contient `GEMINI_API_KEY` et les secrets de production.
- `firebase-applet-config.json` : Configuration de connexion au projet Firebase.
- `FIREBASE_SERVICE_ACCOUNT_KEY` (Variable d'env) : Clé d'accès administrateur pour le serveur.

---

## 📈 Recommandations pour la Mise en Production

1. **Domaine Personnalisé** : Configurer un CNAME pour `app.zoyafx.com` vers l'instance Cloud Run.
2. **Secrets Management** : Utiliser un gestionnaire de secrets (Google Secret Manager) pour les clés API en production.
3. **Monitoring** : Activer Firebase Analytics et Sentry pour le suivi des erreurs en temps réel.
4. **Rate Limiting** : Le serveur Express inclut déjà un `express-rate-limit`, ajustez les seuils selon la charge réelle.

---

## 🔧 Maintenance Évolutive

- **Ajout de Métriques** : Modifier `src/lib/statsEngine.ts` pour intégrer de nouveaux calculs mathématiques.
- **Nouveaux Modèles IA** : Mettre à jour les appels dans `server.ts` vers les nouveaux modèles Gemini via `@google/genai`.
- **UI/UX** : Suivre la charte graphique définie dans `src/index.css` (Variables `@theme`).

---

## 🔄 Guide de Migration

### Vers Supabase (Scaling SQL)
1. Créer un projet Supabase.
2. Migrer les données de `trades` vers une table PostgreSQL.
3. Remplacer les appels Firestore dans `src/lib/db.ts` par le client `@supabase/supabase-js`.
4. Utiliser les **Edge Functions** pour remplacer les endpoints IA du `server.ts`.

### Vers VPS / Docker
1. Utiliser le `Dockerfile` (à générer) pour encapsuler l'application.
2. Exposer le port `3000`.
3. Configurer un reverse proxy (Nginx) pour gérer le SSL via Let's Encrypt.

### Vers Serverless (Vercel/Netlify)
1. Déplacer la logique de `server.ts` vers des **API Routes** (Next.js ou fonctions serverless).
2. Configurer les variables d'environnement dans le dashboard de l'hébergeur.

---

© 2026 ZoyaFX. Tous droits réservés.
