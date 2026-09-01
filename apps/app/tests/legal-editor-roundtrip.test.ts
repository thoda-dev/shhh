import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { MarkdownManager } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { parseLegalMarkdown } from '../shared/utils/legal-markdown'

// The same schema LegalEditor gives UEditor, driven without a DOM.
const manager = new MarkdownManager({ extensions: [StarterKit, TableKit] })
const roundTrip = (markdown: string) => manager.serialize(manager.parse(markdown.trim()))

const rendered = async (markdown: string) => JSON.stringify((await parseLegalMarkdown(markdown)).nodes)

const templates = readdirSync('server/assets/legal')

describe('editing a document through the WYSIWYG', () => {
  // Saving from the editor rewrites the markdown — emphasis switches to asterisks, table columns get
  // padded, underscores are escaped. None of it may change what a reader sees.
  it.each(templates)('leaves %s rendering identically', async (file) => {
    const source = readFileSync(`server/assets/legal/${file}`, 'utf8')

    expect(await rendered(roundTrip(source))).toBe(await rendered(source))
  })

  // One case per toolbar button, so adding one that cannot survive a save fails here first.
  it.each(Object.entries({
    bold: 'a **bold** word',
    italic: 'an *italic* word',
    strike: '~~superseded~~ text',
    inlineCode: 'set `MAIL_PROVIDER` to none',
    heading: '# One\n\n## Two\n\n### Three',
    bulletList: '- first\n- second',
    orderedList: '1. first\n2. second',
    blockquote: '> a quoted clause',
    codeBlock: '```\nSHHH_KEY=value\n```',
    link: '[docs](https://example.com)',
    horizontalRule: 'One\n\n---\n\nTwo',
    table: '| Data | Kept |\n| --- | --- |\n| Sessions | 30 days |'
  }))('survives %s', async (_name, source) => {
    expect(await rendered(roundTrip(source))).toBe(await rendered(source))
  })

  // The reason task lists are not on the toolbar: the checkbox is silently dropped on save.
  it('would lose a task list, which is why it is not offered', () => {
    expect(roundTrip('- [ ] unchecked')).not.toContain('[ ]')
  })

  it('does not invent raw HTML, which the public parser would print as text', () => {
    for (const file of templates) {
      expect(roundTrip(readFileSync(`server/assets/legal/${file}`, 'utf8'))).not.toMatch(/<[a-z]+>/i)
    }
  })
})
