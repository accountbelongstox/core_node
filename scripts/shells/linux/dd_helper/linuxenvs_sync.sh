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

# Source constants (backup copy)
source "$DD_HELPER_DIR/constants.sh"

# Build full paths from constants
LINUXENVS_DIR_PATH="$CORE_NODE_ROOT_DIR/$LINUXENVS_DIR_RELATIVE"
LIUNXENVS_DIR_PATH="$CORE_NODE_ROOT_DIR/$LIUNXENVS_DIR_RELATIVE"

# Linuxenvs Permission and Sync Functions
sync_linuxenvs_to_bin() {
    local directories=()
    local directory_labels=()
    local total_scripts=0
    local idx=""

    if [ -d "$LINUXENVS_DIR_PATH" ]; then
        directories+=("$LINUXENVS_DIR_PATH")
        directory_labels+=("linuxenvs")
    fi

    if [ -d "$LIUNXENVS_DIR_PATH" ]; then
        directories+=("$LIUNXENVS_DIR_PATH")
        directory_labels+=("liunxenvs")
    fi

    if [ ${#directories[@]} -eq 0 ]; then
        echo -e "\033[33m[SYNC] No linuxenv directories found. Checked: $LINUXENVS_DIR_PATH and $LIUNXENVS_DIR_PATH\033[0m"
        return 0
    fi

    for idx in "${!directories[@]}"; do
        local current_dir="${directories[$idx]}"
        local current_label="${directory_labels[$idx]}"
        local script_count=0
        local bin_writable=false

        echo -e "\033[36m[SYNC] Syncing $current_label scripts from $current_dir to $BIN_DIR_PATH\033[0m"

        if [ -w "$BIN_DIR_PATH" ]; then
            bin_writable=true
        fi

        if ! find "$current_dir" -maxdepth 1 -type f -name "*.sh" -exec chmod +x {} \; 2>/dev/null; then
            find "$current_dir" -maxdepth 1 -type f -name "*.sh" -exec $sudo chmod +x {} \; 2>/dev/null
        fi

        shopt -s nullglob
        for script_file in "$current_dir"/*.sh; do
            if [ ! -s "$script_file" ]; then
                continue
            fi

            local filename="$(basename "$script_file")"
            local basename_without_ext="${filename%.sh}"
            local source_script_path="$(readlink -f "$script_file" 2>/dev/null || echo "$script_file")"
            local bin_script_path="$BIN_DIR_PATH/$filename"
            local bin_link_path="$BIN_DIR_PATH/$basename_without_ext"
            local link_paths=("$bin_script_path" "$bin_link_path")
            local link_path=""

            echo -e "\033[33m[SYNC] Processing ($current_label): $filename\033[0m"

            for link_path in "${link_paths[@]}"; do
                if [ -e "$link_path" ] || [ -L "$link_path" ]; then
                    if [ "$bin_writable" = true ]; then
                        rm -f "$link_path" 2>/dev/null
                    else
                        $sudo rm -f "$link_path" 2>/dev/null
                    fi
                fi

                if [ "$bin_writable" = true ]; then
                    ln -sf "$source_script_path" "$link_path" 2>/dev/null
                else
                    $sudo ln -sf "$source_script_path" "$link_path" 2>/dev/null
                fi

                if [ $? -eq 0 ]; then
                    echo -e "\033[32m[SYNC]   Linked: $link_path -> $source_script_path\033[0m"
                else
                    echo -e "\033[31m[SYNC]   Failed to link: $link_path\033[0m"
                fi
            done

            ((script_count++))
        done
        shopt -u nullglob

        if [ $script_count -eq 0 ]; then
            echo -e "\033[33m[SYNC] No .sh scripts found in $current_dir\033[0m"
        else
            echo -e "\033[32m[SYNC] Synced $script_count script(s) from $current_dir\033[0m"
        fi

        total_scripts=$((total_scripts + script_count))
    done

    if [ $total_scripts -gt 0 ]; then
        echo -e "\033[32m[SYNC] Completed linking $total_scripts script(s) to $BIN_DIR_PATH\033[0m"
    fi
}
