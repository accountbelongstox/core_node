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
#           (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1). On a server profile device
#           it runs the server role, the same as --device-slot 1.
#       claudeteam --agent <role> [--name <session>] [claude args...]
#           Outside a team pane the session is <device>-<role>-<abbr> unless --name
#           is given, and --remote-control is added (or the manual line printed).
#           Role session: session_env.all (+ .lead for the orchestrator, which also
#           gets --teammate-mode team.teammate_mode_linux; .remote instead of .all
#           for a role with a catalog remote block). Every other role has the
#           session_env.lead variables removed. --effort comes from the agent
#           frontmatter unless given.
#       claudeteam --team-pane <team|sessions> --agent <role> --name <session>
#                  [--team-roles a,b] [--team-no-kickoff] [claude args...]
#           Pane of claudeagents (team) / claudeteamup (sessions), same options as
#           claudeteam.ps1: first writes <state dir>/<session>.pid (this shell keeps
#           the PID while claude runs as its child), then appends the catalog
#           kickoff expanded for that mode; a remote
#           role pane runs the ssh loop to its server tmux session instead.
#       claudeteam --device-slot <n> [claude args...]
#           Cross-device slot: the device profile (gpu | server | desktop) and
#           slot <n> pick the role from device_profiles; the session is named
#           <device>-<role>-<abbr> (Tailscale device name) with --remote-control,
#           or prints the manual /remote-control line. No role = plain claude.
#     Permissions: --permission-mode auto for root and regular users alike.
#     CLAUDE_AGENTS_SESSION=1 enables the project hooks (git guard, team gate).
#     The model is the agent's frontmatter model (--agent) or the account default.
#
# Notes:
#     - Tool Name: Claude AI (Agent Teams)
#     - Command Prefix: claudeteam
#     - File Name: claudeteam.sh
#     - Idempotent: it sets session-only environment variables, runs claude as a
#       child (a post-exit chown hands the shared config dir back to the real
#       user after root runs), and exits with claude's exit code.
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
aiSharedLoginCommonPath=""
realUserHome=""
claudeExitCode=0
deviceSlot=""
deviceProfile=""
deviceRole=""
deviceRemoteHint=""
remoteControlName=""
passthroughHasRemoteControl="0"
claudeDeviceProfileCommonPath=""
claudeSettingsPresetPath=""
sharedConfigHome=""
sharedConfigOwner=""

# Root runs write root-owned files (credentials included) into the shared
# config dir; hand ownership back to the real user so their own sessions keep
# reading the same login. No-op for non-root or a root-owned config dir.
claude_team_restore_shared_owner() {
    [ "$(id -u)" -eq 0 ] || return 0
    case "$CLAUDE_CONFIG_DIR" in
        /root|/root/*|"") return 0 ;;
    esac
    sharedConfigHome="$(dirname "$CLAUDE_CONFIG_DIR")"
    sharedConfigOwner="$(stat -c '%u:%g' "$sharedConfigHome" 2>/dev/null || echo '0:0')"
    if [ "$sharedConfigOwner" != "0:0" ]; then
        chown -R "$sharedConfigOwner" "$CLAUDE_CONFIG_DIR" 2>/dev/null || true
    fi
}

# Initialize path variables
scriptSource="${BASH_SOURCE[0]}"
if [ -L "$scriptSource" ]; then
    scriptSource="$(readlink -f "$scriptSource" 2>/dev/null || echo "$scriptSource")"
fi
scriptCurrentPath="$(cd "$(dirname "$scriptSource")" && pwd)"
scriptsDirPath="$(cd "$scriptCurrentPath/.." && pwd)"
projectRootPath="$(cd "$scriptsDirPath/.." && pwd)"
claudeTeamCommonPath="$scriptsDirPath/shells/linux/common/claude_team_common.sh"
aiCliProvisionCommonPath="$scriptsDirPath/shells/linux/common/ai_cli_provision_common.sh"
claudeDeviceProfileCommonPath="$scriptsDirPath/shells/linux/common/claude_device_profile_common.sh"
claudeSettingsPresetPath="$scriptsDirPath/ai_shtools/claude_team_settings.py"

# Shared login: default claude's config/auth directory to the real desktop
# user's, resolved through the shared-login helpers of 99_install_ai_tools.sh (never hardcoded:
# the user comes from detect_system_user, the dir from the tools catalog), so
# root windows share the real user's login, settings and session state. Login
# shells already export the same value via /etc/profile.d; non-login shells
# (tmux panes, scripts) resolve it here. An explicit CLAUDE_CONFIG_DIR wins.
aiSharedLoginCommonPath="$scriptsDirPath/shells/linux/debian/install_shells/99_install_ai_tools.sh"
if [ -f "$aiSharedLoginCommonPath" ]; then
    . "$aiSharedLoginCommonPath"
fi
if [ -z "${CLAUDE_CONFIG_DIR:-}" ] && command -v ai_shared_login_real_home >/dev/null 2>&1; then
    realUserHome="$(ai_shared_login_real_home 2>/dev/null)"
    if [ -n "$realUserHome" ] && [ -d "$realUserHome" ]; then
        CLAUDE_CONFIG_DIR="$(ai_catalog_expand_config_dir "claude" "$realUserHome" 2>/dev/null)"
        [ -n "$CLAUDE_CONFIG_DIR" ] && export CLAUDE_CONFIG_DIR
    fi
fi
if [ -z "${CLAUDE_CONFIG_DIR:-}" ]; then
    export CLAUDE_CONFIG_DIR="$HOME/.claude"
fi

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
        --device-slot)
            shift
            deviceSlot="${1:-}"
            ;;
        --device-slot=*) deviceSlot="${argument#--device-slot=}" ;;
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
        --remote-control|--remote-control=*|--rc)
            passthroughHasRemoteControl="1"
            passthrough_args+=("$argument")
            ;;
        *) passthrough_args+=("$argument") ;;
    esac
    shift
done

. "$claudeTeamCommonPath"
claude_team_pin_wayland_display
if [ -n "$teamMode" ]; then
    CLAUDE_TEAM_MODE="$teamMode"
fi
CLAUDE_TEAM_OPT_ROLES="$teamRoles"
CLAUDE_TEAM_OPT_NO_KICKOFF="$noKickoff"
if claude_team_load_catalog >/dev/null 2>&1; then
    catalogLoaded="1"
fi

# Plain claudeteam (no role, no slot, no team pane) on a server: run the
# server profile role, the same as py passing --device-slot 1.
if [ -z "$deviceSlot" ] && [ -z "$teamMode" ] && [ -z "$agentName" ]; then
    . "$claudeDeviceProfileCommonPath"
    deviceProfile="$(claude_device_profile)"
    claude_device_debug
    if [ "$deviceProfile" = "server" ]; then
        deviceSlot="1"
        echo "[DEBUG] auto slot: plain claudeteam on a server profile -> --device-slot 1"
    else
        echo "[INFO] Device $(claude_device_name), profile $deviceProfile: standalone lead (server profile runs the server role)"
    fi
fi

# Cross-device slot: resolve the role and session name for this device.
if [ -n "$deviceSlot" ]; then
    . "$claudeDeviceProfileCommonPath"
    deviceProfile="$(claude_device_profile)"
    deviceRole="$(claude_device_slot_role "$deviceProfile" "$deviceSlot")"
    claude_device_debug
    echo "[DEBUG] slot: profile=$deviceProfile slot=$deviceSlot role=${deviceRole:-<none>}"
    echo "[INFO] Device $(claude_device_name) ($(claude_device_ipv4)), profile $deviceProfile, slot $deviceSlot: ${deviceRole:-plain Claude Code}"
    if [ -n "$deviceRole" ]; then
        agentName="$deviceRole"
        sessionName="$(claude_device_session_name "$deviceRole")"
        passthrough_args=(--agent "$agentName" --name "$sessionName" "${passthrough_args[@]}")
        remoteControlName="$sessionName"
    fi
elif [ -z "$teamMode" ] && [ -n "$agentName" ]; then
    . "$claudeDeviceProfileCommonPath"
    if [ -z "$sessionName" ]; then
        sessionName="$(claude_device_session_name "$agentName")"
        passthrough_args=(--name "$sessionName" "${passthrough_args[@]}")
    fi
    remoteControlName="$sessionName"
fi

# Role pane: the PID file first (this shell keeps the PID while claude runs as
# its child), so the launcher sees the role while the CLI provisioning below
# still runs.
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

# User preset (config user_settings_preset): cross-session messaging settings,
# applied idempotently to $CLAUDE_CONFIG_DIR/settings.json on every launch.
python3 "$claudeSettingsPresetPath"
claude_team_restore_shared_owner

if [ -n "$deviceSlot" ] && [ -z "$deviceRole" ]; then
    claude "${passthrough_args[@]}"
    claudeExitCode=$?
    claude_team_restore_shared_owner
    exit $claudeExitCode
fi
echo "[DEBUG] remote-control decision: remoteControlName=${remoteControlName:-<empty>} passthroughHasRemoteControl=$passthroughHasRemoteControl teamMode=${teamMode:-<none>} agent=${agentName:-<none>} deviceRole=${deviceRole:-<none>} deviceSlot=${deviceSlot:-<none>}"
if [ -n "$remoteControlName" ] && [ "$passthroughHasRemoteControl" = "0" ]; then
    claude_device_remote_control_debug "$remoteControlName"
    if claude_device_remote_control_supported; then
        passthrough_args+=(--remote-control "$remoteControlName")
    else
        deviceRemoteHint="[ACTION] Remote Control cannot be added at launch: type /remote-control $remoteControlName in this session"
    fi
fi

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
# Keep every grid/team window on the same claude build: a background auto-update
# re-triggers the version-gated onboarding/login screens independently in each
# window. Upgrades stay manual through ai_cli_provision above.
export DISABLE_AUTOUPDATER="1"

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
echo "[INFO] Claude config: $CLAUDE_CONFIG_DIR (auth, settings and sessions; root shares the real user's dir by default)"
echo "[INFO] Environment: ${CLAUDE_TEAM_SPEC_ENV[*]:-none} $CLAUDE_TEAM_GIT_GUARD_ENV; removed: ${CLAUDE_TEAM_SPEC_UNSET[*]:-none}"
echo "[INFO] Invoking: ${claude_invoke_display}"
if [ -n "$deviceRemoteHint" ]; then
    echo "$deviceRemoteHint"
fi
echo "============================================================"
echo ""

# Project agents (.claude/agents) and CLAUDE.md resolve from the working
# directory, so claude always starts in the core_node root.
cd "$projectRootPath" || exit 1

# Wrap (not exec) so the shared-dir repair below runs after claude exits. The
# PID file written for team panes still matches: this shell stays alive exactly
# as long as claude.
claude "${claude_args[@]}"
claudeExitCode=$?
claude_team_restore_shared_owner
exit $claudeExitCode
