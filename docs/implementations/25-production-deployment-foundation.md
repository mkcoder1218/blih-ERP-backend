# Blih ERP Backend Production Deployment Foundation

## Overview

The deployment logic guarantees a secure, scalable, stateless pipeline designed physically for high-availability cloud configurations (AWS ECS, Docker Swarm, DigitalOcean App Platform). It encapsulates all processes wrapping Node execution internally with PM2 cluster mapping leveraging underlying cores automatically, while completely preventing structural data-loss mapping safe DB patterns natively.

## Environment Layout

It encompasses two parallel docker-contexts:
1. `docker-compose.yml` (Production Scope): Boots standard `node:20-alpine` extracting previously compiled `/dist` payloads, dropping compiler bloat and DevDependencies reducing container size footprint dynamically.
2. `docker-compose.dev.yml` (Iterative Scope): Mounts absolute root volumes natively parsing `ts-node-dev` tracking file changes instantaneously mapping against a strictly isolated `postgres:15-alpine` container instance.

## Execution Directives `package.json`

| Command | Action Context |
|---|---|
| `npm run build` | Compiles mapping strictly via `tsconfig.json` bypassing Emit warnings. |
| `npm run start`| Overrides internal scopes passing execution into `pm2-runtime` mapped explicitly to `ecosystem.config.js`. |
| `npm run db:migrate`| Standardizes Sequelize CLI actions moving away from automatic sync capabilities natively. |

## Protective Logic
1. **Sync Ban**: Hardcoded exception mapped inside `src/database/init.ts`. If `NODE_ENV === "production"` and `DB_SYNC === true` is passed (e.g. env mistake), the backend physically crashes `throw new Error(...)` preventing arbitrary alterations against live SQL arrays inherently.
2. **PM2 Clustering**: `ecosystem.config.js` sets `instances: "max"` dropping dependency on external load-balancing wrappers for single-container scaled systems natively.
3. **Uploads Mounting**: Bypasses stateless loss attaching `- uploads_data:/app/uploads` protecting binary File Assets intrinsically.
