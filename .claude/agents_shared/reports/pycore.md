# pycore report: client key auth and audit fixes (2026-09-27)

Role: pycore. Scope: `pycore/`, `pymain.py`, `pyservice.ps1`, `pyservice.sh`, `pyapps/`.
Static checks for every task: `ast.parse` of each changed file, plus two scratchpad checks that write nothing:
- a `symtable` check for undefined globals;
- an AST check that every `from pycore... import X` resolves.

Result: 0 problems in the changed files. The repo-wide pre-existing import breaks are listed at the end and are not from this work.
K3 vectors: all 3 signatures and canonical strings reproduce (scratchpad `k3_vectors.py`). A signer → verifier round trip passes, and a replay is rejected with `client_key_nonce_replayed`.

## Tasks

| Id | Subject | Findings | Status |
|---|---|---|---|
| pycore-1 | [pycore] K3 signer, one signing gateway, CodeSync on K3 | K3, PR-014, PR-003 | approved (reviews/pycore-1.json) |
| pycore-2 | [pycore] K7/K7a local RPC gate and the open RPC surfaces | PR-001, PR-021, PR-030, PR-031, PR-037, okx reveal (FU cross-scope), AT-006, AT-029 | approved (reviews/pycore-2.json) |
| pycore-3 | [pycore] runtime, Windows and process fixes | PR-004..PR-013, PR-015..PR-020, PR-022..PR-024, PR-026, PR-027, PR-032..PR-036 | approved (reviews/pycore-3.json) |
| pycore-4 | [pycore] audio/TTS and queue fixes | AT-001..AT-050 (AT-015 withdrawn), X2, X6, X8, RV-001, RV-002, RV-006, RV-008, RV-009, RV-010 | approved, round 2 (reviews/pycore-4.json) |
| pycore-5 | [pycore] rulings: RV-007, X4, RV-004 | RV-007, X4, RV-004 | submitted, waiting for review (D10) |

## pycore-1: K3 signer (PR-014, PR-003)

- `pycore/pyutils/common/client_key_auth.py` (new) is the one K3 implementation, holding both the signer and the verifier. Every value comes from `service_contract.json#client_key_auth`, and path/query go through `relay_contract.canonical_path/canonical_query`.
  - The key comes from `secret_manager.get_secret_key("CORE_NODE_CLIENT_KEY_1")`. Verifiers accept `_1.._5`, selected by key id; a bare `CORE_NODE_CLIENT_KEY` is ignored.
  - A missing or short key fails closed. The signer returns no headers, so Laravel answers `client_key_missing`. It logs once with the secret name and the dd step, never the value.
  - The nonce ledger is a serialized owner with the contract TTL. Verification order: protocol → key → timestamp → nonce format → body digest → HMAC → nonce replay.
  - It lives in `pyutils/common` because `pyutils/laravel`, `pyutils/codesync` and `pyutils/rpc_v2` all use it (layering).
- `pycore/pyutils/laravel/identity.py`:
  - removed the per-device random secret (`laravel_device_identity.json` store), the enrollment-secret header, the v1 protocol constants and the dead `X-Core-Node-Service` constants;
  - `get_pycore_machine_id` moved to `client_key_auth` (importers `orch_delivery.py` and `delivery_diff.py` updated).
  - The old `laravel_device_identity.json` file is left on disk untouched (no destructive action).
- `pycore/pyutils/laravel/client.py` (the one pycore → Laravel gateway):
  - every request is signed;
  - `params` are encoded into the URL, and form fields into the body, with requests-compatible rules BEFORE signing, so the signed query and body digest are the exact wire bytes (PR-014);
  - multipart signs `UNSIGNED-PAYLOAD`;
  - `include_default_identity` is removed, so relay calls are signed too. This lets Laravel auto-claim `device-enrollments` per the route table.
- `pycore/pyutils/laravel/endpoint_manager.py`: the health probe signs the real URL (it signed `/` before).
- Bypass sweep: every other pycore Laravel call goes through `laravel_client`. The AI and external-API `requests` calls go to third parties. The Mercure subscribe uses its JWT. `orch_words.py` / `orch_service.py` send the user's own Sanctum token for per-user word-group reads (end-user routes, unchanged by §5) and are signed as well.
- The Laravel response `X-Core-Node-Protocol` header is not checked anywhere in pycore, so protocol "2" is accepted as is.
- PR-003, CodeSync:
  - `workspace_auth.py` (the committed bearer secret) and `common/http_auth.py` (no other user) are deleted;
  - the workspace service takes a K3 result (`service.py`);
  - `rpc_v2/http/client_key_request.py` (new) verifies once per request and caches the result on the ASGI scope, so the K7 gate and the route never consume one nonce twice;
  - wired into `callmodule/rpc_routes/code_sync_routes.py` and the standalone `codesync/http_server.py`.
- CodeSync outbound peer calls are signed, because a LAN peer's K7 gate needs K3:
  - `codesync/runtime.py` has `signed_peer_request` / `signed_peer_headers`, where the JSON body is encoded once and signed;
  - used in `peer_mesh.py`, `server_connection.py`, `client.py`, `manager.py` and `http_client.py` (the SSE connect and the frame POST);
  - `rpc_v2/discovery.py` also signs.

## pycore-2: K7 / K7a (PR-001, PR-021, PR-030, PR-031, PR-037)

- `pycore/pyutils/common/local_rpc_guard.py` (new) is the one K7 rule set, driven by `client_key_auth.local_rpc`:
  - Bind is loopback unless the LAN bind setting is on. The setting is `system_settings.rpcLanBind=true`, set with `pyservice config system set --key rpcLanBind --value true`. A requested `0.0.0.0` is otherwise downgraded to `127.0.0.1` with a log line.
  - A loopback caller needs a loopback `Host` (DNS rebinding) and, when it sends `Origin`, an allowed origin. Allowed origins are the contract loopback host keys × `nexus_dash_frontend` and `pycore_backend` ports (plus `PYCORE_UI_PORT` exported by pyservice). A non-loopback caller needs K3.
- `pycore/pyutils/rpc_v2/http/local_rpc_middleware.py` (new) is the outermost ASGI gate in `HttpServer`. It buffers the body for K3 and replays it.
  - Rejections are 401/403 with the error code: contract `client_key_*`, `local_rpc_host_forbidden` or `local_rpc_origin_forbidden`.
- `pycore/pyutils/rpc_v2/server.py`:
  - CORS uses the contract origins with `allow_credentials=False` (no `*`);
  - `access-control-allow-private-network` is sent only to allowed origins;
  - `host` goes through `resolve_bind_host`.
  - Relay operations run in-process (`rpc_execution_kernel.execute_relay`), so relay paths are unchanged.
- Defaults:
  - `network_constants.HTTP_BIND_HOST` is loopback (`HTTP_LAN_BIND_HOST` = any);
  - `pythreadpool/starters.py` logs the resolved host;
  - `pyservice.ps1` `-BindHost` defaults to 127.0.0.1.
  - Linux `scripts/shells/linux/common/pyservice_entry.sh` still passes `--host 0.0.0.0`. pycore downgrades it without the setting; shell was asked to change the default (shell scope).
- The standalone CodeSync server (`codesync/http_server.py`) runs the same gate on every GET/POST/PUT and uses the same bind resolution.
- `pyctl/runtime/user_data_service.py`:
  - `rpcLanBind` must be a boolean;
  - a UI save that omits it keeps the stored value.
- PR-021: `thread_bus/trigger_event` admits only `voice_subtitle.subtitle_mode_enter/exit` (new `BusSignals.VOICE_SUBTITLE_MODE_ENTER/EXIT`, also used by the PySide6 bridge), with no payload. No UI source calls this route (grep).
- PR-030: `ui/video_extract/open` hands only media and subtitle files (video, audio codec and subtitle extensions) to the OS handler; directories are still opened. Not applied: an output-root allowlist, because source videos are user-picked paths anywhere. K7 gates the caller.
- PR-031:
  - (a) books: K7 gates it; extraction is limited to `BOOK_EXTENSIONS` (secret files have no extension). A root allowlist is not applied, because the feature scans user-chosen folders.
  - (b) ai_keys and (c) autostart: K7.
  - (d) `set_system_settings` type-checks the keys pycore acts on (`system_settings_invalid`).
  - (e) client base URLs must be in the Laravel endpoint catalog (`endpoint_manager.is_catalog_endpoint`; error `LARAVEL_ENDPOINT_UNKNOWN`) for `audio_orch/auth/login`, `audio_lane_full_sync` and `queue_center/accept_task`. This also stops pycore from signing requests for arbitrary hosts.
  - (f) code_sync add_peer/set_role: K7.
- PR-037: clipboard text is never logged. Only lengths are logged, in `clipboard_monitor.py`, `clipboard_sync.py` and `background_services.py`.
- okx `reveal_credentials`: **refuted / already gone.**
  - No such route exists in `pycore/` or `pyapps/` (grep: no handler, no route name).
  - `apps/vortex/api/VortexPycoreContract.ts` has no reveal route, and the UI shows `api_key_masked` only (vortex-4).
  - The `okx/*` routes the Vortex UI calls are not registered in this checkout at all.
  - `pyapps/okx_price_monitor` uses the shared `HttpServer`, so K7 applies to it too.
- AT-006 / AT-029, TTS servers:
  - chattts and f5tts get `*_HOST`/`*_PORT` from the launcher (loopback default), like melotts/voxcpm2/fishspeech;
  - the server defaults of chattts, f5tts, fishspeech and qwen3tts are 127.0.0.1;
  - f5tts keeps only a sanitized suffix of the client file name (fixed stem `ref`).
  - Residual: CosyVoice's upstream `runtime/python/fastapi/server.py` hardcodes 0.0.0.0 and has no host flag. It is not changed (upstream clone). GPT-SoVITS `api_v2.py` already defaults to 127.0.0.1.

## pycore-3: runtime, Windows and process fixes (submitted)

- PR-004 / PR-007, `pyfoundations/pybasecommon/commander.py`:
  - list commands run without a shell (argv), while string commands keep the shell;
  - silent mode uses `communicate(timeout)` (return code 124 on timeout) and drains both pipes;
  - realtime mode merges stderr into the streamed stdout (no pipe deadlock);
  - `run_background` is fixed the same way.
- PR-005 (`pyctl/terminal/terminal_service.py`): activate/click/navigate_history/scroll/input_text/press_enter run on one `TerminalInputThread` serialized owner, which the RPC routes and the scheduler share.
- PR-018 (same file): a non-text clipboard (`get_text() is None`) is not overwritten with "".
- PR-008 (`pyctl/terminal/terminal_scheduler.py`): a dispatch exception completes as `terminal_dispatch_failed`, and the thread survives.
- PR-006 / PR-017 (`pyutils/common/clipboard_text.py`):
  - private `WinDLL` handles with 64-bit prototypes, and `EmptyClipboard` is checked;
  - the PowerShell fallbacks force UTF-8 in/out.
- PR-009 (`pyutils/laravel/worker_result_delivery.py`): the offline window skips only progress pings. Terminal results run their retry budget and defer.
- PR-010 (`pyutils/laravel/endpoint_manager.py`):
  - a selection generation guards `_resolved` (`invalidate()` bumps it);
  - `_finish_select` adopts only its own generation;
  - `forget_resolved` runs on the offline edge of the cached winner.
- PR-011 (`pyutils/common/x11_display.py`): one attempt with no cookie (`XAUTHORITY=os.devnull`) after the cookie candidates; the original XAUTHORITY is restored on failure and for the no-cookie connection.
- PR-012 (`pyservice.ps1`): the UI server is kept when the worker exits 3 (restart handoff or yield), besides the existing listener check.
- PR-013 (`pyctl/agent_history/pipeline/{config,planner,worker}.py`): the planner and worker save only `CURSOR_STATE_KEYS` (`save_cursor_state`).
- PR-015 (`pyutils/common/{xdg_desktop_portal,session_dbus}.py`):
  - transport errors return `session_bus_unavailable`, and the portal drops and reopens its connection;
  - every request removes its match rule (`remove_match`).
- PR-016 (`pyfoundations/desktop_session.py`): cookie files that vanished are skipped.
- PR-019 (`pymain.py`): exit 1 on an exception or when `start()` returns False.
- PR-020 (`pyutils/codesync/runtime.py`):
  - the shared `start_bus_task` is used, with per-thread HTTP cleanup;
  - the shared `get_machine_id` / `get_hardware_machine_id` are used;
  - the stdlib replicas and the bus-task copies are removed.
- PR-022 (`pyfoundations/file_lock.py`):
  - one OS-locked file per target (`fcntl.flock` / `msvcrt.locking`), with a per-call descriptor, so it excludes both processes and threads;
  - the kernel drops the lock when its holder dies;
  - `get_lock_status` reports `locked`.
- PR-023 (`pyfoundations/pg_sync_adapter.py`): the restore fails on rc≠0 or on any psql `ERROR:` line. The one expected `role ... already exists` is exempt.
- PR-024 (`pyutils/launcher/linux_terminal_launcher.py`): the grid rc is written to `<TMP_DIR>/pylauncher-<uid>/grid.rc` (dir 0700, file 0600, O_NOFOLLOW, ownership and mode verified).
  - **Deferred:** `user_data.json` 0666 (`user_data_store.py`) and the prompt archive 0666. These files are shared on purpose between the root service and the desktop user. Tightening them needs a group-based design (installer/shell) and would break the non-root writer today.
- PR-026: the hot-reload baseline keeps future-mtime files (`dev_reload.py`). CodeSync clamps the received mtime to now (`push_receiver.py` ×2, `client.py`).
- PR-027 (`pyctl/agent_history/root_spool.py`): only root-owned sources are spooled.
  - **Deferred:** a spool group that holds only the worker user; the spool still uses the worker's primary group.
- PR-032 (`pyfoundations/pygvar.py`): falls back to `<system temp>/core_node_tmp` when the preferred root cannot be created. `tts_install_assets/tts_server_common.py` takes the `CORE_NODE_TMP_DIR` pycore exports.
- PR-033 (`pyutils/agent_history/article_records.py`): a unique temp name per write. Index read-modify-writes (`load_index`, `save_record`, `_commit_record`) run on the index file's serialized owner.
- PR-034, pycore half (`pylauncher/platform/system_service_manager.py`): when running inside `pycore.service`, the uninstall runs via `systemd-run --scope --quiet`. The script order is shell's (sent).
- PR-035 (`pyutils/window/windows_terminal_backend.py`, `ops.py`):
  - Windows Terminal pastes with Ctrl+Shift+V;
  - a classic console pastes through its own Paste command (`WM_COMMAND 0xFFF1`), with no right-click.
- PR-036:
  - `pyutils/common/http_client.redacted_http_error` returns the class name and the host only;
  - used for Forvo, TMDB, OMDB and SerpApi failures (`word_audio_client.py`, `movie_poster_client.py`, `image_search_client.py`), including the SerpApi `error` field.
- PR-025: ncore's (= NC-010), not touched. PR-028 and PR-029 do not exist (numbering gap in the evidence report).

## pycore-4: audio/TTS and queue fixes (D10, r1 fixes submitted)

The D1 pycore teammate left most pycore-4 edits on disk. The D10 session checked every hunk against the finding texts (read-only git with `--ignore-space-at-eol`), then finished the remaining ids: AT-016, AT-025, the AT-037 remainder, AT-050 and the X6 line endings. AT-049, RV-009 and the RV-010 path rule are deferred, each with a D7 item.

### Review round 1 (r1)

Blocking, both fixed:
1. AT-034 path traversal (`pycore/pyctl/tts/qwen/operation_service.py`):
   - The retained file is named from server-side ids only: `<op id>_<item id>.<fmt>`. Both ids are `uuid4` hex made by `operation_service` (`op_…`, `item_…`). `item_key` is no longer part of the path.
   - The format is allow-listed by `normalize_audio_format` (`AUDIO_FORMATS = ("wav", "mp3")`, default wav).
     - At the RPC entry, `ui_service.synthesis_submit` rejects any other value with `unsupported_format` before an operation is created.
     - `_run` checks again, for any other caller of `submit`, and fails the item with the same error.
   - `_retained_audio_path` resolves the path and refuses it unless its parent is the resolved `<app cache>/qwen_operations` directory.
   - A refused or failed write fails the item and the operation with `audio_store_failed`. Before, an exception left the item `running`.
   - The three failure paths share `_fail`, and the error shape comes from `unsupported_format_error()`, so the message text is defined once.
2. `NVIDIA_SMI_TIMEOUT_SECONDS` is defined once, in `pycore/pyfoundations/network_constants.py` (value 10, in `__all__`).
   - `memory_gate` imports it.
   - `chattts_api_server` and `qwen3tts_gpu` read it through their loaded `network_constants` with `getattr(..., 10)`, the same pattern as `CHATTTS_MIN_FREE_VRAM_MB`. `qwen3tts_gpu` now loads it through `tts_server_common.load_network_constants()`, as `qwen3tts_synthesis` already does. `load_source_module` returns the cached module, so it is loaded only once.
   - The other two nvidia-smi calls in pycore had no timeout at all. They now use the same constant: `compute_caps.CUDADetector._check_nvidia_smi` and `video_extract_service` GPU stats.

Non-blocking notes:
- AT-025, fixed: the qwen3tts code identity also lists `pyfoundations/service_contract.py`, which `network_constants` imports at start.
- X6, fixed: the start bound is `max(SERIALIZED_START_TIMEOUT_SECONDS, timeout)`, so an owner busy with an earlier call of the same length (the kokoro 900 s call) is waited out. A call with no timeout still waits unbounded, as before.
- AT-008, fixed: `request_cancel` now also calls `orch_sources.wake_sentence_waiters(task)`. For a book task this notifies `BackgroundJobs.job_signal(source_key)`, so `ensure_book_sentences` sees the cancel at once instead of after the current page request. The shared sync job keeps filling the book cache.
- AT-014, fixed: `delete_task_files` catches `OSError` and logs it. The record is already deleted, so the delete still returns and publishes `TASK_STATUS_DELETED`.
- AT-031, fixed: VoxCPM2 applies the requested speed as ffmpeg `atempo` in the mp3 conversion (`wav_to_mp3(..., tempo=speed)`), as cosyvoice does. A `.wav` target has no conversion step and keeps the model's pace.
- `orch_generate` stage forwarding, fixed: `_resource_activity` accepts only known orchestration codes (`orch_messages.is_message_code`, the keys of `_LOG_TEMPLATES`). Any other stage becomes `orch_resource_preparing` with no params. No producer sends a non-orchestration stage today: `resolve_sentence_audio` is called without a progress callback. This is a guard.
- chattts, gptsovits and parler batch `serial_fallback`: not changed. The reviewer agrees they serve only the startup self-check and are outside AT-007.

r1 changed files:
- `pycore/pyctl/tts/qwen/operation_service.py`, `pycore/pyctl/tts/qwen/ui_service.py`;
- `pycore/pyfoundations/network_constants.py`, `pycore/pyfoundations/pybasecommon/compute_caps.py`, `pycore/pyfoundations/serialized_worker.py`;
- `pycore/pyutils/tts/memory_gate.py`, `pycore/pyutils/tts/tts_service_manager.py`, `pycore/pyutils/tts/voxcpm2_engine.py`;
- `pycore/tts_install_assets/qwen3tts_gpu.py`, `pycore/tts_install_assets/chattts_api_server.py`;
- `pycore/pyctl/audio_orchestration/`: `orch_books.py`, `orch_sources.py`, `orch_generate.py`, `orch_store.py`, `orch_messages.py`;
- `pycore/pyctl/desktop/video_extract_service.py`.

r1 checks (static only, nothing started):
- `ast.parse`, the `symtable` undefined-global scan and `from pycore... import X` resolution over the 16 files above: 0 problems. A negative probe confirms the checker flags both an undefined name and a missing import.
- The path guard and the allow-list were run in scratch with the same logic:
  - `../x`, `wav/../../y` and `ogg` are rejected;
  - `MP3` becomes `mp3`, and an empty value becomes `wav`;
  - an id containing a separator that leaves the directory is refused.
- Line endings:
  - `git diff --numstat` is identical with and without `--ignore-space-at-eol` for every pycore file, except the known `commander.py` (pycore-3, trailing spaces).
  - A difflib scan of the 16 files finds 0 unchanged lines with a flipped line ending.
  - Uniform CRLF files stay CRLF and uniform LF files stay LF. New lines in the mixed files (`operation_service`, `qwen3tts_gpu`, `serialized_worker`) take the ending of the lines they replace. The new file `orch_messages.py` stays LF.

Review base (important). During this round, commit `f4f2234` ("CodeHeaderCleanerBak", author "DevOps User", 2026-09-27 15:57 +1000) captured the whole working tree, including every pycore-4 and r1 edit. pycore made no commit and ran only read-only git. So `git diff` against HEAD is now empty for pycore. Review against the parent instead: `git diff 74e7770 -- pycore` (161 pycore files). The line-ending gate and the difflib scan above were re-run against `74e7770`, with the same result.

r1 decisions (B9):
- An unknown `format` is rejected (`unsupported_format`), not mapped to mp3 as the qwen server does. A clear error beats a silent mp3 under a `.wav` or other name, and it follows the reviewer's allow-list.
- The two extra nvidia-smi timeouts (`compute_caps`, `video_extract_service`) go beyond AT-036's listed sites. They are the same hang class, and they make the new constant the single bound for every nvidia-smi call in pycore.

### Per finding

| Id | Status | Where / how |
|---|---|---|
| AT-001 | fixed | `word_audio_cache`: the file name is `{word}@{provider}.mp3`, with the word lower-cased. `_safe` can never produce `@`, so a lookup matches the exact word only. Legacy `{word}_{provider}` names are renamed once at boot (`migrate_legacy_names`, taken from the ledger or from an unambiguous name). The `audio_resource_delivery` bootstrap parses both forms. |
| AT-002 | fixed | `kokoro_batch.synthesize_words_to_cache` checks `tts_engine_supports_language(WORD_BATCH_ENGINE, lang)`. An unsupported language fails every word with `word_batch_language_unsupported`, so no English-G2P audio is produced. |
| AT-003 | fixed | An immediate lane stop is a state flag. The audio lanes no longer override `_drop_queued_tasks` (the `worker_base` default returns []), so the Queue and its snapshot stay intact. Queued rows hold no Laravel claim (JIT claim at task start). `request_start` resumes the drain. |
| AT-004 | fixed | `orch_resources._word_batch` settles its claimed keys in `finally` (`word_batch_crashed`). The `_run_generation` crash path calls `release_owner_queue`. |
| AT-005 | fixed | `QWEN3TTS_VRAM_RECLAIM` defaults to 0 (opt-in). When enabled, only GPU processes descended from pycore are stopped. |
| AT-006 | already_fixed | pycore-2 (approved). |
| AT-007 | fixed | The per-word serial fallback is removed. A failed group reports `kokoro_batch_group_failed` per word. |
| AT-008 | fixed | `_await_lane_settled` waits on the owner's wake signal (`audio_queue_center.owner_signal`). The signal is set on settle, release, prune and cancel (`wake_owner`). The 900 s deadline is only an upper bound. `ensure_book_sentences` waits on `BackgroundJobs.job_signal`, which is notified per page and on finish or cancel. Neither wait polls on a timer. r1: `request_cancel` also wakes the book-sentence wait (`orch_sources.wake_sentence_waiters`), so a cancel is seen without waiting for the current page. |
| AT-009 | fixed | See AT-001: every name is lower-cased. |
| AT-010 | fixed | The qwen3tts server queue holds 16 active jobs in FIFO order (`QWEN3TTS_QUEUE_MAX` overrides it). A client blocked on capacity waits on the queue event long-poll (`/queue/events/poll`) instead of polling `/status`. The backoff sleep is used only when the event stream fails. |
| AT-011 | fixed | `_recover_task_status` re-reads the stored task. Only a stored copy that is still `generating` becomes `failed`; the caller's stale copy is refreshed and never saved over the final record. |
| AT-012 | fixed | The output signature includes `task_sentences_version`, which is the book-sentence cache version, or '' while a sync runs. The cached `meta_hash` is therefore recomputed when sentence availability changes. |
| AT-013 | fixed | Each segment's sha256 is streamed in 1 MiB chunks, and the upload reads one segment at a time. |
| AT-014 | fixed | `task_delete` removes the manifest and `output/<slug>` (`orch_store.delete_task_files`, with the path checked to stay under the output root). A pending output delivery for a deleted task completes as superseded. r1: a removal error is logged, not raised, so the delete still publishes. |
| AT-015 | withdrawn | Withdrawn in the audit. |
| AT-016 | fixed (D10) | Engine-test extras are request-scoped (a ContextVar behind `engine_policy.engine_setting`), and `os.environ` is never written. qwen3tts speaker and instruct travel in `TTSSynthesisRequest`. parler reads its override on the model owner (`SerializedModelEngine.synthesize` runs the call through `copy_context().run`). voxcpm2 sends `cfg_value` and `inference_timesteps` per request. chattts, cosyvoice and gptsovits (engine and batch) read `engine_setting`. |
| AT-017 | fixed | `tts_test` uses `engine_unavailable_reason`. |
| AT-018 | fixed | CJK runs are never tokenized locally (`orch_words.has_cjk`). A CJK sentence gets its words from the Laravel sentence-words resolver. |
| AT-019 | fixed | The accept capacity is the in-flight `_processing` count, not the queued backlog. The pull capacity still counts the Queue on purpose (JIT claims). |
| AT-020 | fixed | The heartbeat is armed only while a lane reports active work. An idle publisher waits with no timeout. |
| AT-021 | fixed | The drain guard is a `SerializedValue.compare_and_set`. |
| AT-022 | fixed | A `started` flag means `_mark_task_finished` runs only for tasks that were marked started. |
| AT-023 | fixed | Orchestration looks up, stores and synthesizes with `sentence_tts_cache_identity(..., sentence_lane_speaker())`. The lane uses the same persisted speaker (`SENTENCE_LANE_SPEAKER_KEY`). |
| AT-024 | fixed | The abbreviation and initial shields match anywhere (`(?=\s|$)`). A scratch split keeps "Dr. Smith" and "J. Doe" in one chunk. |
| AT-025 | fixed (D10 completed) | The qwen3tts code identity lists every module the server imports or loads by path at start: `tts_text_chunking`, `tts_audio_assembly`, `network_constants`, `service_contract` (r1), `http_sse` and `rpc_v2/http/event_service`. The web assets are read per request, so they are not listed. |
| AT-026 | fixed | `prune_absent` returns the pruned Part1 keys. The library settles them (`pruned_absent_from_laravel_pending`) and wakes their owners. |
| AT-027 | fixed | A failed listing returns `laravel_failure(status_code=...)`, and the full pull stops. |
| AT-028 | fixed | Index alignment is kept; an empty word fails with `word_batch_empty_word`. |
| AT-029 | already_fixed | pycore-2 (approved). |
| AT-030 | fixed | The f5tts `/process` handler is a sync `def` (threadpool). Its temp dir is removed by a background task after the response. |
| AT-031 | fixed | VoxCPM2 has no speed or language control, so neither field is sent or declared in `SynthRequest` any more. This is the finding's "drop the field" option. r1: the requested speed is applied as ffmpeg `atempo` in the mp3 conversion. |
| AT-032 | fixed | `_stop_foreign_server` stops a listener only when its cmdline or cwd is a pycore launch of that engine. Any other listener is left running. |
| AT-033 | fixed | Only the exact `_LEGACY_SAVED_ORDERS` tuples migrate. This is idempotent: a migrated order is no longer a legacy tuple, so no marker is needed. |
| AT-034 | fixed (r1) | Re-submitting a terminal or running operation does not re-run it. The audio is kept at `<app cache>/qwen_operations/<op id>_<item id>.<fmt>`, and `audio_path` is in the result. r1: the name uses only server-side ids, the format is allow-listed (wav/mp3, `unsupported_format`), and the resolved parent must be the `qwen_operations` directory. A write failure fails the item (`audio_store_failed`). |
| AT-035 | fixed | Only the cache read and write run on the edge owner. The probe runs on the caller, bounded by `asyncio.wait_for(get_synth_timeout())`. |
| AT-036 | fixed (r1) | nvidia-smi gets a 10 s timeout in `qwen3tts_gpu`, the chattts server and `memory_gate`. r1: the value is defined once as `network_constants.NVIDIA_SMI_TIMEOUT_SECONDS`. `memory_gate` imports it; the servers read it from their loaded `network_constants`. `compute_caps` and `video_extract_service` also use it. |
| AT-037 | fixed (D10 completed) | Deleted: `edge/{parser,processor,thread_manager,translator,worker_thread}.py`, `tts/worker_base.py` and `tts_queue_worker_threads.py`. Removed: `edge_synth`, `fetch_youdao`, `missing_batch`, `fix_word_text` and their routes, plus (D10) the dead route-name constants `UI_WORD_AUDIO_WORD_AUDIO_MEDIA` and `UI_WORD_AUDIO_UPLOAD_WORD_AUDIO`. `upload_word_audio` is now called only inside the delivery kind. |
| AT-038 | fixed | qwen chunks through `tts_text_chunking.split_text` and assembles with `tts_audio_assembly.concatenate_wavs`. The pycore sample path (`chunked_synthesis`) uses the same assembly module. |
| AT-039 | fixed (pycore half) | `orch_messages`: progress carries `message_code` and `message_params`, and each event carries `code` and `params`. `message` stays as the English fallback. No raw exception text is sent, only the exception type. The wrong "all segments failed" is now "{failed} of {segments} segments failed". r1: a resource activity stage that is not an orchestration code is sent as `orch_resource_preparing`, never as a `message_code`. The UI half is cross-scope (below). |
| AT-040 | fixed | `batch_startup_selfcheck`: a `SerializedValue` guard, and the dead thread starter is removed. `edge/recovery`: an `EdgeRecoveryProbeThread` subclass whose THREAD_BUS wait is bounded by the cooldown. `runtime_profile`: `SerializedSingletonProvider`. |
| AT-041 | fixed | The loaded flags are `SerializedValue`s (kokoro, sherpa, `SerializedModelEngine`), so a status read never enters the model queue. |
| AT-042 | fixed | The qwen `disabled_reason` / `config_ready` include `qwen_weights.local_model_ready()`: the offline resolution, cached by install signature. |
| AT-043 | fixed | `extra_params["speed"]` becomes `TTSSynthesisRequest.speed`. |
| AT-044 | fixed | The chattts server honours `response_format=wav` and uses one deterministic speaker per voice name. |
| AT-045 | fixed | `release_gpu_memory()` (gc, plus `torch.cuda.empty_cache` when torch is loaded) runs on unload. |
| AT-046 | fixed | Bark picks the voice preset per language and chunks through the shared chunker (bark policy 100/140 chars). Bark is marked chunk-capable. |
| AT-047 | fixed | The sample rate comes from the model family (300M: 22050; 2/3: 24000). An unknown family needs `COSYVOICE_SAMPLE_RATE`; until it is set the engine is disabled with a coded reason. Speed is applied once, as ffmpeg `atempo` in the mp3 conversion. |
| AT-048 | fixed | The console subscribes to the `/queue/events` SSE stream (no timer). It lists and cancels only its own `console-` jobs. |
| AT-049 | deferred | The "dead" part is refuted: `scripts/pytools/aitools/qwen3tts_tester.py:145-149,219,245-246` imports `get_tts_engine_params` (shell scope), so the module cannot be deleted. Its drifted notes are corrected. Reason for deferral: a single schema needs the pycore-manager `PcTestEngineProfiles.ts` (429 lines) to fetch it, with labels as i18n keys. That is a UI change outside D1. A pycore route alone would be dead code. D7 item: one engine-test schema (pycore + pycore-manager). |
| AT-050 | fixed (pycore half, D10) | Availability reasons are `CodedMessage`s (`tts_reason_codes.py`, 17 codes), from `tts_engine_probe` and the qwen, cosyvoice, f5tts, fishspeech, melotts, streamelements and voxcpm2 engines. Status rows carry `disabled_reason_code` and `disabled_reason_params` (also passed through `capability_service`), and `tts_test` returns `error_code` and `error_params`. The contradictory "Python 3.10 is ready" hint and the unreachable duplicate `return` are gone. English text from other modules (the runtime_policy base reason, the memory gate) is passed as the `detail` param. The UI half is cross-scope. |
| X2 | fixed | `serialized_files` uses a fixed pool of 8 owners (crc32 of the path), so per-path order is kept. Same-owner nesting runs inline. No serialized-file callback nests another path, so the pool adds no lock cycle. |
| X6 | fixed | The `call_serialized` timeout starts when the owner begins the call (the `.started` signal, published with `signal_if_present(consume=False)`, the 09:41 deadlock fix). The queue wait is bounded separately, by `max(600 s, call timeout)` (r1). D10 restored the per-line endings of `serialized_worker.py` (48 LF lines had become CRLF). |
| X8 | fixed | The retained copy is written atomically (temp file plus `os.replace`), and a torn copy is replaced. New bytes for an unleased delivery restart it; a leased one keeps its bytes. Retained copies are deleted once no row references them (`payload_referenced`). |
| RV-001 | fixed (pycore half) | The device event revision is unique and increases across restarts (µs wall clock, bumped past the last issued value, on the serialized owner). The Laravel side is laravel-T4 (server-assigned outbox revision). |
| RV-002 | fixed (pycore half) | A page-data rejection skips only that queue: its cursor stays, the other queues sync, and the log is de-duplicated. Laravel's page-data accepts `article_audio` (laravel-T4). |
| RV-006 | fixed | The `word_image.priority` → `word_media` mapping is dropped. The fast lane advertises the contract `remote_fast` type, which Laravel's fast lane serves. The contract event stays because mcp-chrome's `QueueCenterWakeService.ts` reads it. |
| RV-008 | fixed (pycore half) | A lane switched off while still running reports `stopping` (`QueueCenterSectionLifecycle` gains `stopping`). The UI half is cross-scope. |
| RV-009 | deferred | Reason: the fix is one entry in `config/pycore_relay_contract.json#route_policies`, a cross-end contract that only the orchestrator changes. pycore reads the policies from that file only and has no local list. D7 item: the orchestrator adds `{match: exact, value: ui/queue_center/audio_lane_state, profile: general_read, methods: [POST]}` (same shape as `ui/queue_center/event_page`). |
| RV-010 | deferred (functional half fixed) | Fixed: the fallback to a non-existent `language_priority` is gone, and a failed breakdown fails the pull. Deferred: the rule half. The three listing paths are module constants because `queue_center_contract.json#endpoints` has no roles for them, and adding roles is the orchestrator's change. D7 item: the orchestrator adds `audio_word_listing` (`/api/app_qy_v1/dictionary/words`), `audio_word_language_breakdown` (`/api/app_qy_v1/vocabulary/language-breakdown`) and `audio_sentence_without_audio` (`/api/app_qy_v1/ai_tools/tts/sentence/without_audio`). pycore then switches `word_audio_full_sync.py` and `sentence_audio_full_sync.py` to `queue_center_endpoint(...)`. |

Also on disk:
- The ruling items RV-004, RV-007 and X4 are tracked and reported as pycore-5 (section below).
- Pre-existing defect fixed: `managed_service.py` used `_HEALTH_FAILURE_THRESHOLD` without importing it (a NameError on the managed health path).

### Changed files (pycore-4)

D10 session:
- `pycore/pyutils/tts/`:
  - `engine_policy.py`;
  - `serialized_model_engine.py`;
  - the engines `parler_engine.py`, `chattts_engine.py`, `cosyvoice_engine.py`, `gptsovits_engine.py`, `batch/gptsovits_batch.py`, `voxcpm2_engine.py`, `qwen/engine.py`, `f5tts_engine.py`, `fishspeech_engine.py`, `melotts_engine.py` and `streamelements_engine.py`;
  - `tts_service_manager.py`, `tts_engine_probe.py`, `engine_registry.py`, `tts_status.py` and `tts_orchestrator.py`;
  - `tts_reason_codes.py` (new).
- `pycore/pyutils/common/coded_message.py` (new; `orch_messages.render` now uses it).
- `pycore/pyctl/audio_orchestration/orch_messages.py`.
- `pycore/pyctl/desktop/capability_service.py`.
- `pycore/callmodule/rpc_routes/route_names.py`.
- `pycore/pyfoundations/serialized_worker.py` (line endings only).

Earlier pycore teammate (verified in D10):
- `pycore/callmodule/rpc_routes/`: `local_word_audio_routes.py`, `tts_routes.py`, `local_queue_accept_routes.py`.
- `pycore/database/repositories/laravel_delivery_repository.py`.
- `pycore/pyctl/audio_orchestration/`: `orch_books.py`, `orch_delivery.py`, `orch_generate.py`, `orch_messages.py` (new), `orch_resources.py`, `orch_service.py`, `orch_sources.py`, `orch_store.py`, `orch_words.py`.
- `pycore/pyctl/laravel/worker_base.py`.
- `pycore/pyctl/queue_center/`: `audio_lane_state.py`, `snapshot_service.py`, `task_center_sections.py`.
- `pycore/pyctl/relay/laravel_relay_agent_service.py`.
- `pycore/pyctl/translation/worker/worker.py`.
- `pycore/pyctl/tts/`: `audio_lane_full_sync.py`, `audio_resource_delivery.py`, `batch_startup_selfcheck.py`, `laravel_audio_delivery.py`, `laravel_audio_worker.py`, `laravel_audio_worker_execution.py`, `laravel_audio_worker_state.py`, `qwen/operation_service.py`, `sentence_audio_auto.py`, `sentence_audio_full_sync.py`, `word_audio_full_sync.py`, `word_audio_service.py`.
- `pycore/pyfoundations/`: `serialized_worker.py`, `thread_bus/bus.py`.
- `pycore/pyutils/common/`: `background_jobs.py`, `ffmpeg/ffmpeg_command.py`, `managed_service.py`, `managed_service_process.py`, `queue_center_contract.py`, `serialized_files.py`.
- `pycore/pyutils/laravel/delivery_outbox.py`.
- `pycore/pyutils/tts/`:
  - `audio_queue_center.py`, `audio_resource_ledger.py`, `audio_task_queue.py`, `audio_utils.py`;
  - `bark_engine.py`, `batch/kokoro_batch.py`, `chunked_synthesis.py`, `cosyvoice_engine.py`, `kokoro_engine.py`, `sherpa_engine.py`, `voxcpm2_engine.py`;
  - `edge/client.py`, `edge/recovery.py`;
  - `engine_policy.py`, `memory_gate.py`, `runtime_profile.py`, `serialized_model_engine.py`;
  - `qwen/client.py`, `qwen/engine.py`, `qwen/weights.py`;
  - `tts_engine_params.py`, `tts_engine_probe.py`, `tts_orchestrator.py`, `tts_service_manager.py`, `tts_status.py`, `word_audio_cache.py`;
  - deleted: `edge/{parser,processor,thread_manager,translator,worker_thread}.py`, `worker_base.py`, `tts_queue_worker_threads.py`.
- `pycore/tts_install_assets/`: `chattts_api_server.py`, `f5tts_api_server.py`, `qwen3tts_gpu.py`, `qwen3tts_queue.py`, `qwen3tts_synthesis.py`, `qwen3tts_web_assets/app.js`, `tts_text_chunking.py`, `voxcpm2_api_server.py`.

### Checks (static only; nothing was started)

- `ast.parse`, an undefined-global scan (`symtable`) and a `from pycore... import X` resolution check over all 150 changed pycore files: 0 problems. Over the whole of `pycore/` and `pyapps/` (1513 files), only the pre-existing breaks listed at the end remain.
- Module-level import-cycle scan of the changed modules: no new cycle. The only cycles are the pre-existing package-init pairs `pyctl.relay` and `thread_bus`. `engine_policy`'s import closure (59 modules) reaches no engine module, so the new engine → `engine_policy` / `tts_reason_codes` edges cannot cycle.
- Line endings: `git diff --numstat` is identical with and without `--ignore-space-at-eol` for every pycore file except `commander.py` (pycore-3). Its 2 lines differ by trailing spaces only, not CR.
- Scratch-only pure-function checks (no service, no test file):
  - `tts_text_chunking` keeps "Dr. Smith" and "J. Doe" in one chunk.
  - `CodedMessage` survives `copy.deepcopy` and pickle with its code and params, and serializes to JSON as its text.
  - `message_fields` yields `x`, `x_code` and `x_params`.

### Cross-scope (for the orchestrator)

- pycore-manager (UI localization of the new codes):
  - AT-039: `OrchTaskList.tsx` (about lines 107 and 277) should render `progress.message_code/message_params` and `events[].code/params` (the codes are in `pycore/pyctl/audio_orchestration/orch_messages.py`), falling back to `message`.
  - AT-050: `PcPipelineStatusPanels.tsx:302` and `PcTtsServerControls.tsx:136` should localize `disabled_reason_code/disabled_reason_params`, and the TTS test popup should localize `error_code/error_params`. The codes are in `pycore/pyutils/tts/tts_reason_codes.py`. The fallback is `disabled_reason` / `error`.
  - AT-034 (r1): two new qwen synthesis error codes, both with an English `message` fallback. `ui/qwen/synthesis/submit` can return `error.code = unsupported_format` (allowed: wav, mp3). A qwen operation item can fail with `audio_store_failed`. The constants are in `pycore/pyctl/tts/qwen/operation_service.py`.
- Shared UI layer, RV-008: `core/contracts/QueueCenterTypes.ts:10` and `QueueCenterContract.ts:579` should accept `stopping`; it currently maps to `off`.
- Shared UI layer, AT-037: `core/integrations/pycore/PycoreHttpRoutes.ts:248` `wordAudioFetchYoudao` names a removed route and has no caller.
- Orchestrator contracts:
  - RV-009: the route policy entry above.
  - RV-010: the three endpoint roles above.
  - RV-004: `task_contract.stream_events` has no pycore reader left (Laravel removed its reader in T4; mcp-chrome dropped its SSE consumer).
- D7 (pycore + pycore-manager): AT-049, one engine-test schema.

### Decisions taken without asking (B9)

- AT-016: a ContextVar (`engine_setting`) instead of new fields on `TTSSynthesisRequest`. The engines already read settings by name, and `copy_context` carries the override to the parler model owner. This changes the fewest signatures.
- AT-050: one shared `CodedMessage` (a `str` subclass) instead of a parallel code API per engine, so every existing text consumer (logs, the self-check) keeps working. `orch_messages` reuses its renderer, so one implementation remains.
- AT-049: deferred rather than deleted, because a live consumer is outside the pycore scope.

## pycore-5: rulings RV-007, X4, RV-004 (D10, submitted)

Rulings: §7.2 (RV-007, X4, RV-004), the 06:0x contract changes (`queue_center_contract.json` `word_identity`, `realtime.head_keys`, `realtime.resource_key_formats`) and §8.0 (X4 words without a Laravel md5 go to D7).

The earlier pycore teammate had left the first half of each ruling on disk. The D10 session checked those hunks against the rulings and the contract (read-only git, `--ignore-space-at-eol`). It then closed the gaps below.

Review base:
- The earlier hunks were captured by commit `f4f2234`, like the rest of pycore-4 (see the pycore-4 "Review base").
- The D10 edits are uncommitted.
- So `git diff 74e7770 -- <file>` shows both halves, and `git diff HEAD -- pycore` shows only the D10 edits (10 files).

### Per finding

| Id | Status | Where / how |
|---|---|---|
| RV-007 | fixed | **Event names:** every realtime event pycore handles is looked up in `QUEUE_CENTER_REALTIME_EVENTS` (contract `realtime.events`). A grep finds no event-name literal in `pycore/` or `pyapps/`. The Mercure topics come from Laravel's connection response. **Heads:** `snapshot_service._head_entries` reads the keys of each priority event at its contract `realtime.head_keys` path: `task_id` for task.priority, `items[].resource_key` for cover.priority and poster.priority. **D10:** only keys in the contract `realtime.resource_key_formats` are kept (`library:<library_id>`, `<media_type>:<media_id>`). The check is `queue_center_contract.realtime_head_key_valid`, whose patterns are compiled once from the contract; each `<name>` is one `:`-free segment. An event with no valid key adds no head, so the synthetic `event-<cursor>` head is gone (for example a cover retry with `all=true` and empty `items`). Heads carry `head_key`. **D10:** only task.priority sets translation-worker priority (`QUEUE_CENTER_TASK_PRIORITY_QUEUE`). The old loop that fed any priority event's `items[].task_id` to the translation worker is removed, because cover and poster rows are library and media rows, not global tasks. Laravel's only task.priority producer (`AppQyV1TranslationRealtimeService::priority`) sends one top-level `task_id`. |
| X4 | fixed (pycore half); the fallbacks for words without a Laravel md5 stay until D7 (§8.0) | See "X4 detail" below. |
| RV-004 | fixed (pycore half) | `GLOBAL_TASK_STREAM_EVENTS_BY_ROLE` and its `__all__` entry are removed. No pycore or pyapps file reads `task_contract.stream_events` (the only `stream_events` hit is the unrelated `event_service.stream_events` function). One reader outside pycore remains; see the cross-scope notes. |

X4 detail. Contract `word_identity`: the md5 of the exact stored content, with `consumers_recompute: false`.
- `payload.md5` (word_audio lane):
  - `laravel_audio_worker_state` uses it as is. A word task without it fails with `word_audio payload carried no md5`; nothing is recomputed.
  - Head events (Laravel `QueueHeadNotificationService` sends `md5`) and `audio_dedup_key_from_task` also read `payload.md5`.
- `payload.words[].md5`:
  - The batched dictionary lanes (word_validity, dictionary_explanation) are claimed by chrome, not pycore (contract claimants).
  - pycore's multi-word audio handler (`translation/worker/handlers/audio.py`) passes each `words[].md5` to its result unchanged.
- Upload `body.md5` (D10): the single upload (`audio_resource_delivery._deliver_resource`) sends the md5 held in the row's `resource_key` (new `audio_resource_ledger.word_md5`). A row recorded with Laravel's md5 therefore uploads that md5. The transitional recompute runs only for a row without a key.
- Delivery key `<lang>:<md5>[:<variant>]`. D10 closed three paths that dropped Laravel's md5 and keyed by md5(lower(strip)):
  1. Lane stage: `laravel_audio_delivery.stage` → `audio_resource_delivery.publish(..., md5=)` → `audio_resource_ledger.record(..., md5=)`. Before, the lane row used Laravel's md5, but the cache row published to the other servers was keyed by the recomputed md5.
  2. Lane word batch: `_prepare_word_batch` → `kokoro_batch.synthesize_words_to_cache(..., md5s)` → `word_audio_cache.save_to_cache(..., md5)` → ledger.
  3. Local tasks: `audio_queue_center.build_local_task(..., md5=)` uses Laravel's md5 as the task identity. The full pull (`word_audio_full_sync`) and the manual promote (items that carry `md5`) pass it. Before, the full pull's task id held the recomputed md5 while its payload held Laravel's.
- Unchanged until D7 (§8.0: orchestration-tokenized words, the word-cache bootstrap and local Part1 tasks have no Laravel md5):
  - the three listed fallbacks: `audio_resource_ledger.resource_key`, the single upload, and `build_local_task`;
  - a fourth site that §8.0 does not list: `queue_center_contract.audio_dedup_key` recomputes when `md5` is absent, and it must match `build_local_task`, because orchestration's `resource_queue_key` depends on it. D10 corrected its docstring, which still described the old lowercased-word rule.
- Not word identity, so unchanged:
  - the article_audio md5 in `laravel_audio_worker_state` (Laravel's `payload.md5`, else the md5 of the content);
  - the book payload's word `content_id` (`book_structure`), a book content-id scheme that the server computes the same way. It is not a contract `word_identity` field.
- Known limit, until D7: a word cached by orchestration (fallback key) and later served to the lane from the cache gets a second ledger row, under Laravel's md5, for the same file. This happens only for words whose stored form is not lower-case. The row under the fallback key keeps the transitional behavior.

### Changed files (pycore-5, D10 session)

- `pycore/pyutils/common/queue_center_contract.py` (CRLF): `QUEUE_CENTER_REALTIME_RESOURCE_KEY_FORMATS`, `realtime_head_key_valid`, and the `audio_dedup_key` docstring.
- `pycore/pyctl/queue_center/snapshot_service.py`.
- `pycore/pyutils/tts/audio_resource_ledger.py`, `pycore/pyutils/tts/word_audio_cache.py`, `pycore/pyutils/tts/batch/kokoro_batch.py` (CRLF), `pycore/pyutils/tts/audio_queue_center.py`.
- `pycore/pyctl/tts/audio_resource_delivery.py`, `pycore/pyctl/tts/laravel_audio_delivery.py`, `pycore/pyctl/tts/laravel_audio_worker_execution.py`, `pycore/pyctl/tts/word_audio_full_sync.py`.

Earlier teammate, verified in D10 (in `f4f2234`):
- `queue_center_contract.py`: `QUEUE_CENTER_REALTIME_HEAD_KEYS`, and the removal of `GLOBAL_TASK_STREAM_EVENTS_BY_ROLE`;
- `snapshot_service.py`: `_head_entries`, and the `head_key` heads;
- `laravel_audio_worker_state.py`: md5 required, no recompute;
- `laravel_audio_delivery.py` and `audio_resource_ledger.py`: the ledger takes the lane md5.

### Checks (static only; nothing was started or tested)

- Static checks over the 10 files: `ast.parse`, the `symtable` undefined-global scan and `from pycore... import X` resolution (namespace packages such as `pyctl/tts` accepted): 0 problems. A negative probe shows the checker flags an undefined name, a missing name and a missing module.
- Signatures: every changed signature only appends an optional parameter (`record`, `publish`, `save_to_cache`, `synthesize_words_to_cache`, `build_local_task`). All callers were checked with grep, including `scripts/` and `pyapps/` (none there).
- Import edges: no new module edge. `snapshot_service` → `queue_center_contract` and `audio_resource_delivery` → `audio_resource_ledger` already existed; `re` is stdlib.
- Scratch run with `python -B`:
  - the real `queue_center_contract` module loads the formats as `library:[^:]+` and `[^:]+:[^:]+`;
  - 11 key cases pass: `library:12` is accepted; `library:`, `book:3` (cover), `library:1:2` and `event-9` are rejected; task keys accept any non-empty id;
  - `_head_entries` logic: cover `all=true` gives no head, and an item without `resource_key` is dropped;
  - `word_md5("en:abc:slow")` gives `abc`;
  - `GLOBAL_TASK_STREAM_EVENTS_BY_ROLE` is absent.
- Line endings:
  - `git diff --numstat` is identical with and without `--ignore-space-at-eol` against HEAD (10 files). Against `74e7770` it is identical for 163 entries, except the known `commander.py` (pycore-3).
  - A difflib scan finds 0 unchanged lines with a flipped ending.
  - New lines are CRLF in `kokoro_batch.py` (CRLF) and in `queue_center_contract.py` (mixed; the region is CRLF, and its 7 LF lines are unchanged from the base). The other files stay LF.

### Cross-scope (for the orchestrator)

- RV-004: `poly_apps/pycore_laravel_wordnew_ui/core/contracts/QueueCenterContract.ts:132` (the `stream_events` type) and `:283` (`GLOBAL_TASK_STREAM_EVENTS_BY_ROLE`, no importer) still read `task_contract.stream_events`. The shared UI layer drops both before the orchestrator deletes the key. pycore, Laravel (T4/T9) and mcp-chrome (mcp-chrome-4) no longer read it. The built Android asset `native/wordnew/android/.../index-Bb2-UHxL.js` is regenerated by the next build.
- X4, §8.0 D7 list: add `pycore/pyutils/common/queue_center_contract.py` `audio_dedup_key` (the md5 fallback when `md5` is absent) as the fourth transitional site. It is removed together with `build_local_task`'s fallback when Laravel resolves by `cleaned_word` and the contract gains `word_identity.fallback_when_md5_absent`.
- RV-007: no UI reads `queue_heads` (grep of `poly_apps` and `apps`). The new `head_key` field (and `task_id: null` on cover and poster heads) needs no UI change.

### Decisions taken without asking (B9)

- RV-007: head keys are checked against `realtime.resource_key_formats`, not trusted as any string, so pycore holds only heads in the contract shape that both ends load. The alternative, reading the formats as documentation only, would leave a malformed key able to create a head.
- RV-007: translation-worker priority comes from task.priority only. Applying `items[].task_id` from cover and poster events contradicts the ruling ("library and media rows, not global tasks"), and no producer sends that shape.
- X4: the single upload reads the md5 from the ledger `resource_key` (contract shape `<lang>:<md5>[:<variant>]`), not from a new ledger column. This avoids a database schema change.
- X4: the wire field names stay literals (`md5`). pycore adds no loader for the `word_identity` block, because no code would read its values (it would be dead code).

## Messages sent / cross-scope

- team-lead: K7 evidence (answered by the K7a ruling).
- shell: `pyservice_entry.sh` `BIND_HOST` default → 127.0.0.1 (pycore downgrades anyway), plus the PR-034 script-order half.
- pycore-manager: new pycore error codes: `local_rpc_host_forbidden`, `local_rpc_origin_forbidden`, `client_key_*`, `LARAVEL_ENDPOINT_UNKNOWN`, `system_settings_invalid`, `open_file_type_forbidden`, `event_name_forbidden`.
- orchestrator: `docs_fix/CODESYNC_AI_COMMUNICATION_API.md` still documents the removed bearer secret. Workspace callers now sign with `client_key_headers(method, url, body, content_type)` from `pycore.pyutils.common.client_key_auth`, and the key comes from the dd.sh store.
- User action (for the requirements record): a LAN machine that must accept CodeSync peers sets `rpcLanBind=true` once.

## Pre-existing issues seen (not in the audit, not changed)

Broken imports:
- `pyapps/matrix/*`: `get_heartbeat_system`, adb_manager types, `rpc_service_scanner`;
- `pyapps/okx_price_monitor/lib/models.py` (`pycore.database.exports`);
- `pycore/callmodule/__main__.py` (`launch_windows_tray`);
- `pycore/pyutils/device/connection_manager.py` (`VideoCodec`).

Syntax errors:
- `pyapps/matrix/controller/launcher_builder.py`;
- `pyapps/d3-check/*` (two files).

## Blockers

None.

pycore-5: submitted, waiting for review. Next owner: the reviewer. The D10 files are listed under "Changed files (pycore-5)". Review with `git diff HEAD -- pycore` for the D10 edits and `git diff 74e7770` for the earlier ruling hunks. Afterwards the orchestrator takes the pycore-5 cross-scope items.

pycore-4 is approved in round 2. Next owner: the orchestrator, for the cross-scope items above and two non-blocking reviewer follow-ups:
- `memory_gate.py:147` `_gpu_query` still calls nvidia-smi without a timeout, and `_torch_cuda.py:132` uses a literal 15.
- The qwen submit counts only `running` items as in flight, so a re-submit between `start_bus_task` and `start_item` can start a second `_run`.

AT-037 deletions (user question, 2026-09-27): read-only explanation in `.claude/agents_shared/reports/pycore-AT-037-deletions.md`. Nothing was restored.
