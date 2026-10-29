# ==============================================================
# Multi-stage Production Dockerfile for UTT Innovation Portal
# Services:
#   - app: Next.js standalone production server (npm run start)
#   - worker: Background Email Worker (npm run worker)
#   - migrator: Database migration runner (npx prisma migrate deploy)
# ==============================================================

# --------------------------------------------------------------
# Stage 1: Base Environment
# --------------------------------------------------------------
FROM node:24.21.0-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install OpenSSL required by Prisma engine on Debian slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# --------------------------------------------------------------
# Stage 2: Dependencies (npm ci)
# --------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --------------------------------------------------------------
# Stage 3: Builder (Generate Prisma Client & Build Next.js Standalone)
# --------------------------------------------------------------
FROM deps AS builder
# Build-time dummy environment variables allow Next.js route collection without baking real secrets
ENV DATABASE_URL="postgresql://dummy:dummy@127.0.0.1:5432/dummy" \
    BETTER_AUTH_SECRET="build_time_dummy_secret_not_used_at_runtime_32chars" \
    LOOKUP_TOKEN_ENCRYPTION_KEY="build_time_dummy_key_not_used_at_runtime_32chars"
COPY . .
RUN npm run build

# --------------------------------------------------------------
# Stage 4: App (Production Next.js Runner)
# --------------------------------------------------------------
FROM base AS app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Copy minimal runtime assets
COPY package.json ./
COPY scripts/start-production.mjs ./scripts/
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]

# --------------------------------------------------------------
# Stage 5: Worker (Production Email Worker)
# --------------------------------------------------------------
FROM base AS worker
ENV NODE_ENV=production

COPY package.json package-lock.json tsconfig.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts ./scripts

USER node
CMD ["npm", "run", "worker"]

# --------------------------------------------------------------
# Stage 6: Migrator (One-shot Prisma Migration Runner)
# --------------------------------------------------------------
FROM base AS migrator
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY prisma.config.ts ./

USER node
CMD ["npx", "prisma", "migrate", "deploy"]
