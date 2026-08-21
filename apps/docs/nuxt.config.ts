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
        'lucide:rocket',
        'lucide:server',
        'lucide:shield',
        'lucide:shield-check',
        'lucide:sliders-horizontal',
        'lucide:timer',
        'lucide:user',
        'lucide:users',
        'simple-icons:github',
        'vscode-icons:file-type-dotenv',
      ],
    },
  },
})
