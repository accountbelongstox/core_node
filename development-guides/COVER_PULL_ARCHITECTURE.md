# Cover / Image Generation — Pull-Only Architecture (shared contract)

Canonical contract for the 2026-06-14 rework: **pycore is the sole driver of
cover/image generation; laravel_main is a passive store + claim API.** Frontend,
laravel, and pycore all build against this one document.

Related memory: `laravel-pycore-assist`, `pycore-ai-status-chat`,
`ai-key-indexed-loader`, `capability-status-page`, `vocabulary-page-ops`.

---

## 1. Roles (CHANGED)

- **pycore** owns generation. The `AssistWorker` (`pycore/pyctl/assist/assist_worker.py`)
  polls laravel's `/api/app_qy_v1/assist/claim`, generates locally via the unified
  AI gateway (`pyctl/ai/generate_image`), and submits results back.
- **laravel_main** NO LONGER drives image generation on a timer. The Octane timer
  task (`AppQyV1CoverGenerationTask`) is repurposed to **maintenance-only**: it
  recovers stuck rows so pycore can always make progress. It must NOT call any AI
  client (no PycoreAiClient generate, no GeminiClient generate).
- A library row's cover lifecycle: `pending → (claimed by pycore) → ready`, with
  `retry`/`failed` recovered by the maintenance pass back into `pending`.

## 2. pycore AI image support (DONE — reference only)

Image-capable providers are flagged in the registry `pycore/pyctl/ai/ai_keys.py`
via `image: true` + `image_model`. `generate_image()` dispatches in a FREE-FIRST
preference order (`_IMAGE_PREFERENCE` in `ai_gateway.py`), each helper only
activating if its key is present (keyless → cheap fall-through, no network):

| pref | provider   | tier | image_model                             | mechanism |
|------|------------|------|-----------------------------------------|-----------|
| 0    | gemini     | free | `gemini-2.5-flash-image`                | google-genai, inline b64 |
| 1    | zhipuai    | free | `cogview-3-flash` (FREE)                | POST /images/generations → URL |
| 2    | dashscope  | free | `wanx2.1-t2i-turbo` (free-trial)        | ASYNC task + poll → URL |
| 5    | openrouter | free | `google/gemini-2.5-flash-image-preview` | chat modalities → data-URI |
| 6    | openai     | paid | `dall-e-3`                              | Images API → b64_json |
| 7    | stepfun    | paid | `step-1x-medium`                        | OpenAI-compat → b64_json |

URL-returning providers (zhipu, dashscope, sometimes stepfun) are downloaded and
re-encoded to base64 by `_fetch_image_b64`. Rate: free tiers are concurrency/RPM
capped — the gateway puts a provider on exponential cooldown on 429, and the
cover track is sequential, keeping concurrency low.

The probe (`/api/local/ai/probe`) returns per provider: `image: bool` (registry
capability), **`image_ready: bool`** (capability AND key present, NO live call —
consumers MUST gate on this, not the volatile live `available`), and
**`image_model: str`** (the bound image model id for UI display; "" when not
image-capable).

## 3. laravel_main changes REQUIRED

### 3a. Timer task → maintenance-only (#2 + pull-only)
`app/Services/TimerTasks/AppQyV1CoverGenerationTask.php`:
- Remove the AI-generation path (`generateCoverImage()` / pycore / Gemini calls).
- Keep a lightweight maintenance pass (every 5s is fine) that, in a transaction:
  - `failed` rows with `cover_attempts >= max` and `cover_finished_at` older than a
    cooldown (e.g. 10 min) → reset to `pending`, `cover_attempts = 0`,
    clear `assist_claimed_at/_by` (so pycore re-claims and retries them).
  - `processing` rows stuck older than the lease (60 min) → back to `pending`.
  - Stale `assist_claimed_at` (> 60 min) → cleared.
- Gate with env `APPQYV1_COVER_MAINTENANCE_ENABLED` (default true). The old
  `APPQYV1_COVER_GENERATION_ENABLED` is retired (treat as the maintenance gate for
  backward compat — read either, default true).

### 3b. failed → recoverable on re-request (#2)
`app/Apps/AppQyV1/Services/AppQyV1VocabularyCoverService.php::getCoverData()`:
- Today it only initializes when `cover_filename IS NULL`. Extend so that when a
  library is re-requested AND `cover_status === 'failed'`, it resets that row to
  `pending` (keep the existing filename/prompt), `cover_attempts = 0`, clears the
  lease, and bumps `cover_last_requested_at`. So simply reopening a library
  re-queues a stuck cover for pycore.

### 3c. Explicit retry endpoint (#2)
Add `POST /api/app_qy_v1/assist/cover/retry` (controller
`AppQyV1AssistController`, service `AppQyV1AssistService::retryFailedCovers()`):
- body `{ ids?: int[], all?: bool }` — reset the given failed/stuck rows (or ALL
  failed rows when `all=true`) to `pending`, `cover_attempts = 0`, clear lease +
  `cover_error_message`. Returns `{ success, reset: int }`.
- Register in `routes/AppQyV1Router/AppQyV1Assist.php` (same NO-AUTH group).

### 3d. Surface cover_error_message (#5)
- `getCoverData()` return shape gains `error_message` (from `cover_error_message`)
  and `attempts` (from `cover_attempts`) alongside the existing status/url/log.
- Wherever the cover blob is returned to the FE (`transformLibrary()` /
  cover-status payloads), include `error_message` + `attempts` so the UI can show
  WHY a cover failed and offer a retry.

### 3e. Assist endpoint gating (#6)
`routes/AppQyV1Router/AppQyV1Assist.php` + controller:
- Gate the assist routes behind env `APPQYV1_ASSIST_ENABLED` (default **true** —
  pull mode is now the primary path). When false, claim/submit/release/retry
  return `{ success:false, error:'assist disabled' }` 200 (not a hard 404) so the
  worker logs cleanly and backs off.
- `GET /api/app_qy_v1/assist/status` gains `enabled: bool` (the env) and
  `mode: 'pull'`. Keep existing `cover{}` / `tts{}` counts.

### 3f. Probe-consumer resilience (#4)
`app/Services/PycoreAiClient.php`:
- `isImageCapable()` MUST gate on `image_ready` (fallback: `configured && image`)
  — drop the `available` requirement so a transient live-probe failure doesn't
  mark pycore image-incapable.
- Shorten the NEGATIVE probe cache from 5 min to **30 s** (positive cache may stay
  longer). Image capability should recover within ~30 s of pycore coming up.
- NOTE: in pull mode laravel no longer needs to CALL pycore for generation, but
  `isImageCapable()` is still used by status/UI surfaces — keep it correct.

## 4. UI changes REQUIRED (laravel_dashboard)

### 4a. Capabilities panel bug (#1)
`apps/pycore-manager/pages/PcSettingsPage.tsx`:
- Ticking ANY capability (cover/tts/translation) ON must also set `enabled = true`
  in the same state update (so the worker actually starts).
- When the master `enabled` is OFF, the three capability toggles render **disabled
  / greyed** (a capability is meaningless without the master on).
- Show the worker's live `running` state (from `getAssistStatus().worker.running`
  or the existing status field) next to the master switch.
- Keep the existing `setAssistConfig({enabled, capabilities, poll_interval_s,
  batch_limit})` payload shape.

### 4b. Image badges + bound-model display on the AI status page (image marking)
The AI provider grid (pycore "AI Status" / "Capability Status" page that renders
`/api/local/ai/probe` or `/catalog`) must show an **image badge/icon** on every
provider where `image === true`, visually distinct when `image_ready === true`
(key present, ready) vs `image` but not ready (capability exists, no key). Use an
image/photo icon. ADDITIONALLY show the **bound image model** (`image_model`,
e.g. `cogview-3-flash`) next to/within the badge so each image-capable provider
visibly displays which model it generates with. Add `image_model?: string` to the
provider TS type.

### 4c. Cover error + retry in vocabulary UI (#5 + #2)
Where covers render (vocabulary library cards/list, `vocabulary-page-ops`):
- When `cover.status === 'failed'`, show the `error_message` (tooltip/inline) and a
  **Retry** action that calls `POST /api/app_qy_v1/assist/cover/retry` with that
  library's id, then refreshes.

## 5. Wire-level contracts (unchanged unless noted)

```
POST {laravel}/api/app_qy_v1/assist/claim
     { types:('cover'|'tts')[], limit?:1..10=3, claimer:str<=56 }
  -> { success, items:[...], lease_minutes:60 }
POST {laravel}/api/app_qy_v1/assist/submit   (cover: image_base64; tts: audio_base64)
POST {laravel}/api/app_qy_v1/assist/release  { type, ids:[], error?, claimer? }
POST {laravel}/api/app_qy_v1/assist/cover/retry  { ids?:int[], all?:bool }   (NEW)
GET  {laravel}/api/app_qy_v1/assist/status   -> { success, enabled, mode:'pull',
                                                  cover:{...}, tts:{...}, lease_minutes }

GET  {pycore}/api/local/ai/probe  -> providers[] each incl. image, image_ready
```

All code strings English (CJK only inside i18n resource blocks). pycore imports at
file top; no pip-only deps in stdlib-only modules.
