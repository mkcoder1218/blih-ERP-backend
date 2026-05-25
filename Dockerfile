
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
