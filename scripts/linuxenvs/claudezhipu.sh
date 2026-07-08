#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables; Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# =============================================================================
# Claude AI (Zhipu AI / GLM) Launch Script - v3
# =============================================================================
# Synopsis: Launches Claude Code using Zhipu AI (GLM) API
# Notes: v3 - simplified, no custom user dir, uses current user directly
# =============================================================================

set -e

# Variable declarations
ZHIPU_BASE_URL=""
ZHIPU_API_KEY=""
ZHIPU_MODEL="glm-5.2"

# Ensure DISABLE_AUTOUPDATER is set for Claude Code
export DISABLE_AUTOUPDATER="1"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"

# Check if running as root - skip --dangerously-skip-permissions flag for root
if [ "$EUID" -eq 0 ]; then
    claude_command="claude"
else
    claude_command="claude --dangerously-skip-permissions"
fi

echo ""
echo "============================================================"
echo "Claude AI (Zhipu AI / GLM) - v3"
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
    ZHIPUAI_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
fi

# Set the Claude Code environment variables
export ANTHROPIC_BASE_URL="$ZHIPUAI_BASE_URL"
if [ -n "$ZHIPUAI_API_KEY" ]; then
    export ANTHROPIC_AUTH_TOKEN="$ZHIPUAI_API_KEY"
    export ANTHROPIC_API_KEY="$ZHIPUAI_API_KEY"
fi
export ANTHROPIC_MODEL="$ZHIPU_MODEL"

# Configuration summary
echo "API Endpoint: $ANTHROPIC_BASE_URL"
echo "Model: $ANTHROPIC_MODEL"

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
    if [ ${#ZHIPUAI_API_KEY} -gt 8 ]; then
        masked_key="${ZHIPUAI_API_KEY:0:4}***${ZHIPUAI_API_KEY: -4}"
        echo "API Key: $masked_key (loaded)"
    else
        echo "API Key: [REDACTED] (loaded)"
    fi
fi
echo "============================================================"
echo ""

# Build launch command display
env_vars_parts=()
env_vars_parts+=("ANTHROPIC_BASE_URL='${ANTHROPIC_BASE_URL}'")
env_vars_parts+=("ANTHROPIC_AUTH_TOKEN='[REDACTED]'")
env_vars_parts+=("ANTHROPIC_MODEL='${ANTHROPIC_MODEL}'")

if [ ${#env_vars_parts[@]} -gt 0 ]; then
    env_vars_command=$(IFS=' ' ; echo "${env_vars_parts[*]}")
    full_command_display="$env_vars_command $claude_command"
else
    full_command_display="$claude_command"
fi

# Launch tool
echo "============================================================"
echo "Press Enter to start Claude AI (Zhipu AI / GLM)..."
echo "============================================================"
read -p "Press Enter to continue..."

echo ""
echo "Executing: $claude_command"
echo ""
echo "Environment: ANTHROPIC_BASE_URL='${ANTHROPIC_BASE_URL}', ANTHROPIC_MODEL='${ANTHROPIC_MODEL}'"
echo ""
echo "Press Enter to continue..."
read

exec $claude_command "$@"
