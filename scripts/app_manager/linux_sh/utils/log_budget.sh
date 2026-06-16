#!/usr/bin/env bash
# App Manager - unified log namespace budget enforcer (Linux SH).
#
# WHY: install_service_at_index() wires each unit's stdout/stderr to
#   StandardOutput=append:<...>/logs/namespaces/apps/<name>/service.log
#   StandardError=append:<...>
# systemd's "append:" mode has NO size cap and NO rotation. Under
# Restart=always a chatty / crash-looping unit (e.g. Laravel Octane) grows
# service.log without bound (13GB observed for laravel_main).
#
# WHAT: trim log files IN PLACE so the whole logs folder stays under a fixed
# byte budget (default 50MB). Trimming keeps the most recent tail and rewrites
# the SAME inode (O_TRUNC then write), so systemd's already-open O_APPEND file
# descriptor keeps writing at the new end and the freed disk is actually
# reclaimed. Renaming / recreating the file would instead leak the old inode
# (systemd holds it open) and the new file would stay empty until restart.
#
# Override via env:
#   APP_MANAGER_LOG_TOTAL_BYTES  whole-folder budget (default 50MB)
#   APP_MANAGER_LOG_FILE_BYTES   per-file cap        (default 10MB)
#
# Direct run (used by the systemd timer):
#   bash log_budget.sh [LOG_DIR]

LOG_BUDGET_DEFAULT_TOTAL=$((50 * 1024 * 1024))
LOG_BUDGET_DEFAULT_FILE=$((10 * 1024 * 1024))

log_budget_file_size() {
    stat -c %s "$1" 2>/dev/null || echo 0
}

log_budget_total_size() {
    local sum=0 f sz
    for f in "$@"; do
        sz="$(log_budget_file_size "$f")"
        sum=$((sum + sz))
    done
    printf '%s' "$sum"
}

# Keep only the last $2 bytes of file $1, preserving the inode.
log_budget_trim_tail() {
    local f="$1" keep="$2" sz tmp
    sz="$(log_budget_file_size "$f")"
    (( sz <= keep )) && return 0
    tmp="${f}.trim.$$"
    if tail -c "$keep" "$f" > "$tmp" 2>/dev/null; then
        # O_TRUNC on the SAME inode, then rewrite the tail. systemd's O_APPEND
        # fd is unaffected (each write seeks to current EOF).
        cat "$tmp" > "$f" 2>/dev/null || true
    fi
    rm -f "$tmp" 2>/dev/null || true
}

# enforce_log_budget <dir> [total_budget_bytes] [per_file_cap_bytes]
enforce_log_budget() {
    local dir="$1"
    local total_budget="${2:-$LOG_BUDGET_DEFAULT_TOTAL}"
    local file_cap="${3:-$LOG_BUDGET_DEFAULT_FILE}"
    [[ -d "$dir" ]] || return 0

    local -a files=()
    local f
    while IFS= read -r -d '' f; do
        files+=("$f")
    done < <(find "$dir" -type f -name '*.log' -print0 2>/dev/null)
    (( ${#files[@]} == 0 )) && return 0

    # Pass 1: cap every individual file to file_cap.
    for f in "${files[@]}"; do
        log_budget_trim_tail "$f" "$file_cap"
    done

    # Pass 2: enforce the whole-folder budget by repeatedly halving the largest
    # file until the folder fits. Guarded against pathological loops.
    local total largest largest_sz sz new_keep guard=0
    total="$(log_budget_total_size "${files[@]}")"
    while (( total > total_budget && guard < 1000 )); do
        largest=""; largest_sz=0
        for f in "${files[@]}"; do
            sz="$(log_budget_file_size "$f")"
            if (( sz > largest_sz )); then largest_sz=$sz; largest="$f"; fi
        done
        [[ -z "$largest" ]] && break
        (( largest_sz <= 0 )) && break
        new_keep=$(( largest_sz / 2 ))
        (( new_keep < 4096 )) && new_keep=0
        log_budget_trim_tail "$largest" "$new_keep"
        total="$(log_budget_total_size "${files[@]}")"
        guard=$((guard + 1))
    done
}

# Allow running this file directly (systemd timer / manual one-shot).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    _lb_dir="${1:-${APP_MANAGER_DATA_DIR:-/opt/_core_node}/logs/namespaces/apps}"
    enforce_log_budget "$_lb_dir" \
        "${APP_MANAGER_LOG_TOTAL_BYTES:-$LOG_BUDGET_DEFAULT_TOTAL}" \
        "${APP_MANAGER_LOG_FILE_BYTES:-$LOG_BUDGET_DEFAULT_FILE}"
fi
