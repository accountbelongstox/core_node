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
# Cache Functions for dd.sh (directory processing cache + legacy migration).
# Secret caches live in secret_functions.sh.
# =============================================================================

DIRECTORY_PROCESSING_CACHE_DIR="$CORE_NODE_DIRECTORY_PROCESSING_CACHE_DIR"
# A directory is fully re-verified when its cache is older than this.
DIRECTORY_PROCESSING_CACHE_TTL=86400
# Epoch of the last processing run (0 = full re-verification).
DIRECTORY_PROCESSING_SINCE=0
LEGACY_INSTALLER_CACHE_PAIRS="
$CORE_NODE_LEGACY_FILE_CACHE_DIR|$CORE_NODE_FILE_CACHE_DIR
$CORE_NODE_LEGACY_BEHAVIOR_CACHE_DIR|$CORE_NODE_BEHAVIOR_CACHE_DIR
$CORE_NODE_LEGACY_DIRECTORY_PROCESSING_CACHE_DIR|$CORE_NODE_DIRECTORY_PROCESSING_CACHE_DIR
$CORE_NODE_LEGACY_SECRET_CACHE_DIR|$CORE_NODE_SECRET_CACHE_DIR
$CORE_NODE_LEGACY_APP_VERSIONS_DIR|$CORE_NODE_APP_VERSIONS_DIR
"

migrate_legacy_installer_cache() {
    local source_dir=""
    local target_dir=""

    while IFS='|' read -r source_dir target_dir; do
        if [ -z "$source_dir" ] || [ ! -d "$source_dir" ]; then
            continue
        fi
        $USE_SUDO mkdir -p "$target_dir"
        $USE_SUDO cp -an "$source_dir/." "$target_dir/" 2>/dev/null || true
    done <<EOF
$LEGACY_INSTALLER_CACHE_PAIRS
EOF
}

migrate_legacy_installer_cache

directory_processing_cache_file() {
    local dir_path="$1"
    local cache_key=""

    cache_key="$(printf '%s\n' "$dir_path" | sha256sum | cut -d' ' -f1)"
    echo "$DIRECTORY_PROCESSING_CACHE_DIR/${cache_key}.dirprocessed"
}

# Sets DIRECTORY_PROCESSING_SINCE to the last processing epoch of <dir>, or 0
# when the cache is missing or older than DIRECTORY_PROCESSING_CACHE_TTL.
directory_processing_since() {
    local dir_path="$1"
    local cache_file=""
    local cache_timestamp=""
    local now=0

    DIRECTORY_PROCESSING_SINCE=0
    cache_file="$(directory_processing_cache_file "$dir_path")"
    [ -s "$cache_file" ] || return 0
    cache_timestamp="$(< "$cache_file")"
    [[ "$cache_timestamp" =~ ^[0-9]+$ ]] || return 0
    printf -v now '%(%s)T' -1
    if [ $((now - cache_timestamp)) -le "$DIRECTORY_PROCESSING_CACHE_TTL" ]; then
        DIRECTORY_PROCESSING_SINCE="$cache_timestamp"
    fi
}

set_directory_processing_cache() {
    local dir_path="$1"
    local cache_file=""
    local now=0

    [ -d "$DIRECTORY_PROCESSING_CACHE_DIR" ] || $USE_SUDO mkdir -p "$DIRECTORY_PROCESSING_CACHE_DIR"
    cache_file="$(directory_processing_cache_file "$dir_path")"
    printf -v now '%(%s)T' -1
    echo "$now" | $USE_SUDO tee "$cache_file" >/dev/null 2>&1
}

cleanup_directory_processing_cache() {
    local cache_file=""
    local cache_timestamp=""
    local now=0
    local cleaned_files=0

    [ -d "$DIRECTORY_PROCESSING_CACHE_DIR" ] || return 0
    printf -v now '%(%s)T' -1
    for cache_file in "$DIRECTORY_PROCESSING_CACHE_DIR"/*.dirprocessed; do
        [ -s "$cache_file" ] || continue
        cache_timestamp="$(< "$cache_file")"
        [[ "$cache_timestamp" =~ ^[0-9]+$ ]] || cache_timestamp=0
        if [ $((now - cache_timestamp)) -gt "$DIRECTORY_PROCESSING_CACHE_TTL" ]; then
            $USE_SUDO rm -f "$cache_file" "${cache_file%.dirprocessed}.dirmtime" 2>/dev/null
            cleaned_files=$((cleaned_files + 1))
        fi
    done
    if [ "$cleaned_files" -gt 0 ]; then
        echo -e "\033[33m[DIR CACHE CLEANUP] Removed $cleaned_files expired directory processing cache entries\033[0m"
    fi
}
