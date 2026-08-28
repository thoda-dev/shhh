export default defineNuxtConfig({
  extends: ['docus'],

  // @nuxt/content bakes an absolute build-time path for its SQLite file, which does not exist in a
  // runtime image that only carries .output. A relative path resolves against the working directory
  // instead, so the same build runs anywhere — see docker/docs.Dockerfile for the writable mount.
  content: {
    database: {
      type: 'sqlite',
      filename: '.data/content/contents.sqlite',
    },
  },

  // Nitro externalises this one but its dependency tracing misses `dist/i18n-runtime.mjs`, so the
  // built server cannot boot: `ERR_MODULE_NOT_FOUND` on the first request to node .output/server.
  // Inlining it puts the file in the bundle instead of relying on the trace.
  nitro: {
    externals: {
      inline: ['nuxtseo-shared'],
    },
  },

  // The docs double as an MCP server on /mcp — see content/1.getting-started/2.mcp.md. Without a
  // name the handshake advertises an empty one, which is what MCP clients list the server under.
  mcp: {
    name: 'shhh docs',
    description: 'Documentation for shhh, a self-hosted zero-knowledge pastebin.',
  },

  // Two pages have to be rendered per request rather than baked at build time. /releases reads the
  // GitHub API, and prerendering would freeze the list; its handler caches, so this costs one call to
  // GitHub every half hour, not one per hit. The MCP page builds absolute URLs from the request
  // origin, and the prerenderer only knows `http://localhost`.
  routeRules: {
    '/getting-started/mcp': { prerender: false },
    '/releases': { prerender: false },
  },

  // Same reason as the app: bundle icons at build time rather than fetching them at runtime.
  icon: {
    clientBundle: {
      // Only sees icons written literally in the sources.
      scan: true,
      // The rest come from content frontmatter, .navigation.yml, and code-block filenames, which the
      // scanner never reads. Add an entry here when a new one shows up as `[Icon] failed to load`.
      icons: [
        'lucide:arrow-right',
        'lucide:book-open',
        'lucide:container',
        'lucide:eye-off',
        'lucide:file-lock',
        'lucide:info',
        'lucide:lock-keyhole',
        'lucide:plug',
        'lucide:rocket',
        'lucide:server',
        'lucide:shield',
        'lucide:shield-check',
        'lucide:sliders-horizontal',
        'lucide:tag',
        'lucide:timer',
        'lucide:user',
        'lucide:users',
        'simple-icons:github',
        'vscode-icons:file-type-dotenv',
        'vscode-icons:file-type-json',
      ],
    },
  },
})
