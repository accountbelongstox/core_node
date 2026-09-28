#!/bin/bash
# Prompt helpers: TTY-guarded, timeout-bounded, default-backed reads, plus a
# stacked confirmation queue. Side-effect-free and safe to source from any
# library or installer.

# Source-once guard: repeated `source` is a no-op.
if [ "${PROMPT_COMMON_LOADED:-false}" = "true" ]; then
    return
fi
PROMPT_COMMON_LOADED="true"

# Confirmation queue state. While PROMPT_QUEUE_DEFERRED=true (dd.sh startup),
# prompt_queue_commit keeps items queued; the owner flushes them once.
PROMPT_QUEUE_DEFERRED="${PROMPT_QUEUE_DEFERRED:-false}"
PROMPT_QUEUE_IDS=()
PROMPT_QUEUE_DEFAULTS=()
PROMPT_QUEUE_TEXTS=()
PROMPT_QUEUE_ACCEPT_FNS=()
PROMPT_QUEUE_DECLINE_FNS=()
PROMPT_QUEUE_ACTIONS_RUN=0

# Auto-continue: DD_AUTO_CONTINUE=1/true (exported by the install chain
# orchestrator), CI=true, NONINTERACTIVE=1 or DEBIAN_FRONTEND=noninteractive
# make every prompt take its documented default immediately.
prompt_auto_continue() {
    [ "${DD_AUTO_CONTINUE:-}" = "1" ] || [ "${DD_AUTO_CONTINUE:-}" = "true" ] \
        || [ "${NONINTERACTIVE:-}" = "1" ] || [ "${CI:-}" = "true" ] \
        || [ "${DEBIAN_FRONTEND:-}" = "noninteractive" ]
}

# 0 when /dev/tty is usable by this process. Hang classes covered: (1) no
# controlling terminal (cron/ssh -T); (2) the process is not in the terminal's
# FOREGROUND process group -- a background job reading /dev/tty is stopped by
# SIGTTIN and looks "stuck at the prompt". stdin being a pipe does NOT
# suppress the prompt (the question goes to /dev/tty deliberately).
prompt_tty_foreground() {
    local tpgid=""
    local pgid=""
    [ -r /dev/tty ] && [ -w /dev/tty ] && (exec 3<>/dev/tty) 2>/dev/null || return 1
    tpgid="$(ps -o tpgid= -p $$ 2>/dev/null | tr -d ' ')"
    pgid="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')"
    [ -z "$tpgid" ] || [ "$tpgid" = "$pgid" ]
}

# TTY-guarded prompt with timeout + default: NEVER hangs a script; a
# foreground prompt nobody answers is bounded by the timeout, then the
# default wins.
# Usage: prompt_read_default VAR_NAME default [timeout_sec] [prompt_text]
prompt_read_default() {
    local __prd_var="$1" __prd_default="$2" __prd_timeout="${3:-30}" __prd_prompt="${4:-}"
    local __prd_reply=""
    if ! prompt_auto_continue && prompt_tty_foreground; then
        [ -n "$__prd_prompt" ] && printf '%s' "$__prd_prompt" > /dev/tty
        read -r -t "$__prd_timeout" __prd_reply < /dev/tty 2>/dev/null || __prd_reply=""
        [ -n "$__prd_prompt" ] && printf '\n' > /dev/tty
    fi
    printf -v "$__prd_var" '%s' "${__prd_reply:-$__prd_default}"
}

# Echoes the user's reply, or $1 (the documented default) when there is no
# interactive terminal / no answer within ${2:-30}s. Usage: confirm="$(read_default y)"
read_default() {
    local __rd_value=""
    prompt_read_default __rd_value "$1" "${2:-30}"
    printf '%s' "$__rd_value"
}

# Live countdown prompt. Enter or timeout -> default. The first other key stops
# the countdown; the rest of the line is then read without a timeout.
# seconds=0 waits for a full line without a countdown.
# Usage: prompt_countdown_read VAR_NAME default seconds prompt_text
prompt_countdown_read() {
    local __pcr_var="$1" __pcr_default="$2" __pcr_seconds="${3:-5}" __pcr_text="${4:-}"
    local __pcr_reply="" __pcr_char="" __pcr_rest="" __pcr_left=0 __pcr_typed=false

    if prompt_auto_continue || ! prompt_tty_foreground; then
        printf -v "$__pcr_var" '%s' "$__pcr_default"
        return
    fi
    if [ "$__pcr_seconds" -le 0 ] 2>/dev/null; then
        printf '%s: ' "$__pcr_text" > /dev/tty
        IFS= read -r __pcr_reply < /dev/tty 2>/dev/null || __pcr_reply=""
        printf -v "$__pcr_var" '%s' "${__pcr_reply:-$__pcr_default}"
        return
    fi
    __pcr_left="$__pcr_seconds"
    while [ "$__pcr_left" -gt 0 ]; do
        printf '\r\033[K%s (auto in %ss): ' "$__pcr_text" "$__pcr_left" > /dev/tty
        if IFS= read -r -s -n 1 -t 1 __pcr_char < /dev/tty 2>/dev/null; then
            __pcr_typed=true
            break
        fi
        __pcr_left=$((__pcr_left - 1))
    done
    if [ "$__pcr_typed" = true ] && [ -n "$__pcr_char" ]; then
        printf '%s' "$__pcr_char" > /dev/tty
        IFS= read -r __pcr_rest < /dev/tty 2>/dev/null || __pcr_rest=""
        __pcr_reply="$__pcr_char$__pcr_rest"
    else
        printf '\n' > /dev/tty
    fi
    printf -v "$__pcr_var" '%s' "${__pcr_reply:-$__pcr_default}"
}

# prompt_queue_add <id> <default y|n> <text> <accept_fn> [decline_fn]
# Queues one confirmation; re-adding an id replaces it. Handlers are called as
# accept_fn <id> and decline_fn <id> <declined|default>.
prompt_queue_add() {
    local id="$1"
    local index=0
    local slot="${#PROMPT_QUEUE_IDS[@]}"

    for index in "${!PROMPT_QUEUE_IDS[@]}"; do
        if [ "${PROMPT_QUEUE_IDS[$index]}" = "$id" ]; then
            slot="$index"
            break
        fi
    done
    PROMPT_QUEUE_IDS[$slot]="$id"
    PROMPT_QUEUE_DEFAULTS[$slot]="$2"
    PROMPT_QUEUE_TEXTS[$slot]="$3"
    PROMPT_QUEUE_ACCEPT_FNS[$slot]="$4"
    PROMPT_QUEUE_DECLINE_FNS[$slot]="${5:-}"
}

# Flush now unless the queue owner deferred it (dd.sh startup).
prompt_queue_commit() {
    if [ "$PROMPT_QUEUE_DEFERRED" != "true" ]; then
        prompt_queue_flush 0 "Confirm"
    fi
}

# prompt_queue_flush <seconds> <prompt_text>
# Shows every queued item as ONE stacked prompt and runs the handlers.
# Answers: Enter/timeout = item defaults, y = all, n = none, 1,3 = listed only.
# An empty queue still shows the countdown when seconds > 0 (menu pause).
# Sets PROMPT_QUEUE_ACTIONS_RUN to the number of accepted items.
prompt_queue_flush() {
    local seconds="${1:-0}"
    local text="${2:-Confirm}"
    local answer=""
    local mode="default"
    local reason="default"
    local token=""
    local index=0
    local accept=false
    local -a ids=("${PROMPT_QUEUE_IDS[@]}")
    local -a defaults=("${PROMPT_QUEUE_DEFAULTS[@]}")
    local -a texts=("${PROMPT_QUEUE_TEXTS[@]}")
    local -a accept_fns=("${PROMPT_QUEUE_ACCEPT_FNS[@]}")
    local -a decline_fns=("${PROMPT_QUEUE_DECLINE_FNS[@]}")
    local -A picked=()

    PROMPT_QUEUE_IDS=()
    PROMPT_QUEUE_DEFAULTS=()
    PROMPT_QUEUE_TEXTS=()
    PROMPT_QUEUE_ACCEPT_FNS=()
    PROMPT_QUEUE_DECLINE_FNS=()
    PROMPT_QUEUE_ACTIONS_RUN=0

    if [ "${#ids[@]}" -eq 0 ]; then
        [ "$seconds" -gt 0 ] 2>/dev/null && prompt_countdown_read answer "" "$seconds" "$text"
        return 0
    fi

    echo ""
    echo -e "\033[36m========================================\033[0m"
    echo -e "\033[36mPending confirmations (${#ids[@]}):\033[0m"
    for index in "${!ids[@]}"; do
        printf '  %d) [%s] %s\n' "$((index + 1))" "${defaults[$index]}" "${texts[$index]}"
    done
    echo -e "\033[37m  Enter = [defaults] | y = all | n = none | 1,3 = listed items only\033[0m"
    echo -e "\033[36m========================================\033[0m"
    prompt_countdown_read answer "" "$seconds" "$text"

    answer="$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
    case "$answer" in
        "") mode="default" ;;
        y|yes|a|all) mode="all" ;;
        n|no|none) mode="none" ;;
        *)
            if [[ "$answer" =~ ^[0-9,]+$ ]]; then
                mode="list"
                for token in ${answer//,/ }; do
                    picked[$((10#$token - 1))]=1
                done
            else
                echo -e "\033[33m[CONFIRM] Unrecognized answer '$answer' - using defaults\033[0m"
            fi
            ;;
    esac
    [ "$mode" = "default" ] || reason="declined"

    for index in "${!ids[@]}"; do
        case "$mode" in
            all) accept=true ;;
            none) accept=false ;;
            list) [ -n "${picked[$index]:-}" ] && accept=true || accept=false ;;
            *) [ "${defaults[$index]}" = "y" ] && accept=true || accept=false ;;
        esac
        if [ "$accept" = true ]; then
            echo -e "\033[32m[CONFIRM] $((index + 1))) ${texts[$index]} -> yes\033[0m"
            PROMPT_QUEUE_ACTIONS_RUN=$((PROMPT_QUEUE_ACTIONS_RUN + 1))
            "${accept_fns[$index]}" "${ids[$index]}" || true
        else
            echo -e "\033[33m[CONFIRM] $((index + 1))) ${texts[$index]} -> no\033[0m"
            if [ -n "${decline_fns[$index]}" ]; then
                "${decline_fns[$index]}" "${ids[$index]}" "$reason" || true
            fi
        fi
    done
    return 0
}
