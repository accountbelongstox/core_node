# Single-version multi-sentence pipeline: three-end refactor (pycore / pycore UI / Laravel Main)

> **Scope note:** `FIX_20260816_2309_AGENT_HISTORY_PINNED_QWEN_PIPELINE.md` later
> pinned the agent-history profile to qwen3tts (no fallback) and made the
> rebuild rule engine-agnostic (marker only, `_REBUILD_ENGINES` removed), so
> pre-pin ChattTS-fallback records are also rebuilt. The marker contract
> itself (`tts_chunked`) is unchanged.

- **Date:** 2026-08-16 22:42
- **Scope:** `pycore` (engine + agent-history pipeline), `poly_apps/pycore_laravel_wordnew_ui` (pycore UI), `poly_apps/laravel_main` (Laravel Main API)
- **Status:** implemented (static checks only - `py_compile`; no builds/tests/services run, per repo rules)
- **Supersedes:** the pipeline-version half of `FIX_20260816_2210_MANAGED_SERVER_CODE_IDENTITY.md` (its code-identity contract stays)
- **Official reference:** QwenLM/Qwen3-TTS#258 - long single-shot synthesis degrades into noise in the second half; official recommendation is sentence-sized synthesis with concatenation
- **Related:** `FIX_20260816_2210_MANAGED_SERVER_CODE_IDENTITY.md`

## Requirements checklist (as mandated)

1. Refactor from the underlying architecture - no patches, no thin compatibility,
   follow the latest specs; merge shared libraries and duplicate implementations.
2. NO v1/v2 versioning - refactor directly to a SINGLE pipeline version.
3. The piggyback lane must repair old audio AND re-upload it to Laravel Main.
4. Laravel Main must expose an API endpoint that replaces article audio.
5. Old audio is identified BY ITS MISSING DATA (no marker); new generations
   carry a marker stating the audio is multi-sentence synthesized.
6. Three ends change together: pycore / pycore UI / Laravel Main.
7. When the piggyback scan finds nothing old it just generates; once the
   legacy backlog is drained, every later piggyback scan costs milliseconds.
8. Follow the official documentation (QwenLM/Qwen3-TTS#258 for the synthesis
   contract; LARAVEL_GUIDE.md for the Laravel side).
9. Update the fix docs (this file, plus the superseded note in FIX_20260816_2210).

## Design

### Single version, marker identity (no version negotiation)

There is exactly ONE synthesis pipeline: sentence-chunked multi-sentence
synthesis. "Is this audio current?" is therefore a binary fact, not a version
comparison:

- every qwen-lane synthesis result carries `"chunked": true`
  (`qwen3tts_synthesis.py`, echoed by `/status`);
- article records store `tts_chunked: true` (multi-sentence synthesized);
- a record with NO `tts_chunked` marker is legacy audio - missing data IS the
  legacy test. No `SENTENCE_CHUNK_VERSION` / `LEGACY_SENTENCE_CHUNK_VERSION`
  constants, no live-server version probes, no freeze-on-offline states.

Removed duplicates/versions across the chain:
`qwen3tts_synthesis.SENTENCE_CHUNK_VERSION`, `/status sentence_chunk_version`,
`qwen.config` mirror constants, `engine.active_sentence_chunk_version()`,
`orchestrator.engine_chunk_version()` (replaced by the static
`engine_chunked(engine) -> bool`).

### Piggyback rebuild (pycore, millisecond steady state)

`agent_history/pipeline/audio_rebuild.py`:

- candidate = uploaded + qwen-lane (`tts_engine` empty or `qwen3tts`) +
  attempts under cap + **marker missing**;
- `pending_rebuild_records()` is a pure local index scan (no server probe):
  0 candidates -> the tick continues directly into new generation work; after
  the backlog drains this costs one index read (milliseconds) per tick;
- one record per tick, oldest-first; rebuild = same `synthesize_audio` stage
  as new articles -> Laravel replace-audio -> local all-or-nothing re-stamp
  (`tts_chunked: true`, attempts reset);
- ordering contract unchanged: a tick that rebuilds never starts new work, so
  the backlog drains before new articles.

### Laravel Main (replacement endpoint)

`POST /api/app_qy_v1/ai_tools/article/worker/replace-audio`
(`AppQyV1ArticleController::workerReplaceAudio` ->
`AppQyV1DailyReadingService::replaceAudio`) - already the dedicated
replacement interface: resolves the agent_history article by `article_id` or
`reading_date`, rewrites the deterministic `<article_id>.mp3` (public
`audio_url` stays stable), and refreshes provenance metadata. Both worker
endpoints (`submit`, `replace-audio`) now carry the single marker:

- validation: `'tts_chunked' => 'nullable|boolean'` (replaces
  `tts_chunk_version` integer);
- metadata: `tts_chunked: bool` (provenance lives in the article `metadata`
  JSON column - no migration needed; per LARAVEL_GUIDE migrations are
  idempotent add-only, and no schema change is required here).

### pycore UI

`poly_apps/pycore_laravel_wordnew_ui` (pycore-manager / agent-history):

- record badge: `tts_chunked` -> green `multiSentence` ("multi-sentence" /
  "多句合成"); marker missing -> amber `legacyAudio` with the rebuild hint;
- config panel summary: dropped the numeric version readout, keeps
  `rebuildPending`;
- `pycoreTypes.ts`: `tts_chunk_version?: number` -> `tts_chunked?: boolean`;
- locales `en/zh`: `chunkVersion` key removed, `multiSentence` added (i18n,
  no hardcoded strings).

## Changed files

| End | File | Change |
| --- | --- | --- |
| pycore | `tts_install_assets/qwen3tts_synthesis.py` | single pipeline; results carry `chunked: true`; version constant deleted |
| pycore | `tts_install_assets/qwen3tts_api_server.py` | `/status`: `chunked: true` (+ `code_id` from FIX_20260816_2210), version field removed |
| pycore | `pyutils/tts/qwen/config.py` | version-mirror comment replaced by single-version marker note |
| pycore | `pyutils/tts/qwen/engine.py` | `active_sentence_chunk_version()` deleted |
| pycore | `pyutils/tts/tts_orchestrator.py` | `engine_chunked() -> bool`; all result dicts `chunk_version` -> `chunked` |
| pycore | `pyctl/agent_history/pipeline/audio_stage.py` | result key `chunked`; log wording |
| pycore | `pyctl/agent_history/pipeline/worker.py` | record field `tts_chunked`; log wording |
| pycore | `pyutils/agent_history/article_records.py` | schema doc + `mark_audio_rebuilt(tts_chunked=...)` |
| pycore | `pyctl/agent_history/pipeline/audio_rebuild.py` | marker-based candidates; pure local scan; no version probe |
| pycore | `pyctl/agent_history/pipeline/laravel_stage.py` | submit + replace payloads carry `tts_chunked` |
| pycore | `pyctl/agent_history/ui_service.py` | summary drops the version field |
| pycore UI | `pages/agent-history/PcAgentHistoryRecords.tsx` | marker badge (multi-sentence / legacy) |
| pycore UI | `pages/agent-history/PcAgentHistoryConfigPanel.tsx` | summary line without version readout |
| pycore UI | `core/integrations/pycore/pycoreTypes.ts` | record type marker field |
| pycore UI | `pc-locales/en.ts` / `zh.ts` | `multiSentence` key; dead `chunkVersion` removed |
| Laravel Main | `AppQyV1ArticleController.php` | submit + replace-audio: `tts_chunked` boolean |
| Laravel Main | `AppQyV1DailyReadingService.php` | replacement metadata carries `tts_chunked` |

## Data continuity

Existing records (stamped `tts_chunk_version: 0/1` or unstamped) all lack the
new marker, so they are all correctly classified as legacy and drain through
the piggyback lane; no migration shim, no version mapping - exactly the
"missing data = old" rule. The managed code-identity contract
(FIX_20260816_2210) keeps guaranteeing that any start loads the current
script set, so rebuilt audio always comes from the single multi-sentence
pipeline.

## Verification boundary

`py_compile` over all changed pycore files (passed). No tests, builds,
services, or process actions were run; the UI/PHP changes are static edits
following each end's existing conventions.
