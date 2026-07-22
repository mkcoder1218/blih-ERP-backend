FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install pnpm directly to avoid Corepack signature-key failures.
RUN npm install --global pnpm@10.28.1

# Copy dependency manifests first for better Docker layer caching.
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm run build


FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV ENV_FILE=/app/.env.production

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    dumb-init \
    fonts-liberation \
    postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# Install the same pinned pnpm version used by the builder.
RUN npm install --global pnpm@10.28.1

COPY package.json pnpm-lock.yaml ./

# Keep all dependencies because the migration command may use tooling
# currently listed under devDependencies.
RUN pnpm install --frozen-lockfile \
  && pnpm store prune

COPY --from=builder /app/dist ./dist
COPY src/config/database.js ./src/config/database.js
COPY src/migrations ./src/migrations
COPY .sequelizerc ./

RUN mkdir -p /app/uploads \
  && chown -R node:node /app

USER node

EXPOSE 4000

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=30s \
  --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/server.js"]
