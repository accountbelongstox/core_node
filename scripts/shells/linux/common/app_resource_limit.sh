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
# WHOLE multi-process Electron/Chromium tree is capped as ONE aggregate. Per-app
# default is a HARD absolute cap (MemoryMax=1G, CPUQuota=10% of the machine),
# reduced PROPORTIONALLY on low-RAM boxes (min of the cap and 20% of total RAM).
# UNIFORM across every wrapped app (browsers, editors, AI tools). Overridable via
# env / per-call args. Primary mechanism: systemd-run --scope.
# Fallback when systemd-run is unavailable: cpulimit (CPU-only, crude).
#
# Sourced + called by installers, exactly like desktop_shortcut_manager.sh.
#
# Public API (ONE function):
#   apply_app_resource_limit \
#       --id   <stem>          .desktop filename stem (e.g. google-chrome); also
#                              names the wrapper /usr/local/bin/<id>-rlimit.
#       --exec <real binary>   the REAL executable the wrapper ultimately runs.
#       [--mem  <MemoryMax>]   e.g. 1G ; default = min(1G, 20% of total RAM).
#       [--high <MemoryHigh>]  e.g. 921M ; default = 90% of MemoryMax.
#       [--cpu  <CPUQuota>]    e.g. 320% ; default = 10% of machine (10% * nproc).
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
#      --collect --slice=<APP_SLICE>` with the computed MemoryMax/MemoryHigh/
#      CPUQuota, then on re-entry (ARL_SCOPE_ACTIVE=1) exec's the real binary
#      directly. Preserves "$@" and .desktop field codes. cpulimit fallback when
#      systemd-run absent. ALL wrappers share ONE slice carrying an AGGREGATE
#      MemoryHigh/MemoryMax (% of total RAM, re-applied via `systemctl
#      set-property --runtime`), so several heavy apps launched together cannot
#      collectively exhaust RAM -- per-app caps alone do NOT bound the sum.
#      Tunables (env): APP_AGG_MEM_PCT (85), APP_AGG_HIGH_PCT (72), APP_SLICE.
#      Scope: the slice lives in the CALLING systemd manager, so user-session
#      apps (--user) share one budget and root-mode apps (--system) share a
#      SEPARATE one -- the cap bounds same-manager apps (the heavy browsers/chat
#      are user-session and ARE bounded together), not across the user/root split.
#      cgroup-v2 only: on a v1/hybrid hierarchy (e.g. Ubuntu 20.04 default) the
#      slice + MemoryHigh are unavailable, so the wrapper degrades to a per-app
#      MemoryMax-only scope. The wrapper PROBES that a scope can be created and
#      falls through to cpulimit (then unlimited) so the app always launches.
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
# Per-app MemoryMax = min(ARL_DEFAULT_CAP_MB, ARL_DEFAULT_MEM_PCT% of total RAM): a HARD
# absolute cap (default 1G) that the % only reduces on low-RAM boxes (proportional
# shrink, never above 20% of total RAM). One UNIFORM recipe for every wrapped app.
ARL_DEFAULT_CAP_MB="${APP_MEM_CAP_MB:-1024}" # absolute per-app MemoryMax ceiling (MB) = 1G
ARL_DEFAULT_MEM_PCT="${APP_MEM_PCT:-20}"     # proportional ceiling: this % of total RAM
ARL_DEFAULT_HIGH_PCT="${APP_HIGH_PCT:-90}"   # MemoryHigh = this % of resolved MemoryMax
ARL_DEFAULT_CPU_PCT="${APP_CPU_PCT:-10}"     # CPUQuota   = this % of the machine (% * nproc)
ARL_MIN_MEM_MB="${APP_MIN_MEM_MB:-256}"      # floor so a tiny box still launches (< cap)
# Shared slice: every wrapper-launched app runs under ONE slice with an AGGREGATE
# memory cap, so two heavy apps cannot collectively exhaust RAM (per-app caps do
# NOT bound the sum -- critical on low-RAM / no-swap boxes). Slice limits are % of
# TOTAL RAM and are (re)applied at each launch (idempotent). Env-overridable.
ARL_SLICE_NAME="${APP_SLICE:-corenode-apps.slice}"
ARL_AGG_MEM_PCT="${APP_AGG_MEM_PCT:-85}"     # slice MemoryMax  = this % of total RAM
ARL_AGG_HIGH_PCT="${APP_AGG_HIGH_PCT:-72}"   # slice MemoryHigh = this % of total RAM

# Privilege prefix: honor a caller-set USE_SUDO (gvar_common); else derive it.
_arl_sudo() {
    if [ -n "${USE_SUDO+x}" ]; then printf '%s' "$USE_SUDO"; return 0; fi
    if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then printf 'sudo'; fi
}

# Sanitize an id into a safe wrapper/.desktop stem (lowercase, [a-z0-9._-]).
_arl_id() {
    printf '%s' "$1" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9._-'
}

# Normalize a systemd memory value (9G / 9091M / 512K / bare bytes) to MiB, so
# MemoryHigh can be compared against MemoryMax. Unknown forms -> 0 (no clamp).
_arl_mib() {
    case "$1" in
        *[Gg]) echo $(( ${1%[Gg]} * 1024 )) ;;
        *[Mm]) echo "${1%[Mm]}" ;;
        *[Kk]) echo $(( ${1%[Kk]} / 1024 )) ;;
        *[0-9]) echo $(( $1 / 1048576 )) ;;
        *) echo 0 ;;
    esac
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
    mem_max_mb=$(( mem_total_kb * ${APP_MEM_PCT:-$ARL_DEFAULT_MEM_PCT} / 100 / 1024 ))
    # Hard absolute cap; the proportional % above only reduces it on low-RAM boxes.
    [ "$mem_max_mb" -gt "${APP_MEM_CAP_MB:-$ARL_DEFAULT_CAP_MB}" ] && mem_max_mb="${APP_MEM_CAP_MB:-$ARL_DEFAULT_CAP_MB}"
    [ "$mem_max_mb" -lt "$ARL_MIN_MEM_MB" ] && mem_max_mb="$ARL_MIN_MEM_MB"
    mem_high_mb=$(( mem_max_mb * ${APP_HIGH_PCT:-$ARL_DEFAULT_HIGH_PCT} / 100 ))
    cpu_quota=$(( nproc * ${APP_CPU_PCT:-$ARL_DEFAULT_CPU_PCT} ))
    mem="${mem_in:-${APP_MEM_MAX:-${mem_max_mb}M}}"
    high="${high_in:-${APP_MEM_HIGH:-${mem_high_mb}M}}"
    cpu="${cpu_in:-${APP_CPU_QUOTA:-${cpu_quota}%}}"
    # Clamp MemoryHigh <= MemoryMax: a soft tier above the hard cap is inert and
    # the app hard-OOMs at MemoryMax with no graceful reclaim. Triggers when --mem
    # (or APP_MEM_MAX) lowers the max below the machine-relative high default.
    if [ "$(_arl_mib "$mem")" -gt 0 ] 2>/dev/null && [ "$(_arl_mib "$high")" -gt "$(_arl_mib "$mem")" ] 2>/dev/null; then high="$mem"; fi
    printf '%s%s%s%s%s' "$mem" "$tab" "$high" "$tab" "$cpu"
}

# ---- public API (ONE function) ---------------------------------------------
apply_app_resource_limit() {
    local id="" real="" mem="" high="" cpu="" pre="" mode="user" desktop_who="" field=""
    local sudo wrapper limits tab scope_flag wrapper_exec
    local eff_mem_pct eff_high_pct eff_cpu_pct eff_agg_mem_pct eff_agg_high_pct eff_cap_mb
    tab="$(printf '\t')"
    # Effective percentages resolved at CALL time so an inline "APP_MEM_PCT=62
    # apply_app_resource_limit ..." (or a pre-source env) actually bakes into the
    # wrapper. Previously the wrapper used the SOURCE-time default, so per-app
    # overrides passed on the call line were silently dropped.
    eff_mem_pct="${APP_MEM_PCT:-$ARL_DEFAULT_MEM_PCT}"
    eff_high_pct="${APP_HIGH_PCT:-$ARL_DEFAULT_HIGH_PCT}"
    eff_cpu_pct="${APP_CPU_PCT:-$ARL_DEFAULT_CPU_PCT}"
    eff_cap_mb="${APP_MEM_CAP_MB:-$ARL_DEFAULT_CAP_MB}"
    eff_agg_mem_pct="${APP_AGG_MEM_PCT:-$ARL_AGG_MEM_PCT}"
    eff_agg_high_pct="${APP_AGG_HIGH_PCT:-$ARL_AGG_HIGH_PCT}"
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
# MemoryMax = min(absolute cap, proportional % of RAM): the % only bites on low-RAM boxes.
ARL_MM=\$(( ARL_MEM_TOTAL_KB * \${APP_MEM_PCT:-$eff_mem_pct} / 100 / 1024 ))
ARL_CAP=\${APP_MEM_CAP_MB:-$eff_cap_mb}
[ "\$ARL_MM" -gt "\$ARL_CAP" ] && ARL_MM=\$ARL_CAP
[ "\$ARL_MM" -lt "\${APP_MIN_MEM_MB:-$ARL_MIN_MEM_MB}" ] && ARL_MM=\${APP_MIN_MEM_MB:-$ARL_MIN_MEM_MB}
ARL_MH=\$(( ARL_MM * \${APP_HIGH_PCT:-$eff_high_pct} / 100 ))
# CPUQuota = 10% of the whole machine (% * nproc), so it auto-scales to any core count.
ARL_CQ=\$(( ARL_NPROC * \${APP_CPU_PCT:-$eff_cpu_pct} ))
ARL_MEM_MAX="\${ARL_FIXED_MEM:-}"; [ -n "\$ARL_MEM_MAX" ] || ARL_MEM_MAX="\${APP_MEM_MAX:-\${ARL_MM}M}"
ARL_MEM_HIGH="\${ARL_FIXED_HIGH:-}"; [ -n "\$ARL_MEM_HIGH" ] || ARL_MEM_HIGH="\${APP_MEM_HIGH:-\${ARL_MH}M}"
ARL_CPU_QUOTA="\${ARL_FIXED_CPU:-}"; [ -n "\$ARL_CPU_QUOTA" ] || ARL_CPU_QUOTA="\${APP_CPU_QUOTA:-\${ARL_CQ}%}"
# Clamp MemoryHigh <= MemoryMax (an inverted soft tier is inert -> hard OOM at max).
# Skip when MemoryMax is unbounded ("max"/"infinity" -> _arl_mib 0): clamping then
# would wrongly discard the soft tier the caller asked to keep.
_arl_mib() { case "\$1" in *[Gg]) echo \$(( \${1%[Gg]} * 1024 ));; *[Mm]) echo "\${1%[Mm]}";; *[Kk]) echo \$(( \${1%[Kk]} / 1024 ));; *[0-9]) echo \$(( \$1 / 1048576 ));; *) echo 0;; esac; }
ARL_MAX_MIB="\$(_arl_mib "\$ARL_MEM_MAX")"
if [ "\$ARL_MAX_MIB" -gt 0 ] 2>/dev/null && [ "\$(_arl_mib "\$ARL_MEM_HIGH")" -gt "\$ARL_MAX_MIB" ] 2>/dev/null; then ARL_MEM_HIGH="\$ARL_MEM_MAX"; fi
# AGGREGATE cap: every wrapper-launched app shares ONE slice so their combined
# memory cannot exhaust the box (per-app caps do NOT bound the sum -- critical on
# low-RAM / no-swap machines). NOTE: the slice lives in the CALLING manager, so
# user-session apps (--user) share one budget and root-mode apps (--system) share
# a SEPARATE one; the cap bounds same-manager apps, not across the user/root split.
# The dominant consumers (browsers, chat) are user-session and ARE bounded together.
# Slice limits are % of TOTAL RAM, recomputed here so they track the machine.
ARL_SLICE="$ARL_SLICE_NAME"
ARL_AGG_MM=\$(( ARL_MEM_TOTAL_KB * \${APP_AGG_MEM_PCT:-$eff_agg_mem_pct} / 100 / 1024 ))
ARL_AGG_MH=\$(( ARL_MEM_TOTAL_KB * \${APP_AGG_HIGH_PCT:-$eff_agg_high_pct} / 100 / 1024 ))
ARL_AGG_MAX="\${APP_AGG_MEM_MAX:-\${ARL_AGG_MM}M}"
ARL_AGG_HIGH="\${APP_AGG_MEM_HIGH:-\${ARL_AGG_MH}M}"
ARL_AGG_MAX_MIB="\$(_arl_mib "\$ARL_AGG_MAX")"
if [ "\$ARL_AGG_MAX_MIB" -gt 0 ] 2>/dev/null && [ "\$(_arl_mib "\$ARL_AGG_HIGH")" -gt "\$ARL_AGG_MAX_MIB" ] 2>/dev/null; then ARL_AGG_HIGH="\$ARL_AGG_MAX"; fi
# Capability gate: the shared slice + MemoryHigh + hierarchical per-slice memory
# enforcement are cgroup-v2 features. On a v1/hybrid hierarchy (e.g. Ubuntu 20.04
# default) they are silently ignored, so there we keep only the per-app MemoryMax
# (which v1 honors). arl_mgr_ok checks the target systemd manager is reachable.
ARL_CG2=0; [ "\$(stat -fc %T /sys/fs/cgroup 2>/dev/null)" = "cgroup2fs" ] && ARL_CG2=1
arl_mgr_ok() {
    if [ "\$ARL_SCOPE_MODE" = "system" ]; then [ -d /run/systemd/system ]; else systemctl --user show-environment >/dev/null 2>&1; fi
}
# Primary: a transient scope. We PROBE first (throwaway scope) so that if
# systemd-run cannot create a scope in this manager (no delegated/lingering user
# session, no bus, controller not delegated, --slice rejected) we fall THROUGH to
# cpulimit instead of a bare exec that would leave the app unlaunched.
if command -v systemd-run >/dev/null 2>&1 && arl_mgr_ok \\
   && systemd-run $scope_flag --scope --collect --quiet true >/dev/null 2>&1; then
    if [ "\$ARL_CG2" = "1" ]; then
        command -v systemctl >/dev/null 2>&1 && systemctl $scope_flag set-property --runtime "\$ARL_SLICE" "MemoryHigh=\$ARL_AGG_HIGH" "MemoryMax=\$ARL_AGG_MAX" >/dev/null 2>&1 || true
        exec systemd-run $scope_flag --scope --collect --quiet --slice="\$ARL_SLICE" \\
            -p "MemoryMax=\$ARL_MEM_MAX" -p "MemoryHigh=\$ARL_MEM_HIGH" -p "CPUQuota=\$ARL_CPU_QUOTA" \\
            --setenv=ARL_SCOPE_ACTIVE=1 \\
            "\$0" "\$@"
    fi
    # cgroup v1/hybrid: per-app hard MemoryMax + CPUQuota only (no slice, no High).
    exec systemd-run $scope_flag --scope --collect --quiet \\
        -p "MemoryMax=\$ARL_MEM_MAX" -p "CPUQuota=\$ARL_CPU_QUOTA" \\
        --setenv=ARL_SCOPE_ACTIVE=1 \\
        "\$0" "\$@"
fi
# Fallback: cpulimit (CPU-only, crude; NO memory cap, not in any slice).
if command -v cpulimit >/dev/null 2>&1; then
    echo "[rlimit] systemd-run scope unavailable; CPU-only cap via cpulimit (no memory limit)" >&2
    exec cpulimit -l "\${ARL_CPU_QUOTA%\%}" -- "\$ARL_REAL_BINARY" \$ARL_PRE_ARGS "\$@"
fi
# Last resort: run unlimited so the app still launches.
echo "[rlimit] no systemd-run/cpulimit usable; launching '\$ARL_REAL_BINARY' WITHOUT resource limits" >&2
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

# ---------------------------------------------------------------------------
# resolve_browser_gpu_flags: echo SAFE Chromium GPU hardware-acceleration flags for THIS
# machine (Chrome/Edge/Chromium), to be passed to apply_app_resource_limit via --pre.
# Stops the software-rendering lag where the Linux GPU blocklist forces SwiftShader
# (CPU-bound compositing). Logs to stderr; prints the space-joined flag string to stdout.
# SAFE-by-default (Chromium GPU/VA-API docs, adversarially reviewed):
#   base: --ignore-gpu-blocklist --enable-gpu-rasterization --use-gl=angle --use-angle=gl
#         --ozone-platform-hint=auto   (NO --enable-zero-copy: NVIDIA GPU-process
#         crash-loop/screen-blank; NO ANGLE-Vulkan: NVIDIA black windows).
#   VA-API decode/encode ONLY when a Mesa backend driver .so is present (AMD/Intel, out
#   of the box). NVIDIA VA-API stays OFF (Chrome unsupported there -> masks CPU decode).
# Vendor detection is sudo-safe (sysfs/lspci, no DISPLAY) and prefers the PRIMARY display
# GPU, so an offload NVIDIA never masks a working AMD/Intel VA-API stack on hybrid laptops.
# Env: BROWSER_GPU_FLAGS preset -> echoed verbatim; BROWSER_DISABLE_GPU=1 -> empty;
#      BROWSER_ENABLE_ZEROCOPY=1 -> add --enable-zero-copy.
resolve_browser_gpu_flags() {
    local vendor primary nv_bound any card v bound have_libva have_drv pat d flags line
    vendor=""; primary=""; nv_bound=""; any=""; have_libva=0; have_drv=0; pat=""; flags=""

    if [ "${BROWSER_DISABLE_GPU:-0}" = "1" ]; then printf '%s' ""; return 0; fi
    if [ -n "${BROWSER_GPU_FLAGS:-}" ]; then printf '%s' "$BROWSER_GPU_FLAGS"; return 0; fi

    # Vendor = the GPU that drives the display. Walk DRM cards; first BOUND AMD/Intel wins;
    # fall back to a bound NVIDIA only if it is the sole GPU, then nvidia-smi / lspci.
    for card in /sys/class/drm/card[0-9]*; do
        [ -r "$card/device/vendor" ] || continue   # skip connector pseudo-dirs (cardN-DP-1 ...)
        v=$(cat "$card/device/vendor" 2>/dev/null); bound=""
        [ -L "$card/device/driver" ] && bound=1
        case "$v" in
            0x10de) any="nvidia"; [ -n "$bound" ] && nv_bound="nvidia" ;;
            0x1002) any="amd";    [ -n "$bound" ] && [ -z "$primary" ] && primary="amd" ;;
            0x8086) any="intel";  [ -n "$bound" ] && [ -z "$primary" ] && primary="intel" ;;
        esac
    done
    if   [ -n "$primary" ];  then vendor="$primary"
    elif [ -n "$nv_bound" ]; then vendor="nvidia"
    elif command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi -L >/dev/null 2>&1; then vendor="nvidia"
    elif command -v lspci >/dev/null 2>&1; then
        line=$(lspci -nnk 2>/dev/null | grep -iE 'VGA|3D|Display' | head -n1)
        case "$line" in
            *1002:*|*AMD*|*ATI*) vendor="amd" ;;
            *8086:*|*Intel*)     vendor="intel" ;;
            *10de:*|*NVIDIA*)    vendor="nvidia" ;;
            *)                   vendor="${any:-unknown}" ;;
        esac
    else vendor="${any:-unknown}"; fi

    # VA-API gate: libva-drm + a vendor-matching Mesa backend driver .so (never vainfo).
    if command -v ldconfig >/dev/null 2>&1 && ldconfig -p 2>/dev/null | grep -q 'libva-drm\.so'; then
        have_libva=1
    else
        for d in /usr/lib/x86_64-linux-gnu /usr/lib/aarch64-linux-gnu /usr/lib64 /usr/lib; do
            [ -e "$d/libva-drm.so.2" ] && { have_libva=1; break; }
        done
    fi
    case "$vendor" in
        amd)   pat='radeonsi_drv_video\.so|r600_drv_video\.so' ;;
        intel) pat='iHD_drv_video\.so|i965_drv_video\.so' ;;
        *)     pat='' ;;   # nvidia / unknown -> no VA-API
    esac
    if [ -n "$pat" ]; then
        for d in /usr/lib/x86_64-linux-gnu/dri /usr/lib/dri /usr/lib64/dri /usr/lib/aarch64-linux-gnu/dri; do
            [ -d "$d" ] || continue
            if ls "$d" 2>/dev/null | grep -qE "$pat"; then have_drv=1; break; fi
        done
    fi

    flags="--ignore-gpu-blocklist --enable-gpu-rasterization --use-gl=angle --use-angle=gl --ozone-platform-hint=auto"
    [ "${BROWSER_ENABLE_ZEROCOPY:-0}" = "1" ] && flags="$flags --enable-zero-copy"
    [ "$have_libva" = "1" ] && [ "$have_drv" = "1" ] && flags="$flags --enable-features=AcceleratedVideoDecodeLinuxGL,AcceleratedVideoEncoder"
    echo "[arl] browser GPU flags (vendor=$vendor vaapi=$have_drv): $flags" >&2
    printf '%s' "$flags"
}
