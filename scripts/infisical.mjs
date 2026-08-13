import { spawnSync } from 'node:child_process'
import { consola } from 'consola'

function hasInfisical() {
  return spawnSync('infisical --version', { stdio: 'ignore', shell: true }).status === 0
}

export function wrapWithInfisical(command, args, projectConfigDir) {
  if (!hasInfisical()) return { command, args }

  consola.info(`CLI Infisical détecté : injection des secrets.`)
  return {
    command: 'infisical',
    args: [
      'run',
      ...(projectConfigDir ? ['--project-config-dir', projectConfigDir] : []),
      '--',
      command,
      ...args
    ]
  }
}
