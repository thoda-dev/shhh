# Contributing

## Setup

Node 24 and pnpm 11 (`mise install` picks both up), plus a PostgreSQL database.

```bash
pnpm install
cp .env.example apps/app/.env   # DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
pnpm db:migrate
pnpm dev
```

Run these before opening a pull request. None of them needs a database:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Schema changes need a migration committed alongside them: `pnpm db:generate`. CI fails if the
migrations and the schema disagree.

## Integration tests

`pnpm test:integration` builds the app, boots it and drives the routes over HTTP.
It needs a database of its own: the schema is dropped on every run, which is why it reads `TEST_DATABASE_URL` rather than `DATABASE_URL`.

```bash
createdb shhh_test
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/shhh_test pnpm test:integration
```

Turnstile is exercised for real, on Cloudflare's always-passes test keys, so the run needs network access.
`TEST_SKIP_BUILD=true` reuses the last `.output` while you iterate on the tests themselves.
[ROADMAP.md](ROADMAP.md) lists the suites still to write.

By taking part, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): subject`, where type is
one of `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci` or `chore`.

```
feat(pastes): allow a per-paste read limit
fix(auth): stop require_2fa being bypassed by disabling 2FA
docs: document the nginx reverse proxy setup
```

This is not style policing: the release script builds `CHANGELOG.md` from these messages with
[changelogen](https://github.com/unjs/changelogen), and anything that does not match the format is
dropped from the changelog entirely rather than listed badly.

`pnpm install` points `core.hooksPath` at `.githooks`, so a commit that does not match is refused
locally before it exists. `git commit --no-verify` skips it when you need to. What actually gates a
contribution is the **pull request title**, which CI checks: with squash merging that title becomes
the commit on master, and therefore the changelog entry.

## Scope

[ROADMAP.md](ROADMAP.md) lists what is planned and, at the bottom, what was evaluated and rejected.
Reopening something from that second list needs a new argument, not a reminder.

**Every pull request has to close an issue**, and CI enforces it. Open one first, so the discussion
happens before the work rather than on top of a finished branch.

## AI assistance

Part of shhh is written by hand, part with AI assistance, against a written spec. Design decisions —
the security model in [SECURITY.md](SECURITY.md) in particular — are made and owned by a human, and
every line that ships has been read and understood by a maintainer.

The documentation is a different case: this file, the README and the docs site are drafted with AI so
that the English reads correctly. The decisions they describe came first — only the wording is
assisted.

You are welcome to use AI tools on your contribution. Two things in return:

- **Say so in the pull request.** Which tool, and roughly how much of the change it produced. One
  line is enough. This is not held against you: it tells the reviewer where to look hardest.
- **Be able to defend every line.** If you can't explain why a change is correct, it isn't ready. A
  pull request its author can't discuss gets closed, whoever or whatever wrote it.

Two areas take no generated code without a very good reason: [`app/utils/crypto.ts`](apps/app/app/utils/crypto.ts)
and anything under `server/api/` that decides authorization. Both are subtle, hard to review, and
the cost of getting them wrong is the entire product.

Vulnerability reports follow the same rule — see [SECURITY.md](SECURITY.md).
