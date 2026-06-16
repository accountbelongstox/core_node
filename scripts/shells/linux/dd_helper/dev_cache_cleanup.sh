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
# Development Tool Cache Cleanup for dd.sh
#
# Detects oversized developer-tool caches (pip / npm / go / rust) and, for each
# one over the size threshold, prompts the user [Y/n] before cleaning it.
# dd.sh only SOURCES this file and calls dev_cache_cleanup_prompt - all logic
# lives here.
#
# Quick "is there cache / how big" + official cleanup commands used below:
#   pip   : dir -> `pip cache dir` ; size -> du -sh ; clean -> `pip cache purge`
#   npm   : dir -> `npm config get cache` (default ~/.npm) ; clean -> `npm cache clean --force`
#   go    : dir -> `go env GOCACHE` / `go env GOMODCACHE` ; clean -> `go clean -cache` / `go clean -modcache`
#   rust  : dirs -> $RUSTUP_HOME (~/.rustup) + $CARGO_HOME (~/.cargo). rustup has
#           no built-in "cache purge"; only the re-downloadable parts are removed
#           (rustup/downloads, cargo registry cache/src, cargo git checkouts).
#           Installed toolchains are kept intact.
#   /var/log : managed cleanup -> systemd journal `journalctl --vacuum-size`.
#           Everything without a managed cleanup (rotated/compressed/date-stamped
#           logs) is deleted directly; remaining large active *.log files are
#           truncated in place so service file handles stay valid.
#
# system_log_limits_apply() idempotently CAPS future log growth (runs without a
# prompt, prints every action):
#   journald  : /etc/systemd/journald.conf -> SystemMaxUse=500M, SystemMaxFileSize=50M
#               (replace value in place, add if missing, skip if already equal),
#               then restart systemd-journald only when a value actually changed.
#   logrotate : /etc/logrotate.d/{rsyslog,syslog} -> ensure `size 100M` in each
#               log block (replace existing size, add after `{` if missing).
#
# system_unwanted_paths_cleanup() removes fixed unwanted paths (SYSTEM_UNWANTED_PATHS,
# e.g. /usr/local/qcloud) with `rm -rf` when present. No prompt.
# =============================================================================

# Cache size threshold in MB: a cache at or above this size triggers a prompt.
DEV_CACHE_SIZE_THRESHOLD_MB="${DEV_CACHE_SIZE_THRESHOLD_MB:-500}"

# /var/log threshold in MB (logs grow naturally, so a larger default than caches).
VAR_LOG_SIZE_THRESHOLD_MB="${VAR_LOG_SIZE_THRESHOLD_MB:-1024}"

# Set to 1 by _ensure_conf_kv when a journald limit value is actually changed;
# used to decide whether systemd-journald needs a restart.
_LOGLIMIT_CHANGED=0

# Fixed paths that should not exist on these machines (vendor agents / bloat).
# Removed unconditionally with `rm -rf` when present. Extend this list as needed.
SYSTEM_UNWANTED_PATHS=(
    "/usr/local/qcloud"
)

# Resolve the pip command consistently with the rest of the codebase:
# prefer pip3, then plain pip, then `python3 -m pip` (mirrors 13_ensure_python.sh).
_devcache_resolve_pip() {
    if command -v pip3 >/dev/null 2>&1; then
        echo "pip3"
    elif command -v pip >/dev/null 2>&1; then
        echo "pip"
    elif command -v python3 >/dev/null 2>&1 && python3 -m pip --version >/dev/null 2>&1; then
        echo "python3 -m pip"
    else
        echo ""
    fi
}

# Echo the size of a directory in whole MB (0 when missing/empty).
_devcache_dir_size_mb() {
    local target="$1"
    local mb=0
    if [ -d "$target" ]; then
        mb=$(du -sm "$target" 2>/dev/null | cut -f1)
        [ -n "$mb" ] || mb=0
    fi
    echo "$mb"
}

# Prompt [Y/n] (default Yes); return 0 when the user agrees to clean.
_devcache_confirm() {
    local prompt="$1"
    local answer=""
    read -r -p "$prompt [Y/n]: " answer
    if [[ "$answer" =~ ^[Nn]$ ]]; then
        return 1
    fi
    return 0
}

# Idempotently ensure `key=value` (active) inside [section] of an INI-style file.
# Replaces an existing value (commented or active), de-duplicates repeats, adds
# the key (and section) when missing, and skips when already exactly equal.
# Sets _LOGLIMIT_CHANGED=1 when the file content was modified.
_ensure_conf_kv() {
    local file="$1"
    local section="$2"
    local key="$3"
    local value="$4"
    local current=""
    local active_count=0
    local tmp=""

    if [ ! -f "$file" ]; then
        return 1
    fi

    active_count=$($sudo grep -Ec "^[[:space:]]*${key}[[:space:]]*=" "$file" 2>/dev/null)
    [ -n "$active_count" ] || active_count=0
    current=$($sudo grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" 2>/dev/null | tail -n1 | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//")

    if [ "$active_count" -eq 1 ] && [ "$current" = "$value" ]; then
        echo -e "\033[32m[LOG LIMIT] ${file}: ${key}=${value} already set\033[0m"
        return 0
    fi

    tmp="$(mktemp)"
    $sudo cat "$file" 2>/dev/null | awk -v section="$section" -v key="$key" -v value="$value" '
        BEGIN { target="[" section "]"; in_sec=0; done=0; seen_sec=0; keyre="^[[:space:]]*#?[[:space:]]*" key "[[:space:]]*=" }
        /^[[:space:]]*\[.*\][[:space:]]*$/ {
            if (in_sec && !done) { print key "=" value; done=1 }
            hdr=$0; gsub(/[[:space:]]/,"",hdr)
            if (hdr==target) { in_sec=1; seen_sec=1 } else { in_sec=0 }
            print; next
        }
        {
            if (in_sec && $0 ~ keyre) {
                if (!done) { print key "=" value; done=1 }
                next
            }
            print
        }
        END {
            if (in_sec && !done) { print key "=" value; done=1 }
            if (!seen_sec) { print ""; print target; print key "=" value }
        }
    ' > "$tmp"

    if [ -s "$tmp" ] && ! $sudo cmp -s "$tmp" "$file"; then
        if $sudo cp "$tmp" "$file"; then
            _LOGLIMIT_CHANGED=1
            if [ -n "$current" ]; then
                echo -e "\033[33m[LOG LIMIT] ${file}: ${key} ${current} -> ${value}\033[0m"
            else
                echo -e "\033[33m[LOG LIMIT] ${file}: ${key}=${value} added\033[0m"
            fi
        else
            echo -e "\033[31m[LOG LIMIT] ${file}: failed to write ${key}\033[0m"
        fi
    else
        echo -e "\033[32m[LOG LIMIT] ${file}: ${key}=${value} already set\033[0m"
    fi
    rm -f "$tmp"
    return 0
}

# Idempotently ensure every logrotate block in a file carries `size <value>`.
# Replaces an existing size directive, inserts one before the block close `}`
# when absent. Skips writing when the file is already compliant.
_ensure_logrotate_block_size() {
    local file="$1"
    local value="$2"
    local tmp=""

    if [ ! -f "$file" ]; then
        return 1
    fi

    tmp="$(mktemp)"
    $sudo cat "$file" 2>/dev/null | awk -v val="$value" '
        BEGIN { depth=0; size_seen=0 }
        {
            if (depth==0 && index($0,"{")>0) { depth=1; size_seen=0; print; next }
            if (depth==1 && index($0,"}")>0) {
                if (!size_seen) { print "    size " val }
                depth=0; print; next
            }
            if (depth==1 && $1=="size") { print "    size " val; size_seen=1; next }
            print
        }
    ' > "$tmp"

    if [ -s "$tmp" ] && ! $sudo cmp -s "$tmp" "$file"; then
        if $sudo cp "$tmp" "$file"; then
            echo -e "\033[33m[LOG LIMIT] ${file}: enforced 'size ${value}' in log blocks\033[0m"
        else
            echo -e "\033[31m[LOG LIMIT] ${file}: failed to write size limit\033[0m"
        fi
    else
        echo -e "\033[32m[LOG LIMIT] ${file}: 'size ${value}' already enforced\033[0m"
    fi
    rm -f "$tmp"
    return 0
}

# Entry: remove unwanted system paths (SYSTEM_UNWANTED_PATHS) when present. No prompt.
system_unwanted_paths_cleanup() {
    local p=""
    local removed_any=0

    for p in "${SYSTEM_UNWANTED_PATHS[@]}"; do
        if [ -e "$p" ] || [ -L "$p" ]; then
            if [ "$removed_any" -eq 0 ]; then
                echo ""
                echo -e "\033[36m[CLEANUP] Removing unwanted system paths...\033[0m"
                removed_any=1
            fi
            if $sudo rm -rf "$p"; then
                echo -e "\033[32m[CLEANUP] Removed: ${p}\033[0m"
            else
                echo -e "\033[31m[CLEANUP] Failed to remove: ${p}\033[0m"
            fi
        fi
    done
    return 0
}

# Entry: idempotently cap system log growth (journald + logrotate). No prompt.
system_log_limits_apply() {
    local journald_conf="/etc/systemd/journald.conf"
    local -a logrotate_files=("/etc/logrotate.d/rsyslog" "/etc/logrotate.d/syslog")
    local f=""

    _LOGLIMIT_CHANGED=0

    echo ""
    echo -e "\033[36m[LOG LIMIT] Enforcing system log size limits (idempotent)...\033[0m"

    # ----- journald -----
    if command -v systemctl >/dev/null 2>&1 && [ -d /etc/systemd ]; then
        if [ ! -f "$journald_conf" ]; then
            printf '[Journal]\n' | $sudo tee "$journald_conf" >/dev/null 2>&1
        fi
        _ensure_conf_kv "$journald_conf" "Journal" "SystemMaxUse" "500M"
        _ensure_conf_kv "$journald_conf" "Journal" "SystemMaxFileSize" "50M"
        if [ "$_LOGLIMIT_CHANGED" -eq 1 ]; then
            if $sudo systemctl restart systemd-journald 2>/dev/null; then
                echo -e "\033[32m[LOG LIMIT] systemd-journald restarted (new limits applied)\033[0m"
            else
                echo -e "\033[33m[LOG LIMIT] could not restart systemd-journald (limits apply on next boot)\033[0m"
            fi
        fi
    else
        echo -e "\033[33m[LOG LIMIT] systemd/journald not available - skipping journald limits\033[0m"
    fi

    # ----- logrotate (text logs) -----
    if command -v logrotate >/dev/null 2>&1; then
        for f in "${logrotate_files[@]}"; do
            if [ -f "$f" ]; then
                _ensure_logrotate_block_size "$f" "100M"
            fi
        done
    else
        echo -e "\033[33m[LOG LIMIT] logrotate not installed - skipping text-log size caps\033[0m"
    fi

    echo -e "\033[36m[LOG LIMIT] System log limit check complete\033[0m"
    return 0
}

# Main entry: scan caches and prompt for cleanup when oversized.
dev_cache_cleanup_prompt() {
    local threshold="$DEV_CACHE_SIZE_THRESHOLD_MB"
    local pip_cmd=""
    local pip_cache_dir=""
    local npm_cache_dir=""
    local go_cache=""
    local go_modcache=""
    local rustup_home=""
    local cargo_home=""
    local size=0
    local total=0
    local target=""
    local -a rust_targets=()
    local log_dir="/var/log"
    local log_threshold="$VAR_LOG_SIZE_THRESHOLD_MB"
    local logf=""

    echo ""
    echo -e "\033[36m[DEV CACHE] Checking developer tool cache sizes (threshold: ${threshold} MB)...\033[0m"

    # ----- pip -----
    pip_cmd="$(_devcache_resolve_pip)"
    if [ -n "$pip_cmd" ]; then
        pip_cache_dir="$($pip_cmd cache dir 2>/dev/null)"
        if [ -n "$pip_cache_dir" ] && [ -d "$pip_cache_dir" ]; then
            size="$(_devcache_dir_size_mb "$pip_cache_dir")"
            if [ "$size" -ge "$threshold" ]; then
                echo -e "\033[33m[DEV CACHE] pip cache: ${size} MB at ${pip_cache_dir}\033[0m"
                if _devcache_confirm "Purge pip cache ($pip_cmd cache purge)?"; then
                    if $pip_cmd cache purge; then
                        echo -e "\033[32m[DEV CACHE] pip cache purged\033[0m"
                    else
                        echo -e "\033[31m[DEV CACHE] pip cache purge failed\033[0m"
                    fi
                fi
            fi
        fi
    fi

    # ----- npm -----
    if command -v npm >/dev/null 2>&1; then
        npm_cache_dir="$(npm config get cache 2>/dev/null)"
        [ -n "$npm_cache_dir" ] || npm_cache_dir="$HOME/.npm"
        if [ -d "$npm_cache_dir" ]; then
            size="$(_devcache_dir_size_mb "$npm_cache_dir")"
            if [ "$size" -ge "$threshold" ]; then
                echo -e "\033[33m[DEV CACHE] npm cache: ${size} MB at ${npm_cache_dir}\033[0m"
                if _devcache_confirm "Clean npm cache (npm cache clean --force)?"; then
                    if npm cache clean --force; then
                        echo -e "\033[32m[DEV CACHE] npm cache cleaned\033[0m"
                    else
                        echo -e "\033[31m[DEV CACHE] npm cache clean failed\033[0m"
                    fi
                fi
            fi
        fi
    fi

    # ----- go -----
    if command -v go >/dev/null 2>&1; then
        go_cache="$(go env GOCACHE 2>/dev/null)"
        if [ -n "$go_cache" ] && [ -d "$go_cache" ]; then
            size="$(_devcache_dir_size_mb "$go_cache")"
            if [ "$size" -ge "$threshold" ]; then
                echo -e "\033[33m[DEV CACHE] go build cache: ${size} MB at ${go_cache}\033[0m"
                if _devcache_confirm "Clean go build cache (go clean -cache)?"; then
                    if go clean -cache; then
                        echo -e "\033[32m[DEV CACHE] go build cache cleaned\033[0m"
                    else
                        echo -e "\033[31m[DEV CACHE] go clean -cache failed\033[0m"
                    fi
                fi
            fi
        fi
        go_modcache="$(go env GOMODCACHE 2>/dev/null)"
        if [ -n "$go_modcache" ] && [ -d "$go_modcache" ]; then
            size="$(_devcache_dir_size_mb "$go_modcache")"
            if [ "$size" -ge "$threshold" ]; then
                echo -e "\033[33m[DEV CACHE] go module cache: ${size} MB at ${go_modcache}\033[0m"
                if _devcache_confirm "Clean go module cache (go clean -modcache)?"; then
                    if go clean -modcache; then
                        echo -e "\033[32m[DEV CACHE] go module cache cleaned\033[0m"
                    else
                        echo -e "\033[31m[DEV CACHE] go clean -modcache failed\033[0m"
                    fi
                fi
            fi
        fi
    fi

    # ----- rust (rustup + cargo) -----
    rustup_home="${RUSTUP_HOME:-$HOME/.rustup}"
    cargo_home="${CARGO_HOME:-$HOME/.cargo}"
    if command -v rustup >/dev/null 2>&1 || [ -d "$rustup_home" ] || [ -d "$cargo_home" ]; then
        [ -d "$rustup_home/downloads" ] && rust_targets+=("$rustup_home/downloads")
        [ -d "$cargo_home/registry/cache" ] && rust_targets+=("$cargo_home/registry/cache")
        [ -d "$cargo_home/registry/src" ] && rust_targets+=("$cargo_home/registry/src")
        [ -d "$cargo_home/git/checkouts" ] && rust_targets+=("$cargo_home/git/checkouts")
        if [ "${#rust_targets[@]}" -gt 0 ]; then
            total=0
            for target in "${rust_targets[@]}"; do
                size="$(_devcache_dir_size_mb "$target")"
                total=$((total + size))
            done
            if [ "$total" -ge "$threshold" ]; then
                echo -e "\033[33m[DEV CACHE] rust re-downloadable cache: ${total} MB (rustup: ${rustup_home}, cargo: ${cargo_home})\033[0m"
                if _devcache_confirm "Remove rust download/registry caches (installed toolchains kept)?"; then
                    for target in "${rust_targets[@]}"; do
                        rm -rf "$target" 2>/dev/null
                    done
                    echo -e "\033[32m[DEV CACHE] rust caches cleared\033[0m"
                fi
            fi
        fi
    fi

    # ----- /var/log -----
    # System logs need root to size/clean; $sudo is provided by dd.sh.
    if [ -d "$log_dir" ]; then
        size=$($sudo du -sm "$log_dir" 2>/dev/null | cut -f1)
        [ -n "$size" ] || size=0
        if [ "$size" -ge "$log_threshold" ]; then
            echo -e "\033[33m[VAR LOG] ${log_dir}: ${size} MB\033[0m"
            if _devcache_confirm "Clean ${log_dir} (journal vacuum + delete rotated logs + truncate large logs)?"; then
                # 1) systemd journal: has a managed cleanup -> vacuum down to 200M.
                if command -v journalctl >/dev/null 2>&1; then
                    $sudo journalctl --rotate >/dev/null 2>&1
                    $sudo journalctl --vacuum-size=200M
                    echo -e "\033[32m[VAR LOG] systemd journal vacuumed to <=200M\033[0m"
                fi
                # 2) no managed cleanup -> delete rotated / compressed / date-stamped logs directly.
                $sudo find "$log_dir" -type f \( \
                    -name "*.gz" -o -name "*.xz" -o -name "*.bz2" -o \
                    -name "*.old" -o -name "*.[0-9]" -o -name "*-20??????" \
                \) -delete 2>/dev/null
                # 3) truncate remaining large active *.log files in place (keep file, drop content).
                while IFS= read -r -d '' logf; do
                    $sudo truncate -s 0 "$logf" 2>/dev/null
                done < <($sudo find "$log_dir" -type f -name "*.log" -size +50M -print0 2>/dev/null)
                echo -e "\033[32m[VAR LOG] rotated logs deleted and large active logs truncated\033[0m"
            fi
        fi
    fi

    echo -e "\033[36m[DEV CACHE] Cache check complete\033[0m"
    return 0
}
