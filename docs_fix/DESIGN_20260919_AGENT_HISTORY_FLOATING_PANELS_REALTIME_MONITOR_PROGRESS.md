# PROGRESS — Agent History Floating Panels + Realtime Prompt Monitor

Date: 2026-09-19
Design doc: `docs_fix/DESIGN_20260919_AGENT_HISTORY_FLOATING_PANELS_REALTIME_MONITOR.md`
Status: Design complete — implementation pending

## Original Requirement (verbatim, preserved)

> 1：当点击提示提示词时，需要弹出悬浮页，分页显示所有提示词，当点击某个AI工具的叶字历史，己处理内容，待处理内容时，都要弹出，而不是直接跳转到页面下部，添加全局复用组件 ，2：目前pycore端改为每30秒刷递增一次，但UI增加实时监控提示词，默认勾选，勾选后每5秒扫描一下所有勾选的local Agent是否有新的提示词，搜索官方目录如何获得提示词，如果无法找到，则扫描本机，先支持kimi / codex / pi / claude 工具，同时注意，先扫描机机的kimi1 kimi2 也就是 scripts\winenvs 中的相关的脚本，了解这些agent使用出不同的用户目录的规范，添加目录扫描中心到基本类库，确保扫描时会扫描所有目录，比如 D:\programing\Users 下的目录，当前是liunx扫描并定义liunx，也就是需要扩展常量库，确保能提取取所有实时提示词，同时，定义缓存，比如一个agent没有最新修改，可以直接跳过，不用扫描，3：如果有新的提示词，立即通知UI，注意转发模型，一直接UI访问模型的通知方式，可以搜索官方，和沿用现在的代码，最大化使用larave l13 和frankenPHP的能力，如果是直接连接的UI，则直接通知。4：点立即 刷新并不是刷新device，而是实时扫描一遍所有的agent的最新数据，和所有pycore的缓存数据。以上要求先写入docs fix中的设计文档，再根据设计文档写进度文档，同时设计文档要最大按的保留 上面提示词的原文。

## Status Overview

| Phase | Scope (design ref) | Status |
|---|---|---|
| 0 | Design doc + progress doc in docs_fix | Done (2026-09-19) |
| A | Scan center + constants (design §5.1, §5.2) | Pending |
| B | Live scan lane + skip cache + UI toggle (design §5.3, §5.4) | Pending |
| C | Push notification topic end-to-end (design §6) | Pending |
| D | Floating panel + fragment endpoints + card wiring (design §4) | Pending |
| E | 立即刷新 semantics + final sweep (design §7, §9) | Pending |

## Phase 0 — Done

- Explored current implementation and grounded the design:
  - UI: `apps/pycore-manager/pages/PcAgentHistoryPage.tsx` (`handleOpenToolHistory` scroll at line 420, `handleRefresh` at line 366), `pages/agent-history/PcAgentHistoryToolCheckboxes.tsx` (stat buttons), `PcAgentHistoryConfigPanel.tsx`, `api/AgentHistoryRuntimeStore.ts`, `core/integrations/pycore/PycoreEventTopics.ts`, `PycoreHttp.ts` (SSE), `core/integrations/laravel/LaravelRealtime.ts` / `LaravelMercureConnection.ts`.
  - pycore: `pycore/pyctl/agent_history/agent_history_service.py` (`user_homes` at line 84, incremental `_extract_inner`), `tick_service.py` (env-driven intervals), `heartbeat.py`, `snapshot_cache.py`, `agent_history_statistics.py`, `ui_service.py`, extractors for kimi/codex/pi/claude.
  - Slot directory conventions: `scripts/winenvs/kimi1.ps1` / `kimi2.ps1` (`D:\.tmp\Users\Kimi1|Kimi2`, `KIMI_CODE_HOME=<profile>\.kimi-code`), `codex1.ps1` (`D:\programing\Users\Codex1`), `codex2.ps1` (`D:\.tmp\Users\MyBest*`), pi launchers + `scripts/shells/win/win_common/GlobalVars.ps1` (`PROGRAMING_USERS_DIR=D:\programing\Users`, `PI_*_USER_DIR`), `claude1.ps1` (real profile `.claude`).
  - Constants home: `pycore/pyfoundations/system_paths.py`.
  - Relay/realtime: `config/pycore_relay_contract.json`, `poly_apps/laravel_main/app/Services/Realtime/RealtimeOutboxPublisher.php`, `MercurePublisher.php`, `app/Apps/Relay/RelayServices/RelayHubService.php`.
- Wrote the design doc preserving the original prompt text verbatim (design §1).

## Phase A — Scan Center + Constants (pending)

- [ ] Add `AGENT_HISTORY_USERS_ROOTS_WINDOWS` / `AGENT_HISTORY_USERS_ROOTS_LINUX` / `AGENT_HISTORY_OFFICIAL_HOME_MARKERS` to `pycore/pyfoundations/system_paths.py`, env override `PYCORE_AGENT_HISTORY_USERS_ROOTS`.
- [ ] Add `pycore/pyfoundations/agent_home_scanner.py` (`scan_user_homes()`), one-level glob under each users-root.
- [ ] Rewire `agent_history_service.user_homes()` to delegate to the scan center.

## Phase B — Live Scan Lane + UI Toggle (pending)

- [ ] `agent_history_service.live_scan(tools)` scoped discovery, tools ∩ {kimi, codex, pi, claude}.
- [ ] Per-tool skip cache in `VersionedSnapshotCache` (`agent_history.live_scan.` prefix).
- [ ] Heartbeat callback `agent_history_live_scan` (`PYCORE_AGENT_HISTORY_LIVE_SCAN_INTERVAL`, default 5s), idle unless monitored.
- [ ] Route `agent_history.live_scan` in `ui_service.py` + `local_agent_history_routes.py` + `PycoreHttpRoutes.ts` + `pycoreApi` wrapper.
- [ ] 实时监控提示词 checkbox (default ON) in `PcAgentHistoryPage.tsx`, persisted in `AgentHistoryUiStateStore`.

## Phase C — Push Notification (pending)

- [ ] `BusSignals.AGENT_HISTORY_PROMPT_NEW` in `thread_bus_constants.py`; emit on new prompts from extract/live scan.
- [ ] Topic `agentHistoryPromptNew: 'agent_history.prompt.new'` in `PycoreEventTopics.ts`; page/store subscriptions (debounced, revision-gated).
- [ ] Laravel forwarding: relay intake → `RealtimeOutboxPublisher` / `MercurePublisher` → FrankenPHP Mercure hub → `LaravelMercureConnection`; contract entries in `QueueCenterContract` (PHP + TS).

## Phase D — Floating Panels (pending)

- [ ] `components/PcFloatingPanel.tsx` global reusable modal; refactor `PcAgentHistoryAiPanel` modal onto it.
- [ ] Backend `read_tool_fragment_pages` on `AgentHistoryStatistics` + routes `agent_history.tool_fragment_id_pages` / `agent_history.tool_fragment_page`.
- [ ] Rewire `PcAgentHistoryToolCheckboxes` stat buttons to open the floating panel (prompts / replies / processed / pending / sessions kinds); remove the scroll-to-bottom jump for stats.

## Phase E — Refresh Semantics + Sweep (pending)

- [ ] Extend `ui_service.refresh`: force full extract + invalidate `agent_history.*` snapshot caches; UI bypasses `sinceRevision` on manual refresh.
- [ ] i18n keys (zh + en), sweep stale comments/docstrings describing the old scroll/refresh behavior.

## Verification Plan (when implementation lands)

1. Check kimi/codex/pi/claude cards → live scan picks up a new prompt within ~5s and the card/panel updates without a page reload (both direct-SSE and Laravel-Mercure transports).
2. Stat buttons open floating panels with working pagination; page bottom never auto-scrolls.
3. 立即刷新 forces a rescan and fresh statistics; unchanged agents are reported as skipped in the live-scan response.
4. Linux run: roots from `AGENT_HISTORY_USERS_ROOTS_LINUX` (+ env override) are scanned; Windows run covers `D:\programing\Users` and `D:\.tmp\Users` slots.
