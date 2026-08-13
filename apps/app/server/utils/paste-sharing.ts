/**
 * Sharing a paste by email happens **only at creation time**, inside `POST /api/pastes`, and only
 * for authenticated users — decided with Thomas.
 *
 * ⚠️ Zero-knowledge boundary (project.md sections 3 and 9). A usable link necessarily carries the
 * decryption key in its fragment, so the client has to hand that key to the server for it to compose
 * the mail. That is the one and only place where the key touches the server. It is therefore:
 *   - never persisted (no column holds it, `paste_email_recipients` stores addresses only),
 *   - never logged (the mail layer logs neither addresses nor bodies),
 *   - held for the lifetime of a single request and nothing more.
 * Restricting it to creation is what keeps that window minimal: there is no later endpoint that
 * accepts a key for an existing paste.
 *
 * One message goes out with every recipient in Bcc rather than one message per recipient: they never
 * learn about each other, and with a single send there is no volume to rate-limit. That is why the
 * per-period email settings were dropped from `app_settings` entirely rather than left in the admin
 * form doing nothing; `max_email_recipients_per_paste` survives as a cap on the size of that one
 * message. Reintroducing per-account email throttling would only make sense alongside a change back
 * to one message per recipient.
 */
export async function sharePasteByEmail(params: {
  pasteId: string
  fragmentKey: string
  recipients: string[]
  senderName: string
  senderEmail: string
  remainingReads: number | null
  expiresAt: Date
}): Promise<{ sent: boolean }> {
  // Built from BETTER_AUTH_URL, not from the request's Host header: that header is attacker-
  // controllable behind a proxy, and this URL goes out in an email. It is already required to exist
  // and already points at the public origin of the instance.
  const origin = process.env.BETTER_AUTH_URL!.replace(/\/+$/, '')
  const url = `${origin}/p/${params.pasteId}#key=${params.fragmentKey}`

  const mail = sharedPasteTemplate({
    url,
    senderName: params.senderName,
    remainingReads: params.remainingReads,
    expiresAt: params.expiresAt
  })

  // `to` is the sender, Bcc everyone else: recipients see who shared the secret with them (useful
  // context for a link they were not expecting) but never see one another, and no third-party
  // mailbox — the instance's own MAIL_FROM included — receives a copy it has no reason to hold.
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
