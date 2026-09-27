# Using Control Center

A step-by-step guide to setting up and using the dashboard once it is running.
For install details see the [README](../README.md); for containers see
[DOCKER.md](DOCKER.md).

- [1. Start and sign in](#1-start-and-sign-in)
- [2. General](#2-general)
- [3. Industry](#3-industry)
- [4. Mentions](#4-mentions)
- [5. Audience](#5-audience)
- [6. Newsletters (Gmail)](#6-newsletters-gmail)
- [7. AI curation (optional)](#7-ai-curation-optional)
- [8. Today and the daily brief](#8-today-and-the-daily-brief)
- [9. Reminders](#9-reminders)
- [10. Tasks](#10-tasks)
- [11. Private connector bridge (optional)](#11-private-connector-bridge-optional)
- [12. Backups](#12-backups)
- [13. Troubleshooting](#13-troubleshooting)

---

## 1. Start and sign in

```bash
npm run launch
```

The launcher installs dependencies if needed, builds on source changes, starts
the server at `http://127.0.0.1:3000`, and opens your browser **already signed
in**. Keep the terminal open; `Ctrl+C` stops the dashboard.

Every install has a private **access token** stored in its data directory. The
browser signs in by exchanging it once for a long-lived session cookie. If a
browser shows **Control Center is locked**, run:

```bash
npm run token            # prints the token and a one-click sign-in URL
npm run token -- --rotate  # new token; signs out every browser
```

Paste the token into the lock screen, or open the printed sign-in URL. With
Docker, use `docker compose exec control-center node scripts/token.mjs`.

A fresh install is completely empty. **Today** shows a **Setup progress** card
that links to each Settings section below. Open **Settings** from the header,
fill in a section, and press **Save settings** before moving on.

## 2. General

**Settings → General → Workspace identity.** Set the workspace name shown in the
header and browser tab, for example your company or project name.

## 3. Industry

Tracks the websites that matter in your niche and surfaces up to 30 important new
items a day.

1. Open **Settings → Industry → Sites and industry topics**.
2. Describe your niche in the description box, in a sentence, for example:
   *"Commercial robotics, warehouse automation, funding, and regulation."*
3. Under **Tracked sources**, add each site with a **Source name** and a
   **Source URL**. A homepage works: the collector finds its RSS/Atom feed, or
   falls back to the sitemap. A direct feed URL also works.
4. Add **Industry topics**, phrases that make an item more important
   (`sustainable packaging`).
5. Add **Exclude topics**, phrases that should never surface (`job listings`,
   `webinar`).
6. Save settings.

**What to expect.** Collection starts shortly after saving and repeats every 15
minutes while the app is open. A site with only a sitemap records a quiet
baseline on its first scan and reports newly discovered pages after that, so it
can look empty at first. The **Industry** tab shows items from the last 24 hours.
Older items move to **History**; **Archived** holds only what you archived.
**Refresh** forces a new scan and is rate-limited to a few per minute.

## 4. Mentions

Finds pages that are genuinely about you, not about someone with the same name.

1. Open **Settings → Mentions → Identity, not loose keywords**.
2. **Names, brands, and unique handles.** Add the exact names and handles to
   track (`Acme Robotics`, `@acmerobotics`).
3. **Official websites.** Add your own domains (`acmerobotics.com`). These
   establish identity. With **Exclude your own websites** on (the default), pages
   on them are left out of the Mentions queue.
4. **Identity anchors.** Add words that appear near real mentions of you:
   products, founders, cities, niche terms (`warehouse robot`, `Jane Doe`,
   `Austin`). Common names need these to qualify.
5. **Exclude namesakes and false contexts.** Add contexts that indicate someone
   else (`Acme Robotics Club`, `cartoon`).
6. Keep **Identity-aware filtering** (strict mode) on unless you want borderline
   matches shown for review.
7. Save settings.

Limits: 12 names, handles, and websites combined, 24 anchors, 24 exclusions.

**What to expect.** Google News and Bing News are searched over the past seven
days. Each result's own page is fetched and must literally contain identity
evidence. Search snippets never count. If a cloud AI provider with web search is
selected, a broad-web pass also runs every two hours. From a mention card you can
archive it or send it to **Reminders**.

## 5. Audience

Public follower and subscriber totals for YouTube, X, Instagram, Facebook,
LinkedIn, Threads, and TikTok.

1. Open **Settings → Audience → Public social profiles**.
2. Add each profile by its exact public URL or handle.
3. Optional: expand the advanced section to add an official API credential for
   platforms that support a fallback.
4. Save settings.

**What to expect.** Public pages are checked first. A failed check shows
**unavailable**, never a false zero, and a previous value is labeled **last
known**. Growth compares against a reading from 24–36 hours earlier, so the change
figure appears only after the app has been running for about a day. Use the
7-day and 30-day charts, or the exact-values table, to inspect history.

## 6. Newsletters (Gmail)

Reads a Gmail inbox (ideally a separate account used only for newsletters),
extracts the actual news stories, and ranks them. **This feature needs an AI
provider configured in step 7.**

### Create a Google OAuth client (one time)

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select
   a project.
2. **APIs & Services → Library**: enable the **Gmail API**.
3. **OAuth consent screen**: configure it (External + Testing is fine for
   personal use) and add your newsletter Gmail address as a test user.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
5. Under **Authorized redirect URIs**, add the exact URI shown in **Settings →
   Newsletters**, normally `http://127.0.0.1:3000/api/auth/google/callback`. The
   port must match the one you use.
6. Copy the client ID (it ends in `.apps.googleusercontent.com`; it is *not* your
   email address) and the client secret.

### Connect

1. **Settings → Newsletters → Dedicated Gmail connection**: paste the **Google
   OAuth client ID** and **Google OAuth client secret**.
2. Optionally adjust the Gmail search query that selects newsletter issues.
3. Choose **Save & choose Gmail account**, pick the newsletter mailbox, and
   approve read-only access.
4. You return to Settings with **Connected with Gmail read-only access**.

**What to expect.** Each refresh reads previously unseen matching issues and
sends their text, with email addresses and tracking links masked, to your
selected AI provider. Stories covered by several newsletters are merged into one
card. The queue shows the last 36 hours; **Earlier** holds older stories. Sort by
**Priority**, **Newest**, or **Oldest**, search, or filter by newsletter. Gmail
is never modified. Apps left in *Testing* mode may ask you to reconnect
periodically.

## 7. AI curation (optional)

AI improves ranking and summaries. It is required only for Newsletters.

1. **Settings → AI curation**: choose **OpenAI**, **Anthropic**, **Gemini**,
   **Grok (xAI)**, **LM Studio**, or **Ollama**.
2. Cloud providers: paste that provider's API key, or put it in `.env.local` as
   `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `XAI_API_KEY`.
   Keys are stored server-side and never shown again.
3. Local providers: start LM Studio or Ollama, load a text model, keep the
   default loopback endpoint (or enter its port), and choose **Reload models**.
   Local providers are not reachable from the Docker image.
4. Leave the model on **Default** or pick one from the list. Save settings.

**Cost control.** Cloud requests are capped at 300 per UTC day by default. When
the cap is reached, ranking falls back to the deterministic local method until
the next day. Change it with `CONTROL_CENTER_AI_DAILY_LIMIT` in `.env.local`
(`0` removes the cap) and restart. Local models are not counted.

## 8. Today and the daily brief

**Today** is the page to open each morning. It shows the highest-priority active
stories from Industry, Mentions, and Newsletters, five of each by default.

- Choose **Customize** on Today (or **Settings → Daily brief**) to show 1–10
  stories per section, or turn a section off.
- Opening Today makes **no** new web, Gmail, or AI calls. It reads the saved
  queues, so it loads instantly.
- Stories you archive in a tab disappear from Today too.
- Items from the [private connector bridge](#11-private-connector-bridge-optional)
  appear below the snapshot and can be turned into tasks from their cards.

## 9. Reminders

A reading list for links and ideas you want to come back to.

1. Open **Reminders**.
2. Paste a URL or type a title, and optionally note **Why save it?**
3. Mention cards can also be sent here directly.

Archive a reminder when you are done with it; archived reminders stay available
in the archive view.

## 10. Tasks

1. Open **Tasks** and choose **New task**.
2. Enter what needs to get done, an optional description, a due date, and
   **Repeats**: **One-time**, **Daily**, **Weekly**, or **Monthly**.
3. **Add task**.

Completing a **repeating** task records a dated, permanent entry under
**Completed** and moves the task to its next due date. Monthly tasks keep their
original day of the month. One-time tasks stay under Completed until you delete
them.

## 11. Private connector bridge (optional)

Brings summaries of your messages, meetings, and action items (from Gmail,
Slack, Calendar, and similar) into Today, via a Codex automation that you
create. Skip this if you do not use Codex connectors.

1. **Settings → Integrations → Bring private context into Today**: choose the
   apps you want summaries from, set the look-back window, and save.
2. Choose **Copy setup prompt** and paste it into Codex to create the recurring,
   read-only sync.
3. The automation delivers results with `npm run ingest`, which authenticates
   with your access token automatically. Scripts calling the API directly must
   send `Authorization: Bearer <token>`.

See [CONNECTOR_BRIDGE.md](CONNECTOR_BRIDGE.md) for the JSON format.

## 12. Backups

```bash
npm run backup                                   # to ~/Documents/Control Center Backups/<timestamp>
npm run backup -- --to=/absolute/path/to/folder  # somewhere else
```

The backup takes a consistent snapshot of the SQLite database, plus settings and
audience/sitemap baselines. **It contains OAuth tokens and any saved AI keys.**
Keep it private. To restore, stop the app and copy the files back into the data
directory. `npm run doctor` shows its location.

The access token is not part of the backup. After a restore, a new token is
generated and you sign in once with `npm run token`.

## 13. Troubleshooting

Start with the doctor. It checks Node.js, the build, settings, audience history,
and the database, without changing anything:

```bash
npm run doctor
```

| Symptom | Fix |
| --- | --- |
| **Control Center is locked** | Run `npm run token` and paste the token, or open the sign-in URL. |
| API calls return **401** | The session was signed out, or the token was rotated. Sign in again. Scripts need `Authorization: Bearer <token>`. |
| **403 "only accepts requests from this computer"** | Use `http://127.0.0.1:<port>` or `http://localhost:<port>`. LAN addresses and other hostnames are refused by design. |
| **429 Too many requests** | Refresh and model-list calls are rate-limited. Wait a minute. |
| Industry stays empty | Check the source URL in a browser. Sitemap-only sites need a second scan before anything counts as new. |
| Mentions miss a real article | Add an identity anchor that appears on that page, or turn strict mode off to review borderline matches. |
| Audience shows **unavailable** | The platform blocked signed-out access. Try again later, or add the optional official credential. |
| Newsletters: `oauth-state` / `oauth-exchange` error | The redirect URI in Google must exactly match the one in Settings (including the port). Then reconnect. |
| Newsletters: nothing extracted | An AI provider must be configured and within its daily cap. Check the Gmail search query matches your issues. |
| Startup stops with a local-data error | Run `npm run doctor`. The app fails closed rather than overwriting your settings or tasks. Restore from a backup if a file is corrupt. |
| Wrong Node.js version | Install Node.js 24.19 or newer (`nvm install 24 && nvm use 24`). |
