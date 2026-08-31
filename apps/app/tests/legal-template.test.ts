import { describe, expect, it } from 'vitest'
import { extractLegalPlaceholders, fillLegalTemplate, parseDurationAmount } from '../shared/utils/legal-template'

describe('extractLegalPlaceholders', () => {
  it('lists each placeholder once, in order of appearance', () => {
    expect(extractLegalPlaceholders('{{B}} then {{A}} then {{B}}')).toEqual(['B', 'A'])
  })
})

describe('fillLegalTemplate', () => {
  it('substitutes a filled value', () => {
    expect(fillLegalTemplate('Run by {{OPERATOR}}.', { OPERATOR: 'Acme' })).toBe('Run by Acme.')
  })

  it('keeps the placeholder when the value is blank', () => {
    expect(fillLegalTemplate('Run by {{OPERATOR}}.', { OPERATOR: '   ' })).toBe('Run by {{OPERATOR}}.')
  })

  it('drops the line of a removed placeholder', () => {
    const filled = fillLegalTemplate('**{{OPERATOR}}**\n{{POSTAL_ADDRESS}}\n{{CONTACT_EMAIL}}', { OPERATOR: 'Acme' }, ['POSTAL_ADDRESS'])

    expect(filled).toBe('**Acme**\n{{CONTACT_EMAIL}}')
  })

  it('keeps a line where another placeholder survives, without its dangling separator', () => {
    const filled = fillLegalTemplate('{{CONTACT_EMAIL}} · {{PHONE}}', {}, ['PHONE'])

    expect(filled).toBe('{{CONTACT_EMAIL}}')
  })

  it('keeps a line where a filled value survives', () => {
    const filled = fillLegalTemplate('{{CONTACT_EMAIL}} · {{PHONE}}', { CONTACT_EMAIL: 'a@example.com' }, ['PHONE'])

    expect(filled).toBe('a@example.com')
  })

  it('takes the whole bullet when its only placeholder is removed', () => {
    const filled = fillLegalTemplate('- **{{HOSTING_PROVIDER}}** — hosts the server.\n- **Cloudflare** — Turnstile.', {}, ['HOSTING_PROVIDER'])

    expect(filled).toBe('- **Cloudflare** — Turnstile.')
  })

  it('leaves a line that has no removed placeholder alone', () => {
    const source = '| Sessions | {{SESSION_RETENTION}} |'

    expect(fillLegalTemplate(source, {}, ['PHONE'])).toBe(source)
  })

  it('does not leave a run of blank lines behind a removed paragraph', () => {
    const filled = fillLegalTemplate('One\n\n{{PHONE}}\n\nTwo', {}, ['PHONE'])

    expect(filled).toBe('One\n\nTwo')
  })

  it('fills the shipped notice template without leaving an empty address line', () => {
    const template = '**{{OPERATOR}}**\n{{POSTAL_ADDRESS}}\n{{CONTACT_EMAIL}} · {{PHONE}}'
    const filled = fillLegalTemplate(template, { OPERATOR: 'Acme', CONTACT_EMAIL: 'a@example.com' }, ['POSTAL_ADDRESS', 'PHONE'])

    expect(filled).toBe('**Acme**\na@example.com')
  })
})

describe('parseDurationAmount', () => {
  // A number input yields a number, and an emptied one yields neither a number nor a string.
  it.each([
    [30, 30],
    ['30', 30],
    [' 30 ', 30],
    ['', null],
    [undefined, null],
    [null, null],
    [0, null],
    [-5, null],
    ['abc', null]
  ])('reads %p as %p', (input, expected) => {
    expect(parseDurationAmount(input)).toBe(expected)
  })
})
