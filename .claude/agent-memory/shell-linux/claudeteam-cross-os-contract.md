---
name: claudeteam-cross-os-contract
description: claudeteam.sh CLI is a cross-OS contract - pane flags mirror claudeteam.ps1 and the remote server command from BOTH launchers runs the Linux claudeteam.sh
metadata:
  type: project
---

The team launchers share one contract across OSes (D13, 2026-09-27):
- Pane options have the same names in claudeteam.sh and claudeteam.ps1: `--team-pane <team|sessions>`, `--team-no-kickoff` and `--team-roles a,b`. The PID file is `<state>/<session>.pid`. The Windows side chose these names first; Linux aligned.
- The remote role's server command is built by Windows `Get-ClaudeTeamRemoteArgument` and Linux `claude_team_remote_command` alike. Both run the server's `scripts/linuxenvs/claudeteam.sh --agent <role> --name <s> --remote-control <s> --effort <e> <kickoff>`, so any CLI change there affects the Windows launcher too.
- Roles come from the `.claude/agents` frontmatter. The catalog `config/claude_team_roles.json` is orchestrator-owned and holds only launcher data (session_env, layout, kickoffs, user_settings_merge).

**Why:** B11 parity. A silent CLI change to claudeteam.sh would break the Windows-launched remote role.

**How to apply:** before changing claudeteam.sh arguments, the PID naming or the remote command, add a parity row and send an alignment request to shell-windows. Verify with the `--status` dry run ([[wsl-verification-recipe]]).
