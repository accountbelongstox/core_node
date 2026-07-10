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
# Claude AI (Volcano Ark / Doubao) Launch Script - v4
# =============================================================================
# Synopsis: Launches Claude Code via Volcano Ark (Doubao) coding endpoint with
#     the model forced to glm-5.2 everywhere, experimental agent teams
#     force-enabled, and ultracode opt-in (default No).
# Notes:
#     - API key is read from .secret_keys/.secret_ignore/ARK_API_KEY_1, written
#       by the Special Software Environment Variables Manager (dd.sh / dd.cmd).
#     - Volcano Ark /api/coding is the Anthropic-compatible endpoint and serves
#       glm-5.2 (model is glm-5.2, NOT doubao).
#     - team is always on; ultracode is opt-in; --dangerously-skip-permissions
#       is added for non-root only (root is refused that flag by Claude Code).
# =============================================================================

set -e

# Variable declarations (declared at the beginning of the file)
VOLC_BASE_URL=""
VOLC_API_KEY=""
VOLC_MODEL="glm-5.2"
ultra_settings_json='{"ultracode":true}'
claude_args=()
ultra_choice=""
ultra_enabled=0
ARK_API_KEY=""
ARK_BASE_URL=""
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
echo "Claude AI (Volcano Ark / Doubao) - v4 [glm-5.2 + team + opt-in ultracode]"
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
ARK_API_KEY=$(read_secret_file "$secret_dir/ARK_API_KEY_1")

# Load base URL with fallback to default
ARK_BASE_URL=$(read_secret_file "$secret_dir/ARK_BASE_URL_1")
if [ -z "$ARK_BASE_URL" ]; then
    ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/coding"
fi

# Set the Claude Code environment variables (gateway + glm-5.2 forced everywhere).
export ANTHROPIC_BASE_URL="$ARK_BASE_URL"
if [ -n "$ARK_API_KEY" ]; then
    export ANTHROPIC_AUTH_TOKEN="$ARK_API_KEY"
fi
export ANTHROPIC_MODEL="$VOLC_MODEL"
# Force glm-5.2 into every slot so agent-teams / subagents / background tasks
# also run through the Coding Plan gateway (official model ID: glm-5.2).
export CLAUDE_CODE_SUBAGENT_MODEL="$VOLC_MODEL"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$VOLC_MODEL"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$VOLC_MODEL"

# Configuration summary
echo "API Endpoint: $ANTHROPIC_BASE_URL"
echo "Model: $VOLC_MODEL (forced: main + subagents + background)"
echo "Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (force-enabled)"

if [ -z "$ARK_API_KEY" ]; then
    echo ""
    echo "[ERROR] Volcano Ark API Key not found!"
    echo ""
    echo "Please set up your credentials using dd.sh:"
    echo "  1. Run sudo $projectRootPath/dd.sh"
    echo "  2. Navigate to: Special Software Environment Variables"
    echo "  3. Select: Volcano Ark (Doubao)"
    echo "  4. Set your ARK_API_KEY"
    echo ""
    echo "Alternatively, create the secret file manually:"
    echo "  $secret_dir/ARK_API_KEY_1"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
else
    echo "API Key: $ARK_API_KEY (loaded)"
fi
echo "============================================================"
echo ""

# Build claude args: glm-5.2 always on; ultracode opt-in; skip-permissions for non-root.
claude_args+=(--model "$VOLC_MODEL")

# Ultracode: opt-in prompt (default No).
read -r -p "Enable ultracode? [y/N]: " ultra_choice || ultra_choice=""
if [ "$ultra_choice" = "y" ] || [ "$ultra_choice" = "Y" ]; then
    ultra_enabled=1
    claude_args+=(--settings "$ultra_settings_json")
fi

if [ "$ultra_enabled" -eq 1 ]; then
    echo "Ultracode: enabled (--settings $ultra_settings_json)"
else
    echo "Ultracode: off (default N)"
fi

if [ "$EUID" -ne 0 ]; then
    claude_args+=(--permission-mode bypassPermissions --dangerously-skip-permissions)
fi

# Launch tool
echo "============================================================"
echo "Press Enter to start Claude AI (Volcano Ark) [glm-5.2 + team + opt-in ultracode]..."
echo "============================================================"
read -p "Press Enter to continue..."

echo ""
echo "Executing: claude ${claude_args[*]}"
echo ""
echo "Environment: ANTHROPIC_BASE_URL='${ANTHROPIC_BASE_URL}', ANTHROPIC_MODEL='${VOLC_MODEL}'"
echo ""

exec claude "${claude_args[@]}" "$@"
