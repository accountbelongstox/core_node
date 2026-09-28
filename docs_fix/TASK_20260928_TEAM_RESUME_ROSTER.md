# Team resume and roster (2026-09-28)

## User task

Orchestrator session `ca-orchestrator` started in independent-sessions mode (task list `core-node-team`): read `development-guides/claude_code/CLAUDE_CODE_AGENTS_GUIDE.md`, confirm the `ct-<role>` roster, wait for the user's task.

## Outcome

- Running: 28 local `ct-*` sessions (tmux `core-node-team`) + `ct-laravel-remote` (Remote Control).
- Not running: `reviewer`, `ncore`, `flutter` (catalog service roles, `window: false`; spawned in-process on demand). `pycore-gpu-remote` is disabled in the catalog.
- Other sessions: `ca-orchestrator [f2f514]` (Remote Control, idle), `[a0b003]` (offline); not used.
- Uncommitted rework (2026-09-27 22:22-22:28, 47 files: guide, agents, hooks, settings, catalog, launchers) has no docs_fix record. The guide is now 98 lines (no §8/§10), reviews optional; `settings.json` has no TaskCompleted hook; catalog `reviewer.enabled=false`.

## Decisions

| ID | Decision | Reason |
|---|---|---|
| R1 | Completion gate follows the user's launch prompt: a task completes only with an approved verdict (group leader for member work; in-process `reviewer` for a leader's own work and cross-group changes). | Direct user instruction for this session overrides the unrecorded guide change; no hook enforces it now. |
| R2 | Default writer for a path covered by both a D22 roster member and a pre-D22 alias session is the roster member (`config/claude_team_roles.json` groups). Alias sessions write only when named as temporary writer in a task. Map: `laravel-qyapp`→`wordnew-laravel`; `ui-wordnew`→`wordnew-ui`; `ui-codemart`→`codemart-ui`; `laravel-codemart`→`codemart-laravel`; `mcp-chrome`→`wordnew-link`; `ui-pycore-manager`/`ui-laravel-manager`/`ui-vortex`→`pycore-ui`; `laravel`/`laravel-api`→`pycore-laravel`; `pycore`/`pycore-architect`→`pycore-lead`; `pycore-assist`→`pycore-runtime`. | One writer per path; the roster members hold the post-D22 history (reviews name them as successors). |
| R3 | `pycore/pyctl/agent_history/` writer: `pycore-runtime`. `PathMapper.php` (app/Providers) writer: `pycore-laravel` (matches d30 audit). | R2. |
| R5 | Per-app Laravel language files have a standing writer: `lang/{en,zh_CN}/codemart.php` → `codemart-laravel` (includes the pending zh glossary pass); `lang/{en,zh_CN}/app_qy_v1.php` → `wordnew-laravel`. All other `lang/` files → `pycore-laravel`. | Each file holds only one app's keys, and every change to that app adds keys. Proposed by ct-laravel; closes the gap of codemart-laravel writing there in G1/D7 with no writer record. |
| R4 | Carried backlog from the previous run stays on hold until the user's next task; leaders may finish verdicts already in progress. No unrequested tests/builds/probes. | User: wait for the task; AGENTS.md. |

## Carried backlog (source: `.claude/agents_shared/reports/`)

- pycore: `pycore-runtime-D7P2-fix` B1-B6 → pycore-runtime; `shell-windows-3-fix` round 2 → pycore-runtime; `system_paths.py` tool-root lockstep (pycore-lead); `pycore-ai-B1-adopt` gated on D7P2-fix; pycore-ui-G1 verdict (pycore-lead).
- wordnew: B2 writers for `build_apk.py` + four G2 files (recommended wordnew-native); WNL-02 route_policies; `lang/app_qy_v1.php` hand-back; pycore-laravel cross-scope items; native-G2/link-G2 verdicts (tasks #1-#3).
- codemart: cmdesign-03 rest, d9-01-ui, cmgap-R1(-ui), CMDES-08, cmcont-11, codemart-G3; zh glossary writer; pycore-laravel referrals.
- laravel (→ pycore-laravel per R2): McpV1Initializer status-file skip (srv-06 p2), PathMapper → `service_contract.json#paths`, LB-034 i18n; laravel-remote server steps after CodeSync.
- shell: no verdict yet for the committed D24-D30 `mount_common.sh` block (SPL-114/117/121/122, written by a prior shell-linux session under its fenced lane, per reports/shell-linux.md) or for shell-linux-G2 (SPL-123/124/125: git_sync_common.sh, main_execution.sh, gitput_repository_state.sh). Verdict by shell-windows, the shell group leader. `shell-linux-12` round 2 is with shell-windows. e9-follow-a/b/c wait for the drive_layout freeze to lift.
- orchestrator: RV-004 delete `stream_events` from `config/queue_center_contract.json` (no UI reader left).
