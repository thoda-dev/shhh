import { createMarkdownParser } from 'comark'
import breaks from 'comark/plugins/breaks'
import security from 'comark/plugins/security'
import type { MarkdownDocument } from 'comark'

// Everything plain markdown can produce. No `img`: an instance has nowhere to host one.
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 's', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a'
]

// `registerDefaultPlugins: false` is the load-bearing line: it turns off raw HTML, component syntax and free-form attributes, any of which would put script on a page that holds decryption keys.
const parseMarkdown = createMarkdownParser({
  registerDefaultPlugins: false,
  plugins: [
    // A legal document is written by somebody who does not know that markdown eats single newlines, and an address block has to keep its lines.
    breaks(),
    security({
      allowedTags: ALLOWED_TAGS,
      allowedProtocols: ['http', 'https', 'mailto']
    })
  ]
})

export function parseLegalMarkdown(content: string): Promise<MarkdownDocument> {
  return parseMarkdown(content)
}
