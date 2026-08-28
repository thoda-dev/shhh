interface GitHubRelease {
  name: string | null
  tag_name: string
  html_url: string
  published_at: string | null
  created_at: string
  draft: boolean
  prerelease: boolean
  body: string | null
}

interface MarkdownNode {
  props?: Record<string, unknown>
  children?: MarkdownNode[]
}

// Every release repeats the same `### 🚀 Enhancements` headings, and they all land on one page.
function prefixIds(node: MarkdownNode, prefix: string) {
  if (typeof node.props?.id === 'string') {
    node.props.id = `${prefix}-${node.props.id}`
  }
  node.children?.forEach(child => prefixIds(child, prefix))
}

async function renderNotes(body: string, tag: string) {
  // changelogen opens each body with the version as a heading; the card already shows it. GitHub
  // hands the notes back with CRLF endings, which `.` in a JS regex refuses to cross.
  const notes = body.replace(/\r\n/g, '\n').trim().replace(/^##\s+.*\n+/, '')
  const parsed = await parseMarkdown(notes || '_No release notes._')
  prefixIds(parsed.body as MarkdownNode, tag)
  return parsed.body
}

// Unauthenticated GitHub allows 60 calls an hour per IP, shared by every visitor of the instance.
// Caching the whole list keeps a busy day at 48 calls and rides out a GitHub outage for half an hour.
export default defineCachedEventHandler(async () => {
  const releases = await $fetch<GitHubRelease[]>('https://api.github.com/repos/thoda-dev/shhh/releases', {
    query: { per_page: 30 },
    headers: {
      'accept': 'application/vnd.github+json',
      'user-agent': 'shhh-docs',
      'x-github-api-version': '2022-11-28',
    },
  })

  return Promise.all(releases
    .filter(release => !release.draft)
    .map(async release => ({
      title: release.name || release.tag_name,
      tag: release.tag_name,
      url: release.html_url,
      publishedAt: release.published_at || release.created_at,
      prerelease: release.prerelease,
      // Parsed here rather than in the browser so the page ships an AST the docs prose components
      // render, instead of raw HTML that would need its own styling.
      body: await renderNotes(release.body || '', release.tag_name),
    })))
}, {
  name: 'github-releases',
  maxAge: 60 * 30,
  swr: true,
  getKey: () => 'thoda-dev/shhh',
})
