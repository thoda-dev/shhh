/**
 * Every template returns `{ subject, html, text }` from a single function, on purpose: the plain
 * text part is mandatory (project.md section 9) and generating it separately is how the two halves
 * drift apart. One minimal wrapper is shared by all mails — no per-template design.
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

// Everything interpolated into these templates is user-controlled (display names, paste URLs,
// sender addresses), so it is escaped without exception.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ESCAPES[char]!)
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
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
      <p style="margin:0;font-size:12px;color:#71717a;">Say it once. We'll forget.</p>
    </div>
  </body>
</html>`
}

function button(url: string, label: string): string {
  return `<p style="margin:0 0 24px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;">${escapeHtml(label)}</a>
    </p>
    <p style="margin:0 0 8px;font-size:12px;color:#71717a;">Or copy this link into your browser:</p>
    <p style="margin:0 0 24px;font-size:12px;color:#71717a;word-break:break-all;">${escapeHtml(url)}</p>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${escapeHtml(text)}</p>`
}

export function verifyEmailTemplate(params: { url: string }): RenderedMail {
  const intro = 'Confirm your email address to finish setting up your shhh account.'
  const ignore = 'If you did not create this account, you can ignore this email.'

  return {
    subject: 'Confirm your email address',
    html: layout('Confirm your email address', paragraph(intro) + button(params.url, 'Confirm email address') + paragraph(ignore)),
    text: `${intro}\n\n${params.url}\n\n${ignore}`
  }
}

export function resetPasswordTemplate(params: { url: string }): RenderedMail {
  const intro = 'Someone requested a password reset for your shhh account. Use the link below to choose a new password.'
  const ignore = 'If this was not you, you can ignore this email — your password stays unchanged.'

  return {
    subject: 'Reset your password',
    html: layout('Reset your password', paragraph(intro) + button(params.url, 'Reset password') + paragraph(ignore)),
    text: `${intro}\n\n${params.url}\n\n${ignore}`
  }
}

export function invitationTemplate(params: { url: string, expiresInDays: number | null }): RenderedMail {
  const intro = 'You have been invited to create an account on this shhh instance.'
  const expiry = params.expiresInDays === null
    ? 'This invitation does not expire.'
    : `This invitation expires in ${params.expiresInDays} day${params.expiresInDays === 1 ? '' : 's'}.`

  return {
    subject: 'You have been invited to shhh',
    html: layout('You have been invited to shhh', paragraph(intro) + button(params.url, 'Create your account') + paragraph(expiry)),
    text: `${intro}\n\n${params.url}\n\n${expiry}`
  }
}

export function sharedPasteTemplate(params: { url: string, senderName: string, remainingReads: number | null, expiresAt: Date }): RenderedMail {
  const intro = `${params.senderName} shared an encrypted secret with you through shhh.`
  const expiry = `It expires on ${params.expiresAt.toUTCString()}.`
  // The read counter belongs to the paste, not to each recipient — worth stating plainly here
  // since several people may have received this same link (project.md section 9).
  const reads = params.remainingReads === null
    ? 'It can be opened an unlimited number of times.'
    : `It can be opened ${params.remainingReads} more time${params.remainingReads === 1 ? '' : 's'} in total — that count is shared between everyone who received this link.`
  const warning = 'The link contains the decryption key in its fragment. Anyone holding the full link can read the secret, so treat it as the secret itself.'

  return {
    subject: `${params.senderName} shared a secret with you`,
    html: layout(
      'A secret was shared with you',
      paragraph(intro) + button(params.url, 'Open the secret') + paragraph(reads) + paragraph(expiry) + paragraph(warning)
    ),
    text: `${intro}\n\n${params.url}\n\n${reads}\n${expiry}\n\n${warning}`
  }
}
