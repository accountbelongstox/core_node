
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

### Endpoint detection / health-check (realized contract — updated 2026-05-19, "API detection redundancy fix")
> **⚠️ CORRECTION 2026-05-19 — supersedes the earlier same-day "lazy / probe-on-dropdown-open / once-only-for-switcher" description.** Detection is **automatic at app startup**, NOT lazy/click-triggered.
- **Automatic at app startup**: `ApiManager` probes **ALL endpoints in parallel exactly once per app load**, single-flight via a stored `healthPassPromise` (React-18 StrictMode-safe), no timers/intervals, no retries.
- `App.tsx` triggers detection at startup and dispatches `api-health-initialized` after the parallel pass settles. `ApiEndpointSwitcher.tsx` is **read-only** — it renders results and listens for that event; it no longer probes on dropdown open.
- Active-endpoint precedence after the single parallel pass: (1) `api_user_modified` if healthy; (2) else stored `api_current_endpoint`/`api_auto_detected` if healthy; (3) else first healthy by priority order, then **written back** to `api_auto_detected`/`api_current_endpoint`; (4) else highest-priority endpoint as an (unhealthy) fallback. 以能使用的为准 — auto-detection never overwrites `api_user_modified`; a dead manual choice still yields a working session endpoint. No re-probe unless the user manually switches.
- ⚠️ **LINKED-CHANGE (联动改):** the frontend probing contract (now: auto-parallel-once at startup, single-flight via `healthPassPromise`) and the backend `/api/health` + CORS/`cors.php` paths + `/api_info` caching MUST be changed together — changing one side's health/api_info contract, CORS paths, or cache headers without the other reintroduces the preflight-hang / redundant-probe bug. See `API_ALIGNMENT_PROGRESS.md` for the full contract.

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
