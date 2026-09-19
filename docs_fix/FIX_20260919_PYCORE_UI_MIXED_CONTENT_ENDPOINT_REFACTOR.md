# FIX 2026-09-19 — pycore-manager: mixed-content endpoint refactor + appearance widgets

## Task scope (user, 2026-09-19)

1. Add dark/light mode and language selector widgets to the `/pycore-manager`
   top-right corner, and a global appearance section on
   `/pycore-manager/settings`.
2. Console error: `ProtocolFetch.ts:233 Mixed Content: The page at
   'https://12gm.com/pycore-manager/vocabulary' was loaded over HTTPS, but
   requested an insecure resource 'http://43.163.112.77:9000/api/health'`.
3. Selecting `https://api.si.12gm.com` in the top-right Laravel endpoint
   switcher + re-probe still showed `离线 · 已检测 <epoch-ms>` — "why doesn't it
   work; refactor the underlying layer".

## Diagnosis (field-verified)

- `https://api.si.12gm.com/api/health` is healthy: HTTP 200 in ~0.14s, JSON
  body `{"status":"healthy",...}`, and the CORS preflight from origin
  `https://12gm.com` passes (reflects `content-type, authorization,
  cache-control, expires, pragma`). The server was never the problem.
- The deployment at `https://12gm.com` serves the Vite dev build of
  `poly_apps/pycore_laravel_wordnew_ui`, so the running code is this source.
- Root cause chain: the persisted Laravel endpoint was
  `http://43.163.112.77:9000` (contract host `cloud`, HTTP :9000). On an HTTPS
  page the browser's mixed-content policy blocks every plain-HTTP subresource
  BEFORE the network — the health probe (and all API calls) never leave the
  browser. The console error was that guaranteed-to-fail probe.
- Secondary defects in the old底层:
  - probes treated "blocked by browser" as "offline", a misleading status;
  - `preselectEndpointSync()` pointed first-paint requests at the dead HTTP
    endpoint on HTTPS pages;
  - a blocked-but-persisted pin kept the whole page dead with no recovery;
  - the switcher rendered `last_checked` as a raw epoch-ms number.

## Changes (all in `poly_apps/pycore_laravel_wordnew_ui`)

### Transport / endpoint layer (mixed-content aware)

- `core/integrations/laravel/LaravelEndpoints.ts`
  - New `MIXED_CONTENT_BLOCKED_ERROR` code and
    `isEndpointMixedContentBlocked(endpoint)`: true when the page is HTTPS and
    the endpoint is plain HTTP on a non-loopback host (loopback
    localhost/127.x/::1 stays fetchable as a potentially trustworthy origin).
- `core/integrations/laravel/ApiManager.ts`
  - `checkEndpoint()` short-circuits blocked endpoints: records
    `{ isHealthy: false, error: MIXED_CONTENT_BLOCKED_ERROR }` WITHOUT issuing
    a request — the console Mixed Content error is gone and the status is
    honest.
  - `recheckEndpoints()`: when the persisted pin is mixed-content-blocked, the
    pin is KEPT in localStorage (HTTP/LAN views still honor it), a full sweep
    runs, and the first healthy endpoint is TRANSIENTLY activated for this
    secure context (no storage rewrite).
  - `preselectEndpointSync()`: skips blocked stored endpoints and picks the
    highest-priority reachable one, so first-paint requests already target a
    working HTTPS endpoint.
  - `switchEndpoint()` unchanged in shape: a blocked target now fails with the
    explicit `MIXED_CONTENT_BLOCKED_ERROR` instead of "Network unreachable".
- `core/integrations/laravel/LaravelAPI.ts`
  - `LaravelApiEndpoint` gains `blocked?: boolean`; `toEndpointRow()` fills it.

### UI

- `apps/pycore-manager/components/PcAppearanceControls.tsx` (new): compact
  dark/light toggle + language selector reading shell state (`useShell()`);
  mounted in the top bar via `components/PcTopBar.tsx` (right of the endpoint
  switcher). Same shared state as the floating ShellControls dock.
- `apps/pycore-manager/pages/PcSettingsPage.tsx`: new "Global" section with the
  dark-mode switch row and language select row (i18n'd); replaces the old
  "appearance is managed by the shell controls" info note. File header comment
  updated to match.
- `apps/pycore-manager/components/PcLaravelEndpointSwitcher.tsx`:
  - blocked endpoints show an amber dot + `endpoint.blocked` label;
  - `last_checked` renders via `toLocaleTimeString()` instead of raw epoch ms;
  - a failed switch to a blocked endpoint maps to the readable
    `endpoint.blockedSwitch` message.

### i18n

- `apps/pycore-manager/pc-locales/PcEnCore.ts` / `PcZhCore.ts`: added
  `endpoint.blocked`, `endpoint.blockedSwitch`, and the `appearance.*` group
  (title / darkMode / darkModeDesc / lightMode / language / languageDesc).

## Verification

- `npx tsc --noEmit`: zero errors in `apps/pycore-manager`,
  `core/integrations/laravel`, `core/network` (remaining errors are
  pre-existing in `apps/wordnew` / `apps/laravel-manager`, untouched).
- Live probe: `curl https://api.si.12gm.com/api/health` → 200;
  `OPTIONS` preflight with origin `https://12gm.com` → 204 with correct
  `access-control-allow-*`.

## Expected runtime behavior after reload

- `http://43.163.112.77:9000` shows "被拦截 / blocked" (amber dot) and is never
  fetched from the HTTPS page — no more Mixed Content console errors.
- The active endpoint transparently falls over to `https://api.si.12gm.com`
  (verified healthy) without touching the stored pin; revisiting over HTTP/LAN
  restores the pinned endpoint.
