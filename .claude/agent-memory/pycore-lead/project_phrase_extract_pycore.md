---
name: project-phrase-extract-pycore
description: 2026-10-05 pycore phrase_extract global-task handler (rides the compute worker); contract vocabulary dependency, TaskRelease contract, key probe gating
metadata:
  type: project
---

pycore executes Laravel `phrase_extract` tasks inside `laravel_compute_worker` (handler `pyctl/laravel/phrase_extract_handler.py`), not a dedicated lane.

- `LaravelHandlerWorker` gained `register_handler(..., available=)` (types declared/pulled only while the check holds; processor types and capabilities derive from it) and a `TaskRelease` handler outcome (consume staged row, `_claims.release`, per-type pull pause). Laravel's release route only releases `assigned` tasks, so a release after the first `processing` keepalive ping (15 s+) is skipped server-side and the lease timeout re-queues.
- `chat_once` / `free_text_chat` take `options` (temperature, max_tokens), applied only by openai_compat providers.
- `ai_gateway.generate_text` is NOT usable for free-only work: its fallback chain reaches paid tiers. Use `ai_free_text.free_text_chat`.
- The handler is inert (yellow log at import) until `config/queue_center_contract.json` declares `execution_types.remote_phrase_extract` and `capability_claimants.phrase_extract`: Laravel validates register/pull `processor_types`/`capabilities` against those and a 422 would break the whole compute lane (OCR/TTS too). phrase_audio needs the same two entries.

**Why:** a dedicated lane would need `assist_callback_states` edits (assist files owned elsewhere); the compute lane is always on.
**How to apply:** when touching the compute worker or adding a Laravel-pulled AI task, reuse `available=`/`TaskRelease`; check the contract vocabulary first. See [[project-pycore-pitfalls]].
