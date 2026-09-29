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
# claudeagents.sh
# =============================================================================
# Idempotently initializes and starts the Claude Code multi-role team in the
# official agent-teams mode (Linux): one orchestrator session ca-orchestrator running
# claudeteam.sh --agent orchestrator --teammate-mode tmux in one full-screen window. The
# user gives the lead one task; the lead spawns the other roles of
# config/claude_team_roles.json as teammates (split panes) from .claude/agents, and
# the team coordinates through the shared task list and mailbox. The lead is also
# reachable from other sessions through cross-session messaging (--name ca-orchestrator).
# Independent-sessions variant: claudeteamup.sh.
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
            echo "  --status      print platform, sessions, windows and positions; change nothing"
            echo "  --no-windows  start role sessions only (headless / SSH)"
            echo "  --no-kickoff  start roles without the catalog kickoff prompt"
            echo "  --roles a,b   limit the teammate types offered to the lead"
            exit 0
            ;;
        *) echo "[WARN] Unknown argument ignored: $argument" ;;
    esac
    shift
done

echo ""
echo "============================================================"
echo "claudeagents.sh - Claude Code agent team (lead + teammates)"
echo "============================================================"
echo "[INFO] Options: status=$CLAUDE_TEAM_OPT_STATUS no-windows=$CLAUDE_TEAM_OPT_NO_WINDOWS no-kickoff=$CLAUDE_TEAM_OPT_NO_KICKOFF roles=${CLAUDE_TEAM_OPT_ROLES:-all}"

claude_team_run
