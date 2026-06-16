# Dashboard Architecture

`pycore_laravel_wordflow_ui` is a single React + Vite SPA that acts as **one shell hosting three "ends"**:

| End | Route prefix | Source | Talks to |
|-----|--------------|--------|----------|
| laravel-manager | `/laravel-manager` | `apps/laravel-manager` + `components/views` | laravel_main API (`/api/...`) |
| pycore-manager | `/pycore-manager` | `apps/pycore-manager` | pycore (`:59000`) via the `/pyapi` proxy + WS `/rpc/ws` |
| wordflow | `/wordflow` | `apps/wordflow` | laravel_main (WordflowApi) |

The shell, top nav, end-switching and routing live in `shell/` + `core/routing/`. Each end owns its pages; shared infrastructure is centralized (below).

## Layers

```
Views / pages            apps/*/pages, components/views
   │
Shared UI + framework     components/shared (Portal), components/admin (Toast/ConfirmModal),
   │                      styles/theme (commonClasses), styles/overlay (OVERLAY_Z)
API layer                 core/api  (api.<module>.<method>, one module per backend area)
   │                      core/api-libs (per-end low-level clients: laravel / pycore / wordflow)
Cross-cutting             core/logstore (GlobalLogPanel), core/persistence, contexts/, hooks/
```

- **One `api` singleton** (`core/api`) exposes a module per backend area — `api.appQyV1`, `api.books`, `api.mcpV1`, `api.itToolsV1`, `api.serverManagerV1`, `api.auth`, `api.aiManagement`, `api.aiStatus`, `api.databaseManager`, `api.systemConfig`, `api.mediaQuery`, `api.inviteCode`. Each extends `BaseAPI` (`core/api/base`) which provides `get/post/put/delete/patch`, the `APICache`, and automatic request logging to the log store.
- **pycore end** uses `core/api-libs/pycore` (`pycoreApi`, `callRpc`, WS subscribe) over the `/pyapi` reverse proxy to `:59000`; **wordflow** uses `core/api-libs/wordflow`.
- See [API.md](API.md) for conventions, the module catalog and endpoint switching.

## Cross-cutting frameworks (use these, don't reinvent)

- **Overlays** — every modal / login / toast / popover renders through `components/shared/Portal` (to `<body>`) with a z-index from the `OVERLAY_Z` scale in `styles/overlay.ts` (`modal` < `login` < `toast` < `error`). Never use a raw `fixed inset-0 z-50`. See [UI.md](UI.md).
- **Logging** — `core/logstore` holds a 1000-entry ring; `GlobalLogPanel` is the floating bottom dock (`z-[150]`, collapsed pill by default). `BaseAPI` auto-logs every request (health probes filtered); raw `fetch` calls must log explicitly.
- **Notifications** — `useToast()` + `ConfirmModal` from `components/admin`.
- **Theme** — `styles/theme` `commonClasses` (card/input/button/…); pycore-manager pages use the `.pc-glass` surface.

## Build & run

`npm install` → `npm run dev` (Vite dev server) / `npm run build` (`vite build`, esbuild — no `tsc` type-check in the build). It is served by laravel_main as the dashboard SPA in production.

## Directory map (essentials)

```
apps/{laravel-manager,pycore-manager,wordflow}/   per-end pages
components/{views,vocabulary,ai-tools,admin,shared,...}
core/
  api/{base,modules}        api singleton + per-area modules
  api-libs/{laravel,pycore,wordflow,base}
  routing/                  shell routes
  logstore/, logs/          GlobalLogPanel + ring buffer
  models/, persistence/, contexts/, health/, i18n/, notify/, tasks/
styles/{theme,overlay}      commonClasses + OVERLAY_Z
shell/                      app shell + end switcher
config/                     api-endpoints, app config
```
