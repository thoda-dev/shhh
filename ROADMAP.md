# Roadmap

Anything not listed here is either done or deliberately out of scope (see the bottom of this file).

## Before a public v1

- **An SVG icon.** The app and the documentation share a `favicon.ico`, an apple-touch icon and a
  1200×630 share image, and the app carries a localised `<title>`, description and Open Graph tags.
  What is missing is a vector icon: modern browsers prefer one for a tab that stays crisp at any
  scale and adapts to dark mode. It cannot be derived from the raster mark — it has to be drawn.

  The share image is the square mark padded onto a flat background. Readable, but it says nothing;
  a version carrying the tagline would earn its place on a link far better.

  The mail templates have no header image, which is deliberate: an image in an email means either an
  external URL that tells the sender the message was opened, or a base64 payload in every message.

- **Integration tests.** The harness exists — `pnpm test:integration`, see
  [CONTRIBUTING.md](CONTRIBUTING.md) — and two of the seven suites are written. What it cost to get
  here: v1.1.0 and v1.1.1 could not complete their setup wizard at all, because bumping Better Auth
  to 1.7 needed a new `issuer` column on `accounts` and nothing noticed. Lint, types, 86 unit tests,
  both builds and both Docker images all pass without a single request ever reaching `signUpEmail`.
  The remaining paths, in the order a silent regression would cost most:
  1. ~~**Sign-up and the setup wizard**~~ — done, `tests/integration/setup-wizard.test.ts`.
  2. **The read counter under concurrency** — fire many simultaneous reveals at a one-read paste and
     assert exactly one succeeds. This is the test that guards the atomic
     `UPDATE … WHERE read_count < max_reads RETURNING`, and now also that a caller without the
     unlock hash moves nothing.
  3. ~~**The permission matrix**~~ — done, `tests/integration/permissions.test.ts`.
  4. **Invitations** — single use including two concurrent accepts, address fixed by the invitation
     rather than the request body, role always `user`, registration bypass.
  5. **Anonymous restrictions** — no uploads, no server-side sharing, `public_paste_enabled` off.
  6. **Settings semantics** — an absent row means the default, a row holding `null` means unlimited.
  7. **Account deletion** — full cascade, audit log anonymised rather than deleted.

  Invitations and account deletion need a mail provider, which the harness deliberately runs without:
  sign-up would then wait on a verification click. They need a second server configuration, or a
  provider stub. Assert on `paste_email_recipients` rows rather than on delivered mail, to avoid
  depending on a mail server in CI.

## Waiting on upstream

- **Rich text editing and markdown rendering.** Pastes are plain text today. Nuxt UI's `UEditor`
  handles both editing and read-only rendering, so the two arrive together rather than shipping a
  separate renderer first — waiting on the component to stabilise (open bugs in v4.x around external
  `modelValue` breaking markdown rendering, plugin conflicts, no table support).

## Later

1. **Outgoing webhooks** — notify on key events (paste created, paste read), disabled by default.
2. **Public API with tokens** — create and manage pastes programmatically. Needs a token scope system
   (read-only vs write, granularity per paste).
3. **MCP server** on top of the public API (depends on 2), letting an MCP client create and read
   secrets. **Security note for whoever implements it:** token scopes must be tight enough that an
   agent cannot accidentally spill secrets into a conversation.
4. **Data export** (GDPR portability, art. 20) — not required for v1, worth having.
5. **Cumulative user statistics** — `total_pastes_created` / `total_reads_generated` alongside the
   current active counters.

## Deliberately out of scope

These were evaluated and rejected. Reopening them needs a new reason, not a reminder.

- **Multi-tenancy / organisations with team-shared secrets**, Vault or Infisical style. shhh is a
  pastebin with counters, not a team secret manager. A server-side KMS mode was designed and dropped:
  it breaks zero-knowledge and balloons the scope.
- **Mandatory 2FA by default**, super admin included. It stays opt-in so that evaluating a
  self-hosted instance isn't a chore. Instance-wide enforcement exists as a setting, off by default.
- **Bun as the primary runtime.** Too many documented edge cases with Nuxt 4 (dev memory leak with
  `compatibilityVersion: 4`, socket errors on some versions, crossws conflicts). Stability wins for
  something third parties deploy. Worth revisiting later.
- **Tracking or management links for anonymous pastes.** The anonymous tier stays minimal on purpose:
  no account, no follow-up. Counters are a feature of the authenticated tier.
- **A global write circuit breaker** and **any CAPTCHA beyond Turnstile.** The existing layers are
  enough at the scale this targets.
- **Browser end-to-end tests (Playwright).** The encryption is covered by unit tests and the API
  will be covered by integration tests; what would remain browser-specific is small — that the
  fragment never leaves the client, and that revealing requires a click. Not worth the heaviest
  tooling in the stack for that margin. Reconsider if the interface grows substantially.
- **Per-account email volume throttling.** Sharing sends a single message with recipients in blind
  copy, so there is no volume to throttle. It would only make sense alongside a return to one message
  per recipient.
