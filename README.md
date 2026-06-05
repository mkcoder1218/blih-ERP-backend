# Blih ERP Backend (Foundation)

## Stack
Node.js, Express, PostgreSQL, Sequelize, Joi, JWT, bcrypt, cors, dotenv (CommonJS).

## Setup
1. Copy environment file:
   - `cp .env.example .env` (or create `.env` manually on Windows)
2. Ensure PostgreSQL is running and the DB exists (matches `DB_NAME`).
3. Install deps:
   - `npm i`
4. Start:
   - Dev: `npm run dev`
   - Prod: `npm start`

## Docker Deployment
1. Create the production environment file:
   - `cp .env.production.example .env.production`
   - Replace the JWT, database, admin, email, `APP_URL`, and `CORS_ORIGINS` values.
2. Build and start the stack:
   - `docker compose up -d --build`
3. Check the API:
   - `curl http://localhost:4000/health`
4. Stop the stack:
   - `docker compose down`

The production compose file runs PostgreSQL plus the backend, stores database data in `pgdata`, stores uploaded files in `uploads_data`, and forces `DB_SYNC=false`. Run production database migrations before or during release instead of enabling sync.

For local Docker development, use:
- `docker compose -f docker-compose.dev.yml up --build`

## Notes
- DB connection is configured in `src/database/sequelize.js` using:
  `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_DIALECT` (must be `postgres`).
- ## OpenAPI / Swagger Documentation
The Blih ERP Backend is fully documented out-of-the-box leveraging dynamically generated OpenAPI 3.0 interfaces mapping structured request constraints.

To explore schema layouts, launch the dev server and visit:
- **Local Swagger UI:** `http://localhost:3000/api/docs`

*Note: The OpenAPI interface natively supports dynamic Bearer authentication tests respecting `businessId` separation boundaries contextually.*

- Development-only sync:
  - Set `DB_SYNC=true` and `NODE_ENV=development` to auto `sequelize.sync({ alter: true })`.
- Default seed runs on startup:
  - System roles: `PLATFORM_SUPER_ADMIN`, `BUSINESS_ADMIN`
  - Base permissions for business/user/role CRUD

## Development Testing Guide

## Routes
- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/businesses` (Platform Super Admin only)
- `GET /api/roles` (Business Admin only)
- `GET /api/users` (Business Admin only)

## Testing the API

### 1. Required `.env` Values
Ensure your `.env` includes:
```env
NODE_ENV=development
PORT=4000
JWT_ACCESS_SECRET=your_jwt_secret
BCRYPT_SALT_ROUNDS=12
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blih
DB_USER=postgres
DB_PASSWORD=postgres
DB_DIALECT=postgres
DB_SYNC=true
```

### 2. Run Dev Server
```bash
npm run dev
```

### 3. Health Check Endpoint
```bash
curl -X GET http://localhost:4000/health
```
**Expected Success Response:** `{"ok":true,"service":"blih-erp-backend","env":"development","timestamp":...}`

### 4. Create Business Request
*(Requires Platform Super Admin token. Manually create a user in your DB, set `isPlatformSuperAdmin: true`, give them the `PLATFORM_SUPER_ADMIN` role, log in, and use their token as `$SUPER_ADMIN_TOKEN`.)*
```bash
curl -X POST http://localhost:4000/api/businesses \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme-corp",
    "email": "contact@acme.com"
  }'
```
**Expected Success Response (201 Created):** Returns generated Business with `id` (`$BUSINESS_ID`).
**Expected Forbidden Response (403):** If token is not from a Super Admin.

### 5. Create Business Admin Request (First User)
The first user registered for a Business is automatically assigned the `BUSINESS_ADMIN` role.
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "$BUSINESS_ID",
    "fullName": "Alice Admin",
    "email": "alice@acme.com",
    "password": "SecurePassword123!"
  }'
```
**Expected Success Response (201 Created):** Returns User and an `accessToken` (`$BUSINESS_ADMIN_TOKEN`).

### 6. Auth Login Request
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "$BUSINESS_ID",
    "email": "alice@acme.com",
    "password": "SecurePassword123!"
  }'
```
**Expected Success Response (200 OK):** Returns matching User and `.accessToken`.

### 7. Create Role Request
```bash
curl -X POST http://localhost:4000/api/roles \
  -H "Authorization: Bearer $BUSINESS_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manager",
    "key": "MANAGER_ROLE",
    "permissionKeys": ["user.read", "user.create"]
  }'
```

### 8. Create User Request
```bash
curl -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer $BUSINESS_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Bob Staff",
    "email": "bob@acme.com",
    "password": "UserPass123!",
    "roleKeys": ["MANAGER_ROLE"]
  }'
```
*(User is automatically tied to the token'\''s `businessId`)*

### 9. List Users By Business (Tenant Isolation Test)
```bash
curl -X GET http://localhost:4000/api/users \
  -H "Authorization: Bearer $BUSINESS_ADMIN_TOKEN"
```
**Tenant Isolation Test:** If you create a second business and use its token, you will only see users from that respective `$BUSINESS_ID`. Injecting a different businessId via payloads or params is ignored by the middleware.
