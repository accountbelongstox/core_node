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
# File Processing Functions for dd.sh: CRLF -> LF and +x for *.sh files.
# One find per directory. Candidates are files whose inode change time (ctime)
# is at or after the last run -- ctime also moves for copies that keep an old
# mtime -- plus any file without the exec bit. A directory whose cache is
# missing or older than 24h is re-verified completely.
# =============================================================================

SH_PROCESS_TOTAL_FILES=0
SH_PROCESS_CANDIDATE_FILES=0
SH_PROCESS_CHANGED_FILES=0

# Echo seconds elapsed since <start_us> (EPOCHREALTIME without the dot).
sh_process_elapsed() {
    local start_us="$1"
    local now_us="${EPOCHREALTIME/./}"
    local delta=$((now_us - start_us))

    printf '%d.%02d' "$((delta / 1000000))" "$(((delta % 1000000) / 10000))"
}

# process_sh_files <dir> [since_epoch]
process_sh_files() {
    local dir="$1"
    local since="${2:-0}"
    local ctime=""
    local mode=""
    local path=""
    local file=""
    local index=0
    local line_status=""
    local exec_status=""
    local -a candidates=()
    local -a crlf_files=()
    local -a noexec_files=()
    local -A crlf_set=()
    local -A noexec_set=()

    SH_PROCESS_TOTAL_FILES=0
    SH_PROCESS_CANDIDATE_FILES=0
    SH_PROCESS_CHANGED_FILES=0

    while IFS=$'\t' read -r -d '' ctime mode path; do
        SH_PROCESS_TOTAL_FILES=$((SH_PROCESS_TOTAL_FILES + 1))
        if (( (8#$mode & 8#100) == 0 )); then
            candidates+=("$path")
            noexec_files+=("$path")
            noexec_set["$path"]=1
        elif [ "${ctime%.*}" -ge "$since" ]; then
            candidates+=("$path")
        fi
    done < <(find "$dir" -type f -name '*.sh' -printf '%C@\t%m\t%p\0' 2>/dev/null)
    SH_PROCESS_CANDIDATE_FILES="${#candidates[@]}"

    if [ "${#candidates[@]}" -gt 0 ]; then
        mapfile -d '' crlf_files < <(printf '%s\0' "${candidates[@]}" | LC_ALL=C xargs -0 -r grep -lZ $'\r' 2>/dev/null)
    fi
    for file in "${crlf_files[@]}"; do
        crlf_set["$file"]=1
    done
    if [ "${#crlf_files[@]}" -gt 0 ]; then
        $USE_SUDO sed -i 's/\r$//' "${crlf_files[@]}"
    fi
    if [ "${#noexec_files[@]}" -gt 0 ]; then
        $USE_SUDO chmod +x -- "${noexec_files[@]}"
    fi

    for file in "${candidates[@]}"; do
        [ -n "${crlf_set[$file]:-}" ] || [ -n "${noexec_set[$file]:-}" ] || continue
        index=$((index + 1))
        line_status="[OK] line endings"
        exec_status="[OK] exec"
        [ -n "${crlf_set[$file]:-}" ] && line_status="[FIXED] CRLF -> LF"
        if [ -n "${noexec_set[$file]:-}" ]; then
            exec_status="[FIXED] +x"
            [ -x "$file" ] || exec_status="[FAIL] exec"
        fi
        echo -e "\033[33m  [$index]\033[0m \033[35m${file#"$dir"/}\033[0m - $line_status, $exec_status"
    done
    SH_PROCESS_CHANGED_FILES="$index"
}

# process_project_sh_files <root> <dir>...
process_project_sh_files() {
    local root="$1"
    local dir=""
    local absolute_dir=""
    local since_text=""
    local start_us="${EPOCHREALTIME/./}"
    local dir_start_us=""
    local dir_index=0
    local total_files=0
    local changed_files=0
    shift

    echo -e "\033[33m[SCAN] Directories: $*\033[0m"
    for dir in "$@"; do
        dir_index=$((dir_index + 1))
        absolute_dir="$root/$dir"
        if [ ! -d "$absolute_dir" ]; then
            echo -e "\033[31m[DIR $dir_index/$#] $absolute_dir not found - skipped\033[0m"
            continue
        fi
        dir_start_us="${EPOCHREALTIME/./}"
        directory_processing_since "$absolute_dir"
        if [ "$DIRECTORY_PROCESSING_SINCE" -eq 0 ]; then
            since_text="full check (no cache or older than 24h)"
        else
            printf -v since_text 'changed since %(%Y-%m-%d %H:%M:%S)T' "$DIRECTORY_PROCESSING_SINCE"
        fi
        echo -e "\033[36m[DIR $dir_index/$#] $dir: $since_text\033[0m"
        process_sh_files "$absolute_dir" "$DIRECTORY_PROCESSING_SINCE"
        set_directory_processing_cache "$absolute_dir"
        total_files=$((total_files + SH_PROCESS_TOTAL_FILES))
        changed_files=$((changed_files + SH_PROCESS_CHANGED_FILES))
        echo -e "\033[32m[DIR $dir_index/$#] $dir: $SH_PROCESS_TOTAL_FILES .sh files, $SH_PROCESS_CANDIDATE_FILES checked, $SH_PROCESS_CHANGED_FILES fixed ($(sh_process_elapsed "$dir_start_us")s)\033[0m"
    done
    echo -e "\033[32m[COMPLETE] $total_files .sh files, $changed_files fixed, $(sh_process_elapsed "$start_us")s\033[0m"
}
