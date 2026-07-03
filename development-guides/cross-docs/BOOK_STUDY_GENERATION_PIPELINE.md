# Book Study-Content Generation Pipeline — Shared Contract v1

Status: CANONICAL. Single source of truth for the segment-based study-content
generation system spanning:

- `poly_apps/laravel_main` (app `AppQyV1`) — tables, segmentation, claim/submit
  protocol, writeback. **Laravel OWNS this contract**; do NOT rename routes,
  table names, columns, or payload keys without updating this doc as a linked
  change.
- `apps/mcp-chrome` (chrome extension) — the "Book Study Generator" popup
  panel that lists sources with progress, drives a web-AI chat (Gemini /
  ChatGPT / Grok / Copilot) per segment, parses the structured reply, and
  posts results back.

Cross-references:
- `poly_apps/pycore_laravel_wordflow_ui/apps/wordnew/docs/BOOKS_FEATURE_SPECIFICATION.md`
  (Books v3.1 data model this builds on: per-language sentence library,
  slots, correspondence).
- `poly_apps/laravel_main/app/Apps/AppQyV1/docs/AppQyV1_TASK_CENTER_PIPELINE.md`
  (worker-lane substrate; this feature deliberately uses the row-lease assist
  flavor instead — see §2).
- `apps/mcp-chrome/docs/ARTICLE_STUDY_GUIDE_DESIGN.md` (the ad-hoc single-shot
  ancestor of this feature; prompt/reply format conventions are shared).

---

## 1. Purpose and data flow

Every book / article / short text (uploaded document) gains a **generation
marker** answering "has this whole source been converted into multi-language
comparison sentences + study aids?", plus a per-segment record of exactly what
was generated. The mcp-chrome extension pulls one **~500-character segment**
at a time, generates via a web AI chat:

1. multi-language comparison sentences (per-slot translations),
2. per-sentence meaning explanations (释意),
3. grammar points for the segment,
4. short-phrase introductions for the segment,

and posts the parsed result back. Storage fan-out (§5):

- translations → existing per-language sentence library
  `app_qy_v1_sentences_{lang}` — **idempotent, skip-if-exists** by
  `content_id`; slot `lang_content_ids` filled only where null.
- explanations → `app_qy_v1_sentences_{lang}.explanation` — fill-missing only.
- grammar points → NEW `app_qy_v1_study_grammar_points`, batch-linked to the
  segment so loading that passage finds its grammar points.
- short-phrase intros → NEW `app_qy_v1_study_phrases`, same linkage;
  duplicates ACROSS segments are allowed by design (the same phrase may be
  introduced in many passages).

```
mcp-chrome panel                     laravel_main (AppQyV1)
────────────────                     ──────────────────────
GET  /study-gen/sources  ──────────► list books/articles + progress
POST /study-gen/claim    ──────────► plan-on-demand → lease 1 segment
                                      ← segment text (server-extracted slots)
[drive Gemini/ChatGPT/Grok/Copilot tab; poll job to stable reply]
[parse structured reply → JSON]
POST /study-gen/submit   ──────────► one transaction:
                                        sentences_{lang} (skip-if-exists)
                                        slots.lang_content_ids (fill-null)
                                        sentences.explanation (fill-missing)
                                        study_phrases + study_grammar_points
                                        segment → done; source progress cache
```

## 2. Why the row-lease (assist) flavor, not a global_tasks lane

This flow is **UI-driven and interactive**: the operator watches per-source
progress in the popup and decides what to generate next. The established
precedent for that shape is the assist claim/submit/release row-lease protocol
(`AppQyV1AssistService`, 60-minute lease on domain rows), not an unattended
`global_tasks` worker lane. The three prior UI-driven precedents are
submit-bing direct push, manual `task/enqueue`, and record-scoped assist
requests. A future unattended worker lane (own `execution_type`) can be added
without changing the storage contract in this doc.

The lease lives on `study_segments.claimed_at/claimed_by` — deliberately NOT
on `books.assist_claimed_at/_by`, which is already the poster-assist lease;
sharing it would cross-starve poster generation.

## 3. Database schema (all on the AppQyV1 connection, prefix `app_qy_v1`)

All new tables are **static** → one migration file each under
`poly_apps/laravel_main/database/migrations/` named
`AppQyV1_2026_07_03_00000N_*.php`, anonymous-class style with
`AppTablePrefixServiceProvider::getConnection/buildTableName` +
`SafeMigrationHelper::alignTableStructureFromArray` (idempotent: re-running
only ADDS missing columns/indexes, never drops). They are auto-discovered by
`sys:init`'s single `migrate --force` (runs before the per-app initializer
phase), so **no registration anywhere else is needed**. They are intentionally
NOT added to `AppQyV1Initializer::verify_tables` (that list gates the
dictionary-runtime `database_ready.flag`; study tables are not a dictionary
runtime dependency).

### 3.1 `app_qy_v1_study_segments` — segment plan + lease + status

One row per planned segment. THE anchor for everything generated.

| column | type | notes |
|---|---|---|
| `id` | bigIncrements | |
| `source_type` | string(20), index | `book` \| `article` \| `document` |
| `source_key` | string(64), index | books.source_key / articles.article_id / `doc_<id>` |
| `segment_index` | int | 0-based |
| `grain` | string(20) default `'sentence'` | slot grain the plan was built on (`sentence` else `cue`) |
| `seq_start` | int | inclusive first slot `seq` |
| `seq_end` | int | inclusive last slot `seq` |
| `chapter_index` | int default 0 | chapter of the first slot (display hint) |
| `primary_language` | string(20) nullable | language the char budget was measured in |
| `char_count` | int default 0 | `mb_strlen` of primary text at plan time |
| `status` | string(20) default `'pending'`, index | `pending` \| `generating` \| `done` \| `failed` |
| `attempts` | int default 0 | incremented on claim |
| `error` | text nullable | last release/submit error |
| `claimed_at` | timestamp nullable | lease start |
| `claimed_by` | string(64) nullable | claimer id |
| `languages_done` | json nullable | lang codes in the accepted submission |
| `provider` | string(32) nullable | `gemini`\|`chatgpt`\|`grok`\|`copilot` provenance |
| `generated_at` | timestamp nullable | when submit was accepted |
| `metadata` | json nullable | plan params `{target_chars}` etc. |
| timestamps | | |

UNIQUE (`source_type`,`source_key`,`segment_index`) named
`uniq_study_segment_pos`. Index (`source_type`,`source_key`,`status`).

### 3.2 `app_qy_v1_study_phrases` — short-phrase introductions (短句介绍)

| column | type | notes |
|---|---|---|
| `id` | bigIncrements | |
| `segment_id` | unsignedBigInteger, index | FK-by-value to study_segments.id |
| `source_type` | string(20) | denormalized segment link |
| `source_key` | string(64) | " |
| `segment_index` | int | " |
| `language` | string(20), index | which language the phrase belongs to |
| `phrase` | text | the phrase itself |
| `meaning` | text nullable | introduction / meaning |
| `metadata` | json nullable | |
| timestamps | | |

Index (`source_type`,`source_key`,`segment_index`). **Duplicates across
segments are allowed** (no unique key on phrase). Within-segment duplication
on retry is prevented by the submit idempotency gate (§5.3), NOT by a key.

### 3.3 `app_qy_v1_study_grammar_points` — grammar points per segment

| column | type | notes |
|---|---|---|
| `id` | bigIncrements | |
| `segment_id` | unsignedBigInteger, index | FK-by-value to study_segments.id |
| `source_type` | string(20) | denormalized segment link |
| `source_key` | string(64) | " |
| `segment_index` | int | " |
| `language` | string(20), index | |
| `point` | text | short label, e.g. "not only…but also" |
| `explanation` | text nullable | detail |
| `metadata` | json nullable | |
| timestamps | | |

Index (`source_type`,`source_key`,`segment_index`). Loading a passage finds
its grammar batch via this composite (or via §6.3's seq lookup).

### 3.4 Source-table generation markers (add-only, hasColumn-guarded)

One migration adds to BOTH `app_qy_v1_books` AND `app_qy_v1_articles`:

| column | type | notes |
|---|---|---|
| `study_gen_status` | string(20) default `'none'`, index | `none` \| `partial` \| `complete` |
| `study_gen_progress` | json nullable | `{"segments_total":N,"segments_done":M,"languages":["en","zh"],"updated_at":"..."}` |

These are a **denormalized cache** recomputed from `study_segments` on every
submit/release (source of truth is always the segments table). `complete` =
every planned segment `done`; `partial` = at least one `done`; else `none`.
Documents (`doc_*`) have no own source table — their progress is computed
from `study_segments` directly.

Books' `metadata` json is NOT used for this (it is fill-missing-protected on
re-ingest — a mutable progress cache there would be frozen by `mergeFill`).

## 4. Segmentation (server-side, deterministic)

Segments are computed **on the server** (never client-side slicing — the
segment identity must be stable across claims/retries/re-reads):

1. Load slots `source_sentences` where (`source_type`,`source_key`), grain =
   `'sentence'` if any such slots exist else `'cue'`, `ORDER BY seq`.
2. Primary language = source row's `language` (books/articles) else the
   slots' `primary_language` else `'en'`. Per-slot text = the primary
   language's library text (`lang_content_ids[primary]` →
   `sentences_{primary}.text`); a slot with no primary text contributes 0
   chars but still belongs to the current segment (seq ranges stay
   contiguous, no orphan slots).
3. Greedy pack in seq order: close the current segment when EITHER the
   accumulated `mb_strlen` of primary texts (joined by one space) reaches
   `target_chars` (default **500**) — a segment always ends on a slot
   boundary, never mid-sentence — OR the next slot's `chapter_index` differs
   (chapter boundaries are natural study units). The final partial segment is
   kept.
4. Insert one `study_segments` row per segment, `status='pending'`,
   `metadata={"target_chars":500}`.

Plan idempotency: `plan()` **no-ops** when any segment rows already exist for
the source (returns existing totals). `force=true` re-plans ONLY when no
segment is `done` or `generating` (otherwise error `plan_locked`) — re-planning
after content was generated would orphan the phrase/grammar batches linked by
`segment_index`.

CJK note: `mb_strlen` counts characters, not bytes — 500 CJK chars ≈ 500
`char_count` like 500 latin chars. This is intentional ("~500 字左右").

## 5. Endpoints (machine control plane)

New router file `poly_apps/laravel_main/routes/AppQyV1Router/AppQyV1StudyGen.php`,
required from `routes/api.php` beside the other AppQyV1 router files. The whole
group is NO-AUTH machine plane —
`Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])`
`->prefix('app_qy_v1/study-gen')` — same trust tier as `/assist/*` and
`submit-bing` (chrome is a server-side caller without a user token; every
submitted artifact is validated server-side). Controller:
`app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1StudyGen/AppQyV1StudyGenController.php`;
service `app/Apps/AppQyV1/AppQyV1Services/AppQyV1StudyGenService.php`.
Feature gate: `env('APPQYV1_STUDY_GEN_ENABLED', true)` — when off, write
endpoints return HTTP 200 `{ success:false, error:'study-gen disabled' }` so
clients back off cleanly (assist convention). New endpoints are appended to
`AppQyV1ApiInfo::getEndpoints()` (the tester catalog is hand-maintained).

### 5.1 `GET /api/app_qy_v1/study-gen/sources`

Query: `type=book|article|all` (default `all`), `page` (default 1),
`per_page` (default 20, max 100), `q` (optional title filter).

Lists books (from `app_qy_v1_books`) and articles (from
`app_qy_v1_articles`; `source_key` = `article_id`) with their markers:

```json
{ "success": true, "items": [ {
    "source_type": "book", "source_key": "…", "title": "…",
    "language": "en", "sentence_count": 1234,
    "study": { "status": "partial", "segments_total": 40,
               "segments_done": 12, "languages": ["en","zh"],
               "updated_at": "…" }
  } ], "total": 87, "page": 1, "per_page": 20 }
```

`study` merges the cached columns with a live `study_segments` count (cheap
grouped query); sources never planned report
`{"status":"none","segments_total":0,"segments_done":0}`. Documents are
claimable/submittable by explicit `source_key` but not listed here (they are
user-scoped uploads; v1 keeps the machine listing to shared sources).

### 5.2 `POST /api/app_qy_v1/study-gen/claim`

Body:

```json
{ "claimer": "bsg_x7k2…",              // required, ≤64 chars
  "source_type": "book",               // required
  "source_key": "…",                   // required (claim is source-scoped)
  "segment_index": 3,                  // optional: claim THIS segment (else next pending)
  "limit": 1,                          // optional 1..3, default 1
  "languages": ["en","zh"],            // optional target langs (see below)
  "target_chars": 500 }                // optional, used only if planning now
```

Behavior: **plans on demand** (§4) when the source has no segments yet, then
claims up to `limit` segments in one transaction with `lockForUpdate()`:
claimable = `status='pending'` OR (`status='failed'`) OR lease expired
(`claimed_at < now()-60min`, any status except `done`) — expired leases are
silently reclaimed, matching assist semantics. Claimed rows get
`status='generating'`, `claimed_at=now()`, `claimed_by=claimer`,
`attempts+1`.

Target-language resolution order: request `languages` → book
`metadata.seeded_languages` → `["en","zh"]`. The primary language is always
implicitly included (its text is the source; it is never re-generated).

Response (`lease_minutes: 60`):

```json
{ "success": true, "lease_minutes": 60, "items": [ {
    "source_type": "book", "source_key": "…", "segment_index": 3,
    "grain": "sentence", "seq_start": 120, "seq_end": 141,
    "chapter_index": 2, "primary_language": "en", "char_count": 512,
    "target_languages": ["zh"],
    "slots": [ { "n": 1, "seq": 120, "text": "In the beginning …" }, … ]
  } ] }
```

`slots[].text` is the server-extracted primary-language text (§4 step 2 —
for v2 dashboard books this is the punctuation-reconstructed form where
available, else the library text). `n` is the 1-based in-segment sentence
number the prompt/reply format uses; the extension maps `n → seq` from this
array and submits by `seq`.

### 5.3 `POST /api/app_qy_v1/study-gen/submit`

Body:

```json
{ "source_type": "book", "source_key": "…", "segment_index": 3,
  "claimer": "bsg_x7k2…", "provider": "gemini",
  "languages": ["zh"],
  "slots": [ { "seq": 120,
               "langs": { "zh": { "text": "起初…",
                                   "explanation": "…" } } }, … ],
  "phrases":        [ { "language": "en", "phrase": "in the beginning",
                        "meaning": "at the start of everything" }, … ],
  "grammar_points": [ { "language": "en", "point": "prepositional opener",
                        "explanation": "…" }, … ] }
```

**Idempotency gate (the duplicate-guard):** if the segment is already
`done`, respond `{ "ok": true, "status": "done", "already_done": true }` and
write NOTHING — a retried POST (client retry/backoff) can never double-insert
phrases or grammar rows. If the segment is currently `failed` and this is a
resubmission, existing `study_phrases`/`study_grammar_points` rows for
(`segment_id`) are deleted before insert (replace semantics per batch).

Writeback (ONE transaction on the AppQyV1 connection), per slot per language:

1. `content_id = MediaIngestService::computeContentId(text)` (the canonical
   md5 normalization — same key the whole library uses).
2. `sentences_{lang}`: **insert if `content_id` missing** (text, language,
   `sentence_id`, slot's `corr_id`, `occurrence_count=1`); if it exists, skip
   the text entirely (never clobber), bump `occurrence_count`, backfill empty
   `sentence_id`/`corr_id` — identical semantics to
   `MediaIngestService::upsertLangSentence`.
3. Slot `lang_content_ids[lang]`: fill ONLY if currently null/missing —
   never overwrite an existing non-null correspondence
   (`mergeLangContentIds` semantics).
4. `explanation` (释意): written to `sentences_{lang}.explanation` ONLY if
   currently empty (fill-missing; the enrichment fields already exist on the
   library for exactly this).
5. `study_phrases` / `study_grammar_points`: insert the batches with the
   segment linkage columns.
6. Segment row: `status='done'`, `languages_done`, `provider`,
   `generated_at=now()`, lease cleared, `error=null`.
7. Source progress cache (§3.4) recomputed and written (books/articles;
   guarded by a cached `Schema::hasColumn` probe so code ships before
   migrations without 500s).

Validation: slots must belong to the claimed segment's `[seq_start,seq_end]`
range (out-of-range seq → that slot is skipped and counted in
`skipped_out_of_range`); unsupported language codes are skipped (counted);
`slots`/`phrases`/`grammar_points` may each be empty (a submission may carry
any subset). Response:

```json
{ "ok": true, "status": "done",
  "applied": { "sentences_inserted": 18, "sentences_existing": 4,
               "lang_links_filled": 22, "explanations_filled": 15,
               "phrases_saved": 9, "grammar_saved": 6,
               "skipped_out_of_range": 0, "skipped_unsupported_lang": 0 } }
```

Errors: unknown segment → 404 `{ok:false, status:'not_found'}`; malformed
body → 422; internal → 500. The service returns `http_status` in-array; the
controller pops it (assist convention).

### 5.4 `POST /api/app_qy_v1/study-gen/release`

Body: `{ "source_type", "source_key", "segment_indexes": [3,4], "claimer"?,
"error"? }` → `{ "success": true, "released": 2 }`.

Only rows actually holding a lease are touched. With `error`: `status='failed'`,
`error` recorded (retryable: failed segments are claimable again). Without:
`status='pending'`. Lease cleared either way; `done` rows are never demoted.

### 5.5 `GET /api/app_qy_v1/study-gen/status`

Query: `source_type`, `source_key` → per-source snapshot:

```json
{ "success": true, "source_type": "book", "source_key": "…",
  "totals": { "segments_total": 40, "segments_done": 12,
              "generating": 1, "failed": 0, "status": "partial" },
  "segments": [ { "segment_index": 0, "status": "done", "char_count": 498,
                  "seq_start": 0, "seq_end": 17, "chapter_index": 0,
                  "languages_done": ["zh"], "provider": "gemini",
                  "attempts": 1, "error": null }, … ] }
```

### 5.6 `GET /api/app_qy_v1/study-gen/segment-content` — the retrieval hook

Query: (`source_type`, `source_key`) + (`segment_index` OR `seq`). With `seq`,
the covering segment is found via `seq BETWEEN seq_start AND seq_end`. This is
how a reader loading a passage finds its study aids:

```json
{ "success": true,
  "segment": { "segment_index": 3, "seq_start": 120, "seq_end": 141,
               "status": "done", "languages_done": ["zh"] },
  "phrases":        [ { "language": "en", "phrase": "…", "meaning": "…" } ],
  "grammar_points": [ { "language": "en", "point": "…", "explanation": "…" } ] }
```

(Wiring this into the wordnew book reader UI is future FE work; this endpoint
is the stable contract it will consume. It is registered in the same no-auth
group — the data is non-user-scoped study content.)

## 6. Prompt and reply format (extension-side)

Builder `buildBookStudySegmentPrompt(slots, primaryLang, targetLangs)` lives
beside the Article Study Guide preset in
`apps/mcp-chrome/app/chrome-extension/entrypoints/popup/composables/promptPresets.ts`
(client-hardcoded preset, same tier as the Article Study Guide prompt; the
server-side `ai_prompts` library remains the long-term home — noted there as
a future migration, not duplicated now). XML-LIKE, not strict XML (the
consumer is an LLM):

```
<task type=book_study_segment>
<config>
<primaryLanguage>{{CODE}}</primaryLanguage>
<targetLanguages>{{CODE,CODE}}</targetLanguages>
</config>
<instructions>
For every numbered source sentence, output one line per target language:
  {{CODE}}(n) <translation> | EXPLAIN: <one-line meaning in that language>
(EXPLAIN is required for every sentence.) After all sentences, output for
EVERY language in <targetLanguages> plus {{PRIMARY}}:
  SHORT PHRASES ({{CODE}})   — every notable phrase, one "- phrase — meaning" per line
  GRAMMAR POINTS ({{CODE}})  — every distinct grammar point, one "- point — explanation" per line
Sections are exhaustive, not samples. No commentary outside this format.
</instructions>
<sentences>
S(1) {{slot text}}
S(2) {{slot text}}
…
</sentences>
</task>
```

Reply parsing (`parseStudySegmentReply` in the panel composable): line-based,
tolerant — `^\s*([A-Za-z]{2,3})\((\d+)\)\s*(.+)$` for sentence lines (split
tail on `| EXPLAIN:`), `SHORT PHRASES (CODE)` / `GRAMMAR POINTS (CODE)`
section headers, `- left — right` (em-dash, hyphen, or colon separators)
items. `n` maps to `seq` via the claim's `slots` array. Unparseable lines are
skipped; a reply yielding zero sentence lines AND zero section items is
treated as a generation failure → `release` with error.

## 7. Chrome extension responsibilities ("Book Study Generator" panel)

New extension panel, id `book-study-generator` (📚), registered in
`composables/useExtensionConfig.ts` `EXTENSION_REGISTRY` + component
`entrypoints/popup/components/extensions/BookStudyGenerator.vue` registered in
`ExtensionsPanel.vue` — the standard 2-step panel registration. Logic in
`entrypoints/popup/composables/useBookStudyGenerator.ts`. All UI strings
English.

- **Endpoint**: `apiManager.getCurrentBaseUrl()` (the same resolved endpoint
  the EndpointDropdown controls), trailing slash stripped. All calls are
  plain no-auth `fetch` (the study-gen group is machine-plane, like
  submit-bing).
- **Source list**: `GET /study-gen/sources` rendered with per-source progress
  (`done/total` bar + status chip + languages); type filter (book/article),
  search, pagination, manual refresh. Per-source `GET /study-gen/status`
  drill-down (segment strip).
- **Claimer id**: `bsg_<random>` generated once and persisted
  (`usePersistedRef('bookStudyClaimerId')`).
- **Provider + languages**: reuse `PROVIDER_ORDER`/`PROVIDER_MESSAGE_TYPE`
  from `useArticleStudyGuide.ts` (same four `*_text_service` background
  bridges — **no new background listener**) and the language catalog from
  `promptPresets.ts`. Provider choice persisted.
- **Generate loop** (per source): claim → build prompt → `sendStartWithWake`
  (cold-SW retry) → poll `status` every 3s (job/poll architecture — the
  provider tab keeps generating even if the popup closes) → stable reply →
  parse → `POST /study-gen/submit` → refresh progress → if "Auto-run" is on
  and pending segments remain, claim the next. Parse/generation failure →
  `POST /study-gen/release` with the error, loop stops.
- **Popup-death resilience** (the extension's standard state model): the
  in-flight unit persists as ONE atomic
  `usePersistedRef('bookStudyActiveJob')` value
  `{jobId, provider, sourceType, sourceKey, segmentIndex, autoRun}`; a
  `watch` resumes polling when the value is restored on mount (identical to
  `useArticleStudyGuide`'s activeJob pattern — two separate refs could
  restore out of order). Background job state itself survives service-worker
  restarts via `chrome.storage.session` (web-chat-job-base). The segment
  lease (60 min server-side) covers the popup being closed mid-generation;
  a lease that expires is simply reclaimed later — submit after expiry still
  lands (the gate is `done`, not the lease). For long unattended runs the
  header's "open in a tab" button gives a window that never blurs.
- **Copilot**: nothing special in this panel — the canvas ("Open page")
  open/extract/close handling is entirely inside `copilot-web-helper.js` +
  the shared job base (`cleanupAction`), per
  `ARTICLE_STUDY_GUIDE_DESIGN.md §4`.

## 8. Idempotency & data-safety summary (every layer)

| layer | mechanism |
|---|---|
| migrations | hasTable/hasColumn-guarded, SafeMigrationHelper align-only, `down()` never drops data tables |
| sys:init | migrations auto-run via the single `migrate --force`; no new init step needed (no seed data) |
| plan | no-op when segments exist; `force` blocked once anything is `done`/`generating` |
| claim | transaction + `lockForUpdate`; expired 60-min leases silently reclaimed |
| submit retry | segment `done` gate → `already_done:true`, zero writes |
| failed-segment resubmit | phrase/grammar batches replaced (delete-then-insert per segment) |
| sentences | `content_id` unique — insert-if-missing, existing text NEVER touched |
| slot correspondence | `lang_content_ids` fill-null-only, never overwrite |
| explanations | fill-missing only (existing enrichment wins) |
| progress cache | recomputed from segments (source of truth) on every submit/release; hasColumn-guarded |
| release | lease-holders only; `done` never demoted |

## 9. Files

Laravel (`poly_apps/laravel_main/`):
- `database/migrations/AppQyV1_2026_07_03_000001_create_app_qy_v1_study_segments_table.php`
- `database/migrations/AppQyV1_2026_07_03_000002_create_app_qy_v1_study_phrases_table.php`
- `database/migrations/AppQyV1_2026_07_03_000003_create_app_qy_v1_study_grammar_points_table.php`
- `database/migrations/AppQyV1_2026_07_03_000004_add_study_gen_columns_to_books_and_articles.php`
- `app/Models/StudySegment.php`, `app/Models/StudyPhrase.php`, `app/Models/StudyGrammarPoint.php`
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1StudyGenService.php` (segmentation + protocol + writeback)
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1StudyGen/AppQyV1StudyGenController.php`
- `routes/AppQyV1Router/AppQyV1StudyGen.php` (+ one `require_once` in `routes/api.php`)
- `app/Apps/AppQyV1/AppQyV1ApiInfo.php` (catalog entries appended)

Chrome extension (`apps/mcp-chrome/app/chrome-extension/`):
- `composables/useExtensionConfig.ts` (registry entry)
- `entrypoints/popup/components/ExtensionsPanel.vue` (component registration)
- `entrypoints/popup/components/extensions/BookStudyGenerator.vue`
- `entrypoints/popup/composables/useBookStudyGenerator.ts` (loop + parser)
- `entrypoints/popup/composables/promptPresets.ts` (`buildBookStudySegmentPrompt`)

This doc: `development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md` —
referenced from the service/composable header comments on both sides.
