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

By taking part, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

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
