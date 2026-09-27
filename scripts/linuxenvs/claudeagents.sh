#!/bin/bash

# =============================================================================
# claudeagents.sh
# =============================================================================
# Idempotently starts one Claude Code agent-team lead on Linux. The lead uses
# the project agent definitions to spawn only the teammates needed by the task;
# Claude Code owns their task list, messaging, panes and lifecycle.
# Independent-sessions variant (same layout, sessions.kickoff_lead): claudeteamup.sh.
# Windows counterpart: scripts/winenvs/claudeagents.ps1
#
# Usage: claudeagents [--status] [--no-windows] [--no-kickoff] [--roles a,b]
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
CLAUDE_TEAM_MODE="team"
CLAUDE_TEAM_ENTRY_PATH="$scriptCurrentPath/claudeagents.sh"
CLAUDE_TEAM_ENTRY_COMMAND="claudeagents"

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
            echo "Usage: claudeagents [--status] [--no-windows] [--no-kickoff] [--roles a,b]"
            echo "  --status      dry run: print the plan (terminal, cell budget, tabs, panes, commands); change nothing"
            echo "  --no-windows  start the lead without opening or attaching a terminal (headless / SSH)"
            echo "  --no-kickoff  start roles without the catalog kickoff prompt"
            echo "  --roles a,b   limit the teammate types named in the lead kickoff (the lead always starts)"
            exit 0
            ;;
        *) echo "[WARN] Unknown argument ignored: $argument" ;;
    esac
    shift
done

echo ""
echo "============================================================"
echo "claudeagents.sh - Claude Code agent team: one lead, teammates on demand"
echo "============================================================"
echo "[INFO] Options: status=$CLAUDE_TEAM_OPT_STATUS no-windows=$CLAUDE_TEAM_OPT_NO_WINDOWS no-kickoff=$CLAUDE_TEAM_OPT_NO_KICKOFF roles=${CLAUDE_TEAM_OPT_ROLES:-all}"

claude_team_run
