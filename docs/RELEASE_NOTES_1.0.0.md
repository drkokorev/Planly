## Planly 1.0.0

First public release.

**Plan the day**
- Vertical timeline: tap to add, drag to move, pull the edge to resize; overlaps split into columns
- List view of the same day with free windows between tasks
- Repeating tasks (daily or by weekday) with per-day edits and "apply to all future"
- Month calendar with underlined days

**Everything else**
- Tasks without a time, in folders, with three priorities and drag-to-reorder
- Notes with headings, lists, bold and italic
- Archive with automatic two-week cleanup
- Optional sync between devices through a single access code (Cloudflare Pages + KV, or the bundled self-hosted Node server)
- Light/dark themes, seven accent colors, six languages (en, ru, es, de, zh, hi)
- Installs as a PWA on iPhone, Android and desktop; works offline

**Self-hosting**
- `README.md` covers Cloudflare Pages + KV and own-server setups
- `server/` has a dependency-free sync server plus nginx and systemd examples
