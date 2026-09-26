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
# claudeteam.sh
# =============================================================================
#
# Synopsis:
#     Launches Claude Code with multiple roles (experimental agent teams) always
#     on and an opt-in ultracode prompt (default No) (Linux).
#
# Description:
#     Linux mirror of scripts/winenvs/claudeteam.ps1. Always sets
#     CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 for the current session (multiple
#     roles). Then prompts "Enable ultracode?" (default No); when enabled it adds
#     --effort ultracode (session-only xhigh effort + automatic workflow
#     orchestration; official CLI reference, requires Claude Code v2.1.203+).
#     The model is the account default (Opus 5.5 since v2.1.280), so no model is
#     pinned. Any script arguments are appended to the command line.
#
#     Root safety: when running as root, the --dangerously-skip-permissions flag
#     is dropped (root already has full permissions and Claude Code refuses that
#     flag as root), mirroring scripts/linuxenvs/claude1.sh.
#
# Notes:
#     - Tool Name: Claude AI (Agent Teams)
#     - Command Prefix: claudeteam
#     - File Name: claudeteam.sh
#     - This launcher is idempotent: it sets a session-only environment variable
#       and then exec()s claude; re-running has no cumulative side effects.
# =============================================================================

set -e

# Variable declarations (declared at the beginning of the file)
ultra_choice=""
ultra_enabled=0
claude_args=()
claude_invoke_display=""
claude_team_args_display=""
scriptSource=""
scriptCurrentPath=""
scriptsDirPath=""
aiCliProvisionCommonPath=""

# Multiple roles: enable experimental agent teams for the session.
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"

# Initialize path variables
scriptSource="${BASH_SOURCE[0]}"
if [ -L "$scriptSource" ]; then
    scriptSource="$(readlink -f "$scriptSource" 2>/dev/null || echo "$scriptSource")"
fi
scriptCurrentPath="$(cd "$(dirname "$scriptSource")" && pwd)"
scriptsDirPath="$(cd "$scriptCurrentPath/.." && pwd)"

# Idempotent AI CLI provisioning: install Claude Code with the canonical dd.sh
# workflow when the command is missing, then offer an upgrade (default N,
# auto-skip after 5 seconds) only when a newer version is published.
aiCliProvisionCommonPath="$scriptsDirPath/shells/linux/common/ai_cli_provision_common.sh"
. "$aiCliProvisionCommonPath"
ai_cli_provision "claude"

# Ultracode: opt-in prompt, default No. When enabled, ultracode is turned on via
# the dedicated effort flag "--effort ultracode" (official CLI reference; requires
# Claude Code v2.1.203+): it starts the session at xhigh effort with automatic
# workflow orchestration. Session-only - it cannot be persisted (effortLevel /
# CLAUDE_CODE_EFFORT_LEVEL accept only low/medium/high/xhigh), so it is passed on
# every launch.
read -r -p "Enable ultracode? [y/N]: " ultra_choice || ultra_choice=""
if [ "$ultra_choice" = "y" ] || [ "$ultra_choice" = "Y" ]; then
    ultra_enabled=1
    claude_args+=(--effort ultracode)
fi

# Check if running as root - skip --dangerously-skip-permissions flag for root
# (root already has full permissions and Claude Code refuses that flag as root).
if [ "$EUID" -ne 0 ]; then
    claude_args+=(--permission-mode bypassPermissions --dangerously-skip-permissions)
fi

claude_invoke_display="claude ${claude_args[*]}"
if [ "$#" -gt 0 ]; then
    claude_team_args_display=" $*"
fi

echo ""
echo "============================================================"
echo "claudeteam.sh"
echo "============================================================"
echo "[INFO] CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (session, multiple roles)"
if [ "$ultra_enabled" -eq 1 ]; then
    echo "[INFO] Ultracode: ON (--effort ultracode)"
else
    echo "[INFO] Ultracode: off (default N)"
fi
echo "[INFO] Invoking: ${claude_invoke_display}${claude_team_args_display}"
echo "============================================================"
echo ""

exec claude "${claude_args[@]}" "$@"
