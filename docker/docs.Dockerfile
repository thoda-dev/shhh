# Build from the repo root, not from docker/:
#   docker build -f docker/docs.Dockerfile -t shhh-docs .
#
# The documentation site. Separate image from the app: it shares no runtime, no database and no
# release cadence reason to be bundled together, and an instance operator has no use for it.
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app


FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json apps/app/
COPY apps/docs/package.json apps/docs/
# `--filter docs...` is the mirror of the app image: the Nuxt application is never served here.
RUN pnpm install --frozen-lockfile --filter docs...


FROM deps AS build
COPY . .
# Nuxt's own binary rather than `pnpm build:docs`, which routes through scripts/nuxt.mjs and its
# Infisical wrapper. The docs need no secrets at all.
RUN pnpm --filter docs exec nuxt build


# Same reasoning as the app image: the runtime needs no package manager, and inheriting one is what
# drags its vulnerabilities in.
FROM node:24-alpine AS runtime
WORKDIR /app

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/pnpm /usr/local/bin/pnpx \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-v*

ENV NODE_ENV=production
ENV NUXT_PORT=3000
ENV NUXT_HOST=0.0.0.0

# Nitro's output carries its own node_modules, native bindings included — @nuxt/content's SQLite and
# the sharp build for this image's architecture. Nothing is installed in this stage.
COPY --from=build /app/apps/docs/.output ./.output

# @nuxt/content opens its SQLite database read-write at boot, so unlike the app this image does need
# one writable directory. The relative path set in nuxt.config resolves from Nitro's server
# directory, hence this location rather than /app/.data. Everything else stays root-owned.
RUN mkdir -p /app/.output/server/.data/content && chown -R node:node /app/.output/server/.data

USER node

EXPOSE 3000

# No database and no /api/health here, so the site's own root is the only meaningful signal.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
