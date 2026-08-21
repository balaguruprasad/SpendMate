# syntax=docker/dockerfile:1
# Multi-stage build for the Mesa Finance frontend (Next.js 16 standalone) on Cloud Run.
#
# NOTE: NEXT_PUBLIC_* values are INLINED at build time, so the prod API URL must be
# supplied as a --build-arg here (it cannot be injected at runtime / via Secret Manager).
# These are public client config, not secrets.

FROM node:22-slim AS base

# ---- deps: install node_modules from a clean lockfile ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the standalone server ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time public env (inlined into the bundle). Defaults target production.
ARG NEXT_PUBLIC_API_BASE_URL=https://api-finance.mesaschool.co.in/api/v1
ARG NEXT_PUBLIC_USE_MOCK=false
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_USE_MOCK=${NEXT_PUBLIC_USE_MOCK}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner: minimal image that runs server.js ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as a non-root user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output bundles only the files needed to run.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Cloud Run injects PORT (defaults to 8080); the standalone server reads PORT + HOSTNAME.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080

CMD ["node", "server.js"]
