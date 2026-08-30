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
