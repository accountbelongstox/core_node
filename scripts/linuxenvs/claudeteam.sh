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
#     on, an opt-in ultracode prompt (default No), and - when ultracode is enabled
#     - an opt-in prompt (default Yes) to force Opus 4.8 everywhere (Linux).
#
# Description:
#     Linux mirror of scripts/winenvs/claudeteam.ps1. Always sets
#     CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 for the current session (multiple
#     roles). Then prompts "Enable ultracode?" (default No); when enabled it adds
#     --effort ultracode (session-only xhigh effort + automatic workflow
#     orchestration; official CLI reference, requires Claude Code v2.1.203+) and
#     prompts "Use Opus 4.8 1M as the ultracode model?" (default Yes). If accepted,
#     the pinned Opus 4.8 id plus the 1M-context suffix ("claude-opus-4-8[1m]") is
#     forced for the main session, subagents and the background Haiku/Sonnet slots,
#     running:
#         claude --effort ultracode --model claude-opus-4-8[1m] --dangerously-skip-permissions [args...]
#     The --model flag pins the main interactive model; CLAUDE_CODE_SUBAGENT_MODEL
#     pins subagents/agent-teams; ANTHROPIC_DEFAULT_OPUS_MODEL /
#     ANTHROPIC_DEFAULT_SONNET_MODEL / ANTHROPIC_DEFAULT_HAIKU_MODEL redirect the
#     opus/sonnet/haiku aliases + background traffic to Opus 4.8 too. Claude Code
#     interprets the [1m] suffix client-side as the 1M-context selector. When
#     ultracode is declined, Claude runs on the account default model. Any script
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
force_model="claude-opus-4-8[1m]"
ultra_choice=""
ultra_enabled=0
model_choice=""
force_opus_enabled=0
claude_args=()
claude_invoke_display=""
claude_team_args_display=""

# Multiple roles: enable experimental agent teams for the session.
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"

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

# Ultracode model: only asked when ultracode is enabled, default Yes. Forces Opus
# 4.8 with the 1M-context window everywhere. "$force_model" is the pinned Opus 4.8
# id plus the "[1m]" suffix ("claude-opus-4-8[1m]"), which Claude Code interprets
# client-side as the 1M-context selector (official model-config reference).
if [ "$ultra_enabled" -eq 1 ]; then
    read -r -p "Use Opus 4.8 1M (${force_model}) as the ultracode model everywhere? [Y/n]: " model_choice || model_choice=""
    if [ "$model_choice" != "n" ] && [ "$model_choice" != "N" ]; then
        force_opus_enabled=1
    fi
fi

if [ "$force_opus_enabled" -eq 1 ]; then
    # Env vars cover the model slots that have no CLI flag (official model-config
    # reference); values are the pinned Opus 4.8 1M model:
    #   - CLAUDE_CODE_SUBAGENT_MODEL     : all subagents / agent teams / workflow agents
    #   - ANTHROPIC_DEFAULT_OPUS_MODEL   : the "opus" alias (and opusplan in plan mode)
    #   - ANTHROPIC_DEFAULT_SONNET_MODEL : the "sonnet" alias (and opusplan execution)
    #   - ANTHROPIC_DEFAULT_HAIKU_MODEL  : the "haiku"/background quick-task slot
    export CLAUDE_CODE_SUBAGENT_MODEL="$force_model"
    export ANTHROPIC_DEFAULT_OPUS_MODEL="$force_model"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="$force_model"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="$force_model"
    # --model pins the main interactive model (highest-precedence startup selector).
    claude_args+=(--model "$force_model")
    # Light note shown only when the user opted in.
    echo "[NOTE] ${force_model} forced for main session, subagents and background (Haiku/Sonnet) slots - background tasks run on Opus too (higher cost/latency)."
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
if [ "$force_opus_enabled" -eq 1 ]; then
    echo "[INFO] Ultracode model: ${force_model} (main session + subagents + background Haiku/Sonnet slots)"
else
    echo "[INFO] Ultracode model: account default"
fi
echo "[INFO] Invoking: ${claude_invoke_display}${claude_team_args_display}"
echo "============================================================"
echo ""

exec claude "${claude_args[@]}" "$@"
