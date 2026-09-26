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
# Constants for dd_helper functions (single definition; dd.sh keeps only what
# its self-contained installation mode needs).
# =============================================================================

if [ "${DD_HELPER_CONSTANTS_LOADED:-false}" = "true" ]; then
    return 0
fi
DD_HELPER_CONSTANTS_LOADED=true

# Repo root: dd.sh sets CORE_NODE_ROOT_DIR before sourcing this file; if sourced alone, derive from dd_helper path (no export).
_DD_HELPER_CONST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_DD_HELPER_COMMON_DIR="$(cd "$_DD_HELPER_CONST_DIR/../common" && pwd)"
if [ -z "${CORE_NODE_ROOT_DIR:-}" ]; then
    CORE_NODE_ROOT_DIR="$(cd "$_DD_HELPER_CONST_DIR/../../../.." && pwd)"
fi

# CORE_NODE_DATA_DIR is defined once in common/runtime_environment.sh (gvar_common.sh loads it first).
if [ -z "${CORE_NODE_DATA_DIR:-}" ]; then
    source "$_DD_HELPER_COMMON_DIR/runtime_environment.sh"
fi
source "$_DD_HELPER_COMMON_DIR/prompt_common.sh"

# URL Constants
GITHUB_BASE_URL="https://raw.githubusercontent.com/accountbelongstox/core_node/refs/heads/main"
GITEE_BASE_URL="https://gitee.com/accountbelongstox/core_node/raw/main"

# Directory Paths
LINUXENVS_DIR_RELATIVE="scripts/linuxenvs"
BIN_DIR_PATH="/usr/local/bin"
CORE_NODE_TMP_DIR="$CORE_NODE_DATA_DIR/_tmp"
# Project directories whose *.sh files get CRLF -> LF and +x at startup.
DD_SH_TARGET_DIRS=("apps" "ncore" "scripts")

# Script Paths (relative to CORE_NODE_ROOT_DIR)
GITPUT_UNIFIED_SCRIPT_RELATIVE="scripts/git/gitput_unified.sh"
ROUTER_SCRIPT_RELATIVE="scripts/shells/linux/common/linux-router/lnxrouter.sh"
SYNC_ALL_MCP_SCRIPT_RELATIVE="scripts/ai_shtools/sync_all_mcp_servers.sh"
SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT_RELATIVE="scripts/shells/linux/menu_itemshells/special_software_env_manager.sh"
SERVICE_MANAGER_SCRIPT_RELATIVE="scripts/shells/linux/menu_itemshells/service_manager.sh"
INSTALL_TEST_MENU_SCRIPT_RELATIVE="scripts/shells/linux/common/install_test_menu.sh"
SYSTEM_INFO_SCRIPT_RELATIVE="scripts/shells/linux/menu_itemshells/system_info_display.sh"
UNIFIED_MANAGER_SCRIPT_RELATIVE="scripts/app_manager/linux_sh/app_manager.sh"
RESOURCE_LIMITER_SCRIPT_RELATIVE="scripts/shells/linux/common/resource_limiter_common.sh"
# 9_disable_ubuntu_auto_updates.sh was merged into the idempotent 5_system_maintenance.sh
# (mirrors + journal cleanup + disable auto-updates); it still disables auto-updates.
DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_RELATIVE="scripts/shells/linux/debian/install_shells/5_system_maintenance.sh"
AI_MCP_MANAGEMENT_MENU_SCRIPT_RELATIVE="scripts/shells/linux/menu_itemshells/menu_func/ai_mcp_management_menu.sh"

# File Paths (relative to CORE_NODE_ROOT_DIR)
GVAR_COMMON_FILE_RELATIVE="scripts/shells/linux/common/gvar_common.sh"
SETTING_BASE_FILE_RELATIVE="scripts/shells/linux/debian/install_shells/3_setting_base.sh"
PROJECT_VALIDATOR_FILE_RELATIVE="scripts/shells/linux/debian/install_shells/7_project_validator.sh"

# The single startup countdown (seconds) shown right before the menu; pending
# confirmations are stacked into it and take their defaults when it expires.
DD_MENU_COUNTDOWN_SECONDS="${DD_MENU_COUNTDOWN_SECONDS:-5}"
