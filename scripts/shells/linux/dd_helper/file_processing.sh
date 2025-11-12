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
# File Processing Functions for dd.sh
# =============================================================================

process_sh_files() {
    local dir="$1"
    local start_time=$(date +%s.%N)
    local total_files=0
    local converted_files=0
    local skipped_files=0
    local files_to_convert=()
    local files_to_skip=()

    echo -e "\033[36m[SCAN] Starting to scan directory: $dir\033[0m"
    echo -e "\033[33m[INFO] Scanning for .sh files that need conversion...\033[0m"

    while IFS= read -r -d '' file; do
        ((total_files++))
        if check_file_cache "$file"; then
            files_to_skip+=("$file")
            ((skipped_files++))
        else
            files_to_convert+=("$file")
        fi
    done < <(find "$dir" -type f -name "*.sh" -print0)

    local files_need_conversion=${#files_to_convert[@]}

    echo -e "\033[32m[SCAN COMPLETE] Found $total_files .sh files total\033[0m"
    echo -e "\033[33m[CONVERSION] $files_need_conversion files need conversion\033[0m"
    echo -e "\033[33m[CACHE] $skipped_files files skipped (already converted)\033[0m"

    if [ $files_need_conversion -eq 0 ]; then
        local end_time=$(date +%s.%N)
        local duration
        if command -v bc >/dev/null 2>&1; then
            duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null)
            if [ -z "$duration" ]; then
                duration="0"
            fi
        else
            duration=$(awk "BEGIN {printf \"%.2f\", $end_time - $start_time}" 2>/dev/null)
            if [ -z "$duration" ]; then
                duration="0"
            fi
        fi
        echo -e "\033[32m[COMPLETE] All files are up to date! Scan completed in ${duration}s\033[0m"
        return 0
    fi

    echo -e "\033[36m[PROCESSING] Converting $files_need_conversion files...\033[0m"

    for file in "${files_to_convert[@]}"; do
        ((converted_files++))
        printf "\r\033[33m[%d/%d]\033[0m Converting: \033[35m%s\033[0m" "$converted_files" "$files_need_conversion" "$(basename "$file")"

        local conversion_status=""
        if command -v dos2unix >/dev/null 2>&1; then
            if $sudo dos2unix "$file" >/dev/null 2>&1; then
                conversion_status="[OK] dos2unix"
            else
                $sudo sed -i 's/\r$//' "$file"
                conversion_status="[OK] sed fallback"
            fi
        else
            $sudo sed -i 's/\r$//' "$file"
            conversion_status="[OK] sed"
        fi

        local exec_status=""
        if $sudo chmod +x "$file"; then
            exec_status="[OK] exec"
        else
            exec_status="[FAIL] exec"
        fi

        printf "\r\033[33m[%d/%d]\033[0m \033[35m%s\033[0m - %s, %s" "$converted_files" "$files_need_conversion" "$(basename "$file")" "$conversion_status" "$exec_status"
        set_file_cache "$file"
    done

    echo ""

    local end_time=$(date +%s.%N)
    local duration
    if command -v bc >/dev/null 2>&1; then
        duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null)
        if [ -z "$duration" ]; then
            duration="unknown"
        fi
    else
        duration=$(awk "BEGIN {printf \"%.2f\", $end_time - $start_time}" 2>/dev/null)
        if [ -z "$duration" ]; then
            duration="unknown"
        fi
    fi

    echo -e "\033[32m[COMPLETE] Conversion finished! \033[0m"
    echo -e "\033[32m  - Total files scanned: $total_files\033[0m"
    echo -e "\033[32m  - Files converted: $converted_files\033[0m"
    echo -e "\033[32m  - Files skipped (cached): $skipped_files\033[0m"
    echo -e "\033[32m  - Time taken: ${duration}s\033[0m"
}
