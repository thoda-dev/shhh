// Public on purpose: the creation form and the 2FA guard need these flags before a session exists, and each only describes what the instance allows — already observable by attempting the action.
export default defineEventHandler(async () => {
  const settings = await getSettings([
    'public_paste_enabled',
    'registration_enabled',
    'require_2fa',
    'max_email_recipients_per_paste'
  ])

  return {
    publicPasteEnabled: settings.public_paste_enabled,
    registrationEnabled: settings.registration_enabled,
    require2fa: settings.require_2fa,
    // Not an app_setting — derived from MAIL_PROVIDER. The form needs the flag; the provider's identity stays server-side.
    mailEnabled: isMailEnabled(),
    maxEmailRecipients: settings.max_email_recipients_per_paste
  }
})
