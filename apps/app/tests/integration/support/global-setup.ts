import { createServer } from 'node:net'
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import postgres from 'postgres'
import type { TestProject } from 'vitest/node'
import { serverEnv, testDatabaseUrl } from './env'

declare module 'vitest' {
  interface ProvidedContext {
    baseUrl: string
  }
}

const appDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..')

function freePort() {
  return new Promise<number>((done, fail) => {
    const probe = createServer()
    probe.on('error', fail)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (typeof address === 'string' || address === null) return fail(new Error('could not resolve a free port'))
      probe.close(() => done(address.port))
    })
  })
}

/** A clean instance, not merely empty tables: the migrations are part of what is covered. */
async function resetSchema() {
  const client = postgres(testDatabaseUrl(), { max: 1, onnotice: () => {} })
  try {
    await client.unsafe('drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade')
  } finally {
    await client.end()
  }
}

/** `TEST_SKIP_BUILD=true` reuses the last `.output`, for a quick local loop. */
function build() {
  if (process.env.TEST_SKIP_BUILD === 'true') return
  execFileSync(process.execPath, ['node_modules/nuxt/bin/nuxt.mjs', 'build'], {
    cwd: appDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--max-old-space-size=8192'].filter(Boolean).join(' ')
    }
  })
}

async function waitForServer(baseUrl: string, server: ChildProcess, log: () => string) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`the server exited with code ${server.exitCode} before answering:\n${log()}`)
    try {
      // 503 means the database is unreachable, worth failing on here rather than in every test.
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.status === 200) return
      throw new Error(`/api/health answered ${response.status}`)
    } catch {
      await new Promise(done => setTimeout(done, 250))
    }
  }
  throw new Error(`the server never answered on ${baseUrl}:\n${log()}`)
}

/** One build and one server for the whole run; `setup()` on its own rebuilds per file. */
export default async function globalSetup(project: TestProject) {
  build()
  await resetSchema()

  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`

  // Migrations run in the server's own boot plugin, against the schema just dropped.
  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: appDir,
    env: { ...process.env, ...serverEnv(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const output: string[] = []
  server.stdout?.on('data', chunk => output.push(String(chunk)))
  server.stderr?.on('data', chunk => output.push(String(chunk)))

  try {
    await waitForServer(baseUrl, server, () => output.join(''))
  } catch (error) {
    server.kill('SIGKILL')
    throw error
  }

  project.provide('baseUrl', baseUrl)

  return async () => {
    if (server.exitCode !== null) return
    const exited = new Promise<void>(done => server.once('exit', () => done()))
    server.kill('SIGTERM')
    // Waited on, and escalated: an orphaned server holds the port and the database for the next run.
    const forced = setTimeout(() => server.kill('SIGKILL'), 5_000)
    await exited
    clearTimeout(forced)
  }
}
