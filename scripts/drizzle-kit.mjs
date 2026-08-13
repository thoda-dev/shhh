import { consola } from 'consola'
import { runAppBin } from './run-app-bin.mjs'

const subcommand = process.argv[2]

if (!subcommand) {
  consola.error('Usage: node scripts/drizzle-kit.mjs <generate|migrate|studio|...> [args...]')
  process.exit(1)
}

runAppBin('node_modules/drizzle-kit/bin.cjs', [subcommand, ...process.argv.slice(3)])
