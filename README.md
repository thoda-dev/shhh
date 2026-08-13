# shhh

> Say it once. We'll forget.

A self-hostable, zero-knowledge pastebin for sharing secrets — text and files — that expire on their
own. The server stores ciphertext and nothing else: the decryption key lives in the URL fragment and
is never sent to it.

Built with Nuxt 4, PostgreSQL and Drizzle. Deploy it with two files and a `docker compose up`.

---

## Why another pastebin

Most "send me the password" moments end in a chat message that stays there forever. shhh is for the
other path: paste it, get a link, and have it disappear after a set number of reads or a deadline —
without trusting the server with the contents.

- **Zero-knowledge.** AES-256-GCM in the browser. The key travels in the URL fragment (`#key=…`),
  which browsers never send to the server. Optional password protection derives a second key layer
  with Argon2id, combined with the fragment key.
- **Expiry that actually expires.** Every paste has a deadline and, optionally, a maximum number of
  reads. The read counter is decremented atomically, so a one-read link really is read once.
- **Link previews don't burn your secret.** Reading is a two-step flow: metadata first, ciphertext
  only on an explicit click. Slack and antivirus scanners that follow the link don't consume it.
- **Yours to run.** Every limit — retention, sizes, quotas, rate limits, who may register — is
  configured from the admin dashboard, not baked into the code.

## What's in it

- Anonymous pastes (text) and authenticated pastes (text + file uploads)
- Optional password protection on top of the fragment key
- Two-factor authentication (TOTP) with backup codes, optionally enforced instance-wide
- Admin dashboard: settings, accounts and roles, invitations, IP allowlist and blocklist
- Invitations, so a closed instance can still onboard people
- Email sharing at creation time, one message with recipients in blind copy
- Cloudflare Turnstile, per-IP and per-account rate limiting, automatic probe banning
- Account deletion with full cascade (GDPR right to erasure)
- English and French

## Deploy

```bash
git clone https://github.com/<you>/shhh.git && cd shhh
cp .env.example .env
# Fill in BETTER_AUTH_SECRET (openssl rand -base64 32) and BETTER_AUTH_URL
docker compose -f docker/docker-compose.yml up -d
```

Open your instance and the setup wizard will walk you through creating the super admin account and
the initial limits. Migrations are applied automatically on every boot.

### Using an existing PostgreSQL

Point `DATABASE_URL` at your server, then drop the `db` service, its `depends_on` block and the
`db-data` volume from `docker/docker-compose.yml`. Nothing else changes — the app only ever reaches
the database through that one variable.

### Behind a reverse proxy

Terminate TLS at your proxy and set `BETTER_AUTH_URL` to the public HTTPS address. The proxy must
**overwrite** `X-Forwarded-For` rather than append to a client-supplied value — rate limiting and IP
banning both trust that header.

### Turnstile

Paste creation requires a valid [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
token for every tier, signed-in users included. Create a widget, set
`NUXT_PUBLIC_TURNSTILE_SITE_KEY` and `NUXT_TURNSTILE_SECRET_KEY`, and add your domain to the widget's
allowed hostnames — including `localhost` if you develop against it.

### Email

Optional. `MAIL_PROVIDER=none` is a supported configuration: the instance runs fine without mail, but
email verification, password reset links, invitations and email sharing are unavailable, and
resetting a password becomes a manual admin action. Set `resend` or `smtp` to enable them.

## Configuration

Secrets and infrastructure live in the environment (see [.env.example](.env.example)); everything
else lives in the database and is edited from `/admin/settings`:

| | |
|---|---|
| Retention | Max paste lifetime, anonymous and authenticated |
| Reads | Max decryptions per paste, per tier |
| Sizes | Max text size, max upload size |
| Quotas | Max total pastes and total stored bytes for the instance |
| Rate limits | Paste creation per IP and per account, stricter cap for uploads |
| Access | Public registration, anonymous pastes, enforced 2FA |
| Invitations | Expiry, max email recipients per paste |

Any numeric limit can be set to *unlimited*.

## Development

Requires Node 24 and pnpm 11 (`mise install` picks both up), plus a PostgreSQL database.

```bash
pnpm install
cp .env.example apps/app/.env   # DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
pnpm db:migrate
pnpm dev
```

`pnpm dev` and `pnpm build` route through [scripts/nuxt.mjs](scripts/nuxt.mjs), which injects secrets
via the Infisical CLI when it is installed and logged in, and runs Nuxt directly otherwise.

```
apps/app     Nuxt 4 application (frontend + Nitro server)
apps/docs    Docus documentation site
docker       Dockerfile and docker-compose
scripts      Dev tooling wrappers
```

Health check for monitoring: `GET /api/health` returns database status, mail provider and storage
usage — point Uptime Kuma at it.

## Security

The threat model, its boundaries, and the one place the decryption key deliberately reaches the
server (email sharing at creation time) are documented in [SECURITY.md](SECURITY.md).

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Licence

Not chosen yet. Until a `LICENSE` file lands, no permission to use, modify or redistribute this code
is granted — see [ROADMAP.md](ROADMAP.md).
