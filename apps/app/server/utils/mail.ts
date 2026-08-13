import nodemailer, { type Transporter } from 'nodemailer'

export interface MailMessage {
  to: string
  /**
   * Blind copies. Paste sharing sends a single message to every recipient at once rather than one
   * message each: recipients never learn about one another, and there is no send loop to throttle.
   */
  bcc?: string[]
  subject: string
  html: string
  text: string
}

export interface MailDriver {
  send(message: MailMessage): Promise<void>
}

export type MailProvider = 'resend' | 'smtp' | 'none'

/**
 * Provider and credentials live entirely in environment variables, never in `app_settings`
 * (project.md sections 5 and 9): nothing sensitive goes in the database, so switching provider is
 * a redeploy, not a runtime toggle from the admin dashboard.
 */
function readProvider(): MailProvider {
  const raw = (process.env.MAIL_PROVIDER ?? 'none').trim().toLowerCase()
  if (raw === 'resend' || raw === 'smtp' || raw === 'none') return raw
  throw new Error(`MAIL_PROVIDER must be one of 'resend' | 'smtp' | 'none', got '${raw}'`)
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required when MAIL_PROVIDER is '${readProvider()}'`)
  }
  return value
}

/**
 * The explicit no-op driver. Not an error state: an instance can legitimately run without any mail
 * at all (project.md section 9), which is why `requireEmailVerification` stays off and password
 * resets fall back to a manual admin action. Callers ask `isMailEnabled()` rather than catching.
 */
class NoneDriver implements MailDriver {
  async send() {}
}

/**
 * Resend over its REST API rather than the `resend` npm package — one POST to a documented
 * endpoint isn't worth another dependency in a project that deliberately runs pnpm's
 * supply-chain guards (minimumReleaseAge / blockExoticSubdeps, project.md section 2).
 */
class ResendDriver implements MailDriver {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(message: MailMessage) {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: {
        from: this.from,
        to: [message.to],
        ...(message.bcc?.length ? { bcc: message.bcc } : {}),
        subject: message.subject,
        html: message.html,
        text: message.text
      }
    })
  }
}

class SmtpDriver implements MailDriver {
  constructor(private readonly transporter: Transporter, private readonly from: string) {}

  async send(message: MailMessage) {
    // nodemailer builds the multipart/alternative itself from `html` + `text` — nothing to assemble.
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      ...(message.bcc?.length ? { bcc: message.bcc } : {}),
      subject: message.subject,
      html: message.html,
      text: message.text
    })
  }
}

function createDriver(provider: MailProvider): MailDriver {
  if (provider === 'none') return new NoneDriver()

  const from = requireEnv('MAIL_FROM')

  if (provider === 'resend') {
    return new ResendDriver(requireEnv('RESEND_API_KEY'), from)
  }

  const port = Number(process.env.MAIL_SMTP_PORT ?? 587)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`MAIL_SMTP_PORT must be a positive integer, got '${process.env.MAIL_SMTP_PORT}'`)
  }

  const user = process.env.MAIL_SMTP_USER
  const pass = process.env.MAIL_SMTP_PASS

  return new SmtpDriver(
    nodemailer.createTransport({
      host: requireEnv('MAIL_SMTP_HOST'),
      port,
      secure: process.env.MAIL_SMTP_SECURE === 'true',
      // Local relays (mailpit, MailHog, a company MTA) commonly take no credentials at all —
      // passing `auth: { user: undefined }` would make nodemailer attempt AUTH and fail.
      auth: user && pass ? { user, pass } : undefined
    }),
    from
  )
}

let cached: { provider: MailProvider, driver: MailDriver } | null = null

function resolve() {
  if (!cached) {
    const provider = readProvider()
    cached = { provider, driver: createDriver(provider) }
  }
  return cached
}

export function getMailProvider(): MailProvider {
  return resolve().provider
}

export function isMailEnabled(): boolean {
  return resolve().provider !== 'none'
}

/**
 * Sends and reports success as a boolean rather than throwing. Every caller so far (signup
 * verification, password reset, paste sharing) has to keep working when a single delivery fails —
 * a bounced recipient must not roll back an account creation or fail the whole share request.
 * The error is logged server-side; the address itself is not, to keep mail logs free of PII.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const { provider, driver } = resolve()
  if (provider === 'none') return false

  try {
    await driver.send(message)
    return true
  } catch (error) {
    console.error(`[mail] delivery failed via '${provider}':`, error instanceof Error ? error.message : error)
    return false
  }
}
