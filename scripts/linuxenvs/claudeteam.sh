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
#     on (Linux).
#
# Description:
#     Linux mirror of scripts/winenvs/claudeteam.ps1. Always sets
#     CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 for the current session (multiple
#     roles). The model is the account default (Opus 5.5 since v2.1.280), so no
#     model is pinned. Any script arguments are appended to the command line.
#
#     Permissions: --permission-mode auto for root and regular users alike.
#     CLAUDE_AGENTS_GIT_GUARD=1 enables the project git guard hook.
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
claude_args=()
claude_invoke_display=""
claude_team_args_display=""
scriptSource=""
scriptCurrentPath=""
scriptsDirPath=""
aiCliProvisionCommonPath=""

# Multiple roles: enable experimental agent teams for the session.
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"
# Enables the project git guard hook (.claude/hooks/git_guard.mjs).
export CLAUDE_AGENTS_GIT_GUARD="1"

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

# Every role runs in auto mode (classifier-reviewed, no prompts), for root and
# regular users alike; teammates inherit the lead's mode.
ai_cli_ultracode_prompt
claude_args+=("${AI_CLI_ULTRACODE_ARGS[@]}")
claude_args+=(--permission-mode auto)

claude_invoke_display="claude ${claude_args[*]}"
if [ "$#" -gt 0 ]; then
    claude_team_args_display=" $*"
fi

echo ""
echo "============================================================"
echo "claudeteam.sh"
echo "============================================================"
echo "[INFO] CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (session, multiple roles)"
echo "[INFO] Invoking: ${claude_invoke_display}${claude_team_args_display}"
echo "============================================================"
echo ""

exec claude "${claude_args[@]}" "$@"
