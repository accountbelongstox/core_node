# DESIGN — Agent History Floating Panels + Realtime Prompt Monitor

Date: 2026-09-19
Status: Design (implementation pending)
Scope: `poly_apps/pycore_laravel_wordnew_ui` (PcAgentHistory page), `pycore/pyctl/agent_history`, `pycore/pyfoundations`, `scripts/winenvs`, `poly_apps/laravel_main` (relay/Mercure)

---

## 1. Original Requirement (verbatim, preserved)

> Agent 历史
> 本地 Agent / Claude / Codex / Cursor / Gemini / Kimi / Antigravity / Cline 的提示词与 AI 回复 — 由 pycore 持续提取并写入 txt 文件。
>
> 实时
> 立即刷新
> 存储更新时间: 2026-09-19 16:02:09675 会话 · 9933 提示词
> 短文处理
> 按配置长度整理提示词和 AI 回复，通过 OpenRouter 生成中英文短文，使用本地 TTS 合成音频，再发布到 Laravel。
>
>
> 自动处理历史
> 阶段: 正在处理
> 正在处理: generating_reference_cn
> 10% · 0/1
> 参考语言
> 中文（CN）
> 目标语言
> 英文（EN）
> 最少来源词数
> 200
> 词
> 保存设置
>
> 生成学习视频
> 复用选定用户的播放设置，并与千问任务独立并行。
> 学习用户名
> 虚拟已读批次
> default
> 视频并发数
> 2
> Pycore 后端存储: D:\programing\Users\mpc\.core_node\config\user_data.json
> 参与短文处理的工具
>
> Pi
>
> 提示词
> 236
>
> 吐字历史
> 194
>
> 已处理内容
> 218
>
> 待处理内容
> 212
> 55 会话
>
> Claude
>
> 提示词
> 134
>
> 吐字历史
> 65
>
> 已处理内容
> 196
>
> 待处理内容
> 3
> 8 会话
>
> Codex
>
> 提示词
> 3129
>
> 吐字历史
> 6091
>
> 已处理内容
> 2337
>
> 待处理内容
> 6883
> 164 会话
>
> Cursor
>
> 提示词
> 5727
>
> 吐字历史
> 4807
>
> 已处理内容
> 135
>
> 待处理内容
> 10399
> 238 会话
>
> Gemini
>
> 提示词
> 0
>
> 吐字历史
> 0
>
> 已处理内容
> 0
>
> 待处理内容
> 0
> 0 会话
>
> Kimi
>
> 提示词
> 632
>
> 吐字历史
> 321
>
> 已处理内容
> 207
>
> 待处理内容
> 746 找到以上，以及pyservice的代码，后端中转，现在增加功能，1：当点击提示提示词时，需要弹出悬浮页，分页显示所有提示词，当点击某个AI工具的叶字历史，己处理内容，待处理内容时，都要弹出，而不是直接跳转到页面下部，添加全局复用组件 ，2：目前pycore端改为每30秒刷递增一次，但UI增加实时监控提示词，默认勾选，勾选后每5秒扫描一下所有勾选的local Agent是否有新的提示词，搜索官方目录如何获得提示词，如果无法找到，则扫描本机，先支持kimi / codex / pi / claude 工具，同时注意，先扫描机机的kimi1 kimi2 也就是 scripts\winenvs 中的相关的脚本，了解这些agent使用出不同的用户目录的规范，添加目录扫描中心到基本类库，确保扫描时会扫描所有目录，比如 D:\programing\Users 下的目录，当前是liunx扫描并定义liunx，也就是需要扩展常量库，确保能提取取所有实时提示词，同时，定义缓存，比如一个agent没有最新修改，可以直接跳过，不用扫描，3：如果有新的提示词，立即通知UI，注意转发模型，一直接UI访问模型的通知方式，可以搜索官方，和沿用现在的代码，最大化使用larave l13 和frankenPHP的能力，如果是直接连接的UI，则直接通知。4：点立即 刷新并不是刷新device，而是实时扫描一遍所有的agent的最新数据，和所有pycore的缓存数据。以上要求先写入docs fix中的设计文档，再根据设计文档写进度文档，同时设计文档要最大按的保留 上面提示词的原文。

---

## 2. Requirement Breakdown

| # | Requirement | Summary |
|---|-------------|---------|
| R1 | Floating panels | Clicking 提示词 / 吐字历史 / 已处理内容 / 待处理内容 on a tool card opens a paginated floating (modal) panel instead of scrolling to the list at the page bottom. Deliver as a global reusable component. |
| R2 | Realtime prompt monitor | pycore heartbeat extract lane stays at ~30s incremental. UI gains a "实时监控提示词" checkbox (default ON). While ON, pycore scans every 5s for new prompts of the checked local agents. Support kimi / codex / pi / claude first. Prefer official per-tool directory specs (researched from official docs); fall back to machine scan. Honor the per-slot user-directory convention used by `scripts/winenvs` (kimi1/kimi2 etc.). Add a directory scan center to the base library and extend the constants library so all roots are covered (Windows: `D:\programing\Users`, `D:\.tmp\Users`; Linux equivalents must be defined). Add a scan cache: an agent with no source modification is skipped. |
| R3 | Push notification | New prompts notify the UI immediately. Reuse the existing forwarding model; maximize Laravel 13 + FrankenPHP (Mercure hub) capability; a directly-connected UI is notified directly (pycore SSE). |
| R4 | 立即刷新 semantics | The "立即刷新" button does NOT refresh the device; it triggers one realtime scan of all agents' latest data plus all pycore cached data. |

Process requirement: this design doc first, then a progress doc derived from it (see Section 11).

---

## 3. Current Architecture (grounded findings)

### 3.1 UI (React, `poly_apps/pycore_laravel_wordnew_ui/apps/pycore-manager`)

- `pages/PcAgentHistoryPage.tsx` — main page. Header has the 实时 toggle (`live`, persisted, default ON via `live !== false`) and the 立即刷新 button (`handleRefresh` → `pycoreApi.refreshAgentHistory()`). `handleOpenToolHistory(tool, tab)` (line 420) sets filter + tab and `scrollIntoView`s `listAnchorRef` — this is the "跳转到页面下部" behavior to be replaced by R1.
- `pages/agent-history/PcAgentHistoryToolCheckboxes.tsx` — per-tool cards. Stat buttons (提示词 `item.prompts`, 吐字历史 `item.replies`, 已处理内容 `item.processed`, 待处理内容 `item.pending`, 会话 `item.sessions`) all call `openHistory(tool, 'prompts')` → `onOpenToolHistory` → page scroll. Statistics come from `pycoreApi.getAgentHistoryStatus(tools)` → `tool_histories`.
- `pages/agent-history/PcAgentHistoryConfigPanel.tsx` — article config, video config, hosts the tool checkboxes.
- `pages/agent-history/PcPager.tsx` — existing pager, reusable inside the floating panel.
- `api/AgentHistoryRuntimeStore.ts` — runtime store; subscribes `PYCORE_EVENT_TOPICS.operationChanged` via `pycoreEventBus`.
- `core/integrations/pycore/PycoreEventTopics.ts` — central topic registry; already has `agentHistorySessionsChanged: 'agent_history.sessions.changed'`.
- `core/integrations/pycore/PycoreHttp.ts` — direct-connection transport: `EventSource(eventStreamUrl())` SSE against pycore HTTP server (used when UI talks to pycore directly).
- `core/integrations/laravel/LaravelRealtime.ts`, `LaravelMercureConnection.ts`, `LaravelRelayRoster.ts`, `core/integrations/pycore/PycoreLaravelRelayTransport.ts` — Laravel-hosted transport: Mercure client with persistent cursor replay, plus relay roster.

### 3.2 pycore backend (`pycore/pyctl/agent_history`)

- `agent_history_service.py` — `user_homes()` (line 84) currently enumerates only `Path.home()`, `C:/Users/*` (Windows), `/root` + `/home/*` (Linux). It does NOT cover the isolated slot profiles (`D:\programing\Users\*`, `D:\.tmp\Users\*`). `_extract_inner()` does signature short-circuit (`mtime:bytes` over all sources), per-source incremental reparse, writes txt store (`index.txt`, `prompts.txt`, `state.txt`, `sessions/*.txt`) and fires `THREAD_BUS` signal `_SUMMARY_SIGNAL` + event `BusSignals.AGENT_HISTORY_SESSIONS_CHANGED`.
- Extractors: `kimi_extractor.py` (`~/.kimi-code`, legacy `~/.kimi`; `sessions/*/*/wire.jsonl`, `user-history/*.jsonl`), `codex_extractor.py`, `claude_extractor.py`, `pi_extractor.py`, plus cursor/gemini/antigravity/cline/generic. All implement `discover(home, user)` + `parse_source(path, user)` on `base_extractor.py`.
- `tick_service.py` — intervals via env (`PYCORE_AGENT_HISTORY_EXTRACT_INTERVAL`, default 10s; the 30s cadence the user mentions is set through this env). `request_extract(force=True)` queues a UI-requested extract without blocking HTTP.
- `heartbeat.py` — registers extract / pipeline / upload / video callbacks on the shared heartbeat system.
- `snapshot_cache.py` + `agent_history_statistics.py` — `VersionedSnapshotCache` keyed by file revision (`mtime_ns:size`); per-tool statistics cached by source revision — this is the existing "skip unchanged" cache layer to reuse for R2.
- `ui_service.py` — HTTP route handlers: `refresh` → `request_extract(force=True)` (current 立即刷新 semantics), `status` (tool_histories), `session_id_pages`/`prompt_id_pages` + `session_page`/`prompt_page` (DIFF read surface used by the UI pagers), `test_extract` (read-only per-tool probe).
- Routes registered in `pycore/callmodule/rpc_routes/local_agent_history_routes.py` / `register_http_routes.py`; UI route names in `core/integrations/pycore/PycoreHttpRoutes.ts`.

### 3.3 Per-slot user directory conventions (`scripts/winenvs`, `scripts/shells/win/win_common/GlobalVars.ps1`)

Every launcher isolates `USERPROFILE`/`HOME`/`USER_HOME`/`HOMEPATH`/`USER_DIR` to a per-slot profile so each agent writes history under its own home:

- kimi1.ps1 / kimi2.ps1 → `D:\.tmp\Users\Kimi1`, `D:\.tmp\Users\Kimi2`; `KIMI_CODE_HOME` defaults to `<profile>\.kimi-code`.
- codex1.ps1 → `D:\programing\Users\Codex1` (`.codex` inside); codex2.ps1 → auto-scans `D:\.tmp\Users\MyBest*`.
- piark1..7 / piyolo / picodex / pikimiyolo → `GlobalVars.ps1`: `PI_COMMON_USER_DIR=PiYolo`, `PI_KIMI_USER_DIR=PiKimi`, `PI_CLAUDE_CODE_USER_DIR=PiClaudeCode`, `PI_CODEX_USER_DIR=PiCodex`, `PI_VOLC_AGENT_USER_DIR=PiVolcAgent`, `PI_VOLC_CODING_USER_DIR=PiVolcCoding`, all under `$Global:PROGRAMING_USERS_DIR = D:\programing\Users`; pi config lives at `<profile>\.pi`.
- claude1.ps1 → uses the real user profile (`.claude` under the real home); other claude slots follow the same isolation pattern when present.

### 3.4 Constants library

`pycore/pyfoundations/system_paths.py` is the central path constants module (already hardcodes `D:/programing/Users/{username}/.core_node` on Windows). This is where the scan-center constants extension lands (R2).

### 3.5 Notification / forwarding model

- Direct UI: pycore HTTP server SSE stream (`PycoreHttp.ts` EventSource) fed by `THREAD_BUS.trigger_event(...)`; UI receives topics through `pycoreEventBus`.
- Laravel-hosted UI: pycore → Laravel relay (signed, `config/pycore_relay_contract.json`) → Laravel realtime layer (`app/Services/Realtime/RealtimeOutboxPublisher.php`, `MercurePublisher.php`, `app/Apps/Relay/RelayServices/RelayHubService.php`) → FrankenPHP Mercure hub → `LaravelMercureConnection` in the UI.

---

## 4. R1 — Floating Panels (global reusable component)

### 4.1 New global component

Add `PcFloatingPanel.tsx` under `apps/pycore-manager/components/` (the app-level reusable component directory, next to `PcQueueLogPagination.tsx`). Contract:

- Props: `open`, `title`, `subtitle?`, `onClose`, `footer?` (pager slot), `children`, `widthClass?`.
- Behavior: `fixed inset-0 z-50` overlay, click-outside + `Esc` to close, stops propagation on the panel body, `max-h-[88vh]` scrollable content — same visual language as the existing modal in `PcAgentHistoryAiPanel.tsx` (lines 192-278), which is refactored to consume `PcFloatingPanel` so the pattern has exactly one implementation.
- Pagination inside the panel reuses `pages/agent-history/PcPager.tsx`.

### 4.2 Wiring the tool cards

In `PcAgentHistoryToolCheckboxes.tsx`, replace `openHistory(tool, tab)` scroll behavior: clicking a stat button now emits `onOpenToolPanel(tool, kind)` where `kind ∈ 'prompts' | 'replies' | 'processed' | 'pending' | 'sessions'`. `PcAgentHistoryPage.tsx` keeps `handleOpenToolHistory` only as a fallback and adds panel state `{ tool, kind, page }`.

### 4.3 Panel data sources

- `prompts` kind: existing DIFF surface — `getAgentHistoryPromptIdPages({ tool, page })` + `getAgentHistoryPromptPage(ids)` (no backend change).
- `sessions` kind: `getAgentHistorySessionIdPages` + `getAgentHistorySessionPage` (no backend change).
- `replies` (吐字历史) / `processed` (已处理内容) / `pending` (待处理内容): these counts come from `agent_history_fragments.summarize_tool_fragments_many` over the pipeline fragments. Add a read endpoint `agent_history.tool_fragment_id_pages` + `agent_history.tool_fragment_page` in `ui_service.py` backed by a new `read_tool_fragment_pages(tool, kind, page, page_size, since_revision)` on `AgentHistoryStatistics` — same DIFF contract (IDs + metadata, revision-aligned, lazy materialization, cached by source revision). Fragment text materialization reads the fragment store, never the full catalog.

The old bottom-of-page jump is removed for these four stats; the main list keeps working through its own tabs.

---

## 5. R2 — Realtime Prompt Monitor + Directory Scan Center

### 5.1 Directory scan center (base library)

New module `pycore/pyfoundations/agent_home_scanner.py` (base library, next to `system_paths.py`):

- `scan_user_homes() -> Dict[str, str]` — single source of truth for "all user homes that may hold agent history". Replaces the inline `user_homes()` in `agent_history_service.py` (which is kept as a thin delegating wrapper for compatibility).
- Roots are built from constants (5.2) and probed with `is_dir()`; a root that does not exist on the current machine is skipped silently. Isolated slot profiles are discovered by globbing one level under each users-root (`D:/programing/Users/*`, `D:/.tmp/Users/*` on Windows; configured Linux equivalents), not by hardcoding slot names — new slots (kimi3, codex3, …) are picked up automatically. The launcher-script conventions in Section 3.3 are the specification for why these roots exist.

### 5.2 Constants extension (`pycore/pyfoundations/system_paths.py`)

Add a centralized, platform-split constant block:

- `AGENT_HISTORY_USERS_ROOTS_WINDOWS = ("D:/programing/Users", "D:/.tmp/Users", "C:/Users")`
- `AGENT_HISTORY_USERS_ROOTS_LINUX = ("/home", "/root")` — defines the Linux side explicitly ("当前是linux扫描并定义linux"); per-distro overrides via env `PYCORE_AGENT_HISTORY_USERS_ROOTS` (os.pathsep-separated).
- `AGENT_HISTORY_OFFICIAL_HOME_MARKERS` — per-tool official config dir names, checked inside every discovered home first:
  - kimi: `.kimi-code` (official `KIMI_CODE_HOME`, default `~/.kimi-code`), legacy `.kimi`
  - codex: `.codex` (official `CODEX_HOME`, default `~/.codex`)
  - pi: `.pi` (default `~/.pi`)
  - claude: `.claude` (official `CLAUDE_CONFIG_DIR`, default `~/.claude`)

Resolution order per tool per home: official env var (`KIMI_CODE_HOME` / `CODEX_HOME` / `CLAUDE_CONFIG_DIR`, rooted paths only) → official default dir name in the home → machine scan fallback (the marker scan already in `is_dev_machine`). This satisfies "搜索官方目录如何获得提示词，如果无法找到，则扫描本机". First release wires kimi / codex / pi / claude; the remaining extractors keep the current behavior and migrate onto the scan center unchanged.

### 5.3 Realtime monitor lane (pycore)

- New heartbeat callback `agent_history_live_scan` in `heartbeat.py`, interval env `PYCORE_AGENT_HISTORY_LIVE_SCAN_INTERVAL` default 5s, enabled only while at least one UI has 实时监控提示词 ON (see 5.4) — when no UI monitors, the lane idles and the 30s incremental lane (`agent_history_extraction`) remains the only scanner.
- Scan body: `agent_history_service.live_scan(tools)` where `tools` = the UI-checked local agents (initially intersected with `{kimi, codex, pi, claude}`). It runs the same `_discover_all` per-tool descriptor walk but scoped to the requested tools, compares per-tool source `mtime/bytes` against `state.txt` sources, and only reparses changed sources through the existing `_extract_inner` path (force=False).
- Skip cache: per-tool fast-fail map `{tool: {path: (mtime, bytes)}}` held in `VersionedSnapshotCache` (`agent_history.live_scan.` prefix, version = per-tool source revision from `agent_history_statistics.source_revisions()`). A tool whose discovered descriptors exactly match the cached map returns `{"tool": ..., "skipped": true}` without opening any file — "一个agent没有最新修改，可以直接跳过".

### 5.4 UI toggle

- New checkbox 实时监控提示词 in `PcAgentHistoryPage.tsx` header (next to 实时/立即刷新), default checked, persisted in `AgentHistoryUiStateStore` (`livePromptMonitor !== false`).
- While ON, the page sends the checked tool list with a new route `agent_history.live_scan` (debounced, ≥5s client-side cadence, single-flight) and relies on R3 push for instant updates; the scan response itself only carries `{changed_tools, skipped_tools}` — no payload lists cross the wire per poll.

---

## 6. R3 — New-Prompt Push Notification

Reuse the existing forwarding model; add one topic, no new transports.

1. pycore: when an extract or live scan yields new prompts, `agent_history_service` fires `THREAD_BUS.trigger_event(BusSignals.AGENT_HISTORY_PROMPT_NEW, {tool, os_user, session_id, prompt_ids, ts}, async_mode=True)` in addition to the existing `AGENT_HISTORY_SESSIONS_CHANGED`. Add `AGENT_HISTORY_PROMPT_NEW` to `pycore/pyfoundations/thread_bus_constants.py`.
2. Direct-connected UI: the pycore HTTP SSE stream already forwards thread-bus events; `PycoreEventTopics.ts` gains `agentHistoryPromptNew: 'agent_history.prompt.new'`. `AgentHistoryRuntimeStore.ts` / `PcAgentHistoryPage.tsx` subscribe and refresh the affected tool card + open panel only (debounced 250ms, revision-gated, same pattern as `agentHistorySessionsChanged`).
3. Laravel-hosted UI (maximize Laravel 13 + FrankenPHP): the same event is forwarded through the existing relay path — pycore relay client → Laravel relay intake (signed per `config/pycore_relay_contract.json`) → `app/Services/Realtime/RealtimeOutboxPublisher.php` + `MercurePublisher.php` → FrankenPHP Mercure hub → `LaravelMercureConnection` → same `pycoreEventBus` topic, so UI code is transport-agnostic. Topic name is registered in the shared queue-center/realtime contract (`app/Support/QueueCenterContract.php` / `core/contracts/QueueCenterContract.ts`) following the existing `article.published` precedent.
4. Official-spec note: Mercure is the official FrankenPHP realtime capability (hub built into the Caddy/FrankenPHP server); SSE `EventSource` is the official browser API — both are already in use and are kept as the only two notification channels.

---

## 7. R4 — 立即刷新 Semantics

- `ui_service.refresh` currently calls `request_extract(force=True)` only. Extend to `refresh_all`: (1) force-extract every tool (all sources, not only changed), (2) invalidate pycore read caches — `agent_history_snapshot_cache`, `status_snapshot_cache` keys with the `agent_history.` prefix, and the tool-statistics versions — so the next read reparses store files from disk, (3) return `{queued, cache_invalidated: true}`. No device/machine refresh is involved anywhere in this path.
- UI `handleRefresh` stays a single button call; on the response it force-reloads session/prompt pages bypassing `sinceRevision` and reloads tool statistics (`PcAgentHistoryToolCheckboxes.loadStatistics`) — the user sees freshly scanned data, not a device reboot/refresh side effect.

---

## 8. Backend Route Additions

| Route (pycore HTTP) | Handler | Purpose |
|---|---|---|
| `agent_history.live_scan` | `ui_service.live_scan` | 5s monitored scan for checked tools; returns changed/skipped only |
| `agent_history.tool_fragment_id_pages` | `ui_service.tool_fragment_id_pages` | R1 DIFF pages for replies/processed/pending |
| `agent_history.tool_fragment_page` | `ui_service.tool_fragment_page` | R1 lazy materialization for one panel page |
| `agent_history.refresh` (extended) | `ui_service.refresh` | R4 full rescan + cache invalidation |

Registration follows the existing pattern in `pycore/callmodule/rpc_routes/local_agent_history_routes.py`; UI route names added to `core/integrations/pycore/PycoreHttpRoutes.ts`; typed wrappers in `pycoreApi`.

## 9. i18n

New keys in `pc-locales/PcZhFeatures.ts` + English locale: `livePromptMonitor`, `toolPanelPrompts`, `toolPanelReplies`, `toolPanelProcessed`, `toolPanelPending`, `scanSkipped`, `scanChanged`. No hardcoded language strings in components.

## 10. Compatibility & Risks

- Windows + Linux simultaneously (AGENTS.md); all new path constants are platform-split and env-overridable; no PowerShell changes required (winenvs scripts are the *specification source*, not modified).
- Extract lane serialization (`_ExtractGate`, `SerializedWorkerThread`) is preserved; the 5s live lane joins the same extract queue, so a 30s incremental run and a 5s live scan can never parse concurrently.
- DIFF read surface contract (revision alignment, `MATERIALIZE_CAP = 100`, `ID_PAGE_SIZE_CAP = 1000`) is mirrored by the new fragment endpoints.
- No database; txt store layout unchanged; `EXTRACTOR_SCHEMA_REVISION` bump only if session shape changes (not planned).
- Risk: globbing large users-roots every 5s — mitigated by the per-tool descriptor skip cache and by scoping live discovery to checked tools only.

## 11. Progress Tracking

Implementation progress is tracked in `docs_fix/DESIGN_20260919_AGENT_HISTORY_FLOATING_PANELS_REALTIME_MONITOR_PROGRESS.md`, derived from the phases below:

- Phase A: scan center + constants (R2 foundation)
- Phase B: live scan lane + skip cache + UI toggle (R2)
- Phase C: push notification topic end-to-end (R3)
- Phase D: floating panel component + fragment endpoints + card wiring (R1)
- Phase E: 立即刷新 semantics (R4) + final sweep (i18n, stale comments)
