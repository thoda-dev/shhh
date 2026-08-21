// Public on purpose: the creation form and the 2FA guard need these flags before a session exists, and each only describes what the instance allows — already observable by attempting the action.
export default defineEventHandler(async () => {
  const settings = await getSettings([
    'public_paste_enabled',
    'registration_enabled',
    'require_2fa',
    'max_email_recipients_per_paste',
    'max_retention_days_anonymous',
    'max_retention_days_authenticated',
    'max_reads_anonymous',
    'max_reads_authenticated'
  ])

  return {
    publicPasteEnabled: settings.public_paste_enabled,
    registrationEnabled: settings.registration_enabled,
    require2fa: settings.require_2fa,
    // Not an app_setting — derived from MAIL_PROVIDER. The form needs the flag; the provider's identity stays server-side.
    mailEnabled: isMailEnabled(),
    maxEmailRecipients: settings.max_email_recipients_per_paste,
    // The creation form needs the caps to prefill its fields and to stop offering "unlimited" where
    // the instance refuses it. No secret either: a caller discovers the same numbers by tripping the
    // 400 they produce. `null` means unlimited.
    limits: {
      anonymous: {
        maxRetentionDays: settings.max_retention_days_anonymous,
        maxReads: settings.max_reads_anonymous
      },
      authenticated: {
        maxRetentionDays: settings.max_retention_days_authenticated,
        maxReads: settings.max_reads_authenticated
      }
    }
  }
})
