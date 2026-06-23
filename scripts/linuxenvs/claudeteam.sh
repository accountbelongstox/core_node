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
#     Launches Claude Code with multiple roles (experimental agent teams),
#     ultracode enabled by default, and the model forced to Opus 4.8 or newer
#     everywhere (Linux).
#
# Description:
#     Linux mirror of scripts/winenvs/claudeteam.ps1. Sets
#     CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 for the current session (multiple
#     roles), forces the newest Opus model (alias "opus[1m]" = latest Opus, e.g.
#     Opus 4.8, with the 1M-context window) for the main session, subagents and
#     the background "Haiku slot", then runs:
#         claude --model opus[1m] --settings '{"ultracode":true}' --dangerously-skip-permissions [args...]
#     The --model flag pins the main interactive model; CLAUDE_CODE_SUBAGENT_MODEL
#     pins subagents/agent-teams; ANTHROPIC_DEFAULT_HAIKU_MODEL /
#     ANTHROPIC_DEFAULT_SONNET_MODEL redirect background + sonnet-aliased traffic
#     to Opus too. Claude Code strips the [1m] suffix client-side before calling
#     the provider. The --settings flag turns on ultracode via inline JSON. Any
#     script arguments are appended to that command line.
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
force_model="opus[1m]"
force_opus_choice=""
force_opus_enabled=0
claude_args=()
claude_invoke_display=""
claude_team_args_display=""

# Multiple roles: enable experimental agent teams for the session.
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"

# Always-on: enable ultracode via inline JSON settings. Built as an array so the
# JSON value is always passed as a single argument (string-splitting would break
# it if the JSON ever contained spaces).
claude_args+=(--settings "$ultra_settings_json")

# Optional: force Opus 4.8 (or newer) everywhere. Opt-in prompt, default No.
# "$force_model" is the newest-Opus alias plus the 1M-context window ("opus[1m]");
# Claude Code strips the [1m] suffix client-side before calling the provider.
read -r -p "Force model ${force_model} everywhere (main + subagents + background)? [y/N]: " force_opus_choice || force_opus_choice=""
if [ "$force_opus_choice" = "y" ] || [ "$force_opus_choice" = "Y" ]; then
    force_opus_enabled=1
fi

if [ "$force_opus_enabled" -eq 1 ]; then
    # Env vars cover the model slots that have no CLI flag:
    #   - CLAUDE_CODE_SUBAGENT_MODEL     : subagents / experimental agent teams
    #   - ANTHROPIC_DEFAULT_HAIKU_MODEL  : background quick tasks (summaries, titles)
    #   - ANTHROPIC_DEFAULT_SONNET_MODEL : anything resolving via the sonnet alias
    export CLAUDE_CODE_SUBAGENT_MODEL="$force_model"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="$force_model"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="$force_model"
    # --model pins the main interactive model (highest-precedence selector).
    claude_args+=(--model "$force_model")
    # Light note shown only when the user opted in.
    echo "[NOTE] ${force_model} forced for main session, subagents and background (Haiku/Sonnet) slots - background tasks run on Opus too (higher cost/latency)."
fi

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
if [ "$force_opus_enabled" -eq 1 ]; then
    echo "[INFO] Forced model: ${force_model} (main session + subagents + background Haiku/Sonnet slots)"
else
    echo "[INFO] Forced model: off (default N) - using the account default model"
fi
echo "[INFO] Ultracode settings: --settings ${ultra_settings_json}"
echo "[INFO] Invoking: ${claude_invoke_display}${claude_team_args_display}"
echo "============================================================"
echo ""

exec claude "${claude_args[@]}" "$@"
