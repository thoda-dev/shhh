import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { getGitDiff, parseCommits, generateMarkDown, loadChangelogConfig } from 'changelogen'

const CHANGELOG = 'CHANGELOG.md'

/**
 * Builds the release notes from the commits since `fromTag`, using changelogen — the same generator
 * the Nuxt ecosystem uses. It groups by Conventional Commit type, so a repository whose messages do
 * not follow the convention gets one flat list rather than a bad grouping.
 */
export async function generateNotes({ fromTag, version, cwd = process.cwd() }) {
  const config = await loadChangelogConfig(cwd, {
    newVersion: version,
    // changelogen prefers a GitHub handle and falls back to the commit email when it cannot resolve
    // one — which happens for anyone whose commit address is not attached to their GitHub account.
    // Publishing a contributor's address because a lookup failed is not an acceptable default, so
    // the fallback is turned off: unresolved authors appear by name alone.
    hideAuthorEmail: true
  })
  const commits = parseCommits(await getGitDiff(fromTag, 'HEAD', cwd), config)

  // Release commits describe the release machinery, not the release.
  const relevant = commits.filter(c => !(c.type === 'chore' && c.scope === 'release'))
  if (relevant.length > 0) return (await generateMarkDown(relevant, config)).trim()

  // `parseCommits` drops anything that is not a Conventional Commit, so a repository that does not
  // follow the convention gets an empty changelog rather than a bad one. Listing the raw subjects
  // is a poor changelog, but it beats publishing a release with no notes at all — and this branch
  // stops being reached on its own as commit messages improve.
  const raw = await getGitDiff(fromTag, 'HEAD', cwd)
  const subjects = raw
    .map(c => c.message.split('\n')[0].trim())
    .filter(m => m && !/^chore\(release\)/.test(m))
  if (subjects.length === 0) return ''

  return [
    `## ${version}`,
    '',
    '<!-- Raw commit subjects: no Conventional Commit messages were found in this range. -->',
    ...subjects.map(m => `- ${m}`)
  ].join('\n')
}

/**
 * Inserts a release section at the top of CHANGELOG.md, under the file's preamble.
 *
 * Prepending rather than regenerating the whole file: entries already published were reviewed and
 * sometimes edited by hand, and a regeneration would silently discard those edits.
 */
export function prependToChangelog(notes, { marker = '## ' } = {}) {
  if (!notes) return false

  const existing = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf8') : ''
  const at = existing.indexOf(`\n${marker}`)
  const [preamble, rest] = at === -1 ? [existing, ''] : [existing.slice(0, at + 1), existing.slice(at + 1)]

  writeFileSync(CHANGELOG, `${preamble.trimEnd()}\n\n${notes}\n\n${rest.trimStart()}`.trimEnd() + '\n')
  return true
}
