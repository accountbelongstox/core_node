# laravel_dashboard ⇄ laravel_main — API/Functional Alignment Progress

**Owner:** alignment refactor · **Created:** 2026-05-19 · **Method:** multi-role
(dashboard-expectations explorer + laravel_main API-surface explorer, cross-referenced).

Goal: every endpoint the dashboard calls must exist in `laravel_main` with a matching
path + request/response shape; functional gaps extended on both sides.

## Baseline (already aligned — verified)

| Item | Status | Evidence |
|---|---|---|
| Backend base port | ✅ 9000 | dashboard `config/constants.ts` `DEFAULT_API_PORT=9000`, `api-endpoints.ts` (all entries 9000), `.env` `VITE_API_BASE_URL=http://192.168.50.3:9000`; laravel_main launchers restored to 9000 |
| Auth scheme | ✅ Bearer/Sanctum | dashboard sends `Authorization: Bearer`; laravel_main `auth:sanctum` middleware |
| Response envelope | ✅ `{success,data,message}` | laravel_main `ApiResponse` trait ↔ dashboard auto-extract `data` |
| SSL certs path (old report claimed singular/plural break) | ✅ STALE/RESOLVED | no `servermanager/v1/certificate/` (singular) in dashboard `core/`/`config/`; it already uses plural `/certificates/` = backend |

## Legend
✅ aligned · 🟦 path/shape mismatch (fix one side) · 🟥 missing in laravel_main (extend backend) ·
🟧 missing/!verified in dashboard · ⏳ blocked by user-identity refactor Phase B · ❓ needs `php artisan route:list` confirm

## Module status (cross-referenced)

| # | Module | Dashboard expects | laravel_main has | Status | Action |
|--:|---|---|---|---|---|
| 1 | Auth (login/register/logout/user) | `/api/login`,`/api/register`,`/api/app_qy_v1/{login,register,logout,user}` | both `/api/*` (auth.php) and AppQyV1 auth exist | ✅ | none |
| 2 | User profile/preferences | `/api/user/profile`,`/user/preferences`, `/api/app_qy_v1/user/profile` | `/api/user/*` (UserProfileController) ✓; AppQyV1 profile ✓ | ⏳ | profile/extension fields depend on identity refactor **Phase B** (per-app `*_user_profile`); reconcile shape then |
| 3 | Invite codes | `/api/admin/invite-codes*`,`/api/invite-codes/{public,validate}` | all present | ✅ | none |
| 4 | ServerManager V1 — system/files/executor/nginx/unified/certs | 32 eps | all present (incl. plural `/certificates/`, `/unified/{start,stop,restart,deploy,octane/*}`) | ✅ | none (old "29/32" report superseded) |
| 5 | Database viewer | `/api/dashboard/db-viewer/{tables,tables/{t}/structure,tables/{t}/data}` | all present (auth:sanctum) | ✅ | none |
| 6 | Bank V1 admin | 23 `/api/bank/admin/*` | present (route:list earlier confirmed bank admin set) | ❓→✅ | confirm `data/*`,`logs/*`,`codes/*` shapes via route:list |
| 7 | System config / info | `/api_info`,`/api/config/{paths,server,environment}` | all present | ✅ | `/api_info` now ETag+`max-age=300` server-side & 60s client TTL + single-flight (see "API detection redundancy fix" 2026-05-19) |
| 8 | Octane timer / octane-tasks | `/api/octane/timer/*`, `/octane-tasks/*` | all present | ✅ | dashboard could surface these (timer status panel) — optional feature add |
| 9 | Task/Worker system | (not yet a dashboard panel) | `/api/task/*`,`/api/worker/*` full | 🟧 | optional: add a dashboard Task/Worker monitor panel (functional extension) |
| 10 | AI Tools — translation | `/ai_tools/translation/translate`, `…/detect-translate`, `…/languages` | `…/translate`,`…/languages` ✓; **detect path differs** (`/translation/detect` web route exists) | 🟦 | align dashboard `detect-translate` → backend path, or add backend alias |
| 11 | AI Tools — TTS | `…/tts/{languages,voices,options,generate,batch-generate,queue/stats,queue/status,queue_batch}` | `queue_batch` ✓ (AppQyV1AITools.php:60); others mostly ✓ | ❓ | confirm `tts/queue/status`,`tts/options` exist; add if missing 🟥 |
| 12 | AI Tools — image generate | `/ai_tools/image/generate` | not found in AppQyV1 routes | 🟥 | extend backend: add image-generate endpoint (or align to existing cover/gemini service) |
| 13 | AI Tools — speech transcribe | `/ai_tools/speech/transcribe` | not found | 🟥 | extend backend: add speech-transcribe endpoint (or mark dashboard feature WIP) |
| 14 | Vocabulary — libraries/words/stats | `/vocabulary/libraries*`,`/vocabulary/statistics`,`/words/learning`,`/vocabulary/libraries/{id}/words` | AppQyV1 vocabulary routes exist (route:list earlier showed `/vocabulary/libraries*`) | ❓ | confirm `/words/learning` vs backend `/learning/words`; reconcile path |
| 15 | Vocabulary — progress/review | `/progress/update`, `/vocabulary/words/{id}/review`, `/user/stats` | backend uses `/learning/progress`, `/words/{id}/review`, `/user/stats` | 🟦 | path-shape mismatch — align dashboard paths to backend (or add backend aliases) |
| 16 | Vocabulary — document upload/extract | `/vocabulary/document/upload`,`…/{id}/extract-sentences`,`…/extract-words` | not found (backend has `/learning/upload`) | 🟦/🟥 | reconcile to `/learning/upload`; add extract-sentences/words if absent |
| 17 | Vocabulary — export csv/json/anki/pdf/text | `/vocabulary/export/{csv,json,anki,pdf,text}` | not found | 🟥 | extend backend: add export endpoints (5) |
| 18 | System init (AppQyV1) | `/system/initialization/status`,`/system/initialization/initialize`,`/system/languages`,`/vocabulary/dictionary/statistics` | backend: `/system/initialization-status`,`/system/initialize`,`/system/supported-languages`,`/system/dictionary-statistics` | 🟦 | path-shape mismatch — align dashboard → backend canonical paths |
| 19 | User initialization | `/user/initialization/complete` | backend `/user/initialize` | 🟦 | align path |
| 20 | MCP V1 — screenshots/placeholders/task-dispatch | ~28 eps | screenshots/placeholders/task-dispatch present | ✅ | mostly aligned |
| 21 | MCP V1 — `/tasks/{id}/execute` | frontend calls it | not found in McpV1Router | 🟥 | extend backend or remove dashboard call |
| 22 | IT Tools V1 (60+) | unified + crypto/converter/web/text/math | route:list earlier showed extensive `/api/ittools/v1/*` | ❓→✅ | spot-confirm a sample; assume aligned (large suite present) |
| 23 | Code-browser / static-resources / clipboard | `/code-browser/*`,`/static-resources/*`,`/clipboard/*` | all present (web.php) | ✅ | none |
| 24 | Public avatar cache | `/api/public/avatar*` | all present | ✅ | dashboard could add an avatar-cache admin panel — optional |

## Functional-extension candidates (dashboard gains, backend already has)
- Task/Worker monitor panel (#9) — backend `/api/task/*`,`/api/worker/*` fully exist.
- Octane timer status panel (#8) — backend `/api/octane/timer/*` exist.
- Avatar-cache admin (#24), startup-monitor view (`/startup-monitor/*`).

## Backend-extension required (🟥 — laravel_main work)
1. AI image generate (#12) · 2. Speech transcribe (#13) · 3. Vocabulary export ×5 (#17) ·
4. MCP `/tasks/{id}/execute` (#21) · 5. (verify) document extract-sentences/words (#16) ·
6. (verify) `tts/queue/status`,`tts/options` (#11).

## Path-shape reconciliations (🟦 — prefer aligning dashboard to backend canonical)
detect-translate (#10), progress/update→learning/progress & review path (#15),
document upload→learning/upload (#16), system init/* paths (#18), user init path (#19).

## Blocked
- #2 user profile/preferences shape ⏳ depends on the **user-identity refactor Phase B**
  (per-app `*_user_profile` extension tables) — reconcile profile fields after Phase B.

## 2026-05-19 — progress log (multi-role)

Static route-file resolution done (no server needed): AppQyV1/McpV1/Bank/ITTools
paths reconstructed from `routes/*Router/*`. Result: **46+ ✅ aligned**, **10 🟦
reconciled**, **9 🟥 to extend**.

- ✅ **AL1 DONE — 🟦 path reconciliations applied** (dashboard → backend canonical),
  verified no stale paths remain:
  - `core/api/modules/AppQyV1.ts`: `/words/learning`→`/learning/words`,
    `/progress/update`→`/learning/progress`,
    `/vocabulary/words/{id}/review`→`/words/{id}/review`,
    `/vocabulary/document/upload`→`/learning/upload`,
    `/system/initialization/status`→`/system/initialization-status`,
    `/vocabulary/dictionary/statistics`→`/system/dictionary-statistics`,
    `/system/initialization/initialize`→`/system/initialize`,
    `/system/languages`→`/system/supported-languages`,
    `/user/initialization/complete`→`/user/initialize`.
  - `core/models/AppQyV1Model.ts`: `/system/languages`→`/system/supported-languages`.
- 🟥 **AL2 — backend extensions (9), exact targets:**
  1. `ai_tools/translation/detect` — alias to existing detect controller (web
     `/translation/detect`) → add API route in `routes/AppQyV1Router/AppQyV1AITools.php`.
  2. `ai_tools/image/generate` — new `AppQyV1ImageGenerationController`, reuse
     Gemini/CoverImage service (`app/Apps/AppQyV1/AppQyV1Services/`).
  3. `ai_tools/speech/transcribe` — new `AppQyV1SpeechController`.
  4–5. `learning/document/{id}/extract-sentences` & `extract-words` — extend
     `AppQyV1VocabularyUploadController`, `routes/AppQyV1Router/AppQyV1Learning.php`.
  6–10. `vocabulary/export/{csv,json,anki,pdf,text}` — new `AppQyV1ExportController`,
     `AppQyV1Learning.php`.
  11. `mcp/v1/tasks/{id}/execute` — extend MCP task controller, `routes/McpV1Router/api.php`.
- 🟧 **AL3 — beautify + functional panels** (punch-list captured): loading/empty
  skeletons, dark-mode parity, spacing/typography grid, responsive tables,
  button/form consistency, card hover, error/success UI; ADD `TaskWorkerPanel.tsx`
  + Octane-timer panel (backend `/api/task/*`,`/api/worker/*`,`/api/octane/timer/*`
  already exist). Design tokens: `styles/theme.ts` (`commonClasses`).

## 2026-05-19 — API detection redundancy fix (realized contract)

> **⚠️ CORRECTION — 2026-05-19 (supersedes the earlier same-day "lazy /
> probe-only-when-the-switcher-dropdown-opens / once-only-for-switcher"
> description below and in the sibling docs).** Detection is **automatic at app
> startup**, NOT lazy and NOT click-triggered. `ApiManager` probes **ALL
> endpoints in parallel exactly once per app load** (single-flight via a stored
> `healthPassPromise`, React-18 StrictMode-safe, no timers/intervals, no
> retries). `App.tsx` triggers this at startup and dispatches
> `api-health-initialized` after the parallel pass settles;
> `ApiEndpointSwitcher.tsx` is now **read-only** — it renders results and listens
> for that event, and no longer probes on dropdown open. Active-endpoint
> precedence after the single parallel pass: (1) `api_user_modified` if healthy →
> use it; (2) else stored `api_current_endpoint` / `api_auto_detected` if healthy
> → use it; (3) else the first healthy endpoint by priority order → use it **and
> write it back** to `api_auto_detected`/`api_current_endpoint`; (4) else (none
> healthy) → highest-priority endpoint as fallback, left marked unhealthy.
> Principle 以能使用的为准: never hard-pin a dead endpoint; auto-failover to an
> available one. Auto-detection **NEVER overwrites `api_user_modified`** (only
> the manual switcher sets it) — a dead manual choice still yields a working
> session endpoint without deleting the saved manual key. The bullets below are
> retained for history; read this correction note as authoritative.

The endpoint detection / health-check path was reworked end-to-end (frontend +
backend landed; this is the documented realized contract — not a plan):

**Frontend (`laravel_dashboard`)**
- `services/ApiManager.ts` — detection runs **automatically at app startup**,
  probing **all endpoints in parallel exactly once per app load**, single-flight
  via a stored `healthPassPromise` (StrictMode-safe), no timers/intervals, no
  retries. Active-endpoint precedence after the parallel pass: (1)
  `api_user_modified` if healthy; (2) else stored `api_current_endpoint` /
  `api_auto_detected` if healthy; (3) else first healthy by priority order, then
  **written back** to `api_auto_detected`/`api_current_endpoint`; (4) else
  highest-priority endpoint as an (unhealthy) fallback. Auto-detection never
  overwrites `api_user_modified`; 以能使用的为准 — a dead pinned/manual choice
  still resolves to a working session endpoint.
- The single all-endpoints parallel pass is the only health pass; it feeds the
  switcher dots and the active-endpoint selection. It is single-flight via the
  stored `healthPassPromise` and is **never on a timer** (the old 60s background
  interval is gone) and **never re-probed unless the user manually switches**.
- `App.tsx` — triggers detection at startup and dispatches
  `api-health-initialized` after the parallel pass settles (no separate blocking
  fan-out).
- `components/ApiEndpointSwitcher.tsx` — **read-only**: it renders the health
  results and listens for `api-health-initialized`. It no longer probes on
  dropdown open (the prior "lazy on dropdown open" behavior is removed).
- `core/api/modules/SystemConfigAPI.ts` — `/api_info` has a static shared TTL
  cache (TTL 60000 ms) + single-flight keyed by resolved URL+params, shared by
  `Settings.tsx` & `ApiTester.tsx`.
- `core/api/base/BaseAPI.ts` + `core/types.ts` — added `retry?: boolean` to
  `APIRequestConfig` and a `retry` param to `get()` (default `true`); `/api_info`
  uses `retry=false` so there is no 3× retry storm. Health checks use raw fetch
  with no retry. All endpoints are kept in `config/api-endpoints.ts` (no pruning).

**Backend (`laravel_main`)** — root cause: `/api_info` is a `routes/web.php`
route and no `cors.php` path matched it, so OPTIONS preflight fell through the
full web middleware stack → ~21 s preflight hang.
- `config/cors.php` — added `'api/health'` and `'api_info'` to `paths` so
  `HandleCors` returns an immediate 204; `max_age` changed `0` →
  `env('CORS_MAX_AGE', 86400)` so the browser caches preflights.
- `routes/api.php` — `GET /api/health` wrapped in `Route::withoutMiddleware([...])`
  (no Sanctum/session boot), `Cache-Control: no-store, max-age=0`, body shape
  unchanged.
- `app/Http/EnvironmentApiInfo/ApiInfoIndex.php` — `/api_info` sends a stable
  `ETag` + `Cache-Control: public, max-age=300, stale-while-revalidate=600` and
  handles `If-None-Match` → 304; JSON body unchanged.

### Canonical contract

| Endpoint | Behavior | Auth | Cache |
|---|---|---|---|
| `GET {base}/api/health` | `200 { status:'healthy', service, timestamp, version }`, liveness-only; CORS fast-path, no web/Sanctum middleware on the OPTIONS preflight | none | `no-store, max-age=0` |
| `GET {base}/api_info[?app=]` | catalog JSON (body unchanged) | as before | server `ETag` + `max-age=300` (304 on `If-None-Match`); client TTL cache 60 s + single-flight |

Detection: **automatic at app startup**, all endpoints probed **in parallel
exactly once per app load** (single-flight via `healthPassPromise`,
StrictMode-safe, no timers/retries). Active-endpoint precedence: healthy
`api_user_modified` → healthy stored `api_current_endpoint`/`api_auto_detected`
→ first healthy by priority (written back) → highest-priority unhealthy
fallback. **No re-probe unless the user manually switches.** The single parallel
pass both feeds the switcher dots and drives selection; `ApiEndpointSwitcher` is
read-only (no probe on dropdown open).

### 2026-05-19 — noise.svg → local data-URI (frontend init hygiene)

Frontend-only init-hygiene change, **no backend coupling**: the external
decorative texture `https://grainy-gradients.vercel.app/noise.svg` (which 404'd
and caused N failed cross-origin requests during init) was replaced with a
fully local inline SVG `feTurbulence` data URI defined once in
`poly_apps/laravel_dashboard/utils/noiseTexture.ts` and consumed by
`BentoCard.tsx` and `tools/HexToRgb.tsx`. No external/CDN dependency remains.
Not JS-blocking, but it removes network/console overhead during init. This is
**not** part of the linked frontend+backend health/CORS contract.

### ⚠️ LINKED-CHANGE constraint (联动改)

> **The frontend probing contract and the backend `/api/health` + CORS/`cors.php`
> paths + `/api_info` caching MUST be changed together — changing one side's
> health/api_info contract, CORS paths, or cache headers without the other
> reintroduces the preflight-hang / redundant-probe bug.**

Any change to: the auto-parallel-once-at-startup probe / precedence /
single-flight (`healthPassPromise`) in `ApiManager.ts`; the `/api/health` route,
its middleware bypass, or body shape; the `cors.php` `paths`/`max_age`; or the
`/api_info` ETag / `Cache-Control` — is a coordinated frontend+backend edit,
never a one-sided one.

## Next steps (recommended order)
1. AL2: implement the 9 🟥 backend endpoints (then flip their rows ✅).
2. AL3: beautify pass + add Task/Worker + Octane-timer panels.
3. (optional) `php artisan route:list` on :9000 to re-confirm post-extension.
4. After identity Phase B: reconcile #2 (profile/preferences shape).
5. Point dashboard's stale ALIGNMENT_*/API_ALIGNMENT_* reports here.

_Update the Status column as items land. This file supersedes the older scattered
ALIGNMENT_*/API_ALIGNMENT_* reports as the single live tracker._
