# AI model manifest, boot masking, AI hub and live monitors (2026-09-30)

Scope: `/pycore-manager/ai`. Replaces per-domain engine/provider tables with one manifest, adds boot masking, a
category-agnostic hub (catalog, test, history), and live load/queue/progress monitors for qwen3tts and kokoro.

## 1. Manifest (DONE, leaf modules in `pycore/pyutils/common`)
- `model_manifest.py`: `ModelEntry` (id, category, runtime, note, aliases, managed_kind, concurrency, distribution,
  tier_engine, tiered, pip=(module, dist), library_name, languages, chunk_capable, accent_aware, cloud, health_paths,
  live, testable, verify), `BootVerdict` (+ `ready()/deferred()/blocked()`), registry `model_manifest`
  (`register`, `get(id_or_alias)`, `entries(category)`, `ids`, `categories`). Ids normalize `-` to `_` for lookup
  (`faster-whisper` == `faster_whisper`); aliases cover the rest (`windows` == `windows_ocr`).
- `model_reasons.py`: cross-category coded reasons (`model_reason(MODEL_REASON_*, ...)`).
- `model_boot.py`: `model_boot.verify(id)`, `record(id)`, `is_blocked(id)`, `reason(id)`, `blocked_ids(category)`,
  `records(category)`; verdicts are THREAD_BUS signals `model.boot.verdict.<id>`.
- Each domain declares its entries ONCE in a leaf `<domain>_manifest.py` (declarations + verify hooks, no runtime
  imports of heavy engines) and calls `model_manifest.register(...)`. `pyctl/ai_hub/manifest_loader.py` imports every
  declaring leaf so the registry is complete. Other tables (capabilities, priority, status, policies) DERIVE from the
  registry; a fact lives in exactly one place.
- Verdict semantics: `ready` usable; `deferred` fixable by the managed lifecycle (venv build, first download; never
  masked); `blocked` hard precondition missing (API key, package, weights, binary, load error) -> masked until
  `retry`.

## 2. Boot (pyctl)
- `pyctl/ai_hub/boot_service.py`: `start()` runs on a bus task at runtime-worker start (event_handlers): loads the
  manifest, runs `model_boot.verify` for every entry (a raising verify records a `blocked` load failure), prints one
  summary, publishes topic `ai_hub.boot.changed` per verdict change. `retry(id|None)` re-verifies.
- Masking consumers call `model_boot.is_blocked(id)`: TTS adapter `available()/config_ready()/disabled_reason()`, STT/OCR/
  LLM availability, AI gateway `_candidates` and probe skip, managed_service `ensure_running` (never starts a blocked
  server), priority chains (blocked engines are skipped, not reordered).

## 3. Hub routes (pyctl/ai_hub + callmodule/rpc_routes/ai_hub_routes.py), all `{success, data|error}`
- `ui/ai_hub/catalog` -> `{categories:[{id, entries:[Entry]}]}`; Entry = `{id, category, runtime, note, aliases,
  tier:{gpu,cpu,active,env}|null, boot:{state, reason, reason_code, reason_params, checked_at},
  runtime_state:{installed, available, running, model_loaded, in_flight, idle_remaining_s, reason, reason_code,
  reason_params}, capabilities:{test, history, power, live}, test_schema:{fields:[{key,type,label,options?,default?,
  min?,max?}]}}` (`live` = `qwen_queue|word_batch|null`).
- `ui/ai_hub/test` `{id, params}` -> `{record_id, ok, kind, elapsed_ms, result, error?}`; dispatches by category to the
  existing test services (tts/stt/ocr/ai chat/ai image/llm/translate), ALWAYS writes one history record.
- `ui/ai_hub/history` `{id?, category?, limit?, before?}` -> `{records:[{record_id, id, category, ok, created_at,
  elapsed_ms, summary, params, result_ref?, error?}], total}`; `ui/ai_hub/history_delete` `{record_id}`;
  `ui/ai_hub/history_clear` `{id?, category?}`.
- `ui/ai_hub/boot_status` -> `{records:[...]}`; `ui/ai_hub/boot_retry` `{id?}`.
- Topics: `ai_hub.boot.changed`, `ai_hub.history.changed` `{id, record_id}`.
- History store: `pyctl/ai_hub/test_history.py` over the existing sqlite/json history facilities (speech_history,
  ai_image_history, translate_history, ai_usage_log keep their own stores; the hub record links to them via result_ref).

## 4. Live monitors
- `ui/model_live/snapshot` -> `{sampled_at, system:{cpu_percent, mem_percent, mem_used_mb, mem_total_mb,
  gpus:[{index,name,util_percent,mem_used_mb,mem_total_mb,temperature_c?}]}, qwen3tts:QwenLive|null,
  kokoro:KokoroLive|null, engines:{<id>:{loaded, in_flight, queue_depth}}}`.
- Topic `model_live.changed` (payload = same snapshot, revision-stamped, <= 1 Hz, only while a sampler client or job is
  active; a sampler thread in pyctl reuses `resource_monitor`/nvidia-smi).
- `QwenLive` = flattened server `/status` normalized: `{online, model_loaded, device, dtype, model_id, attention,
  max_parallel, capacity_plan, gpu, queue:{pending, running, queue_max, stalled, oldest_running_ms,
  oldest_progress_age_ms, average_elapsed_ms}, jobs:[{job_id, status, progress, progress_total, phase,
  queue_position, elapsed_ms, text_summary, language, speaker, chunks_completed, chunks_total, progress_age_ms}],
  recent:[{job_id, ok, elapsed_ms, result_bytes, language, speaker, finished_at}], synthesized_count, failed_count}`.
- `KokoroLive` = `{loaded, running, batch:{batch_id, engine, device, batch_size, total_words, done_words,
  failed_words, current_group, total_groups, started_at, elapsed_ms, words_per_s}, recent:[{word, md5, ok, ms,
  duration_ms, rtf}], last_batch:{...}, queue:{queued, processing, model_queue_depth}, backend_progress}`; fed by a new
  progress hook in `pyutils/tts/batch/kokoro_batch.py` (group start, word done, encode done).

## 5. UI (apps/pycore-manager)
- Tabs reduce to: Models (manifest-driven per-category list, each row: boot/runtime pill, tier, Test, History, power,
  live panel for `live != null`), Providers/Keys, Studio, Tools (translate, image search, subtitle, word audio),
  History (unified over hub history + usage). One shared component set: `PcStatusPill`, `PcTierBadge`, `PcKeySlots`,
  `PcHistoryList`/`usePcHistory`, `PcTestChip` + `PcTestPopup` driven by `test_schema` (no hardcoded profiles),
  `PcLivePanel` (qwen queue/load/progress, kokoro batch/load/progress), `usePcPolling`/topic hook reuse. Hardcoded
  engine lists and duplicated pills/formatters are removed.
