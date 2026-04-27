# ZoyaEdge V5 — L'Intelligence Comportementale au Service du Trading

ZoyaEdge est une plateforme SaaS ultra-performante pour les traders, combinant journal institutionnel et IA (Gemini V2).

## 🚀 Développement & Monorepo

L'application est structurée en monorepo pour une maintenance agile et robuste.

### Structure du Projet
- **apps/web** : Frontend React/Vite (Features: signals, trades, activity).
- **apps/server** : Backend Express (Modules: auth, ai, trades, payments).
- **tests** : Suite de tests Vitest.

### Commandes Utiles
- **Installation** : `npm install`
- **Développement** : `npm run dev` (Démarre le serveur Express avec Vite en middleware)
- **Tests** : `npm run test`
- **Build** : `npm run build`
- **Lint** : `npm run lint`

### Variables d'Environnement
- `GEMINI_API_KEY` : Clé API pour le moteur de décision Zoya AI.
- `ALLOWED_ORIGINS` : Liste des domaines autorisés (CORS).
- `MT5_WEBHOOK_SECRET` : Secret partagé pour la synchronisation MT5.
- `ARAKA_API_KEY` : Clé pour la passerelle de paiement.

## 🔒 Sécurité
- **JSON Limit** : 1MB Max.
- **Rate Limiting** : Protection contre le brute-force et le scraping.
- **Security Headers** : Helmet.js configuré pour le mode Fortress.

© 2026 ZoyaEdge.
