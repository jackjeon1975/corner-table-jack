# Corner Table

A collaborative community for Single entrepreneurs

> Ideas get a table before they get built.

A small, simple place where people share an idea **before** building it, design it together in the open,
pick a team, post progress publicly, and gather fans who watch and cheer. MVP of PRD v0.3.

## Contact

env042@gmail.com

## Run it

Requires Node.js 20+ and PostgreSQL (local Postgres or a Supabase project).

```bash
npm install
```

```bash
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local`, then create the tables:

```bash
npm run db:migrate
```

```bash
npm run dev
```

Open http://localhost:3000. In dev mode you can sign in with **Dev login** (any handle, no password).

Production:

```bash
npm run build && npm start
```

## Tests

End-to-end test of the core journey (sign-in, idea → project, stage rules, join requests, updates,
following feed, reports and moderation, plain-text rendering, mobile layout):

```bash
npm run build && npm run test:e2e
```

It starts its own server on port 3100 and **wipes** the database in `TEST_DATABASE_URL`
(default `postgres://ct:ct@localhost:5432/corner_table_test`) — never point it at real data. The same test runs on every push
in GitHub Actions (`.github/workflows/ci.yml`), and screenshots are attached to the run.

## Configuration

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `APP_URL` | Public base URL. GitHub callback is `${APP_URL}/auth/github/callback` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub sign-in (OAuth App or GitHub App). Only the public profile is read |
| `ADMIN_HANDLES` | Comma-separated handles that can open `/ops` (moderation) |
| `ALLOW_DEV_LOGIN` | `1` to allow dev login in production (keep `0` for real launches) |
| `DATABASE_URL` | PostgreSQL connection string. On Vercel + Supabase use the transaction pooler (port 6543) |
| `DATABASE_SSL` | `disable` or `no-verify` to override TLS (default: TLS for remote hosts). `no-verify` is for local/temporary use only; in production use `DATABASE_CA_CERT` |
| `DATABASE_CA_CERT` | Supabase root CA (PEM, PEM with literal `\n`, or base64). Required on Vercel + Supabase pooler; verifies the server certificate |

## What's in the MVP

- **Feed**: single column, Latest / Following, newest first, no algorithm. No character limit; long posts fold with "Show more".
- **Post types**: Note, Idea (home); Question, Risk, Help, Update (inside a project). Only the team can post Updates.
- **Projects**: start from your own Idea post. You become the leader.
  Stages: Concept → Design (needs a Question) → Building (needs a GitHub repo link) → Shared (needs a result link + summary),
  plus Paused (needs a reason) and Ended (needs a retrospective, final).
- **Team**: open/close recruiting, people ask to join with a role, the leader approves (and can rename the role), declines or removes. Members can leave; applicants can withdraw and re-apply later.
- **Help wanted**: the leader lists what they can't do alone (IP advice, servers, AI tokens…).
- **Accountability**: "last update" and a **Quiet** badge after 14 days without progress.
- **Follow / Cheer / Reply**, profiles, explore with search and filters (stage, recruiting, needs help).
- **Safety**: reports, rights-holder report without login (`/report`), moderation console (`/ops`) with hide/restore and audit log, rate limits, plain-text rendering, https-only links, account deletion.

## Notes for the next step

- Schema lives in `db/schema.sql` (idempotent). Row Level Security is enabled on every table with no policies, so Supabase's public REST API cannot read or write them; the app connects server-side only.
- Not yet built (PRD P1): GitHub release import, "decided" marks on Questions, continuing an ended project, translation, notifications.
- `/ops` has no MFA yet — required before a public launch.
