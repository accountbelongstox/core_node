# FIX 2026-09-19 — Word-audio upload 404 retry poisoning + f5tts unmanaged-config noise

> **Note (2026-09-26):** The `not_found` terminal-delivery fix still holds
> (`orch_resources._deliver_owned`). Line references are historical.
> Orchestration no longer synthesizes word tokens one by one: missing words
> fill Part1 of the word_audio Queue and are generated in Kokoro batches
> (`docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md`).

Session follow-up to `FIX_20260919_SILENT_EXITS_CUDA_HF_GATED.md`. Two defects found
in the audio-orchestration delivery path and the TTS engine chain.

## 1. `POST /api/app_qy_v1/word/audio/upload` -> 404 "No dictionary row for the given md5/lang"

### Symptom

```
[laravel] POST /api/app_qy_v1/word/audio/upload -> 404 (645ms) success=False
[AudioOrch] delivery=orchestration:... pending: HTTP 404: {"success":false,
  "message":"No dictionary row for the given md5\/lang","data":{"status":"not_found", ...}}
```

repeating forever for the same delivery ids.

### Upload intent (why pycore posts word audio at all)

`audio_orchestration` tokenizes book sentences into word tokens
(`orch_words.py:64`), synthesizes each token, and — besides using the local
staging file for the book audio itself — opportunistically uploads the clip to
the dictionary as **fill-missing**: the dictionary keeps one audio per
`(lang, md5(lowercase word))` and pycore donates clips for words that lack one.

Server side (by design, unchanged):

- `AppQyV1WordMediaController::uploadAudio` ->
  `AppQyV1DictionaryTTSCoordinator::storeWordAudioBytesDetailed` ->
  `AppQyV1LangDictionaryModel::findByMd5(lang, md5)`.
- No dictionary row -> 404 `{data:{status:"not_found"}}` with an explicit "do
  NOT mark done; FE must surface" contract.
- Dictionary md5 contract is `md5(lowercase word)`
  (`AppQyV1DictionaryService.php:181/185`); pycore computes the same
  (`orch_resources.py:315`), so this is **not** an md5 mismatch — the token
  (e.g. a Bible proper noun like "elishah") simply is not a dictionary entry.

### Root cause (pycore side)

1. `word_audio_service.upload_word_audio` collapsed every non-200 into
   `"HTTP 404: {text[:200]}"`, discarding the structured `data.status`, so
   callers could not distinguish a permanent "not a dictionary word" from a
   transient failure.
2. `orch_resources._deliver_owned` raised on any non-stored receipt, and the
   outbox `release(retry_at=...)` retried the permanent 404 forever —
   retry-poisoning the outbox and spamming logs.

### Fix

- `pycore/pyctl/tts/word_audio_service.py:292` — on non-200, parse the JSON
  body and pass through `data.status` / `message` / `http_status` (graceful
  fallback to the old text snippet when the body is not JSON).
- `pycore/pyctl/audio_orchestration/orch_resources.py:320` — when the receipt
  carries `data.status == "not_found"`, treat the delivery as terminal: log one
  info line and `complete()` normally; no raise, no retry. Genuine failures
  still raise and retry as before.

## 2. `[tts] failed synth command: f5tts POST /process ...` noise

### Root cause

`f5tts` is a managed class-C server engine, so the orchestrator
(`tts_orchestrator.py`) skips the availability probe and goes straight to
`managed_services.lease(name)`, which **starts the heavy torch server on
demand**. But `F5TTS_REF_AUDIO` / `F5TTS_REF_TEXT` were never configured
(installers only print them as instructions), so `f5tts_engine.synthesize()`
returned False instantly with `disabled_reason() = "Set F5TTS_REF_AUDIO to a
reference clip"` — after the lease had already paid the server-start cost, and
with a misleading "failed synth command" log for every word.

### Fix

- `engine_registry.py` — `TTSEngineAdapter.has_config_gate()` marks adapters
  with an explicit `config_ready` callable; the `f5tts` adapter now declares
  `config_ready=lambda: f5tts_engine.disabled_reason() is None`.
- `tts_orchestrator.py` — for managed engines with a config gate that fails,
  skip the engine **before leasing** (gray log `[tts] f5tts skipped: Set
  F5TTS_REF_AUDIO ...`), so the server is not started for a configuration the
  lease can never fix. `last_error` still carries the reason into the final
  result. Engines whose default `config_ready` probes server liveness
  (fishspeech) are untouched — they must still be leased to auto-start.
  `gptsovits` already had an explicit gate and benefits from the same skip.

## Verification

- `py_compile` passes for all four touched files; mixed-CRLF files byte-checked
  (no lone CR introduced).
- Registry probe: `f5tts.has_config_gate() == True`, `config_ready() == False`
  with the expected reason when `F5TTS_REF_AUDIO` is unset.
- `upload_word_audio` against a fake 404 response now returns
  `{success: False, data: {status: "not_found"}, http_status: 404, error: ...}`.
