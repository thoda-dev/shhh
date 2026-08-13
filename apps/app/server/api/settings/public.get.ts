// Public on purpose: the creation form, the (future) sign-up page and the 2FA guard all need these
// flags before a session exists. None of them is a secret — each one only describes what the
// instance allows, which is already observable by attempting the corresponding action.
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
    // Not an app_setting — derived from MAIL_PROVIDER (env only, section 9). The creation form needs
    // it to decide whether to offer email sharing at all; the provider's identity stays server-side.
    mailEnabled: isMailEnabled(),
    maxEmailRecipients: settings.max_email_recipients_per_paste
  }
})
