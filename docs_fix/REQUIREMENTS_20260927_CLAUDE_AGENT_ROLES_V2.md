# Claude Agent Roles V2 — Scopes, Boundaries, Guides

Date: 2026-09-27
Status: binding. This supersedes the role table in
`REQUIREMENTS_20260927_CLAUDE_MULTI_ROLE_TEAM.md` §2 (roles lead,
pycore-runtime, audio-tts, laravel-backend, frontend-ui, infra-shell).
Launchers, permissions, git guard and shared install stay as recorded there
(Rounds 2–4).

## 0. User directive (2026-09-27)

- `development-guides/claude_code/` holds a condensed extract of the official
  Claude Code docs. It is the guide for the Claude agents orchestrator role.
- Roles:
  - audio-tts is removed and folded into **pycore** (guide
    `PYTHON_PYCORE.md`);
  - **laravel** (`LARAVEL_GUIDE.md`);
  - **shell** (`DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`);
  - **reviewer**;
  - UI roles in `poly_apps/pycore_laravel_wordnew_ui`: **laravel-manager**,
    **pycore-manager**, **wordnew**, **codemart**, **vortex** (the "vertex
    sandbox" UI; the directory is `apps/vortex`, OKX sandbox/quant panels);
  - **flutter**;
  - **ncore** (Node.js);
  - **mcp-chrome** (Chrome extension).
- Scan the code and docs_fix, and give each role its scope and boundaries.
- `development-guides/*` is read-only. It is changed only when the user asks,
  as this time for the new `claude_code/` guide. `docs_fix` may be changed at
  any time.

## 1. Role matrix (13 roles)

| # | Role id | Guide | Write scope | Main docs_fix sources |
|---|---|---|---|---|
| 1 | `orchestrator` | `development-guides/claude_code/CLAUDE_CODE_AGENTS_GUIDE.md` | `docs_fix/`, `config/*.json` (contracts, role catalog), `.claude/agents/`, `.claude/agents_shared/` | this doc; the board; every REQUIREMENTS doc |
| 2 | `pycore` | `development-guides/PYTHON_PYCORE.md` | `pycore/`, `pymain.py`, `pyservice.ps1`, `pyservice.sh`, `pyapps/` | A7A*; `DESIGN_20260823_PYCORE_REMOTE_RELAY_V2` and its PROGRESS docs; `REQUIREMENTS_20260927_LINUX_TERMINAL_CONTROL_WAYLAND`; `REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN`; `REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE` (W1–W4); `REQUIREMENTS_20260922_*` (queue head, word audio offline); `DEBIAN13_PYTHON310_TTS_DEVELOPMENT_PLAN` (engine steps 09–14); `DESIGN_20260921_GPU_CPU_UNIFIED_TOOLCHAIN`; `CODESYNC_AI_COMMUNICATION_API`; `FIX_2026080x_PYCORE_*`; `FIX_20260919_SILENT_EXITS_CUDA_HF_GATED`; `FIX_20260926_*` |
| 3 | `laravel` | `development-guides/LARAVEL_GUIDE.md` | `poly_apps/laravel_main/` | queue center FIX/DESIGN docs; `DESIGN_20260922_DICT_LANE_LIVE_QUEUE`; `REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR`; `FIX_20260820_LARAVEL_FRANKENPHP_MERCURE_API_SPEC`; `FIX_20260813_LARAVEL_OCTANE_*`; `FIX_20260815_0953_LARAVEL_13_UPGRADE`; `DESIGN_20260814_QUEUE_CENTER_MACHINE_AUTHENTICATION`; `codemart_docs/*` (server); W5 of the prompt-rewrite doc |
| 4 | `shell` | `development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md` | `scripts/`, `dd.sh`, `dd.cmd` | `DESIGN_20260816_NGINX_MULTI_END_MANAGEMENT` (shell side); `FIX_20260817_*` (nginx, api domains, Nexus dash); `FIX_20260918_SSH_SESSION_DROP_TMUX_PERSISTENCE`; `TTS_DOCKER_INSTALL_METHOD_DEVELOPMENT_PROGRESS`; `DEBIAN13_PYTHON310_TTS_DEVELOPMENT_PLAN` (installer steps 04–08, 16–20); `RESOURCE_WATCHDOG_FRANKENPHP_FREEZE`; installer R8 of the terminal-control doc; the claude team launchers |
| 5 | `reviewer` | all guides (read-only) | none; review notes go to the orchestrator | every doc a reviewed task cites |
| 6 | `laravel-manager` | UI conventions in the repo; AGENTS.md | `poly_apps/pycore_laravel_wordnew_ui/apps/laravel-manager/` | `REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR` (UI); `DESIGN_20260816_NGINX_MULTI_END_MANAGEMENT` (UI); queue center UI docs (`FIX_20260802_UI_EXCHANGE_HUB_ARCHITECTURE`) |
| 7 | `pycore-manager` | UI conventions; AGENTS.md | `.../apps/pycore-manager/` | terminal control UI (R6/R7); agent history UI (`DESIGN_20260919_AGENT_HISTORY_FLOATING_PANELS_*`, `FIX_20260926_AGENT_HISTORY_*`); `FIX_20260919_PYCORE_UI_MIXED_CONTENT_ENDPOINT_REFACTOR`; relay groups UI (`DESIGN_20260817_2115_*`); audio orchestration UI; delivery status panel (R7) |
| 8 | `wordnew` | `apps/wordnew/docs/`; AGENTS.md | `.../apps/wordnew/`, `.../flavors/wordnew/`, `.../native/wordnew/` | `FIX_20260811_WORDNEW_*`; `FIX_20260810_WORDNEW_QUEUE_RECEIPTS`; `FIX_20260919_WORD_UPLOAD_404_F5TTS_GATE` (UI); W6/R9 orchestrated audio player |
| 9 | `codemart` | `codemart_docs/*`; AGENTS.md | `.../apps/codemart/`, `.../flavors/codemart/` | `codemart_docs/PROGRESS_20260927_CODEMART_GAP_COMPLETION` (U-items), `DESIGN_20260823_CODEMART_*` |
| 10 | `vortex` | AGENTS.md | `.../apps/vortex/`, `.../flavors/vortex/` | none in docs_fix yet. The OKX account/backtest/quant panels and `VortexPycoreContract.ts` bind it to pycore |
| 11 | `flutter` | `development-guides/FLUTTER_GUIDE.md` | `poly_apps/flutter_bloom/` | `codemart_docs/flutter_reference/` |
| 12 | `ncore` | `development-guides/NODE_NCORE_GUIDE.md` | `ncore/`, `apps/` except `apps/mcp-chrome/`, root `main.js`, `ncore_module_caller.js`, `public/` | ncore's own `RPC_FRAMEWORK_UNIFICATION_PLAN.md`; `PLAN_20260729_RPC_V2_EXTERNAL_HTTP_CLIENT` (Node side) |
| 13 | `mcp-chrome` | `development-guides/MCP_CHROME_GUIDE.md` | `apps/mcp-chrome/` | `FIX_20260801_MCP_WORD_REPAIR_QUEUE_WS`; `FIX_20260816_WORD_VALIDITY_AI_ENSURE_COVER_PIPELINE_MERGE`; `FIX_20260814_2230_FOUR_END_ENDPOINT_CENTRALIZATION` (mcp-chrome end); `FIX_20260729_D8_D10_C6_C7` (Stop) |

## 2. Boundaries

- B1 **One writer per path.** A role writes only inside its write scope. It
  sends any other change to the owner through the orchestrator (board row or
  message) and never edits it itself.
- B2 **Shared UI layer.** In `poly_apps/pycore_laravel_wordnew_ui`, these
  paths belong to no UI role:
  - `shell/`, `core/`, `shared/`, `components/`, `src/`, `services/`,
    `utils/`, `hooks/`, `contexts/`, `config/`, `styles/`, `themes/`,
    `resources/`, `public/`, `scripts/`;
  - the root build and config files (`package.json`, `vite.config.ts`,
    `tsconfig.json`, `index.tsx`, `capacitor.config.json`, `build_app.ps1`).

  The orchestrator assigns one UI role as the temporary writer for each
  change, one at a time, and records it on the board. Reuse the shared code;
  never copy it into an app.
- B3 **Unassigned area.** `apps/pdd-manager/` has no role. The orchestrator
  assigns it per task.
- B4 **Cross-end contracts.** `config/*_contract.json` and the endpoint
  constants shared between pycore, Laravel, UI and mcp-chrome change only
  through the orchestrator, before the implementing roles start.
- B5 **Backends.**
  - Every Laravel API that a UI role, flutter or mcp-chrome needs belongs to
    `laravel`.
  - Every pycore RPC or route belongs to `pycore`.
  - UI roles only consume them, through the centralized endpoint modules.
- B6 **Installers.** Dependency installs for any role are implemented by
  `shell`:
  - apt/winget/pip policy files under `scripts/`;
  - dd steps;
  - the shared `claude_team_install`.
  `pycore` owns only its runtime package policy code inside `pycore/`.
- B7 **Guides are read-only.** No role edits `development-guides/`. A needed
  guide change goes to the user through the orchestrator. `docs_fix` is the
  living record: owners append their implementation records, and the
  orchestrator maintains the board and supersede notes.
- B8 **Common rules.**
  - AGENTS.md applies to every role: English code, i18n, variables at the
    file top, no tests/builds/services unless asked.
  - git/gh is blocked unless the user's prompt says `allow-git`.
  - Permission mode is `auto`.
  - Files are handed over as paths in `.claude/agents_shared/`.

## 3. Launch layout

- The catalog `config/claude_team_roles.json` lists the 13 roles in the table
  order.
- `claudeteamup` (sessions mode) uses a 5×3 grid: 13 windows, and slots
  14–15 are free.
- `claudeagents` (team mode) starts only `ca-orchestrator`. It spawns the 12
  other role types on demand, following the official advice of 3–5
  concurrent teammates.
- The lead role id is `orchestrator` in both launchers (`ct-orchestrator`,
  `ca-orchestrator`).

## 4. Implementation record (2026-09-27)

- Added `development-guides/claude_code/CLAUDE_CODE_AGENTS_GUIDE.md`, the only
  write in `development-guides`, as the user requested.
- `.claude/agents/`:
  - rewritten: `orchestrator`, `pycore`, `laravel`, `shell`, `reviewer`,
    `laravel-manager`, `pycore-manager`, `wordnew`, `codemart`, `vortex`,
    `flutter`, `ncore`, `mcp-chrome`;
  - removed: `lead`, `pycore-runtime`, `audio-tts`, `laravel-backend`,
    `frontend-ui`, `infra-shell`.
- Catalog v3: 13 roles, grid 5×3, team session `ca-orchestrator`.
- Launchers: lead role constant `orchestrator` (sh and ps1).
- The board has been re-assigned to the new roles.
