---
name: launcher-parity-checklist
description: B11 parity checks for the claudeagents/claudeteamup/claudeteam launchers (ClaudeTeamCommon.ps1 vs claude_team_common.sh), with the gaps found in the D13 round
metadata:
  type: project
---

Gaps that both owners' ledgers marked "aligned" in the D13 parity check (shell-windows-1 vs shell-linux-1, 2026-09-27):

- **What the PID file names.** On Windows it is the pane's `-NoExit` powershell, which outlives claude. On Linux it is the exec'd claude. So a role whose claude exited counts as "running" on Windows forever, while Linux respawns the idle pane. The `--name` process map also matches the idle shell's own command line.
- **One lead at a time.** Windows blocks a lead while the other launcher's lead (ca-/ct-orchestrator) is alive (state `other-lead`). Linux uses per-mode sockets and only warns, so two agent-teams leads can run.
- **Stale pending rows.** A `pending-<os>` row goes stale when the counterpart implements the feature in the same round (SPL-110 `--name` check). Check the other side's code before asking for an align task.
- **Small rule drift to grep:**
  - `--name`/`-n` flag sets;
  - a user filter on the named-process scan;
  - `session_env.lead` removal: every name vs one hardcoded variable;
  - the frontmatter parser: BOM (`utf-8-sig`) and duplicate names (first wins with WARN vs last wins silently);
  - summary table columns;
  - standalone `claudeteam --agent <role>`: role spec vs lead.
- **Grid heuristics.** Windows uses aspect 2.5, row-major fill and a lead-top fallback. Linux uses max area, column-major fill and a lone lead. Both rows said "aligned".
- **Binding ruling (d13/DESIGN.md, 17:24):**
  - §3.1 is the shared packing rule: max area, then column fill, then the lead-top fallback. Windows tab counts may differ because of WT pane chrome; SPW-024 records that as platform-only.
  - §3.2 is one lead on both OSes. Only a live claude/node process counts, and the PID file is removed when claude exits.
  - In fix rounds, check against these rulings, not the owners' ledgers.
- **Owner cross-notices can be wrong.** shell-windows claimed that claudeteam.sh writes `<mode>-<role>.pid`, but it writes `<session>.pid`. Verify them in the code.
- **Linux-specific checks** (from shell-linux-1 round 1, changes_requested):
  - Constants duplicated between `claude_code_install.sh` (`CCI_*`, sourced first) and `claude_team_common.sh` (`CLAUDE_TEAM_*`), e.g. the catalog path. The common should reuse the `CCI_*` values, as it already does for the state dir and terminals.
  - A settings merge done as temp file + `os.replace` resets the file mode and reformats the file. Windows inserts the keys as text instead.
  - The tmux regrid hooks (`run-shell -b`) persist on the session. They race a re-run's splits and treat the untagged panes of ad-hoc tmux teammates as grid cells.
  - Recompute the packing by hand at 213x52, 227x57 and 284x72 (the budget math is in `claude_team_pack`/`claude_team_tab_grid`). The owner's harness numbers matched.
  - For the CR count, see [[shell-linux-review-checklist]].

- **Layout sanity without launching.** Recompute the budget by hand from the Windows constants: 9x19 px cell, pane chrome 34x18 px and window chrome 40 px, all scaled by dpi/96. Assume a taskbar of 40 px x scale. Check the lead >= min_lead and roles >= min_role for each tab. In the shell-windows-1 round, 1920x1080@125% and 2560x1440@150% gave 6 tabs, above the spec's estimate, which is legitimate.
- **Latent PS 5.1 quoting.** A kickoff passed raw to `& claude` breaks on an embedded `"`. Grep the catalog kickoffs for quotes.

**Why:** each side's ledger mapped features by name, not by rule, so these gaps passed as "aligned".
**How to apply:** on every launcher parity review, trace liveness, lead exclusivity, env removal and the table fields on both sides, rule by rule. See [[shell-windows-review-checklist]].
