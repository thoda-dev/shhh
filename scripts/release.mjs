import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { consola } from 'consola'

/**
 * Cutting a release by hand, so no secret ever passes through a GitHub Action. Replays the CI checks, then pushes the image and the tag.
 *
 * Usage: pnpm release <patch|minor|major|x.y.z> [options]
 *   --dry-run       runs nothing irreversible, prints the commands instead
 *   --yes           skips the confirmation
 *   --skip-checks   resumes after a failure, once the checks have already passed
 *   --skip-docker   does not publish the image (resume after a successful Docker push)
 *   --skip-github   pushes neither the tag nor the release
 *   --allow-branch  allows a branch other than master
 */

const IMAGE = 'thodadev/shhh'
const DOCS_IMAGE = 'thodadev/shhh-docs'
const PLATFORMS = 'linux/amd64,linux/arm64'
const BUILDER = 'shhh-release'
const BRANCH = 'master'
const REPO_URL = 'https://github.com/thoda-dev/shhh'

const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--')))
const target = args.find(a => !a.startsWith('--'))
const dryRun = flags.has('--dry-run')

function run(command, cmdArgs, options = {}) {
  const printable = `${command} ${cmdArgs.join(' ')}`
  if (dryRun && !options.readOnly) {
    consola.log(`  [dry-run] ${printable}`)
    return { status: 0, stdout: '' }
  }
  const result = spawnSync(command, cmdArgs, {
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: { ...process.env, ...options.env }
  })
  if (result.status !== 0 && !options.allowFailure) {
    consola.error(`Échec : ${printable}`)
    if (options.capture && result.stderr) consola.log(result.stderr.trim())
    if (options.onFailure) options.onFailure()
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

// ---------------------------------------------------------------- version

const pkgPath = new URL('../package.json', import.meta.url)
const pkgRaw = readFileSync(pkgPath, 'utf8')
const current = JSON.parse(pkgRaw).version ?? '0.0.0'

function nextVersion(from, keyword) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(from)
  if (!match) {
    consola.error(`Version courante illisible dans package.json : ${from}`)
    process.exit(1)
  }
  const [major, minor, patch] = match.slice(1).map(Number)
  if (keyword === 'major') return `${major + 1}.0.0`
  if (keyword === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

if (!target) {
  consola.error('Usage : pnpm release <patch|minor|major|x.y.z> [--dry-run] [--yes]')
  consola.info(`Version courante : ${current}`)
  process.exit(1)
}

const version = ['patch', 'minor', 'major'].includes(target) ? nextVersion(current, target) : target

// Full semver, prerelease and build metadata included — this is what allows a 1.0.0-rc.1.
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(version)) {
  consola.error(`Version invalide : ${version}`)
  process.exit(1)
}

const tag = `v${version}`
// `latest` must never point at a prerelease: a self-hoster who doesn't pin would pull a release candidate without asking.
const isPrerelease = version.includes('-')

// ---------------------------------------------------------------- preflight

consola.start(`Préparation de ${tag} (depuis ${current})`)

const problems = []

if (capture('git', ['rev-parse', '--is-inside-work-tree']) !== 'true') {
  problems.push('pas dans un dépôt git')
}
if (capture('git', ['status', '--porcelain'])) {
  problems.push('arbre de travail non propre — commite ou remise tes modifications')
}

const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== BRANCH && !flags.has('--allow-branch')) {
  problems.push(`branche ${branch} au lieu de ${BRANCH} (--allow-branch pour passer outre)`)
}

consola.info('Synchronisation avec origin…')
run('git', ['fetch', '--quiet', '--tags', 'origin'], { readOnly: true, allowFailure: true })

const local = capture('git', ['rev-parse', 'HEAD'])
const remote = capture('git', ['rev-parse', `origin/${branch}`])
if (remote && local !== remote) {
  const ahead = capture('git', ['rev-list', '--count', `origin/${branch}..HEAD`])
  const behind = capture('git', ['rev-list', '--count', `HEAD..origin/${branch}`])
  problems.push(`branche désynchronisée avec origin (${ahead} devant, ${behind} derrière)`)
}

if (capture('git', ['tag', '--list', tag])) {
  problems.push(`le tag ${tag} existe déjà en local`)
}
if (capture('git', ['ls-remote', '--tags', 'origin', tag])) {
  problems.push(`le tag ${tag} existe déjà sur origin`)
}

if (!has('docker')) {
  problems.push('docker introuvable')
} else if (capture('docker', ['buildx', 'version']) === '') {
  problems.push('docker buildx introuvable')
}

// A `credsStore` entry proves nothing — Docker Desktop always writes it. Only the keychain can say whether docker.io is actually in there.
function isLoggedIntoDockerHub() {
  let config
  try {
    config = JSON.parse(readFileSync(`${process.env.HOME}/.docker/config.json`, 'utf8'))
  } catch {
    return false
  }
  const registries = config.credsStore
    ? Object.keys(JSON.parse(capture(`docker-credential-${config.credsStore}`, ['list']) || '{}'))
    : Object.keys(config.auths ?? {})
  return registries.some(r => r.includes('docker.io'))
}

if (!isLoggedIntoDockerHub()) {
  problems.push('pas de session Docker Hub — lance `docker login`')
}

const hasGh = has('gh') && spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' }).status === 0
if (!hasGh) {
  consola.warn('gh absent ou non authentifié : la release GitHub devra être créée à la main.')
}

if (problems.length) {
  consola.error('Préflight échoué :')
  for (const p of problems) consola.log(`  · ${p}`)
  process.exit(1)
}

// ---------------------------------------------------------------- confirmation

// The tag ladder every official image publishes: `:1` keeps receiving 1.x fixes without ever crossing into a breaking 2.0, and `:1.2` narrows that to patches.
// A prerelease gets only its exact version, so no moving tag ever resolves to it.
const [major, minor] = version.split('.')
const tagsFor = image => isPrerelease
  ? [`${image}:${version}`]
  : [`${image}:${version}`, `${image}:${major}.${minor}`, `${image}:${major}`, `${image}:latest`]

// The docs ride the app's version rather than carrying their own: they document that exact release,
// so a reader can pin both to the same tag and know they match.
const images = [
  { name: 'app', dockerfile: 'docker/Dockerfile', tags: tagsFor(IMAGE) },
  { name: 'docs', dockerfile: 'docker/docs.Dockerfile', tags: tagsFor(DOCS_IMAGE) }
]
const imageTags = images.flatMap(i => i.tags)

consola.box([
  `Version    ${current} → ${version}`,
  `Tag git    ${tag}`,
  `Image      ${imageTags.join('\n           ')}`,
  `Plateformes ${PLATFORMS}`,
  `Release    ${hasGh ? 'gh release create' : 'à créer à la main'}`
].join('\n'))

if (!flags.has('--yes') && !dryRun) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`Confirmer la publication de ${tag} ? (tape le numéro de version) `)
  rl.close()
  if (answer.trim() !== version) {
    consola.error('Annulé.')
    process.exit(1)
  }
}

// ---------------------------------------------------------------- checks

if (!flags.has('--skip-checks')) {
  consola.start('Vérifications (identiques au CI)')
  run('pnpm', ['install', '--frozen-lockfile'])
  run('pnpm', ['lint'])
  run('pnpm', ['typecheck'])
  run('pnpm', ['test'])
  // Only proves the code compiles: the image rebuilds from scratch inside the container, so any NUXT_PUBLIC_* injected here never reaches production.
  run('pnpm', ['build'])
  run('pnpm', ['build:docs'])

  // The only command that has to run from apps/app, hence the direct spawnSync.
  if (!dryRun) {
    const migrations = spawnSync('./node_modules/.bin/drizzle-kit', ['check'], {
      cwd: 'apps/app',
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: 'postgres://unused' }
    })
    if (migrations.status !== 0) {
      consola.error('Les migrations ne correspondent pas au schéma.')
      process.exit(1)
    }
  }
  consola.success('Vérifications passées')
}

// ---------------------------------------------------------------- commit and tag, locally

const undo = () => {
  consola.log('')
  consola.warn('Pour revenir en arrière :')
  consola.log(`  git tag -d ${tag}`)
  consola.log('  git reset --hard HEAD~1')
}

consola.start(`Commit et tag ${tag}`)
if (!dryRun) writeFileSync(pkgPath, pkgRaw.replace(`"version": "${current}"`, `"version": "${version}"`))
run('git', ['add', 'package.json'])
run('git', ['commit', '-m', `chore(release): ${tag}`])
run('git', ['tag', '-a', tag, '-m', tag], { onFailure: undo })

const sha = capture('git', ['rev-parse', 'HEAD'])

// ---------------------------------------------------------------- Docker image

if (!flags.has('--skip-docker')) {
  // The default `docker` driver can't produce a multi-architecture manifest, so a dedicated `docker-container` builder is created rather than touching the current one.
  const builders = capture('docker', ['buildx', 'ls'])
  if (!builders.includes(BUILDER)) {
    consola.info(`Création du builder ${BUILDER} (multi-architecture)`)
    run('docker', ['buildx', 'create', '--name', BUILDER, '--driver', 'docker-container'], { onFailure: undo })
  }

  for (const image of images) {
    consola.start(`Build et push de l'image ${image.name} (${PLATFORMS}) — c'est l'étape longue`)
    run('docker', [
      'buildx', 'build',
      '--builder', BUILDER,
      '--platform', PLATFORMS,
      '-f', image.dockerfile,
      ...image.tags.flatMap(t => ['-t', t]),
      '--label', `org.opencontainers.image.version=${version}`,
      '--label', `org.opencontainers.image.revision=${sha}`,
      '--label', `org.opencontainers.image.source=${REPO_URL}`,
      '--label', 'org.opencontainers.image.licenses=MIT',
      '--push',
      '.'
    ], { onFailure: undo })
    consola.success(`Image publiée : ${image.tags.join(', ')}`)
  }
}

// ---------------------------------------------------------------- GitHub

// After Docker on purpose: the tag is the public announcement, and you don't announce a version whose image doesn't exist. A Docker failure leaves only local, undoable state.
if (!flags.has('--skip-github')) {
  consola.start('Push du commit et du tag')
  run('git', ['push', 'origin', branch], { onFailure: undo })
  run('git', ['push', 'origin', tag])

  if (hasGh) {
    consola.start('Création de la release GitHub')
    run('gh', ['release', 'create', tag,
      '--title', tag,
      '--generate-notes',
      ...(isPrerelease ? ['--prerelease'] : [])])
  } else {
    consola.log('')
    consola.info('Release GitHub à créer à la main :')
    consola.log(`  gh release create ${tag} --title ${tag} --generate-notes`)
    consola.log(`  ou ${REPO_URL}/releases/new?tag=${tag}`)
  }
}

consola.success(`${tag} publiée.`)
