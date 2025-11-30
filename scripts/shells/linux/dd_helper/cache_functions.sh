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
# Cache Functions for dd.sh
# =============================================================================

check_file_cache() {
    local file_path="$1"
    local cache_dir="$GLOBAL_VAR_DIR/file_cache"
    
    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
        return 1
    fi

    local cache_key=$(echo "$file_path" | sha256sum | cut -d' ' -f1)
    local cache_file="$cache_dir/${cache_key}.mtime"

    if [ -s "$cache_file" ]; then
        local cached_mtime=$(cat "$cache_file" 2>/dev/null)
        if [ -z "$cached_mtime" ]; then
            cached_mtime="0"
        fi
        local current_mtime=$(stat -c %Y "$file_path" 2>/dev/null)
        if [ -z "$current_mtime" ]; then
            current_mtime="0"
        fi
        if [ "$cached_mtime" = "$current_mtime" ]; then
            return 0
        else
            return 1
        fi
    fi

    return 1
}

set_file_cache() {
    local file_path="$1"
    local cache_dir="$GLOBAL_VAR_DIR/file_cache"
    
    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
    fi

    local cache_key=$(echo "$file_path" | sha256sum | cut -d' ' -f1)
    local cache_file="$cache_dir/${cache_key}.mtime"
    local current_mtime=$(stat -c %Y "$file_path" 2>/dev/null)
    if [ -z "$current_mtime" ]; then
        current_mtime="0"
    fi
    
    echo "$current_mtime" | $sudo tee "$cache_file" >/dev/null 2>&1
}

check_behavior_cache() {
    local behavior_name="$1"
    local cache_dir="$GLOBAL_VAR_DIR/behavior_cache"
    local cache_expiry_seconds=300
    local current_time=$(date +%s)

    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
        return 1
    fi

    local cache_file="$cache_dir/${behavior_name}.timestamp"

    if [ -s "$cache_file" ]; then
        local cache_timestamp=$(cat "$cache_file" 2>/dev/null)
        if [ -z "$cache_timestamp" ]; then
            cache_timestamp="0"
        fi
        local cache_age=$((current_time - cache_timestamp))

        if [ "$cache_age" -le "$cache_expiry_seconds" ]; then
            echo -e "\033[32m[CACHE HIT] Behavior '$behavior_name' cached ${cache_age}s ago, skipping execution\033[0m"
            return 0
        else
            echo -e "\033[33m[CACHE EXPIRED] Behavior '$behavior_name' cache expired (${cache_age}s old)\033[0m"
            return 1
        fi
    fi

    return 1
}

set_behavior_cache() {
    local behavior_name="$1"
    local cache_dir="$GLOBAL_VAR_DIR/behavior_cache"
    local current_time=$(date +%s)

    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
    fi

    local cache_file="$cache_dir/${behavior_name}.timestamp"
    echo "$current_time" | $sudo tee "$cache_file" >/dev/null 2>&1
    echo -e "\033[32m[CACHE SET] Behavior '$behavior_name' cached for 5 minutes\033[0m"
}

cleanup_behavior_cache() {
    local cache_dir="$GLOBAL_VAR_DIR/behavior_cache"
    local cache_expiry_seconds=300
    local current_time=$(date +%s)
    local cleaned_files=0

    if [ ! -d "$cache_dir" ]; then
        return 0
    fi

    for cache_file in "$cache_dir"/*.timestamp; do
        if [ -s "$cache_file" ]; then
            local cache_timestamp=$(cat "$cache_file" 2>/dev/null)
            if [ -z "$cache_timestamp" ]; then
                cache_timestamp="0"
            fi
            local cache_age=$((current_time - cache_timestamp))

            if [ "$cache_age" -gt "$cache_expiry_seconds" ]; then
                $sudo rm -f "$cache_file" 2>/dev/null
                ((cleaned_files++))
            fi
        fi
    done

    if [ "$cleaned_files" -gt 0 ]; then
        echo -e "\033[33m[CACHE CLEANUP] Removed $cleaned_files expired behavior cache entries\033[0m"
    fi
}

cleanup_file_cache() {
    local cache_dir="$GLOBAL_VAR_DIR/file_cache"
    local cleaned_files=0

    if [ ! -d "$cache_dir" ]; then
        return 0
    fi

    local current_time=$(date +%s)
    local max_age=2592000

    for cache_file in "$cache_dir"/*.mtime; do
        if [ -s "$cache_file" ]; then
            local file_mtime=$(stat -c %Y "$cache_file" 2>/dev/null)
            if [ -z "$file_mtime" ]; then
                file_mtime="0"
            fi
            local file_age=$((current_time - file_mtime))
            if [ "$file_age" -gt "$max_age" ]; then
                $sudo rm -f "$cache_file" 2>/dev/null
                ((cleaned_files++))
            fi
        fi
    done

    if [ "$cleaned_files" -gt 0 ]; then
        echo -e "\033[33m[FILE CACHE CLEANUP] Removed $cleaned_files old file cache entries (older than 30 days)\033[0m"
    fi
}

# =============================================================================
# Directory Processing Cache Functions
# =============================================================================

check_directory_processing_cache() {
    local dir_path="$1"
    local cache_dir="$GLOBAL_VAR_DIR/dir_processing_cache"
    local cache_expiry_seconds=86400  # 24 hours
    local current_time=$(date +%s)

    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
        return 1
    fi

    # Create cache key from directory path
    local cache_key=$(echo "$dir_path" | sha256sum | cut -d' ' -f1)
    local cache_file="$cache_dir/${cache_key}.dirprocessed"

    if [ -s "$cache_file" ]; then
        local cache_timestamp=$(cat "$cache_file" 2>/dev/null)
        if [ -z "$cache_timestamp" ]; then
            cache_timestamp="0"
        fi
        local cache_age=$((current_time - cache_timestamp))

        # Check if cache is still valid (not expired)
        if [ "$cache_age" -le "$cache_expiry_seconds" ]; then
            # Smart file comparison: check if any .sh file is newer than cache
            local newer_files_found=false
            local newer_files_count=0

            # Find all .sh files in directory (recursively)
            while IFS= read -r -d '' sh_file; do
                local file_mtime=$(stat -c %Y "$sh_file" 2>/dev/null || echo "0")
                # If file modification time is greater than cache timestamp, need reprocessing
                if [ "$file_mtime" -gt "$cache_timestamp" ]; then
                    if [ "$newer_files_found" = false ]; then
                        echo -e "\033[33m[CACHE INVALIDATED] Found files newer than cache:\033[0m"
                        newer_files_found=true
                    fi
                    echo -e "\033[33m  - $(basename "$sh_file") (modified $(date -d @$file_mtime '+%Y-%m-%d %H:%M:%S'))\033[0m"
                    ((newer_files_count++))
                fi
            done < <(find "$dir_path" -type f -name "*.sh" -print0 2>/dev/null)

            if [ "$newer_files_found" = true ]; then
                echo -e "\033[33m[CACHE MISS] $newer_files_count file(s) modified after cache - reprocessing needed\033[0m"
                return 1  # Need to reprocess
            else
                local cache_date=$(date -d @$cache_timestamp '+%Y-%m-%d %H:%M:%S')
                echo -e "\033[32m[CACHE HIT] All .sh files older than cache ($cache_date) - skipping dos2unix\033[0m"
                return 0  # Cache hit - no files newer than cache
            fi
        else
            echo -e "\033[33m[CACHE EXPIRED] Cache age: ${cache_age}s (max: ${cache_expiry_seconds}s)\033[0m"
        fi
    fi

    return 1  # Cache miss - directory needs processing
}

set_directory_processing_cache() {
    local dir_path="$1"
    local cache_dir="$GLOBAL_VAR_DIR/dir_processing_cache"
    local current_time=$(date +%s)
    
    if [ ! -d "$cache_dir" ]; then
        $sudo mkdir -p "$cache_dir"
    fi
    
    # Create cache key from directory path
    local cache_key=$(echo "$dir_path" | sha256sum | cut -d' ' -f1)
    local cache_file="$cache_dir/${cache_key}.dirprocessed"
    local mtime_file="$cache_dir/${cache_key}.dirmtime"
    
    # Store processing timestamp
    echo "$current_time" | $sudo tee "$cache_file" >/dev/null 2>&1
    
    # Store directory modification time
    local dir_mtime=$(stat -c %Y "$dir_path" 2>/dev/null || echo "0")
    echo "$dir_mtime" | $sudo tee "$mtime_file" >/dev/null 2>&1
}

cleanup_directory_processing_cache() {
    local cache_dir="$GLOBAL_VAR_DIR/dir_processing_cache"
    local cache_expiry_seconds=86400  # 24 hours
    local current_time=$(date +%s)
    local cleaned_files=0
    
    if [ ! -d "$cache_dir" ]; then
        return 0
    fi
    
    for cache_file in "$cache_dir"/*.dirprocessed; do
        if [ -s "$cache_file" ]; then
            local cache_timestamp=$(cat "$cache_file" 2>/dev/null)
            if [ -z "$cache_timestamp" ]; then
                cache_timestamp="0"
            fi
            local cache_age=$((current_time - cache_timestamp))
            
            if [ "$cache_age" -gt "$cache_expiry_seconds" ]; then
                # Remove both processing timestamp and mtime files
                local base_name=$(basename "$cache_file" .dirprocessed)
                $sudo rm -f "$cache_file" 2>/dev/null
                $sudo rm -f "$cache_dir/${base_name}.dirmtime" 2>/dev/null
                ((cleaned_files++))
            fi
        fi
    done
    
    if [ "$cleaned_files" -gt 0 ]; then
        echo -e "\033[33m[DIR CACHE CLEANUP] Removed $cleaned_files expired directory processing cache entries\033[0m"
    fi
}
