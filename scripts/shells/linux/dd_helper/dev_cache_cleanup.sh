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
# Development Tool Cache + System Log maintenance.
# dev_cache_cleanup_menu / system_log_limits_menu are Linux System Tools ->
# Slim & Disk Cleanup items; dd.sh startup only runs system_unwanted_paths_cleanup.
#
# dev_cache_cleanup_prompt measures pip / npm / go / rust caches and /var/log
# in parallel, then offers every oversized item in ONE stacked confirmation
# (prompt_queue_*): y = all, n = none, 1,3 = listed items.
#   pip   : dir -> `pip cache dir` ; clean -> `pip cache purge`
#   npm   : dir -> `npm config get cache` (default ~/.npm) ; clean -> `npm cache clean --force`
#   go    : dir -> `go env GOCACHE` / `go env GOMODCACHE` ; clean -> `go clean -cache` / `go clean -modcache`
#   rust  : re-downloadable parts only (rustup downloads, cargo registry cache/src,
#           cargo checkouts); installed toolchains are kept.
#   /var/log : journal vacuum, delete rotated/compressed/date-stamped logs,
#           truncate large active *.log in place (file handles stay valid).
#
# system_log_limits_apply idempotently caps future log growth (no prompt):
#   journald  : SystemMaxUse=500M, SystemMaxFileSize=50M (restart only on change)
#   logrotate : /etc/logrotate.d/{rsyslog,syslog} -> `size 100M` in each block.
# =============================================================================

# Cache size threshold in MB: a cache at or above this size is offered for cleanup.
DEV_CACHE_SIZE_THRESHOLD_MB="${DEV_CACHE_SIZE_THRESHOLD_MB:-500}"
# /var/log threshold in MB (logs grow naturally, so a larger default than caches).
VAR_LOG_SIZE_THRESHOLD_MB="${VAR_LOG_SIZE_THRESHOLD_MB:-1024}"
DEV_CACHE_LOG_DIR="/var/log"
DEV_CACHE_PIP_CMD=""
DEV_CACHE_NPM_CMD=""
DEV_CACHE_RUST_TARGETS=()
# Set to 1 by _ensure_conf_kv when a journald limit value is actually changed.
_LOGLIMIT_CHANGED=0
# Fixed paths that should not exist on these machines (vendor agents / bloat).
SYSTEM_UNWANTED_PATHS=(
    "/usr/local/qcloud"
)

# Resolve the pip command: pip3, then pip, then `python3 -m pip`.
_devcache_resolve_pip() {
    if command -v pip3 >/dev/null 2>&1; then
        echo "pip3"
    elif command -v pip >/dev/null 2>&1; then
        echo "pip"
    elif command -v python3 >/dev/null 2>&1 && python3 -m pip --version >/dev/null 2>&1; then
        echo "python3 -m pip"
    fi
}

# Echo the size of a directory in whole MB (0 when missing). Bounded by timeout.
_devcache_dir_size_mb() {
    local target="$1"
    local mb=0

    if [ -d "$target" ]; then
        mb=$(timeout 120 $USE_SUDO du -sm "$target" 2>/dev/null | cut -f1)
        [ -n "$mb" ] || mb=0
    fi
    echo "$mb"
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

    active_count=$($USE_SUDO grep -Ec "^[[:space:]]*${key}[[:space:]]*=" "$file" 2>/dev/null)
    [ -n "$active_count" ] || active_count=0
    current=$($USE_SUDO grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" 2>/dev/null | tail -n1 | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//")

    if [ "$active_count" -eq 1 ] && [ "$current" = "$value" ]; then
        echo -e "\033[32m[LOG LIMIT] ${file}: ${key}=${value} already set\033[0m"
        return 0
    fi

    tmp="$(mktemp)"
    $USE_SUDO cat "$file" 2>/dev/null | awk -v section="$section" -v key="$key" -v value="$value" '
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

    if [ -s "$tmp" ] && ! $USE_SUDO cmp -s "$tmp" "$file"; then
        if $USE_SUDO cp "$tmp" "$file"; then
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
    $USE_SUDO cat "$file" 2>/dev/null | awk -v val="$value" '
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

    if [ -s "$tmp" ] && ! $USE_SUDO cmp -s "$tmp" "$file"; then
        if $USE_SUDO cp "$tmp" "$file"; then
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

# Remove unwanted system paths (SYSTEM_UNWANTED_PATHS) when present. No prompt.
system_unwanted_paths_cleanup() {
    local p=""

    echo -e "\033[36m[CLEANUP] Checking unwanted system paths...\033[0m"
    for p in "${SYSTEM_UNWANTED_PATHS[@]}"; do
        if [ -e "$p" ] || [ -L "$p" ]; then
            echo -e "\033[33m[CLEANUP] Removing: ${p}\033[0m"
            if $USE_SUDO rm -rf "$p"; then
                echo -e "\033[32m[CLEANUP] Removed: ${p}\033[0m"
            else
                echo -e "\033[31m[CLEANUP] Failed to remove: ${p}\033[0m"
            fi
        else
            echo -e "\033[37m[CLEANUP] Not present: ${p}\033[0m"
        fi
    done
    return 0
}

# Idempotently cap system log growth (journald + logrotate). No prompt.
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
            printf '[Journal]\n' | $USE_SUDO tee "$journald_conf" >/dev/null 2>&1
        fi
        _ensure_conf_kv "$journald_conf" "Journal" "SystemMaxUse" "500M"
        _ensure_conf_kv "$journald_conf" "Journal" "SystemMaxFileSize" "50M"
        if [ "$_LOGLIMIT_CHANGED" -eq 1 ]; then
            if $USE_SUDO systemctl restart systemd-journald 2>/dev/null; then
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

# Measure one kind; writes "<size_mb>\t<location>" to <out_file> when present.
_devcache_measure() {
    local kind="$1"
    local out_file="$2"
    local location=""
    local size=0
    local target=""

    case "$kind" in
        pip)
            location="$(timeout 30 $DEV_CACHE_PIP_CMD cache dir 2>/dev/null)"
            ;;
        npm)
            location="$(timeout 30 "$DEV_CACHE_NPM_CMD" config get cache 2>/dev/null)"
            [ -n "$location" ] || location="$HOME/.npm"
            ;;
        gobuild)
            location="$(timeout 30 go env GOCACHE 2>/dev/null)"
            ;;
        gomod)
            location="$(timeout 30 go env GOMODCACHE 2>/dev/null)"
            ;;
        rust)
            for target in "${DEV_CACHE_RUST_TARGETS[@]}"; do
                size=$((size + $(_devcache_dir_size_mb "$target")))
            done
            printf '%s\t%s\n' "$size" "${DEV_CACHE_RUST_TARGETS[*]}" > "$out_file"
            return
            ;;
        varlog)
            location="$DEV_CACHE_LOG_DIR"
            ;;
    esac
    if [ -n "$location" ] && [ -d "$location" ]; then
        printf '%s\t%s\n' "$(_devcache_dir_size_mb "$location")" "$location" > "$out_file"
    fi
}

# Accept handler (prompt_queue_flush): clean one oversized item. Queue ids are
# devcache_<kind>.
_devcache_clean_item() {
    local kind="${1#devcache_}"
    local target=""
    local logf=""

    echo -e "\033[36m[DEV CACHE] Cleaning: ${kind}\033[0m"
    case "$kind" in
        pip)
            if $DEV_CACHE_PIP_CMD cache purge; then
                echo -e "\033[32m[DEV CACHE] pip cache purged\033[0m"
            else
                echo -e "\033[31m[DEV CACHE] pip cache purge failed\033[0m"
            fi
            ;;
        npm)
            if "$DEV_CACHE_NPM_CMD" cache clean --force; then
                echo -e "\033[32m[DEV CACHE] npm cache cleaned\033[0m"
            else
                echo -e "\033[31m[DEV CACHE] npm cache clean failed\033[0m"
            fi
            ;;
        gobuild)
            if go clean -cache; then
                echo -e "\033[32m[DEV CACHE] go build cache cleaned\033[0m"
            else
                echo -e "\033[31m[DEV CACHE] go clean -cache failed\033[0m"
            fi
            ;;
        gomod)
            if go clean -modcache; then
                echo -e "\033[32m[DEV CACHE] go module cache cleaned\033[0m"
            else
                echo -e "\033[31m[DEV CACHE] go clean -modcache failed\033[0m"
            fi
            ;;
        rust)
            for target in "${DEV_CACHE_RUST_TARGETS[@]}"; do
                echo -e "\033[37m[DEV CACHE]   removing ${target}\033[0m"
                rm -rf "$target" 2>/dev/null
            done
            echo -e "\033[32m[DEV CACHE] rust caches cleared\033[0m"
            ;;
        varlog)
            if command -v journalctl >/dev/null 2>&1; then
                echo -e "\033[37m[VAR LOG]   vacuuming systemd journal to <=200M\033[0m"
                $USE_SUDO journalctl --rotate >/dev/null 2>&1
                $USE_SUDO journalctl --vacuum-size=200M
            fi
            echo -e "\033[37m[VAR LOG]   deleting rotated / compressed / date-stamped logs\033[0m"
            $USE_SUDO find "$DEV_CACHE_LOG_DIR" -type f \( \
                -name "*.gz" -o -name "*.xz" -o -name "*.bz2" -o \
                -name "*.old" -o -name "*.[0-9]" -o -name "*-20??????" \
            \) -delete 2>/dev/null
            echo -e "\033[37m[VAR LOG]   truncating large active *.log files (>50M)\033[0m"
            while IFS= read -r -d '' logf; do
                $USE_SUDO truncate -s 0 "$logf" 2>/dev/null
            done < <($USE_SUDO find "$DEV_CACHE_LOG_DIR" -type f -name "*.log" -size +50M -print0 2>/dev/null)
            echo -e "\033[32m[VAR LOG] ${DEV_CACHE_LOG_DIR} cleaned\033[0m"
            ;;
    esac
}

# Scan caches in parallel, then offer every oversized item in one confirmation.
dev_cache_cleanup_prompt() {
    local measure_dir=""
    local kind=""
    local label=""
    local size=0
    local location=""
    local limit=0
    local rustup_home="${RUSTUP_HOME:-$HOME/.rustup}"
    local cargo_home="${CARGO_HOME:-$HOME/.cargo}"
    local -a kinds=()
    local -A labels=(
        [pip]="pip cache" [npm]="npm cache" [gobuild]="go build cache"
        [gomod]="go module cache" [rust]="rust re-downloadable cache" [varlog]="$DEV_CACHE_LOG_DIR"
    )
    local -A actions=(
        [npm]="npm cache clean --force" [gobuild]="go clean -cache" [gomod]="go clean -modcache"
        [rust]="remove downloads/registry (toolchains kept)"
        [varlog]="journal vacuum + delete rotated + truncate large"
    )

    echo -e "\033[36m[DEV CACHE] Measuring caches (threshold: ${DEV_CACHE_SIZE_THRESHOLD_MB} MB) and ${DEV_CACHE_LOG_DIR} (threshold: ${VAR_LOG_SIZE_THRESHOLD_MB} MB) in parallel...\033[0m"

    DEV_CACHE_PIP_CMD="$(_devcache_resolve_pip)"
    DEV_CACHE_NPM_CMD="$(resolve_tool_bin npm 2>/dev/null || command -v npm 2>/dev/null || true)"
    actions[pip]="${DEV_CACHE_PIP_CMD} cache purge"
    DEV_CACHE_RUST_TARGETS=()
    for location in "$rustup_home/downloads" "$cargo_home/registry/cache" "$cargo_home/registry/src" "$cargo_home/git/checkouts"; do
        [ -d "$location" ] && DEV_CACHE_RUST_TARGETS+=("$location")
    done

    if [ -n "$DEV_CACHE_PIP_CMD" ]; then kinds+=(pip); else echo -e "\033[37m[DEV CACHE] pip: not installed\033[0m"; fi
    if [ -n "$DEV_CACHE_NPM_CMD" ]; then kinds+=(npm); else echo -e "\033[37m[DEV CACHE] npm: not installed\033[0m"; fi
    if command -v go >/dev/null 2>&1; then kinds+=(gobuild gomod); else echo -e "\033[37m[DEV CACHE] go: not installed\033[0m"; fi
    if [ "${#DEV_CACHE_RUST_TARGETS[@]}" -gt 0 ]; then kinds+=(rust); else echo -e "\033[37m[DEV CACHE] rust: no re-downloadable cache\033[0m"; fi
    kinds+=(varlog)

    measure_dir="$(mktemp -d)" || return 1
    for kind in "${kinds[@]}"; do
        _devcache_measure "$kind" "$measure_dir/$kind" &
    done
    wait

    for kind in "${kinds[@]}"; do
        label="${labels[$kind]}"
        if [ ! -s "$measure_dir/$kind" ]; then
            echo -e "\033[37m[DEV CACHE] ${label}: none\033[0m"
            continue
        fi
        IFS=$'\t' read -r size location < "$measure_dir/$kind"
        limit="$DEV_CACHE_SIZE_THRESHOLD_MB"
        [ "$kind" = "varlog" ] && limit="$VAR_LOG_SIZE_THRESHOLD_MB"
        if [ "$size" -ge "$limit" ]; then
            echo -e "\033[33m[DEV CACHE] ${label}: ${size} MB at ${location} (over threshold)\033[0m"
            prompt_queue_add "devcache_${kind}" "n" "${label} ${size} MB -> ${actions[$kind]}" _devcache_clean_item
        else
            echo -e "\033[37m[DEV CACHE] ${label}: ${size} MB (under threshold, skip)\033[0m"
        fi
    done
    rm -rf "$measure_dir"

    if [ "${#PROMPT_QUEUE_IDS[@]}" -eq 0 ]; then
        echo -e "\033[32m[DEV CACHE] Nothing over threshold - no cleanup needed\033[0m"
        return 0
    fi
    prompt_queue_flush 0 "Clean which items"
    echo -e "\033[36m[DEV CACHE] Cache check complete\033[0m"
}

dev_cache_cleanup_menu() {
    printf "\033c"
    echo "=== Dev Cache & /var/log Cleanup (pip/npm/go/rust + logs) ==="
    echo ""
    dev_cache_cleanup_prompt
    echo ""
    read -r -p "Press Enter to continue..."
}

system_log_limits_menu() {
    printf "\033c"
    echo "=== System Log Size Limits (journald + logrotate) ==="
    system_log_limits_apply
    echo ""
    read -r -p "Press Enter to continue..."
}
