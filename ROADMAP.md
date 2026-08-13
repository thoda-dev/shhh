# Roadmap

Anything not listed here is either done or deliberately out of scope (see the bottom of this file).

## Before a public v1

- **Choose a licence.** No `LICENSE` file exists yet, so the code is currently all-rights-reserved by
  default despite being intended as open source. This blocks anyone from legitimately self-hosting it.
- **Documentation site.** `apps/docs` is still the untouched Docus template. English only, by design.
- **Rich text editing and markdown rendering.** Pastes are plain text today. Nuxt UI's `UEditor`
  handles both editing and read-only rendering, so the two arrive together rather than shipping a
  separate renderer first — waiting on the component to stabilise (open bugs in v4.x around external
  `modelValue` breaking markdown rendering, plugin conflicts, no table support).
- **Email change flow.** Better Auth exposes `change-email`; it needs the verification mail wired up.

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
- **Per-account email volume throttling.** Sharing sends a single message with recipients in blind
  copy, so there is no volume to throttle. It would only make sense alongside a return to one message
  per recipient.
