#!/bin/bash

# =============================================================================
# claudeagents.sh
# =============================================================================
# Idempotently initializes and starts the Claude Code multi-role team (Linux).
# Every enabled role of .claude/agents (catalog config/claude_team_roles.json rows
# override enabled/remote) runs as its own claude session in one tmux session
# (layout.tmux_session, socket team.tmux_socket): the lead ca-orchestrator with
# agent teams on and the team.kickoff, every other role as ct-<role> with --effort
# from its frontmatter, packed into tabs with an equal grid and shown in one
# maximized terminal (headless: tmux attaches in the current tty). The lead
# dispatches to the role sessions through cross-session messaging and the shared
# task list, and spawns ad-hoc teammates (tmux split panes) only for unowned work.
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
            echo "  --no-windows  start the role sessions without opening or attaching a terminal (headless / SSH)"
            echo "  --no-kickoff  start roles without the catalog kickoff prompt"
            echo "  --roles a,b   limit the role sessions to the named roles (the lead always starts)"
            exit 0
            ;;
        *) echo "[WARN] Unknown argument ignored: $argument" ;;
    esac
    shift
done

echo ""
echo "============================================================"
echo "claudeagents.sh - Claude Code team: every role a session, the lead with agent teams"
echo "============================================================"
echo "[INFO] Options: status=$CLAUDE_TEAM_OPT_STATUS no-windows=$CLAUDE_TEAM_OPT_NO_WINDOWS no-kickoff=$CLAUDE_TEAM_OPT_NO_KICKOFF roles=${CLAUDE_TEAM_OPT_ROLES:-all}"

claude_team_run
