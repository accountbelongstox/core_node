# TASK 2026-09-27 — Claude Multi-Role Team Board

Requirements: `docs_fix/REQUIREMENTS_20260927_CLAUDE_MULTI_ROLE_TEAM.md`.
Launchers:
- `claudeagents`: the official agent-teams mode. Lead `ca-lead` spawns the roles as teammates.
- `claudeteamup`: independent `ct-<role>` sessions that use cross-session messaging.

Both live in `scripts/linuxenvs/*.sh` and `scripts/winenvs/*.ps1`. Permission mode is `auto`. git/gh is blocked unless the user's prompt contains `allow-git`. Shared files go in `.claude/agents_shared/`.

Status values:
- `open`: not started.
- `wip`: in progress.
- `blocked`: waiting on another task or on the user.
- `review`: done by the owner, waiting for `reviewer`.
- `done`: reviewed.

Only `lead` edits this board. Other roles report to `ct-lead`.

The first draft (2026-09-27) is derived from the open, wip and unverified
items in docs_fix. The user will revise it.

## lead

| ID | Task | Source | Status |
|---|---|---|---|
| L1 | Confirm the role split and this board with the user. Then dispatch the first wave: B1, A1, U1, P1, S1. | this doc | open |
| L2 | Define the W5 orchestrated-audio contract (ingest keys, listing/detail/stream shapes) before A2, B2 and U2 start. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE §4 | open |
| L3 | Review the Queue Center machine authentication design (status: proposed). Accept it, revise it or drop it. This unblocks P4 and B5. | DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION | open |
| L4 | docs_fix drift: mark superseded sections and point them to the authoritative docs. Start with CodeMart progress and relay V2 progress. | README.md rules | open |
| L5 | Bug audit (report only). Dispatch P5, A6, B6, U5, S4 and R4. Merge the verified findings into §5 of the source doc. | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | wip |

## pycore-runtime

| ID | Task | Source | Status |
|---|---|---|---|
| P1 | Shared delivery layer. Merge every pycore "deliver to Laravel with retry/outbox/backfill" path into one layer: lane outbox, worker results, progress upload, article publish, full syncs. Add delivery status to pycore-manager (UI through U3). | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE R7/R8 (W4) | open |
| P2 | Terminal control. Portal input authorization flow on the real session. Confirm the bridge is `active` after re-login. | REQUIREMENTS_20260927_LINUX_TERMINAL_CONTROL_WAYLAND §6 | blocked (user re-login / desktop consent) |
| P3 | Relay V2 pycore remaining items and snapshot capture follow-ups. | PROGRESS_20260823_PYCORE_REMOTE_RELAY_V2_* | open |
| P4 | Queue Center machine authentication, pycore side. | DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION | blocked (L3) |
| P5 | Bug audit of the pycore-runtime scope, report only → `.claude/agents_shared/bug_audit_20260927/pycore-runtime.md`. | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | wip |

## audio-tts

| ID | Task | Source | Status |
|---|---|---|---|
| A1 | State-driven audio orchestration and queue: close the §4 acceptance against the running deploy (needs the Laravel keyset and sentence listing endpoints). | REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN §4, §6 | open |
| A2 | Idempotent upload of orchestration audio with offline queueing and reconnect backfill, through the P1 delivery layer. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE R7 | blocked (L2, P1) |
| A3 | Remaining engine steps of the Python 3.10 TTS plan: per-engine request/reference/CPU behaviour, long-text chunking, word-task wiring, status/fault feedback. | DEBIAN13_PYTHON310_TTS_DEVELOPMENT_PLAN steps 10–14, 21 | open |
| A4 | GPU/CPU unified toolchain constants (Python/CUDA/driver/model). | DESIGN_20260921_GPU_CPU_UNIFIED_TOOLCHAIN | open |
| A5 | Word audio offline queue residuals (full-sync status, remaining counts). | REQUIREMENTS_20260922_WORD_AUDIO_OFFLINE_QUEUE | open |
| A6 | Bug audit of the audio-tts scope, report only → `.claude/agents_shared/bug_audit_20260927/audio-tts.md`. | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | wip |

## laravel-backend

| ID | Task | Source | Status |
|---|---|---|---|
| B1 | Machine data sync protocol 5. Final acceptance #13: pull `api.si.12gm.com` → local, idempotent. The second run shows only `unchanged`. | REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR | wip (DataSync files modified in the tree) |
| B2 | W5: idempotent orchestrated-audio ingest plus listing/detail/stream API. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE W5 | blocked (L2) |
| B3 | CodeMart server `wip` items: funding/escrow, task/project transitions, milestones, attachments, skills, payouts, invoices. | codemart_docs/PROGRESS_20260927_CODEMART_GAP_COMPLETION | wip |
| B4 | Keyset and sentence listing endpoints needed by A1. Residual dict-lane live queue items. | REQUIREMENTS_20260926 §5.6, DESIGN_20260922_DICT_LANE_LIVE_QUEUE | open |
| B5 | Queue Center machine authentication, Laravel side. | DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION | blocked (L3) |
| B6 | Bug audit of `poly_apps/laravel_main`, report only → `.claude/agents_shared/bug_audit_20260927/laravel-backend.md`. | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | wip |

## frontend-ui

| ID | Task | Source | Status |
|---|---|---|---|
| U1 | CodeMart UI:<br>- open items U05, U08, U12;<br>- UI halves of the server-done items U01, U04, U07, U09, U10, U11, U13, U17, U18. | codemart_docs/PROGRESS_20260927_CODEMART_GAP_COMPLETION | open |
| U2 | wordnew W6: home entry, listing page, player page with related resources and orchestrated playback. Reuse the Walkman and daily-reading players. | REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE R9 | blocked (B2) |
| U3 | pycore-manager delivery status panel (P1). laravel-manager data sync UI states: cancelled, terminal retention, skipped tables. | R7; REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR | open |
| U4 | Terminal Control page: portal authorization action and the notice codes (en/zh). | REQUIREMENTS_20260927_LINUX_TERMINAL_CONTROL_WAYLAND R6/R7 | open |
| U5 | Bug audit of the UI and mcp-chrome, report only → `.claude/agents_shared/bug_audit_20260927/frontend-ui.md`. | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | wip |

## infra-shell

| ID | Task | Source | Status |
|---|---|---|---|
| S1 | Installer parity for Ubuntu 26.04: `xclip`, `wl-clipboard`, `x11-utils`; tray/toast prerequisites. | REQUIREMENTS_20260927_LINUX_TERMINAL_CONTROL_WAYLAND R8 | open |
| S2 | Python 3.10 / TTS installer steps: rename entry, Windows and Debian 3.10, isolated envs, CPU/GPU handling, Docker/Compose branches. | DEBIAN13_PYTHON310_TTS_DEVELOPMENT_PLAN steps 04–08, 16–20 | open |
| S3 | Maintain `claudeteamup` and `claudeagents` (sh/ps1), `config/claude_team_roles.json`, and `.claude/hooks/git_guard.mjs`. | REQUIREMENTS_20260927_CLAUDE_MULTI_ROLE_TEAM | review |
| S4 | Bug audit of `scripts/`, `dd.sh` and `dd.cmd`, report only → `.claude/agents_shared/bug_audit_20260927/infra-shell.md`. | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | wip |

## reviewer

| ID | Task | Source | Status |
|---|---|---|---|
| R1 | Review every `review` task above against its source doc and the AGENTS.md rules. | this board | open |
| R2 | Contract audit: `config/queue_center_contract.json` and `config/pycore_relay_contract.json` against the pycore, Laravel and UI code. | config/*_contract.json | open |
| R3 | First review: S3 (both launchers and the git guard). | REQUIREMENTS_20260927_CLAUDE_MULTI_ROLE_TEAM | open |
| R4 | Verify every P5/A6/B6/U5/S4 finding (CONFIRMED/PLAUSIBLE/REFUTED). Run the R2 contract audit as part of it. | REQUIREMENTS_20260927_TEAM_BUG_AUDIT | wip |
