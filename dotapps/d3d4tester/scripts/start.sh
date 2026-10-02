#!/bin/bash
# d3d4tester launcher (Linux): ensure prerequisites (prereqs.conf), restore, build, run with hot reload.
# WPF runs only on Windows: inside WSL with Windows interop this delegates to start.ps1; elsewhere on Linux it runs under Wine (.NET 8 Desktop Runtime prefix) and restarts on source change.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"
LINUX_COMMON_DIR="$ROOT_DIR/scripts/shells/linux/common"
PREREQS_CONF="$SCRIPT_DIR/prereqs.conf"
START_PS1="$SCRIPT_DIR/start.ps1"
CSPROJ="$APP_DIR/d3d4tester.csproj"
LOG_PREFIX="[d3d4tester]"
CONFIGURATION="Debug"
BUILD_ONLY=false
NO_WATCH=false
WATCH_BUILD=false
WITH_OPTIONAL=false
ARTIFACTS_SUBDIR="dotnet-artifacts"
ARTIFACTS_NAME="d3d4tester"
ARTIFACTS_DIR=""
RESTORE_STAMP=""
RESTORE_STALE=true
DOTCORE_DIR=""
PS_EXE=""
PS_SCRIPT_WIN=""
PS_ARGS=()
DOTNET_ARGS=()
PREREQ_ROWS=""
PREREQ_FIELD_SEP="|"
PREREQ_LIST_SEP=";"
PREREQ_RAN=""
P_KIND=""
P_ID=""
P_REQUIRED=""
P_PLATFORM=""
P_INSTALLER=""
P_ENV=""
P_ARGS=""
P_RUN_KEY=""
P_SAVED=()
RID="win-x64"
WINE_RUN=false
WINE_EXE=""
WINE_PID=""
WINE_PREFIX=""
WINE_WATCH_REGEX='\.(cs|xaml|csproj|props|resx)$'
WINE_WATCH_EXCLUDE='/(obj|bin|\.git)/'
WINE_POLL_SECONDS=2
WINE_DEBOUNCE_SECONDS=1
WATCH_STAMP=""
RUN_RC=0

log() { echo "$LOG_PREFIX $*"; }
fail() { echo "$LOG_PREFIX ERROR: $*" >&2; exit 1; }

usage() {
    echo "Usage: start.sh [--build-only] [--no-watch] [--with-optional] [-c|--configuration Debug|Release]"
    echo "  --build-only   ensure prerequisites, restore and build; do not run"
    echo "  --no-watch     build and run once without hot reload (Linux: run once under Wine)"
    echo "  --watch        Linux only: keep watching sources and rebuild on change (compile check only, no run)"
    echo "  --with-optional  also install optional prerequisites (browser, YOLO training packages)"
    echo "  -c, --configuration  build configuration (default: Debug)"
}

while [ $# -gt 0 ]; do
    case "$1" in
        --build-only) BUILD_ONLY=true ;;
        --no-watch) NO_WATCH=true ;;
        --watch) WATCH_BUILD=true ;;
        --with-optional) WITH_OPTIONAL=true ;;
        -c|--configuration)
            shift
            CONFIGURATION="${1:-}"
            ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; fail "Unknown option: $1" ;;
    esac
    shift
done

case "$CONFIGURATION" in
    Debug|Release) ;;
    *) usage >&2; fail "Invalid configuration: $CONFIGURATION" ;;
esac

source "$LINUX_COMMON_DIR/gvar_common.sh" >/dev/null 2>&1
source "$LINUX_COMMON_DIR/wine_wpf_common.sh"
find_windows_powershell() {
    PS_EXE=""
    [ "${IS_WSL:-false}" = "true" ] || return 0
    command -v wslpath >/dev/null 2>&1 || return 0
    [ -f "$START_PS1" ] || return 0
    PS_EXE="$(command -v powershell.exe 2>/dev/null || command -v pwsh.exe 2>/dev/null || true)"
}

delegate_to_windows() {
    PS_SCRIPT_WIN="$(wslpath -w "$START_PS1")"
    PS_ARGS=(-NoProfile -ExecutionPolicy Bypass -File "$PS_SCRIPT_WIN" -Configuration "$CONFIGURATION")
    [ "$BUILD_ONLY" = "true" ] && PS_ARGS+=(-BuildOnly)
    [ "$NO_WATCH" = "true" ] && PS_ARGS+=(-NoWatch)
    [ "$WITH_OPTIONAL" = "true" ] && PS_ARGS+=(-WithOptional)
    log "WSL with Windows interop detected: delegating to start.ps1 so the WPF app runs on Windows"
    "$PS_EXE" "${PS_ARGS[@]}"
    exit $?
}

refresh_dotnet_path() {
    local dir=""
    for dir in /usr/share/dotnet "$HOME/.dotnet"; do
        [ -x "$dir/dotnet" ] && case ":$PATH:" in *":$dir:"*) ;; *) PATH="$dir:$PATH" ;; esac
    done
    export PATH
}

load_prereq_rows() {
    PREREQ_ROWS="$(grep -v -e '^[[:space:]]*#' -e '^[[:space:]]*$' "$PREREQS_CONF" | tr -d '\r')"
}

prereq_run_installer() {
    local installer="$ROOT_DIR/$P_INSTALLER" pair="" key="" i=0 rc=0
    local -a keys=() args=() pairs=()
    P_SAVED=()
    IFS="$PREREQ_LIST_SEP" read -r -a pairs <<< "$P_ENV"
    for pair in "${pairs[@]}"; do
        key="${pair%%=*}"
        keys+=("$key")
        P_SAVED+=("$(get_var "$key" "")")
        set_var "$key" "${pair#*=}" >/dev/null
    done
    [ -n "$P_ARGS" ] && IFS="$PREREQ_LIST_SEP" read -r -a args <<< "$P_ARGS"
    bash "$installer" "${args[@]}" </dev/null
    rc=$?
    for key in "${keys[@]}"; do
        set_var "$key" "${P_SAVED[$i]}" >/dev/null
        i=$((i + 1))
    done
    refresh_dotnet_path
    return "$rc"
}

ensure_prereqs() {
    local manual_ids=""
    load_prereq_rows
    while IFS="$PREREQ_FIELD_SEP" read -r P_KIND P_ID P_REQUIRED P_PLATFORM P_INSTALLER P_ENV P_ARGS; do
        if [ "$P_KIND" = "manual" ]; then
            case "$P_REQUIRED" in windows*) manual_ids="${manual_ids:+$manual_ids, }$P_ID" ;; esac
            continue
        fi
        [ "$P_KIND" = "prereq" ] && [ "$P_PLATFORM" = "linux" ] || continue
        if [ "$P_REQUIRED" != "true" ] && [ "$WITH_OPTIONAL" != "true" ]; then
            log "Optional prerequisite skipped: $P_ID; rerun with --with-optional to ensure it"
            continue
        fi
        P_RUN_KEY="$P_INSTALLER$PREREQ_FIELD_SEP$P_ENV$PREREQ_FIELD_SEP$P_ARGS"
        case "$PREREQ_RAN" in *"<$P_RUN_KEY>"*) continue ;; esac
        PREREQ_RAN="$PREREQ_RAN<$P_RUN_KEY>"
        log "Ensuring prerequisite: $P_ID"
        prereq_run_installer || log "WARNING: prerequisite installer failed for $P_ID"
    done <<< "$PREREQ_ROWS"
    [ -n "$manual_ids" ] && log "Windows-side prerequisites (not applicable on Linux; start.ps1 checks them on Windows): $manual_ids"
}

restore_is_stale() {
    RESTORE_STALE=true
    RESTORE_STAMP="$ARTIFACTS_DIR/obj/$ARTIFACTS_NAME/project.assets.json"
    DOTCORE_DIR="$ROOT_DIR/dotcore"
    [ -f "$RESTORE_STAMP" ] || return 0
    if [ -z "$(find "$APP_DIR" "$DOTCORE_DIR" -path "$ARTIFACTS_DIR" -prune -o -type f \( -name '*.csproj' -o -name 'Directory.*.props' -o -name 'nuget.config' \) -newer "$RESTORE_STAMP" -print -quit)" ]; then
        RESTORE_STALE=false
    fi
}

stop_previous_run() {
    local pids=""
    pids="$(pgrep -f -- "dotnet.*$CSPROJ" | grep -vx "$$" | tr '\n' ' ')"
    [ -n "${pids// /}" ] || return 0
    log "Stopping previous d3d4tester run (pid $pids) so builds do not share obj/pdb files"
    kill $pids 2>/dev/null
    wait_for_pids_exit $pids
}

wait_for_pids_exit() {
    local pid=""
    for pid in "$@"; do
        while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
    done
}

resolve_artifacts_dir() {
    [ -n "${CN_CACHE_ROOT:-}" ] || fail "Cache root is not defined by the service contract"
    ARTIFACTS_DIR="$CN_CACHE_ROOT/$ARTIFACTS_SUBDIR/$ARTIFACTS_NAME"
    ensure_shared_dir 1777 "$CN_CACHE_ROOT" "$CN_CACHE_ROOT/$ARTIFACTS_SUBDIR" "$ARTIFACTS_DIR"
    [ -w "$ARTIFACTS_DIR" ] || fail "Artifacts directory is not writable: $ARTIFACTS_DIR"
}

wine_wpf_missing_reason() {
    wine_wpf_runtime_present "$WINE_PREFIX" || { echo "Wine WPF runtime missing in $WINE_PREFIX"; return 0; }
    echo "no DISPLAY or WAYLAND_DISPLAY"
}

display_available() {
    [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]
}

wine_env_run() {
    WINEPREFIX="$WINE_PREFIX" WINEDEBUG="${WINEDEBUG:--all}" WINEDLLOVERRIDES="$WINE_WPF_DLL_OVERRIDES_RUN" "$@"
}

wine_build() {
    dotnet build "$CSPROJ" -c "$CONFIGURATION" -r "$RID" --self-contained false -p:EnableWindowsTargeting=true --artifacts-path "$ARTIFACTS_DIR"
}

wine_launch() {
    wine_env_run wine "$WINE_EXE" &
    WINE_PID=$!
    log "Launched under Wine (pid $WINE_PID)"
}

wine_stop() {
    [ -n "$WINE_PID" ] || return 0
    wine_env_run wineserver -k >/dev/null 2>&1
    wait "$WINE_PID" 2>/dev/null
    WINE_PID=""
}

wine_on_signal() {
    wine_stop
    exit 0
}

source_changed_since_stamp() {
    [ -n "$(find "$APP_DIR" "$DOTCORE_DIR" -type f \( -name '*.cs' -o -name '*.xaml' -o -name '*.csproj' -o -name '*.props' -o -name '*.resx' \) -not -path '*/obj/*' -not -path '*/bin/*' -newer "$WATCH_STAMP" -print -quit 2>/dev/null)" ]
}

wait_for_source_change() {
    local rc=1
    if command -v inotifywait >/dev/null 2>&1; then
        inotifywait -r -q -e close_write,create,delete,moved_to --include "$WINE_WATCH_REGEX" --exclude "$WINE_WATCH_EXCLUDE" "$APP_DIR" "$DOTCORE_DIR" >/dev/null 2>&1
        rc=$?
        if [ "$rc" -eq 0 ]; then
            while inotifywait -r -q -t "$WINE_DEBOUNCE_SECONDS" -e close_write,create,delete,moved_to --include "$WINE_WATCH_REGEX" --exclude "$WINE_WATCH_EXCLUDE" "$APP_DIR" "$DOTCORE_DIR" >/dev/null 2>&1; do :; done
            return 0
        fi
    fi
    until source_changed_since_stamp; do sleep "$WINE_POLL_SECONDS"; done
}

wine_run_loop() {
    log "Linux: WPF runs under Wine (restart on change; in-process hot reload is Windows-only)"
    wine_launch
    trap wine_on_signal INT TERM
    DOTCORE_DIR="$ROOT_DIR/dotcore"
    WATCH_STAMP="$ARTIFACTS_DIR/.d3d4tester_watch_stamp"
    touch "$WATCH_STAMP"
    log "Watching sources for changes. Press Ctrl+C to stop"
    while true; do
        wait_for_source_change
        touch "$WATCH_STAMP"
        log "Change detected: rebuilding"
        if wine_build; then
            wine_stop
            wine_launch
        else
            log "Build failed; keeping the running instance"
        fi
    done
}

find_windows_powershell
[ -n "$PS_EXE" ] && delegate_to_windows

log "Step 1/4: ensure prerequisites"
refresh_dotnet_path
ensure_prereqs

resolve_artifacts_dir
log "Artifacts: $ARTIFACTS_DIR"
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1
export MSBUILDDISABLENODEREUSE=1
export DOTNET_WATCH_RESTART_ON_RUDE_EDIT=true
stop_previous_run
export DOTNET_WATCH_SUPPRESS_EMOJIS=1
DOTNET_ARGS=("$CSPROJ" -c "$CONFIGURATION" -p:EnableWindowsTargeting=true --artifacts-path "$ARTIFACTS_DIR")

restore_is_stale
if [ "$RESTORE_STALE" = "true" ]; then
    log "Step 2/4: restore"
    dotnet restore "$CSPROJ" -p:EnableWindowsTargeting=true --artifacts-path "$ARTIFACTS_DIR" || fail "dotnet restore failed"
    touch "$RESTORE_STAMP"
else
    log "Step 2/4: restore skipped (up-to-date)"
fi

if [ "$BUILD_ONLY" != "true" ] && [ "$WATCH_BUILD" != "true" ]; then
    WINE_PREFIX="$(wine_wpf_prefix_dir)"
    if wine_wpf_runtime_present "$WINE_PREFIX" && display_available; then
        WINE_RUN=true
    fi
fi

if [ "$WINE_RUN" = "true" ]; then
    WINE_EXE="$ARTIFACTS_DIR/bin/$ARTIFACTS_NAME/${CONFIGURATION,,}_$RID/$ARTIFACTS_NAME.exe"
    log "Step 3/4: build ($CONFIGURATION, $RID, framework-dependent, incremental)"
    wine_build || fail "dotnet build failed"
    [ -f "$WINE_EXE" ] || fail "Built executable not found: $WINE_EXE"
    log "Step 4/4: run under Wine (prefix $WINE_PREFIX)"
    if [ "$NO_WATCH" = "true" ]; then
        log "Linux: WPF runs under Wine (single run, no restart on change)"
        wine_env_run wine "$WINE_EXE"
        RUN_RC=$?
        wine_env_run wineserver -k >/dev/null 2>&1
        exit "$RUN_RC"
    fi
    wine_run_loop
fi

if [ "$WATCH_BUILD" != "true" ]; then
    log "Step 3/4: build ($CONFIGURATION, incremental)"
    dotnet build "${DOTNET_ARGS[@]}" --no-restore || fail "dotnet build failed"
    if [ "$BUILD_ONLY" = "true" ]; then
        log "Step 4/4: run skipped (build-only)"
    else
        log "Step 4/4: run skipped: WPF needs Windows or the Wine WPF runtime ($(wine_wpf_missing_reason))"
        log "To enable the Wine run: start.sh --with-optional (installs Wine + .NET Desktop Runtime via scripts/shells/linux/debian/install_shells/57_install_dotnet.sh), then start.sh from a desktop session"
        log "Or on Windows run dotapps\\d3d4tester\\scripts\\start.ps1, or run this script inside WSL (it delegates to start.ps1)"
        log "To keep rebuilding on change here: start.sh --watch"
    fi
    exit 0
fi

log "Step 3/4: build delegated to dotnet watch (single incremental build)"
log "Step 4/4: watch-build (Linux compile check only, no run). Press Ctrl+C to stop"
export EnableWindowsTargeting=true
export ArtifactsPath="$ARTIFACTS_DIR"
exec dotnet watch --non-interactive --project "$CSPROJ" build -c "$CONFIGURATION" -p:EnableWindowsTargeting=true --artifacts-path "$ARTIFACTS_DIR" --no-restore
