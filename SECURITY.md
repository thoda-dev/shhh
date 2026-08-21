# Security model

## What the server can and cannot see

Pastes are encrypted in the browser with AES-256-GCM before anything is sent. The key is generated
client-side and travels in the URL fragment (`#key=…`), which browsers never transmit. The server
stores ciphertext, an IV, and metadata (kind, size, expiry, read counter, whether a password is
required). It cannot decrypt a paste, and neither can anyone who obtains a database dump.

Optional password protection derives a second key with Argon2id (OWASP interactive parameters), using
the fragment key as the salt. Both the password and the fragment key are needed to reproduce it. The
server never receives the password and only records that one is required.

Filenames are encrypted alongside file contents. MIME types are stored in clear.

**Consequence to be aware of:** a wrong password still consumes a read. The server cannot verify a
password it never sees, so the failure only surfaces client-side when GCM authentication fails. This
is inherent to the design, not a bug, and the UI warns before you reveal.

## The one exception: email sharing

Sharing a paste by email is the single place where the decryption key reaches the server, and it is
worth being explicit about.

A usable link necessarily contains the fragment key. For the server to compose and send that email,
the browser has to hand it over. This happens:

- **only at creation time**, in the same request that creates the paste;
- **only for authenticated users**;
- **never for an existing paste** — no endpoint accepts a key for a paste that already exists, which
  is what bounds the exposure.

The key is held for the lifetime of that one request. It is written to no column and to no log. The
`paste_email_recipients` table records addresses and delivery status only.

If that tradeoff is unacceptable for your instance, don't use the feature: the "Share by email"
button on the result screen opens your own mail client with the link pre-filled and never involves
the server. It is available to everyone, signed in or not.

## Abuse protection

Independent layers, all active:

- Cloudflare Turnstile on paste creation, required for every tier including authenticated users — a
  stolen account is still a bot vector.
- Rate limiting on creation, per IP for anonymous users and per account for authenticated ones, with
  a stricter separate cap for uploads.
- Instance-wide quotas on total pastes and total stored bytes.
- Size validation server-side, never trusting client-declared sizes.
- Automatic banning of IPs requesting known probe paths (`wp-admin`, `.git`, …) or identified as
  untrusted bots, with an admin-managed allowlist and blocklist.
- Atomic decrement of the read counter, so concurrent requests cannot over-read a one-read link.
- A Content-Security-Policy restricting outbound requests to the instance itself and Turnstile. It
  is the layer that matters most here: an XSS in a zero-knowledge app does not leak a session, it
  leaks the decryption key of every paste opened while it runs. The policy still allows inline
  script, so it contains exfiltration rather than preventing injection.
- `Referrer-Policy: no-referrer`, so the paste id in the path never travels to a third party, plus
  `X-Frame-Options`, `X-Content-Type-Options`, `Cross-Origin-Opener-Policy` and `Permissions-Policy`.

## Deployment requirements

- **Set `TRUSTED_PROXY_DEPTH` to the number of proxies you control.** It defaults to `0`, which
  ignores `X-Forwarded-For` and uses the connection address. Setting it higher than your real chain
  lets a caller write their own address into the header, and with it get another address banned.
- **Serve over HTTPS.** The fragment key is in the URL. Without TLS it is exposed in transit.
- **Set a strong `BETTER_AUTH_SECRET`** and keep it stable — changing it invalidates all sessions.
- Secrets are only ever read from the environment. Nothing sensitive is stored in the database, so
  the admin dashboard cannot leak a credential.

## Known limits

- **Anyone with the full link can read the paste.** That is the point, and it means the link should
  be treated as the secret itself.
- **No protection against a malicious server operator** beyond the zero-knowledge design itself. A
  modified server could serve altered JavaScript that exfiltrates keys. Self-hosting is the answer:
  run the instance you trust.
- **The super admin account cannot be deleted**, including by itself. It is a system account and is
  deliberately outside the individual right to erasure. Transfer the role first if you need to
  remove that account.
- **Encryption at rest is the operator's job.** The database holds ciphertext rather than plaintext,
  but shhh adds no layer of its own on top: use full-disk or volume encryption on the host running
  PostgreSQL if your threat model needs it.

## Dependency audit

`pnpm audit` reports findings against this repository that do not reach a running instance. They come
from the Nuxt build toolchain — Vite, PostCSS, esbuild and friends — which is a production dependency
of the workspace but never ships: Nitro bundles only what the server imports, and the Docker image
copies `.output` alone. The runtime image carries no package manager either, which is why it scans
clean.

The distinction that matters when triaging one of these: a finding in the build chain affects the
machine doing the build, a finding in the server output affects deployed instances. The second kind
is treated as a vulnerability in shhh and gets a release; the first is fixed on the normal upgrade
cycle.

Dependabot is set to alert only. There are deliberately no automated dependency pull requests.

## Reporting a vulnerability

Open a private security advisory on the repository rather than a public issue.

Include a reproducible proof of concept — the affected endpoint, the request, and what you got back.
A report that only describes a plausible-sounding weakness cannot be triaged and will be closed. If
you used an AI tool to find or write up the issue, say so; it is not held against you, but an
unverified model claim reviewed as though it were a confirmed finding wastes everyone's time.
