import { createMarkdownParser } from 'comark'
import breaks from 'comark/plugins/breaks'
import security from 'comark/plugins/security'
import type { MarkdownDocument, Node } from 'comark'

// Everything plain markdown can produce. `img` is out: nothing lets an author host one.
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 's', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
]

// `registerDefaultPlugins: false` is the load-bearing line: it turns off raw HTML, component syntax and free-form attributes, any of which would put script on a page that holds decryption keys.
function createParser(allowedTags: string[]) {
  return createMarkdownParser({
    registerDefaultPlugins: false,
    plugins: [
      // Whoever writes this does not know that markdown eats single newlines, and an address block has to keep its lines.
      breaks(),
      security({
        allowedTags,
        allowedProtocols: ['http', 'https', 'mailto']
      })
    ]
  })
}

// A legal document is written by the operator, so a clickable link is theirs to vouch for.
const parseDocument = createParser([...ALLOWED_TAGS, 'a'])

// `a` is allowed through the parser and flattened afterwards rather than left out of the allowlist: the security plugin drops a disallowed element with everything inside it, so an unlisted `a` would take the link text with it and an autolinked URL would vanish from the middle of a sentence.
const parsePaste = createParser([...ALLOWED_TAGS, 'a'])

const text = (nodes: Node[]): string =>
  nodes.map(node => (typeof node === 'string' ? node : text(node.slice(2) as Node[]))).join('')

/**
 * Turns every link into the text it carried followed by where it pointed.
 *
 * A paste is written by anyone and read by someone who just opened a link they were sent, on the page holding the decryption key — a clickable link there is a phishing surface the plain-text view never had. Printing the URL instead loses nothing: the reader sees the destination, and can still copy it.
 */
function flattenLinks(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (typeof node === 'string' || node[0] === null) return node

    const children = flattenLinks(node.slice(2) as Node[])
    if (node[0] !== 'a') return [node[0], node[1], ...children] as Node

    const href = (node[1] as { href?: string } | undefined)?.href
    const label = text(children)
    // An autolinked URL is already its own label; a link whose protocol was refused has no href left.
    if (!href || label === href) return label || href || ''
    return `${label} (${href})`
  })
}

export function parseDocumentMarkdown(content: string): Promise<MarkdownDocument> {
  return parseDocument(content)
}

export async function parsePasteMarkdown(content: string): Promise<MarkdownDocument> {
  const document = await parsePaste(content)
  return { ...document, nodes: flattenLinks(document.nodes) }
}

// The inline form is the only one worth catching: a reference image whose definition is missing renders as text anyway. Matching the source rather than the tree is deliberate — by the time the parser has run, the image is already gone.
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(/

export function containsMarkdownImage(content: string): boolean {
  return MARKDOWN_IMAGE.test(content)
}
