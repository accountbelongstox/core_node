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

# Project initialization library for Linux one-click install.
# Sourced by dd.sh after gvar_common.sh, 3_setting_base.sh, 7_project_validator.sh are downloaded.
# Uses map_web_path (from gvar_common) to resolve target directory and runs project validator to clone
# the full project to CORE_NODE_PROJECT_ROOT.

# Variable declarations (must be set by caller: CORE_NODE_ROOT_DIR and paths below)
INIT_LIB_GVAR_COMMON=""
INIT_LIB_SETTING_BASE=""
INIT_LIB_PROJECT_VALIDATOR=""

# Run project initialization: source gvar_common (map path), run base setup, run project validator (clone to target).
run_project_init() {
    local root_dir="${1:-$CORE_NODE_ROOT_DIR}"
    local gvar_file="$root_dir/scripts/shells/linux/common/gvar_common.sh"
    local setting_base="$root_dir/scripts/shells/linux/debian/install_shells/3_setting_base.sh"
    local project_validator="$root_dir/scripts/shells/linux/debian/install_shells/7_project_validator.sh"

    if [ -n "$INIT_LIB_GVAR_COMMON" ] && [ -s "$INIT_LIB_GVAR_COMMON" ]; then
        gvar_file="$INIT_LIB_GVAR_COMMON"
    fi
    if [ -n "$INIT_LIB_SETTING_BASE" ] && [ -s "$INIT_LIB_SETTING_BASE" ]; then
        setting_base="$INIT_LIB_SETTING_BASE"
    fi
    if [ -n "$INIT_LIB_PROJECT_VALIDATOR" ] && [ -s "$INIT_LIB_PROJECT_VALIDATOR" ]; then
        project_validator="$INIT_LIB_PROJECT_VALIDATOR"
    fi

    if [ ! -s "$gvar_file" ]; then
        echo "[project_init_lib] ERROR: gvar_common.sh not found at $gvar_file"
        return 1
    fi

    echo "[project_init_lib] Sourcing gvar_common.sh (map path, CORE_NODE_PROJECT_ROOT)..."
    # shellcheck source=scripts/shells/linux/common/gvar_common.sh
    source "$gvar_file"

    if [ -s "$setting_base" ]; then
        echo "[project_init_lib] Running base system setup (3_setting_base.sh)..."
        bash "$setting_base" || true
    fi

    if [ ! -s "$project_validator" ]; then
        echo "[project_init_lib] ERROR: 7_project_validator.sh not found at $project_validator"
        return 1
    fi

    echo "[project_init_lib] Running project validator (clone to CORE_NODE_PROJECT_ROOT via map path)..."
    bash "$project_validator"
    return $?
}
