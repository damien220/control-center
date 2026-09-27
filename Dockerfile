# syntax=docker/dockerfile:1.7
#
# Control Center container image. Build and run with docker compose:
#   docker compose up -d --build
#   docker compose exec control-center node scripts/token.mjs   # sign-in URL
#
# No secrets are baked in: provider keys and OAuth settings come from the
# environment (.env.local via compose) or are saved in Settings to the /data
# volume at runtime.

ARG NODE_IMAGE=node:24-alpine

# 1. Locked dependencies (dev dependencies included; the build needs them).
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# 2. Production build as a self-contained standalone server.
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    CONTROL_CENTER_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Slim runtime: only the traced server, static assets, and CLI helpers.
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    CONTROL_CENTER_DATA_DIR=/data

# App files stay root-owned and read-only to the app user; only the data
# volume and Next's cache directory are writable.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/scripts/paths.mjs /app/scripts/token.mjs /app/scripts/doctor.mjs /app/scripts/backup.mjs /app/scripts/ingest.mjs ./scripts/
RUN mkdir -p /data /app/.next/cache \
 && chown node:node /data /app/.next/cache \
 && chmod 700 /data

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "server.js"]
