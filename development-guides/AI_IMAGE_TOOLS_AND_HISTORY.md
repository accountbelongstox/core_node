# AI Image Tools + Shared History (shared contract)

Canonical contract for the unified AI tools UI (chat test + image generation test
+ image management + history) on BOTH the laravel-manager dashboard and the
pycore-manager, with history shared cross-runtime via a file. Builds on
`COVER_PULL_ARCHITECTURE.md` (image generation backends) and the existing
`.ai_state` shared-store pattern.

Related memory: `pycore-ai-status-chat`, `laravel-pycore-assist`,
`capability-status-page`, `unified-shell-merge`, `dashboard-custom-endpoints`.

---

## 1. Shared history store (cross-runtime — DONE on pycore side)

Both runtimes (pycore on Windows, Laravel in WSL) read/write the SAME files under
`<core_node>/.ai_state/` — the one location both see as a single file via DrvFs,
exactly like `ai_rate_usage.json` / `.secret_keys`:

```
<core_node>/.ai_state/ai_image_history.json   index (newest-LAST, ring buffer 200)
<core_node>/.ai_state/ai_images/<id>.<ext>    the generated image bytes
```

Index schema (NO base64 in the index):
```json
{ "version": 1, "saved_at": 1718.0, "entries": [
  { "id":"<sha1[:16]>", "ts":1718.0, "iso":"2026-06-15T..Z", "provider":"zhipuai",
    "model":"cogview-3-flash", "prompt":"...", "size":"1:1", "mime":"image/png",
    "bytes":31585, "file":"ai_images/<id>.png", "latency_ms":2300,
    "source":"pycore-ai-tools", "origin":"pycore"|"laravel", "ok":true } ] }
```
Write safety: tmp file + atomic replace + in-process lock (mirror
`ai_rate_limits`). pycore module: `pycore/pyctl/ai/ai_image_history.py`
(`record_image / list_history / read_image / delete_entry / clear_history`).

## 2. Endpoints — IDENTICAL shapes on both ends (prefix `/api/local/ai`)

| method | path | body / query | returns |
|--------|------|--------------|---------|
| POST   | `/image` | `{prompt, size?, model?, source?}` | unified IMAGE contract `{success,provider,model,image_base64,mime,latency_ms,error}` AND records history |
| GET    | `/image/history` | `?limit=50` | `{success, entries:[...]}` (metadata only, newest-first) |
| GET    | `/image/history/file/{id}` | — | raw image bytes (`Content-Type: mime`), 404 if missing |
| DELETE | `/image/history/{id}` | — | `{success: bool}` |
| POST   | `/image/history/clear` | — | `{success, removed:int}` |

- **pycore**: DONE — `pycore/callmodule/routers/local/ai_image_router.py`.
- **laravel**: TO DO — `routes/api/ai_local.php` (prefix `/api/local/ai`),
  `app/Http/Controllers/Api/AiLocalController.php`, new service
  `app/Services/AiGateway/AiImageHistory.php` that read/writes the SAME
  `<core_node>/.ai_state/ai_image_history.json` + `ai_images/` (resolve via
  `PathMapper::getCoreNodeDir().'/.ai_state'`, atomic write like AiRateLimiter).
  `AiLocalController::image()` records on success with `origin='laravel'`.
  History entry schema MUST match §1 byte-for-byte so both ends interop.

## 3. UI — laravel-manager dashboard (unified AI console)

The `#/ai-tools` view (`poly_apps/laravel_dashboard/components/views/AITools.tsx`,
mounted by `ViewType.AI_TOOLS` in `App.tsx`) is the single AI console. ADD these
capabilities (new left-nav tools alongside the existing Translation/TTS/OCR/
Prompts/Status) so chat + image live in ONE UI:

- **Chat Test** — single-message test via `POST /api/local/ai/chat`
  (reuse the chat-test logic already in `AiManagement.tsx`: provider select =
  auto|specific, show provider/model/latency of the reply).
- **Image Gen** — prompt + size + optional provider/model → `POST /api/local/ai/image`;
  render the returned image (data URI from `image_base64`+`mime`), show which
  provider/model/latency produced it; "save is automatic" (it's recorded).
- **Image History / Management** — gallery from `GET /api/local/ai/image/history`;
  each tile shows the image (via `GET /api/local/ai/image/history/file/{id}`),
  prompt, provider/model, time; per-tile Delete + a Clear-all; click to enlarge /
  re-use prompt. This is the "image generation management".
- **Image capability display** — the provider grid (AiManagement) must show an
  image badge + bound `image_model` per provider where `image===true` (solid when
  `image_ready`, muted otherwise) — same as pycore-manager's PcAiStatusPage.

API lib: extend the laravel AI module (`core/api/modules/AiManagementAPI.ts` or
the laravel API client used by AITools) with `image(req)`, `imageHistory(limit)`,
`imageHistoryFileUrl(id)`, `deleteImageHistory(id)`, `clearImageHistory()` hitting
laravel `/api/local/ai/*`. Add `image/image_ready/image_model` to the provider type.

## 4. UI — pycore-manager (image gen + history)

Add a pycore image tool + history (new page e.g. `PcAiImagePage.tsx`, nav entry,
reachable from the AI/Capability area), consuming pycore `/api/local/ai/*` via
`core/api-libs/pycore/PycoreApi.ts`:
- **Image Gen** — same prompt/size/provider→`POST /api/local/ai/image`, render result.
- **Image History** — gallery from pycore `GET /api/local/ai/image/history` (+ file
  endpoint), per-tile delete + clear. Because the store is SHARED, this shows the
  SAME entries as the laravel-manager gallery (origin field distinguishes which
  runtime generated each).
- The image capability badges + bound model already added to PcAiStatusPage stay.

Add to `PycoreApi.ts`: `generateImage(req)`, `getImageHistory(limit)`,
`imageHistoryFileUrl(id)`, `deleteImageHistory(id)`, `clearImageHistory()` (paths
under `/pyapi/api/local/ai/...`, same /pyapi proxy to :59000).

## 5. Constraints
All code strings ENGLISH (CJK only in i18n blocks). Laravel runtime paths via
`PathMapper` only. No build/test of laravel_main / laravel_dashboard. pycore
imports at file top. History bytes are NEVER inlined into the index JSON.
