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
# WHOLE multi-process Electron/Chromium tree is capped as one aggregate. Limits
# are MACHINE-RELATIVE (computed from /proc/meminfo MemTotal + nproc) and
# overridable via env. Primary mechanism: systemd-run --scope. Fallback when
# systemd-run is unavailable: cpulimit (CPU-only, crude).
#
# Sourced+called by installers, exactly like desktop_shortcut_manager.sh. To
# repoint a .desktop Exec at the generated wrapper, reuse
# edit_desktop_shortcut_from_desktop_shortcut_manager from that lib.
#
# Public API:
#   compute_app_limits_from_app_resource_limit
#       -> exports ARL_MEM_MAX ARL_MEM_HIGH ARL_CPU_QUOTA (machine-relative,
#          env-overridable via APP_MEM_MAX/APP_MEM_HIGH/APP_CPU_QUOTA and the
#          percentage knobs APP_MEM_PCT/APP_HIGH_PCT/APP_CPU_PCT).
#
#   install_app_limit_wrapper_from_app_resource_limit \
#       --path <wrapper_path> --real <real_binary> [--mode user|system] \
#       [--pre 'extra inner args']
#       -> writes an idempotent wrapper script that re-execs itself inside a
#          --scope with the computed limits, preserving "$@" and field codes.
#
# Idempotency: the wrapper sets ARL_SCOPE_ACTIVE=1 across the scope boundary; on
# re-entry it skips wrapping and exec's the real binary directly. Re-running the
# installer just overwrites the wrapper (same content) - never double-wraps.
#
# ROOT-MODE: apps launched as root (self-elevating --no-sandbox / pkexec) must
# use --mode system (systemd-run --system --scope), because systemd-run --user
# does not govern a process re-exec'd as root. User-session apps use --mode user.
# =============================================================================

# ---- variable declarations (all at top) ------------------------------------
ARL_DEFAULT_MEM_PCT="${APP_MEM_PCT:-60}"     # MemoryMax = this % of total RAM
ARL_DEFAULT_HIGH_PCT="${APP_HIGH_PCT:-75}"   # MemoryHigh = this % of MemoryMax
ARL_DEFAULT_CPU_PCT="${APP_CPU_PCT:-75}"     # CPUQuota   = this % per core * nproc
ARL_MIN_MEM_MB="${APP_MIN_MEM_MB:-512}"      # floor so a tiny box still launches
ARL_MEM_MAX=""
ARL_MEM_HIGH=""
ARL_CPU_QUOTA=""

# Compute machine-relative limits; honor explicit env overrides first.
# Exports ARL_MEM_MAX (e.g. 9091M), ARL_MEM_HIGH (e.g. 6818M), ARL_CPU_QUOTA (e.g. 2400%).
compute_app_limits_from_app_resource_limit() {
    local mem_total_kb nproc mem_max_mb mem_high_mb cpu_quota
    mem_total_kb="$(awk '/^MemTotal:/{print $2}' /proc/meminfo 2>/dev/null)"
    nproc="$(nproc 2>/dev/null || echo 1)"
    [ -n "$mem_total_kb" ] || mem_total_kb=2097152
    mem_max_mb=$(( mem_total_kb * ARL_DEFAULT_MEM_PCT / 100 / 1024 ))
    [ "$mem_max_mb" -lt "$ARL_MIN_MEM_MB" ] && mem_max_mb="$ARL_MIN_MEM_MB"
    mem_high_mb=$(( mem_max_mb * ARL_DEFAULT_HIGH_PCT / 100 ))
    cpu_quota=$(( nproc * ARL_DEFAULT_CPU_PCT ))
    ARL_MEM_MAX="${APP_MEM_MAX:-${mem_max_mb}M}"
    ARL_MEM_HIGH="${APP_MEM_HIGH:-${mem_high_mb}M}"
    ARL_CPU_QUOTA="${APP_CPU_QUOTA:-${cpu_quota}%}"
    export ARL_MEM_MAX ARL_MEM_HIGH ARL_CPU_QUOTA
    return 0
}

# Write an idempotent launch wrapper. Args:
#   --path <wrapper>  destination script path (e.g. /usr/local/bin/google-chrome)
#   --real <binary>   the real executable the wrapper ultimately exec's
#   --mode user|system   scope mode (default user; root-mode apps use system)
#   --pre  '<args>'   extra inner args injected before "$@" (e.g. --no-sandbox)
# Uses $USE_SUDO (from gvar_common) for privileged writes when set.
install_app_limit_wrapper_from_app_resource_limit() {
    local wrapper_path="" real_binary="" mode="user" pre_args="" sudo_pfx="${USE_SUDO:-}"
    while [ $# -gt 0 ]; do
        case "$1" in
            --path) wrapper_path="$2"; shift 2 ;;
            --real) real_binary="$2"; shift 2 ;;
            --mode) mode="$2"; shift 2 ;;
            --pre)  pre_args="$2"; shift 2 ;;
            *) shift ;;
        esac
    done
    if [ -z "$wrapper_path" ] || [ -z "$real_binary" ]; then
        echo "[arl] install: --path and --real are required" >&2
        return 1
    fi
    local scope_flag="--user"
    [ "$mode" = "system" ] && scope_flag="--system"

    $sudo_pfx mkdir -p "$(dirname "$wrapper_path")" 2>/dev/null || true
    $sudo_pfx tee "$wrapper_path" >/dev/null <<WRAPEOF
#!/bin/bash
# App launch wrapper with machine-relative resource limits (generated by
# app_resource_limit.sh -- do not edit). Caps the whole process tree in a
# transient cgroup-v2 scope. Idempotent; preserves "\$@" and .desktop field codes.
ARL_REAL_BINARY="$real_binary"
ARL_PRE_ARGS="$pre_args"
ARL_SCOPE_MODE="$mode"
# Already inside our scope: exec the real binary directly, never re-wrap.
if [ "\${ARL_SCOPE_ACTIVE:-0}" = "1" ]; then
    exec "\$ARL_REAL_BINARY" \$ARL_PRE_ARGS "\$@"
fi
# Compute limits at launch time (tracks the actual machine; env overrides win).
ARL_MEM_TOTAL_KB="\$(awk '/^MemTotal:/{print \$2}' /proc/meminfo 2>/dev/null)"
ARL_NPROC="\$(nproc 2>/dev/null || echo 1)"
[ -n "\$ARL_MEM_TOTAL_KB" ] || ARL_MEM_TOTAL_KB=2097152
ARL_MM=\$(( ARL_MEM_TOTAL_KB * \${APP_MEM_PCT:-60} / 100 / 1024 ))
[ "\$ARL_MM" -lt "\${APP_MIN_MEM_MB:-512}" ] && ARL_MM=\${APP_MIN_MEM_MB:-512}
ARL_MH=\$(( ARL_MM * \${APP_HIGH_PCT:-75} / 100 ))
ARL_CQ=\$(( ARL_NPROC * \${APP_CPU_PCT:-75} ))
ARL_MEM_MAX="\${APP_MEM_MAX:-\${ARL_MM}M}"
ARL_MEM_HIGH="\${APP_MEM_HIGH:-\${ARL_MH}M}"
ARL_CPU_QUOTA="\${APP_CPU_QUOTA:-\${ARL_CQ}%}"
# Primary: systemd-run scope. --user requires a delegated user session; for
# root-mode apps the wrapper is invoked AS root and uses --system.
if command -v systemd-run >/dev/null 2>&1; then
    exec systemd-run $scope_flag --scope --quiet \\
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
    $sudo_pfx chmod +x "$wrapper_path" 2>/dev/null || true
    echo "[arl] wrapper installed ($mode scope): $wrapper_path -> $real_binary"
    return 0
}
