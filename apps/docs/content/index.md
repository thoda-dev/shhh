---
seo:
  title: shhh — self-hosted zero-knowledge pastebin
  description: Share secrets that expire on their own. The server stores ciphertext
    and nothing else — the decryption key lives in the URL fragment and never
    reaches it. Self-hostable with Docker in one command.
---

::u-page-hero
#title
Say it once. We'll forget.

#description
A self-hostable, zero-knowledge pastebin for sharing secrets — text and files — that expire on their own.

The server stores ciphertext and nothing else. The decryption key lives in the URL fragment, which browsers never send.

#links
  :::u-button
  ---
  color: neutral
  size: xl
  to: /getting-started/introduction
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

  :::u-button
  ---
  color: neutral
  icon: i-simple-icons-github
  size: xl
  to: https://github.com/thoda-dev/shhh
  variant: outline
  ---
  Source
  :::
::

::u-page-section
#title
Built for the "send me the password" moment

#features
  :::u-page-feature
  ---
  icon: i-lucide-lock-keyhole
  ---
  #title
  [Zero-knowledge]{.text-primary} by design

  #description
  AES-256-GCM in the browser. The key travels in the URL fragment, which is never transmitted. A database dump reveals nothing.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-timer
  ---
  #title
  Expiry that [actually expires]{.text-primary}

  #description
  Every paste has a deadline and, optionally, a maximum number of reads. The counter is decremented atomically — a one-read link really is read once.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-eye-off
  ---
  #title
  Link previews [don't burn it]{.text-primary}

  #description
  Reading is two steps: metadata first, ciphertext only on an explicit click. Chat unfurlers and antivirus scanners that follow the link don't consume it.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-sliders-horizontal
  ---
  #title
  [Every limit]{.text-primary} is yours

  #description
  Retention, sizes, quotas, rate limits, who may register — all configured from the admin dashboard, none baked into the code.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-container
  ---
  #title
  [One command]{.text-primary} to deploy

  #description
  Docker Compose with PostgreSQL included, migrations applied on boot, health endpoint ready for your monitoring.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-shield-check
  ---
  #title
  Abuse protection [that layers]{.text-primary}

  #description
  Turnstile, per-IP and per-account rate limits, instance quotas, automatic probe banning, optional enforced 2FA.
  :::
::
