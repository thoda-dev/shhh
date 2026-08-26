# Build from the repo root: docker build -f docker/docs.Dockerfile -t shhh-docs .
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app


FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json apps/app/
COPY apps/docs/package.json apps/docs/
RUN pnpm install --frozen-lockfile --filter docs...


FROM deps AS build
COPY . .
# Not `pnpm build:docs`: that script wraps Nuxt in an Infisical call the docs have no use for.
RUN pnpm --filter docs exec nuxt build


# Not `FROM base`: inheriting the package managers is what drags their CVEs in.
FROM node:24-alpine AS runtime
WORKDIR /app

# The base froze its Alpine packages on its build date; openssl has moved since.
RUN apk upgrade --no-cache

# Nothing here runs a package manager, and scanners read the final filesystem.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/pnpm /usr/local/bin/pnpx \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-v*

ENV NODE_ENV=production
ENV NUXT_PORT=3000
ENV NUXT_HOST=0.0.0.0

COPY --from=build /app/apps/docs/.output ./.output

# @nuxt/content opens its SQLite read-write at boot; the path resolves from Nitro's server directory.
RUN mkdir -p /app/.output/server/.data/content && chown -R node:node /app/.output/server/.data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
