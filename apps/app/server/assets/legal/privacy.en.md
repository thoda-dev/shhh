# Privacy policy

_Last updated: {{DATE}}_

This instance of [shhh](https://github.com/thoda-dev/shhh) is operated by **{{OPERATOR}}**, who is the data controller for everything described below. Questions about this policy, or a request concerning your data, go to **{{CONTACT_EMAIL}}**.

Review every paragraph before publishing: the sections below describe what the software does by default, but retention, third parties and contact details are yours to fill in.

## What we cannot see

The contents of a paste are encrypted in your browser before they are sent. The key travels in the part of the link that follows `#`, which browsers never transmit to a server. This instance stores ciphertext it has no way to read, and neither we nor anyone who compromises the server can recover a paste from the database alone.

Everything below is therefore about the data that surrounds a paste, not its contents.

## What we process

**When you create or read a paste, signed in or not**

- Your IP address, to apply rate limits and to block automated abuse.
- The size and type of the paste, its expiry, and how many times it has been read.
- A challenge from Cloudflare Turnstile, which tells us a request came from a browser rather than a script. Turnstile sees your IP address and some properties of your browser. Cloudflare acts as our processor and may process this outside the {{JURISDICTION}}.

**If you hold an account**

- Your name, email address, and a hash of your password — never the password itself.
- Your sessions, each recorded with the IP address and browser that opened it, so you can recognise and revoke them.
- Two-factor secrets and backup codes, if you enable two-factor authentication.
- The pastes you own, so they appear in your dashboard.

**If a paste is shared by email**

- The recipient addresses, kept alongside the paste and deleted with it.

**If you are sent a link by email**

Your address was given to us by the person who sent you the paste, so that we could deliver their message. We do not use it for anything else, and it is deleted with the paste — at the latest {{RETENTION_MAX}} after it was created. You can ask us to delete it sooner at the address above.

**When an administrator acts**

- An audit entry naming the administrator, the action and its target.

## Why, and on what legal basis

- Delivering the service you asked for — creating, storing and serving pastes, running your account: performance of a contract.
- Keeping the instance available and unabused — rate limits, IP blocking, Turnstile, session records: our legitimate interest in the security of the service.
- Sending transactional email — address verification, password reset, a shared paste: performance of a contract, and the sender's own request where a paste is shared.

We do not profile you, we do not advertise, and we sell nothing.

## How long we keep it

| Data | Kept for |
| --- | --- |
| Pastes and their recipients | Until their expiry or last read, at most {{RETENTION_MAX}} |
| Sessions | {{SESSION_RETENTION}}, or until you sign out |
| Account data | Until you delete your account |
| Automatic IP bans | {{BAN_DURATION}} |
| Manual IP bans and allowlist entries | Until an administrator removes them |
| Administrative audit log | {{AUDIT_RETENTION}} |

Deleting your account deletes your pastes, sessions and two-factor secrets with it, in the same operation. You can do it yourself from your account page — nobody has to approve it.

## Who else is involved

- **{{HOSTING_PROVIDER}}** — hosts the server and the database.
- **Cloudflare** — anti-abuse challenge (Turnstile).
- **{{MAIL_PROVIDER}}** — delivers transactional email.

Nobody else receives your data, and it is not sold or shared for anyone's marketing.

## Cookies

This instance sets no advertising or analytics cookie, and nothing here tracks you across sites. What it does set is strictly necessary to work:

| Cookie | What it does | Lifetime |
| --- | --- | --- |
| Session cookie | Keeps you signed in | Until you sign out or it expires |
| `shhh_i18n_locale` | Remembers the language you picked | 1 year |
| `shhh_color_mode` | Remembers light or dark mode | 1 year |
| Cloudflare Turnstile | Distinguishes a browser from a script | Short-lived |

Because each is either required to deliver a service you asked for or required to keep it secure, no consent banner is shown. If that ever changes — if this instance adds audience measurement, say — this page changes with it.

## Your rights

You may ask for access to your data, its correction, its deletion, a copy of it in a portable form, a restriction of its processing, or object to processing based on our legitimate interest. Write to **{{CONTACT_EMAIL}}** and we will answer within one month.

If you believe we have handled your data badly, you may complain to {{SUPERVISORY_AUTHORITY}}.

## Changes

The date at the top of this page says when it was last changed. Substantial changes are announced {{CHANGE_NOTICE}}.
