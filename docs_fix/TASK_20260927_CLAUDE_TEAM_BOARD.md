# TASK 2026-09-27 — Claude Agent Team Board (roles V2)

Roles, scopes and boundaries: `docs_fix/REQUIREMENTS_20260927_CLAUDE_AGENT_ROLES_V2.md`.
Orchestrator guide: `development-guides/claude_code/CLAUDE_CODE_AGENTS_GUIDE.md`.

Launchers:
- `claudeagents`: agent-teams mode. `ca-orchestrator` spawns the roles as teammates.
- `claudeteamup`: independent `ct-<role>` sessions that use cross-session messaging.

Common rules: permission mode `auto`. git/gh is blocked unless the user's prompt says `allow-git`. Shared files go in `.claude/agents_shared/`.

Status values:
- `open`: not started.
- `wip`: in progress.
- `blocked`: waiting on another task or on the user.
- `review`: done by the owner, waiting for `reviewer`.
- `done`: reviewed.

Only `orchestrator` edits this board; other roles report to it.

The tasks were re-assigned from the roles-V1 board on 2026-09-27. Old ids are in brackets.

## In-flight from roles V1 (running ct-* sessions)

The bug audit was started before the role change by the V1 agent-teams session `ca-lead`, through its teammates pycore-runtime, audio-tts, laravel-backend, frontend-ui, infra-shell and reviewer. The `ct-*` sessions are not running it.
- Those teammates finish it under their V1 names, and write their reports to `.claude/agents_shared/bug_audit_20260927/`.
- After the sessions are restarted with roles V2, the mapped owner takes the follow-up.

| ID | Task | V1 owner → V2 owner | Source | Status |
|---|---|---|---|---|
| L5 | Bug audit (report only). Dispatch the audit rows below, then merge the verified findings into §5 of the source doc. | lead → orchestrator | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | blocked (halted by user 02:52; 235 findings in `FIX_20260927_0252_TEAM_BUG_AUDIT.md`) |
| P5 | Bug audit, pycore-runtime scope → `pycore-runtime.md` | pycore-runtime → pycore | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | blocked (halted by user; 34 findings incl. pass-2 PR-030..037) |
| N1 | Bug audit, `ncore/`, root `main.js`/`ncore_module_caller.js`, `apps/` except mcp-chrome → `ncore.md` (split off P5) | ncore (V2 type) → ncore | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | blocked (halted by user; did not act on the stop, report ended 03:06 on an API error: 37 findings, 1 critical, 7 high) |
| A6 | Bug audit, audio-tts scope → `audio-tts.md` | audio-tts → pycore | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | blocked (halted by user; 49 findings incl. pass-2 AT-041..050) |
| B6 | Bug audit, `poly_apps/laravel_main` → `laravel-backend.md` | laravel-backend → laravel | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | blocked (halted by user; 34 findings, in-flight re-read not done) |
| U5 | Bug audit, UI and mcp-chrome → `frontend-ui.md` | frontend-ui → laravel-manager, pycore-manager, wordnew, codemart, vortex, mcp-chrome (split per app) | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | blocked (halted by user; 40 findings incl. pass-2 FU-030..042) |
| S4 | Bug audit, `scripts/`, `dd.sh`, `dd.cmd` → `infra-shell.md` | infra-shell → shell | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | blocked (halted by user; 30 findings, pass 2 not started) |
| R4 | Verify every audit finding (CONFIRMED/PLAUSIBLE/REFUTED), with the contract audit included. | reviewer → reviewer | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | blocked (halted by user; 11 RV findings; audio-tts AT-001..040 verified: 32 CONFIRMED / 8 PLAUSIBLE / 0 REFUTED; rest unverified) |
## Shared-layer writers (B2/B3 assignments)

| Path | Assigned writer | Task | Since |
|---|---|---|---|
| shared UI layer (`shell/ core/ shared/ components/ …`) | — | — | — |
| `apps/pdd-manager/` | — | — | — |

## orchestrator

| ID | Task | Source | Status |
|---|---|---|---|
| O1 [L1] | Confirm the 13-role split and this board with the user. Then dispatch the first wave: LV1, PY5, CM1, PY2, SH1. | REQUIREMENTS_20260927_CLAUDE_AGENT_ROLES_V2 | open |
| O2 [L2] | Define the W5 orchestrated-audio contract (ingest keys, listing/detail/stream shapes) before PY6, LV2 and WN1 start. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE §4 | open |
| O3 [L3] | Review the Queue Center machine authentication design (status: proposed): accept it, revise it or drop it. | DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION | open |
| O4 [L4] | docs_fix drift: mark superseded sections and point them to the authoritative docs. Start with CodeMart progress and relay V2 progress. | README.md rules | open |

## pycore

| ID | Task | Source | Status |
|---|---|---|---|
| PY1 [P1] | One shared "deliver to Laravel" layer (outbox/retry/backfill) that replaces every duplicate. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE R7/R8 | open |
| PY2 [P2] | Terminal control: portal input authorization; confirm the bridge is `active` after re-login. | REQUIREMENTS_20260927_LINUX_TERMINAL_CONTROL_WAYLAND §6 | blocked (user re-login / desktop consent) |
| PY3 [P3] | Relay V2 pycore remaining items and snapshot capture follow-ups. | PROGRESS_20260823_PYCORE_REMOTE_RELAY_V2_* | open |
| PY4 [P4] | Queue Center machine authentication, pycore side. | DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION | blocked (O3) |
| PY5 [A1] | State-driven audio orchestration and queue: close the §4 acceptance (needs LV4). | REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN | open |
| PY6 [A2] | Idempotent upload of orchestration audio with reconnect backfill, through PY1. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE R7 | blocked (O2, PY1) |
| PY7 [A3] | Python 3.10 TTS plan, engine steps 10–14 and 21. | DEBIAN13_PYTHON310_TTS_DEVELOPMENT_PLAN | open |
| PY8 [A4] | GPU/CPU unified toolchain constants. | DESIGN_20260921_GPU_CPU_UNIFIED_TOOLCHAIN | open |
| PY9 [A5] | Word audio offline queue residuals. | REQUIREMENTS_20260922_WORD_AUDIO_OFFLINE_QUEUE | open |

## laravel

| ID | Task | Source | Status |
|---|---|---|---|
| LV1 [B1] | Machine data sync protocol 5: final acceptance #13, `api.si.12gm.com` → local, idempotent; the second run shows only `unchanged`. | REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR | wip |
| LV2 [B2] | W5: idempotent orchestrated-audio ingest plus listing/detail/stream API. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE W5 | blocked (O2) |
| LV3 [B3] | CodeMart server `wip` items (funding, transitions, milestones, attachments, skills, payouts, invoices). | codemart_docs/PROGRESS_20260927_CODEMART_GAP_COMPLETION | wip |
| LV4 [B4] | Keyset and sentence listing endpoints for PY5; dict-lane residuals. | REQUIREMENTS_20260926 §5.6, DESIGN_20260922_DICT_LANE_LIVE_QUEUE | open |
| LV5 [B5] | Queue Center machine authentication, Laravel side. | DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION | blocked (O3) |

## shell

| ID | Task | Source | Status |
|---|---|---|---|
| SH1 [S1] | Installer parity for Ubuntu 26.04: xclip, wl-clipboard, x11-utils; tray/toast prerequisites. | REQUIREMENTS_20260927_LINUX_TERMINAL_CONTROL_WAYLAND R8 | open |
| SH2 [S2] | Python 3.10 / TTS installer steps 04–08 and 16–20. | DEBIAN13_PYTHON310_TTS_DEVELOPMENT_PLAN | open |
| SH3 [S3] | Maintain the claude team launchers, `claude_team_install` / `Invoke-ClaudeTeamInstall`, and the git guard. | REQUIREMENTS_20260927_CLAUDE_MULTI_ROLE_TEAM | review |

## laravel-manager

| ID | Task | Source | Status |
|---|---|---|---|
| LM1 [U3b] | Data sync UI states: cancelled, terminal retention, skipped tables. | REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR | open |

## pycore-manager

| ID | Task | Source | Status |
|---|---|---|---|
| PM1 [U3a] | Delivery status panel for PY1. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE R7 | blocked (PY1) |
| PM2 [U4] | Terminal Control page: portal authorization action and notice codes (en/zh). | REQUIREMENTS_20260927_LINUX_TERMINAL_CONTROL_WAYLAND R6/R7 | open |

## wordnew

| ID | Task | Source | Status |
|---|---|---|---|
| WN1 [U2] | W6: home entry, listing page, player page with related resources and orchestrated playback. Reuse the Walkman and daily-reading players. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE R9 | blocked (LV2) |

## codemart

| ID | Task | Source | Status |
|---|---|---|---|
| CM1 [U1] | Open items U05, U08, U12, and the UI halves of U01, U04, U07, U09, U10, U11, U13, U17, U18. | codemart_docs/PROGRESS_20260927_CODEMART_GAP_COMPLETION | open |

## vortex

| ID | Task | Source | Status |
|---|---|---|---|
| VX1 | Record the vortex (OKX sandbox/quant) scope and `VortexPycoreContract.ts` in docs_fix, with the orchestrator, before any change. | REQUIREMENTS_20260927_CLAUDE_AGENT_ROLES_V2 §1 | open |

## flutter

| ID | Task | Source | Status |
|---|---|---|---|
| FL1 | No open docs_fix task. The orchestrator assigns work from `codemart_docs/flutter_reference/` on request. | — | open |

## ncore

| ID | Task | Source | Status |
|---|---|---|---|
| NC1 | No open docs_fix task. RPC unification status: `ncore/RPC_FRAMEWORK_UNIFICATION_PLAN.md`. | — | open |

## mcp-chrome

| ID | Task | Source | Status |
|---|---|---|---|
| MC1 | No open docs_fix task. Keep the endpoints aligned with Laravel-side changes (four-end centralization). | FIX_20260814_2230_FOUR_END_ENDPOINT_CENTRALIZATION | open |

## reviewer

| ID | Task | Source | Status |
|---|---|---|---|
| RV1 [R1] | Review every `review` task against its source doc, the role boundaries and AGENTS.md. | this board | open |
| RV2 [R2] | Contract audit: `config/queue_center_contract.json` and `config/pycore_relay_contract.json` against the code. | config/*_contract.json | open |
| RV3 [R3] | First review: SH3 (launchers, shared install, git guard). | REQUIREMENTS_20260927_CLAUDE_MULTI_ROLE_TEAM | open |
