# FIX 20260817 0020 - Qwen 0.75 Default Speed + Strict Sentence Chunk Budgets + Playback Cache-Bust

Follow-up to `FIX_20260816_2309_AGENT_HISTORY_PINNED_QWEN_PIPELINE.md` and
`FIX_20260816_2242_SINGLE_VERSION_MULTI_SENTENCE_PIPELINE.md`.

## Reported symptoms (2026-08-15 records, agent_history)

1. Records tagged `rebuilt` still play muffled/degraded (模糊音) audio.
2. Playback after replacement can still serve OLD audio bytes.
3. Qwen TTS must generate at a 0.75 default speech rate.
4. Merged sentence chunks must stay short even for short multi-sentence texts.

## Root causes found

### A. The `rebuilt` stamp on the 26 affected records predates the pinned pipeline

All 26 `audio_rebuilt_at` stamps were written 2026-08-16 12:50-13:06, BEFORE
`FIX_20260816_2242` (22:42) and `FIX_20260816_2309` (23:09) landed. The old
rebuild lane still allowed the cloud fallback chain, so those rebuilds fell
back to ChattTS single-shot synthesis (ChattTS official limit: ~30s of audio
per pass, issue jianchang512/pyvideotrans#113 / 2noise/ChatTTS degradation on
long single passes) and re-uploaded degraded audio while stamping `rebuilt`.
Evidence: those records keep `tts_engine='chattts'`, `tts_chunked=False`.

Under the current marker rule (`uploaded && !tts_chunked` = rebuild
candidate, engine-agnostic) every one of them is still queued and will be
regenerated through the pinned qwen3tts-only pipeline (1 record/tick,
oldest-first). Nothing needed to change for the regeneration itself.

### B. Playback cache (the "click play still plays old audio" bug)

Laravel serves article audio from a STABLE URL with
`Cache-Control: public, max-age=86400` (StaticFileController, deliberate for
the read-heavy public site). After a rebuild replaces the bytes, a browser
that already cached the URL keeps replaying the OLD copy for up to 24h.
Fixed on the player side: the pycore-manager records player now appends
`?v=<audio_rebuilt_at ?? uploaded_at ?? created_at>` to the audio src, so any
replacement immediately resolves to a fresh URL (browsers cache by full URL).

## Changes

### 1. Default speed 0.75 - one source of truth

- `pyfoundations/network_constants.py`: new `QWEN3TTS_DEFAULT_SPEED = 0.75`
  (shared constant; exported in `__all__`).
- `pyutils/tts/qwen/config.py`: `default_speed()` = env `QWEN3TTS_SPEED` else
  the shared constant, clamped to [0.25, 3.0].
- `tts_install_assets/qwen3tts_api_server.py`: `_default_speed()` = same env
  else `QWEN3TTS_DEFAULT_SPEED` read from the source-loaded
  pyfoundations.network_constants module (the managed launch inherits the
  environment, so both sides always agree); injected into `QwenSynthesis` as
  `default_speed` (DI, not import - the synthesis module is registered in the
  isolated venv before the pycore namespace exists). `/status` now reports
  `"speed"`.
- `qwen3tts_synthesis.py`: the official `generate_custom_voice` API has no
  speed parameter, so speed is applied ONCE to each final waveform via
  `librosa.effects.time_stretch` (pitch-preserving phase vocoder; librosa is a
  hard dependency of qwen-tts in the isolated venv): in `generate_one`
  (single + chunked paths), per-job in `generate_queue_batch`'s batched
  branch, and the default in variant generation. Every result reports
  `"speed"`.
- Wire contract: `SynthRequest.speed: Optional[float]` (also inherited by
  `QueueSubmitRequest`); None -> server default. `qwen/engine.py`:
  `effective_speed(rate)` resolves an explicit rate hint (reusing
  `engine_policy.tts_rate_to_speed`, single rate parser) or forwards None so
  the SERVER default applies; the identity hash of queued jobs includes the
  speed; `speed` is part of the submit payload.
- `engine_registry.QwenTTSEngineAdapter` now passes
  `speed=self.module.effective_speed(request.rate)` - speed policy lives with
  the engine, and "no rate hint" no longer means 1.0, it means the server
  default (0.75).

### 2. Speed is part of the sentence-audio cache identity

`engine_policy.sentence_tts_cache_identity(accent, gender, rate=None)` now
returns a 4th element: the resolved speed (`rate` -> its factor, else the qwen
default). `sentence_audio_cache.make_key/lookup_or_none/store_result` accept a
`speed` field; `tts_orchestrator` passes it through for both lookup and store.
Effect: pre-change cached 1.0-speed audio can never be served as 0.75 audio;
changing `QWEN3TTS_SPEED` invalidates the cache correctly.

### 3. Strict sentence-chunk budgets (merged chunks stay short)

`qwen3tts_synthesis.py` rework of `_split_long_text` / `_pack_units`:

- ALWAYS sentence-split (removed the `len(cleaned) <= max_chars` single-shot
  short-circuit). Even a short multi-sentence article is split at sentence
  boundaries first.
- Two budgets: HARD cap (`QWEN3TTS_CHUNK_MAX_CHARS`, default 280 chars at
  speed 1.0, ~20s of audio) and MERGE cap (60% of the hard cap). Adjacent
  sentences merge only while the merged chunk fits the MERGE cap, so a
  multi-sentence text never collapses into one long merged chunk; a single
  sentence longer than the merge cap (but within the hard cap) is still
  synthesized whole; only beyond the hard cap is hard-cut (clause, then word).
- Both budgets scale with speed (`cap x min(1.0, speed)`): the degradation
  bound is per-generation DURATION - slower speech makes the same characters
  longer audio. At the 0.75 default: hard 210 chars, merge 126 chars (~12s).

### 4. UI (pycore-manager agent-history records)

- The amber "legacy audio" badge STAYS: a record still carrying old audio
  keeps the badge; it clears exactly when the rebuild lands (the marker
  flips `tts_chunked` and the green multi-sentence badge takes over) - not
  earlier. Hover text updated accordingly. The green 多句合成/multi-sentence
  badge (hover shows the generating engine) and blue 已重建/rebuilt badge
  (hover shows timestamp + engine) are unchanged; the engine field keeps
  showing exactly which TTS produced each record's audio.
- Player src cache-bust (root cause B above).

## Files

- pycore/pyfoundations/network_constants.py
- pycore/pyutils/tts/qwen/config.py
- pycore/pyutils/tts/qwen/engine.py
- pycore/pyutils/tts/qwen/client.py (unchanged; payload passthrough)
- pycore/pyutils/tts/engine_registry.py (QwenTTSEngineAdapter only)
- pycore/pyutils/tts/engine_policy.py
- pycore/pyutils/tts/sentence_audio_cache.py
- pycore/pyutils/tts/tts_orchestrator.py
- pycore/tts_install_assets/qwen3tts_synthesis.py
- pycore/tts_install_assets/qwen3tts_api_server.py
- pycore/pyutils/laravel/article_contract.py (NEW)
- pycore/pyctl/agent_history/pipeline/article_stages.py
- poly_apps/pycore_laravel_wordnew_ui/apps/pycore-manager/pages/agent-history/PcAgentHistoryRecords.tsx
- poly_apps/pycore_laravel_wordnew_ui/apps/pycore-manager/pc-locales/en.ts / zh.ts

Laravel main: no changes (replace-audio already swaps the bytes at the stable
path and persists `tts_engine`/`tts_chunked`; the static cache policy is
intentional and now handled by the versioned player URL).

## Follow-up 2026-08-17: worker/submit 422 (title > 255) - pycore owns payload composition

Symptom: `POST .../article/worker/submit -> 422 The title field must not be
greater than 255 characters.` An LLM-generated `title_en` longer than 255
characters was pushed raw to Laravel; the Validator rejected it (articles.title
is VARCHAR(255) - official Laravel schema convention) and the deferred-upload
retry lane re-failed on the same poison payload every tick.

Architectural rule (per the pipeline contract): pycore AUTOMATICALLY accepts
documents of any size, generates/synthesizes in batches internally (sentence
chunking for TTS; OpenRouter stages for text), combines the result, and
delivers an ALREADY contract-compliant payload to Laravel. The external side
only validates and stores - it never truncates, splits, or combines.

Implementation:

- NEW `pycore/pyutils/laravel/article_contract.py` - single source of the
  worker/submit field contract (title/title_en/title_cn <= 255,
  reference_cn <= 5000, raw_preview <= 2000, article_text <= 50000, mirroring
  the Laravel validator exactly):
  - `clip_on_boundary(text, limit)` - clips on a natural boundary (sentence
    end -> word -> character) with a within-limit ellipsis; EN and CJK safe.
    Fuzz-verified to never exceed its limit for any input.
  - `compose_title(source, document)` - deterministic bounded title (explicit
    title clipped, else first sentence of the document, else pipeline
    fallback); replaces the two duplicated first-8-words fallbacks.
  - `compose_worker_text_fields(article, raw_text)` - normalizes EVERY text
    field of the submit payload in one place.
- `laravel_stage.upload_to_laravel` composes through the contract module; the
  scattered magic clamps (`[:4800]`, `[:49000]`, `[:2000]`) are deleted.
- `article_stages` prompts now ask for concise titles (<= 60 chars) and both
  generation stages normalize their titles through the same contract, so
  records/checkpoints/UI never carry oversized titles at all; the retry lane
  also converges (a stored >255 title is clipped at the submit boundary).
- Laravel main: unchanged - it was already a pure validator (no truncation on
  its side to remove).

## Follow-up 2026-08-17 (2): random native voice per task (qwen3tts)

Requirement: every generated article defaults to a RANDOM voice character;
within one task (a long text split into sentence chunks) ALL chunks share the
SAME voice - one random pick per task.

Implementation (official model card, Qwen3-TTS-12Hz-1.7B/0.6B-CustomVoice,
9 premium timbres with native languages - "use each speaker's native language
for best quality"):

- `qwen3tts_api_server.py`: new `_SPEAKER_NATIVE_POOL` per language
  (en: Ryan, Aiden | zh: Vivian, Serena, Uncle_Fu, Dylan, Eric | ja: Ono_Anna
  | ko: Sohee). `_resolve_speaker(..., random_default=True)` picks uniformly
  at random from the native pool INTERSECTED with the model's runtime
  capability set (`get_supported_speakers()`); languages without native
  speakers fall back to the full supported set (flagged). Explicit request or
  the `QWEN3TTS_SPEAKER` env pin still wins (no randomness). The ordered
  `_SPEAKER_PRESETS` path stays for VARIANT previews (distinct voice per
  variant index). Deleted the dead `_speaker()` wrapper.
- `qwen3tts_synthesis.py`: `generate_one` and `generate_queue_batch` resolve
  the speaker ONCE per job with `random_default=True` - one random voice per
  task; `_generate_chunked` reuses that speaker for every sentence chunk of
  the job. Every synthesis result reports `"speaker"` and
  `"speaker_random"`; the chunk log line includes the speaker.
- pycore sentence-audio cache: unchanged semantics - identical text hits the
  cached audio (the voice chosen for that first task is pinned with it);
  distinct tasks roll a fresh random voice at synthesis time.

Verified: resolution logic unit-exercised standalone (en/zh pool coverage,
  non-native fallback, explicit/env pin precedence, unknown-speaker rejection,
  restricted capability set, ordered variant path unchanged).

## Operational notes

- The api server scripts are covered by the managed code-identity digest
  (tts_service_manager), so the changed server code triggers the usual managed
  restart - no manual action.
- 492/500 existing records are rebuild candidates and will converge through
  the pinned qwen lane; the 26 lying `rebuilt` stamps will be overwritten by
  real qwen3tts rebuilds.
- `QWEN3TTS_SPEED` overrides the default on both sides (same env, inherited
  by the managed launch); request-level `speed` overrides per job.

Verified: `python -m py_compile` on all touched python files; chunk-splitting
logic unit-exercised standalone (merge cap respected, pathological hard-cut,
Chinese sentence boundaries). No builds/tests/services run.
