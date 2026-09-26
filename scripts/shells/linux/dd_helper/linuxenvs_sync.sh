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
# Linuxenvs Permission and Sync Functions
# =============================================================================

LINUXENVS_DIR_PATH="$CORE_NODE_ROOT_DIR/$LINUXENVS_DIR_RELATIVE"

# Link every scripts/linuxenvs/*.sh into BIN_DIR_PATH as <name>.sh and <name>.
# Idempotent: only missing or wrong links are (re)created.
sync_linuxenvs_to_bin() {
    local script_file=""
    local filename=""
    local source_script_path=""
    local link_path=""
    local script_count=0
    local linked_count=0
    local failed_count=0
    local -a link_cmd=(ln -sfn)
    local -a rm_cmd=(rm -f)

    if [ ! -d "$LINUXENVS_DIR_PATH" ]; then
        echo -e "\033[33m[SYNC] No linuxenv directories found. Checked: $LINUXENVS_DIR_PATH\033[0m"
        return
    fi
    if [ ! -w "$BIN_DIR_PATH" ] && [ -n "$USE_SUDO" ]; then
        link_cmd=("$USE_SUDO" ln -sfn)
        rm_cmd=("$USE_SUDO" rm -f)
    fi

    echo -e "\033[36m[SYNC] Syncing linuxenvs scripts from $LINUXENVS_DIR_PATH to $BIN_DIR_PATH\033[0m"
    find "$LINUXENVS_DIR_PATH" -maxdepth 1 -type f -name "*.sh" ! -perm -u=x -exec $USE_SUDO chmod +x {} + 2>/dev/null

    shopt -s nullglob
    for script_file in "$LINUXENVS_DIR_PATH"/*.sh; do
        [ -s "$script_file" ] || continue
        script_count=$((script_count + 1))
        filename="${script_file##*/}"
        source_script_path="$(readlink -f "$script_file" 2>/dev/null || echo "$script_file")"
        for link_path in "$BIN_DIR_PATH/$filename" "$BIN_DIR_PATH/${filename%.sh}"; do
            if [ -L "$link_path" ] && [ "$(readlink -f "$link_path")" = "$source_script_path" ]; then
                continue
            fi
            [ -e "$link_path" ] || [ -L "$link_path" ] && "${rm_cmd[@]}" "$link_path" 2>/dev/null
            "${link_cmd[@]}" "$source_script_path" "$link_path" 2>/dev/null
            if [ -L "$link_path" ] && [ "$(readlink -f "$link_path")" = "$source_script_path" ]; then
                linked_count=$((linked_count + 1))
                echo -e "\033[32m[SYNC]   Linked: $link_path -> $source_script_path\033[0m"
            else
                failed_count=$((failed_count + 1))
                echo -e "\033[31m[SYNC]   Failed to link: $link_path\033[0m"
            fi
        done
    done
    shopt -u nullglob

    echo -e "\033[32m[SYNC] $script_count script(s): $linked_count link(s) updated, $failed_count failed, others already correct\033[0m"
}
