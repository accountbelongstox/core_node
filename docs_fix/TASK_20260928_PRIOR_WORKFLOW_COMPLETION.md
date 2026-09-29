# Finish the earlier "roles not started" workflow (2026-09-28)

## User task

"找到之前的onwerflowe查看那些还没有完成，没有完成使用角色继续完成。" Find the earlier workflow, list what it left unfinished, and have the roles finish those items.

## The earlier workflow

- The only other workflow run on this project is `wf_2f18793a-cd6`, "claude-team-roles-not-started". It ran in root lead session b6394e13, from 2026-09-27 21:45 to 09-28 07:04. Script: `~/.claude/projects/-www-programing-core-node/b6394e13-.../workflows/scripts/claude-team-roles-not-started-wf_2f18793a-cd6.js`.
- Goal: find out why the claudeagents role sessions never became usable, check the answer against the official docs, and recommend fixes.
- Done:
  - 4 investigations: official-docs, forensics, launcher-audit, terminal-attach.
  - 3 adversarial verifications: official-docs, forensics, terminal-attach.
- Not done:
  1. `verify:launcher-audit`. It was started 4 times and never returned a result; the last attempt is journaled as `failed`.
  2. 45 recommended fixes (6 to 9 per report), none checked against the current code. Some landed later: 588fd2c2d added ssh accept-new, 2befa3e83 added the login preflight and the foreign-factory skip, and e97ec39b3/8c30ec34e reworked the launcher so claudeagents starts only the lead.
  3. Runtime step: stop the stalled root team and relaunch. Every verifier marked it "user approval only".
- Root cause, as verified: the team was launched from a plain `su` root shell. Root's `~/.claude.json` had never been onboarded, while the user had onboarded as `debian`. Every root pane stopped on the theme screen. The gnome-terminal attach went through debian's D-Bus, so it ran as uid 1000 and found no session.

## Current state (2026-09-28 19:20)

- Root team (tmux `/tmp/tmux-0/claudeagents`, the session this lead runs in): 28 local role panes still at onboarding or login. The laravel-remote ssh loop is at the host-key prompt.
- Debian team (tmux `/tmp/tmux-1000/claudeagents`, created 22:04, uid 1000, lead `ca-orchestrator [13ea0a]` over Remote Control): about 30 live `ct-*` panes at their prompts, some of which show earlier usage-limit notices. From this root session, cross-session messaging reaches them only through the Remote Control lead.
- Launcher files have no uncommitted changes (git status is clean for scripts/, config/ and the guide).

## Decisions

| ID | Decision | Reason |
|---|---|---|
| P1 | The unfinished items are the 45 recommended fixes plus the missing launcher-audit verification. One audit workflow classifies each fix against HEAD 8c30ec34e: done, partial, not_done, obsolete or rejected. The audit also re-verifies the launcher-audit claims. Only not_done and partial items go to owners. | Most fixes may already be in the code; re-implementing them would duplicate work. |
| P2 | Writers. `shell-linux`: `scripts/shells/linux/common/claude_team_common.sh`, `scripts/ai_shtools/claude_code_install.sh`, `scripts/linuxenvs/claude*.sh`, the linux parity ledger. `shell-linux` is also temporary writer for the cross-platform Python helpers `scripts/ai_ps1tools/_json_sync_helper.py` and `scripts/pytools/ai_tools/auto_add_mcp_linux.py`. `shell-windows`: `scripts/shells/win/win_common/ClaudeTeam*.ps1`, `scripts/winenvs/claude*`, the windows parity ledger. Orchestrator: `config/claude_team_roles.json`. | Shell split (D12). The helper defect was found on the Linux dd.sh MCP sync path. |
| P3 | Roles run as on-demand agents of their own type from this lead (Workflow). shell-windows starts after shell-linux so it mirrors the final Linux behaviour. | The root panes are stuck. The live debian team cannot be reached directly from root. Guide §1. |
| P4 | Each change gets a reviewer verdict, with at most 2 fix rounds. | R1 completion gate; launcher changes affect every future launch. |
| P5 | Fences: tell the debian-team lead which launcher files this lead holds. It must not edit them until release. | One writer per path across two parallel teams. |
| P6 | Runtime steps stay with the user: killing or respawning the stalled root panes, and answering the ssh host-key prompt. | AGENTS.md: no destructive action without explicit approval. All three verifiers marked these "user approval only". This lead's own pane is in the same tmux server. |
| P7 | Rejected fixes stay rejected, as the verifiers ruled: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS in every pane, a CLAUDE_CONFIG_DIR per role, switching to CLAUDE_CODE_OAUTH_TOKEN, StrictHostKeyChecking=no, a group-shared tmux socket, a root gnome-terminal-server. | verify:official-docs fix 4; verify:terminal-attach fix 6. |

## Outcome

### Audit (workflow `wf_f94596c0-150`, 18 agents, 0 errors)

- The 45 recommended fixes merged into 34 items: 4 done, 6 partial, 17 not_done, 2 obsolete, 5 rejected. Open items by owner: shell-linux 13, shell-windows 7, orchestrator 1, user-runtime 2.
- The launcher-audit verification (the missing piece) covered 16 findings: 12 confirmed still true, 3 fixed since, 1 refuted. The refuted claim is F6b: "`claude auth login` sets hasCompletedOnboarding" is false in 2.1.283. The verification also added 7 missed findings. The key one is a regression: 8c30ec34e had deleted the 2befa3e83 login preflight, so HEAD had no account check at all.

### Implementation (all approved by reviewer)

| Task | Owner | Files | Verdict |
|---|---|---|---|
| orch-wf1 launcher (#4) | shell-linux | `claude_team_common.sh`, `claude_code_install.sh`, `claudeagents.sh`, `claudeteamup.sh`, `shell_parity/linux.md` | approved r2 (1 major fixed: stale scrollback after `respawn-pane -k`) |
| orch-wf1 helpers (#4) | shell-linux (temporary writer, P2) | `_json_sync_helper.py`, `ai_tools_common.py`, `auto_add_mcp_linux.py` | approved r2 |
| orch-wf1 Windows (#5) | shell-windows | `ClaudeTeamInstallCommon.ps1`, `ClaudeTeamCommon.ps1`, `winenvs/claudeagents.ps1`, `winenvs/claudeteamup.ps1`, `shell_parity/windows.md` | approved r1 (3 minors, sent to orch-wf1b) |
| catalog (launcher-audit 8) | orchestrator | `config/claude_team_roles.json`: the 13 alias rows get `enabled:true, window:false` | no pane; still on the teammate roster and valid task tags. `claudeteamup --status` lists them as service roles. |

What changed in behaviour:
- New report-only account check (sign-in, `hasCompletedOnboarding`, workspace trust). It prints the uid, HOME and config file the panes will use.
- A plain su/sudo warning.
- While the account is not ready, non-lead roles are held, with a `--skip-account-check` override.
- Pane readiness probe with labels `blocked:onboarding|login|trust|ssh-hostkey|usage-limit` and `stalled`.
- `--respawn-blocked` opt-in, which clears the pane history before `respawn-pane -k`.
- A 30 s readiness wait after launch.
- As root, the launcher skips gnome-terminal when another user's session bus would run it, logs the terminal to `terminal.log`, and falls back to the current tty.
- Root launches reset USER, LOGNAME and the D-Bus address to root's.
- ssh gets `ConnectTimeout=15` and `BatchMode=yes`.
- `~/.claude.json` writers are atomic, keep the owner and mode, and refuse a file they cannot parse.
- Windows mirrors all of it, or records a platform-only reason.

Checks: bash -n and py_compile pass, and a PowerShell parser check finds 0 errors. `claudeteamup --status` names every stuck root pane, and no longer calls them "running".

### Orchestrator rulings

| ID | Ruling | Reason |
|---|---|---|
| O1 | Aliases get `window:false`, not `enabled:false`. | `enabled:false` would drop them from the lead kickoff `{roles}` roster, while guide §4 still routes to them. R2 makes them reserve roles with no pane. |
| O2 | `BatchMode=yes` stays in the remote ssh options. | The loop is unattended and key-based; failing fast and reconnecting beats a hidden password prompt. |

### Follow-up rounds (all approved, 0 open findings)

| Task | Workflow | Result |
|---|---|---|
| orch-wf1b shell-linux | `wf_32047550-fd9` | The reviewer found a major in round 1: a root `chown` escalation through a symlink swap of the temp file. Fixed by setting mode and owner on the open fd (`fchmod`/`fchown`); an exploit probe confirms it. A new file that root creates in another user's directory now gets that directory's owner, mode 0600. SPL-135 added. SPL-127/129-132/134 → aligned with SPW-046/048-051/054. The O2 ruling is noted on SPL-134. |
| orch-wf1b shell-windows | `wf_32047550-fd9` | Read failures inside try/catch report WARN plus `missing`, not `login`, so a transient lock never holds roles. Fallback parser for case-duplicate project keys, chosen by capability, not version. `$ClaudeTeamLiveStates` is defined once. |
| orch-wf1c both | `wf_32076b56-56a` | Code comments trimmed (AGENTS.md: code is documentation). SPL-109 pipes escaped: all 58 rows have 5 cells. The Windows empty project key is skipped before Add-Member. |

Verdict files: `.claude/agents_shared/reviews/orch-wf1{,b,c}-*.json`. Final check: bash -n, py_compile and the catalog JSON all pass; 14 files changed in scripts, config and the ledgers. Nothing is committed: the user did not ask for git work. The fence (P5, the debian lead's R6) was released to `ca-orchestrator [13ea0a]`.

### Left for the user (P6)

- The 28 root panes stuck at onboarding or login (tmux `claudeagents`, panes %1-%29 except %14) and pane %14 at the ssh host-key prompt. Either stop them, or answer each pane; a re-launch is now safe, because root is onboarded and the launcher labels blocked panes. `--respawn-blocked` only covers panes in the launcher's own layout.
- Live test of the tmux-changing paths: readiness wait, `--respawn-blocked`, the terminal fallback, and whether root xterm opens on Xwayland. Plus a `claudeteamup.ps1 -Status` run on a real Windows host.
- Delete the orphan `scripts/pytools/ai_tools/auto_add_mcp_linux.py` (0 callers)? It needs the user's sign-off.
