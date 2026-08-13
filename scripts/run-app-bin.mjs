import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { wrapWithInfisical } from './infisical.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appDir = resolve(repoRoot, 'apps/app')

export function runAppBin(binRelativePath, args, { env } = {}) {
  const bin = resolve(appDir, binRelativePath)
  const { command, args: spawnArgs } = wrapWithInfisical(process.execPath, [bin, ...args], repoRoot)

  const child = spawn(command, spawnArgs, {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, ...env }
  })
  child.on('exit', code => process.exit(code ?? 0))
}
