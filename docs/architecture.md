# ZoyaEdge Architecture

## Overview
ZoyaEdge is a monorepo application structured for scalability, modularity, and security. It separates concerns into clear domains while sharing code via localized packages.

## Directory Structure

```
.
├── apps
│   ├── server           # Express backend (Modular Architecture)
│   └── web              # React/Vite frontend (Feature-based Architecture)
├── packages
│   ├── shared-types     # Global TypeScript definitions
│   └── shared-utils     # Global utility functions
├── tests                # Integration and unit tests
└── docs                 # Architecture and API documentation
```

## Frontend (apps/web)
The frontend uses a **Feature-Based Architecture**. Each feature encapsulates its own logic, UI, and state.
- **Signals**: AI trade signals and analysis.
- **Trades**: Trade journaling, history, and metrics.
- **Auth**: User authentication and session management.
- **Shared**: Reusable components, hooks, and libraries (layouts, theme, etc.).

**Public API Barriers**: Each feature folder has an `index.ts` that defines its public API. External modules should only import from these index files.

## Backend (apps/server)
The backend follows a **Modular Monolith** pattern.
- **Infrastructure**: Firebase Admin initialization, logging, etc.
- **Modules**: Domain-specific logic (Auth, AI, Trades, Payments, Webhooks).
- **Core**: Global middleware, rate limiting, and main app entry.

## AI Pipeline (The Decision Engine)
The core logic resides in `apps/server/src/ai-engine/pipeline.ts`. It orchestrates mathematical performance auditing and LLM-powered behavioral analysis.

## Security
- **CORS**: Restricted origins via `process.env.ALLOWED_ORIGINS`.
- **Rate Limiting**: Global and endpoint-specific limiters.
- **Rule Enforcement**: Firestore security rules define data ownership and integrity.
- **Webhook Integrity**: MT5/ARAKA webhooks verified via signatures and individual raw body parsing.

## Observability & Logging
- **Structured Logging**: The backend uses a custom JSON logger in production (`apps/server/src/core/logger.ts`).
- **Request Metadata**: Every HTTP request is logged with method, status, duration, and user ID.
- **Health Monitoring**: A `/health` endpoint is available for uptime and system status verification.
- **Error Privacy**: Generic error messages are returned in production to prevent leaking system internals, while full stacks are logged internally via the structured logger.
