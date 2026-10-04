---
name: project-phrase-audio-pycore
description: 2026-10-05 phrase pipeline pycore audio side: phrase cache, batch entry, delivery kind phrase; decisions and gaps
metadata:
  type: project
---

Phrase audio (pycore side, 2026-10-05): permanent cache `<CACHE_DIR>/tts_phrase_cache/<lang>/<content_id>@<provider>.mp3` (`pyutils/tts/phrase_audio_cache.py`, index lazy-starts on first lookup), `kokoro_batch.synthesize_phrases_to_cache` shares `_synthesize_batch_to_cache` with the word entry, ledger kind `phrase` keys by media_content_id.

- Phrase clips have NO W7 diff kind (contract `delivery.batch_kinds` is word/sentence only): `audio_cache.resource` never lists them in its inventory (no reconcile self-heal) and sends them through single-clip `audio_phrase_report`; the lane row (`audio_lane.phrase`) carries the leasing server, the resource kind every other server.
- 4xx (not 408/409/425/429) dead-letters via `is_terminal_delivery_rejection`; the cache file is never deleted (R13).
- `already_done` receipt status is treated as delivered.

**Why:** Laravel delivery contract had no phrase diff kind when this was built.
**How to apply:** if Laravel adds `phrase_audio` to delivery/info kinds, add phrase rows to `AudioResourceDelivery._inventory` (needs `ITEM_KINDS` diff kind) to restore reconcile. See [[project-pycore-pitfalls]].
