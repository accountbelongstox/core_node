# Role launch census and work smoke test (2026-09-28)

## User task

"你能启动多少个角色，查看一下并对每一个进行反馈能工作测试。" Count how many roles can be started, inspect them, and run a work test on each one with feedback.

## Findings before dispatch

- Role catalog `config/claude_team_roles.json`: 21 rows. 18 are enabled: orchestrator, the 15 local roster members, laravel-remote, ncore and flutter (ncore and flutter have `window: false`). pycore-gpu-remote and reviewer are disabled. `.claude/agents/` has 34 definitions: the orchestrator plus 33 roles, including 13 pre-D22 aliases that have no catalog row and so count as enabled.
- Launch (tmux `claudeagents`, session `core-node-team`, started 2026-09-27 21:37): the lead plus 29 role panes (28 local `ct-*` and the laravel-remote ssh loop). reviewer, ncore, flutter and pycore-gpu-remote got no pane.
- Reachable over cross-session messaging (ListAgents): only `ct-laravel-remote` (Remote Control, idle). Also listed: `core-node-78` (a user session), `ca-orchestrator [13ea0a]` (Remote Control) and `[a0b003]` (offline).
- The 28 local `ct-*` panes are stuck at Claude Code first-run onboarding: 27 on the theme picker and `ct-shell-windows` on the OAuth login URL. They never reached a prompt, so they cannot receive messages. The local laravel-remote ssh-loop pane (%14) waits at an ssh host-key confirmation prompt; the server session is still reachable over Remote Control.
- The running panes were started with `--settings {"ultracode":true}`. The current `scripts/linuxenvs/claudeteam.sh` no longer forces ultracode, so the panes predate the launcher and guide rework.
- A second set of 28 `ct-*` processes and a second `ca-orchestrator` (with `--remote-control`) started about 20:57 h before the census. They have no socket in this session's messaging directory and are not reachable from here.
- `.claude/settings.json` has no TaskCompleted hook, only the git guard and the TaskCreated team gate.

## Decisions

| ID | Decision | Reason |
|---|---|---|
| S1 | Do not type into the stuck panes (theme picker, OAuth login, ssh host-key prompt). | Login and host-key trust need the user; another session's onboarding is not the orchestrator's to answer. |
| S2 | Test every local role definition (32: 33 roles minus laravel-remote) as a read-only Workflow agent of that agent type (run `wf_dbfee9ab-4e1`). Test laravel-remote over SendMessage. | Guide §1: the lead spawns teammates by agent type on demand. No running session can take the work, and read-only tests create no writer conflict. |
| S3 | The test is read-only: identity, scope path existence, tool use (Read, Grep, read-only git via Bash), guide routing check, readiness verdict. No edits, tests, builds, services or network. Reported issues get an independent opus check. | AGENTS.md: no tests, builds or services unless asked; a census needs no changes. |
| S4 | Explicit model per agent from its frontmatter (sonnet; opus for pycore-architect). | Workflow agents do not apply custom-type frontmatter models reliably (orchestrator memory). |
| S5 | pycore-gpu-remote is tested for definition load only, not on the GPU host. | It is disabled in the catalog and has no connected host. |
| S6 | Trackers: task #1 (umbrella) and task #2 (laravel-remote). No reviewer verdict, since a read-only test changes nothing. | Guide §3: shared tasks only for active dependency tracking; reviews are risk-based. |

## Outcome

### Startable roles

- 34 agent types load: the orchestrator plus 33 roles. All 32 locally tested roles loaded as their own agent type and passed the tool checks (Read, Grep, read-only git). Transcripts confirm the models: 31 ran on `claude-sonnet-5`, and pycore-architect ran on `claude-opus-5-5`. None was not_ready.
- Sessions live right now: the lead and `ct-laravel-remote`. The 28 local `ct-*` panes need onboarding and login finished in each pane, or a relaunch under the current launcher. Guide §1 prefers spawning roles on demand.
- On-demand capacity: run `wf_dbfee9ab-4e1` ran 63 agents (32 tests plus 31 verifiers) in 5.2 minutes with 0 errors, on a 20-CPU host.

### laravel-remote (task #2, SendMessage)

ready_with_issues. It runs as Opus 5.5 on host VM-0-2-debian with PHP 8.5.10 and Laravel 13.25.0; Read, Grep and git work.
- Parity with dev: `composer.json` matches; the guide, `.claude/agents/laravel-remote.md` and `routes/api.php` differ. CodeSync is wedged: `/code-sync/ping` times out. The server git log is at 74e7770bd, dev HEAD at 8c30ec34e.
- On the server, three `ca-orchestrator` rows are visible, so a bare-name reply went to the offline one. Rule: reply to the bridge `from` id.
- The CodeSync repair stays on hold (R4).

### Per-role verdicts (issues confirmed by the verifier)

| Role | Verdict | Confirmed issues |
|---|---|---|
| pycore-lead | with issues | `pycore/__main__.py` is leftover "pytools" content (py_auto, win_actor tools; none of it exists). Scope is prose only; pyutils, callmodule and database have no named owner. |
| pycore-ai | ready | Routing row §4 is narrower than the description (translation, ensure_library, GPU/CPU policy). |
| pycore-runtime | with issues | Overlaps pycore-assist on agent history, terminal, desktop, browser, MCP, device and pyapps. |
| pycore-laravel | ready | No path anchors in the description. |
| pycore-ui | with issues | No UI (TS/React) area guide. pdd-manager has no row in routing §4. |
| wordnew-lead | with issues | Direct-edit vs delegate is unclear. No UI or native guide. wordnew-ui and ui-wordnew duplicate each other. |
| wordnew-ui | with issues | No UI guide. The alias pair has no default writer in §4. |
| wordnew-laravel | with issues | AppQyV1 migrations are mixed into shared migrations (naming exceptions). One controller sits in shared Controllers. No AppQyV1 guide section. |
| wordnew-native | with issues | Description path `native/wordnew` is really `poly_apps/pycore_laravel_wordnew_ui/native/wordnew`. Build scripts are shared across flavors. No Capacitor guide. |
| wordnew-link | with issues | Owns all of `apps/mcp-chrome` together with mcp-chrome, with no subpath split. The glue is only `native-server/src/ncore.ts`. |
| shell-windows | with issues (refuted) | The dd.ps1 claim was refuted, so no confirmed issue. |
| shell-linux | with issues (artifact) | The memory-path mismatch was a test artifact (see below). The WSL2 clause was refuted. |
| codemart-lead | with issues | Overlaps the members. "Redis integration" names no path. No CodeMart UI guide. |
| codemart-ui | with issues | `apps/codemart` and `flavors/codemart` are shorthand for paths under `poly_apps/pycore_laravel_wordnew_ui/`. No UI guide. The alias pair has no default writer. |
| codemart-laravel | with issues | codemart-laravel and laravel-codemart are separate definitions and memories with no canonical one. |
| ncore | with issues | AGENTS.md has no line pointing to `development-guides/NODE_NCORE_GUIDE.md`. |
| flutter | with issues | AGENTS.md has no Flutter line. Two Flutter guides exist. The macos, linux, windows and old_travel dirs have no owner. |
| reviewer | with issues | Scope follows each task (by design). The verdict-file ambiguity was refuted. |
| pycore-gpu-remote | with issues | Definition load only. whisper_stt is not named. The GPU host is not tested (S5). |
| laravel, laravel-api, laravel-qyapp, laravel-codemart, mcp-chrome, pycore, pycore-assist, ui-codemart, ui-laravel-manager, ui-pycore-manager, ui-vortex, ui-wordnew | with issues | Pre-D22 aliases. Their definitions and guide §4 do not state the R2 reserve status or the default writer; it lives only in docs_fix and memory. laravel-codemart and ui-laravel-manager also use repo-root shorthand paths. |
| pycore-architect | with issues | Owns pyfoundations together with pycore-lead. `PYTHON_PYCORE.md` has a stale `pygvar` layer (lines 33-37) and a stale heartbeat `registry.py` reference (line 60). The audit scope is unbounded. |

### Cross-cutting recommendations (not applied; the user asked for tests and feedback only)

1. Relaunch or finish onboarding for the local panes. Until then, use on-demand spawning (guide §1).
2. Put R2 in the definitions: mark each of the 13 alias definitions as reserve and name its default writer, or retire the aliases and keep only the D22 roster (codemart-laravel/laravel-codemart and the others).
3. Give each description concrete repo-relative paths, split the overlaps (pycore-lead/architect on foundations, pycore-runtime/assist, wordnew-link/mcp-chrome), and name owners for the unowned dirs.
4. AGENTS.md area-guide lines for UI (TS/React; no guide exists yet), ncore (`NODE_NCORE_GUIDE.md`) and flutter (pick one of the two guides).
5. Code and guide follow-ups: `pycore/__main__.py` leftover (pycore-lead), and the `PYTHON_PYCORE.md` stale layer and heartbeat references (guide change needs a user request, guide §5).

### Test artifact

The workflow ran while the lead's cwd was `.claude/agents`. The harness created 18 empty `.claude/agents/.claude/agent-memory/<role>` dirs, which were removed (no files, untracked). The shell-linux "memory path mismatch" finding came from this and is not a role defect. Rule: launch workflows from the repo root.
