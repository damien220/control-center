# Security & hardening backlog

Findings from a source review of the working tree (2026-08-30). None of these are
vulnerabilities *within the project's declared threat model* — "one trusted user's
computer, loopback only, no account login" (see `SECURITY.md`). They are hardening
gaps that matter only if the deployment model widens (containerised, LAN-reachable,
shared host) or if defence-in-depth is wanted regardless.

**Status (2026-09-27):** items 1–5 are **done**, as prerequisites for the Docker image
(see `CHANGELOG.md` → Unreleased). The "Browser UA spoofing" smaller item is
documented in `SECURITY.md`. Items 6, 7, and the remaining smaller items are open.

Order below is roughly by value-for-effort. Effort estimates assume familiarity
with the codebase.

---

## 1. No HTTP security headers

> **Done.** Static headers in `next.config.ts`; per-request nonce CSP in `proxy.ts` (the inline theme script carries the nonce, so no `'unsafe-inline'` for scripts). Covered by `tests/proxy.test.ts` and `npm run smoke`.


**What it is.** `next.config.ts` only sets `reactStrictMode`. No
`Content-Security-Policy`, `X-Frame-Options` / `frame-ancestors`,
`X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` is emitted.
The dashboard renders private intelligence and has no clickjacking protection; a
malicious local page could frame it, and there is no CSP to blunt a future XSS.

**How to fix.** Add an async `headers()` to `next.config.ts` returning a strict
set for all routes:

- `Content-Security-Policy`: `default-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'` — the inline theme bootstrap in `app/layout.tsx` needs either a nonce or moving to an external file to drop `'unsafe-inline'` on scripts.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Add a test under `tests/` asserting the headers are present on `/` and an API route.

**Effort.** ~1 hour.

---

## 2. No dependency / supply-chain scanning in CI

> **Done.** CI `audit` job runs `npm audit --audit-level=high` (blocking — baseline is clean after upgrading next/sharp/js-yaml) and `npm audit signatures`; Dependabot npm updates are weekly. CodeQL not enabled.


**What it is.** `.github/workflows/check.yml` runs `setup`, `check`, `smoke`
only. No `npm audit`, no SCA, no `Dependabot`, no lockfile-integrity gate. The
repo also ships a Next.js build it describes as "not the Next.js you know"
(`AGENTS.md`) with no note on how that is verified against the published tarball.

**How to fix.**

- Add a CI step: `npm audit --audit-level=high` (start non-blocking, then make it
  fail the build once the baseline is clean).
- Add `.github/dependabot.yml` for `npm` (weekly) and `github-actions`.
- Optional: enable GitHub Advanced Security / CodeQL for JS-TS.
- Verify `next` in `package-lock.json` resolves to `registry.npmjs.org` with an
  `integrity` hash and document that in `SECURITY.md`.

**Effort.** ~1 hour.

---

## 3. CSRF protection is Origin-header-only

> **Done.** Mutating requests need `Origin`, `Sec-Fetch-Site: same-origin`, or the bearer token; browser-labelled cross-site/same-site requests are refused on all `/api/*` routes (except the OAuth callback). Refresh GETs are gated by the session cookie (SameSite=Strict) rather than moved to POST.


**What it is.** `proxy.ts` blocks foreign `Host` and mismatched `Origin`, but a
request with **no** `Origin` header passes. Several `GET` endpoints have side
effects (`/api/live/*?refresh=1` triggers outbound collection and paid AI calls),
and GET is not covered by the Origin check by nature.

**How to fix.**

- Require `Origin` (or `Sec-Fetch-Site: same-origin`) on all mutating methods
  (`POST`, `PUT`, `DELETE`) in `proxy.ts`; reject when absent.
- Move side-effecting refresh actions off `GET` onto `POST`, or gate them behind
  the pairing token in item 4.
- Add `proxy.test.ts` cases for missing-Origin POST and for `Sec-Fetch-Site`.

**Effort.** ~0.5 day.

---

## 4. No authentication on the local API (incl. the connector-bridge ingest)

> **Done.** Token in `<data dir>/access-token` (0600) or `CONTROL_CENTER_ACCESS_TOKEN`; the launcher opens `/#token=…`, the page exchanges it at `POST /api/session` for an HttpOnly SameSite=Strict cookie (HMAC of the token). `npm run token` prints/rotates it; `npm run ingest` sends it as a bearer token.


**What it is.** The entire trust model is "loopback + Host/Origin". Any other OS
user, any local process, any browser tab that can reach `127.0.0.1:<port>` can
call every endpoint: read the Daily Brief, drive collectors, and POST up to 500
fabricated action/meeting/message items to `/api/brief` (`app/api/brief/route.ts`
has no auth). This is acceptable *per the current spec* but is the single biggest
blocker to any container / multi-user / networked deployment.

**How to fix.**

- On first launch, generate a random 32-byte token, store it `0600` in the data
  directory, and print/inject it into the opened URL as a one-time fragment that
  the client swaps for a `HttpOnly`, `SameSite=Strict` session cookie.
- Enforce the cookie in `proxy.ts` for `/api/*` (allow `/api/health` unauthed).
- For `npm run ingest` / scripted callers, accept the raw token via
  `Authorization: Bearer` and document it.
- Keep loopback binding as defence-in-depth, not the only line.

**Effort.** 1–2 days.

---

## 5. No rate limiting or cost ceiling on AI calls

> **Done.** In-process token buckets in `proxy.ts` (refresh, model list, session exchange) return 429; `runConfiguredAi` enforces a persistent per-UTC-day cloud request cap in SQLite (`ai_usage`). The cap is configured with `CONTROL_CENTER_AI_DAILY_LIMIT` (default 300) rather than a Settings field, and is not yet surfaced in the UI.


**What it is.** Batch sizes are bounded, but nothing limits how often a local
caller can trigger cloud-provider (billable) requests. A runaway client loop or a
hostile local process can run up provider charges.

**How to fix.**

- Add a simple in-process token-bucket keyed by endpoint in a shared middleware
  helper (e.g. N refreshes / minute, M AI runs / hour), returning `429`.
- Add a configurable daily spend/request cap in Settings (`ai.dailyRequestLimit`),
  enforced in `lib/server/ai.ts` `runConfiguredAi`, surfaced in the UI when hit.
- Persist the running count in SQLite so it survives restarts.

**Effort.** ~1 day.

---

## 6. Secrets unencrypted at rest; no OS keychain integration

**What it is.** OAuth refresh tokens and AI API keys live in `settings.json` as
plaintext, protected only by `0600` file mode. `npm run backup` copies them
unencrypted to `~/Documents/Control Center Backups/` with no passphrase option.
Documented in `README.md` / `SECURITY.md`, but still the weakest link if the
account or a backup leaks.

**How to fix.**

- Add a keychain abstraction in `lib/server/`: macOS Keychain (`security`
  CLI or `keytar`), Windows DPAPI (`Credential Manager` / `keytar`), Linux
  libsecret (`keytar`), with the current plaintext file as an explicit
  fallback when no secret store is available (e.g. headless container).
- Store only a wrapped/encrypted blob in `settings.json`; keep the wrapping key
  in the keychain.
- Add `npm run backup -- --encrypt` producing an age/gpg-encrypted archive; warn
  loudly on unencrypted backups.

**Effort.** 3–5 days (cross-platform testing is the cost).

---

## 7. No audit log of outbound data / secret access

**What it is.** Nothing records what was sent to which AI provider and when, or
when secrets were read. A compromised dependency exfiltrating via the
"selected provider" code path would leave no trace.

**How to fix.**

- Add an append-only `audit_log` table (timestamp, actor, action, provider,
  endpoint, byte count, outcome — never payload contents).
- Write an entry from `aiProviderJson` / `providerFetch`, the Gmail client, and
  the settings read/write helpers.
- Add a Settings screen (or `npm run doctor --audit`) to view recent entries.
- Rotate/trim to a bounded size.

**Effort.** ~1 day.

---

## Smaller items

| Item | What / fix | Effort |
|---|---|---|
| No `toPublicSettings` HTTP-layer test | Smoke test checks one field's readback; add a unit test asserting no key/token/secret string ever appears in the `/api/settings` GET body for a fully-populated settings object. | ~1 h |
| `CONTROL_CENTER_DATA_DIR` inside a checkout | If a user points the data dir at a path inside the repo, nothing git-ignores it. Refuse a data dir under `process.cwd()` unless it's the legacy `.control-center`, or add a generated `.gitignore` inside it. | ~1 h |
| Plaintext HTTP on loopback | Minor (sniffing loopback needs root). If containerised or bridged, terminate TLS at the edge; consider an opt-in self-signed HTTPS mode for `next start`. | ~0.5 day |
| Browser UA spoofing to public endpoints | `lib/server/audience.ts`, `google-news.ts` send fake Chrome/iPhone UAs + Instagram's public web app-id. Not a vuln; document it in `SECURITY.md` as deliberate so it isn't mistaken for evasion. | ~15 min |
| No documented threat model | `SECURITY.md` describes data flows well but not an attacker model. Add an explicit "in scope / out of scope / assumptions" section. | ~1 h |
| Google News internal endpoint | `google-news.ts` calls the undocumented `batchexecute` endpoint; can break silently. Add a graceful-degradation test and a fallback to the un-decoded URL (already partly present). | ~1 h |

---

## Rough totals

- Cheap defence-in-depth (items 1, 2, and the 1-hour smaller items): **~1 day**.
- Everything required before a networked / multi-user / container deployment
  (items 1–5): **~4–5 days**.
- Full list including at-rest encryption and audit logging: **~2 weeks**.
