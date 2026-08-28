import type { MailLocale } from './mail-locale'

/**
 * ⚠️ The one place the decryption key reaches the server: a usable link carries it, so composing the mail needs it.
 * Only at creation, only for authenticated users, never for an existing paste — that is what bounds the exposure.
 * The key is never persisted and never logged; it lives for one request. `paste_email_recipients` holds addresses only.
 * One message with every recipient in Bcc: they never learn about each other, and a single send leaves nothing to throttle.
 */
export async function sharePasteByEmail(params: {
  pasteId: string
  fragmentKey: string
  recipients: string[]
  senderName: string
  senderEmail: string
  remainingReads: number | null
  expiresAt: Date
  locale: MailLocale
}): Promise<{ sent: boolean }> {
  // From BETTER_AUTH_URL, not the request's Host header: that header is attacker-controllable, and this URL goes out in an email.
  const origin = process.env.BETTER_AUTH_URL!.replace(/\/+$/, '')
  const url = `${origin}/p/${params.pasteId}#key=${params.fragmentKey}`

  const mail = sharedPasteTemplate({
    url,
    senderName: params.senderName,
    remainingReads: params.remainingReads,
    expiresAt: params.expiresAt,
    locale: params.locale
  })

  // `to` is the sender, Bcc everyone else: recipients see who shared the link but never one another, and no third-party mailbox gets a copy.
  const sent = await sendMail({
    to: params.senderEmail,
    bcc: params.recipients,
    ...mail
  })

  await db.insert(schema.pasteEmailRecipients).values(
    params.recipients.map(email => ({
      pasteId: params.pasteId,
      email,
      status: sent ? ('sent' as const) : ('failed' as const),
      sentAt: sent ? new Date() : null
    }))
  )

  return { sent }
}
