# Changelog

Notable changes per release. Versions follow [semver](https://semver.org); the Docker tag ladder is
described in [scripts/release.mjs](scripts/release.mjs).

## v1.1.1

[compare changes](https://github.com/thoda-dev/shhh/compare/v1.1.0...v1.1.1)

### 🩹 Fixes

- **release:** Never publish a contributor email in the changelog ([0e4a943](https://github.com/thoda-dev/shhh/commit/0e4a943))

### ❤️ Contributors

- Thomas ([@thoda-dev](https://github.com/thoda-dev))

## v1.1.0

[compare changes](https://github.com/thoda-dev/shhh/compare/v1.0.1...v1.1.0)

### 🚀 Enhancements

- Add commit and pr validation ([81e3b34](https://github.com/thoda-dev/shhh/commit/81e3b34))
- **pastes:** Require proof of the key to spend a read ([af3b28e](https://github.com/thoda-dev/shhh/commit/af3b28e))

### 🩹 Fixes

- Broken ci with doc image ([5623be5](https://github.com/thoda-dev/shhh/commit/5623be5))

### ❤️ Contributors

- Thomas

## 1.0.1

Packaging fixes on top of 1.0.0: `install.sh` for one-command deployment, and Dockerfile corrections.

## 1.0.0

First release. Zero-knowledge pastebin: AES-256-GCM in the browser, key in the URL fragment, optional
Argon2id password layer, expiry by deadline and by read count, text and file pastes, accounts with
TOTP two-factor, invitations, admin dashboard, IP allowlist and blocklist, Turnstile, rate limiting,
English and French.
