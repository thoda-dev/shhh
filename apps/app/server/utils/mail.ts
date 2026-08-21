import nodemailer, { type Transporter } from 'nodemailer'

export interface MailMessage {
  to: string
  /** Blind copies. One message for every recipient at once: they never learn about one another, and there is no send loop to throttle. */
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
 * Provider and credentials come from the environment, never `app_settings`: no credential in the database.
 * Switching provider is a redeploy, not a runtime toggle from the dashboard.
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
 * Explicit no-op driver — running without mail is a supported configuration, not an error state.
 * Callers ask `isMailEnabled()` rather than catching.
 */
class NoneDriver implements MailDriver {
  async send() {}
}

/**
 * Resend over its REST API rather than the npm package: one POST isn't worth another dependency.
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
      // Local relays often take no credentials at all; `auth: { user: undefined }` would make nodemailer attempt AUTH and fail.
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
 * Reports success as a boolean rather than throwing: a bounced recipient must not roll back an account creation.
 * The error is logged, the address is not, to keep mail logs free of PII.
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
