# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build: socket-server (Bun)
# ---------------------------------------------------------------------------
FROM oven/bun:1.2-debian AS builder-server
WORKDIR /app/socket-server

COPY socket-server/package.json socket-server/bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY socket-server/ ./
# Runtime bind settings (HOST/PORT); not secret — used by Bun at process start
COPY ENVs/ENVs/socket-server/.env ./.env

# ---------------------------------------------------------------------------
# Build: tablet Next.js (standalone)
# Socket: Caddy LAN — https://192.168.0.111:5001 (see ENVs/ENVs/tablet-nextjs/.env)
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder-tablet
WORKDIR /app/tablet-nextjs

ENV NEXT_TELEMETRY_DISABLED=1

COPY tablet-nextjs/package.json tablet-nextjs/package-lock.json* ./
RUN npm install

COPY tablet-nextjs/ ./
# Next inlines NEXT_PUBLIC_* from .env during `next build`
COPY ENVs/ENVs/tablet-nextjs/.env ./.env
RUN npm run build

# ---------------------------------------------------------------------------
# Build: TV Next.js (standalone)
# Socket: same machine as server — http://localhost:4000 (see ENVs/ENVs/tv-nextjs/.env)
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder-tv
WORKDIR /app/tv-nextjs

ENV NEXT_TELEMETRY_DISABLED=1

COPY tv-nextjs/package.json tv-nextjs/package-lock.json* ./
RUN npm install

COPY tv-nextjs/ ./
COPY ENVs/ENVs/tv-nextjs/.env ./.env
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime: Node (Next standalone) + Bun (socket-server + optional mock)
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl unzip bash \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://bun.sh/install | bash \
  && ln -s /root/.bun/bin/bun /usr/local/bin/bun

WORKDIR /app

# Socket server (source + production deps + mock script)
COPY --from=builder-server /app/socket-server/package.json /app/server/package.json
COPY --from=builder-server /app/socket-server/bun.lock /app/server/bun.lock
COPY --from=builder-server /app/socket-server/node_modules /app/server/node_modules
COPY --from=builder-server /app/socket-server/index.ts /app/server/index.ts
COPY --from=builder-server /app/socket-server/controllers /app/server/controllers
COPY --from=builder-server /app/socket-server/data /app/server/data
COPY --from=builder-server /app/socket-server/lib /app/server/lib
COPY --from=builder-server /app/socket-server/utils /app/server/utils
COPY --from=builder-server /app/socket-server/scripts /app/server/scripts
COPY --from=builder-server /app/socket-server/.env /app/server/.env

# Tablet standalone + static + public
COPY --from=builder-tablet /app/tablet-nextjs/.next/standalone /app/tablet
COPY --from=builder-tablet /app/tablet-nextjs/.next/static /app/tablet/.next/static
COPY --from=builder-tablet /app/tablet-nextjs/public /app/tablet/public

# TV standalone + static + public
COPY --from=builder-tv /app/tv-nextjs/.next/standalone /app/tv
COPY --from=builder-tv /app/tv-nextjs/.next/static /app/tv/.next/static
COPY --from=builder-tv /app/tv-nextjs/public /app/tv/public

COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh \
  && sed -i 's/\r$//' /app/entrypoint.sh

ENV NODE_ENV=production \
    ENABLE_MOCK_HARDWARE=0 \
    NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000 3001 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://127.0.0.1:4000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
