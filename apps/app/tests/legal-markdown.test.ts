import { describe, expect, it } from 'vitest'
import { parseLegalMarkdown } from '../shared/utils/legal-markdown'
import type { Node } from 'comark'

/** Every element tag the tree ended up containing, which is what the allowlist is about. */
function tags(nodes: Node[], found = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (typeof node === 'string' || node[0] === null) continue
    found.add(node[0])
    tags(node.slice(2) as Node[], found)
  }
  return found
}

const json = (nodes: Node[]) => JSON.stringify(nodes)

describe('parseLegalMarkdown', () => {
  it('parses the markdown a legal document is written in', async () => {
    const tree = await parseLegalMarkdown('# Privacy\n\nWe store **ciphertext** only.')

    expect(tags(tree.nodes)).toEqual(new Set(['h1', 'p', 'strong']))
  })

  it('keeps tables, which every retention section needs', async () => {
    const tree = await parseLegalMarkdown('| Data | Kept |\n| --- | --- |\n| Sessions | 30 days |')

    expect(tags(tree.nodes)).toContain('table')
  })

  it('leaves raw HTML as text rather than turning it into markup', async () => {
    const tree = await parseLegalMarkdown('<img src=x onerror="alert(1)">\n\n<b>bold</b>')

    // The angle brackets survive as characters in a paragraph, which is inert; what must not exist is an element carrying that attribute.
    expect(tags(tree.nodes)).toEqual(new Set(['p']))
    expect(json(tree.nodes)).toContain('onerror=\\"alert(1)\\"')
  })

  it('does not turn a script block into an element', async () => {
    const tree = await parseLegalMarkdown('<script>alert(1)</script>')

    expect(tags(tree.nodes)).not.toContain('script')
  })

  it('refuses a javascript: URL as a link', async () => {
    const tree = await parseLegalMarkdown('[click](javascript:alert(1))')

    expect(tags(tree.nodes)).not.toContain('a')
  })

  it('strips a URL whose protocol is not one of the three allowed', async () => {
    const tree = await parseLegalMarkdown('[fetch](ftp://example.com/file)')

    expect(tags(tree.nodes)).toContain('a')
    expect(json(tree.nodes)).not.toContain('ftp://')
  })

  it('keeps an ordinary link and a mailto: one', async () => {
    const tree = await parseLegalMarkdown('[docs](https://example.com) and [us](mailto:a@example.com)')

    expect(json(tree.nodes)).toContain('https://example.com')
    expect(json(tree.nodes)).toContain('mailto:a@example.com')
  })

  it('ignores component syntax instead of resolving a component', async () => {
    const tree = await parseLegalMarkdown('::alert{type="info"}\nHello\n::')

    expect(tags(tree.nodes)).not.toContain('alert')
  })
})

describe('line breaks', () => {
  it('keeps a single newline as a break, so an address block survives', async () => {
    const tree = await parseLegalMarkdown('**Acme**\n1 Rue Example\n75000 Paris')

    expect(tags(tree.nodes)).toContain('br')
  })
})
