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
# Constants for dd_helper functions
# =============================================================================
# This file contains backup constants for dd_helper directory
# Main constants are defined in dd.sh, this is a backup copy

# URL Constants
GITHUB_BASE_URL="https://raw.githubusercontent.com/accountbelongstox/core_node/refs/heads/main"
GITEE_BASE_URL="https://gitee.com/accountbelongstox/core_node/raw/main"

# Directory Paths (relative to CORE_NODE_ROOT_DIR)
LINUXENVS_DIR_RELATIVE="scripts/linuxenvs"
BIN_DIR_PATH="/usr/local/bin"

# Temporary directory for core_node operations
CORE_NODE_TMP_DIR="/var/_core_node/_tmp"

# Script Paths (relative to CORE_NODE_ROOT_DIR)
GITPUT_UNIFIED_SCRIPT_RELATIVE="scripts/git/gitput_unified.sh"
SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT_RELATIVE="scripts/shells/linux/menu_itemshells/special_software_env_manager.sh"
SERVICE_MANAGER_SCRIPT_RELATIVE="scripts/shells/linux/menu_itemshells/service_manager.sh"
INSTALL_TEST_MENU_SCRIPT_RELATIVE="scripts/shells/linux/common/install_test_menu.sh"
SYSTEM_INFO_SCRIPT_RELATIVE="scripts/shells/linux/menu_itemshells/system_info_display.sh"
UNIFIED_MANAGER_SCRIPT_RELATIVE="scripts/app_manager/linux_sh/app_manager.sh"
ROUTER_SCRIPT_RELATIVE="scripts/shells/linux/debian/install_shells/101_lnxrouter.sh"
DISABLE_UBUNTU_AUTO_UPDATES_SCRIPT_RELATIVE="scripts/shells/linux/debian/install_shells/9_disable_ubuntu_auto_updates.sh"

# File Paths (relative to CORE_NODE_ROOT_DIR)
GVAR_COMMON_FILE_RELATIVE="scripts/shells/linux/common/gvar_common.sh"
SETTING_BASE_FILE_RELATIVE="scripts/shells/linux/debian/install_shells/2_setting_base.sh"
PROJECT_VALIDATOR_FILE_RELATIVE="scripts/shells/linux/debian/install_shells/8_project_validator.sh"
