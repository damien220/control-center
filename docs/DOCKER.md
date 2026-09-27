# Running Control Center in Docker

The Docker image runs the same dashboard as `npm run launch`, packaged as a
self-contained Next.js server on `node:24-alpine`. The container is published to
your computer's loopback interface only, so it is reachable at
`http://127.0.0.1:3000` from this machine and nowhere else.

## Requirements

- Docker Engine 24 or newer with the Compose plugin **2.24 or newer**. The compose
  file marks `.env.local` as optional, which needs 2.24.
- About 300 MB of disk for the image, plus your data.

## Start

```bash
docker compose up -d --build
docker compose exec control-center node scripts/token.mjs
```

The second command prints your **access token** and a sign-in URL of the form
`http://127.0.0.1:3000/#token=…`. Open that URL once. The browser swaps the token
for a long-lived, HttpOnly session cookie and removes the token from the address
bar. After that, plain `http://127.0.0.1:3000` works in that browser.

If you publish a different host port (see below), pass it so the printed URL
matches: `node scripts/token.mjs --port=3001`.

Stop with `docker compose down`. Your data lives in a named volume and survives
`down`, rebuilds, and upgrades. Only `docker compose down -v` deletes it.

## Configuration

| Setting | Where | Notes |
| --- | --- | --- |
| Host port | `CONTROL_CENTER_PORT` in your shell or a `.env` file next to `docker-compose.yml` | Default `3000`. Compose reads this value for the port mapping, so it cannot go in `.env.local`. |
| AI provider keys | `.env.local` (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`) or **Settings → AI curation** | Keys in `.env.local` are passed to the container at runtime and are never copied into the image. Keys saved in Settings are stored in the data volume. |
| Fixed access token | `CONTROL_CENTER_ACCESS_TOKEN` in `.env.local` | At least 32 characters. Leave empty to use the generated token in the data volume. |
| Daily cloud AI cap | `CONTROL_CENTER_AI_DAILY_LIMIT` in `.env.local` | Default 300 requests per UTC day; `0` disables the cap. |
| Data location | Fixed at `/data` inside the container | Any `CONTROL_CENTER_DATA_DIR` in `.env.local` is overridden, so a host path there is harmless. |

After changing `.env.local`, apply it with `docker compose up -d`.

Rotate the access token, which signs out every browser:

```bash
docker compose exec control-center node scripts/token.mjs --rotate
```

## Gmail newsletters

Google must redirect back to the exact address your browser uses. Under
**Settings → Newsletters** the dashboard shows the redirect URI, normally
`http://127.0.0.1:3000/api/auth/google/callback`. Add exactly that URI, including
the port, to your Google OAuth client. The rest of the setup is the same as a
local install; see [USAGE.md](USAGE.md#6-newsletters-gmail).

## Local models (LM Studio / Ollama)

For safety, local AI endpoints must be numeric loopback addresses. Inside a
container, `127.0.0.1` is the container itself, not your computer, so a model
server running on the host is **not reachable** with the default setup. Use a
cloud provider, or run Control Center with `npm run launch` when you need local
models.

On Linux only, you can share the host's network instead. Replace the `ports:`
block with `network_mode: host`, and set `HOSTNAME: 127.0.0.1` under
`environment:` so the server still binds to loopback only. Do not use host
networking with `HOSTNAME: 0.0.0.0`: that exposes the dashboard to your LAN,
leaving the access token as its only protection.

## Backups

The built-in backup takes a consistent SQLite snapshot. Run it inside the
container, writing into the data volume, then copy the result out:

```bash
docker compose exec control-center node scripts/backup.mjs --to=/data/backups/latest
docker compose cp control-center:/data/backups/latest ./control-center-backup
docker compose exec control-center rm -rf /data/backups/latest
```

The backup contains OAuth tokens and any saved AI keys. Store it like a password.

To restore, stop the container, copy the backup files into the volume (for
example `docker compose cp ./control-center-backup/. control-center:/data/`
while the container is stopped but not removed), then start it again.

## Health and diagnostics

```bash
docker compose ps                                          # health status
docker compose logs -f control-center                      # server output
docker compose exec control-center node scripts/doctor.mjs # data checks
```

The image has a built-in health check against `/api/health`.

## Upgrading

```bash
git pull --ff-only
docker compose up -d --build
```

Database schema upgrades run automatically at startup and write a migration
backup inside the data volume first.

## Security notes

- The port is published to `127.0.0.1` only. The app also rejects any request
  whose `Host` header is not loopback, so publishing on `0.0.0.0` or putting it
  behind a LAN reverse proxy does not make it reachable. This is deliberate.
- Every API call needs the access token, either as the browser's session cookie
  or as `Authorization: Bearer <token>` for scripts. Writes from a browser must
  also be same-origin, and cross-site requests are refused.
- The container runs as the unprivileged `node` user. Its root filesystem is
  read-only, it has no Linux capabilities, and `no-new-privileges` is set. Only
  `/data`, `/tmp`, and Next's cache directory are writable.
- Secrets in the data volume are not encrypted at rest. Anyone who can run
  `docker` on this machine can read them.
