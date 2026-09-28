# FIX 20260926 — pycore restart leaves :59000 refused, tray unresponsive

Date: 2026-09-26
Related: `docs_fix/FIX_20260926_AGENT_HISTORY_SCAN_CENTER_MONITOR_TRAY_NOTIFY.md`,
`docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md` (§5.4 boot chain)

## 1. Requirement (verbatim)

> 为什么pycore操作tray重启后，就无法连接 了POST http://127.0.0.1:59000/api/ui/user_data/get_video_history net::ERR_CONNECTION_REFUSED。同时tray也经常失灵。底层重构。

## 2. Evidence (py-spy stack dumps of the live worker + its own SSE log stream)

Tray "Restart" and dev hot-reload share one path: `request_restart(execute_handlers=True)` →
shutdown stack → `os.execv` (same PID). Shutdown itself takes 0.2 s. All downtime is the new
image's boot before the RPC server binds.

| # | Cause | Measured |
|---|---|---|
| R1 | `audio_queue_center.restore_from_cache` re-pushed the cached queue one task at a time (`has_dedup_key` + `push`, two cross-thread serialized round trips each, all through the single `ThreadBusStateThread` shared by ~170 threads). The word_audio snapshot holds **251,547 tasks** (76 MB) + 13,226 sentence tasks. It ran on the MAIN thread inside `register_event_handlers → register_runtime_workers` (audio-lane boot chain), before `main()` reaches "Running". | ~18 min stuck; port refused, tray handlers registered but the process busy |
| R2 | `runtime_profile.pin_runtime_profile()` ran synchronously before services: `nvidia-smi` + `torch.cuda.is_available()` (≈25 s) + `nvidia-smi` again for VRAM stats (≈8 s). | ≈33 s |
| R3 | `register_local_agent_history_routes` called `recover_nonterminal_operations()` (state-DB scan) during route registration — business logic on the server-bind path, against the callmodule layering rule. | ≈12 s+ |
| R4 | The dev reload watcher took its baseline only when it started (after the boot), so files saved during a long boot never triggered a reload — the process kept running old code. | — |

## 3. Refactor

- `AudioTaskQueue.push_many()` (`pycore/pyutils/tts/audio_task_queue.py`): one owner
  transaction with the same whole-Queue dedup as `push()` (shared `_push_owned`).
  `restore_from_cache` uses it. Bench on the real snapshot: 251,547 tasks in **2.7 s**
  (old per-task path ≈0.5 ms/push isolated, far slower under contention).
- Audio-lane boot chain runs as `AudioLaneBootChainThread` (`start_bus_task`), never on the
  main thread (`pycore/pyctl/runtime/event_handlers.py`).
- TTS runtime profile pinned by `TtsRuntimeProfilePinThread`; all readers already go through
  the locked, idempotent `pin_runtime_profile()` and wait for it (`pycore/pycore_module_caller.py`).
- Operation recovery moved from route registration to the agent-history runtime step, in the
  background (`pycore/pyctl/agent_history/heartbeat.py`); the route module only wires routes.
- `dev_reload.PROCESS_IMAGE_STARTED_NS`: files saved after the image started (during boot) drop
  out of the watcher baseline, so the first scan restarts onto the saved code.

## 4. Verification (2026-09-26, live service, measured port close → open)

- Before: ~18 min (R1), then 64–89 s after R1 was fixed (R2 + R3 + imports).
- After all fixes: **4.1 s** port close → open on a hot-reload restart (same path as tray Restart).
- Boot order (live log): RPC server 13:59:43.113 → tray 43.246 → tray handlers 43.273;
  word_audio restore (251,568) done 48.3 in the background; profile pinned 14:00:11.8 in the
  background.
- Note: `nvidia-smi` currently fails ("couldn't communicate with the NVIDIA driver"); the
  profile correctly pins `mode=cpu`, and every GPU probe blocks until the driver times out —
  the reason R2 was 30 s+. Repairing the driver is outside this change.
- `get_video_history`: HTTP 200 in 16 ms once bound.
- Boot log after the fix: RPC server + tray up within 1 s of services start; word_audio
  restore `tasks=251568` finished in the background 10 s later.
