#!/bin/bash
# d3d4tester launcher (Linux): ensure prerequisites (prereqs.conf), restore, build, run with hot reload.
# WPF runs only on Windows: inside WSL with Windows interop this delegates to start.ps1.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"
LINUX_COMMON_DIR="$ROOT_DIR/scripts/shells/linux/common"
PREREQS_CONF="$SCRIPT_DIR/prereqs.conf"
START_PS1="$SCRIPT_DIR/start.ps1"
CSPROJ="$APP_DIR/d3d4tester.csproj"
LOG_PREFIX="[d3d4tester]"
DOTNET_MAJOR="8"
CONFIGURATION="Debug"
BUILD_ONLY=false
NO_WATCH=false
WITH_OPTIONAL=false
DOTNET_READY=false
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
SDK_VERSION=""
PREREQ_ROWS=""
PREREQ_FIELD_SEP="|"
PREREQ_LIST_SEP=";"
P_KIND=""
P_ID=""
P_REQUIRED=""
P_PLATFORM=""
P_INSTALLER=""
P_ENV=""
P_ARGS=""
P_DETECT=""
P_PRESENT=false
P_SAVED=()

log() { echo "$LOG_PREFIX $*"; }
fail() { echo "$LOG_PREFIX ERROR: $*" >&2; exit 1; }

usage() {
    echo "Usage: start.sh [--build-only] [--no-watch] [--with-optional] [-c|--configuration Debug|Release]"
    echo "  --build-only   ensure prerequisites, restore and build; do not run"
    echo "  --no-watch     build and run once without hot reload"
    echo "  --with-optional  also install optional prerequisites (browser, YOLO training packages)"
    echo "  -c, --configuration  build configuration (default: Debug)"
}

while [ $# -gt 0 ]; do
    case "$1" in
        --build-only) BUILD_ONLY=true ;;
        --no-watch) NO_WATCH=true ;;
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

dotnet_sdk_ready() {
    DOTNET_READY=false
    SDK_VERSION=""
    command -v dotnet >/dev/null 2>&1 || return 0
    SDK_VERSION="$(dotnet --list-sdks 2>/dev/null | awk -v m="$DOTNET_MAJOR." 'index($1, m) == 1 {v=$1} END {print v}')"
    [ -n "$SDK_VERSION" ] && DOTNET_READY=true
    return 0
}

load_prereq_rows() {
    PREREQ_ROWS=""
    [ -f "$PREREQS_CONF" ] || fail "Prerequisite manifest not found: $PREREQS_CONF"
    PREREQ_ROWS="$(grep -v -e '^[[:space:]]*#' -e '^[[:space:]]*$' "$PREREQS_CONF" | tr -d '\r')"
}

prereq_present() {
    local cmd="" kind="${P_DETECT%%:*}" value="${P_DETECT#*:}"
    local -a cmds=()
    P_PRESENT=false
    case "$kind" in
        dotnet-sdk)
            DOTNET_MAJOR="$value"
            refresh_dotnet_path
            dotnet_sdk_ready
            P_PRESENT="$DOTNET_READY"
            ;;
        commands)
            IFS="$PREREQ_LIST_SEP" read -r -a cmds <<< "$value"
            for cmd in "${cmds[@]}"; do
                command -v "$cmd" >/dev/null 2>&1 && P_PRESENT=true
            done
            ;;
        *) P_PRESENT=true ;;
    esac
    return 0
}

prereq_run_installer() {
    local installer="$ROOT_DIR/$P_INSTALLER" pair="" key="" i=0
    local -a keys=() args=() pairs=()
    [ -f "$installer" ] || fail "Installer not found: $installer"
    P_SAVED=()
    IFS="$PREREQ_LIST_SEP" read -r -a pairs <<< "$P_ENV"
    for pair in "${pairs[@]}"; do
        key="${pair%%=*}"
        keys+=("$key")
        P_SAVED+=("$(get_var "$key" "")")
        set_var "$key" "${pair#*=}" >/dev/null
    done
    [ -n "$P_ARGS" ] && IFS="$PREREQ_LIST_SEP" read -r -a args <<< "$P_ARGS"
    bash "$installer" "${args[@]}"
    for key in "${keys[@]}"; do
        set_var "$key" "${P_SAVED[$i]}" >/dev/null
        i=$((i + 1))
    done
    refresh_dotnet_path
}

ensure_prereqs() {
    local manual_ids=""
    load_prereq_rows
    while IFS="$PREREQ_FIELD_SEP" read -r P_KIND P_ID P_REQUIRED P_PLATFORM P_INSTALLER P_ENV P_ARGS P_DETECT; do
        if [ "$P_KIND" = "manual" ]; then
            case "$P_REQUIRED" in windows*) manual_ids="${manual_ids:+$manual_ids, }$P_ID" ;; esac
            continue
        fi
        [ "$P_KIND" = "prereq" ] && [ "$P_PLATFORM" = "linux" ] || continue
        prereq_present
        if [ "$P_PRESENT" = "true" ]; then
            log "Prerequisite present: $P_ID"
            continue
        fi
        if [ "$P_REQUIRED" != "true" ] && [ "$WITH_OPTIONAL" != "true" ]; then
            log "Optional prerequisite missing: $P_ID; rerun with --with-optional to install it"
            continue
        fi
        log "Installing prerequisite: $P_ID"
        prereq_run_installer
        prereq_present
        if [ "$P_PRESENT" = "true" ]; then
            log "Prerequisite ready: $P_ID"
        elif [ "$P_REQUIRED" = "true" ]; then
            fail "Required prerequisite is not available after install: $P_ID"
        else
            log "WARNING: optional prerequisite is still missing after install: $P_ID"
        fi
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

resolve_artifacts_dir() {
    [ -n "${CN_CACHE_ROOT:-}" ] || fail "Cache root is not defined by the service contract"
    ARTIFACTS_DIR="$CN_CACHE_ROOT/$ARTIFACTS_SUBDIR/$ARTIFACTS_NAME"
    ensure_shared_dir 1777 "$CN_CACHE_ROOT" "$CN_CACHE_ROOT/$ARTIFACTS_SUBDIR" "$ARTIFACTS_DIR"
    [ -w "$ARTIFACTS_DIR" ] || fail "Artifacts directory is not writable: $ARTIFACTS_DIR"
}

find_windows_powershell
[ -n "$PS_EXE" ] && delegate_to_windows

log "Step 1/4: ensure prerequisites"
refresh_dotnet_path
ensure_prereqs
dotnet_sdk_ready
[ "$DOTNET_READY" = "true" ] || fail ".NET $DOTNET_MAJOR SDK is not available"
log ".NET $DOTNET_MAJOR SDK present: $SDK_VERSION"

resolve_artifacts_dir
log "Artifacts: $ARTIFACTS_DIR"
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1
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

if [ "$BUILD_ONLY" = "true" ] || [ "$NO_WATCH" = "true" ]; then
    log "Step 3/4: build ($CONFIGURATION, incremental)"
    dotnet build "${DOTNET_ARGS[@]}" --no-restore || fail "dotnet build failed"
else
    log "Step 3/4: build delegated to dotnet watch (single incremental build)"
fi

if [ "$BUILD_ONLY" = "true" ] || [ "$NO_WATCH" = "true" ]; then
    if [ "$BUILD_ONLY" = "true" ]; then
        log "Step 4/4: run skipped (build-only)"
    else
        log "Step 4/4: run skipped (WPF runs only on Windows)"
    fi
    exit 0
fi

log "Step 4/4: run with hot reload (dotnet watch)"
log "WPF runs only on Windows: on Linux this watches sources and rebuilds on change (compile check only)"
export EnableWindowsTargeting=true
export ArtifactsPath="$ARTIFACTS_DIR"
exec dotnet watch --non-interactive --project "$CSPROJ" build -c "$CONFIGURATION" -p:EnableWindowsTargeting=true --artifacts-path "$ARTIFACTS_DIR" --no-restore
