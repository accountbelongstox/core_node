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
#
# =============================================================================
# app_resource_limit.sh - shared resource-limit recipe for GUI app launches.
#
# Wraps an app launch in a transient cgroup-v2 scope (dies with the app) so the
# WHOLE multi-process Electron/Chromium tree is capped as ONE aggregate. Limits
# are MACHINE-RELATIVE (computed from /proc/meminfo MemTotal + nproc) and
# overridable via env / per-call args. Primary mechanism: systemd-run --scope.
# Fallback when systemd-run is unavailable: cpulimit (CPU-only, crude).
#
# Sourced + called by installers, exactly like desktop_shortcut_manager.sh.
#
# Public API (ONE function):
#   apply_app_resource_limit \
#       --id   <stem>          .desktop filename stem (e.g. google-chrome); also
#                              names the wrapper /usr/local/bin/<id>-rlimit.
#       --exec <real binary>   the REAL executable the wrapper ultimately runs.
#       [--mem  <MemoryMax>]   e.g. 9G / 9091M ; default = % of total RAM.
#       [--high <MemoryHigh>]  e.g. 7G / 6818M ; default = % of MemoryMax.
#       [--cpu  <CPUQuota>]    e.g. 2400%      ; default = % per core * nproc.
#       [--pre  '<args>']      inner args injected before "$@" (e.g. --no-sandbox).
#       [--root]               use a --system scope (root-mode apps); else --user.
#       [--desktop <who>]      repoint the app's .desktop Exec at the wrapper for
#                              this audience (all|all-users|<user>|none|menu-only
#                              via empty). Default: do not touch any .desktop.
#       [--field <code>]       .desktop field code to append after the wrapper in
#                              the repointed Exec (e.g. %U / %F). Default none.
#
# What it does (idempotent, safe to re-run):
#   1. Writes /usr/local/bin/<id>-rlimit: a self-re-exec wrapper that, on first
#      entry, re-execs itself inside `systemd-run [--user|--system] --scope
#      --collect` with the computed MemoryMax/MemoryHigh/CPUQuota, then on
#      re-entry (ARL_SCOPE_ACTIVE=1) exec's the real binary directly. Preserves
#      "$@" and .desktop field codes. cpulimit fallback when systemd-run absent.
#   2. (when --desktop given) repoints the menu/desktop .desktop Exec at the
#      wrapper via edit_desktop_shortcut_from_desktop_shortcut_manager.
#
# Double-wrap safety:
#   * Re-running the installer overwrites the wrapper with identical content - it
#     never nests a second scope (the wrapper's ARL_SCOPE_ACTIVE re-entry guard
#     short-circuits any inner invocation).
#   * --exec is sanitized: if the caller passes an Exec that ALREADY points at a
#     -rlimit wrapper or a `systemd-run ... --` prefix, the real binary is
#     recovered first so we wrap the real binary, not the wrapper.
#
# ROOT-MODE: apps launched as root (self-elevating --no-sandbox / pkexec) MUST
# use --root (systemd-run --system --scope), because systemd-run --user does not
# govern a process re-exec'd as root. User-session apps omit --root.
# =============================================================================

# ---- variable declarations (all at top) ------------------------------------
ARL_BIN_DIR="/usr/local/bin"                 # where <id>-rlimit wrappers live
ARL_DEFAULT_MEM_PCT="${APP_MEM_PCT:-60}"     # MemoryMax  = this % of total RAM
ARL_DEFAULT_HIGH_PCT="${APP_HIGH_PCT:-75}"   # MemoryHigh = this % of MemoryMax
ARL_DEFAULT_CPU_PCT="${APP_CPU_PCT:-75}"     # CPUQuota   = this % per core * nproc
ARL_MIN_MEM_MB="${APP_MIN_MEM_MB:-512}"      # floor so a tiny box still launches

# Privilege prefix: honor a caller-set USE_SUDO (gvar_common); else derive it.
_arl_sudo() {
    if [ -n "${USE_SUDO+x}" ]; then printf '%s' "$USE_SUDO"; return 0; fi
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then printf 'sudo'; fi
}

# Sanitize an id into a safe wrapper/.desktop stem (lowercase, [a-z0-9._-]).
_arl_id() {
    printf '%s' "$1" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9._-'
}

# Recover the REAL binary from a value that may already be a wrapper / scope line.
# Strips a leading "systemd-run ... --" prefix and resolves an *-rlimit wrapper
# back to its ARL_REAL_BINARY, so re-runs (or callers that pass an already-wrapped
# Exec) never double-wrap.
_arl_real_from_exec() {
    local raw="$1" first real=""
    [ -n "$raw" ] || { printf '%s' "$raw"; return 0; }
    # Drop a leading systemd-run scope prefix: keep everything after the first " -- ".
    case "$raw" in
        systemd-run\ *--\ *) raw="${raw#*-- }" ;;
    esac
    # First whitespace-separated token is the candidate binary.
    first="${raw%% *}"
    # If it is one of our wrappers, read the embedded ARL_REAL_BINARY.
    case "$first" in
        */*-rlimit|*-rlimit)
            if [ -f "$first" ]; then
                real="$(grep -m1 '^ARL_REAL_BINARY=' "$first" 2>/dev/null | cut -d'"' -f2)"
                [ -n "$real" ] && { printf '%s' "$real"; return 0; }
            fi
            ;;
    esac
    printf '%s' "$first"
}

# Compute machine-relative limits into the three named out-vars (caller passes
# any explicit --mem/--high/--cpu which win). Echoes "MEM<TAB>HIGH<TAB>CPU".
_arl_compute_limits() {
    local mem_in="$1" high_in="$2" cpu_in="$3"
    local mem_total_kb nproc mem_max_mb mem_high_mb cpu_quota mem high cpu tab
    tab="$(printf '\t')"
    mem_total_kb="$(awk '/^MemTotal:/{print $2}' /proc/meminfo 2>/dev/null)"
    nproc="$(nproc 2>/dev/null || echo 1)"
    [ -n "$mem_total_kb" ] || mem_total_kb=2097152
    mem_max_mb=$(( mem_total_kb * ARL_DEFAULT_MEM_PCT / 100 / 1024 ))
    [ "$mem_max_mb" -lt "$ARL_MIN_MEM_MB" ] && mem_max_mb="$ARL_MIN_MEM_MB"
    mem_high_mb=$(( mem_max_mb * ARL_DEFAULT_HIGH_PCT / 100 ))
    cpu_quota=$(( nproc * ARL_DEFAULT_CPU_PCT ))
    mem="${mem_in:-${APP_MEM_MAX:-${mem_max_mb}M}}"
    high="${high_in:-${APP_MEM_HIGH:-${mem_high_mb}M}}"
    cpu="${cpu_in:-${APP_CPU_QUOTA:-${cpu_quota}%}}"
    printf '%s%s%s%s%s' "$mem" "$tab" "$high" "$tab" "$cpu"
}

# ---- public API (ONE function) ---------------------------------------------
apply_app_resource_limit() {
    local id="" real="" mem="" high="" cpu="" pre="" mode="user" desktop_who="" field=""
    local sudo wrapper limits tab scope_flag wrapper_exec
    tab="$(printf '\t')"
    while [ $# -gt 0 ]; do
        case "$1" in
            --id)      id="$(_arl_id "$2")"; shift 2 ;;
            --exec)    real="$2"; shift 2 ;;
            --mem)     mem="$2"; shift 2 ;;
            --high)    high="$2"; shift 2 ;;
            --cpu)     cpu="$2"; shift 2 ;;
            --pre)     pre="$2"; shift 2 ;;
            --root)    mode="system"; shift ;;
            --desktop) desktop_who="$2"; shift 2 ;;
            --field)   field="$2"; shift 2 ;;
            *) shift ;;
        esac
    done
    if [ -z "$id" ] || [ -z "$real" ]; then
        echo "[arl] apply: --id and --exec are required" >&2
        return 1
    fi
    # Recover the real binary if the caller handed us an already-wrapped Exec.
    real="$(_arl_real_from_exec "$real")"
    if [ -z "$real" ]; then
        echo "[arl] apply: could not resolve a real binary from --exec" >&2
        return 1
    fi

    sudo="$(_arl_sudo)"
    wrapper="$ARL_BIN_DIR/${id}-rlimit"
    scope_flag="--user"
    [ "$mode" = "system" ] && scope_flag="--system"

    # Resolve default limits ONCE for the comment line; the wrapper still
    # recomputes at launch time so it self-adjusts per machine (env overrides win).
    limits="$(_arl_compute_limits "$mem" "$high" "$cpu")"

    $sudo mkdir -p "$ARL_BIN_DIR" 2>/dev/null || true
    $sudo tee "$wrapper" >/dev/null <<WRAPEOF
#!/bin/bash
# App launch wrapper with machine-relative resource limits (generated by
# app_resource_limit.sh -- do not edit). Caps the whole process tree in a
# transient cgroup-v2 scope. Idempotent; preserves "\$@" and .desktop field codes.
ARL_REAL_BINARY="$real"
ARL_PRE_ARGS="$pre"
ARL_SCOPE_MODE="$mode"
# Explicit per-app limit overrides baked at install time ("" => machine-relative).
ARL_FIXED_MEM="$mem"
ARL_FIXED_HIGH="$high"
ARL_FIXED_CPU="$cpu"
# Already inside our scope: exec the real binary directly, never re-wrap.
if [ "\${ARL_SCOPE_ACTIVE:-0}" = "1" ]; then
    exec "\$ARL_REAL_BINARY" \$ARL_PRE_ARGS "\$@"
fi
# Compute limits at launch time (tracks the actual machine; env overrides win).
ARL_MEM_TOTAL_KB="\$(awk '/^MemTotal:/{print \$2}' /proc/meminfo 2>/dev/null)"
ARL_NPROC="\$(nproc 2>/dev/null || echo 1)"
[ -n "\$ARL_MEM_TOTAL_KB" ] || ARL_MEM_TOTAL_KB=2097152
ARL_MM=\$(( ARL_MEM_TOTAL_KB * \${APP_MEM_PCT:-$ARL_DEFAULT_MEM_PCT} / 100 / 1024 ))
[ "\$ARL_MM" -lt "\${APP_MIN_MEM_MB:-$ARL_MIN_MEM_MB}" ] && ARL_MM=\${APP_MIN_MEM_MB:-$ARL_MIN_MEM_MB}
ARL_MH=\$(( ARL_MM * \${APP_HIGH_PCT:-$ARL_DEFAULT_HIGH_PCT} / 100 ))
ARL_CQ=\$(( ARL_NPROC * \${APP_CPU_PCT:-$ARL_DEFAULT_CPU_PCT} ))
ARL_MEM_MAX="\${ARL_FIXED_MEM:-}"; [ -n "\$ARL_MEM_MAX" ] || ARL_MEM_MAX="\${APP_MEM_MAX:-\${ARL_MM}M}"
ARL_MEM_HIGH="\${ARL_FIXED_HIGH:-}"; [ -n "\$ARL_MEM_HIGH" ] || ARL_MEM_HIGH="\${APP_MEM_HIGH:-\${ARL_MH}M}"
ARL_CPU_QUOTA="\${ARL_FIXED_CPU:-}"; [ -n "\$ARL_CPU_QUOTA" ] || ARL_CPU_QUOTA="\${APP_CPU_QUOTA:-\${ARL_CQ}%}"
# Primary: systemd-run scope. --user requires a delegated user session; for
# root-mode apps the wrapper is invoked AS root and uses --system. --collect
# garbage-collects the transient scope unit when the app exits.
if command -v systemd-run >/dev/null 2>&1; then
    exec systemd-run $scope_flag --scope --collect --quiet \\
        -p "MemoryMax=\$ARL_MEM_MAX" -p "MemoryHigh=\$ARL_MEM_HIGH" -p "CPUQuota=\$ARL_CPU_QUOTA" \\
        --setenv=ARL_SCOPE_ACTIVE=1 \\
        "\$0" "\$@"
fi
# Fallback: cpulimit (CPU-only, crude; no memory cap). Strips the trailing %.
if command -v cpulimit >/dev/null 2>&1; then
    exec cpulimit -l "\${ARL_CPU_QUOTA%\%}" -- "\$ARL_REAL_BINARY" \$ARL_PRE_ARGS "\$@"
fi
# Last resort: run unlimited so the app still launches.
exec "\$ARL_REAL_BINARY" \$ARL_PRE_ARGS "\$@"
WRAPEOF
    $sudo chmod 0755 "$wrapper" 2>/dev/null || true
    echo "[arl] wrapper installed ($mode scope): $wrapper -> $real (mem=${limits%%$tab*} cpu=${limits##*$tab})"

    # Optionally repoint the .desktop Exec at the wrapper (menu + chosen desktops).
    # Skipped silently when desktop_shortcut_manager is not sourced.
    if [ -n "$desktop_who" ] && command -v edit_desktop_shortcut_from_desktop_shortcut_manager >/dev/null 2>&1; then
        wrapper_exec="$wrapper"
        [ -n "$field" ] && wrapper_exec="$wrapper $field"
        edit_desktop_shortcut_from_desktop_shortcut_manager \
            --id "$id" --key Exec --value "$wrapper_exec" --desktop "$desktop_who"
    fi
    return 0
}
