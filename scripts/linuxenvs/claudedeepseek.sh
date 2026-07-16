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
# Claude AI (DeepSeek) Launch Script - v4
# =============================================================================
# Synopsis: Launches Claude Code via the DeepSeek Anthropic-compatible endpoint
#     with the model forced to deepseek-v4-pro everywhere, experimental agent
#     teams force-enabled, and ultracode opt-in (default Yes).
# Notes:
#     - API key is read from .secret_keys/.secret_ignore/DEEPSEEK_API_KEY_1,
#       written by the Special Software Environment Variables Manager (dd.sh /
#       dd.cmd).
#     - DeepSeek serves BOTH API formats: OpenAI (https://api.deepseek.com,
#       /chat/completions) and Anthropic (https://api.deepseek.com/anthropic,
#       /v1/messages). Claude Code needs the /anthropic endpoint, so
#       DEEPSEEK_BASE_URL defaults to https://api.deepseek.com/anthropic.
#     - deepseek-v4-pro is the flagship model (claude-opus* maps to it). The
#       legacy deepseek-chat / deepseek-reasoner names are deprecated on
#       2026/07/24.
#     - team is always on; ultracode is opt-in; --dangerously-skip-permissions
#       is added for non-root only (root is refused that flag by Claude Code).
# Source: https://api-docs.deepseek.com/guides/anthropic_api
# =============================================================================

set -e

# Variable declarations (declared at the beginning of the file)
DEEPSEEK_BASE_URL=""
DEEPSEEK_API_KEY=""
DEEPSEEK_MODEL="deepseek-v4-pro"
ultra_settings_json='{"ultracode":true}'
claude_args=()
ultra_choice=""
ultra_enabled=0
secret_dir=""
scriptSource=""
scriptCurrentPath=""
scriptsDirPath=""
projectRootPath=""

# Ensure DISABLE_AUTOUPDATER is set for Claude Code
export DISABLE_AUTOUPDATER="1"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"

# Force-enable experimental agent teams (like claudeteam).
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="1"

echo ""
echo "============================================================"
echo "Claude AI (DeepSeek) - v4 [deepseek-v4-pro + team + opt-in ultracode]"
echo "============================================================"
echo ""

# Initialize path variables
scriptSource="${BASH_SOURCE[0]}"
if [ -L "$scriptSource" ]; then
    scriptSource="$(readlink -f "$scriptSource" 2>/dev/null || echo "$scriptSource")"
fi
scriptCurrentPath="$(cd "$(dirname "$scriptSource")" && pwd)"
scriptsDirPath="$(cd "$scriptCurrentPath/.." && pwd)"
projectRootPath="$(cd "$scriptsDirPath/.." && pwd)"

# Load environment variables from secret files
secret_dir="$projectRootPath/.secret_keys/.secret_ignore"

read_secret_file() {
    local file_path="$1"
    local value=""
    if [ -f "$file_path" ]; then
        local first_bytes=$(head -c 3 "$file_path" 2>/dev/null | od -An -tx1 2>/dev/null | tr -d ' \n' 2>/dev/null || echo "")
        if [ "$first_bytes" = "efbbbf" ]; then
            while IFS= read -r line || [ -n "$line" ]; do
                trimmed_line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
                if [ -n "$trimmed_line" ]; then
                    value="$trimmed_line"
                    break
                fi
            done < <(dd if="$file_path" bs=1 skip=3 2>/dev/null)
        else
            while IFS= read -r line || [ -n "$line" ]; do
                trimmed_line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
                if [ -n "$trimmed_line" ]; then
                    value="$trimmed_line"
                    break
                fi
            done < "$file_path"
        fi
    fi
    echo "$value"
}

# Load API key
DEEPSEEK_API_KEY=$(read_secret_file "$secret_dir/DEEPSEEK_API_KEY_1")

# Load base URL with fallback to the Anthropic-compatible endpoint.
# NOTE: Claude Code needs the /anthropic endpoint (/v1/messages), NOT the OpenAI
# base URL https://api.deepseek.com (/chat/completions).
DEEPSEEK_BASE_URL=$(read_secret_file "$secret_dir/DEEPSEEK_BASE_URL_1")
if [ -z "$DEEPSEEK_BASE_URL" ]; then
    DEEPSEEK_BASE_URL="https://api.deepseek.com/anthropic"
fi

# Set the Claude Code environment variables (gateway + deepseek-v4-pro forced everywhere).
export ANTHROPIC_BASE_URL="$DEEPSEEK_BASE_URL"
if [ -n "$DEEPSEEK_API_KEY" ]; then
    export ANTHROPIC_AUTH_TOKEN="$DEEPSEEK_API_KEY"
fi
export ANTHROPIC_MODEL="$DEEPSEEK_MODEL"
# Force deepseek-v4-pro into every slot so agent-teams / subagents / background
# tasks also run through the DeepSeek Anthropic gateway. DeepSeek otherwise maps
# claude-opus* -> deepseek-v4-pro and claude-haiku*/claude-sonnet* -> deepseek-v4-flash.
export CLAUDE_CODE_SUBAGENT_MODEL="$DEEPSEEK_MODEL"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$DEEPSEEK_MODEL"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$DEEPSEEK_MODEL"

# Configuration summary
echo "API Endpoint: $ANTHROPIC_BASE_URL"
echo "Model: $DEEPSEEK_MODEL (forced: main + subagents + background)"
echo "Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (force-enabled)"

if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo ""
    echo "[ERROR] DeepSeek API Key not found!"
    echo ""
    echo "Please set up your credentials using dd.sh:"
    echo "  1. Run sudo $projectRootPath/dd.sh"
    echo "  2. Navigate to: Special Software Environment Variables"
    echo "  3. Select: DeepSeek"
    echo "  4. Set your DEEPSEEK_API_KEY"
    echo ""
    echo "Alternatively, create the secret file manually:"
    echo "  $secret_dir/DEEPSEEK_API_KEY_1"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
else
    echo "API Key: $DEEPSEEK_API_KEY (loaded)"
fi
echo "============================================================"
echo ""

# Build claude args: deepseek-v4-pro always on; ultracode opt-in; skip-permissions for non-root.
claude_args+=(--model "$DEEPSEEK_MODEL")

# Ultracode: opt-in prompt (default Yes).
read -r -p "Enable ultracode? [Y/n]: " ultra_choice || ultra_choice=""
if [ "$ultra_choice" != "n" ] && [ "$ultra_choice" != "N" ]; then
    ultra_enabled=1
    claude_args+=(--settings "$ultra_settings_json")
fi

if [ "$ultra_enabled" -eq 1 ]; then
    echo "Ultracode: enabled (--settings $ultra_settings_json)"
else
    echo "Ultracode: off (opted out)"
fi

if [ "$EUID" -ne 0 ]; then
    claude_args+=(--permission-mode bypassPermissions --dangerously-skip-permissions)
fi

# Launch tool (info already shown above; start Claude directly).

echo ""
echo "Executing: claude ${claude_args[*]}"
echo ""
echo "Environment: ANTHROPIC_BASE_URL='${ANTHROPIC_BASE_URL}', ANTHROPIC_MODEL='${DEEPSEEK_MODEL}'"
echo ""

exec claude "${claude_args[@]}" "$@"
