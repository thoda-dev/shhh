import { consola } from 'consola'
import { runAppBin } from './run-app-bin.mjs'

const subcommand = process.argv[2]

if (!subcommand) {
  consola.error('Usage: node scripts/nuxt.mjs <dev|build> [args...]')
  process.exit(1)
}

runAppBin('node_modules/nuxt/bin/nuxt.mjs', [subcommand, ...process.argv.slice(3)], {
  env: {
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=8192'].filter(Boolean).join(' ')
  }
})
