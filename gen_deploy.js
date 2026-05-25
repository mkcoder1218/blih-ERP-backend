const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'src');

// 1. Dockerfile
fs.writeFileSync(path.join(root, 'Dockerfile'), `
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
# If you want to use PM2 globally within container, add RUN npm install -g pm2
# Otherwise just use node directly. Ecosystem provides flexibility.
RUN npm install -g pm2
EXPOSE 4000
# Startup through pm2 specifically mapping the ecosystem file
COPY ecosystem.config.js ./
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
`);

// 2. docker-compose.yml
fs.writeFileSync(path.join(root, 'docker-compose.yml'), `
version: '3.8'

services:
  app:
    build: .
    restart: always
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
      - DB_PORT=5432
      - API_VERSION=v1
      - DB_SYNC=false
    env_file:
      - .env.production
    volumes:
      - uploads_data:/app/uploads
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: \${DB_USER:-postgres}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-postgres}
      POSTGRES_DB: \${DB_NAME:-blih_erp}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER:-postgres}"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  uploads_data:
`);

// 3. docker-compose.dev.yml
fs.writeFileSync(path.join(root, 'docker-compose.dev.yml'), `
version: '3.8'

services:
  app:
    build: 
      context: .
      target: builder # Just use basic mapping if needed, or dynamically mount 
    image: node:20-alpine
    command: npm run dev
    restart: always
    ports:
      - "3000:4000"
    volumes:
      - .:/app
      - /app/node_modules
      - uploads_data:/app/uploads
    environment:
      - NODE_ENV=development
      - DB_HOST=db
      - DB_PORT=5432
      - DB_SYNC=true
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: \${DB_USER:-postgres}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-postgres}
      POSTGRES_DB: \${DB_NAME:-blih_erp}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER:-postgres}"]
      interval: 3s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
  uploads_data:
`);

// 4. .dockerignore
fs.writeFileSync(path.join(root, '.dockerignore'), `
node_modules
npm-debug.log
dist
.env
.env.*
!.env.example
.git
.gitignore
uploads/*
tests
docs
tmp
`);

// 5. ecosystem.config.js
fs.writeFileSync(path.join(root, 'ecosystem.config.js'), `
module.exports = {
  apps: [{
    name: "blih-erp-backend",
    script: "./dist/server.js",
    instances: "max", // leverages all cores in production
    exec_mode: "cluster",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
}
`);

// 6. Database protection logic done standalone

// 7. Scripts package.json injections
const pjsonPath = path.join(root, 'package.json');
let pjson = JSON.parse(fs.readFileSync(pjsonPath, 'utf8'));

// Apply native script commands explicitly
pjson.scripts = {
    ...pjson.scripts,
    "build": "tsc -p tsconfig.json",
    "start": "NODE_ENV=production pm2-runtime start ecosystem.config.js --env production",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "db:migrate": "npx sequelize-cli db:migrate",
    "db:seed": "npx sequelize-cli db:seed:all",
    "db:reset": "npx sequelize-cli db:migrate:undo:all && npx sequelize-cli db:migrate && npx sequelize-cli db:seed:all",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
};

fs.writeFileSync(pjsonPath, JSON.stringify(pjson, null, 2));

console.log('Docker, PM2 and Deployment Scaffolding created.');
