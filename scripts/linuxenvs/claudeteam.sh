#!/bin/bash

# =============================================================================
# claudeteam.sh
# =============================================================================
#
# Synopsis:
#     Launches Claude Code for the core_node team (Linux): a standalone lead with
#     agent teams on, or one role session of claudeagents/claudeteamup.
#
# Description:
#     Linux mirror of scripts/winenvs/claudeteam.ps1. The role data comes from
#     .claude/agents/<role>.md (model, effort) and config/claude_team_roles.json
#     (session_env, kickoffs), read through claude_team_common.sh.
#       claudeteam [claude args...]
#           Standalone lead: session_env.all + session_env.lead
#           (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1).
#       claudeteam --agent <role> [--name <session>] [claude args...]
#           Role session: session_env.all (+ .lead for the orchestrator, which also
#           gets --teammate-mode team.teammate_mode_linux; .remote instead of .all
#           for a role with a catalog remote block). Every other role has the
#           session_env.lead variables removed. --effort comes from the agent
#           frontmatter unless given.
#       claudeteam --team-pane <team|sessions> --agent <role> --name <session>
#                  [--team-roles a,b] [--team-no-kickoff] [claude args...]
#           Pane of claudeagents (team) / claudeteamup (sessions), same options as
#           claudeteam.ps1: first writes <state dir>/<session>.pid (exec keeps the
#           PID), then appends the catalog kickoff expanded for that mode; a remote
#           role pane runs the ssh loop to its server tmux session instead.
#     Permissions: --permission-mode auto for root and regular users alike.
#     CLAUDE_AGENTS_SESSION=1 enables the project hooks (git guard, team gate).
#     The model is the agent's frontmatter model (--agent) or the account default.
#
# Notes:
#     - Tool Name: Claude AI (Agent Teams)
#     - Command Prefix: claudeteam
#     - File Name: claudeteam.sh
#     - Idempotent: it sets session-only environment variables and exec()s claude.
# =============================================================================

# Variable declarations (declared at the beginning of the file)
claude_args=()
passthrough_args=()
claude_invoke_display=""
scriptSource=""
scriptCurrentPath=""
scriptsDirPath=""
aiCliProvisionCommonPath=""
claudeTeamCommonPath=""
argument=""
teamMode=""
teamRoles=""
noKickoff="0"
agentName=""
sessionName=""
effortGiven="0"
withKickoff="0"
catalogLoaded="0"
pidPath=""
roleIndex=""
envPair=""
envName=""

# Initialize path variables
scriptSource="${BASH_SOURCE[0]}"
if [ -L "$scriptSource" ]; then
    scriptSource="$(readlink -f "$scriptSource" 2>/dev/null || echo "$scriptSource")"
fi
scriptCurrentPath="$(cd "$(dirname "$scriptSource")" && pwd)"
scriptsDirPath="$(cd "$scriptCurrentPath/.." && pwd)"
claudeTeamCommonPath="$scriptsDirPath/shells/linux/common/claude_team_common.sh"
aiCliProvisionCommonPath="$scriptsDirPath/shells/linux/common/ai_cli_provision_common.sh"

# Launcher options are consumed; every other argument goes to claude unchanged.
while [ "$#" -gt 0 ]; do
    argument="$1"
    case "$argument" in
        --team-pane)
            shift
            teamMode="${1:-}"
            ;;
        --team-pane=*) teamMode="${argument#--team-pane=}" ;;
        --team-roles)
            shift
            teamRoles="${1:-}"
            ;;
        --team-roles=*) teamRoles="${argument#--team-roles=}" ;;
        --team-no-kickoff) noKickoff="1" ;;
        --agent|--name)
            passthrough_args+=("$argument")
            if [ "$#" -gt 1 ]; then
                shift
                passthrough_args+=("$1")
                if [ "$argument" = "--agent" ]; then
                    agentName="$1"
                else
                    sessionName="$1"
                fi
            fi
            ;;
        --agent=*)
            agentName="${argument#--agent=}"
            passthrough_args+=("$argument")
            ;;
        --name=*)
            sessionName="${argument#--name=}"
            passthrough_args+=("$argument")
            ;;
        --effort|--effort=*)
            effortGiven="1"
            passthrough_args+=("$argument")
            ;;
        *) passthrough_args+=("$argument") ;;
    esac
    shift
done

. "$claudeTeamCommonPath"
if [ -n "$teamMode" ]; then
    CLAUDE_TEAM_MODE="$teamMode"
fi
CLAUDE_TEAM_OPT_ROLES="$teamRoles"
CLAUDE_TEAM_OPT_NO_KICKOFF="$noKickoff"
if claude_team_load_catalog >/dev/null 2>&1; then
    catalogLoaded="1"
fi

# Role pane: the PID file first (exec keeps this PID for claude), so the launcher
# sees the role while the CLI provisioning below still runs.
if [ -n "$teamMode" ] && [ -n "$agentName" ]; then
    if [ -z "$sessionName" ]; then
        sessionName="$(claude_team_session_name "$agentName")"
    fi
    pidPath="$(claude_team_pid_path "$sessionName")"
    mkdir -p "$CLAUDE_TEAM_STATE_DIR" 2>/dev/null
    { echo "$$" > "$pidPath"; } 2>/dev/null || true
    if [ "$catalogLoaded" = "1" ] && claude_team_role_is_remote "$agentName"; then
        roleIndex="$(claude_team_role_index "$agentName")"
        echo "[INFO] Remote role pane $sessionName (PID file $pidPath): ssh loop to the server tmux session"
        claude_team_remote_loop "$roleIndex" "$sessionName"
        exit 0
    fi
fi

# Idempotent AI CLI provisioning: install Claude Code with the canonical dd.sh
# workflow when the command is missing, then offer an upgrade (default N,
# auto-skip after 5 seconds) only when a newer version is published.
. "$aiCliProvisionCommonPath"
ai_cli_provision "claude"

if [ -n "$teamMode" ] && [ "$noKickoff" = "0" ]; then
    withKickoff="1"
fi
if [ "$catalogLoaded" = "1" ]; then
    claude_team_role_spec "$agentName" "$withKickoff" "$effortGiven" "$sessionName"
else
    echo "[WARN] Role catalog unreadable ($CLAUDE_TEAM_CATALOG_PATH): session_env, --effort and the kickoff are not applied"
    if [ -z "$agentName" ] || [ "$agentName" = "$CLAUDE_TEAM_LEAD_ROLE" ]; then
        CLAUDE_TEAM_SPEC_ENV=("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1")
    fi
fi
for envName in "${CLAUDE_TEAM_SPEC_UNSET[@]}"; do
    unset "$envName"
done
for envPair in "${CLAUDE_TEAM_SPEC_ENV[@]}"; do
    export "$envPair"
done
# Marks a role session: enables the project git guard and task-owner tag hook.
export CLAUDE_AGENTS_SESSION="1"

# Every role runs in auto mode; teammates inherit the lead's mode. Do not force
# ultracode: it adds a planning workflow to every substantive request.
claude_args+=(--permission-mode auto)
claude_args+=("${CLAUDE_TEAM_SPEC_ARGS[@]}")
claude_args+=("${passthrough_args[@]}")
if [ -n "$CLAUDE_TEAM_SPEC_KICKOFF" ]; then
    claude_args+=("$CLAUDE_TEAM_SPEC_KICKOFF")
fi

claude_invoke_display="claude --permission-mode auto ${CLAUDE_TEAM_SPEC_ARGS[*]} ${passthrough_args[*]}"
if [ -n "$CLAUDE_TEAM_SPEC_KICKOFF" ]; then
    claude_invoke_display="$claude_invoke_display <kickoff ${#CLAUDE_TEAM_SPEC_KICKOFF} chars>"
fi

echo ""
echo "============================================================"
echo "claudeteam.sh"
echo "============================================================"
echo "[INFO] Role: ${agentName:-standalone lead}${teamMode:+ (team mode $teamMode, PID file $pidPath)}"
echo "[INFO] Environment: ${CLAUDE_TEAM_SPEC_ENV[*]:-none} $CLAUDE_TEAM_GIT_GUARD_ENV; removed: ${CLAUDE_TEAM_SPEC_UNSET[*]:-none}"
echo "[INFO] Invoking: ${claude_invoke_display}"
echo "============================================================"
echo ""

exec claude "${claude_args[@]}"
