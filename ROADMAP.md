# Roadmap

Anything not listed here is either done or deliberately out of scope (see the bottom of this file).

## Before a public v1

- **A logo, and a favicon that isn't Nuxt's.** `apps/app/public/favicon.ico` is still the scaffold
  default, so every instance currently ships with the Nuxt logo in the browser tab. Needs a mark
  first, then the derived assets: `.ico` and an SVG for the tab, an apple-touch icon, and the same
  mark reused in the Docus site and in the mail templates' header. While in there, the app sets no
  `<title>` and no Open Graph tags at all — the same pass should give it both.

- **Integration tests.** Unit tests cover the pure logic (see below), but nothing exercises the
  routes. The paths where a silent regression would cost most, in order:
  1. **The read counter under concurrency** — fire many simultaneous reveals at a one-read paste and
     assert exactly one succeeds. This is the test that guards the atomic
     `UPDATE … WHERE read_count < max_reads RETURNING`.
  2. **The permission matrix** — the table in the security docs, case by case.
  3. **Invitations** — single use including two concurrent accepts, address fixed by the invitation
     rather than the request body, role always `user`, registration bypass.
  4. **Anonymous restrictions** — no uploads, no server-side sharing, `public_paste_enabled` off.
  5. **Settings semantics** — an absent row means the default, a row holding `null` means unlimited.
  6. **Account deletion** — full cascade, audit log anonymised rather than deleted.

  Needs Vitest with `@nuxt/test-utils` and a real PostgreSQL (a service container in CI), with
  tables truncated between tests. Turnstile is bypassed with Cloudflare's always-valid test keys.
  Assert on `paste_email_recipients` rows rather than on delivered mail, to avoid depending on a
  mail server in CI.

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
