#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# =============================================================================
# claudeteamup.sh
# =============================================================================
# Idempotently initializes and starts the Claude Code multi-role team as
# independent sessions (Linux): one tmux session ct-<role> per role from
# config/claude_team_roles.json running claudeteam.sh --agent <role>, one positioned
# window per unattached session. Roles coordinate through cross-session messaging
# (ListAgents / SendMessage by --name). Agent-teams variant: claudeagents.sh.
# Windows counterpart: scripts/winenvs/claudeteamup.ps1
#
# Usage: claudeteamup [--status] [--no-windows] [--no-kickoff] [--roles a,b]
# =============================================================================

scriptSource=""
scriptCurrentPath=""
scriptsDirPath=""
claudeTeamCommonPath=""
argument=""

scriptSource="${BASH_SOURCE[0]}"
if [ -L "$scriptSource" ]; then
    scriptSource="$(readlink -f "$scriptSource" 2>/dev/null || echo "$scriptSource")"
fi
scriptCurrentPath="$(cd "$(dirname "$scriptSource")" && pwd)"
scriptsDirPath="$(cd "$scriptCurrentPath/.." && pwd)"
claudeTeamCommonPath="$scriptsDirPath/shells/linux/common/claude_team_common.sh"
. "$claudeTeamCommonPath"
CLAUDE_TEAM_MODE="sessions"
CLAUDE_TEAM_ENTRY_PATH="$scriptCurrentPath/claudeteamup.sh"
CLAUDE_TEAM_ENTRY_COMMAND="claudeteamup"

while [ "$#" -gt 0 ]; do
    argument="$1"
    case "$argument" in
        --status) CLAUDE_TEAM_OPT_STATUS="1" ;;
        --no-windows) CLAUDE_TEAM_OPT_NO_WINDOWS="1" ;;
        --no-kickoff) CLAUDE_TEAM_OPT_NO_KICKOFF="1" ;;
        --roles)
            shift
            CLAUDE_TEAM_OPT_ROLES="${1:-}"
            ;;
        --roles=*) CLAUDE_TEAM_OPT_ROLES="${argument#--roles=}" ;;
        -h|--help)
            echo "Usage: claudeteamup [--status] [--no-windows] [--no-kickoff] [--roles a,b]"
            echo "  --status      print platform, sessions, windows and positions; change nothing"
            echo "  --no-windows  start role sessions only (headless / SSH)"
            echo "  --no-kickoff  start roles without the catalog kickoff prompt"
            echo "  --roles a,b   limit to the named roles"
            exit 0
            ;;
        *) echo "[WARN] Unknown argument ignored: $argument" ;;
    esac
    shift
done

echo ""
echo "============================================================"
echo "claudeteamup.sh - Claude Code roles as independent sessions (cross-session messaging)"
echo "============================================================"
echo "[INFO] Options: status=$CLAUDE_TEAM_OPT_STATUS no-windows=$CLAUDE_TEAM_OPT_NO_WINDOWS no-kickoff=$CLAUDE_TEAM_OPT_NO_KICKOFF roles=${CLAUDE_TEAM_OPT_ROLES:-all}"

claude_team_run
