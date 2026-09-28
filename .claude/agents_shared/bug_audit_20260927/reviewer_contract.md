# R4 Part 1 — Cross-end contract findings (reviewer)

Recorded by lead from the reviewer's report, 2026-09-27 ~02:30. 11 findings: 0 critical, 0 high, 2 medium, 9 low.

| ID | Sev | Category | Summary | Owners |
|---|---|---|---|---|
| RV-001 | medium | contract/race | Relay device-event revisions are not unique. The terminal revision restarts at 0 on pycore restart, and the agent_history revision is epoch seconds. Laravel's outbox insertOrIgnore then throws LogicException, which returns 500, and the push is lost for up to 24 h. | pycore-runtime, laravel-backend |
| RV-002 | medium | contract | The word-audio lane also pulls `article_audio`. Its page-data returns 404 because only word_audio and sentence_audio are accepted, so the RuntimeError aborts the whole diff round and the lane backs off repeatedly. | audio-tts, laravel-backend |
| RV-003 | low | contract/security | Queue Center Mercure authorization is gated by `dashboard.auth`, but the public `/overview` returns the same subscriber token. | laravel-backend, frontend-ui |
| RV-004 | low | contract/dead-code | `task_contract.stream_events` and the mcp-chrome SSE consumer are dead: there is no `/api/task/{id}/stream` route. | frontend-ui, laravel-backend |
| RV-005 | low | contract/rule | The stale v1 relay block in queue_center_contract.json duplicates pycore_relay_contract.json and contradicts it: 32 MiB vs 64 MiB, and token TTL 600 vs 300. The adapters have no callers. | laravel-backend, frontend-ui |
| RV-006 | low | contract/dead-code | `word_image.priority` has no emitter. `word_media` is not a task type, so it falls back to remote_translation and fast-lane tasks would never be claimed. | pycore-runtime |
| RV-007 | low | rule/contract | Laravel hardcodes realtime event names ('task.priority', 'cover.priority', 'poster.priority', 'queue-center') instead of reading the contract. The cover/poster payloads lack task_id, which creates synthetic heads. | laravel-backend |
| RV-008 | low | contract | The section lifecycle has no "stopping" state, so a draining lane shows "starting". | pycore-runtime, frontend-ui |
| RV-009 | low | contract | The relay route policy has no read entry for `ui/queue_center/audio_lane_state`. Read tokens get 403, and a lease expiry ends as execution_unknown. | pycore-runtime, frontend-ui |
| RV-010 | low | contract/rule | The word full-sync language fallback references a word_audio language_priority that does not exist, so it always uses english. The listing paths are hardcoded instead of coming from contract `endpoints`. | audio-tts |
| RV-011 | low | race | `queue.changed` is throttled on the leading edge only. The last change in a 1 s burst is never signaled. | laravel-backend |

## Evidence (file:line)

- RV-001:
  - pycore: pycore/pyctl/terminal/terminal_screenshot_cache.py:64,278,302-311; pycore/pyctl/relay/laravel_relay_agent_service.py:595-600, 609-620, 622-647.
  - Laravel: app/Apps/Relay/RelayServices/RelayDeviceService.php:53-99; RelayOutboxRepository.php:39-73; migration global_RelayV2_2026_08_23_000009…:38.
  - UI fallback: PcTerminalPage.tsx:720-728 (7.5 s poll). Relies on push: PcAgentHistoryPage.tsx:67, PromptDerivedHost.tsx:34.
  - Fix: a server-side monotonic revision per (pairing, event_type), or a persisted boot-epoch prefix.
- RV-002:
  - pycore/pyctl/tts/laravel_audio_worker.py:314-320; worker_base.py:411-418, 442-475, 636-648.
  - QueueCenterController.php:130-135 vs 186-192; queue_center_contract.json:795-818.
  - Fix: limit each lane to its QUEUE_KEY, or align the diff and page-data queue sets.
- RV-003: routes/api.php:392-393; QueueCenterController.php:59-66; LaravelAPI.ts:294-296; LaravelRealtime.ts:295, 325-329, 339-343; snapshot_service.py:286-300.
- RV-004: queue_center_contract.json:432-437; routes/api.php:257-268; mcp-chrome entrypoints/background/services/task-center/task-history-store.ts:8, 53-58, 124.
- RV-005: queue_center_contract.json:186-241; QueueCenterContract.ts:82-109, 221-236; QueueCenterContract.php:271-344.
- RV-006: queue_center_contract.json:39; pyctl/queue_center/snapshot_service.py:61; pyctl/translation/worker/worker.py:70; queue_center_contract.py:453-456; lane_gating.py:80-88.
- RV-007: AppQyV1TranslationRealtimeService.php:39; AppQyV1AssistController.php:294, 330; Services/Realtime/RealtimeConnectionService.php:27; pycore snapshot_service.py:58-63.
- RV-008: pycore/pyctl/queue_center/task_center_sections.py:47-56; queue_center_contract.py:29; QueueCenterContract.ts:583-585.
- RV-009: config/pycore_relay_contract.json:354-751; apps/pycore-manager/api/AudioLaneStateStore.ts:32, 110-112.
- RV-010: queue_center_contract.json:59, 844-846; word_audio_full_sync.py:28-29, 62-66; sentence_audio_full_sync.py:32.
- RV-011: app/Services/QueueCenter/QueueCenterRealtimeService.php:25-27; pycore snapshot_service.py:210-213.

## Coverage

- Checked end to end:
  - Queue Center worker endpoints and routes.
  - Realtime topic, events and outbox replay; head-event shape and dedup keys.
  - worker_pull projection and result enums; diff/page-data; full-sync listings.
  - audio_lane_state RPC/topic; set_queue_center_control; delivery_receipt; worker.presence.
  - Relay endpoints, hub authorization, topics, device-event outbox and route_policy matching.
  - cloud_clipboard_contract.
  - Section lifecycle.
- Not checked:
  - service_contract.json consumers.
  - mcp-chrome capability switches and labels.
  - Laravel payload_limits enforcement.
  - Relay blob chunk/finalize byte flows.
  - dict_lane_queue materialization, word_validity, library_cover fallback.
  - wire_shapes other than worker_pull.
  - laravel-manager Queue Center consumption.
