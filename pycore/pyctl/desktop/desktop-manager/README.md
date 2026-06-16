# Desktop Manager UI (pycore edition) — LEGACY / SUPERSEDED

> **UI (updated — this app is legacy):** The pycore desktop UI is now the unified
> shell `poly_apps/pycore_laravel_wordflow_ui` — its **pycore-manager** end, loaded by
> `pyservice` (`pyservice.ps1` / `pyservice.sh`) at
> `http://localhost:<UiPort>/pycore-manager` (Vite/pnpm; default end via the shell's
> `/`→`/pycore-manager` redirect). This standalone `desktop-manager` app (dev server
> on `:15654`) is **superseded** and kept for reference only. Backend is unchanged
> (rpc_v2 on `:59000`; `/pyapi` proxy + direct `ws://host:59000/rpc/ws`); the live
> backend log is now a GLOBAL floating collapsible panel on every pycore page. The
> notes below describe the legacy app.

A React 19 + Vite 6 + Tailwind v4 dashboard that is the launched UI for the pycore
service. The PySide6 webview (started by `pyservice.ps1` / `pyservice.sh`) loads
this app; it talks to the local pycore backend (no Gemini).

## How it runs

```
pyservice.ps1 / pyservice.sh
   ├─ prerequisites: scripts/iniscripts/install_desktop_manager.* → npm install (idempotent)
   ├─ launches this UI:  npm run dev   (Vite dev server on PYCORE_UI_PORT, default 15654)
   │                     npm run build + start  (static prod, with -UiBuild / --ui-build)
   ├─ exports PYCORE_UI_URL=http://localhost:15654
   └─ launches the pycore worker; its PySide6 webview loads PYCORE_UI_URL
```

`server.ts` (Node/Express) serves the SPA and bridges it to pycore:

| UI call                   | Goes to pycore                                               |
|---------------------------|-------------------------------------------------------------|
| `GET /api/queue`          | `GET /voice-subtitle/queue` (mapped to the React item shape)|
| `POST /api/queue` (empty) | `POST /voice-subtitle/clear`                                |
| `POST /api/tts`           | `POST /voice-subtitle/add-text` (server-side TTS pipeline)  |
| `/pyapi/*`                | transparent reverse proxy to the pycore backend (same-origin)|

The **AI Status** tab (`src/pages/AiStatusPage.tsx`) calls
`GET /pyapi/api/local/ai/probe` on mount to show each AI provider's availability
(available / configured-but-unavailable / not-configured), masked key, model
count and latency. Its **Refresh** button re-probes with `?refresh=1`.

The **Translation Queue** tab (`src/pages/TranslationQueuePage.tsx`) calls
`GET /pyapi/api/local/translation/queue` on mount and every ~5s to show Laravel's
pending translation queue: summary chips (pending / processing / completed /
failed), a `laravel_reachable` indicator (offline banner when false) and the
pending items (word(s), prominent priority, status, source→target language, age).
Per-item priority buttons (raise / boost-to-top / lower) POST to
`.../queue/priority`, and a stack control POSTs to `.../queue/stack` to dedup+bump
existing words or enqueue new ones at high priority. Items the backend flagged
`recently_bumped` get an animated amber ring + "bumped" badge so qyApp-driven
priority jumps show in real time.

State (settings + a queue snapshot) is cached in `localStorage` (`src/store.ts`)
for instant paint and offline tolerance; pycore remains the source of truth.

## Config (env)

| Var               | Default                  | Meaning                            |
|-------------------|--------------------------|------------------------------------|
| `PYCORE_UI_PORT`  | `15654`                  | Port this UI server listens on     |
| `PYCORE_API_BASE` | `http://localhost:59000` | pycore backend base URL            |
| `NODE_ENV`        | (unset = dev)            | `production` serves `dist/`         |

## Scripts

- `npm run dev`   — Vite dev server via `server.ts` (used by `pyservice` by default)
- `npm run build` — `vite build` + bundle `server.ts` → `dist/server.cjs`
- `npm run start` — serve the built `dist/` (set `NODE_ENV=production`)
- `npm run lint`  — `tsc --noEmit`

## TODO (not yet wired to pycore)

- `POST /api/analyze-screenshot` → pycore screenshot/OCR
- `POST /api/convert-audio-text` → pycore audio transcribe
- Fine-grained queue add/remove sync (currently read + clear; reorder is client-cached)
