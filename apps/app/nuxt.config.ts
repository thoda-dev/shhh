// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@nuxtjs/turnstile',
    '@nuxtjs/robots',
    '@nuxt/eslint'
  ],
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    storageKey: 'shhh_color_mode'
  },

  // Defence in depth for a design where the browser holds the only decryption key: an XSS here does
  // not leak a session, it leaks every key that passes through the page.
  routeRules: {
    '/**': {
      headers: {
        'Content-Security-Policy': [
          'default-src \'self\'',
          'base-uri \'none\'',
          'object-src \'none\'',
          'frame-ancestors \'none\'',
          'form-action \'self\'',
          // 'wasm-unsafe-eval' is not optional: Argon2id runs through hash-wasm, so without it every
          // password-protected paste stops opening. 'unsafe-inline' covers Nuxt's SSR bootstrap.
          'script-src \'self\' \'unsafe-inline\' \'wasm-unsafe-eval\' https://challenges.cloudflare.com',
          'style-src \'self\' \'unsafe-inline\'',
          'img-src \'self\' data: blob:',
          'font-src \'self\' data:',
          // The directive that carries the most weight here: Turnstile is the only third party the
          // page may reach, so injected script has nowhere to post a key it managed to read.
          'connect-src \'self\' https://challenges.cloudflare.com',
          'frame-src https://challenges.cloudflare.com',
          // A decrypted file is handed to the user as a blob: URL.
          'worker-src \'self\' blob:'
        ].join('; '),
        // The paste id lives in the path, so it must never travel in a Referer to a third party.
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
      }
    }
  },
  compatibilityDate: '2025-07-15',

  nitro: {
    experimental: {
      tasks: true
    },
    scheduledTasks: {
      '0 * * * *': ['purge-pastes']
    },
    storage: {
      ratelimit: { driver: 'memory' }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  i18n: {
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' }
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      // Named rather than left on the module default: a cookie scoped to a parent domain by another
      // Nuxt app would otherwise decide the language here. `server/utils/mail-locale.ts` reads it too.
      cookieKey: 'shhh_i18n_locale'
    }
  },

  // Without this, icons are fetched at runtime from /api/_nuxt_icon and log `[Icon] failed to load
  // icon` when that misses. Scanning bundles every icon written literally in the source instead.
  icon: {
    clientBundle: {
      scan: true
    }
  }
})
