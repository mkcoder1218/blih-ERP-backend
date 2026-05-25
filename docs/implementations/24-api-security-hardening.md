# Blih API Security Hardening & Versioning Foundation

## Overview

The Blih ERP backend has been refactored explicitly implementing Versioning and comprehensive Request Security policies minimizing automated vector risks and strictly restricting client connection exposures according to external system standards.

## Layer 1: Global API Versioning

All standard execution logic has been relocated beneath `/api/v1/*`. The underlying integration prevents abrupt disruptions to mobile and un-upgradable systems during future structural schema transitions.
- **Root Router:** `src/app.ts` abstracts and mounts previously isolated module endpoints mapping natively under `/api/${env.apiVersion}` natively fetching dynamically via configurations.
- **Excluded Pathways:** Load balancer and instance pings `GET /health` specifically circumvent versioning definitions mapping reliably at exactly root avoiding `301` delays internally.

## Layer 2: Pipeline Security Protections

Implemented standard express-hardening layers via the exact explicitly stated parameters:
- **`helmet`**: Mounts 14 explicit security headers strictly protecting against Reflective XSS mapping natively preventing browser hijacking.
- **`hpp`**: Parameter pollution mapping. Explicitly drops redundant query manipulations (`?sort=asc&sort=desc`) blocking edge-case SQL evasion and payload array mapping overloads natively.
- **`compression`**: Shrinks payload footprints (GZIP mappings natively) ensuring dashboard payloads arrive faster optimizing client speeds dynamically.

## Layer 3: Environment Constraint & Rate Logic

A central `security.ts` middleware file coordinates Request throttling protecting instance memory thresholds strictly:
1. **`globalRateLimiter`:** Unbound execution endpoints (Reporting, Modules mapping) are trapped blocking over `100` identical IP calls trailing 15 minute sliding boundaries.
2. **`authRateLimiter`:** A heavily hardened endpoint mapping exclusively to `/auth`. Restricts brutal guessing configurations isolating brute-force testing exclusively inside `10` attempts / 15 minutes seamlessly producing `429 Too Many Requests`.
3. **CORS Enforcement:** The `CORS_ORIGINS` variable dynamically maps whitelisted frontend URL strings preventing blind API scraping remotely securely.

## Layer 4: Response Standardization & Request Tracing

Included strict mappings globally resolving endpoints inside standard Object structures utilizing `/utils/response.ts`.
Every executed connection inside standard Blih controllers is dynamically assigned an Explicit `X-Request-Id` UUID v4 header via `src/middlewares/requestId.ts`. This exact UUID is returned implicitly in both `errorResponse` and `successResponse` payloads yielding native debugging traces natively tying cloud logging logic organically.

## Layer 5: Data Obfuscation

The `errorHandler` mechanism actively scans thrown internal traces wrapping database mappings. If identifying explicit execution errors relating to logic vectors (e.g. `sequelize` syntax leaks, internal `password` logic crashes or native un-caught instances), it forces physical message truncation rendering *"An internal system error occurred"* protecting active table maps entirely if mapped safely inside `NODE_ENV=production`.
