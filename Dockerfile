# syntax=docker/dockerfile:1.7
# Production image (used by docker-compose.prod.yml). Multi-stage build:
#   deps    – npm ci (cached until package-lock.json changes)
#   tools   – full dependencies; used for migrations, seeding and the background worker
#   builder – `next build` (optimised production bundle, output: "standalone")
#   runner  – production server only: the standalone `server.js` that `next build` emits is the same
#             server as `next start`, minus the dev dependencies (much smaller image, faster start)

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS tools
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "worker"]

FROM tools AS builder
# Placeholders so env validation passes while Next collects page data; real values are injected at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-time-placeholder-secret-not-used-at-runtime"
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/storage && chown nextjs:nodejs /app/storage
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
