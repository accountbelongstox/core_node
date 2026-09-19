# FIX — Agent History Prompt-New Logging + Live Scan Refactor

Date: 2026-09-19 21:37
Status: Implemented (live verification pending)
Scope: `pycore/pyctl/agent_history`, `pycore/callmodule/rpc_routes`, `poly_apps/pycore_laravel_wordnew_ui` (pycore-manager/agent-history)

---

## 1. Original Requirement (verbatim, preserved)

> 查看UI是通过什么接口来控制 pycore实时监听各个agent的提示词的，先查看这个功能是否有效，以及是否存在BUG，如果有效且正常，现在在 pycore的日志打印中调用coloer print，只要有新的提示词就打印 agent 名，提示词前10个字和后10个字（大于20字的提示词）并打印发现新提示词。同时现在的 pycore-manager/agent-history 加入的要求实时提示词的是否联动，并且是否功能统一。同时现在代码已经更新，ui并不运行在本地但代码在poly apps / pycore ui.
>
> 按规范代码需要全英文。
>
> 小问题要底层重构，不是小修小补。
>
> 以上先实地扫描写到 doc fix 文档目录作为开发要求，之后实际运行 pyservice，我将在另一个 kimi 上输入提示词，扫描本机所有的 kimi 和 kimi 的个性化目录得到新提示词，在 pyservice 启动 5 分钟后打印监听到的提示词。

## 2. Field Scan — Control Interface Chain

The UI controls pycore realtime prompt monitoring through two channels:

**Control channel (pull):**
- UI toggle `livePromptMonitor` (default ON, persisted in `AgentHistoryRuntimeStore`)
  → `PcAgentHistoryPage.tsx` polls every 5s (`LIVE_SCAN_POLL_MS = 5000`)
  → HTTP route `ui/agent_history/live_scan` (`pycoreApi.liveScanAgentHistory`, tools ∩ `{kimi, codex, pi, claude}`)
  → `ui_service.live_scan` → `agent_history_tick_service.request_live_scan` (5s throttle, shares the serialized extract gate)
  → `agent_history_service._live_scan_inner` (per-tool source descriptor diff: `mtime:bytes`)
  → on change: `_extract_inner`.

**Push channel:**
- `_extract_inner` collects appended prompts → `_emit_prompt_new`
  → THREAD_BUS event `agent_history.prompt.new` (`BusSignals.AGENT_HISTORY_PROMPT_NEW`)
  → local: `thread_bus_routes.py` registered listener → HTTP event clients → UI `pycoreEventBus` → 250ms debounced page reload
  → remote (UI not local): `laravel_relay_agent_service.py` forwards the event through the Laravel relay outbox → FrankenPHP Mercure → UI bridges it back onto the same local topic.

**Baseline (always on):** heartbeat callback `agent_history_extraction` every 10s scans ALL agents (not only the 4 live-scan tools) through the same `_extract_inner` / `_emit_prompt_new` path.

**Kimi coverage:** `kimi_extractor.py` scans per user home (scan center covers per-slot/personalized profiles) both `~/.kimi-code` and legacy `~/.kimi` (realpath-deduped), including `sessions/*/*/wire.jsonl`, sub-agent `agents/*/wire.jsonl`, and `user-history/*.jsonl`.

## 3. Verdict — Feature Valid, Linkage Unified

- Live-scan poll and heartbeat extract share one serialized queue (`pyctl.agent_history.extract`) and one emit path → functionally unified; UI toggle, enabled-tools filter, and relay forwarding are linked end-to-end.
- Server throttle (5s) matches UI poll cadence (5s).

## 4. Bugs Found → Refactored (root-level, not patches)

1. **`is_dev_machine` dead code.** The home × marker filesystem scan was dead since file creation (unconditional `return True` at the end). Removed the scan loop and the `TOOL_MARKERS` constant that only fed it; method is now an honest `staticmethod` returning True. Eliminates wasted disk IO on every extract tick.
2. **Live-scan cold start forced a full extract.** `_live_scan_descriptors` was a blank ad-hoc cache duplicating knowledge already persisted in `state["sources"]` (path → mtime/bytes/tool). Added `_state_tool_descriptors(tool)` + `_live_scan_baseline(tool)`: the skip cache is now seeded from persisted extract state on first use, so a fresh pycore boot with fresh state skips redundant extraction.
3. **Extract errors misreported as `changed: true`.** `_live_scan_inner` now surfaces `error` explicitly; `changed` is true only when sources changed AND extract succeeded AND was not `unchanged`.
4. **Same prompt re-logged on every session-file change.** Root cause: `_extract_inner` re-parses a changed source and pushed ALL of its prompts into the emit list, so a prompt re-appeared in the log every time its session file grew. Refactored the extraction layer to diff by prompt id: the known-id set is seeded from the persisted prompts store (`txt.read_prompts()`, already loaded for the merge — zero extra IO), `append_prompts` still carries the full session replacement for the store merge, and a separate `new_prompts` list (ids never seen before, also deduped within the run) feeds `_emit_prompt_new`. Semantics: a prompt logs exactly once, when its id first enters the store; a `force` / schema-change re-extract re-emits nothing; a first-ever run with an empty store emits everything (capped at 20).

## 5. New-Prompt Color Logging (this change)

In `agent_history_service._emit_prompt_new` (the single choke point for heartbeat + live scan), each genuinely new prompt (id first entering the store; newest first, capped at `PROMPT_NEW_EVENT_CAP = 20`) logs one line via `ColorPrint.green` (all-English per project rules):

```
[AgentHistory] New prompt detected agent=<tool> user=<os_user> prompt="<first 10 chars>...<last 10 chars>"
```

Prompts longer than 20 chars show first 10 + last 10 chars; shorter prompts print in full; whitespace is collapsed to keep one line per prompt.

## 6. Live Verification Plan

1. Start `pyservice.ps1 -NoInstall -NoUi` on a free port with stdout captured to a log file.
2. Operator types a prompt in a separate Kimi CLI instance on this machine.
3. Within one extract tick (≤10s heartbeat, ≤5s live scan when UI polls) the changed `wire.jsonl` / `user-history` file is re-parsed and the new prompt must appear in the log as the line in §5.
4. After 5 minutes of uptime, report all monitored prompt lines from the log.
