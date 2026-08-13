// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

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

  modules: ['@nuxt/ui', '@nuxtjs/i18n', '@nuxtjs/turnstile', '@nuxtjs/robots'],

  css: ['~/assets/css/main.css'],

  i18n: {
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' }
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix'
  }
})