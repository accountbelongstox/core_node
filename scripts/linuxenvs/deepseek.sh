#!/bin/bash

# =============================================================================
# deepseek.sh - DeepSeek Harness (dsh), DeepSeek's official agent CLI
# =============================================================================
#   deepseek                  Web UI (dsh web)
#   deepseek -p "<task>"      one headless task in the current directory: answer, then exit
#   deepseek <dsh args...>    passed to dsh unchanged
# Key: secret DEEPSEEK_API_KEY_1 -> DEEPSEEK_API_KEY. A missing dsh is installed
# through 99_install_ai_tools.sh (catalog key dsh). Permissions follow dsh's own
# DSH_PERMISSION_MODE (default workspace-write).
# Windows counterpart: scripts/winenvs/deepseek.ps1.
# =============================================================================

DEEPSEEK_SECRET_KEY_NAME="DEEPSEEK_API_KEY_1"
DEEPSEEK_WEB_PROFILE="web"
DEEPSEEK_HEADLESS_PROFILE="headless"
deepseek_script_path=""
deepseek_scripts_dir=""
deepseek_common_dir=""
deepseek_api_key=""
dsh_args=()

deepseek_script_path="$(readlink -f "${BASH_SOURCE[0]}")"
deepseek_scripts_dir="$(cd "$(dirname "$deepseek_script_path")/.." && pwd)"
deepseek_common_dir="$deepseek_scripts_dir/shells/linux/common"

. "$deepseek_common_dir/ai_cli_provision_common.sh"
. "$deepseek_common_dir/secret_tool_common.sh"

ai_cli_provision "dsh"

secret_read deepseek_api_key "$DEEPSEEK_SECRET_KEY_NAME"
if [ -z "$deepseek_api_key" ]; then
    echo "[ERROR] DeepSeek API key not found ($DEEPSEEK_SECRET_KEY_NAME)."
    echo "[ACTION] Set it with dd.sh > Special Software Environment Variables > DeepSeek."
    exit 1
fi
export DEEPSEEK_API_KEY="$deepseek_api_key"

case "${1:-}" in
    "") dsh_args=("$DEEPSEEK_WEB_PROFILE") ;;
    -p|--print)
        shift
        dsh_args=(--profile "$DEEPSEEK_HEADLESS_PROFILE" "$@")
        ;;
    *) dsh_args=("$@") ;;
esac

echo "[INFO] DeepSeek Harness $(ai_cli_installed_version dsh); key $(ai_cli_mask_secret "$DEEPSEEK_API_KEY")"
echo "[INFO] Workspace: $(pwd)"
exec dsh "${dsh_args[@]}"
