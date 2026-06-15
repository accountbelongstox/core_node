
# API Endpoint Implementation Progress

> Updated: 2025-05-20

## Summary
- **Total Endpoints Defined in Docs**: 40+
- **Total Endpoints Implemented in Client**: 40+
- **Mock Services Status**: Active & Comprehensive

## Implementation Details

### System API
- [x] `/api_info` (GET) — server `ETag` + `Cache-Control: public, max-age=300, stale-while-revalidate=600` (304 on `If-None-Match`); client 60s TTL cache + single-flight (`core/api/modules/SystemConfigAPI.ts`); fetched with `retry=false`
- [x] `/api/health` (GET) — liveness-only `{ status:'healthy', service, timestamp, version }`, no auth, `Cache-Control: no-store, max-age=0`, CORS fast-path (no web/Sanctum middleware on the OPTIONS preflight); used by endpoint detection (raw fetch, no retry)
- [x] `/csrf-token` (GET)
- [x] Code Browser File Ops (GET/POST)
- [x] Static Resource Ops (GET/POST)

### Endpoint detection / health-check (realized contract — updated 2026-06-11, "STORED-FIRST + per-end offline recheck")
> **⚠️ CORRECTION 2026-06-11 — supersedes ALL earlier detection wording (2026-05-19 "parallel-all-once / no timers" included). This section is the canonical contract; sibling docs defer to it.**

**The contract** — all 3 ends, every entry point (startup, all-Offline interval retry, manual re-detect) runs the SAME stored-first pass (one code path per end, single-flight, StrictMode-safe, config **3000ms probe timeout** — never override shorter; a 1s override once regressed the Octane cold-worker fix and froze a false all-Offline state):
1. **Stored-first**: probe ONLY the stored last-used endpoint (`api_user_modified` → `api_current_endpoint` → `api_auto_detected` → in-memory current). If it answers, keep it — nothing else is probed (one request total).
2. **Else full sweep**: probe ALL endpoints in parallel and auto-switch to the highest-weight healthy one (user pin → stored → config priority); write the pick back to `api_auto_detected`/`api_current_endpoint`. `api_user_modified` is NEVER written by auto-detection — a dead manual pin still yields a working session endpoint (以能使用的为准).
3. **Else interval retry**: while EVERYTHING is Offline, re-run the same pass at the per-end configurable `healthCheckInterval` (default 60s, floor 5s, persisted per browser, read fresh each tick) and stop as soon as one endpoint recovers. A healthy backend is never polled. The loop is path-prefix gated: it runs only while its end's root is mounted.

**Per-end wiring** (shared loop: `core/health/OfflineRecheckScheduler.ts`):
- **laravel-manager** (`/laravel-manager`): `services/ApiManager.ts` (`recheckEndpoints()`) + glue `services/ApiHealthRecheck.ts`, loop owned by `App.tsx`; interval + manual "Re-detect" in `ApiEndpointSwitcher.tsx` (localStorage `api_recheck_interval_ms`). Every pass dispatches `api-health-initialized`; the switcher is read-only otherwise (no probe on dropdown open).
- **wordflow** (`/wordflow`): `core/api-libs/wordflow/WordflowApiManager.ts` (`recheckAndFailover()`) + `WordflowHealthRecheck.ts`, loop owned by `WfApp.tsx` (`initialize()` single-flighted, shared with WordflowApi's lazy `ensureReady`); interval + Refresh in `WfSettingsApiServerPage` (localStorage `wf_api_recheck_interval_ms`, event `wf-api-health-changed`).
- **pycore-manager** (`/pycore-manager`): `core/api-libs/pycore/PycoreHealth.ts` — single endpoint `/pyapi/ping`, so stored-first degenerates to one ping per check; loop owned by `PcApp.tsx`; status + Re-check + interval in `PcSettingsPage` "Connection" (localStorage `pc_health_recheck_interval_ms`, event `pycore-health-changed`).

⚠️ **LINKED-CHANGE (联动改):** this frontend probing contract and the backend `/api/health` + CORS/`cors.php` paths + `/api_info` caching MUST be changed together — changing one side's health/api_info contract, CORS paths, or cache headers without the other reintroduces the preflight-hang / redundant-probe bug. See `API_ALIGNMENT_PROGRESS.md` for the backend side.

### Auth API
- [x] `/api/login` (POST)
- [x] `/api/register` (POST)
- [x] `/api/logout` (POST)

### ITTools
- **Crypto**: 
  - [x] Hash, Bcrypt, UUID, ULID, Token, Basic Auth, HMAC, RSA, OTP, Password Analysis, AES Encrypt/Decrypt
- **Converter**:
  - [x] Base64, URL, Case, JSON/YAML, DateTime, Temperature, Roman/Arabic
- **Web**:
  - [x] JSON Prettify/Minify, JWT Parse, Markdown to HTML, SQL Format, XML Format, YAML Format, QR Code, WiFi QR
- **Advanced**:
  - [x] Image Compress, Image Crop, PDF Split

### MCP (Media Control Protocol)
- **Screenshots**:
  - [x] Upload, Latest, Search
- **Task Dispatch**:
  - [x] Categories, Add to Queue
- **Voice Subtitle**:
  - [x] Add to Queue, Get Queue, Get Current, Controls (Next/Prev)

### Developer Utilities UI Alignment
- [x] Mapped `TOOL_UI_SCHEMAS` to all key ITTools endpoints.
- [x] Universal Tool handles inputs (File, Text, Color, Select) and outputs (Image, HTML, JSON).
- [x] Expanded Categories to match functionality (Crypto, Formatters, Web).

## Next Steps
- Implement `VoiceSubtitle` specific UI component for better playback control (currently relying on generic API tester).
- Add specific UI for `CodeBrowser` to use the new API endpoints instead of just mock constants (Mock logic is ready in `systemMock`).
