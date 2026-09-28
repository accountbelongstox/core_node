#!/bin/bash

# =============================================================================
# claudeteamup.sh
# =============================================================================
# Idempotently initializes and starts the Claude Code multi-role team as
# independent sessions (Linux). Every enabled role of .claude/agents (catalog
# config/claude_team_roles.json rows override enabled/remote) runs as its own
# claude session ct-<role> in one tmux session (layout.tmux_session, socket
# sessions.tmux_socket), packed into tabs with an equal grid and shown in one
# maximized terminal (headless: tmux attaches in the current tty). The lead
# ct-orchestrator gets the sessions.kickoff_lead; roles coordinate through
# cross-session messaging (ListAgents / SendMessage by --name) and the shared task
# list. Same layout as claudeagents.sh, which differs in the lead kickoff only.
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
            echo "  --status      dry run: print the plan (terminal, cell budget, tabs, panes, commands); change nothing"
            echo "  --no-windows  start the role sessions without opening or attaching a terminal (headless / SSH)"
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
