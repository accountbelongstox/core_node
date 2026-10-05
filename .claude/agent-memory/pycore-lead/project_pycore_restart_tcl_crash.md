---
name: pycore-restart-tcl-crash-outage
description: 2026-10-05 pycore (and the :13054 terminal page data) was down 04:21-10:41 because the self-restart crashed in tcl86t.dll before the successor spawned; nothing supervises the logon-task pycore; step 175 is unrelated
metadata:
  type: project
---

`POST /api/ui/control/restart` at 04:21:18 -> shutdown stack -> python.exe APPCRASH in `tcl86t.dll` (code 0x80000003, Application log Id 1000) at 04:21:19, about 20 ms after "Restart requested - re-executing". The successor is spawned only AFTER teardown (`pycore_module_caller.py` -> `process_restart.restart_current_process`, Windows `Popen` + `os._exit(3)`), so the crash left no pycore until 10:41:27. The same crash signature happened 2026-10-03 15:52:39. Vite (:13054, service ncore-nexus-dash) stayed up, so the page loaded but had no backend.

**Why:** this host runs pycore from the logon task `PyCore_RPC_Server` (trigger = logon only, RestartCount 0), not the NSSM pycore service, so a crash is never restarted. Step 175 (`Step175_LaravelMainStart.ps1`) only converges Laravel/FrankenPHP; it touches nexus-dash only on a LAN-only host.

**How to apply:** for "terminal page stuck", check first `Get-WinEvent Application Id 1000` for python.exe crashes and gaps between `instance_id`s in `D:\www\core_node\logs\pycore_console.jsonl(.1)` (ts is epoch ms). Faulting Tk thread is unproven (candidates: `DesktopToastStackThread` in `pyutils/desktop/toast_stack.py`, tk debug window). Candidate fixes not applied: spawn the successor before teardown (it already waits for the parent pid, 30 s), or supervise the task. Healthy-state baseline: 40 parallel `ui/terminal/windows` calls finish in ~1.3 s. Related: [[project-terminal-control-latency]].
