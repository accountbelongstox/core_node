# Phrase Pipeline (sentence → phrases → phrase audio → wordnew orchestration)

Authority: code > `config/audio_orchestration_contract.json` `phrase_pipeline` + `config/queue_center_contract.json` (`work_leases` lane `phrase_audio`, task types `phrase_audio` / `phrase_extract`, endpoints `audio_phrase_*`, `phrases_by_sentences`) > this document.

Related: `DESIGN_QUEUE_PIPELINE.md` (work leases, delivery), `DESIGN_AUDIO_ORCHESTRATION.md` (pycore lanes, clip routes), `DESIGN_WORDNEW_CLIENT.md` + `development-guides/WORDNEW_GUIDE.md` §1 (clip scheduler).

## 1. Flow

```
sys:init ──align tables/indexes, seed prompt, re-pool failed──┐
                                                              ▼
 sentences_{lang} (phrase_status IS NULL = gap) ──Octane timer AppQyV1PhraseExtractionTask──►
   claim batch (phrase lease cols) ─► AiGateway openrouter free + prompt `sentence_phrase_extraction`
      ├─ ok ─► AppQyV1PhraseWriter::store (idempotent upsert phrases_{lang} + sentence_phrases_{lang}, sentence phrase_status done|none)
      └─ AI_RATE_LIMITED / not configured / budget ─► global_tasks `phrase_extract` ─► pycore (own OpenRouter free key) ─► result writeback ─► same writer
 phrases_{lang} (has_audio IS NOT TRUE = gap, lane phrase_audio)
   ├─ Laravel work leases (all nodes, cpu_ok, kokoro batch)            ── primary when no wordnew page drives
   └─ wordnew orchestration page + online direct pycore: generate:pycore kind phrase / R12 windows lane phrase_audio ── primary while open
 pycore phrase_audio lane ─► phrase cache (permanent, R13) ─► audio_phrase_report (outbox) ─► phrase_sounds/<lang>/<content_id>.mp3
 wordnew planner: step `phrases` after a sentence ─► phrase clip (+ zh meaning clip) through buildOrchClipSchedule (R1 unchanged)
```

## 2. Identity

- `content_id = media_content_id(text)` (md5 of collapse_ws(lower(strip P/S))) — same function as sentences (pycore `pyutils/common/strtools/normalization.media_content_id`, Laravel `MediaIngestService`, TS `orchContentId`).
- `resource_id = sha256("phrase:<language>:<content_id>")`; clip kind `phrase` on every end (`OrchResourceKind`, pycore resource routes, Laravel bundle/lookup).
- Phrase meaning clip: kind `sentence`, language `zh`, text = meaning (same as word meanings; never a separate kind).

## 3. Laravel data (AppQyV1, one table per language, created only by sys:init)

`AppQyV1TableMaps::getPhraseTableName($lang)` → `{prefix}_phrases_{lang}`:

| column | type | note |
|---|---|---|
| id | bigserial | |
| content_id | char(32) unique | identity |
| text | varchar(200) | phrase as spoken |
| language | varchar(8) | |
| meaning | text null | Chinese gloss (`meaning_language`) |
| sentence_count | int default 0 | number of linked sentences (rank) |
| origin | varchar(16) | `ai` \| `adhoc` (report-created) |
| source_model | varchar(120) null | model that produced it first |
| audio, has_audio, audio_files, tts_status, tts_attempts, tts_error, tts_locked_at, tts_locked_by, tts_lease_id, tts_lease_expires_at, tts_priority, tts_requested_at, tts_completed_at | same as sentence table | lease lane `phrase_audio` |
| created_at, updated_at | | |

Indexes (`AppQyV1MediaGaps::ensurePhraseIndexes`, prefix `idx_phr_<lang>`): gap partial on `PHRASE_AUDIO` (`has_audio IS NOT TRUE`) ordered by the contract rank, `_lease_expiry`, `_tts_failed_id`.

`AppQyV1TableMaps::getSentencePhraseTableName($lang)` → `{prefix}_sentence_phrases_{lang}`: id, sentence_content_id char(32), phrase_content_id char(32), ord smallint, created_at; unique (sentence_content_id, phrase_content_id); index phrase_content_id.

Sentence table additions (add-only): `phrase_status` varchar(8) null (`NULL` pending, `done`, `none`, `failed`), `phrase_attempts` smallint default 0, `phrase_lease_id`, `phrase_lease_expires_at`, `phrase_locked_by`, `phrase_priority` int default 0, `phrase_generated_at`. Gap `AppQyV1MediaGaps::SENTENCE_PHRASES` = `phrase_status IS NULL AND SENTENCE_LIVE`; partial index `idx_sent_<lang>_phrase_gap (phrase_priority DESC, id)`.

Idempotency rules:
- Upsert phrases by `content_id` (`upsert` with non-empty `uniqueBy`): fill-missing, never clobber `meaning`, `audio`, `has_audio`. An existing phrase with audio is never put back in the gap; one without audio stays in the gap.
- Links upsert by (sentence, phrase); `sentence_count` recomputed for touched phrases.
- A sentence with links or `phrase_status in (done, none)` is never sent to AI again.

## 4. Extraction (Laravel primary, pycore fallback)

- `AppQyV1PhraseExtractionService` + Octane timer `AppQyV1PhraseExtractionTask` (every `extraction.tick_seconds`, at most one request per `min_interval_seconds`): claim up to `batch_sentences` gap sentences within `batch_max_chars` (`FOR UPDATE SKIP LOCKED`, phrase lease `lease_seconds`), languages from `phrase_pipeline.languages`, priority `phrase_priority DESC, id`.
- Prompt: code-owned row `sentence_phrase_extraction` in `AppQyV1AiPromptDefaults` (seeded by sys:init). Input lines `<n>\t<sentence>`; output strict JSON `{"items":[{"n":1,"phrases":[{"text":"...","meaning":"<zh>"}]}]}`; phrases are multi-word expressions (phrasal verbs, collocations, idioms, fixed chunks) copied verbatim from the sentence, ≤ `phrase_max_words` words, ≤ `max_phrases_per_sentence` per sentence; single words are rejected by the parser.
- Gateway: `AiGateway::chatWith('openrouter', prompt, 'openrouter/free', ...)` with `max_tokens = max_output_tokens`, `temperature`; free-only enforced by `OpenRouterFreeOnly`.
- Parse: tolerant JSON (fences, prose), validate each phrase occurs in its sentence (case/punctuation-insensitive), dedupe by content_id.
- Failure handling: `pycore_fallback_codes` → release the claim and create one `global_tasks` row of type `phrase_extract` (payload `{language, prompt_key, prompt, sentences:[{content_id, text}]}`, at most `pycore_tasks_max_pending` open; the sentences keep a lease of the task's lifetime); other failures add `phrase_attempts`, after `max_attempts` → `failed`.
- pycore `phrase_extract` handler: runs the payload prompt through its OpenRouter client (free model), returns the raw answer; Laravel writeback parses it with the same parser and writer.
- sys:init: align, seed prompt, return `failed` sentences to the pool (attempts 0), clear stale phrase leases, log the gap per language. The timer then works the gap (that is the queue).

## 5. Phrase audio (lane `phrase_audio`)

- Laravel: `WorkLeaseLanes` gains `PHRASE_AUDIO` (table = phrase table, gap = `PHRASE_AUDIO`, key column `content_id`, text column `text`, languages = phrase tables that exist); `GapLaneSnapshot`, `WorkLeaseService`, reaper/resurface, `work_nodes` pool, Queue Center progress include it. Task type `phrase_audio` is `cpu_ok`.
- Report `POST ai_tools/tts/phrase/report` (`audio_phrase_report`, multipart like the sentence report: `content_id`, `language`, `text`, `provider`, file): stores `PathMapper::getAppQyV1PhraseSoundsDir()/<lang>/<content_id>.mp3`, sets `audio`, `has_audio`, clears the lease, notes completion, emits `clip.ready` (resource id kind phrase); creates the row from `text` (origin `adhoc`) when missing; duplicate → 200 `already_done`.
- Passive read `GET ai_tools/tts/phrase/audio?text=&language=&passive=1` (`audio_phrase_audio`): file URL/stream or 404 + promotion (`tts_priority` raise) when not passive.
- `audio/lookup` and `audio/bundle` accept `kind: phrase`.
- `POST phrases/by_sentences` (`phrases_by_sentences`, auth:sanctum or client key): `{language, content_ids[] ≤ 500}` → `{items:[{content_id, status, phrases:[{content_id, text, meaning, has_audio, version}]}]}` in request order; status = sentence `phrase_status` (`pending` for NULL). Unknown sentence → status `unknown`, and the sentence gets `phrase_priority` raised when it exists.
- Book plans: `include_phrases` adds the plan's phrase clips (lane `phrase_audio`) to counters, ready cursor, priority raising and R12 assignment windows.

## 6. pycore

- Lane `phrase_audio` beside `word_audio` / `sentence_audio`: queue model, lane registry, activation, lease intake (`AudioLaneLeases`), engine policy (`lane_capability`: word-batch engine, cpu ok), assist settings/capability sync, lane state, Queue Center views.
- Synthesis: kokoro batch through the word batch entry generalized to phrases (`kokoro_batch.synthesize_phrases_to_cache`), chunks of `audio.batch_chunk_size`.
- Cache `pyutils/tts/phrase_audio_cache.py`: content-addressed `<cache>/tts_phrase_cache/<lang>/<content_id>@<provider>.mp3`, in-memory index loaded at boot, permanent (R13).
- Delivery: `audio_cache.resource` kind phrase → `audio_phrase_report` through the outbox.
- Clip routes `ui/audio_orch/resource/{lookup,bundle,file,chunk}` accept `kind: phrase`; `ui/queue_center/promote_local_head` accepts lane `phrase_audio` (wordnew `generate:pycore`).
- Orchestration (`orch_plan`): step `phrases` emits, per sentence, its phrases (from Laravel `phrases_by_sentences`, cached in the task manifest) and, with `meaning`, the zh meaning clip.
- Global task `phrase_extract`: handler under `pyctl/` using `pyutils/ai_cluster/openrouter` free model; result `{text}`.

## 7. wordnew / shared orchestration

- `OrchResourceKind` = `word | sentence | phrase`; `orchClipIdentity('phrase', …)` uses `orchContentId`; `orchClipLocations` Laravel path = `audio_phrase_audio`.
- Step type `phrases` (contract `step_types`), editor option `meaning`; `orchStageLayout` attaches phrase clips to the sentence card they belong to.
- Planner fetches phrases for the plan sentences through one data-model call (`phrases_by_sentences`, paged by 500, cached per sentence in device storage); sentences still `pending` are re-asked on the next run (resume rule R9).
- Scheduler order R1 is unchanged: phrase clips go through the same stages. Phrase audio may be generated on CPU (no R13 quality floor). While the orchestration page is open with an online direct pycore, wordnew leads (generate:pycore + R12 windows on lane `phrase_audio`); otherwise Laravel leads.
- Book plan request sets `include_phrases` when the pattern has a `phrases` step.

## 8. Development notes (rules for every change)

- Never call AI for a sentence that already has links or a terminal `phrase_status`; never regenerate phrase audio that exists (R14 on devices, has_audio on Laravel, cache on pycore).
- All batch sizes, rates and keys come from `phrase_pipeline`; no literals.
- Tables/columns only through `SafeMigrationHelper` / sys:init, add-only.
- Laravel never calls pycore; pycore only pulls (leases, global_tasks).
- User-facing strings through i18n (Laravel `lang/{en,zh_CN}`, wordnew locales, pycore i18n keys).
- Changing the phrase kind or step in the scheduler requires updating `WORDNEW_GUIDE.md` §1 and the drill `TEST_20261001_ORCH_CLIP_SCHEDULER_DRILL.md` (S1–S8 + 300 random rounds, 0 violations).

## 9. Verification

- Laravel: `php -l` on changed files; on the server `sys:init` (via `laravel_signed_cli.js sys-init`), then the log API; `GET work/nodes` shows lane `phrase_audio` pool; `phrases/by_sentences` on a known sentence.
- pycore: import check, `dd.cmd pycorerestart`, log shows lane `phrase_audio` activation; `resource/lookup` with kind phrase.
- TS: `tsc --noEmit` for wordnew / shared; drill with bun.
