---
name: project-sentence-floor-per-language
description: 2026-10-08 per-language sentence quality floor in pycore, lane_capability RPC, node load on claim/renew; where each piece lives and traps
metadata:
  type: project
---

- Floor is per language: `sentence_floor_engines(language)` / `sentence_engine_accepted(engine, language)` in `pyutils/common/queue_center_contract.py` (reads `work_leases.sentence_quality.accepted_engines_by_language`; en -> qwen3tts only, None = any engine). `SENTENCE_QUALITY_ENGINES` is gone. A CPU kokoro node declares only zh sentences (kokoro speaks en, zh).
- `AudioLaneLeases.declared(base_url, claiming)` is the one source of the claim capability and of RPC `ui/queue_center/lane_capability` (service `pyctl/queue_center/lane_capability_service.py`; relay policy general_read added to `config/pycore_relay_contract.json`). `claiming=False` neither rotates word languages nor touches `SentenceLanguageFocus` state or does network.
- `node_sid` = sha1("node:" + node_device_id())[:work_leases.sid_length]; matches Laravel work_nodes[].sid (verified live 31a9).
- Node load: `pyutils/common/system_resources.py` (moved from video_extract_service; NVML skipped when `gpu_present()` is false, retry 300 s, one log per error) + `pyctl/laravel/worker/node_load.py`, attached in `WorkLeaseClient.claim/renew`. The first sample after a restart reports cpu_percent 0.0 (psutil baseline).
- Left open: `lane_auto._warm_sentence_engine` still warms qwen on a CPU node when the sentence lane is enabled (logs a warm-up failure only); an `engine_hint` of qwen3tts on a zh row leased to a CPU node would be re-pooled as ENGINE_HINT_UNAVAILABLE.

**Why:** user-approved R13 change: CPU or GPU for words/phrases/zh sentences, GPU only for en sentences. **How to apply:** never reintroduce a global engine set; new sentence-floor checks go through `sentence_engine_accepted`. See [[project-pycore-pitfalls]].
