# Security policy

## Supported version

Security fixes are applied to the latest release on `main`.

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** flow for this repository. Do not include OAuth tokens, private email content, local database files, or other personal data in a public issue.

## Local security model

Control Center is designed to run on one trusted user's computer. It binds to loopback (the Docker image publishes to the host loopback only) and rejects foreign Host/Origin headers. Every API route except the health probe, the session exchange, and Google's OAuth callback (bound to an authenticated start by its state cookie) requires the install's access token: a random 32-byte value stored owner-only in the data directory, or `CONTROL_CENTER_ACCESS_TOKEN`. Browsers exchange it once for an HttpOnly, SameSite=Strict cookie holding an HMAC of the token, so rotating the token revokes every session. Mutating browser requests must prove same-origin (`Origin` or `Sec-Fetch-Site`), and any request a browser labels cross-site or same-site is refused, including side-effecting `?refresh=1` GETs.

Pages carry a per-request nonce Content-Security-Policy with `frame-ancestors 'none'`, plus `X-Frame-Options`, `nosniff`, `Referrer-Policy: no-referrer`, and a restrictive `Permissions-Policy`. Forced collector refreshes, model listing, and session attempts are rate-limited in-process, and cloud AI requests are capped per UTC day in SQLite (`CONTROL_CENTER_AI_DAILY_LIMIT`, default 300).

This is defense in depth for a single-user tool, not a multi-user login system. Do not expose it to a LAN or the public internet. Remaining hardening items are tracked in `SECURITY_BACKLOG.md`.

Dependencies are gated in CI with `npm audit --audit-level=high` and `npm audit signatures` (every package must resolve from the public npm registry with a verified signature/integrity hash), and Dependabot proposes updates weekly.

OAuth credentials, optional audience-provider tokens, and optional AI provider keys are stored in the local data directory and are not encrypted at rest. They are written owner-readable on POSIX systems and are never returned by the public Settings response. Protect the operating-system account and treat full backups as secret-bearing files.

Only the AI provider explicitly selected in Settings can be called. Environment variables remain inert until the matching provider is selected. Cloud API origins are fixed; a local endpoint never receives a cloud provider's credentials. Industry prompts contain configured niche text and bounded public discovery metadata; cloud Mention discovery prompts contain configured public identity signals. Mention curation uses independently verified, bounded page excerpts. Daily Brief, task, reminder, and private connector content is not sent to these jobs.

Newsletter intelligence requires a configured cloud or local AI model. Matching Gmail issue text is read with the user-authorized read-only scope and sent only to the selected provider for story extraction and deduplication. Email addresses are masked and subscriber-specific source URLs are replaced with internal link references before the model request; model-returned references must match an observed email link. Raw bodies are not written to SQLite. The local database stores issue metadata, a body hash, extracted story summaries/source links, priority scores, and deduplicated topic state. Public tracking redirects are resolved with the same DNS validation and address pinning used by Industry sources.

LM Studio and Ollama endpoints must be numeric loopback URLs, with `localhost` normalized to loopback, and cannot redirect. Only loaded text-generation models are offered; recognizable remote/cloud aliases are excluded. The app never downloads or loads a model. A loopback destination does not prove the separate runtime processes data locally: disable LM Link or other remote forwarding if computer-only processing is required. Control Center cannot audit another runtime's internal routing. Optional local-server tokens are separate from cloud API keys; `OLLAMA_API_KEY` is never treated as a local token.

User-configured Industry sources are limited to public HTTP and HTTPS addresses. DNS answers are validated and the request is pinned to the validated public address; redirects repeat the same validation. Private, loopback, local-link, and reserved network destinations are rejected. These controls are defense in depth for a local application, not authorization to expose the dashboard as a public URL-fetching service.

Some public collectors (`lib/server/audience.ts`, `lib/server/google-news.ts`) send ordinary desktop/mobile browser User-Agent strings and Instagram's public web app ID because those endpoints serve signed-out metadata only to browser-like clients. This is deliberate compatibility, not an attempt to evade access controls; the collectors read only public, signed-out data.
