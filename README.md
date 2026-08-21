# shhh

[![CI](https://github.com/thoda-dev/shhh/actions/workflows/ci.yml/badge.svg)](https://github.com/thoda-dev/shhh/actions/workflows/ci.yml)
[![Docker Hub](https://img.shields.io/docker/v/thodadev/shhh?sort=semver&logo=docker&label=docker)](https://hub.docker.com/r/thodadev/shhh)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Say it once. We'll forget.

**[Try the demo](https://shhh.thoda.dev)** · **[Documentation](https://shhh-docs.thoda.dev)**

The demo is a public instance with short retention and tight limits, reset without warning. Don't
put anything in it you would mind losing.

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

No checkout — the image is published on [Docker Hub](https://hub.docker.com/r/thodadev/shhh).
The installer fetches the compose file, generates the database password and the auth secret, writes
a `.env` with mode 600, and starts the stack.

```bash
mkdir shhh && cd shhh
curl -fsSLO https://raw.githubusercontent.com/thoda-dev/shhh/master/install.sh
less install.sh && sh install.sh
```

It asks for the public URL, whether to use the bundled PostgreSQL, and the Turnstile keys. Answer
yes on the database and there is nothing to fill in — the password is generated and written to both
the variable that initialises the cluster and the one the app connects with. Answer no and it asks
for your connection string, then writes a compose override that removes the bundled service so it
is neither started nor waited on.

Set `BETTER_AUTH_URL`, `SHHH_BUNDLED_DB`, `DATABASE_URL`, `TURNSTILE_SITE_KEY`,
`TURNSTILE_SECRET_KEY` and `SHHH_START` in the environment and it asks nothing, which is what makes
it usable from cloud-init or Ansible. It refuses to run where a `.env` already exists, rather than
regenerating secrets that would sign everyone out and orphan the database volume.

Or do it by hand — two files, no script:

```bash
curl -O https://raw.githubusercontent.com/thoda-dev/shhh/master/docker/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/thoda-dev/shhh/master/.env.example
# Fill in BETTER_AUTH_SECRET (openssl rand -base64 32), BETTER_AUTH_URL and the Turnstile keys
docker compose up -d
```

Open your instance and the setup wizard will walk you through creating the super admin account and
the initial limits. Migrations are applied automatically on every boot.

### Using an existing PostgreSQL

`install.sh` handles this — answer no when it asks about the bundled database. By hand: point
`DATABASE_URL` at your server and drop the bundled service with a `docker-compose.override.yml`
next to the compose file, so upgrades keep replacing the published file cleanly.

```yaml
services:
  app:
    depends_on: !reset null
  db: !reset null
```

Nothing else changes — the app only ever reaches the database through that one variable.

### Behind a reverse proxy

Terminate TLS at your proxy and set `BETTER_AUTH_URL` to the public HTTPS address. Set
`TRUSTED_PROXY_DEPTH` to the number of proxies you control in front of the app — `1` behind a single
nginx or Caddy, `2` with Cloudflare in front of that. It defaults to `0`, which ignores
`X-Forwarded-For` and uses the connection address.

A worked nginx config, including the `client_max_body_size` that file uploads need, is in the
[deployment docs](apps/docs/content/2.self-hosting/1.installation.md).

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

Checks, all runnable without a database:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm test` runs the unit suite (Vitest). Integration tests are on the [roadmap](ROADMAP.md).

`pnpm dev` and `pnpm build` route through [scripts/nuxt.mjs](scripts/nuxt.mjs), which wraps the
command in `infisical run` when a `.infisical.json` is present, and runs Nuxt directly otherwise.

That wrapper is entirely optional — the `.env` above is the default path and nothing in the project
depends on it. It exists because keeping development secrets in a vault rather than in a plaintext
file on disk is a habit worth having, and [Infisical](https://infisical.com)
([source](https://github.com/Infisical/infisical)) is what this project uses for it: `infisical
login` then `infisical init` writes the `.infisical.json` that turns the wrapper on. That file is
per-developer and gitignored, so a fresh checkout never inherits somebody else's workspace.

```
apps/app     Nuxt 4 application (frontend + Nitro server)
apps/docs    Docus documentation site
docker       Dockerfile and docker-compose
scripts      Dev tooling wrappers
```

Health check for monitoring: `GET /api/health` reports whether the instance and its database are up
— point Uptime Kuma at it. Storage usage and the mail provider sit behind `HEALTH_TOKEN`.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md), which covers the checks to run
and how AI-assisted changes are handled.

## Security

The threat model, its boundaries, and the one place the decryption key deliberately reaches the
server (email sharing at creation time) are documented in [SECURITY.md](SECURITY.md).

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Licence

[MIT](LICENSE).
