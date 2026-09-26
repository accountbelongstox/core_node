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
# Menu actions opened from Linux Management (paths from constants.sh).
# =============================================================================

SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT_RELATIVE"
SERVICE_MANAGER_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$SERVICE_MANAGER_SCRIPT_RELATIVE"
INSTALL_TEST_MENU_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$INSTALL_TEST_MENU_SCRIPT_RELATIVE"
SYSTEM_INFO_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$SYSTEM_INFO_SCRIPT_RELATIVE"
UNIFIED_MANAGER_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$UNIFIED_MANAGER_SCRIPT_RELATIVE"
AI_MCP_MANAGEMENT_MENU_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/$AI_MCP_MANAGEMENT_MENU_SCRIPT_RELATIVE"
BACKUP_MANAGEMENT_SCRIPT_PATH="$CORE_NODE_ROOT_DIR/scripts/shells/linux/menu_itemshells/gitea_backup/backup_management_main.sh"

show_special_software_env_menu() {
    bash "$SPECIAL_SOFTWARE_ENV_MANAGER_SCRIPT_PATH"
}

show_service_manager() {
    bash "$SERVICE_MANAGER_SCRIPT_PATH"
}

show_backup_management() {
    if [ -f "$BACKUP_MANAGEMENT_SCRIPT_PATH" ]; then
        bash "$BACKUP_MANAGEMENT_SCRIPT_PATH"
    else
        echo "Error: Backup management script not found at: $BACKUP_MANAGEMENT_SCRIPT_PATH"
    fi
}

# Sourced so the interactive menu runs in this shell (arrow-key UI).
show_ai_mcp_management() {
    echo "Opening AI & MCP Management menu..."
    export USE_SUDO
    # shellcheck source=/dev/null
    . "$AI_MCP_MANAGEMENT_MENU_SCRIPT_PATH"
    show_ai_mcp_management_menu
}
