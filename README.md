# Planly

**A minimalist day planner that lives in your browser.** One HTML file, no
framework, no accounts, no server required. Works offline, installs to the home
screen, and syncs between devices through a single access code when you want it to.

**[Live demo →](https://planly.site)** · [Русская версия →](README.ru.md)

![Planly on iPhone: timeline, tasks and dark mode](docs/hero.png)

<img src="docs/drag.gif" width="260" align="right" alt="Dragging a task to a new time">

- **Day** — a vertical timeline where each task is a block as tall as its duration. Tap a time to add, drag to move, pull the bottom edge to resize. Overlaps split into columns. A list view shows the same day as rows with free windows between tasks.
- **Repeats** — every day or chosen weekdays. Edits apply to one day; "apply to all future" pushes them down the series.
- **Calendar** — tap the date to open a month view; days with tasks are underlined.
- **Tasks** — things without a time, in folders you create, with four priorities; the top one, *Urgent*, frames the task in bright red wherever it appears. Drag to reorder or change priority; schedule into a free window or automatically.
- **Notes** — drafts by topic with headings, bullet and numbered lists, bold and italic. Saves as you type.
- **Archive** — completed items, grouped by day, auto-removed after two weeks.
- **Unload a range** — pick any stretch of days and send everything scheduled in it either back to the task list (into a folder named after the range, ready to be re-planned) or into a note. Settings → Tools, or the button under the calendar.
- **Tasks ⇄ notes** — export any folder (or the whole untimed list) into a note in a small text format, hand that note to an LLM to restructure, paste it back and press *To tasks*: lines land on their days, and anything without a time is placed into a free window automatically. Each line carries a `^id`, so a round trip updates the same tasks instead of duplicating them.
- **Sync** — optional. One code = one shared list. Per-item merge by modification time, tombstones for deletions, offline-first.
- Light/dark theme, seven accent colors, six languages (en, ru, es, de, zh, hi), keyboard shortcuts on desktop.

Everything lives in the browser's storage on your device. The server, when you use one, holds a single JSON document per access code and knows nothing else.

<br clear="right">

> The demo's sync is invite-only (it's the author's instance); deploy your own in five minutes — see below.

---

## Try it locally

```bash
git clone https://github.com/<you>/planly && cd planly
python3 -m http.server 4321
```

Open http://localhost:4321. The app works fully offline once loaded; only sync needs a backend.

## Project layout

```
src/app.html          the whole app: styles, markup, logic (edit this)
src/i18n.js           UI translations, keyed by the Russian source string
build.sh              assembles index.html and dist/ from src/
deploy.sh             build + publish to Cloudflare Pages
index.html            built app (generated — do not edit)
sw.js                 service worker: offline cache, versioned per build
manifest.json         PWA manifest
icons/                app icons (make_icons.py regenerates them)
functions/api/sync.js sync API as a Cloudflare Pages Function (KV storage)
wrangler.example.toml Pages project config template (copy to wrangler.toml, git-ignored)
server/               self-hosted alternative: Node server (app + sync), nginx and systemd examples
Dockerfile            whole instance in one container
docker-compose.yml    the same, with a named volume for the data
tools/shots/          headless-Chrome rig that renders the README screenshots
docs/                 screenshots, GIF and the social preview image
```

---

## Option A — Cloudflare Pages + KV (free, recommended)

Static files are served from Cloudflare's edge; the sync API runs as a Pages
Function backed by Workers KV. The free plan is more than enough: unlimited
static requests, 100k function calls/day, 1k KV writes/day (the app only writes
when something actually changed).

You need a Cloudflare account and Node.js 18+.

```bash
npx wrangler login                                     # opens the browser once
npx wrangler pages project create planly --production-branch=main
npx wrangler kv namespace create PLANLY_SYNC           # prints the namespace id
```

Copy the example config and put the printed id into it (`wrangler.toml` is
git-ignored, so your ids stay out of the repository):

```bash
cp wrangler.example.toml wrangler.toml     # then edit the id line
```

Then deploy:

```bash
./deploy.sh
```

The script builds `dist/`, stamps a new cache version into `sw.js` and uploads
everything with `wrangler pages deploy`. The app is live at
`https://planly-<hash>.pages.dev`; every later `./deploy.sh` ships an update
that installed home-screen apps pick up on their next launch.

**Custom domain.** If your domain's DNS is on Cloudflare: *Workers & Pages →
your project → Custom domains → Set up a custom domain*. Cloudflare creates the
DNS record and the certificate. If DNS is elsewhere, add a `CNAME` to
`planly-<hash>.pages.dev` (apex domains need CNAME flattening, which most
registrars lack — moving DNS to Cloudflare is the easy path).

**Restricting sync to known codes.** By default any code works. To allow only
specific codes (e.g. while the deployment is private), set a secret with a
comma-separated list:

```bash
printf 'AAAA-BBBB-CCCC-DDDD,EEEE-FFFF-GGGG-HHHH' | npx wrangler pages secret put ALLOWED_CODES --project-name planly
```

Other codes get `403 not_allowed` and the app shows "code not allowed on the server".
Delete the secret to open sync again.

> If `wrangler pages project create` complains about a missing `workers.dev`
> subdomain, re-run it once with `--force` to create a classic Pages project.

---

## Option B — Docker (one container, app + sync)

```bash
git clone https://github.com/drkokorev/Planly && cd Planly
docker compose up -d
```

That's the whole thing: http://localhost:8080 serves the app and the sync API
from the same origin, with documents in a named volume. Plain Docker works too:

```bash
docker build -t planly .
docker run -d -p 8080:8080 -v planly-data:/data --name planly planly
```

Put it behind your usual reverse proxy with a certificate — service workers,
offline mode and "Add to Home Screen" all require a secure origin.

The image is `node:22-alpine` with no dependencies to install, runs as the
unprivileged `node` user and has a healthcheck. Useful environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` / `HOST` | `8080` / `0.0.0.0` | where the server listens |
| `DATA_DIR` | `/data` | one JSON file per access code |
| `ALLOWED_CODES` | unset | comma-separated allowlist; unset accepts any code |
| `SERVE_STATIC` | enabled | `0` turns off static serving (sync API only) |

Updating: `git pull && docker compose up -d --build`. Your data lives in the
volume, not in the image.

## Option C — your own server, without Docker

The app is static: copy `index.html`, `sw.js`, `manifest.json`, `version.txt`
and `icons/` (all produced in `dist/` by `./build.sh`) to any web root behind
HTTPS. HTTPS is required for the service worker and for "Add to Home Screen".

For sync, run the reference server — a single Node file with no dependencies
that stores one JSON file per code:

```bash
PORT=8787 DATA_DIR=/var/lib/planly SERVE_STATIC=0 node server/sync-node.js
```

and proxy `/api/sync` to it from your web server. `server/nginx.example.conf`
is a complete nginx site (static files with correct cache headers + the proxy),
`server/planly-sync.service` a systemd unit. Set `ALLOWED_CODES` in the unit's
environment to restrict access, or leave it unset to allow any code.

The same file can serve the app itself instead of nginx — drop `SERVE_STATIC=0`
and point `STATIC_DIR` at the folder with `index.html`. That is exactly what the
Docker image does.

The app calls `api/sync` relative to its own URL, so it works both at a domain
root and in a sub-folder.

**Any other backend** works too — the protocol is two endpoints:

```
GET  /api/sync?code=XXX                → 200 { version, updatedAt, doc }   (doc: null if none)
PUT  /api/sync?code=XXX  { base, doc } → 200 { version }
                                       → 409 { version, doc }  server is ahead: merge and retry
```

`version` is an integer that grows on every write; the client sends the
version it based its document on, so two devices writing at once never lose
data — the loser merges and retries. Codes are `[A-Za-z0-9-]{8,64}`; the client
generates 16 characters from a 32-symbol alphabet.

---

## Using the app

**Install.** Open the URL in Safari (iPhone) or Chrome (Android/desktop) →
Share → *Add to Home Screen* (Chrome: *Install app*). It launches full-screen,
works offline and checks for updates when you return to it.

**Day.** Tap an empty time to add a task there. Long-press a block (or just
drag with a mouse) to move it; the bottom edge changes duration. The circle in
the corner marks it done and sends it to the archive. The toggle in the header
switches between timeline and list; tap the date for the month calendar.

**Repeats.** In a scheduled task's card: *Repeat → Every day* or *Weekdays*.
The app creates the task on every matching day five weeks ahead. Edits in a
repeating task's card apply to that day only; *Apply to all future* pushes them
to the whole series, *Delete only this one* skips one day, *Delete all repeats*
removes the series (completed days stay in the archive).

**Tasks.** Untimed items with folders and priorities. Drag between priority
sections. The clock button opens scheduling: pick a date, a free window, a
manual time, or let it choose the first free window.

**Sync.** Settings → *Sync between devices* → *Enable* creates a code. On the
other device enter it under *Code from another device*. Devices exchange
changes on launch, when you return to the app, every two minutes, and a few
seconds after each edit. The code is the only key to your data — keep it like
a password. Losing it means losing the server copy (your device copy stays).

**Backup.** Settings → *Copy backup* puts the whole dataset as JSON on the
clipboard; *Paste from clipboard* restores it. Storage is per URL: the same app
opened at a different address starts empty.

**Keyboard (desktop).** `←`/`→` day, `T` today, `N` new task, `V` timeline/list,
`1`–`4` tabs, `Esc` close.

---

## The note format

Any folder or date range can be dumped into a note that looks like this:

```
## 2026-10-05
- 09:00 1h Team sync #{Work} !high ^mwt6lle
- 10:30 1h30m Write the report #{Work} !high ^2e3968e
- 1h Gym ^ocnmfdr
## backlog
- 30m Book a doctor #{Home} !low ^o2tud57
```

`## YYYY-MM-DD` opens a day, `## backlog` the untimed list. A line is
`- [HH:MM] [duration] title [#{folder}] [!low|!med|!high|!urgent] [^id]`; everything
except the title is optional. Leave the time out and the app puts the task into
the first free window of that day. Durations are `45m`, `1h`, `1h30m` (Russian
`ч`/`м` work too). The `^id` marker is how a round trip updates existing tasks
instead of creating copies — an LLM should carry it through unchanged; lines
without one simply become new tasks.

Press **To tasks** in a note to apply it. The app shows what it parsed —
how many lines, how many will be updated, how many days are affected — before
anything changes, and the result can be undone.

## How data is stored

| Layer | What | Where | Lifetime |
|---|---|---|---|
| App cache | `index.html`, icons, manifest | Service Worker cache, versioned per build | replaced on every update |
| Your data | tasks, folders, notes, series, settings | `localStorage`, key `planly.v1` | until you clear site data or delete the home-screen app |
| Sync copy | one JSON document | KV (or a file on your server), key = code | 400 days after the last write |

Sync merges per item: each task, note, folder and series carries the time of
its last change, the newer one wins. Deletions are kept as tombstones for 30
days so a device that was offline cannot resurrect them. Repeating tasks are
materialized with deterministic ids (`<series>@<date>`), so two devices that
create the same day independently converge on one record.

---

## Development

```bash
./build.sh            # src/ → index.html + dist/
./deploy.sh           # build + wrangler pages deploy
python3 make_icons.py # regenerate icons/
```

`build.sh` stamps the build time into the settings screen and `version.txt`;
the running app compares them to offer an update. `sw.js` is network-first:
online you always get fresh files, offline you get the cache.

**Adding a language:** add a block to `src/i18n.js` (keys are the Russian UI
strings; nouns with counts are objects with `one/few/many/other` forms chosen
via `Intl.PluralRules`) and a row to `LANGS` in `src/app.html`. Missing keys
fall back to Russian, so partial translations are visible rather than silent.

## License

MIT
