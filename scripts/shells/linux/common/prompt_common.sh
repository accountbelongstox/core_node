#!/bin/bash
# Prompt helpers: TTY-guarded, timeout-bounded, default-backed reads.
# Side-effect-free and safe to source from any library or installer.

# Source-once guard: repeated `source` is a no-op.
if [ "${PROMPT_COMMON_LOADED:-false}" = "true" ]; then
    return
fi
PROMPT_COMMON_LOADED="true"

# TTY-guarded prompt with timeout + default: NEVER hangs a script. Hang classes
# covered: (1) no controlling terminal (cron/ssh -T) -- /dev/tty unreadable;
# (2) the process is not in the terminal's FOREGROUND process group -- a
# background job reading /dev/tty is stopped by SIGTTIN and looks "stuck at the
# prompt"; (3) a foreground prompt nobody answers -- bounded by the timeout,
# then the default wins. stdin being a pipe/herestring does NOT suppress the
# prompt (the question goes to /dev/tty deliberately).
# Usage: prompt_read_default VAR_NAME default [timeout_sec] [prompt_text]
prompt_read_default() {
    local __prd_var="$1" __prd_default="$2" __prd_timeout="${3:-30}" __prd_prompt="${4:-}"
    local __prd_reply="" __prd_tpgid="" __prd_pgid=""
    if [ -r /dev/tty ] && [ -w /dev/tty ]; then
        __prd_tpgid="$(ps -o tpgid= -p $$ 2>/dev/null | tr -d ' ')"
        __prd_pgid="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')"
        if [ -z "$__prd_tpgid" ] || [ "$__prd_tpgid" = "$__prd_pgid" ]; then
            [ -n "$__prd_prompt" ] && printf '%s' "$__prd_prompt" > /dev/tty
            read -r -t "$__prd_timeout" __prd_reply < /dev/tty 2>/dev/null || __prd_reply=""
            [ -n "$__prd_prompt" ] && printf '\n' > /dev/tty
        fi
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
