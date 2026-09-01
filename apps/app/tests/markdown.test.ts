import { describe, expect, it } from 'vitest'
import { containsMarkdownImage, parseDocumentMarkdown, parsePasteMarkdown } from '../shared/utils/markdown'
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

describe('parseDocumentMarkdown', () => {
  it('parses the markdown a legal document is written in', async () => {
    const tree = await parseDocumentMarkdown('# Privacy\n\nWe store **ciphertext** only.')

    expect(tags(tree.nodes)).toEqual(new Set(['h1', 'p', 'strong']))
  })

  it('keeps tables, which every retention section needs', async () => {
    const tree = await parseDocumentMarkdown('| Data | Kept |\n| --- | --- |\n| Sessions | 30 days |')

    expect(tags(tree.nodes)).toContain('table')
  })

  it('leaves raw HTML as text rather than turning it into markup', async () => {
    const tree = await parseDocumentMarkdown('<img src=x onerror="alert(1)">\n\n<b>bold</b>')

    // The angle brackets survive as characters in a paragraph, which is inert; what must not exist is an element carrying that attribute.
    expect(tags(tree.nodes)).toEqual(new Set(['p']))
    expect(json(tree.nodes)).toContain('onerror=\\"alert(1)\\"')
  })

  it('does not turn a script block into an element', async () => {
    const tree = await parseDocumentMarkdown('<script>alert(1)</script>')

    expect(tags(tree.nodes)).not.toContain('script')
  })

  it('refuses a javascript: URL as a link', async () => {
    const tree = await parseDocumentMarkdown('[click](javascript:alert(1))')

    expect(tags(tree.nodes)).not.toContain('a')
  })

  it('strips a URL whose protocol is not one of the three allowed', async () => {
    const tree = await parseDocumentMarkdown('[fetch](ftp://example.com/file)')

    expect(tags(tree.nodes)).toContain('a')
    expect(json(tree.nodes)).not.toContain('ftp://')
  })

  it('keeps an ordinary link and a mailto: one', async () => {
    const tree = await parseDocumentMarkdown('[docs](https://example.com) and [us](mailto:a@example.com)')

    expect(json(tree.nodes)).toContain('https://example.com')
    expect(json(tree.nodes)).toContain('mailto:a@example.com')
  })

  it('drops an image, relative or remote', async () => {
    const tree = await parseDocumentMarkdown('![logo](/logo.png) and ![remote](https://example.com/logo.png)')

    expect(tags(tree.nodes)).not.toContain('img')
  })

  it('ignores component syntax instead of resolving a component', async () => {
    const tree = await parseDocumentMarkdown('::alert{type="info"}\nHello\n::')

    expect(tags(tree.nodes)).not.toContain('alert')
  })
})

describe('line breaks', () => {
  it('keeps a single newline as a break, so an address block survives', async () => {
    const tree = await parseDocumentMarkdown('**Acme**\n1 Rue Example\n75000 Paris')

    expect(tags(tree.nodes)).toContain('br')
  })
})

describe('parsePasteMarkdown', () => {
  it('renders the markdown a note is written in', async () => {
    const tree = await parsePasteMarkdown('# Handover\n\n- **one**\n\n`SHHH_KEY`')

    expect(tags(tree.nodes)).toEqual(new Set(['h1', 'ul', 'li', 'strong', 'p', 'code']))
  })

  it('keeps tables, which a handover note uses as much as a policy does', async () => {
    const tree = await parsePasteMarkdown('| Host | Port |\n| --- | --- |\n| db | 5432 |')

    expect(tags(tree.nodes)).toContain('table')
  })

  it('makes a link unclickable while showing where it pointed', async () => {
    const tree = await parsePasteMarkdown('[docs](https://example.com)')

    expect(tags(tree.nodes)).not.toContain('a')
    expect(json(tree.nodes)).toContain('docs (https://example.com)')
  })

  // Dropping the element would take its text with it, which is how a URL used to disappear from the middle of a sentence.
  it('prints a bare URL once rather than twice, and never as a link', async () => {
    const tree = await parsePasteMarkdown('see https://example.com')

    expect(tags(tree.nodes)).not.toContain('a')
    expect(json(tree.nodes)).toContain('see ')
    expect(json(tree.nodes)).toContain('https://example.com')
    expect(json(tree.nodes)).not.toContain('https://example.com (https://example.com)')
  })

  it('keeps the label of a link whose protocol is refused', async () => {
    const tree = await parsePasteMarkdown('[fetch](ftp://example.com/file)')

    expect(json(tree.nodes)).toContain('fetch')
    expect(json(tree.nodes)).not.toContain('ftp://')
  })

  it('leaves a javascript: URL as inert text', async () => {
    const tree = await parsePasteMarkdown('[click](javascript:alert(1))')

    expect(tags(tree.nodes)).toEqual(new Set(['p']))
  })

  it('drops an image here too', async () => {
    const tree = await parsePasteMarkdown('![logo](https://example.com/logo.png)')

    expect(tags(tree.nodes)).not.toContain('img')
  })

  it('leaves raw HTML as text rather than turning it into markup', async () => {
    const tree = await parsePasteMarkdown('<img src=x onerror="alert(1)">')

    expect(tags(tree.nodes)).toEqual(new Set(['p']))
  })
})

describe('containsMarkdownImage', () => {
  it('spots an image, remote or relative', () => {
    expect(containsMarkdownImage('![logo](https://example.com/a.png)')).toBe(true)
    expect(containsMarkdownImage('text\n\n![](/a.png)')).toBe(true)
  })

  it('does not mistake a link for one', () => {
    expect(containsMarkdownImage('[docs](https://example.com)')).toBe(false)
  })

  it('says nothing about markdown that has no image', () => {
    expect(containsMarkdownImage('# Title\n\n- a **bold** item')).toBe(false)
  })
})
