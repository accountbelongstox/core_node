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
# Claude AI (Alibaba Cloud Model Studio / Qwen) Launch Script - v4
# =============================================================================
# Synopsis: Launches Claude Code via Alibaba Cloud Model Studio (Bailian /
#     DashScope) Anthropic-compatible endpoint with a Qwen model forced into
#     every slot, and experimental agent teams + ultracode force-enabled
#     (like claudeteam).
# Notes:
#     - API key is read from .secret_keys/.secret_ignore/DASHSCOPE_API_KEY_1,
#       written by the Special Software Environment Variables Manager (dd.sh /
#       dd.cmd). The same standard Model Studio API Key works for the
#       Pay-as-you-go Anthropic endpoint (default).
#     - Anthropic-compatible endpoint base URL is read from
#       DASHSCOPE_ANTHROPIC_BASE_URL_1 (default:
#       https://dashscope.aliyuncs.com/apps/anthropic, the Pay-as-you-go
#       endpoint). Switch billing plan by changing base URL + model + key:
#         * Pay-as-you-go: https://dashscope.aliyuncs.com/apps/anthropic
#             model qwen3.6-plus (standard Model Studio API Key)
#         * Coding Plan:   https://coding.dashscope.aliyuncs.com/apps/anthropic
#             model qwen3.7-plus (dedicated Coding Plan API Key)
#         * Token Plan:    https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic
#             model qwen3.6-plus (dedicated Token Plan API Key)
#       Source: https://help.aliyun.com/en/model-studio/claude-code
#     - team + ultracode are always on; --dangerously-skip-permissions is added
#       for non-root only (root is refused that flag by Claude Code).
# =============================================================================

set -e

# Variable declarations (declared at the beginning of the file)
ALI_BASE_URL=""
ALI_API_KEY=""
ALI_MODEL="qwen3.6-plus"
ultra_settings_json='{"ultracode":true}'
claude_args=()
DASHSCOPE_API_KEY=""
DASHSCOPE_ANTHROPIC_BASE_URL=""
DASHSCOPE_ANTHROPIC_MODEL=""
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
echo "Claude AI (Alibaba Model Studio / Qwen) - v4 [qwen + team + ultracode]"
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

# Load API key (standard Model Studio API Key; works for Pay-as-you-go).
DASHSCOPE_API_KEY=$(read_secret_file "$secret_dir/DASHSCOPE_API_KEY_1")

# Load Anthropic-compatible base URL with fallback to the Pay-as-you-go default.
DASHSCOPE_ANTHROPIC_BASE_URL=$(read_secret_file "$secret_dir/DASHSCOPE_ANTHROPIC_BASE_URL_1")
if [ -z "$DASHSCOPE_ANTHROPIC_BASE_URL" ]; then
    DASHSCOPE_ANTHROPIC_BASE_URL="https://dashscope.aliyuncs.com/apps/anthropic"
fi

# Load Qwen model with fallback to qwen3.6-plus (Pay-as-you-go default).
DASHSCOPE_ANTHROPIC_MODEL=$(read_secret_file "$secret_dir/DASHSCOPE_ANTHROPIC_MODEL_1")
if [ -z "$DASHSCOPE_ANTHROPIC_MODEL" ]; then
    DASHSCOPE_ANTHROPIC_MODEL="$ALI_MODEL"
fi
ALI_MODEL="$DASHSCOPE_ANTHROPIC_MODEL"

# Set the Claude Code environment variables
export ANTHROPIC_BASE_URL="$DASHSCOPE_ANTHROPIC_BASE_URL"
if [ -n "$DASHSCOPE_API_KEY" ]; then
    export ANTHROPIC_AUTH_TOKEN="$DASHSCOPE_API_KEY"
fi
export ANTHROPIC_MODEL="$ALI_MODEL"
# Force the model into every slot so agent-teams / subagents / background tasks
# also run through the Model Studio Anthropic gateway.
export CLAUDE_CODE_SUBAGENT_MODEL="$ALI_MODEL"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$ALI_MODEL"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$ALI_MODEL"

# Configuration summary
echo "API Endpoint: $ANTHROPIC_BASE_URL"
echo "Model: $ANTHROPIC_MODEL (forced: main + subagents + background)"
echo "Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (force-enabled)"
echo "Ultracode: --settings $ultra_settings_json (force-enabled)"

if [ -z "$DASHSCOPE_API_KEY" ]; then
    echo ""
    echo "[ERROR] Alibaba DashScope API Key not found!"
    echo ""
    echo "Please set up your credentials using dd.sh:"
    echo "  1. Run sudo $projectRootPath/dd.sh"
    echo "  2. Navigate to: Special Software Environment Variables"
    echo "  3. Select: Alibaba DashScope (Qwen)"
    echo "  4. Set your DASHSCOPE_API_KEY (and optionally DASHSCOPE_ANTHROPIC_BASE_URL"
    echo "     + DASHSCOPE_ANTHROPIC_MODEL to switch to Coding Plan / Token Plan)"
    echo ""
    echo "Alternatively, create the secret file manually:"
    echo "  $secret_dir/DASHSCOPE_API_KEY_1"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
else
    echo "API Key: $DASHSCOPE_API_KEY (loaded)"
fi
echo "============================================================"
echo ""

# Build claude args: ultracode settings always on; skip-permissions for non-root
# (root already has full permissions and Claude Code refuses that flag as root).
claude_args+=(--settings "$ultra_settings_json")
if [ "$EUID" -ne 0 ]; then
    claude_args+=(--permission-mode bypassPermissions --dangerously-skip-permissions)
fi

# Launch tool
echo "============================================================"
echo "Press Enter to start Claude AI (Alibaba Model Studio) [qwen + team + ultracode]..."
echo "============================================================"
read -p "Press Enter to continue..."

echo ""
echo "Executing: claude ${claude_args[*]}"
echo ""
echo "Environment: ANTHROPIC_BASE_URL='${ANTHROPIC_BASE_URL}', ANTHROPIC_MODEL='${ANTHROPIC_MODEL}'"
echo ""

exec claude "${claude_args[@]}" "$@"
