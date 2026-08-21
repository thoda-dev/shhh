# Build from the repo root, not from docker/:
#   docker build -f docker/Dockerfile -t shhh .
#
# Node 24 is the Active LTS the project targets. Alpine keeps the runtime image small.
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app


FROM base AS deps
# Manifests only, so this layer is reused until dependencies change; the app source changes far more often than pnpm-lock.yaml.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json apps/app/
COPY apps/docs/package.json apps/docs/
# `--filter app...` skips the Docus workspace, a separate site never served by this image. `--frozen-lockfile` turns a stale lockfile into a build failure rather than silent drift.
RUN pnpm install --frozen-lockfile --filter app...


FROM deps AS build
COPY . .
# Nuxt's own binary, not `pnpm build`: that script routes through scripts/nuxt.mjs and its Infisical wrapper, a local convenience. In a container the environment already comes from compose or the orchestrator.
RUN pnpm --filter app exec nuxt build


# Not `FROM base`: the runtime needs neither corepack nor a package manager, and inheriting them is what drags their vulnerabilities in.
# Every CVE Docker Scout reports against this image comes from the npm CLI bundled in node:alpine, never from our own layers.
FROM node:24-alpine AS runtime
WORKDIR /app

# The container only runs `node .output/server/index.mjs`, so npm, npx, yarn, pnpm and corepack are dead weight. Removing them takes the image from 18 reported vulnerabilities to 0.
# It does not shrink it — the files stay in the base layer, whited out — but scanners read the final filesystem, which is also what an attacker in the container gets.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/pnpm /usr/local/bin/pnpx \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-v*

ENV NODE_ENV=production
ENV NUXT_PORT=3000
ENV NUXT_HOST=0.0.0.0
ENV MIGRATIONS_DIR=/app/migrations

# Nitro's output is self-contained, so nothing is installed in this stage. Migrations run at boot from server/plugins/migrate.ts, so no drizzle-kit CLI and no pnpm store follow us here.
COPY --from=build /app/apps/app/.output ./.output

# The .sql files themselves are read from disk at runtime, so they are copied in separately.
COPY --from=build /app/apps/app/server/database/migrations ./migrations

# node:alpine ships an unprivileged `node` user; the server needs no write access anywhere.
USER node

EXPOSE 3000

# The app's own health endpoint, not a bare TCP check: an instance that lost its database reports unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
