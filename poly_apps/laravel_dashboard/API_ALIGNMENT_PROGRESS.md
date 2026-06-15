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
| 5 | Database manager (absorbed Database viewer) | `/api/dashboard/db-manager/{connections,status,tables,tables/{t}/{structure,data,export,import},backup(s)…,credentials…}` | all present (`dashboard.auth`) | ✅ | **MERGED (2026-06-12):** standalone DB Viewer page removed; `#/db-viewer` slug now deep-links to DB Manager. FE sends descriptor **keys** (e.g. `main`) — backend `resolve()` accepts key OR Laravel connection name and controller normalizes (was a 500 for `main`). `structure` response aligned to the richer viewer shape (`nullable: YES\|NO`, `key: PRI`, `extra: auto_increment`); `data` cells sanitized (pgsql bytea streams + non-UTF-8 → hex) on BOTH `/db-manager` and the kept-for-compat `/db-viewer` endpoints (the latter no longer used by the dashboard). |
| 6 | Bank V1 admin | 23 `/api/bank/admin/*` | present (route:list earlier confirmed bank admin set) | ❓→✅ | confirm `data/*`,`logs/*`,`codes/*` shapes via route:list |
| 7 | System config / info | `/api_info`,`/api/config/{paths,server,environment}` | all present | ✅ | `/api_info` now ETag+`max-age=300` server-side & 60s client TTL + single-flight (see "API detection redundancy fix" 2026-05-19) |
| 8 | Octane timer / octane-tasks | `/api/octane/timer/*`, `/octane-tasks/*` | all present | ✅ | dashboard could surface these (timer status panel) — optional feature add |
| 9 | Task/Worker system | (not yet a dashboard panel) | `/api/task/*`,`/api/worker/*` full | 🟧 | optional: add a dashboard Task/Worker monitor panel (functional extension) |
| 10 | AI Tools — translation | `/ai_tools/translation/translate`, `…/detect-translate`, `…/languages` | `…/translate`,`…/languages` ✓; **detect path differs** (`/translation/detect` web route exists) | 🟦 | align dashboard `detect-translate` → backend path, or add backend alias |
| 11 | AI Tools — TTS | `…/tts/{languages,voices,options,generate,batch-generate,queue/stats,queue/status,queue_batch}` | `queue_batch` ✓ (AppQyV1AITools.php:60); others mostly ✓ | ❓ | confirm `tts/queue/status`,`tts/options` exist; add if missing 🟥 |
| 12 | AI Tools — image generate | `/ai_tools/image/generate` | not found in AppQyV1 routes | 🟥 | extend backend: add image-generate endpoint (or align to existing cover/gemini service) |
| 13 | AI Tools — speech transcribe | `/ai_tools/speech/transcribe` | not found | 🟥 | extend backend: add speech-transcribe endpoint (or mark dashboard feature WIP) |
| 14 | Vocabulary — libraries/words/stats | `/vocabulary/libraries*`,`/vocabulary/statistics`,`/words/learning`,`/vocabulary/libraries/{id}/words` | AppQyV1 vocabulary routes exist (route:list earlier showed `/vocabulary/libraries*`) | ❓ | confirm `/words/learning` vs backend `/learning/words`; reconcile path. **NOTE (2026-06-08):** `/vocabulary/statistics` response **extended** — now `{ summary, languages[] }`; translation/validity/coverage come from `tts_cache_{lang}` (not library tables), so `tts/images/review_percentage` are real (not 0). New `*_dictionary_words`/`*_with_translation`/`*_valid_words`/`*_validity_checked` fields. Dashboard model must consume the new shape. |
| 14b | Vocabulary — word validity (NEW 2026-06-08) | (not yet a dashboard panel) | `GET /vocabulary/validity/pending`, `POST /vocabulary/validity/report` (backend present, `AppQyV1VocabularyValidityController`) | 🟧 | optional: add a validity-intake/monitor panel. Validity is **explicit/externally asserted** — rows default valid, become invalid only when a third-party checker reports so; stored on `tts_cache_{lang}` (`is_valid`,`validity_checked_at`,`validity_source`,`validity_note`) via migration `AppQyV1_2026_06_08_000000_add_validity_columns_to_tts_cache_tables.php`. |
| 15 | Vocabulary — progress/review | `/learning/progress`, `/words/{id}/review`, `/user/stats` (dashboard aligned in AL1) | `/learning/progress`, `/words/{id}/review`, `/user/stats` ✓ | ✅ | **DONE:** dashboard paths reconciled (AL1, 2026-05-19); backend `/words/{id}/{learn,review,favorite}` **implemented 2026-06-12** (previously returned 500). `query_gwords`/`query_gcontent` now return proper 404 on missing group (was 500). |
| 16 | Vocabulary — document upload/extract | `/learning/upload` (dashboard aligned in AL1); `…/{id}/extract-sentences`,`…/extract-words` | `/learning/upload` ✓; extract-sentences/extract-words still absent | ✅/🟥 | upload path reconciled; extract-sentences/words remain a backend extension |
| 17 | Vocabulary — export csv/json/anki/pdf/text | `/vocabulary/export/{csv,json,anki,pdf,text}` | not found | 🟥 | extend backend: add export endpoints (5) |
| 18 | System init (AppQyV1) | `/system/initialization/status`,`/system/initialization/initialize`,`/system/languages`,`/vocabulary/dictionary/statistics` | backend: `/system/initialization-status`,`/system/initialize`,`/system/supported-languages`,`/system/dictionary-statistics` | 🟦 | path-shape mismatch — align dashboard → backend canonical paths |
| 19 | User initialization | `/user/initialization/complete` | backend `/user/initialize` | 🟦 | align path |
| 20 | MCP V1 — screenshots/placeholders/task-dispatch | ~28 eps | screenshots/placeholders/task-dispatch present | ✅ | mostly aligned |
| 21 | MCP V1 — `/tasks/{id}/execute` | frontend calls it | not found in McpV1Router | 🟥 | extend backend or remove dashboard call |
| 22 | IT Tools V1 (60+) | unified + crypto/converter/web/text/math | route:list earlier showed extensive `/api/ittools/v1/*` | ❓→✅ | spot-confirm a sample; assume aligned (large suite present) |
| 23 | Code-browser / static-resources / clipboard | `/code-browser/*`,`/static-resources/*`,`/clipboard/*` | all present (web.php) | ✅ | none |
| 24 | Public avatar cache | `/api/public/avatar*` | all present | ✅ | dashboard could add an avatar-cache admin panel — optional |
| 25 | Media content — public read (NEW 2026-06-12) | wordflow anonymous browse: books/subtitles lists + sentence content | `GET /app_qy_v1/media/books`, `GET …/media/subtitles`, `GET …/media/content/{type}/{id}` (`type` book\|subtitle) — **public, no auth** (`AppQyV1MediaContent.php` → `AppQyV1MediaContentPublicController`); paginated `start`/`limit` (limit clamped 200), `grain` sentence→cue fallback, `full_content` never returned | ✅ | none |
| 26 | Group media sources (NEW 2026-06-12) | attach books/subtitles to word groups; unified Sources view | `POST /app_qy_v1/group/add_media_source` `{gid,source_type,source_key}` (extract words via `StrTool::extractWords`, fill-missing merge into `gwords`+`words_frequency`, idempotent), `POST …/group/remove_media_source` (link only — merged words stay, same semantics as `remove_library`), `POST …/group/get_sources` (libraries + media_sources unified). All `custom.authenticate` (`AppQyV1Dict.php`). Table `app_qy_v1_group_media_sources` (migration `AppQyV1_2026_06_12_120000`, already run), model `AppQyV1GroupMediaSourceModel` | ✅ | none |
| 27 | Learning recommendations — now PUBLIC (2026-06-12) | wordflow recommendations page browsable anonymously | `GET /app_qy_v1/learning/recommendations` moved out of the `auth:sanctum` group (`AppQyV1Learning.php`): anonymous gets `is_selected=false`, bearer-token callers unchanged; `collections/select` + `collections/selected` remain authed | ✅ | none |

## Functional-extension candidates (dashboard gains, backend already has)
- Task/Worker monitor panel (#9) — backend `/api/task/*`,`/api/worker/*` fully exist.
- Octane timer status panel (#8) — backend `/api/octane/timer/*` exist.
- Avatar-cache admin (#24), startup-monitor view (`/startup-monitor/*`).

## Backend-extension required (🟥 — laravel_main work)
1. AI image generate (#12) · 2. Speech transcribe (#13) · 3. Vocabulary export ×5 (#17) ·
4. MCP `/tasks/{id}/execute` (#21) · 5. (verify) document extract-sentences/words (#16) ·
6. (verify) `tts/queue/status`,`tts/options` (#11).

## Path-shape reconciliations (🟦 — prefer aligning dashboard to backend canonical)
detect-translate (#10), progress/update→learning/progress & review path (#15 — applied, AL1),
document upload→learning/upload (#16 — applied, AL1), system init/* paths (#18), user init path (#19).

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

> **⚠️ CORRECTION — 2026-06-11 (STORED-FIRST detection + per-end all-Offline
> recheck; supersedes every earlier detection description in this section and
> the sibling docs — canonical write-up: `EndpointsProcess.md` "Endpoint
> detection / health-check").** The detection contract, all 3 ends
> (laravel-manager / pycore-manager / wordflow), every entry point (startup,
> interval retry, manual re-detect — one shared code path per end):
> 1. **Stored-first**: probe ONLY the stored last-used endpoint
>    (`api_user_modified` → `api_current_endpoint` → `api_auto_detected`). If it
>    answers, use it — nothing else is probed (one request total; the previous
>    last-used choice wins, 以能使用的为准).
> 2. **Else full sweep**: probe ALL endpoints in parallel and auto-switch to
>    the highest-weight healthy one (user pin → stored → config priority);
>    write the pick back to `api_auto_detected`/`api_current_endpoint`.
>    `api_user_modified` is NEVER written by auto-detection.
> 3. **Else interval retry**: while everything is Offline, re-run the same pass
>    at the per-end configurable `healthCheckInterval` (default 60s, floor 5s)
>    and stop as soon as one endpoint recovers. A healthy backend is never
>    polled. The loop is path-prefix gated (runs only while its end is
>    mounted). Probe timeout is the config's 3000ms — never override shorter.
> `ApiEndpointSwitcher.tsx` stays read-only (renders results, listens for
> `api-health-initialized`); its "Re-detect" button and each end's settings UI
> trigger the same stored-first pass and configure the interval.
> The 2026-05-19 text below is retained for history only.

The endpoint detection / health-check path was reworked end-to-end (frontend +
backend landed; this is the documented realized contract — not a plan):

**Frontend (`laravel_dashboard`)** *(2026-05-19 wording — detection details
superseded by the 2026-06-11 stored-first correction above)*
- `services/ApiManager.ts` — detection runs **automatically at app startup**
  (now stored-first, see correction; selection precedence and the
  never-overwrite-`api_user_modified` rule unchanged). 以能使用的为准 — a dead
  pinned/manual choice still resolves to a working session endpoint.
- `App.tsx` — triggers detection at startup; the pass dispatches
  `api-health-initialized` when it settles (no separate blocking fan-out).
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

Detection (2026-06-11, STORED-FIRST — canonical: `EndpointsProcess.md`):
**automatic at app startup**, single-flight, StrictMode-safe. The pass probes
ONLY the stored last-used endpoint first (`api_user_modified` →
`api_current_endpoint` → `api_auto_detected`); if it answers it is kept and
nothing else is probed. Only when it is dead are ALL endpoints probed in
parallel with auto-switch to the highest-weight healthy one (written back;
`api_user_modified` never touched). While everything is Offline the same pass
retries at the per-end configurable `healthCheckInterval` (default 60s) and
stops on first recovery — a healthy backend is never polled.
`ApiEndpointSwitcher` is read-only (no probe on dropdown open); its Re-detect
button triggers the same stored-first pass.

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

Any change to: the stored-first probe / precedence /
single-flight (`recheckEndpoints()`) in `ApiManager.ts`; the `/api/health` route,
its middleware bypass, or body shape; the `cors.php` `paths`/`max_age`; or the
`/api_info` ETag / `Cache-Control` — is a coordinated frontend+backend edit,
never a one-sided one.

## 2026-06-12 — public media browse + group media sources (BE+FE linked change)

Backend (`laravel_main`, all verified against routes/controllers):
- **NEW public read endpoints** (rows #25): `routes/AppQyV1Router/AppQyV1MediaContent.php` →
  `AppQyV1MediaContentPublicController` — `GET /media/books?language=&start=&limit=`
  (`{total,start,limit,books:[{id,source_key,title,language,sentence_count,has_audio,synced_at}]}`),
  `GET /media/subtitles` (same shape, items add `duration_sec`/`segment_count`),
  `GET /media/content/{type}/{id}?start=&limit=` (`{info,total_sentences,start,limit,grain,sentences:
  [{seq,text,audio,explanation,start_sec,end_sec}]}`; `grain=sentence` with cue fallback;
  `full_content` never returned; `limit` clamped to 200, default 50).
- **`GET /learning/recommendations` is now PUBLIC** (row #27): moved out of `auth:sanctum`
  in `AppQyV1Learning.php`; anonymous → `is_selected=false`, token holders unchanged.
- **Group media-source attachment** (row #26): `add_media_source` / `remove_media_source` /
  `get_sources` under `custom.authenticate` in `AppQyV1Dict.php`; new table
  `app_qy_v1_group_media_sources` (migration already run) + `AppQyV1GroupMediaSourceModel`.
- **Word actions fixed** (row #15): `/words/{id}/{favorite,learn,review}` implemented (were 500);
  `query_gwords`/`query_gcontent` now 404 on missing group.

Frontend (wordflow shell) interaction redesign: public content (vocab libraries, books,
subtitles) is browsable **anonymously** (home section + recommendations page un-gated);
add/select actions are login-gated via a protected-action sheet; unified add-to-library
sheet pins the default group and auto-attaches on create-group; group detail gains a
unified Sources view (libraries + books + subtitles). Canonical interaction contract:
`apps/wordflow/docs/` (FEATURES/BACKEND_REQUIREMENTS); pipeline-side endpoint doc:
`pycore/docs/pipelines/MEDIA_SYNC_PIPELINE.md` §6.

## 2026-06-12 — vocabulary storage consolidation Wave B (id-space unification, shapes preserved)

Backend-only change (`laravel_main`); **zero FE changes required** — every response shape
is byte-compatible.

- **Single word store**: the per-language dictionary tables `app_qy_v1_tts_cache_{lang}`
  are now the ONLY word store. Library membership lives in
  `vocabulary_libraries.word_ids` (ordered JSON array of dictionary ids) and library
  covers in the `cover_*` columns of the same row. The legacy tables
  `vocabulary_items` / `vocabulary_words` / `vocabulary_covers` / `vocabulary_collections`
  were dropped (migration `AppQyV1_2026_06_12_150002`, ran 2026-06-12) and their 4 model
  classes deleted.
- **ID-space unification** (the important contract change that is invisible by design):
  `group_words.word_id` and `user_word_progress.word_id` now hold **dictionary ids** —
  the SAME id space `/words/{id}` (detail/favorite/learn/review) always used. Previously
  `group/get_words` returned per-library `vocabulary_items` ids that did NOT
  interoperate with `/words/{id}`; now a `word_id` from `get_words` can be fed straight
  into `/words/{id}/*` and the `WfLibraryWordDetailPage` flow. `(word_id, language_code)`
  is the full reference.
- **Rewired (shapes verified live before & after the drop)**: public
  `/vocabulary/libraries(/recommended)`, `/vocabulary/libraries/{id}/words` (pagination
  now slices `word_ids`; `index` = array position + offset), `/vocabulary/statistics`
  (+`include_words`), `/vocabulary/export/*`; authed `group/add_library` (text-identity
  dedupe + lockForUpdate race-safety intact; `words_added` semantics unchanged),
  `group/{get_words,add_word,remove_word}`, `group/{update_progress,get_review_words,
  get_progress_stats}`, `word-groups/{gid}/analysis`, `group/get_sources` pivot
  resolution, `recitation/today-plan` fill path, `/learning/libraries(+select)`
  (collections → libraries; the `collection_id` request field name is kept, its value is
  a library id), `quiz/generate`, cover generation task/service (status flow
  pending/processing/retry/ready unchanged, on `cover_*` columns).
- Minor: `group/get_words[].word_index` is now the pagination position and review-words
  `word_index` is `null` (the per-library index column is gone); keys kept for shape parity.

## 2026-06-12 — group progress consolidation Wave C (per-group JSON row, batch update, blob endpoint)

Backend-only change (`laravel_main`); existing response shapes stay compatible. Adds ONE
new endpoint the FE should adopt for client-side stats.

- **One row per (user, group)**: `app_qy_v1_group_words` + `app_qy_v1_user_word_progress`
  (row-per-word, ~1:1 redundant, 54,356 rows each, 65,535 PG bind-param ceiling on big
  groups) were replaced by `app_qy_v1_group_word_progress` — one row per group holding a
  `words` JSON map `word_id → {fr,lr,lv,nr,rc,vc,wt,pf,aa}` plus a `total_words` cache.
  Migrations `AppQyV1_2026_06_12_16000{0,1,2}` (create / convert-verify / drop, all ran
  2026-06-12; conversion verified per group: map keys == distinct union of both legacy
  tables). Models `AppQyV1GroupWordModel` + `AppQyV1UserWordProgressModel` deleted;
  legend + entry helpers live in `AppQyV1GroupWordProgressModel` (single source of truth).
- **Short-key legend** (timestamps = unix seconds UTC, ints): `fr=first_read_at`,
  `lr=last_read_at`, `lv=last_review_at`, `nr=next_review_at`, `rc=read_count`,
  `vc=review_count`, `wt=weight`, `pf=proficiency` (float 0-100), `aa=added_at`.
- **NEW `POST /app_qy_v1/group/get_progress_blob` `{gid}`** (same `custom.authenticate`
  middleware as `get_words`) → `success({gid, gname, language_code, total_words,
  legend: {fr:'first_read_at',…}, words: {"<word_id>": {short-key entry}}})`. One row
  read, no joins — **the FE computes per-group stats/filters client-side from this**
  instead of paging `get_words with_progress`.
- **`group/update_progress` now also accepts batch**: legacy single shape
  `{gid, word_id, action, proficiency?, is_correct?}` unchanged; new
  `{gid, updates:[{word_id, correct}]}` applies review outcomes (+5/−10 clamp 0-100,
  next-review recompute) with ONE JSON write → `{gid, batch:true, updated, skipped,
  progress:{<word_id>:{read_count,review_count,proficiency,next_review_at,last_read_at,
  last_review_at}}}`.
- **Shapes preserved** (live-smoked before & after the drop, 19/19): `group/get_words`
  (pagination order is now canonical `added_at` then `word_id`; `with_progress` merges
  from the same map), `get_review_words` (`progress_id` now equals `word_id` — the
  per-word row id no longer exists), `get_progress_stats`, `word-groups/{gid}/analysis`,
  `add_library`/`add_word`/`remove_word` (text-identity dedupe + group-row
  `lockForUpdate` kept; merges are single JSON writes), `add_media_source` dedupe,
  `recitation/today-plan` fill, `query_all_groups`/`by_gid`/`by_name`/manager totals
  (merged `count(gwords) + total_words` semantics kept, now from the row cache), group
  delete removes the progress row (model `deleted` hook, fires on soft delete).
- Observer disposition: `AppQyV1UserWordProgressObserver` (+ its
  `AppQyV1EventServiceProvider`) was dead code — the provider was never registered in
  `bootstrap/providers.php`, so it never ran. Its intended side effects (first_read_at
  stamp, next_review_at recompute) are now enforced for real in
  `AppQyV1GroupWordProgressModel::normalizeEntry()` on every entry mutation; both files
  deleted.

## Next steps (recommended order)
1. AL2: implement the 9 🟥 backend endpoints (then flip their rows ✅).
2. AL3: beautify pass + add Task/Worker + Octane-timer panels.
3. (optional) `php artisan route:list` on :9000 to re-confirm post-extension.
4. After identity Phase B: reconcile #2 (profile/preferences shape).
5. Point dashboard's stale ALIGNMENT_*/API_ALIGNMENT_* reports here.

_Update the Status column as items land. This file supersedes the older scattered
ALIGNMENT_*/API_ALIGNMENT_* reports as the single live tracker._
