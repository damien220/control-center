@AGENTS.md

# Project: Control Center

`self-hosted-control-center` (v0.3.1) — a local-first, settings-driven business-intelligence
dashboard. MIT licensed. Stack: **Next.js 16 / React 19 / TypeScript**, Node ≥ 24.19, SQLite
storage. Repo: `github.com/mreflow/control-center`.

## Core idea

Every install starts completely empty — no bundled names, companies, feeds, or API keys. Each
user configures the dashboard to their own niche in **Settings**. The server binds strictly to
`127.0.0.1` and rejects requests with foreign Host/Origin headers. `npm run launch` is the
"golden path": it installs locked deps when needed, builds on source changes, starts one
loopback-only server, health-checks it, and opens `http://127.0.0.1:3000`.

## Feature areas

1. **Industry** — tracks arbitrary homepages via RSS/Atom feeds, falling back to sitemap /
   `robots.txt` discovery. Bounded daily candidate set (30/day) ranked by recency,
   watched-source priority, configured topics/exclusions, change signals, and source
   diversity. Optional AI reranking with deterministic local fallback.
2. **Mentions** — strict brand/name monitoring across Google/Bing News (7-day window) plus an
   optional cached broad-web AI pass. Requires literal page-local identity evidence, rejects
   weak namesakes, supports identity anchors and negative contexts. Laptop-friendly caps
   (12 names, 24 anchors, 24 negatives).
3. **Audience** — public follower/subscriber totals for YouTube, X, Instagram, Facebook,
   LinkedIn, Threads, TikTok. Public scrape first, optional official API fallback. Growth is
   measured against a 24–36h-old anchor; failed checks show as "unavailable", never a false
   zero.
4. **Newsletters** — connects a (separate) Gmail account via bring-your-own read-only OAuth;
   the selected AI provider extracts substantive stories from matching issues, dedupes across
   newsletters, and ranks by priority. Only feature that *requires* a configured AI model.
5. **Today / Daily brief** — snapshot of the highest-priority stories from the three queues;
   opening it makes no extra AI/web/Gmail calls.
6. **Tasks & Reminders** — repeating tasks record immutable dated occurrences.

## Optional AI curation

Providers: OpenAI, Anthropic, Gemini, Grok (xAI), or local LM Studio / Ollama (loopback
endpoints only). Keys are stored server-side in `settings.json`, never returned by the
Settings API, and never sent to an unselected provider. Used only for bounded background jobs.

## Data & privacy

Durable data is stored outside the app folder (platform-specific dirs, or an absolute
`CONTROL_CENTER_DATA_DIR`): `settings.json` (incl. OAuth tokens / provider keys, unencrypted
at rest), `control-center.sqlite`, and snapshot JSON files. `npm run backup` makes a full
private backup. The app "fails closed" on local-data errors rather than overwriting settings.

## Private connector bridge

Optional advanced integration (`Settings → Integrations`): generates a prompt telling
Codex/connectors to push read-only action/meeting/message summaries to a loopback-only Daily
Brief endpoint (also reachable via `npm run ingest`). No account access is shipped with the app.

## Tooling

`npm run` scripts: `launch`, `setup`, `dev`, `doctor`, `backup`, `ingest`, `smoke`,
`check` (lint + `tsx` tests + production build). CI runs setup/check/smoke on Linux, macOS,
and Windows.

## Security backlog

Known hardening gaps (headers, CI dependency scanning, CSRF, API auth, AI rate
limiting, at-rest encryption, audit logging) are tracked in
[SECURITY_BACKLOG.md](SECURITY_BACKLOG.md) with a fix and effort estimate for each.
None are in scope for the current "single trusted user, loopback only" model; revisit
them before any networked or multi-user deployment.

## Progress

- **2026-09-11 — golden path verified in this devcontainer.** The devcontainer ships
  Node 22, so Node 24 was installed via the system nvm (`nvm install 24 && nvm use 24`,
  which must be re-selected in each new shell) before running anything below.
  `npm run setup` (367 packages installed), `npm run check` (lint clean, 215/215 tests
  passed, production build succeeded), `npm run smoke` (health, home page, empty-first-run,
  and localhost-boundary checks all passed), and `npm run launch -- --no-open` (server
  healthy at `127.0.0.1:3000`, `/api/health` → `{"status":"ready"}`) all ran clean.
  Outstanding: `npm audit` reported 2 high + 1 critical dependency vulnerabilities during
  setup — not yet triaged or fixed.

- **2026-09-27 — audit fixed, security prerequisites, usage guide, Docker.**
  - `npm audit` findings fixed: next 16.3.2→16.3.6 (critical RCE advisories),
    sharp →0.35.4, js-yaml →4.3.2; `npm audit` now reports 0 vulnerabilities.
  - SECURITY_BACKLOG.md items 1–5 implemented: security headers + nonce CSP,
    CSRF hardening, access-token auth (`lib/access-token.ts`, `POST /api/session`,
    `components/access-gate.tsx`, `npm run token`), rate limits + daily cloud-AI
    cap (`lib/rate-limit.ts`, `lib/ai-usage.ts`), CI `npm audit` gate.
  - `docs/USAGE.md` and `docs/DOCKER.md` written; `Dockerfile`,
    `docker-compose.yml`, `.dockerignore` added (standalone output behind
    `CONTROL_CENTER_STANDALONE=1`).
  - Verified: `npm run check` (227/227 tests), `npm run smoke`, and the standalone
    server run as in the container (read-only app dir, `HOSTNAME=0.0.0.0`).
  - **Not verified here:** `docker build`/`docker compose up` (no Docker daemon in
    this devcontainer) and the sign-in UI in a real browser (Chromium could not be
    installed on this Debian 11 image).

## Next steps

1. Build and run the image on a machine with Docker (`docker compose up -d --build`,
   then `docker compose exec control-center node scripts/token.mjs`), and click
   through the lock screen and Settings in a browser to confirm the CSP breaks
   nothing.
2. Remaining backlog: at-rest secret encryption (item 6), audit log (item 7),
   smaller items; optionally surface the daily AI cap in Settings.
