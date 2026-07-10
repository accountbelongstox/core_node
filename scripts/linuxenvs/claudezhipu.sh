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
# Claude AI (Zhipu AI / GLM) Launch Script - v4
# =============================================================================
# Synopsis: Launches Claude Code via Zhipu AI (GLM) Anthropic-compatible
#     endpoint with the model forced to glm-5.2 everywhere, and experimental
#     agent teams + ultracode force-enabled (like claudeteam).
# Notes:
#     - API key is read from .secret_keys/.secret_ignore/ZHIPUAI_API_KEY_1,
#       written by the Special Software Environment Variables Manager (dd.sh).
#     - Zhipu /api/anthropic is the Anthropic-compatible endpoint for Claude
#       Code (NOT /api/paas/v4 which is OpenAI-compatible).
#     - team + ultracode are always on; --dangerously-skip-permissions is added
#       for non-root only (root is refused that flag by Claude Code).
# =============================================================================

set -e

# Variable declarations (declared at the beginning of the file)
ZHIPU_BASE_URL=""
ZHIPU_API_KEY=""
ZHIPU_MODEL="glm-5.2"
ultra_settings_json='{"ultracode":true}'
claude_args=()
force_model_choice=""
force_model_enabled=0
ZHIPUAI_API_KEY=""
ZHIPUAI_BASE_URL=""
masked_key=""
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
echo "Claude AI (Zhipu AI / GLM) - v4 [glm-5.2 + team + ultracode]"
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
ZHIPUAI_API_KEY=$(read_secret_file "$secret_dir/ZHIPUAI_API_KEY_1")

# Load base URL with fallback to default
ZHIPUAI_BASE_URL=$(read_secret_file "$secret_dir/ZHIPUAI_BASE_URL_1")
if [ -z "$ZHIPUAI_BASE_URL" ]; then
    ZHIPUAI_BASE_URL="https://open.bigmodel.cn/api/anthropic"
fi

# Set the Claude Code environment variables (gateway always; model slots opt-in below).
export ANTHROPIC_BASE_URL="$ZHIPUAI_BASE_URL"
if [ -n "$ZHIPUAI_API_KEY" ]; then
    export ANTHROPIC_AUTH_TOKEN="$ZHIPUAI_API_KEY"
fi

# Optional: force glm-5.2 everywhere. Opt-in prompt, default No (like claudeteam).
read -r -p "Force model ${ZHIPU_MODEL} everywhere (main + subagents + background)? [y/N]: " force_model_choice || force_model_choice=""
if [ "$force_model_choice" = "y" ] || [ "$force_model_choice" = "Y" ]; then
    force_model_enabled=1
fi

if [ "$force_model_enabled" -eq 1 ]; then
    export ANTHROPIC_MODEL="$ZHIPU_MODEL"
    export CLAUDE_CODE_SUBAGENT_MODEL="$ZHIPU_MODEL"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="$ZHIPU_MODEL"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="$ZHIPU_MODEL"
    echo "[NOTE] ${ZHIPU_MODEL} forced for main session, subagents and background (Haiku/Sonnet) slots."
fi

# Configuration summary
echo "API Endpoint: $ANTHROPIC_BASE_URL"
if [ "$force_model_enabled" -eq 1 ]; then
    echo "Model: $ZHIPU_MODEL (forced: main + subagents + background)"
else
    echo "Model: off (default N) - using the account default model"
fi
echo "Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (force-enabled)"
echo "Ultracode: --settings $ultra_settings_json (force-enabled)"

if [ -z "$ZHIPUAI_API_KEY" ]; then
    echo ""
    echo "[ERROR] Zhipu AI API Key not found!"
    echo ""
    echo "Please set up your credentials using dd.sh:"
    echo "  1. Run sudo $projectRootPath/dd.sh"
    echo "  2. Navigate to: Special Software Environment Variables"
    echo "  3. Select: Zhipu AI (GLM)"
    echo "  4. Set your ZHIPUAI_API_KEY"
    echo ""
    echo "Alternatively, create the secret file manually:"
    echo "  $secret_dir/ZHIPUAI_API_KEY_1"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
else
    echo "API Key: $ZHIPUAI_API_KEY (loaded)"
fi
echo "============================================================"
echo ""

# Build claude args: ultracode settings always on; skip-permissions for non-root;
# --model only when opted in (like claudeteam).
claude_args+=(--settings "$ultra_settings_json")
if [ "$force_model_enabled" -eq 1 ]; then
    claude_args+=(--model "$ZHIPU_MODEL")
fi
if [ "$EUID" -ne 0 ]; then
    claude_args+=(--permission-mode bypassPermissions --dangerously-skip-permissions)
fi

# Launch tool
echo "============================================================"
echo "Press Enter to start Claude AI (Zhipu AI / GLM) [glm-5.2 + team + ultracode]..."
echo "============================================================"
read -p "Press Enter to continue..."

echo ""
echo "Executing: claude ${claude_args[*]}"
echo ""
echo "Environment: ANTHROPIC_BASE_URL='${ANTHROPIC_BASE_URL}'$(if [ "$force_model_enabled" -eq 1 ]; then echo ", ANTHROPIC_MODEL='${ZHIPU_MODEL}'"; fi)"
echo ""

exec claude "${claude_args[@]}" "$@"
