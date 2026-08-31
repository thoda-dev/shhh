import { describe, expect, it } from 'vitest'
import en from '../i18n/locales/en.json'
import fr from '../i18n/locales/fr.json'

type Messages = { [key: string]: string | Messages }

function flatten(messages: Messages, prefix = ''): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [[path, value] as [string, string]] : flatten(value, path)
  })
}

const entries = { en: flatten(en as Messages), fr: flatten(fr as Messages) }

describe.each(['en', 'fr'] as const)('%s messages', (locale) => {
  it('escapes every "@", which vue-i18n compiles as a linked message', () => {
    const unescaped = entries[locale].filter(([, value]) => /(?<!\{')@/.test(value))

    expect(unescaped).toEqual([])
  })
})

it('translates the same keys in both languages', () => {
  expect(entries.fr.map(([key]) => key).sort()).toEqual(entries.en.map(([key]) => key).sort())
})

it('gives every duration unit both of its forms, in both languages', () => {
  const units = ['hours', 'days', 'months', 'years']
  const expected = units.flatMap(unit => [`admin.legal.template.units.${unit}.one`, `admin.legal.template.units.${unit}.other`])

  for (const locale of ['en', 'fr'] as const) {
    const keys = entries[locale].map(([key]) => key)
    expect(expected.filter(key => !keys.includes(key))).toEqual([])
  }
})
