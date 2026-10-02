#!/bin/bash
# d3d4tester launcher (Linux): ensure prerequisites (prereqs.json), restore, build, run with hot reload.
# WPF runs only on Windows: inside WSL with Windows interop this delegates to start.ps1.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"
LINUX_COMMON_DIR="$ROOT_DIR/scripts/shells/linux/common"
PREREQS_JSON="$SCRIPT_DIR/prereqs.json"
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
PS_EXE=""
PS_SCRIPT_WIN=""
PS_ARGS=()
DOTNET_ARGS=()
SDK_VERSION=""
PREREQ_ROWS=""
PREREQ_FIELD_SEP="|"
PREREQ_LIST_SEP=","
PREREQ_JQ_QUERY='.prereqs[] | select(.linux) | [.id, (.required | tostring), .purpose, .linux.installer, ((.linux.args // []) | join(","))
    , ((.linux.env // {}) | to_entries | map("\(.key)=\(.value)") | join(",")), ((.linux.detect.dotnet_sdk_major // "") | tostring)
    , ((.linux.detect.commands // []) | join(",")), ((.linux.detect.python_imports // []) | join(","))] | join("|")'
PREREQ_JQ_MANUAL='[.manual[]? | select((.platform // "") | startswith("windows")) | .id] | join(", ")'
PREREQ_PY_QUERY='
import json, sys
d = json.load(open(sys.argv[1]))
if sys.argv[2] == "manual":
    print(", ".join(m["id"] for m in d.get("manual", []) if str(m.get("platform", "")).startswith("windows")))
    sys.exit(0)
for p in d.get("prereqs", []):
    l = p.get("linux")
    if not l:
        continue
    det = l.get("detect", {})
    print("|".join([p["id"], str(p.get("required", True)).lower(), p.get("purpose", ""), l["installer"], ",".join(l.get("args", [])),
        ",".join("%s=%s" % kv for kv in l.get("env", {}).items()), str(det.get("dotnet_sdk_major", "")),
        ",".join(det.get("commands", [])), ",".join(det.get("python_imports", []))]))
'
PREREQ_PY_PROBE='import importlib.util, sys; print("ok" if all(importlib.util.find_spec(m) for m in sys.argv[1:]) else "missing")'
P_ID=""
P_REQUIRED=""
P_PURPOSE=""
P_INSTALLER=""
P_ARGS=""
P_ENV=""
P_DOTNET=""
P_COMMANDS=""
P_IMPORTS=""
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
source "$LINUX_COMMON_DIR/venv_python_common.sh" >/dev/null 2>&1

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
    [ -f "$PREREQS_JSON" ] || fail "Prerequisite manifest not found: $PREREQS_JSON"
    if command -v jq >/dev/null 2>&1; then
        PREREQ_ROWS="$(jq -r "$PREREQ_JQ_QUERY" "$PREREQS_JSON")"
    elif command -v python3 >/dev/null 2>&1; then
        PREREQ_ROWS="$(python3 -c "$PREREQ_PY_QUERY" "$PREREQS_JSON" prereqs)"
    else
        fail "jq or python3 is required to read $PREREQS_JSON"
    fi
}

windows_manual_ids() {
    if command -v jq >/dev/null 2>&1; then
        jq -r "$PREREQ_JQ_MANUAL" "$PREREQS_JSON"
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "$PREREQ_PY_QUERY" "$PREREQS_JSON" manual
    fi
}

prereq_python() {
    local py="${VENV_PYTHON3:-}"
    [ -x "$py" ] || py="$(venv_python_from_common)"
    echo "$py"
}

prereq_present() {
    local cmd="" py="" result=""
    P_PRESENT=false
    if [ -n "$P_DOTNET" ]; then
        DOTNET_MAJOR="$P_DOTNET"
        refresh_dotnet_path
        dotnet_sdk_ready
        P_PRESENT="$DOTNET_READY"
        return 0
    fi
    if [ -n "$P_COMMANDS" ]; then
        for cmd in ${P_COMMANDS//$PREREQ_LIST_SEP/ }; do
            command -v "$cmd" >/dev/null 2>&1 && P_PRESENT=true
        done
        return 0
    fi
    if [ -n "$P_IMPORTS" ]; then
        py="$(prereq_python)"
        [ -n "$py" ] || return 0
        result="$(timeout 30 "$py" -c "$PREREQ_PY_PROBE" ${P_IMPORTS//$PREREQ_LIST_SEP/ } 2>/dev/null)"
        [ "$result" = "ok" ] && P_PRESENT=true
        return 0
    fi
    P_PRESENT=true
}

prereq_run_installer() {
    local installer="$ROOT_DIR/$P_INSTALLER" pair="" key="" i=0
    local -a keys=() args=()
    [ -f "$installer" ] || fail "Installer not found: $installer"
    P_SAVED=()
    for pair in ${P_ENV//$PREREQ_LIST_SEP/ }; do
        key="${pair%%=*}"
        keys+=("$key")
        P_SAVED+=("$(get_var "$key" "")")
        set_var "$key" "${pair#*=}" >/dev/null
    done
    [ -n "$P_ARGS" ] && args=(${P_ARGS//$PREREQ_LIST_SEP/ })
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
    while IFS="$PREREQ_FIELD_SEP" read -r P_ID P_REQUIRED P_PURPOSE P_INSTALLER P_ARGS P_ENV P_DOTNET P_COMMANDS P_IMPORTS; do
        [ -n "$P_ID" ] || continue
        prereq_present
        if [ "$P_PRESENT" = "true" ]; then
            log "Prerequisite present: $P_ID"
            continue
        fi
        if [ "$P_REQUIRED" != "true" ] && [ "$WITH_OPTIONAL" != "true" ]; then
            log "Optional prerequisite missing: $P_ID ($P_PURPOSE); rerun with --with-optional to install it"
            continue
        fi
        log "Installing prerequisite: $P_ID ($P_PURPOSE)"
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
    manual_ids="$(windows_manual_ids)"
    [ -n "$manual_ids" ] && log "Windows-side prerequisites (not applicable on Linux; start.ps1 checks them on Windows): $manual_ids"
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

log "Step 2/4: restore"
dotnet restore "$CSPROJ" -p:EnableWindowsTargeting=true --artifacts-path "$ARTIFACTS_DIR" || fail "dotnet restore failed"

log "Step 3/4: build ($CONFIGURATION)"
dotnet build "${DOTNET_ARGS[@]}" --no-restore || fail "dotnet build failed"

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
exec dotnet watch --non-interactive --project "$CSPROJ" build -c "$CONFIGURATION" -p:EnableWindowsTargeting=true --artifacts-path "$ARTIFACTS_DIR"
