import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { consola } from 'consola'

const CONFIG_FILE = '.infisical.json'

function hasInfisical() {
  return spawnSync('infisical --version', { stdio: 'ignore', shell: true }).status === 0
}

/**
 * Wraps a command in `infisical run` so dev secrets come from the vault rather than a local .env.
 * Gated on `.infisical.json`, not merely on the CLI existing: that file is gitignored and per-developer, so a contributor who has the CLI for another project still gets a plain Nuxt.
 */
export function wrapWithInfisical(command, args, projectConfigDir) {
  if (!projectConfigDir || !existsSync(resolve(projectConfigDir, CONFIG_FILE))) return { command, args }
  if (!hasInfisical()) return { command, args }

  consola.info('Infisical CLI detected: injecting secrets.')
  return {
    command: 'infisical',
    args: [
      'run',
      '--project-config-dir', projectConfigDir,
      '--',
      command,
      ...args
    ]
  }
}
