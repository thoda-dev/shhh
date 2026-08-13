# Build from the repo root, not from docker/:
#   docker build -f docker/Dockerfile -t shhh .
#
# Node 24 is the Active LTS the project targets (project.md section 2). Alpine keeps the runtime
# image small; the build stage needs a toolchain anyway for native postinstall scripts.
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app


FROM base AS deps
# Manifests only, so this layer is reused as long as dependencies don't change — the app source
# changes far more often than pnpm-lock.yaml.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json apps/app/
COPY apps/docs/package.json apps/docs/
# `--filter app...` skips the Docus documentation workspace: it is a separate site, never served by
# this image. `--frozen-lockfile` makes a stale lockfile a build failure rather than a silent drift.
RUN pnpm install --frozen-lockfile --filter app...


FROM deps AS build
COPY . .
# Nuxt's own binary, not `pnpm build` — the package script routes through scripts/nuxt.mjs, which
# wraps the command in the Infisical CLI. That is a local developer convenience; in a container the
# environment is already supplied by docker-compose or the orchestrator.
RUN pnpm --filter app exec nuxt build


FROM base AS runtime
ENV NODE_ENV=production
ENV NUXT_PORT=3000
ENV NUXT_HOST=0.0.0.0
ENV MIGRATIONS_DIR=/app/migrations

# Nitro's build output is self-contained: it bundles its own node_modules, so nothing is installed
# in this stage. Migrations are applied at boot by server/plugins/migrate.ts, which is why no
# drizzle-kit CLI and no pnpm store need to follow us here.
COPY --from=build /app/apps/app/.output ./.output

# The .sql files themselves are read from disk at runtime, so they are copied in separately.
COPY --from=build /app/apps/app/server/database/migrations ./migrations

# node:alpine ships an unprivileged `node` user; the server needs no write access anywhere.
USER node

EXPOSE 3000

# Uses the app's own health endpoint (project.md section 12) rather than a bare TCP check, so an
# instance that has lost its database is reported unhealthy instead of merely reachable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
