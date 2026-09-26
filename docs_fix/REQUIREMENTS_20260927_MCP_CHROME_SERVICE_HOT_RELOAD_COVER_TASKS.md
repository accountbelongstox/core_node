# MCP Chrome Service, Hot Reload, Global API, Library Cover Tasks, Bottom-Layer Alignment

Scope: `apps/mcp-chrome` (scripts, native-server, chrome-extension, shared), `poly_apps/laravel_main` (AppQyV1 vocabulary covers, global tasks, timers, AiGateway), `poly_apps/pycore_laravel_wordnew_ui` (laravel-manager `vocabulary` + `db-manager`, pycore-manager, wordnew), root `config/*.json`, root `.gitignore`.

## Measured facts (2026-09-27)

- No mcp-chrome systemd unit / Windows task exists. The supervisor launches desktop Chrome, so it needs the desktop user and session; root/LocalSystem services (NSSM, WinSW) cannot open the user's Chrome.
- Linux dev = `bun run dev` (bash-only `trap`; `wxt` dev + `tsup --watch` + `nodemon`). Windows dev = PowerShell `FileSystemWatcher` + full production builds. The two diverge.
- A production extension build takes 52 s (1 m 45 s wall on NTFS); only WXT's incremental dev mode gives immediate reloads.
- The supervisor reloads by opening `popup.html?reloadExtension=1` / `?reconnectNative=1` tabs in Chrome after every artifact change.
- Build output is hidden: `apps/mcp-chrome/.output/build_extension`. The literal is repeated in `wxt.config.ts`, `build_orchestrator.py`, `service_supervisor.py`, `register-local-dev.cjs`, `start.ps1`.
- The API default already derives `api.si.12gm.com` from `config/service_contract.json`, but running background workers capture `apiUrl` at start; `apiUrl` is persisted four times (`api_settings`, `task_center_config`, `tc_run_intent`, `bing_dictionary_client_config`), so an endpoint change only reaches workers while the popup is open.
- Library covers: no global task type exists; `gemini-image` is an unregistered assist-only 30 s poller; `ai-regenerate` is a synchronous Laravel-only call; `getCoverData()` flips `failed` → `pending` on every list read; `submitCover()` never overwrites a ready cover; `LibrariesTab.tsx` reads `library.cover?.status` while the API returns flat `cover_status`; list URLs carry no cache-bust.

## Binding requirements

### R1. Background service (idempotent, Windows + Linux)
1. `scripts/start.sh` / `scripts/start.ps1` ask once, before building: "Install MCP Chrome as a background service (auto-start)? [y/N]". Default **N**. Pre-answers: `MCP_CHROME_AS_SERVICE=yes|no`, flags `--service` / `--no-service` (`-Service` / `-NoService`). Unattended chains (`DD_AUTO_CONTINUE`, no TTY) take the default.
2. Already installed → no prompt; converge (rewrite only on drift, ensure enabled + running) and report status. `--uninstall-service` (`-UninstallService`) stops and removes it. Nothing is removed implicitly.
3. Linux: system unit `ncore-mcp-chrome` via `systemd_service_manager.sh::create_systemd_service`, `User=` the desktop user (`detect_system_user`), desktop session env baked in (`XDG_RUNTIME_DIR`, `DBUS_SESSION_BUS_ADDRESS`, `DISPLAY`, `WAYLAND_DISPLAY`), `Restart=always`, `WantedBy=multi-user.target` (boot start), `systemctl enable`. ExecStart = `start.sh` (the `INVOCATION_ID` branch runs watch mode).
4. Windows: per-user at-logon Scheduled Task `ncore-mcp-chrome` (interactive principal = current user, hidden PowerShell, restart on failure, no execution time limit) registered through shared `StartupManager.ps1` helpers; action = `start.ps1 -ServiceRun`.
5. Service names, native host name and build directories live once in `config/service_contract.json` → `mcp_chrome`.
6. Shared helpers only: bash `prompt_read_default` (`prompt_common.sh`), `converge_systemd_service` + `systemd_desktop_session_env` (`systemd_service_manager.sh`; `pycore_service.sh` reuses the session helper); PowerShell `Read-YesNoDefaultNo` (`NssmServiceManager.ps1`) and `Register-/Test-/Stop-/Unregister-UserLogonTask` (`StartupManager.ps1`). The local `ask_default_*` copies in other launchers keep their return-code contract and are not merged (different semantics).
7. While an installed service exists, `start.sh`/`start.ps1` pause it during their one-time build (both write the same folder) and converge it afterwards; the foreground never starts a second watcher.

### R2. Hot reload (kept, fixed, aligned)
1. One cross-platform dev orchestrator `scripts/dev-watch.mjs` (`bun run dev` on both OSes) runs `tsup --watch` (shared), `nodemon` (native, also watching `packages/shared/dist`), `wxt` dev (extension); a child exit stops all (the service restarts them). The Windows `FileSystemWatcher` build loop is removed.
2. Extension code changes → WXT dev reload (immediate).
3. Native-server rebuild → the running native host detects its own `dist/index.js` change, exits cleanly, and the extension auto-reconnect starts the new host (≤ ~2 s).
4. One-time production build → `build-stamp.json` is written into the extension output; the unpacked extension background polls it and calls `chrome.runtime.reload()` when it changes.
5. The supervisor no longer opens reload tabs per build; it only wakes Chrome (reconnect) when the extension is disconnected.

### R3. Global API
1. Default endpoint = `production` = `https://api.si.12gm.com`, derived only from `config/service_contract.json` (`access.*`); no literal.
2. `api_settings` is the only persisted API location. Every context's `ApiManager` follows `chrome.storage` changes; the background re-points all running workers on change (no popup needed). `apiUrl` copies in `task_center_config`, `tc_run_intent`, `bing_dictionary_client_config` are removed/ignored.
3. One base-URL resolver (`getApiBase()`); the other resolvers delegate to it.

### R4. Build directory
`apps/mcp-chrome/build_output/build_extension` (Firefox: `build_extension_firefox`), named from `service_contract.json` → `mcp_chrome`. Root `.gitignore` lists `apps/mcp-chrome/build_output/`. Chrome must "Load unpacked" once from the new folder (same extension ID via `key`).

### R5. Library cover tasks (Laravel ↔ Chrome ↔ UIs)
1. Contract (`queue_center_contract.json`, schema +1): task types `library_cover` (AI generate; `remote_gemini`, capability `image`) and `library_cover_search` (web image search; `remote_poster`, capability `poster`); block `library_cover` = `{ task_types: { generate, search }, fallback_grace_seconds: 20, fallback_worker_id: "laravel-ai" }`.
2. API:
   - `POST /api/app_qy_v1/vocabulary/libraries/cover/tasks` body `{ ids: int[1..200], mode: "generate"|"search", prompt?: string }` → `{ tasks: LibraryCoverTask[], skipped: {id, reason}[] }`.
   - `GET /api/app_qy_v1/vocabulary/libraries/cover/tasks?ids=1,2` → `{ items: [{ library_id, cover_status, cover_url, image_url, cover_error_message, cover_provider, cover_model, cover_last_generated_at, task }] }`.
   - `LibraryCoverTask = { task_id, task_type, mode, status, handler: "chrome"|"laravel_ai"|null, assigned_to, created_at, updated_at, error }`.
   - Library list rows add `cover_task` and version cover URLs with `?v=<cover_last_generated_at>`.
3. Enqueue is idempotent per library (`group_key = library_cover:{id}`): an active task with the same mode is returned; a pending task with the other mode is cancelled and replaced. The library row turns `pending`, error cleared.
4. Payload `{ library_id, mode, name, language, category, description, prompt?, search_query }`. Result `{ image_base64, mime, provider, model?, latency_ms?, source_url?, prompt? }` → `LibraryCoverTaskProcessor` → `AppQyV1AssistService::submitCover(..., force: true)` (overwrites; the assist pipeline keeps fill-missing semantics).
5. Chrome: `gemini-image` registers as a worker (lane `remote_gemini`, capability `image`) and pulls `library_cover` immediately on Mercure wake; `media-image` also pulls `library_cover_search`. Both upload through the typed result route. The assist claim path stays for background maintenance.
6. Laravel fallback (`AppQyV1LibraryCoverFallbackTask`, 5 s): a pending cover task unclaimed longer than `fallback_grace_seconds` (or immediately when no online worker serves its lane), while Laravel image AI is available (`AiGateway::hasImageProvider()`), is claimed as `laravel-ai` and completed via `regenerateWithAi(fresh: true)`; one task per tick.
7. Reads have no side effects: `getCoverData()` no longer resets `failed`; the cover timer keeps the retry policy.
8. UIs: laravel-manager `LibrariesTab` (per card: Regenerate / Re-search, task badge, flat status fields), `VocabularyLearning` (TS data model + polling until terminal, cache-busted refresh), `db-manager` row actions for the `vocabulary_libraries` table, pycore-manager / wordnew aligned to the same endpoints and types. All strings through i18n.

### R6. Bottom-layer alignment (Chrome)
1. Constants once: native host name, port (`service_contract.json`), build dirs; remove dead storage keys and the unused native `NATIVE_MESSAGE_TYPE`.
2. One Laravel HTTP path per concern: task detail through the worker client; endpoint selection UI logic in one composable shared by `ApiSettings.vue` and `EndpointDropdown.vue`.
3. Worker heartbeat default from one constant.
4. Anything not merged in this pass is listed below as follow-up with its reason.

## Acceptance
- `start.sh` / `start.ps1`: second run with the service installed performs no duplicate registration; `--uninstall-service` removes it; default answer N.
- `bun run build` writes to `build_output/`; `vue-tsc`/typecheck and `php -l` clean on touched files.
- Enqueue → chrome claims within seconds when online; otherwise Laravel AI completes after the grace window; UI shows queued → processing (chrome|laravel_ai) → ready with the new image.

## Implementation status (2026-09-27)

Done:
- R1: `start.sh` (`--service`/`--no-service`/`--uninstall-service`, `MCP_CHROME_AS_SERVICE`), `start.ps1` (`-Service`/`-NoService`/`-UninstallService`/`-ServiceRun`); unit `ncore-mcp-chrome` (desktop user + session env, 200% CPU, 4G, boot start); logon task `ncore-mcp-chrome`.
- R2: `scripts/dev-watch.mjs` (package dev scripts run directly with a held-open stdin pipe — Vite exits on stdin EOF and `bun --filter` does not forward stdin; `--parent-pid` stop); native `util/build-watch.ts` self-exit; `build-stamp.json` + `entrypoints/background/build-reload.ts`; supervisor wakes only when disconnected; popup `reloadExtension` handler removed.
- R3/R6: `api_settings` single source, background re-points workers, one resolver, `useEndpointSelection`, one task-detail path, `StudyGenApiClient`, shared constants from the contract, dead shared sources and storage keys removed, worker-id key and scheduling hooks defined once in `SimpleWorkerRuntimeBase` (13 pre-existing type errors fixed), duplicate `md5Hex` / `SemanticSimilarityEngineProxy` re-exports removed.
- R4: `build_output/` everywhere (wxt, orchestrator, supervisor, register script, launchers, eslint, locale examples); root `.gitignore`.
- R5: contract schema 38; `AppQyV1LibraryCoverTaskService`, `LibraryCoverTaskProcessor`, `AppQyV1LibraryCoverFallbackTask` (terminal-failure sync + parked rows), `AppQyV1VocabularyCoverTaskCtl`, ai-regenerate 409 on a live task; Gemini image worker = `library_cover`/`gemini_image`/assist cover, media-image = `poster`/`library_cover_search`/assist poster; shared `LibraryCoverTaskModel` in laravel-manager (libraries, cover menu, db-manager row actions), pycore-manager, wordnew.

Verified: extension/shared/native typecheck 0 errors (extension was 17); UI typecheck 91 (was 95, none in touched cover code); production build into `build_output/`; dev watcher survives repeated reloads with stdin at EOF, stops all children on SIGTERM and on owner exit; native self-restart after a settled rebuild; `converge_systemd_service` install → unchanged (same PID) → rewritten (restart) → removed; local API status/list/validation responses; one fallback tick against the local database.

Open:
- `api.si.12gm.com` does not serve the new routes yet (`codesync` inactive on this host).
- Local Octane timer driver reports `running=false` since ~7 h before this work; the fallback runs only once the driver ticks.
- Chrome end-to-end (extension load, Gemini/search generation, upload) not run: the extension is not loaded in this machine's Chrome. The unpacked folder moved to `build_output/build_extension`.
- Follow-ups: `bing-dictionary-worker-runtime.ts` still duplicates the `SimpleWorkerRuntimeBase` loop; the interactive `chrome_gemini_image` tool is not serialized with worker generations; nexus-dash convergence can reuse `converge_systemd_service`; `app/chrome-extension/key.pem` is tracked in git.
