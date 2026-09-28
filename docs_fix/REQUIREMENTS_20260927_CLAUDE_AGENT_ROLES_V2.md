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
    sandbox" UI). Confirmed by the user on 2026-09-27: it is the pycore UI
    sub-app "Vortex Sandbox":
    - the label in `shell/shellTypes.ts:44` (theme `pycore`, path `/vortex`);
    - `flavors/vortex/flavor.json` ("Vortex Sandbox", a crypto trading sandbox);
    - the code in `apps/vortex/`;
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

## 5. Official mechanisms audit (2026-09-27, docs read at code.claude.com/docs/en)

Pages read:
- `agents` (the five ways to run parallel work);
- `agent-teams`, `sub-agents` (frontmatter, persistent memory), `cross-session-messaging`;
- `agent-view`, `memory`, `sandboxing`, `setup` (advanced-setup), `permission-modes`, `hooks`.

### 5.1 Official information-sharing mechanisms vs this project

| # | Official mechanism | What it shares | Project status |
|---|---|---|---|
| M1 | `CLAUDE.md` / `AGENTS.md` (project, user, local, managed; `@path` imports up to 4 hops; aim under 200 lines) | Instructions loaded by every session, subagent and teammate | In use: `CLAUDE.md` → `@AGENTS.md` |
| M2 | `.claude/rules/*.md`, optionally path-scoped by a `paths` frontmatter | Per-area instructions loaded only when matching files are touched | Not used. Candidate: one rule per role scope that imports its `development-guides` guide |
| M3 | Subagent `memory: user\|project\|local` (`.claude/agent-memory/<agent>/MEMORY.md`, first 200 lines / 25 KB loaded) | Per-role learnings across sessions; `project` scope is shared through the repo | Not used. Candidate: `memory: project` for every role |
| M4 | Agent-teams shared task list (`~/.claude/tasks/<team>/`, file-locked claims, dependencies) and mailbox (`~/.claude/teams/<team>/inboxes/`), members in `config.json` | Task state and messages inside one team | In use: `claudeagents` |
| M5 | Cross-session messaging (ListAgents/SendMessage by `--name`, `notify_when_idle`, text only, about 1M characters) | Findings and status between independent sessions | In use: `claudeteamup`. Auto↔auto sessions deliver without a dialog |
| M6 | Subagent result return and resume by name/ID (SendMessage `to`); a sibling roster when SendMessage is available | Results back to the spawner | Available to every role |
| M7 | Worktrees (`--worktree`, subagent `isolation: worktree`) | Isolation, so that parallel sessions don't edit the same files | Deliberately not used (AGENTS.md forbids git operations). The official agent-teams rule applies instead: "partition the work so each teammate owns a different set of files" (roles V2 §2 B1) |
| M8 | Agent view (`claude agents`, `claude --bg`) | Dispatch and monitor background sessions | **Not used.** Background sessions move into git worktrees and commit/push branches or draft PRs by default, which conflicts with the no-git rule. Using it would need `worktree.bgIsolation: "none"` and review |
| M9 | Hooks `TaskCreated` / `TaskCompleted` / `TeammateIdle` (exit 2 = feedback and block) | Quality gates on the shared task list | Not used. Candidate: a `TaskCompleted` gate that requires a reviewer verdict |
| M10 | Files | Messages carry text only; hand files over as paths | In use: `.claude/agents_shared/` |

### 5.2 Official required and optional packages

| Package | Official status | Platform | Project install (shared `claude_team_install` / `Invoke-ClaudeTeamInstall`) |
|---|---|---|---|
| OS floor: Debian 10+, Ubuntu 20.04+, Windows 10 1809+, macOS 13+, Alpine 3.19+; 4 GB RAM | required | all | not checked (hosts: Debian 13, Ubuntu 26.04, Win10/11) |
| curl (or wget), ca-certificates | required by the native installer | Linux | yes (`cci_ensure_prereqs`) |
| bash, curl, libgcc, libstdc++, ripgrep (+ `USE_BUILTIN_RIPGREP=0`) | required on Alpine/musl | Alpine | libs and ripgrep yes; `USE_BUILTIN_RIPGREP` no |
| ripgrep | bundled with Claude Code | all | nothing to do |
| Node.js | **not** needed by the native install. npm install only: Node 22+ | all | installed for the project git guard hook (project need, not official) |
| tmux | required for split-pane agent teams (or iTerm2 + `it2` on macOS) | Linux/macOS | yes |
| Git for Windows (Git Bash) | optional, **recommended**: it enables the Bash tool. Without it the PowerShell tool is used | Windows | **no** (candidate) |
| bubblewrap, socat | required only for the Bash sandbox (`/sandbox`). Native Windows is unsupported | Linux/WSL2 | **no**; the sandbox is not enabled (candidate if wanted) |
| curl, gnupg | only for the apt repository install method | Debian/Ubuntu | not needed (native installer used) |
| python3, xrandr, a geometry-capable terminal | project launchers only | Linux | yes |
| Windows Terminal | project launcher windows only. Split panes are unsupported there, so teammates run in-process | Windows | yes |

Open for user confirmation: the candidates M2, M3 and M9, Git for Windows,
bubblewrap/socat, and whether to add M3/M8 to the orchestrator guide (the guide
is read-only unless the user asks).

## 6. User decisions on §5 and implementation record (2026-09-27)

User decisions:
- Adopt M3: role memory, `memory: project`.
- Adopt M9 in full: TaskCreated, TaskCompleted and TeammateIdle, set up the official way.
- Add Git for Windows and bubblewrap/socat to the shared idempotent install.
- `claudeagents` runs that install at startup.
- Orchestration cites **only** `development-guides/` documents and never a
  `docs_fix` document. One note allows consulting related `docs_fix` docs,
  on condition that they are first reconciled to the correct latest state.
- M2 (path rules) was not selected.

Implementation:
- Guide `development-guides/claude_code/CLAUDE_CODE_AGENTS_GUIDE.md`,
  rewritten as the only binding orchestration document:
  - official modes, agent definitions, memory, teams, messaging, permissions
    and hooks;
  - shared data layout and the package table;
  - roles, scopes and boundaries (§8, moved from this doc);
  - the docs_fix note.
  This doc stays as the record, but §1–§3 are now mirrored in guide §8, and
  the guide wins on conflict.
- `.claude/agents/*.md` (13 files):
  - `memory: project`;
  - no `docs_fix` document references; the docs_fix note is included;
  - the hook protocol: `[<role>]` task tags, reviewer verdicts, handoff
    reports.
  - The reviewer gains `Write` for verdict and report files only.
  - Official detail: teammates apply only `tools`, `model`, the body and
    `mcpServers`, so memory takes effect in `--agent` sessions (claudeteamup)
    and subagents.
- `.claude/hooks/team_gate.mjs`, wired in `.claude/settings.json`
  (TaskCreated, TaskCompleted, TeammateIdle):
  - owner-tag check against the catalog roles;
  - an approved verdict in `.claude/agents_shared/reviews/<task_id>.json` is
    required, and orchestrator/reviewer tasks are exempt;
  - a fresh handoff report (30 min) in `.claude/agents_shared/reports/<name>.md`
    is required, with release after 2 blocks.
  - Exit 2 = block with feedback, per the official hooks reference.
  - Dry-run verified in a scratch project: every branch gives the expected
    exit code.
- The session marker was renamed from `CLAUDE_AGENTS_GIT_GUARD` to
  `CLAUDE_AGENTS_SESSION` in `claudeteam.sh`/`.ps1`, the tmux session env and
  `git_guard.mjs`. It now enables both hooks.
- Catalog v4:
  - `guide_doc` and `record_dir` replace `requirements_doc` and `task_board`;
  - the kickoffs cite only the guide.
  - Both launcher libraries were updated.
- Shared install, per item:
  - Linux `claude_team_install`: bubblewrap (`bwrap`), socat, and the dirs
    `agents_shared/reports`, `agents_shared/reviews`, `.claude/agent-memory`;
  - Windows `Invoke-ClaudeTeamInstall`: Git for Windows (checked via
    `git.exe`, winget `Git.Git`; `bash.exe` could resolve to WSL's System32
    launcher) and the same three dirs.
- Report-only run on this host: `socat` and the 3 new dirs are `[MISSING]`;
  everything else is `[SKIP]`. The next `claudeagents` start repairs them.
- Static checks: `bash -n`, the PowerShell parser (0 errors), JSON, and
  `node --check` all pass.

## 7. Git rule revision (user directive, 2026-09-27)

Directive:
- Read-only git commands may always be used.
- When the user's prompt asks for it, every git command may run.
- Checked against the official docs: permissions → "Read-only commands". Claude
  Code has a built-in, non-configurable read-only set that includes "read-only
  forms of git" and runs without a prompt in every mode (auto mode may still
  review them).

Implementation (`.claude/hooks/git_guard.mjs`, rewritten):
- The PreToolUse check splits the command into segments on `; & | ( ) \``
  and newlines, skips env assignments, and checks each git/gh invocation.
  - Read-only git (always allowed):
    - `status diff log show blame annotate rev-parse rev-list ls-files ls-tree
      ls-remote cat-file describe shortlog grep merge-base name-rev whatchanged
      show-ref show-branch for-each-ref count-objects check-ignore check-attr
      var help version`;
    - the listing forms of `branch`, `tag`, `remote`, `stash list/show`,
      `config --get/--list`, `reflog show`, `worktree list`,
      `submodule status`;
    - global `-C/--git-dir/--work-tree`.
  - Treated as writes: `-c`/`--config-env`, `--output`, `--ext-diff`,
    `--exec`, `--upload-pack`.
  - Read-only gh: `pr/issue view|list|status|checks|diff`, `repo view`,
    `run/release view|list`, `search`, `status`, and `api` without
    `-X/--method/-f/-F/--field/--raw-field/--input`.
  - Anything else needs a grant, otherwise exit 2.
- UserPromptSubmit grants all git/gh commands for 120 min. It triggers when the
  user's prompt asks for git work: the word git/gh, `allow-git`/`允许git`, or
  提交代码/推送代码/创建分支/合并分支. `.gitignore` alone does not trigger it.
  `deny-git`/`禁止git` revokes.
- Dry-run in a scratch project: 29/29 command cases correct. Grant, revoke,
  no-trigger prompts and the Chinese request all behave as expected.
- Synced:
  - agent files (git line; the reviewer now uses read-only git diff/status/log);
  - guide §5 hook table and B8 (edited at the user's request);
  - launcher summary lines;
  - the auto-memory note.
- Open for the user: `AGENTS.md` still says "No git operations unless
  explicitly asked". It was not changed; read-only git now is allowed for
  roles by this directive.

## 8. AGENTS.md git line and cross-machine Laravel role (user directive, 2026-09-27)

Directive:
- Align the AGENTS.md git rule with the new rule.
- Check whether the official docs support cross-machine collaboration. A team
  member would run over SSH on a remote machine and share through the network.
- If supported, add a Laravel-main server backend role that works on the same
  code as local Laravel development:
  - `laravel` develops locally and tests locally;
  - the server role develops and tests directly on the server.

Done:
- `AGENTS.md` **Git:** read-only git is always allowed; any other git
  operation only when the user's prompt asks for it.

Official findings (docs `remote-control`, `cross-session-messaging`, `agent-teams`):
- Supported. Cross-machine `SendMessage` works between your own sessions when
  both are connected to Remote Control. It travels through Anthropic servers,
  carries text only, and approval is required only if `isolatePeerMachines`
  is set.
- Requirements:
  - a claude.ai Pro/Max/Team/Enterprise login; API keys are unsupported;
  - no custom `ANTHROPIC_BASE_URL`, and not Bedrock, Vertex or Foundry;
  - `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` and `DISABLE_GROWTHBOOK` unset;
  - workspace trust accepted.
  - The docs recommend tmux/screen on SSH hosts so the session survives
    disconnects.
- Agent teams are local to one session, so a remote member can only be an
  independent session, never a teammate.
- This host: claude.ai OAuth login present; `claudeteam` sets none of the
  blocking variables.

Implementation:
- Catalog v5:
  - role `laravel-remote` with `remote: {ssh_secret: "SSH_CONNECTION_1", root:
    "/www/programing/core_node"}`, **`enabled: false`** until the user confirms
    the secret index and the server path;
  - `remote.kickoff` and `remote.reconnect_seconds`.
- Linux `claude_team_common.sh` and Windows `ClaudeTeamCommon.ps1`:
  - remote roles launch in both modes; in team mode they get their own window
    beside the orchestrator (grid N×1);
  - a local tmux session or window resolves the SSH target from
    `secret_read.py` (never printed) and loops
    `ssh -t -o ServerAliveInterval=30`;
  - the server runs `claude_team_install`, then
    `tmux -L claudeteam new-session -A -s ct-laravel-remote`, which is
    idempotent, then `claudeteam.sh --agent laravel-remote --remote-control
    ct-laravel-remote`;
  - the orchestrator gets `--remote-control <session>` whenever an enabled
    remote role exists.
- Nested quoting verified by decoding every layer with `shlex`, for both the
  bash and the PowerShell builders, including an apostrophe in the kickoff.
  Parse checks: `bash -n`, the PowerShell parser (0 errors), JSON.
- Agents:
  - new `.claude/agents/laravel-remote.md` (server develop and test, live-host
    safety rule, report changed files and server-only changes, reviewer stays
    local);
  - `laravel.md`: local develop and test, one writer per task path between the
    twins;
  - `orchestrator.md`: role list and assignment rule.
- Guide:
  - §8 now has 14 roles and a B1 rule for the two Laravel roles;
  - new §10 on cross-machine members.

Open for the user:
- Which `SSH_CONNECTION_n` is the laravel-main server, and the core_node path
  on it. Then set `enabled: true`.
- One-time `claude` login (claude.ai) and workspace trust on the server.
- `AGENTS.md` says "Do not create, run, or modify tests", while this directive
  has both Laravel roles run verification. The agents run the existing checks
  but create or modify no test files; AGENTS.md was not changed.
- The code-sync direction from the server back to local was not verified in
  this round.
