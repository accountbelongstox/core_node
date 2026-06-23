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
#     Launches Claude Code with multiple roles (experimental agent teams) and
#     ultracode enabled by default (Linux).
#
# Description:
#     Linux mirror of scripts/winenvs/claudeteam.ps1. Sets
#     CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 for the current session (multiple
#     roles), then runs:
#         claude --settings '{"ultracode":true}' --dangerously-skip-permissions [args...]
#     The --settings flag turns on ultracode via inline JSON. Any script
#     arguments are appended to that command line.
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
ultra_settings_json='{"ultracode":true}'
claude_args=()
claude_invoke_display=""
claude_team_args_display=""

# Multiple roles: enable experimental agent teams for the session.
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"

# Default-enable ultracode via inline JSON settings. Built as an array so the
# JSON value is always passed as a single argument (string-splitting would break
# it if the JSON ever contained spaces).
claude_args+=(--settings "$ultra_settings_json")

# Check if running as root - skip --dangerously-skip-permissions flag for root
# (root already has full permissions and Claude Code refuses that flag as root).
if [ "$EUID" -ne 0 ]; then
    claude_args+=(--dangerously-skip-permissions)
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
echo "[INFO] Ultracode settings: --settings ${ultra_settings_json}"
echo "[INFO] Invoking: ${claude_invoke_display}${claude_team_args_display}"
echo "============================================================"
echo ""

exec claude "${claude_args[@]}" "$@"
