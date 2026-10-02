#!/bin/bash
# Launch-time update check for the managed IDEs (VS Code / Cursor / Antigravity).
# Called by the per-IDE update shim that the menu icon executes (written by
# ide_package_common.sh::ide_install_update_shim):
#   ide_update_launcher.sh <id> <display_name> <launcher> <app_root> <kind> [kind args] -- [app args...]
# kinds (official update sources):
#   vscode-api               <updateUrl>/api/update/linux-x64/<quality>/<commit>
#                            (VS Code update service: 204 = current, 200 = JSON productVersion)
#   cursor-api               <updateUrl>/api/update/linux-x64/<applicationName>/<version>/<commit>/<quality>
#   apt-index <pkg> <url>    newest "Version:" of <pkg> in the apt Packages index
# Flow: skipped for URL callbacks (--open-url / scheme://) and when the IDE is
# already running; otherwise the check is bounded by IDE_UPDATE_CHECK_SECONDS
# (on timeout it uses the last cached result and refreshes the cache in the
# background with IDE_UPDATE_BACKGROUND_SECONDS, so slow links prompt on the
# next launch). A newer version asks "Upgrade? (default No)"; yes runs the
# idempotent installer (155_install_ides.sh --only <id> --yes, via pkexec) with
# progress, then the IDE starts (also when the upgrade is declined or fails).

IDE_UPDATE_SELF_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
IDE_UPDATE_INSTALLER="$(dirname "$IDE_UPDATE_SELF_DIR")/debian/install_shells/155_install_ides.sh"
IDE_UPDATE_CHECK_SECONDS=10
IDE_UPDATE_BACKGROUND_SECONDS=120
IDE_UPDATE_CACHE_MAX_AGE=86400
IDE_UPDATE_PROMPT_SECONDS=60
IDE_UPDATE_PLATFORM="linux-x64"
IDE_UPDATE_CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/core_node/ide_updates"
IDE_UPDATE_ID=""
IDE_UPDATE_NAME=""
IDE_UPDATE_LAUNCHER=""
IDE_UPDATE_APP_ROOT=""
IDE_UPDATE_KIND=""
IDE_UPDATE_KIND_ARGS=()
IDE_UPDATE_APP_ARGS=()
IDE_UPDATE_INSTALLED=""
IDE_UPDATE_LATEST=""

ide_update_log() {
    echo "[ide-update] $*" >&2
}

# Reads one top-level string field from a product.json.
ide_update_product_field() {
    python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2], ""))' \
        "$IDE_UPDATE_APP_ROOT/resources/app/product.json" "$1" 2>/dev/null
}

ide_update_installed_version() {
    case "$IDE_UPDATE_KIND" in
        apt-index) dpkg-query -W -f='${Version}' "${IDE_UPDATE_KIND_ARGS[0]}" 2>/dev/null ;;
        *) ide_update_product_field version ;;
    esac
}

# Prints the newest available version (empty when current or unknown).
ide_update_remote_version() {
    local update_url url body_file http_code version=""
    case "$IDE_UPDATE_KIND" in
        vscode-api|cursor-api)
            update_url="$(ide_update_product_field updateUrl)"
            [[ "$update_url" == https://* ]] || return 1
            if [[ "$IDE_UPDATE_KIND" == "vscode-api" ]]; then
                url="$update_url/api/update/$IDE_UPDATE_PLATFORM/$(ide_update_product_field quality)/$(ide_update_product_field commit)"
            else
                url="$update_url/api/update/$IDE_UPDATE_PLATFORM/$(ide_update_product_field applicationName)/$(ide_update_product_field version)/$(ide_update_product_field commit)/$(ide_update_product_field quality)"
            fi
            body_file="$(mktemp)"
            http_code="$(curl -sS -L -o "$body_file" -w '%{http_code}' --max-time "$IDE_UPDATE_CHECK_SECONDS" "$url" 2>/dev/null)"
            if [[ "$http_code" == "200" ]]; then
                version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("productVersion", ""))' "$body_file" 2>/dev/null)"
            fi
            rm -f "$body_file"
            [[ "$http_code" == "200" || "$http_code" == "204" ]] || return 1
            ;;
        apt-index)
            version="$(curl -sS -L --max-time "$IDE_UPDATE_CHECK_SECONDS" "${IDE_UPDATE_KIND_ARGS[1]}" 2>/dev/null \
                | awk -v pkg="${IDE_UPDATE_KIND_ARGS[0]}" '/^Package: /{p=($2==pkg)} p&&/^Version: /{print $2}' \
                | sort -V | tail -1)"
            [[ -n "$version" ]] || return 1
            ;;
        *) return 1 ;;
    esac
    echo "$version"
}

ide_update_cache_file() {
    echo "$IDE_UPDATE_CACHE_DIR/$IDE_UPDATE_ID.state"
}

# Cache line: "<epoch> <installed> <latest>"; written only after a completed check.
ide_update_refresh_cache() {
    local latest
    latest="$(ide_update_remote_version)" || return 1
    mkdir -p "$IDE_UPDATE_CACHE_DIR" 2>/dev/null || return 1
    echo "$(date +%s) $IDE_UPDATE_INSTALLED ${latest:--}" > "$(ide_update_cache_file)"
    echo "$latest"
}

ide_update_cached_latest() {
    local epoch installed latest
    read -r epoch installed latest < "$(ide_update_cache_file)" 2>/dev/null || return 1
    [[ "$installed" == "$IDE_UPDATE_INSTALLED" ]] || return 1
    [[ $(( $(date +%s) - epoch )) -le $IDE_UPDATE_CACHE_MAX_AGE ]] || return 1
    [[ "$latest" == "-" ]] || echo "$latest"
}

ide_update_is_newer() {
    [[ -n "$IDE_UPDATE_LATEST" ]] && [[ -n "$IDE_UPDATE_INSTALLED" ]] || return 1
    [[ "$IDE_UPDATE_LATEST" != "$IDE_UPDATE_INSTALLED" ]] || return 1
    dpkg --compare-versions "$IDE_UPDATE_LATEST" gt "$IDE_UPDATE_INSTALLED" 2>/dev/null
}

ide_update_should_check() {
    local arg
    for arg in "${IDE_UPDATE_APP_ARGS[@]}"; do
        [[ "$arg" == "--open-url" || "$arg" == *://* ]] && return 1
    done
    [[ -d "$IDE_UPDATE_APP_ROOT" ]] || return 1
    ! pgrep -f "^$IDE_UPDATE_APP_ROOT/" >/dev/null 2>&1
}

# Yes/No with No as the default: zenity, kdialog, else a terminal prompt.
ide_update_confirm() {
    local message="$1" answer=""
    if [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
        zenity --question --default-cancel --timeout="$IDE_UPDATE_PROMPT_SECONDS" \
            --title="$IDE_UPDATE_NAME" --ok-label="Upgrade" --cancel-label="Skip" --text="$message" 2>/dev/null
        return
    fi
    if [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && command -v kdialog >/dev/null 2>&1; then
        kdialog --title "$IDE_UPDATE_NAME" --warningyesno "$message" --yes-label "Upgrade" --no-label "Skip" 2>/dev/null
        return
    fi
    [[ -t 0 ]] || return 1
    read -r -t "$IDE_UPDATE_PROMPT_SECONDS" -p "$message [y/N]: " answer || return 1
    [[ "$answer" =~ ^[yY]([eE][sS])?$ ]]
}

ide_update_notify_error() {
    local message="$1"
    ide_update_log "$message"
    if [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
        zenity --error --title="$IDE_UPDATE_NAME" --text="$message" 2>/dev/null &
    fi
}

ide_update_run_upgrade() {
    local log_file rc cmd=(bash "$IDE_UPDATE_INSTALLER" --only "$IDE_UPDATE_ID" --yes)
    mkdir -p "$IDE_UPDATE_CACHE_DIR" 2>/dev/null
    log_file="$IDE_UPDATE_CACHE_DIR/$IDE_UPDATE_ID.upgrade.log"
    if [[ "$EUID" -ne 0 ]]; then
        command -v pkexec >/dev/null 2>&1 || { ide_update_notify_error "pkexec not found; run: sudo ${cmd[*]}"; return 1; }
        cmd=(pkexec env SUDO_USER="$(id -un)" "${cmd[@]}")
    fi
    if [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
        "${cmd[@]}" 2>&1 | tee "$log_file" | zenity --progress --pulsate --auto-close --no-cancel \
            --title="$IDE_UPDATE_NAME" --text="Upgrading $IDE_UPDATE_NAME to $IDE_UPDATE_LATEST..." 2>/dev/null
        rc=${PIPESTATUS[0]}
    else
        "${cmd[@]}" 2>&1 | tee "$log_file"
        rc=${PIPESTATUS[0]}
    fi
    if [[ $rc -ne 0 ]]; then
        ide_update_notify_error "$IDE_UPDATE_NAME upgrade failed (exit $rc); log: $log_file"
        return 1
    fi
    rm -f "$(ide_update_cache_file)"
}

ide_update_parse_args() {
    IDE_UPDATE_ID="$1"
    IDE_UPDATE_NAME="$2"
    IDE_UPDATE_LAUNCHER="$3"
    IDE_UPDATE_APP_ROOT="$4"
    IDE_UPDATE_KIND="$5"
    shift 5
    while [[ $# -gt 0 ]] && [[ "$1" != "--" ]]; do
        IDE_UPDATE_KIND_ARGS+=("$1")
        shift
    done
    [[ "$1" == "--" ]] && shift
    IDE_UPDATE_APP_ARGS=("$@")
}

ide_update_main() {
    ide_update_parse_args "$@"
    if [[ -z "$IDE_UPDATE_LAUNCHER" ]]; then
        ide_update_log "usage: ide_update_launcher.sh <id> <display_name> <launcher> <app_root> <kind> [kind args] -- [app args]"
        return 1
    fi
    if ide_update_should_check; then
        IDE_UPDATE_INSTALLED="$(ide_update_installed_version)"
        if ! IDE_UPDATE_LATEST="$(ide_update_refresh_cache)"; then
            IDE_UPDATE_LATEST="$(ide_update_cached_latest)"
            ( IDE_UPDATE_CHECK_SECONDS="$IDE_UPDATE_BACKGROUND_SECONDS" ide_update_refresh_cache >/dev/null 2>&1 & )
        fi
        ide_update_log "$IDE_UPDATE_NAME: installed ${IDE_UPDATE_INSTALLED:-unknown}, latest ${IDE_UPDATE_LATEST:-current/unknown}"
        if ide_update_is_newer \
            && ide_update_confirm "$IDE_UPDATE_NAME $IDE_UPDATE_LATEST is available (installed: $IDE_UPDATE_INSTALLED). Upgrade now?"; then
            ide_update_run_upgrade
        fi
    fi
    exec "$IDE_UPDATE_LAUNCHER" "${IDE_UPDATE_APP_ARGS[@]}"
}

ide_update_main "$@"
