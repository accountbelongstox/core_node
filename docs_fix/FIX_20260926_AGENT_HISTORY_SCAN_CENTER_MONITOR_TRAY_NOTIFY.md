# FIX 20260926 — Agent History: Scan-Center Linux Roots, Backend-Bound Realtime Monitor, Tray Notification

Date: 2026-09-26
Status: Implemented (verification below)
References: `docs_fix/DESIGN_20260919_AGENT_HISTORY_FLOATING_PANELS_REALTIME_MONITOR.md`,
`docs_fix/DESIGN_20260919_AGENT_HISTORY_FLOATING_PANELS_REALTIME_MONITOR_PROGRESS.md`,
`docs_fix/FIX_20260919_2137_AGENT_HISTORY_PROMPT_NEW_LOGGING.md`,
`docs_fix/TASK_20260920_PROMPT_DERIVE_EN_TRAY_TOAST_SOUND.md`,
`docs_fix/PROGRESS_20260920_PROMPT_DERIVE_EN.md` (B6 tray awareness / B7 toasts / B8 sound)

---

## 1. Original Requirement (verbatim, preserved)

> 找到这佧UI界面，本机的pycore-,amager,注意这是与pycore绑定的前端，现在，全面查找Realtime prompt monitor功能 ，1：功能在勾选时是否与后端状态绑定，并能实时切换 ，2：为什么没有按之前的开发要求，弹出WEB菜单的TRAY通知，有新提示詡时，3：实际扫描本机的kimi1 kimi2 kimi$index kimiyolo等 脚本，推导其中的各个用户自定义目录，liunx和windows的平台下自动获取新的提示诩，当然还要同时修复和推导codex/claude等，pi/corsor/gemini等等，自动获得新的提示詡，4：如果发现问题底层重构，不要小修小补，同时搜索官方文档完成，5：搜索docs fix中的旧文档 ，找到合理的内容 更新和参考。

## 2. Field Scan — Grounded Findings (this machine, 2026-09-26)

### F1 — Linux native slot root missing from the scan center (root bug for kimi1/kimi2/pi*)

`scripts/linuxenvs/kimi1.sh` / `kimi2.sh` isolate `HOME` to `/var/_core_node/Users/Kimi1|Kimi2`
(fallback `$HOME/.kimi_slots/KimiN`); `codex1.sh` uses `/var/_core_node/Users/Codex1` with
`CODEX_HOME`; `claude6/9.sh` + `codex2.sh` auto-scan `/var/_core_node/Users/MyBest*`; the pi
launchers resolve `PI_*_USER_DIR` from `gvar_system_common.sh`:
`PROGRAMING_USERS_DIR="$CORE_NODE_DATA_DIR/Users"` (PiYolo / PiKimi / PiClaudeCode / PiCodex /
PiVolcAgent / PiVolcCoding). `kimiyolo.sh` uses the REAL `$HOME/.kimi-code`.

On this machine `/var/_core_node/Users` (symlink → `/www/www/core_node/Users`, i.e.
`<core_node_data_dir>/Users`) holds `Kimi1, Kimi2, PiYolo, PiVolcAgent, PiVolcCoding` with live
`.kimi-code` session data — but `AGENT_HISTORY_USERS_ROOTS_LINUX = ('/home', '/root')` never
listed it. The scan center only picked up the Windows data disk
(`/mnt/*/programing/Users`, `/mnt/*/.tmp/Users` via `get_shared_windows_users_roots`) plus the
process's own home. Result: **native-Linux slot prompts (kimi1/kimi2/pi*/codex1 slots) were
invisible to extraction** unless pycore itself ran inside that slot.

### F2 — Realtime monitor toggle was NOT bound to backend state

`livePromptMonitor` lived only in the UI store (`AgentHistoryUiStateStore`); the backend kept no
monitor state. The 5s scan existed only as UI polling of `ui/agent_history/live_scan` with a
server throttle. Closing the page silently downgraded monitoring to the 10s heartbeat; a second
UI racing the throttle got `{throttled: true}` and never scanned; the backend could not report
whether any monitor was active. Toggling took effect only through the UI poll loop.

### F3 — Live scan hard-limited to 4 tools on BOTH ends

`AGENT_HISTORY_LIVE_SCAN_TOOLS = ('kimi','codex','pi','claude')` in `system_paths.py` and a
duplicate `LIVE_SCAN_TOOLS = {kimi, codex, pi, claude}` hardcoded in `PcAgentHistoryPage.tsx`.
Cursor / Gemini / Antigravity / Cline / generic-agent were never live-scanned even though the
descriptor-diff mechanism (`mtime:bytes`) is tool-agnostic.

### F4 — Marker table incomplete + dead code

`AGENT_HISTORY_OFFICIAL_HOME_MARKERS` covered only kimi/codex/pi/claude, so the
root-as-home detection (`_all_marker_dirs`) could not recognize a users-root that itself carries
`.cursor` / `.gemini`. `official_tool_homes()` in `agent_home_scanner.py` was dead since
creation (no callers).

### F5 — No tray notification on new prompts (requirement regression vs TASK 20260920 B6/B7)

Desktop toast + sound fired ONLY from `prompt_derive_service` — Linux-only, capped at 3
prompts/event, and ONLY after a successful OpenRouter derivation. Any derive failure/quota
exhaustion, any prompt beyond the cap, and every Windows host got NO surface notification. The
tray menu knew the feature only via the sound toggle. Nothing subscribed
`AGENT_HISTORY_PROMPT_NEW` for a tray/desktop notification.

## 3. Official-Spec Basis (see §7 sources)

| Tool | Official home / env | Session layout used by the extractor |
|---|---|---|
| Kimi Code | `KIMI_CODE_HOME`, default `~/.kimi-code` (legacy `~/.kimi`) | `sessions/<wd>/<id>/wire.jsonl`, `user-history/*.jsonl` |
| Codex CLI | `CODEX_HOME`, default `~/.codex` | `sessions/**/rollout-*.jsonl`, `history.jsonl` |
| Pi | `~/.pi` (`PI_CODING_AGENT_SESSION_DIR` override) | `.pi/agent/sessions/**/*.jsonl` |
| Claude Code | `CLAUDE_CONFIG_DIR`, default `~/.claude` | `projects/<slug>/*.jsonl`, `history.jsonl` |
| Gemini CLI | `~/.gemini` | `tmp/<project>/{logs.json,chats/session-*.json,checkpoints/*.json}` |
| Cursor | `~/.cursor` | `projects/<slug>/agent-transcripts/**/*.jsonl` |
| Antigravity | `~/.gemini/antigravity` | `brain/<id>/*` artifacts |
| Cline | VS Code `globalStorage` | `*/tasks/*/api_conversation_history.json` |

Linux desktop notifications: freedesktop Notifications spec — `notify-send` (libnotify) is the
canonical CLI; AppIndicator/Ayatana SNI itself cannot display bubbles (verified against the SNI
interface XML: only icon/tooltip/menu + activation methods, no notification method), so the tray
layer delegates to the notification daemon. Windows: `Shell_NotifyIcon` balloon (`NIF_INFO`) on
the owned icon (legacy but shell-rendered as a toast on Windows 10+); the Qt backend uses
`QSystemTrayIcon.showMessage` (already implemented as `PySide6SystemTray.show_message`).

Sources (fetched 2026-09-26):
- Kimi Code: `MoonshotAI/kimi-code` docs `configuration/data-locations.md` + `env-vars.md`
  (`KIMI_CODE_HOME`, `~/.kimi-code`, `sessions/<wd>/<id>/agents/main|agent-*/wire.jsonl`,
  `user-history/<md5>.jsonl`).
- Codex CLI: `openai/codex` `codex-rs/core/src/config/mod.rs` (`CODEX_HOME`, `history.jsonl`),
  `codex-rs/rollout/src/recorder.rs` + `lib.rs` (`sessions/YYYY/MM/DD/rollout-*.jsonl`,
  `archived_sessions` — now covered by the extractor).
- Claude Code: code.claude.com docs `claude-directory` + `env-vars` (`CLAUDE_CONFIG_DIR`,
  `~/.claude/projects/<slug>/*.jsonl`, `history.jsonl`).
- Gemini CLI: `google-gemini/gemini-cli` `packages/core/src/utils/paths.ts` (`GEMINI_CLI_HOME` —
  implemented but undocumented; added to the marker table), `docs/cli/session-management.md`
  (`~/.gemini/tmp/<project_hash>/chats/`).
- Cursor: NO official docs for transcript paths; the extractor's
  `~/.cursor/projects/<slug>/agent-transcripts/**.jsonl` + `state.vscdb` fallback matches
  community-verified evidence (forum thread 158251, jazzyalex agent-sessions guide).
- Cline: VS Code `globalStorage` per-OS paths (code.visualstudio.com portable/data docs).
- freedesktop Desktop Notifications spec v1.3; MS Learn NOTIFYICONDATA/`Shell_NotifyIcon`
  (NIF_INFO); Qt `QSystemTrayIcon.showMessage`.

## 4. Refactor (root-level, not patches)

### R1 — Scan center covers the native Linux slot root (`agent_home_scanner.py` / `system_paths.py`)

- New `agent_history_slot_users_roots()` in the scan center: `<core_node_data_dir>/Users`
  (via `core_node_dirs.get_core_node_data_dir()`, mirroring
  `gvar_system_common.sh PROGRAMING_USERS_DIR="$CORE_NODE_DATA_DIR/Users"`), the legacy
  `/var/_core_node/Users`, and the kimi-script fallback `~/.kimi_slots`. Probed with `is_dir`,
  deduped by realpath inside `scan_user_homes`, env override unchanged.
- `AGENT_HISTORY_OFFICIAL_HOME_MARKERS` extended: cursor (`.cursor`), gemini (`.gemini`),
  antigravity (`.gemini`), cline (`.vscode`), agent (`.agent`) — marker scan now recognizes any
  tool-carrying root as a home.
- Dead `official_tool_homes()` removed (env-override resolution already lives in
  `AgentHistoryService._live_scan_homes`).

### R2 — Live scan covers every extractor (one source of truth)

- The hardcoded `AGENT_HISTORY_LIVE_SCAN_TOOLS` constant was REMOVED; the supported set now
  derives from the extractor registry (`AgentHistoryService._live_scan_supported_tools()`), so a
  new extractor is live-scannable with zero extra wiring.
- The UI no longer hardcodes a tool subset (`LIVE_SCAN_TOOLS` deleted): it sends all checked
  tools; the backend intersects with the registry.

### R3 — Backend-bound monitor state with lease (realtime switch)

- `tick_service` owns the authoritative monitor state `{enabled, tools, lease_until}`.
  `ui/agent_history/live_scan` now accepts `{enabled?, tools?}`: a request carrying `enabled`
  binds the backend state (lease = 3 × scan interval, renewed by every UI poll); a request with
  `enabled: false` stops the lane immediately — the toggle switches in real time.
- New heartbeat callback `agent_history_live_monitor` (interval = live-scan interval) runs the
  scan through the same serialized extract gate while the lease is valid — scanning continues
  within the lease even if a single UI poll drops, and stops automatically ~15s after the UI
  closes. No UI → no lane (the 2026-09-19 design invariant is preserved).
- `get_status_snapshot()` exposes `monitor` so any UI can reflect the backend state; the
  live-scan response echoes the bound state.

### R4 — Tray / desktop notification on every new prompt (both platforms)

- New shared module `pycore/pyutils/desktop/system_notification.py`:
  `show_system_notification(title, message)` — Linux: `notify-send` (freedesktop) when a
  display/session exists; Windows: THREAD_BUS `tray.show_notification` handled by the Qt tray
  (`PySide6SystemTray.show_message`) and the Win32 backend (`Shell_NotifyIcon` NIF_INFO balloon);
  universal fallback: the existing tkinter `toast_stack`. Never raises, headless-safe.
- New `pycore/pyctl/agent_history/prompt_notify_service.py`: subscribes
  `BusSignals.AGENT_HISTORY_PROMPT_NEW` (the same single choke point as the color log line) and
  pops one aggregated notification per event (agent names + count + newest snippet). Runs on
  Windows AND Linux; independent of the AI-derive path (derive failures no longer silence the
  notification). Config flag `prompt_new_notify` (default true) in
  `config/agent_history.settings.json` + `pipeline/config.py` save whitelist.
- Tray menu gains a toggle item (`tray_action_toggle_prompt_new_notify`, both platforms) next to
  the existing sound toggle; i18n key `tray.menu.prompt_new_notify`; handler in
  `pycore/pyctl/runtime/event_handlers.py` flips the same config flag and rebuilds the menu.
- Win32 backend learns a balloon (`_show_balloon`) via `NIM_MODIFY | NIF_INFO`; Qt bridge listens
  to `tray.show_notification` and marshals onto the Qt thread.

## 5. Files Touched

- `pycore/pyfoundations/system_paths.py` — marker table + live-scan tool set extended.
- `pycore/pyfoundations/agent_home_scanner.py` — native Linux slot roots; dead code removed.
- `pycore/pyctl/agent_history/tick_service.py` — monitor state + lease + live-monitor lane.
- `pycore/pyctl/agent_history/heartbeat.py` — `agent_history_live_monitor` callback.
- `pycore/pyctl/agent_history/ui_service.py` — `live_scan` accepts `{enabled, tools}`.
- `pycore/pyctl/agent_history/agent_history_service.py` — live-scan tools derive from the
  extractor registry (no second hardcoded list).
- `pycore/pyutils/desktop/system_notification.py` (new), `toast_stack.py` reused as fallback.
- `pycore/pyctl/agent_history/prompt_notify_service.py` (new); started from the runtime boot.
- `pycore/pyutils/native_ui/step5_main_ui/pyside6/thread_bus_bridge.py` — `tray.show_notification`.
- `pycore/pyutils/native_ui/step6_tray/win32_system_tray.py` — NIF_INFO balloon + handler.
- `pycore/pylauncher/tray_menu.py`, `pycore/pyctl/runtime/event_handlers.py` — notify toggle.
- `config/agent_history.settings.json`, `pipeline/config.py` — `prompt_new_notify` flag.
- `pycore/pyutils/native_ui/step0_i18n/i18n_keys.py` + `translations_{en,zh,ja}.json`.
- UI: `PcAgentHistoryPage.tsx` (toggle binds backend, no hardcoded tool subset),
  `PycoreApiLocal.ts` / `PycoreSpeechTypes.ts` (`enabled` param + monitor state types).

## 6. Compatibility & Invariants

- Windows + Linux simultaneously; all new roots probed, never assumed.
- Extract lane serialization (`_ExtractGate` / `_EXTRACT_QUEUE`) unchanged — the monitor lane
  joins the same queue; a 10s heartbeat extract and a 5s monitor scan never parse concurrently.
- Skip cache (`_live_scan_descriptors`, state-seeded) unchanged; unchanged tools never open files.
- Old UIs polling `live_scan` without `enabled` keep working (throttle path preserved).

## 7. Verification (2026-09-26, this machine)

- `python3 -m py_compile` on all 15 touched Python files: PASS; 4 JSON files parse.
- `scan_user_homes()` smoke: now includes `/var/_core_node/Users/{Kimi1,Kimi2,PiYolo,
  PiVolcAgent,PiVolcCoding}` (symlink-resolved to `/www/www/core_node/Users/*`, deduped) —
  previously only the process's own slot home was visible. 57 homes total.
- Monitor binding smoke (in-process, real service singletons): `live_scan {enabled:true}` binds
  `{enabled:true, lease 15s}` and queues a scan; the heartbeat lane `tick_live_monitor` picks up
  the lease on its own and shares the 5s cadence with UI polls (no double scan);
  `{enabled:false}` stops the lane immediately (busy stays False). Legacy requests without
  `enabled` keep the throttle behavior.
- Route handler `ui_service.live_scan` verified for both payload shapes.
- Notification watcher smoke: `start_prompt_notify_service` + a synthetic
  `AGENT_HISTORY_PROMPT_NEW` event dispatches without error (toast thread live on this desktop).
- Live scan after the scan-center fix detected and parsed the previously invisible slot sources
  (cursor/kimi/codex changed on first pass, as expected for the widened scope).
- UI `tsc --noEmit`: zero errors in touched files (95 pre-existing repo errors unchanged).
- NOT done here: a second full pyservice instance cannot boot alongside the running one
  (pre-existing shared-SQLite `database is locked` in `laravel_audio_worker` import, unrelated to
  this change). The running pyservice must be restarted to load this code; the vite dev server
  hot-reloads the UI changes automatically.

---

## 8. Added Requirement (2026-09-26, verbatim)

> 目前的提示，需要 提示提示诩的一部份，固定 的长度，使用省略号。

(The new-prompt notification must show only a fixed-length part of the prompt, with an
ellipsis.)

Implemented in `pycore/pyctl/agent_history/prompt_notify_service.py`: the notification body
shows only the first `PROMPT_EXCERPT_LEN = 50` characters of the newest prompt (whitespace
collapsed), with the ellipsis `…` appended when truncated — `_fixed_excerpt()` is the single
helper, so the full prompt text never appears in tray/desktop notifications. Verified:
`'word ' * 40` → `'word word word word word word word word word word…'` (50 chars + ellipsis).

---

## 9. Added Requirement (2026-09-26, verbatim)

> 注意目前实测kimi有些提示诩扫描 为ai的输出，而不是输入的提示记事。继续扫描 。

(Real-world check: some kimi "prompts" were actually AI output, not the human-typed prompt.
Keep scanning.)

### Root cause

Kimi Code sessions keep one wire file per agent: `agents/main/wire.jsonl` for the main agent
and `agents/agent-<id>/wire.jsonl` for each subagent spawned via the Task tool. The subagent
wire's `turn.prompt` / `turn.steer` records are the task text the main agent dispatched to the
subagent — an AI artifact, not human input. `KimiExtractor._parse_wire()` flagged these files
(`hasSubagent`) but still fed their `turn.prompt` text into the session `prompts` list, so
AI-dispatched task text surfaced in the UI as user prompts.

Claude sessions have the same shape: `isSidechain: true` user entries are the task input a
subagent received. `ClaudeExtractor._parse_session()` appended them to `prompts` too (no local
sidechain sample existed, but the code path was identical).

### Fix (pycore/pyctl/agent_history)

- `kimi_extractor.py`: subagent wires (`is_sub`) keep their user turns in `turns` (transcript
  completeness) but no longer append to `prompts`.
- `claude_extractor.py`: sidechain (`is_side`) prompt-kind entries likewise keep the turn but
  skip `prompts`.
- `agent_history_service.py`: `EXTRACTOR_SCHEMA_REVISION` bumped to `2026-09-26.1`, forcing a
  full store rebuild so already-persisted wrong prompts are purged (merge logic keeps
  known-ids, so no prompt-new events are re-emitted).
- Codex / Cursor / Gemini / others: audited — they have no subagent wire concept, or
  `role=user` is always the human; unchanged.

### Verification

- 3 subagent wires under `/var/_core_node/Users/Kimi2/.kimi-code/sessions/*/*/agents/agent-*/`
  now yield **0** prompts (previously each yielded its dispatched task text); all 38 main
  wires keep their prompts (38/38).
- `py_compile` passes for the three touched files.

---

## 10. Added Requirements (2026-09-26, verbatim)

> 注意，以上可能并没有完成，扫描并完成代码，如果有问题底层重构，同时新增加问题  目前实测kimi有些提示诩扫描 为ai的输出，而不是输入的提示记事。继续扫描 。  claude code的也没有提示新提示诩。

> 同时支持 windows和liunx,对于已经完整支持 的 系统和版本在代码中说明清楚，同时知道每个脚本有不同的自定义用户目录，并在常量库中统一定义，注意不要重复多处定义代码。同时，从底翅查看UI和pycore的状态绑定有那些问题，底层重构，注意是对整系统。

## 11. Root Causes (field-verified on this machine)

| # | Symptom | Root cause |
|---|---|---|
| G1 | Kimi "prompts" that are AI text | Wire protocol 1.5 tags user-role records with `origin.kind`; only `user` is typed input. `system_trigger` (subagent task written by the main AI), `task` (background-task notifications) and `injection` (system reminders) were all counted as prompts. §9's `is_sub` skip covered only the first. |
| G2 | Codex/Claude injected text as prompts | `# AGENTS.md instructions for …`, `<environment_context>`, `<local-command-caveat>`, `<task-notification>` recorded under the user role. |
| G3 | Claude new prompts not detected | (a) pycore runs as `debian` (`sudo -u debian`), `/root` is mode 700 → `/root/.claude` unreadable, silently skipped. (b) Prompts typed while a turn runs are stored only as `attachment.type=queued_command` (Claude Code 2.1.283), never as `user` entries. (c) Prompt ids were index-based (`session#i`): a trimmed/rotated `history.jsonl` or a filtered earlier prompt makes a genuinely new prompt inherit a known id → never "new". |
| G4 | Every prompt indexed twice | `/www/programing` is a bind mount of `/mnt/<disk>/programing` (same st_dev/st_ino); realpath dedup cannot see bind mounts. 57 homes → 31 after identity dedup. |
| G5 | Launcher slot dirs defined in several places | Linux/Windows roots split between `system_paths`, `agent_home_scanner` literals, pipeline `SUPPORTED_TOOLS` and the UI's `AGENT_HISTORY_TOOLS`. |
| G6 | UI ↔ pycore state not bound | Monitor switch lived in localStorage (two tabs fought over the lease); no config-changed push (tray edits invisible to UI, UI edits invisible to tray); stale runtime snapshot reverted optimistic saves; throttled replies re-applied the previous scan's `changed`; `prompt_new_notify` had no UI; env override `PYCORE_AGENT_HISTORY_ENABLED` not reflected; `reference_lang/target_lang/live_listen` blindly overwritten by the UI. |

## 12. Refactor

- **Constants (single table, `pycore/pyfoundations/system_paths.py`)**: `AGENT_SLOT_USERS_ROOTS` (per-platform users-roots) + `AGENT_LAUNCHER_SLOT_PROFILES` (every `scripts/winenvs/*.ps1` / `scripts/linuxenvs/*.sh` launcher → tool, root, slot) + `AGENT_HISTORY_OFFICIAL_HOME_MARKERS` now also carries `platforms` and `verified` format versions (Kimi wire 1.5, Codex CLI 0.155.0, Claude Code 2.1.283, Pi session v3, …) and its key order is the UI display order. `AGENT_HISTORY_INJECTED_PROMPT_PREFIXES` is the one harness-text filter.
- **Scan center**: roots derived only from the table; homes deduped by `(st_dev, st_ino)`; `unreadable_user_homes()` reported in store status, runtime and a startup warning; Python 3.13-safe `os.path` probes.
- **Extractors**: Kimi filters by `origin.kind`; Claude adds `queued_command` attachments, honors `isMeta`/`origin.kind`, dedupes the same prompt recorded both ways; Codex marks injected user text as `system`; the service applies the shared injected filter to every extractor.
- **Prompt ids**: content-stable `session#sha1(ts|text)[:12]` (+`-n` for duplicates); edits keyed by legacy index ids still apply once. A schema rebuild (`2026-09-26.2`) is a new baseline and emits no prompt-new events.
- **Binding**: `BusSignals.AGENT_HISTORY_CONFIG_CHANGED` (relayed over HTTP events) fires on any user-facing key change; the runtime store applies the pushed config directly, and a mutation sequence guard drops snapshots requested before the latest save. The tray menu refreshes from the same event (single path). The monitor is the persisted `live_prompt_monitor` key + a UI presence lease (`release` on unmount, `poll_interval` served by the backend, `scan_seq` on results). The tool list, support matrix, unreadable homes and env override come from `ui/agent_history/runtime_get`. `min_raw_words` is clamped by the backend.

## 13. Open item (needs an operator decision)

pycore cannot read `/root` while it runs as `debian`, so prompts of agents started as root (this Claude Code session, `/root/.kimi-code`) are still not scanned. Fix one of: run agents as the desktop user, run pycore as root, or grant read access, e.g. `setfacl -m u:debian:x /root && setfacl -R -m u:debian:rX /root/.claude /root/.kimi-code && setfacl -R -d -m u:debian:rX /root/.claude /root/.kimi-code`. The UI now shows the unreadable homes.

## 14. Verification (2026-09-26)

- `py_compile` on all touched Python files: PASS. UI `tsc --noEmit`: 95 errors, all pre-existing, none in touched files.
- Scan center as `debian`: 31 homes (was 57), `unreadable_homes = ['/root']`.
- Kimi: 54 wires → 178 prompts = exactly the `origin.kind=user` records; 0 prompts starting with injected tags.
- Claude (this session file): 3 prompts, including the mid-turn `queued_command` one; `/model` caveat/command entries excluded.
- Monitor: poll → `present/active=true, lease 15s`; `release` → `present=false`.
- The running pyservice (started 21:36) must be restarted to load this code.

---

## 15. Added Requirement (2026-09-26, verbatim)

> pycore cannot read these user homes (permission), so their agent prompts are not scanned:/root 目前在root下的也没有，测试在kimi2中实际输入提示诩测试，kimi1 kimi2,cladeteam 等 测试。同时root可以 扫描 其他用户，有些用户不是real用户比如git,在底层统一常库中定义，同时以上开发要求追加到文档 。

(Root's agent prompts must be scanned too; test by actually entering prompts in kimi1 / kimi2 /
claudeteam etc.; root may scan every other user; non-real (system/service) accounts such as
`git` are excluded, defined once in the base constants library.)

### 15.1 Findings

- The service is launched by root, but `scripts/shells/linux/common/pyservice_entry.sh` hands the
  worker to the desktop user (`exec sudo -u "$DESKTOP_USER" …`, needed so the tray can register
  on that user's D-Bus session bus). The running worker is therefore uid `debian`, not root.
- Agents run as root (kimi1/kimi2/claudeteam, this Claude Code session) create session files
  `root 0600`. The data disk (ntfs3) stores Linux ownership, so even slot dirs such as
  `/var/_core_node/Users/Kimi2` → `/www/www/core_node/Users/Kimi2` get unreadable new files.
  Live test: `kimi -p "... AHTEST-KIMI2-230513"` in the Kimi2 slot was written as `root 0600`;
  the `debian` worker saw the change but could not open the file → no prompt.
- Same extraction run with root read access (scratch store): the Kimi2 marker and root's Claude
  prompts (incl. a new prompt from another live Claude session) were detected; 910 sources,
  full rebuild 13.3 s, incremental ≈1 s.
- Extract-lane starvation: continuous live scans (UI poll + monitor lane, 2–5 s each while Claude
  sessions keep changing) kept `_extract_busy` set, and the 10 s extract tick returned without
  work (`extract_count` stayed 0). Fixed: a skipped tick marks `_extract_pending`; the lane
  holder runs it before releasing.

### 15.2 Implemented

- `system_paths.py`: `AGENT_HISTORY_HUMAN_UID_MIN`, `AGENT_HISTORY_NOLOGIN_SHELLS`,
  `AGENT_HISTORY_NON_HUMAN_USERS` (git, gitlab-runner, postgres, www-data, … and Windows
  Public/Default/…), `AGENT_HISTORY_NON_HUMAN_SUFFIXES` (`$` machine accounts).
- `agent_home_scanner.is_human_account()`: name/suffix list plus the passwd rule
  (uid 0, or uid ≥ UID_MIN with a login shell); applied to every users-root child.
  Verified: git/postgres/`DESKTOP-1L9K06N$` excluded; root/debian/slots kept.
- `tick_service`: extract-lane starvation fix (above).

### 15.3 Open decision: how the worker reads root-owned sessions

A change to `pyservice_entry.sh` to keep only `CAP_DAC_READ_SEARCH` (a read-only permission
bypass) when dropping to the desktop user was blocked by the assistant's security policy; it
needs the operator's decision. Options:
1. Keep the read-only capability on the desktop worker (`setpriv --reuid … --ambient-caps
   +dac_read_search`): tray keeps working, the scanner reads every user.
2. Run the worker as root (the headless path): all users readable, but no tray.
3. Run the agents as the desktop user.
(ACLs do not work: agents create files with mode 0600, so the ACL mask on new files is `---`.)
