import { describe, expect, it } from 'vitest'
import {
  changeEmailTemplate,
  invitationTemplate,
  resetPasswordTemplate,
  sharedPasteTemplate,
  verifyEmailTemplate
} from '../server/utils/mail-templates'

const URL_ = 'https://shhh.example.com/p/abc#key=xyz'

const ALL = [
  ['verifyEmail', verifyEmailTemplate({ url: URL_ })],
  ['resetPassword', resetPasswordTemplate({ url: URL_ })],
  ['changeEmail', changeEmailTemplate({ url: URL_, newEmail: 'new@example.com' })],
  ['invitation', invitationTemplate({ url: URL_, expiresInDays: 7 })],
  ['sharedPaste', sharedPasteTemplate({ url: URL_, senderName: 'Alice', remainingReads: 2, expiresAt: new Date('2030-01-01T00:00:00Z') })]
] as const

describe('every template', () => {
  it.each(ALL)('%s produces a subject, HTML and a text fallback', (_name, mail) => {
    // The text part is mandatory: an empty one ships a blank email to any client that prefers text.
    expect(mail.subject.trim()).not.toBe('')
    expect(mail.html).toContain('<!doctype html>')
    expect(mail.text.trim()).not.toBe('')
  })

  it.each(ALL)('%s puts the link in both parts', (_name, mail) => {
    expect(mail.html).toContain(URL_)
    expect(mail.text).toContain(URL_)
  })

  it.each(ALL)('%s keeps the text part free of markup', (_name, mail) => {
    expect(mail.text).not.toMatch(/<[a-z]/i)
  })
})

describe('HTML escaping', () => {
  it('escapes a hostile sender name', () => {
    // The sender name is chosen by a user and lands in an email another person opens.
    const mail = sharedPasteTemplate({
      url: URL_,
      senderName: '<script>alert(1)</script>',
      remainingReads: null,
      expiresAt: new Date('2030-01-01T00:00:00Z')
    })
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('escapes a hostile URL, including in the href attribute', () => {
    const mail = verifyEmailTemplate({ url: 'https://x.test/"><script>alert(1)</script>' })
    expect(mail.html).not.toContain('"><script>')
    expect(mail.html).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('escapes an email address supplied by the caller', () => {
    const mail = changeEmailTemplate({ url: URL_, newEmail: '<b>x</b>@example.com' })
    expect(mail.html).not.toContain('<b>x</b>')
    expect(mail.html).toContain('&lt;b&gt;')
  })

  it('escapes ampersands so entities are not doubled or broken', () => {
    const mail = sharedPasteTemplate({
      url: URL_,
      senderName: 'A & B',
      remainingReads: null,
      expiresAt: new Date('2030-01-01T00:00:00Z')
    })
    expect(mail.html).toContain('A &amp; B')
  })
})

describe('shared paste wording', () => {
  const base = { url: URL_, senderName: 'Alice', expiresAt: new Date('2030-01-01T00:00:00Z') }

  it('says unlimited when there is no read cap', () => {
    const mail = sharedPasteTemplate({ ...base, remainingReads: null })
    expect(mail.text).toMatch(/unlimited/i)
  })

  it('uses the singular for a single remaining read', () => {
    const mail = sharedPasteTemplate({ ...base, remainingReads: 1 })
    expect(mail.text).toContain('1 more time')
    expect(mail.text).not.toContain('1 more times')
  })

  it('states that the counter is shared between recipients', () => {
    // Several people get this same link with one shared counter — saying so is the point.
    const mail = sharedPasteTemplate({ ...base, remainingReads: 3 })
    expect(mail.text).toContain('3 more times')
    expect(mail.text).toMatch(/shared between everyone/i)
  })

  it('warns that the link carries the key', () => {
    const mail = sharedPasteTemplate({ ...base, remainingReads: 3 })
    expect(mail.text).toMatch(/decryption key/i)
  })
})

describe('invitation wording', () => {
  it('states the expiry in days, singular and plural', () => {
    expect(invitationTemplate({ url: URL_, expiresInDays: 1 }).text).toContain('1 day.')
    expect(invitationTemplate({ url: URL_, expiresInDays: 7 }).text).toContain('7 days.')
  })

  it('says so when the invitation never expires', () => {
    expect(invitationTemplate({ url: URL_, expiresInDays: null }).text).toMatch(/does not expire/i)
  })
})

describe('change email', () => {
  it('names the new address so the current owner can recognise an unwanted change', () => {
    const mail = changeEmailTemplate({ url: URL_, newEmail: 'new@example.com' })
    expect(mail.text).toContain('new@example.com')
    expect(mail.text).toMatch(/if this was not you/i)
  })
})

describe('locales', () => {
  const FR = [
    ['verifyEmail', verifyEmailTemplate({ url: URL_, locale: 'fr' })],
    ['resetPassword', resetPasswordTemplate({ url: URL_, locale: 'fr' })],
    ['changeEmail', changeEmailTemplate({ url: URL_, newEmail: 'new@example.com', locale: 'fr' })],
    ['invitation', invitationTemplate({ url: URL_, expiresInDays: 7, locale: 'fr' })],
    ['sharedPaste', sharedPasteTemplate({ url: URL_, senderName: 'Alice', remainingReads: 2, expiresAt: new Date('2030-01-01T00:00:00Z'), locale: 'fr' })]
  ] as const

  it.each(FR)('%s is rendered in French', (_name, mail) => {
    expect(mail.subject.trim()).not.toBe('')
    expect(mail.html).toContain('lang="fr"')
    expect(mail.text.trim()).not.toBe('')
  })

  it.each(FR)('%s still carries the link in both parts', (_name, mail) => {
    expect(mail.html).toContain(URL_)
    expect(mail.text).toContain(URL_)
  })

  it.each(FR)('%s differs from its English counterpart', (name, mail) => {
    const english = ALL.find(([other]) => other === name)![1]
    expect(mail.subject).not.toBe(english.subject)
    expect(mail.text).not.toBe(english.text)
  })

  it('defaults to English when no locale is given', () => {
    expect(resetPasswordTemplate({ url: URL_ }).subject).toBe(resetPasswordTemplate({ url: URL_, locale: 'en' }).subject)
    expect(verifyEmailTemplate({ url: URL_ }).html).toContain('lang="en"')
  })

  it('translates the invitation expiry, including the never-expires case', () => {
    expect(invitationTemplate({ url: URL_, expiresInDays: 7, locale: 'fr' }).text).toContain('7 jours.')
    expect(invitationTemplate({ url: URL_, expiresInDays: 1, locale: 'fr' }).text).toContain('1 jour.')
    expect(invitationTemplate({ url: URL_, expiresInDays: null, locale: 'fr' }).text).toMatch(/n'expire pas/)
  })

  it('translates the shared-paste read counter', () => {
    const base = { url: URL_, senderName: 'Alice', expiresAt: new Date('2030-01-01T00:00:00Z'), locale: 'fr' } as const
    expect(sharedPasteTemplate({ ...base, remainingReads: null }).text).toMatch(/illimité/)
    expect(sharedPasteTemplate({ ...base, remainingReads: 3 }).text).toMatch(/compteur est partagé/)
  })

  it('renders the expiry date in the mail locale, always in UTC', () => {
    const base = { url: URL_, senderName: 'Alice', remainingReads: null, expiresAt: new Date('2030-03-01T14:30:00Z') } as const
    expect(sharedPasteTemplate({ ...base, locale: 'en' }).text).toContain('UTC')
    expect(sharedPasteTemplate({ ...base, locale: 'fr' }).text).toContain('UTC')
    expect(sharedPasteTemplate({ ...base, locale: 'fr' }).text).toContain('mars')
    expect(sharedPasteTemplate({ ...base, locale: 'en' }).text).toContain('March')
  })

  it('still escapes a hostile sender name in French', () => {
    const mail = sharedPasteTemplate({
      url: URL_,
      senderName: '<script>alert(1)</script>',
      remainingReads: null,
      expiresAt: new Date('2030-01-01T00:00:00Z'),
      locale: 'fr'
    })
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('keeps the French text part free of markup', () => {
    for (const [, mail] of FR) expect(mail.text).not.toMatch(/<[a-z]/i)
  })
})
