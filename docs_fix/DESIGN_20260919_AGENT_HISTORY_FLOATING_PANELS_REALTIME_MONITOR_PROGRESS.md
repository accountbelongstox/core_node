# PROGRESS — Agent History Floating Panels + Realtime Prompt Monitor

Date: 2026-09-19
Design doc: `docs_fix/DESIGN_20260919_AGENT_HISTORY_FLOATING_PANELS_REALTIME_MONITOR.md`
Status: **Implementation complete (2026-09-19)** — static checks pass; runtime smoke pending (see Verification)

## Original Requirement (verbatim, preserved)

> 1：当点击提示提示词时，需要弹出悬浮页，分页显示所有提示词，当点击某个AI工具的叶字历史，己处理内容，待处理内容时，都要弹出，而不是直接跳转到页面下部，添加全局复用组件 ，2：目前pycore端改为每30秒刷递增一次，但UI增加实时监控提示词，默认勾选，勾选后每5秒扫描一下所有勾选的local Agent是否有新的提示词，搜索官方目录如何获得提示词，如果无法找到，则扫描本机，先支持kimi / codex / pi / claude 工具，同时注意，先扫描机机的kimi1 kimi2 也就是 scripts\winenvs 中的相关的脚本，了解这些agent使用出不同的用户目录的规范，添加目录扫描中心到基本类库，确保扫描时会扫描所有目录，比如 D:\programing\Users 下的目录，当前是liunx扫描并定义liunx，也就是需要扩展常量库，确保能提取取所有实时提示词，同时，定义缓存，比如一个agent没有最新修改，可以直接跳过，不用扫描，3：如果有新的提示词，立即通知UI，注意转发模型，一直接UI访问模型的通知方式，可以搜索官方，和沿用现在的代码，最大化使用larave l13 和frankenPHP的能力，如果是直接连接的UI，则直接通知。4：点立即 刷新并不是刷新device，而是实时扫描一遍所有的agent的最新数据，和所有pycore的缓存数据。以上要求先写入docs fix中的设计文档，再根据设计文档写进度文档，同时设计文档要最大按的保留 上面提示词的原文。

## Status Overview

| Phase | Scope (design ref) | Status |
|---|---|---|
| 0 | Design doc + progress doc in docs_fix | Done (2026-09-19) |
| A | Scan center + constants (design §5.1, §5.2) | Done (2026-09-19) |
| B | Live scan route + skip cache + UI toggle (design §5.3, §5.4) | Done (2026-09-19, with deviation — see Phase B) |
| C | Push notification topic end-to-end (design §6) | Done (2026-09-19) |
| D | Floating panel + fragment endpoints + card wiring (design §4) | Done (2026-09-19) |
| E | 立即刷新 semantics + i18n + final sweep (design §7, §9) | Done (2026-09-19) |

## Phase 0 — Done

- Explored current implementation and grounded the design:
  - UI: `apps/pycore-manager/pages/PcAgentHistoryPage.tsx` (`handleOpenToolHistory` scroll, `handleRefresh`), `pages/agent-history/PcAgentHistoryToolCheckboxes.tsx` (stat buttons), `PcAgentHistoryConfigPanel.tsx`, `api/AgentHistoryRuntimeStore.ts`, `core/integrations/pycore/PycoreEventTopics.ts`, `PycoreHttp.ts` (SSE), `core/integrations/laravel/LaravelRealtime.ts` / `LaravelMercureConnection.ts`.
  - pycore: `pycore/pyctl/agent_history/agent_history_service.py` (`user_homes`, incremental `_extract_inner`), `tick_service.py` (env-driven intervals), `heartbeat.py`, `snapshot_cache.py`, `agent_history_statistics.py`, `ui_service.py`, extractors for kimi/codex/pi/claude.
  - Slot directory conventions: `scripts/winenvs/kimi1.ps1` / `kimi2.ps1` (`D:\.tmp\Users\Kimi1|Kimi2`, `KIMI_CODE_HOME=<profile>\.kimi-code`), `codex1.ps1` (`D:\programing\Users\Codex1`), `codex2.ps1` (`D:\.tmp\Users\MyBest*`), pi launchers + `scripts/shells/win/win_common/GlobalVars.ps1` (`PROGRAMING_USERS_DIR=D:\programing\Users`, `PI_*_USER_DIR`), `claude1.ps1` (real profile `.claude`).
  - Constants home: `pycore/pyfoundations/system_paths.py`.
  - Relay/realtime: `config/pycore_relay_contract.json`, `poly_apps/laravel_main/app/Services/Realtime/RealtimeOutboxPublisher.php`, `MercurePublisher.php`, `app/Apps/Relay/RelayServices/RelayHubService.php`.
- Wrote the design doc preserving the original prompt text verbatim (design §1).

## Phase A — Scan Center + Constants (done)

- [x] `pycore/pyfoundations/system_paths.py`: added `AGENT_HISTORY_USERS_ROOTS_ENV` (`PYCORE_AGENT_HISTORY_USERS_ROOTS`), `AGENT_HISTORY_USERS_ROOTS_WINDOWS` (`D:/programing/Users`, `D:/.tmp/Users`, `C:/Users`), `AGENT_HISTORY_USERS_ROOTS_LINUX` (`/home`, `/root`), `AGENT_HISTORY_OFFICIAL_HOME_MARKERS` (kimi: `KIMI_CODE_HOME` + `.kimi-code`/`.kimi`; codex: `CODEX_HOME` + `.codex`; pi: `.pi`; claude: `CLAUDE_CONFIG_DIR` + `.claude`), `AGENT_HISTORY_LIVE_SCAN_TOOLS = ('kimi','codex','pi','claude')` — all exported in `__all__`.
- [x] `pycore/pyfoundations/agent_home_scanner.py` (new): `scan_user_homes()` — process home + one-level slot directories under each users-root, deduped by realpath; `/root` (or any users-root that itself carries an agent marker) is treated as a home and not drilled into. `official_tool_homes(tool, home)` resolves env var → official default dir name. Verified on Linux with a smoke run (correctly excludes `/root/Desktop`-style non-home children).
- [x] `agent_history_service.user_homes()` now delegates to `scan_user_homes()`; unused `import platform` removed.

## Phase B — Live Scan Route + UI Toggle (done, with deviation)

**Deviation from design §5.3 (documented there):** no heartbeat callback was added. The live scan is a UI-driven on-demand route `ui/agent_history/live_scan` → `tick_service.request_live_scan(tools)` with server-side throttle `LIVE_SCAN_MIN_INTERVAL` (env `PYCORE_AGENT_HISTORY_LIVE_SCAN_INTERVAL`, default 5s; early polls return `{throttled, retry_after, last}`). Reason: with no UI monitoring there is nothing to scan for, so no background lane or "who is monitoring" registry is needed; the heartbeat keeps only the ~30s incremental extract lane.

- [x] `agent_history_service.live_scan(tools)` / `_live_scan_inner(tools)`: scoped discovery per tool (intersected with `AGENT_HISTORY_LIVE_SCAN_TOOLS` by the route layer), serialized through the shared `_EXTRACT_QUEUE` worker.
- [x] Skip cache: in-memory per-tool descriptor map `{path: "mtime:bytes"}` (`self._live_scan_descriptors`); unchanged tools return skipped without opening files; descriptors committed only after a successful extract.
- [x] `tick_service.py`: `_ExtractGate.run_live`, `request_live_scan(tools)`, `_run_live_scan`, snapshot extended with `last_live_scan` / `live_scan_interval`.
- [x] Routes: `UI_AGENT_HISTORY_LIVE_SCAN` in `route_names.py`, registered in `local_agent_history_routes.py`; TS route in `PycoreHttpRoutes.ts`; typed wrappers `liveScanAgentHistory` in `PycoreApiLocal.ts`; types `AgentHistoryLiveScanResult/Response` in `PycoreSpeechTypes.ts`.
- [x] 实时监控提示词 checkbox (default ON, Radar icon) in `PcAgentHistoryPage.tsx` header; persisted as `livePromptMonitor` (default true) in `persistence/AgentHistoryUiStateStore.ts`; 5s poll (`LIVE_SCAN_POLL_MS = 5000`) over `LIVE_SCAN_TOOLS = {kimi, codex, pi, claude}`.

## Phase C — Push Notification (done)

- [x] `BusSignals.AGENT_HISTORY_PROMPT_NEW = "agent_history.prompt.new"` in `pycore/pyfoundations/thread_bus_constants.py`; `agent_history_service._emit_prompt_new()` fires it at the end of `_extract_inner` (after `SESSIONS_CHANGED`) with the latest 20 prompts (text truncated to 200 chars).
- [x] Direct UI: `thread_bus_routes.py` SSE listener tuple extended with `AGENT_HISTORY_PROMPT_NEW`; `PycoreEventTopics.ts` gains `agentHistoryPromptNew`.
- [x] Laravel path: `config/pycore_relay_contract.json` gains event `agent_history_prompt_new` (signal `agent_history.prompt.new`, payload profile `[pairing_id, device_id, revision, metadata]` — both sides read the same contract file, digest stays aligned; PHP only asserts required events exist, so the addition is safe). `laravel_relay_agent_service.py` subscribes the bus signal and republishes via the refactored generic `_post_device_event(event_name, payload, revision)`; `RelayDeviceService.php::event()` now allows `agent_history_prompt_new` through the existing outbox → `RealtimeOutboxPublisher.drainRelay` → FrankenPHP Mercure hub chain.
- [x] UI bridge: `PcAgentHistoryPage.tsx` subscribes `agentHistoryPromptNew` plus the relay bridge (`laravelRelayOperationEvents.onEvent` matching `RELAY_CONTRACT.events.agent_history_prompt_new`, forwarding `data.metadata` into the local topic — passive subscription, connection lifecycle owned by `LaravelRelayRoster.start()`, same pattern as `pairing_changed`).

## Phase D — Floating Panels (done)

- [x] `apps/pycore-manager/components/PcFloatingPanel.tsx` (new global reusable modal: overlay/Esc close, footer slot). `PcAgentHistoryAiPanel.tsx` refactored onto it (grid `-m-4`, aside/main `max-h-[calc(88vh-62px)]`).
- [x] Backend: `agent_history_statistics.py` gains `read_fragment_id_pages` (DIFF ID pages, text stripped, revision = md5 of source revisions + cursor digest, `since_revision` short-circuit) and `read_fragment_page` (materialize by ids), backed by `_fragment_catalog` / `_build_fragment_catalog` (kinds: prompts / replies / processed / pending, newest first; `TOOL_FRAGMENT_PAGE_SIZE_CAP = 500`); `is_fragment_pending` extracted into `agent_history_fragments.py` and reused by `summarize_tool_fragments_many` (logic preserved verbatim, including lane-aware tuple comparison). Service delegates `read_tool_fragment_id_pages` / `read_tool_fragment_page`; `ui_service.py` exposes both routes (tool validated against `SUPPORTED_TOOLS`).
- [x] `pages/agent-history/PcAgentHistoryToolPanel.tsx` (new): kind ∈ prompts/replies/processed/pending/sessions, DIFF pagination + `PcPager`; exported `AgentHistoryToolPanelKind`.
- [x] `PcAgentHistoryToolCheckboxes.tsx`: stat buttons now call `onOpenToolHistory(tool, kind)` — 提示词→prompts, 吐字历史→replies, 已处理内容→processed, 待处理内容→pending, 会话→sessions; `PcAgentHistoryConfigPanel.tsx` prop types synced; `PcAgentHistoryPage.tsx` `handleOpenToolPanel` opens the floating panel (scroll-to-bottom jump and `listAnchorRef` removed for stats).

## Phase E — Refresh Semantics + i18n + Sweep (done)

- [x] `ui_service.refresh` extended to `invalidate_agent_history_caches()` (`agent_history_snapshot_cache` + `status_snapshot_cache`, `invalidate_prefix("agent_history.")`) + `request_extract(force=True)`, response includes `cache_invalidated`. UI `handleRefresh` force-reloads session/prompt pages bypassing `sinceRevision` (`loadSessionPage(true)` / `loadPromptPage(true)`) and bumps `statsBump` (folded into the statistics `storeRevision`) so tool cards reload fresh — no device refresh anywhere in the path.
- [x] i18n: `PcZhFeatures.ts` / `PcEnFeatures.ts` agentHistory section gains `livePromptMonitor`, `livePromptMonitorHint`; existing `close` / `promptCount` / `replyCount` / `processedRecords` / `pendingRecords` / `sessionCount` keys reused by the panel. No hardcoded language strings in new components.
- [x] Docs updated to match implementation (design §5.3 deviation note, §5.4, §8 route names; this progress doc).

## Verification Status

- [x] TypeScript: `tsc --noEmit` — zero errors across all touched UI files (the ~97 remaining repo errors are pre-existing and unrelated).
- [x] Python: `ast.parse` clean on all touched pycore files; `agent_home_scanner.scan_user_homes()` smoke-tested on Linux.
- [ ] PHP: `RelayDeviceService.php` change not linted (no php cli on this machine).
- [ ] Runtime smoke (requires the real pycore runtime, e.g. `PYTHON312_EXE_PATH` from `/var/_core_node/global_var`; the default `/usr/local/bin/python` lacks aiohttp so a full import chain cannot run here — pre-existing environment limitation, not introduced by this change):
  1. Check kimi/codex/pi/claude cards → live scan picks up a new prompt within ~5s and the card/panel updates without a page reload (both direct-SSE and Laravel-Mercure transports).
  2. Stat buttons open floating panels with working pagination; page bottom never auto-scrolls.
  3. 立即刷新 forces a rescan and fresh statistics; unchanged agents are reported as skipped in the live-scan response.
  4. Windows run covers `D:\programing\Users` and `D:\.tmp\Users` slots (Linux roots verified by smoke test).

---
Follow-up (2026-09-26): `docs_fix/FIX_20260926_AGENT_HISTORY_SCAN_CENTER_MONITOR_TRAY_NOTIFY.md`
supersedes two details of this design/progress: (1) the live-scan tool set is no longer limited
to kimi/codex/pi/claude — it derives from the extractor registry; (2) the realtime monitor toggle
is now bound to backend state (lease-based `agent_history_live_monitor` lane) instead of being a
pure UI-side poll, and the scan center covers the native Linux slot root
`<core_node_data_dir>/Users` (scripts/linuxenvs kimi1/kimi2/pi*/codex1/MyBest* slots).
