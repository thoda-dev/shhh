import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { consola } from 'consola'

/**
 * Publishing the documentation image on its own, between releases. The docs move far more often than
 * the code, and cutting a version of shhh to fix a sentence means rebuilding both images and
 * announcing a release that contains no change to the app.
 *
 * Moves `:latest` and adds an immutable `:sha-<short>`. Never writes the version tags — `1.1.9`,
 * `1.1`, `1` — which belong to `pnpm release`: they mean "the documentation as it shipped with that
 * version of the app", and that only stays true as long as nothing rewrites them.
 *
 * Helpers are duplicated from release.mjs rather than extracted: the release path works, and a
 * convenience script is no reason to touch it.
 *
 * Usage: pnpm release:docs [options]
 *   --dry-run       runs nothing irreversible, prints the commands instead
 *   --yes           skips the confirmation
 *   --skip-checks   does not rebuild the docs locally first
 *   --allow-branch  allows a branch other than master
 */

const DOCS_IMAGE = 'thodadev/shhh-docs'
const GHCR_DOCS_IMAGE = 'ghcr.io/thoda-dev/shhh-docs'
const PLATFORMS = 'linux/amd64,linux/arm64'
const BUILDER = 'shhh-release'
const BRANCH = 'master'
const REPO_URL = 'https://github.com/thoda-dev/shhh'

const flags = new Set(process.argv.slice(2).filter(a => a.startsWith('--')))
const dryRun = flags.has('--dry-run')

function run(command, cmdArgs, options = {}) {
  const printable = `${command} ${cmdArgs.join(' ')}`
  if (dryRun && !options.readOnly) {
    consola.log(`  [dry-run] ${printable}`)
    return { status: 0, stdout: '' }
  }
  const result = spawnSync(command, cmdArgs, {
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8'
  })
  if (result.status !== 0 && !options.allowFailure) {
    consola.error(`Échec : ${printable}`)
    if (options.capture && result.stderr) consola.log(result.stderr.trim())
    process.exit(1)
  }
  return { status: result.status, stdout: (result.stdout ?? '').trim() }
}

// Read-only, so never stubbed out by --dry-run — otherwise the preflight would check nothing.
function capture(command, cmdArgs) {
  return run(command, cmdArgs, { capture: true, allowFailure: true, readOnly: true }).stdout
}

// No `shell: true`: Node deprecates passing args to a shell (DEP0190), and a missing binary reports itself through `error`, not an exit code.
function has(binary) {
  return spawnSync(binary, ['--version'], { stdio: 'ignore' }).error === undefined
}

// ---------------------------------------------------------------- preflight

consola.start('Préparation de la publication des docs')

const problems = []

if (capture('git', ['rev-parse', '--is-inside-work-tree']) !== 'true') {
  problems.push('pas dans un dépôt git')
}
// The image is tagged with the commit it was built from, so a dirty tree would produce a `sha-` tag
// that describes something nobody can check out.
if (capture('git', ['status', '--porcelain'])) {
  problems.push('arbre de travail non propre — commite ou remise tes modifications')
}

const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== BRANCH && !flags.has('--allow-branch')) {
  problems.push(`branche ${branch} au lieu de ${BRANCH} (--allow-branch pour passer outre)`)
}

consola.info('Synchronisation avec origin…')
run('git', ['fetch', '--quiet', 'origin'], { readOnly: true, allowFailure: true })

const local = capture('git', ['rev-parse', 'HEAD'])
const remote = capture('git', ['rev-parse', `origin/${branch}`])
// Same reason: a `sha-` tag pointing at an unpushed commit is a dead reference for everyone else.
if (remote && local !== remote) {
  const ahead = capture('git', ['rev-list', '--count', `origin/${branch}..HEAD`])
  const behind = capture('git', ['rev-list', '--count', `HEAD..origin/${branch}`])
  problems.push(`branche désynchronisée avec origin (${ahead} devant, ${behind} derrière) — pousse avant de publier`)
}

if (!has('docker')) {
  problems.push('docker introuvable')
} else if (capture('docker', ['buildx', 'version']) === '') {
  problems.push('docker buildx introuvable')
}

// A `credsStore` entry proves nothing — Docker Desktop always writes it. Only the keychain can say which registries are actually in there.
function loggedInRegistries() {
  let config
  try {
    config = JSON.parse(readFileSync(`${process.env.HOME}/.docker/config.json`, 'utf8'))
  } catch {
    return []
  }
  return config.credsStore
    ? Object.keys(JSON.parse(capture(`docker-credential-${config.credsStore}`, ['list']) || '{}'))
    : Object.keys(config.auths ?? {})
}

// Both checked before the build: a push landing on one registry only would leave the two drifting.
const registries = loggedInRegistries()
if (!registries.some(r => r.includes('docker.io'))) {
  problems.push('pas de session Docker Hub — lance `docker login`')
}
if (!registries.some(r => r.includes('ghcr.io'))) {
  problems.push('pas de session GHCR — lance `gh auth token | docker login ghcr.io -u <utilisateur> --password-stdin` (le jeton a besoin du scope write:packages)')
}

if (problems.length) {
  consola.error('Préflight échoué :')
  for (const p of problems) consola.log(`  · ${p}`)
  process.exit(1)
}

// ---------------------------------------------------------------- confirmation

const sha = capture('git', ['rev-parse', 'HEAD'])
const shortSha = sha.slice(0, 7)
const shaTag = `sha-${shortSha}`
const subject = capture('git', ['log', '-1', '--pretty=%s'])

const tags = [DOCS_IMAGE, GHCR_DOCS_IMAGE].flatMap(repo => [`${repo}:latest`, `${repo}:${shaTag}`])

consola.box([
  `Commit     ${shortSha} ${subject}`,
  `Image      ${tags.join('\n           ')}`,
  `Plateformes ${PLATFORMS}`,
  '',
  'Les tags de version (1.1.9, 1.1, 1) ne sont pas touchés : ils appartiennent à `pnpm release`.'
].join('\n'))

if (!flags.has('--yes') && !dryRun) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question('Confirmer la publication de l\'image docs ? (o/N) ')
  rl.close()
  if (!['o', 'oui', 'y', 'yes'].includes(answer.trim().toLowerCase())) {
    consola.error('Annulé.')
    process.exit(1)
  }
}

// ---------------------------------------------------------------- checks

// The image rebuilds from scratch anyway; this only fails in two minutes instead of ten.
if (!flags.has('--skip-checks')) {
  consola.start('Build des docs')
  run('pnpm', ['install', '--frozen-lockfile'])
  run('pnpm', ['build:docs'])
  consola.success('Build passé')
}

// ---------------------------------------------------------------- Docker image

// The default `docker` driver can't produce a multi-architecture manifest, so a dedicated `docker-container` builder is created rather than touching the current one.
const builders = capture('docker', ['buildx', 'ls'])
if (!builders.includes(BUILDER)) {
  consola.info(`Création du builder ${BUILDER} (multi-architecture)`)
  run('docker', ['buildx', 'create', '--name', BUILDER, '--driver', 'docker-container'])
}

consola.start(`Build et push de l'image docs (${PLATFORMS}) — c'est l'étape longue`)
run('docker', [
  'buildx', 'build',
  '--builder', BUILDER,
  '--platform', PLATFORMS,
  '-f', 'docker/docs.Dockerfile',
  ...tags.flatMap(t => ['-t', t]),
  // Not the app's version: this image is not the one that shipped with it, and saying so would undo
  // the whole point of leaving the version tags alone.
  '--label', `org.opencontainers.image.version=${shaTag}`,
  '--label', `org.opencontainers.image.revision=${sha}`,
  '--label', `org.opencontainers.image.source=${REPO_URL}`,
  '--label', 'org.opencontainers.image.licenses=MIT',
  '--push',
  '.'
])

consola.success(`Image publiée : ${tags.join(', ')}`)
consola.info('Rien à annuler : aucun commit, aucun tag git, aucune release.')
