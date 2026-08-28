import { DEFAULT_MAIL_LOCALE, type MailLocale } from './mail-locale'

/**
 * One function per template returns `{ subject, html, text }` — a separate text generator would drift.
 * One minimal wrapper is shared by all mails, no per-template design.
 */
export interface RenderedMail {
  subject: string
  html: string
  text: string
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;'
}

// Everything interpolated here is user-controlled (display names, URLs, sender addresses), so it is escaped without exception.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ESCAPES[char]!)
}

// Always UTC: the recipient's timezone is unknown, and a naked local time would be read as their own.
function formatExpiry(locale: MailLocale, date: Date): string {
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC'
  }).format(date)
  return `${formatted} UTC`
}

interface Strings {
  footer: string
  linkFallback: string
  verifyEmail: { subject: string, intro: string, button: string, ignore: string }
  resetPassword: { subject: string, intro: string, button: string, ignore: string }
  changeEmail: { subject: string, intro: (newEmail: string) => string, button: string, ignore: string }
  invitation: { subject: string, intro: string, button: string, expiry: (days: number | null) => string }
  sharedPaste: {
    subject: (senderName: string) => string
    title: string
    intro: (senderName: string) => string
    button: string
    reads: (remaining: number | null) => string
    expiry: (expiresAt: Date) => string
    warning: string
  }
}

const STRINGS: Record<MailLocale, Strings> = {
  en: {
    footer: 'Say it once. We\'ll forget.',
    linkFallback: 'Or copy this link into your browser:',
    verifyEmail: {
      subject: 'Confirm your email address',
      intro: 'Confirm your email address to finish setting up your shhh account.',
      button: 'Confirm email address',
      ignore: 'If you did not create this account, you can ignore this email.'
    },
    resetPassword: {
      subject: 'Reset your password',
      intro: 'Someone requested a password reset for your shhh account. Use the link below to choose a new password.',
      button: 'Reset password',
      ignore: 'If this was not you, you can ignore this email — your password stays unchanged.'
    },
    changeEmail: {
      subject: 'Confirm your new email address',
      intro: newEmail => `A request was made to change the email address of your shhh account to ${newEmail}.`,
      button: 'Confirm the change',
      ignore: 'If this was not you, ignore this email and change your password — your address stays unchanged until this link is used.'
    },
    invitation: {
      subject: 'You have been invited to shhh',
      intro: 'You have been invited to create an account on this shhh instance.',
      button: 'Create your account',
      expiry: days => days === null
        ? 'This invitation does not expire.'
        : `This invitation expires in ${days} day${days === 1 ? '' : 's'}.`
    },
    sharedPaste: {
      subject: senderName => `${senderName} shared a secret with you`,
      title: 'A secret was shared with you',
      intro: senderName => `${senderName} shared an encrypted secret with you through shhh.`,
      button: 'Open the secret',
      reads: remaining => remaining === null
        ? 'It can be opened an unlimited number of times.'
        : `It can be opened ${remaining} more time${remaining === 1 ? '' : 's'} in total — that count is shared between everyone who received this link.`,
      expiry: expiresAt => `It expires on ${formatExpiry('en', expiresAt)}.`,
      warning: 'The link contains the decryption key in its fragment. Anyone holding the full link can read the secret, so treat it as the secret itself.'
    }
  },
  fr: {
    footer: 'Dites-le une fois. Nous l\'oublierons.',
    linkFallback: 'Ou copiez ce lien dans votre navigateur :',
    verifyEmail: {
      subject: 'Confirmez votre adresse email',
      intro: 'Confirmez votre adresse email pour terminer la création de votre compte shhh.',
      button: 'Confirmer mon adresse',
      ignore: 'Si vous n\'êtes pas à l\'origine de ce compte, vous pouvez ignorer cet email.'
    },
    resetPassword: {
      subject: 'Réinitialisez votre mot de passe',
      intro: 'Une réinitialisation de mot de passe a été demandée pour votre compte shhh. Utilisez le lien ci-dessous pour en choisir un nouveau.',
      button: 'Réinitialiser mon mot de passe',
      ignore: 'Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.'
    },
    changeEmail: {
      subject: 'Confirmez votre nouvelle adresse email',
      intro: newEmail => `Une demande de changement de l'adresse email de votre compte shhh vers ${newEmail} a été effectuée.`,
      button: 'Confirmer le changement',
      ignore: 'Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email et changez votre mot de passe — votre adresse reste inchangée tant que ce lien n\'est pas utilisé.'
    },
    invitation: {
      subject: 'Vous êtes invité sur shhh',
      intro: 'Vous avez été invité à créer un compte sur cette instance shhh.',
      button: 'Créer mon compte',
      expiry: days => days === null
        ? 'Cette invitation n\'expire pas.'
        : `Cette invitation expire dans ${days} jour${days === 1 ? '' : 's'}.`
    },
    sharedPaste: {
      subject: senderName => `${senderName} a partagé un secret avec vous`,
      title: 'Un secret a été partagé avec vous',
      intro: senderName => `${senderName} a partagé un secret chiffré avec vous via shhh.`,
      button: 'Ouvrir le secret',
      reads: remaining => remaining === null
        ? 'Il peut être ouvert un nombre illimité de fois.'
        : `Il peut encore être ouvert ${remaining} fois au total — ce compteur est partagé entre tous les destinataires de ce lien.`,
      expiry: expiresAt => `Il expire le ${formatExpiry('fr', expiresAt)}.`,
      warning: 'Le lien contient la clé de déchiffrement dans son fragment. Quiconque détient le lien complet peut lire le secret : traitez-le comme le secret lui-même.'
    }
  }
}

function stringsFor(locale: MailLocale | undefined): Strings {
  return STRINGS[locale ?? DEFAULT_MAIL_LOCALE] ?? STRINGS[DEFAULT_MAIL_LOCALE]
}

function layout(locale: MailLocale, strings: Strings, title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <p style="margin:0 0 24px;font-size:18px;font-weight:600;letter-spacing:-0.01em;">shhh</p>
      ${bodyHtml}
      <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e4e4e7;">
      <p style="margin:0;font-size:12px;color:#71717a;">${escapeHtml(strings.footer)}</p>
    </div>
  </body>
</html>`
}

function button(strings: Strings, url: string, label: string): string {
  return `<p style="margin:0 0 24px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;">${escapeHtml(label)}</a>
    </p>
    <p style="margin:0 0 8px;font-size:12px;color:#71717a;">${escapeHtml(strings.linkFallback)}</p>
    <p style="margin:0 0 24px;font-size:12px;color:#71717a;word-break:break-all;">${escapeHtml(url)}</p>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${escapeHtml(text)}</p>`
}

export function verifyEmailTemplate(params: { url: string, locale?: MailLocale }): RenderedMail {
  const locale = params.locale ?? DEFAULT_MAIL_LOCALE
  const strings = stringsFor(locale)
  const { subject, intro, button: label, ignore } = strings.verifyEmail

  return {
    subject,
    html: layout(locale, strings, subject, paragraph(intro) + button(strings, params.url, label) + paragraph(ignore)),
    text: `${intro}\n\n${params.url}\n\n${ignore}`
  }
}

export function resetPasswordTemplate(params: { url: string, locale?: MailLocale }): RenderedMail {
  const locale = params.locale ?? DEFAULT_MAIL_LOCALE
  const strings = stringsFor(locale)
  const { subject, intro, button: label, ignore } = strings.resetPassword

  return {
    subject,
    html: layout(locale, strings, subject, paragraph(intro) + button(strings, params.url, label) + paragraph(ignore)),
    text: `${intro}\n\n${params.url}\n\n${ignore}`
  }
}

export function changeEmailTemplate(params: { url: string, newEmail: string, locale?: MailLocale }): RenderedMail {
  const locale = params.locale ?? DEFAULT_MAIL_LOCALE
  const strings = stringsFor(locale)
  const { subject, button: label, ignore } = strings.changeEmail
  // Sent to the CURRENT address, not the new one: the existing owner has to approve, or notice and refuse, the move.
  const intro = strings.changeEmail.intro(params.newEmail)

  return {
    subject,
    html: layout(locale, strings, subject, paragraph(intro) + button(strings, params.url, label) + paragraph(ignore)),
    text: `${intro}\n\n${params.url}\n\n${ignore}`
  }
}

export function invitationTemplate(params: { url: string, expiresInDays: number | null, locale?: MailLocale }): RenderedMail {
  const locale = params.locale ?? DEFAULT_MAIL_LOCALE
  const strings = stringsFor(locale)
  const { subject, intro, button: label } = strings.invitation
  const expiry = strings.invitation.expiry(params.expiresInDays)

  return {
    subject,
    html: layout(locale, strings, subject, paragraph(intro) + button(strings, params.url, label) + paragraph(expiry)),
    text: `${intro}\n\n${params.url}\n\n${expiry}`
  }
}

export function sharedPasteTemplate(params: {
  url: string
  senderName: string
  remainingReads: number | null
  expiresAt: Date
  locale?: MailLocale
}): RenderedMail {
  const locale = params.locale ?? DEFAULT_MAIL_LOCALE
  const strings = stringsFor(locale)
  const { title, button: label, warning } = strings.sharedPaste
  const intro = strings.sharedPaste.intro(params.senderName)
  const expiry = strings.sharedPaste.expiry(params.expiresAt)
  // The counter belongs to the paste, not to each recipient — several people may hold this same link.
  const reads = strings.sharedPaste.reads(params.remainingReads)

  return {
    subject: strings.sharedPaste.subject(params.senderName),
    html: layout(
      locale,
      strings,
      title,
      paragraph(intro) + button(strings, params.url, label) + paragraph(reads) + paragraph(expiry) + paragraph(warning)
    ),
    text: `${intro}\n\n${params.url}\n\n${reads}\n${expiry}\n\n${warning}`
  }
}
