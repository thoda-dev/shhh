# Changelog

Notable changes per release. Versions follow [semver](https://semver.org); the Docker tag ladder is
described in [scripts/release.mjs](scripts/release.mjs).

## Unreleased

### Added
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and pull request templates.
- CI check requiring every pull request to close an issue.
- `Disallow: /p/` in robots.txt — paste pages are useless to a crawler and a request still burns a read.

### Changed
- `scripts/infisical.mjs` wraps a command only when `.infisical.json` is present, instead of whenever
  the CLI happens to be installed. The file is no longer committed.

### Fixed
- `@nuxt/devtools` updated past [GHSA-279x-mwfv-vcqv](https://github.com/advisories/GHSA-279x-mwfv-vcqv),
  an unauthenticated RPC allowing command execution on the developer's host. Development only — it is
  not part of the runtime image.

## 1.0.1

Packaging fixes on top of 1.0.0: `install.sh` for one-command deployment, and Dockerfile corrections.

## 1.0.0

First release. Zero-knowledge pastebin: AES-256-GCM in the browser, key in the URL fragment, optional
Argon2id password layer, expiry by deadline and by read count, text and file pastes, accounts with
TOTP two-factor, invitations, admin dashboard, IP allowlist and blocklist, Turnstile, rate limiting,
English and French.
