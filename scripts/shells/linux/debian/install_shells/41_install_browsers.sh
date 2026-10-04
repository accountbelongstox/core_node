#!/bin/bash
# Usage: 41_install_browsers.sh [--only chrome|edge[,...]]
# Default handles every browser; each one follows its own INSTALL_<BROWSER> flag
# (false => remove). Every step is idempotent and safe to re-run.

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="41"

source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_shortcut_manager.sh"
source "$PARENT_DIR_LEVEL_2/common/app_resource_limit.sh"
source "$PARENT_DIR_LEVEL_2/common/memory_governance.sh"

BROWSER_ALL="chrome edge"
BROWSER_SELECTED=""
BROWSER_FAILED=""
BROWSER_ANY_ENABLED=false
INSTALL_MODE=$(get_var "INSTALL_MODE")
SYS_ARCH=""
# Browser cgroup recipe: the browser is the PRIMARY app, not a 1G-capped helper.
# MemoryMax=min(62% RAM, 16G); MemoryHigh=73% of Max (~45% RAM reclaim runway,
# graceful only with zram -- the wrapper collapses High onto Max when swap=0);
# CPUQuota=nproc*100% (inert; contention is handled by the slice CPUWeight).
BROWSER_MEM_PCT="62"
BROWSER_MEM_CAP_MB="16384"
BROWSER_HIGH_PCT="73"
BROWSER_CPU_PCT="100"
BROWSER_GPU_FLAGS=""
BROWSER_DEB_PATH=""

INSTALL_CHROME=$(get_var "INSTALL_CHROME")
CHROME_INSTALL_METHOD=$(get_var "CHROME_INSTALL_METHOD" "apt")
CHROME_DOWNLOAD_URL="https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
CHROME_MANUAL_URL="https://www.google.com/chrome/"
CHROME_DEB_GLOB="google-chrome-stable*.deb"
CHROME_DEB_NAME="google-chrome-stable_current_amd64.deb"
CHROME_REPO_LIST="/etc/apt/sources.list.d/google-chrome.list"
CHROME_REPO_KEY="/etc/apt/trusted.gpg.d/google-chrome.gpg"
CHROME_SYMLINK="/usr/local/bin/google-chrome"
CHROME_INSTALL_DIR=""
CHROME_BIN_PATH=""
CHROME_VERSION=""
CHROME_DESKTOP_FILE=""
CHROME_SHORTCUT_CREATED=false
# Memory Saver managed policy (tab discarding under pressure; policy JSON is the
# stable mechanism). Side effect: chrome://settings shows "Managed by your organization".
CHROME_POLICY_FILE="/etc/opt/chrome/policies/managed/corenode_memory.json"
CHROME_POLICY_JSON='{
  "HighEfficiencyModeEnabled": true,
  "MemorySaverModeSavings": 2
}'

INSTALL_EDGE=$(get_var "INSTALL_EDGE")
EDGE_DOWNLOAD_URL="https://go.microsoft.com/fwlink?linkid=2149051&brand=M102"
EDGE_MANUAL_URL="https://www.microsoft.com/edge"
EDGE_DEB_GLOB="microsoft-edge-stable*.deb"
EDGE_DEB_NAME="microsoft-edge-stable.deb"
EDGE_SYMLINK="/usr/local/bin/microsoft-edge"
EDGE_BIN_PATH=""
EDGE_VERSION=""
# Sleeping Tabs managed policy: documented by Microsoft for Windows/macOS only,
# best-effort on Linux (harmless if inert).
EDGE_POLICY_FILE="/etc/opt/edge/policies/managed/corenode_memory.json"
EDGE_POLICY_JSON='{
  "SleepingTabsEnabled": true,
  "SleepingTabsTimeout": 900
}'

# Run all apt/dpkg steps unattended so a headless re-run never blocks on a prompt.
export DEBIAN_FRONTEND=noninteractive

browser_log() {
    echo "[$SCRIPT_INDEX] $*"
}

browser_parse_args() {
    local item
    while [ $# -gt 0 ]; do
        case "$1" in
            --only)
                for item in ${2//,/ }; do
                    case " $BROWSER_ALL " in
                        *" $item "*) BROWSER_SELECTED="$BROWSER_SELECTED $item" ;;
                        *) browser_log "Unknown browser '$item' (expected: $BROWSER_ALL)"; exit 1 ;;
                    esac
                done
                shift 2
                ;;
            *) shift ;;
        esac
    done
    [ -n "$BROWSER_SELECTED" ] || BROWSER_SELECTED="$BROWSER_ALL"
}

browser_is_selected() {
    case " $BROWSER_SELECTED " in *" $1 "*) return 0 ;; esac
    return 1
}

# Google Chrome and Microsoft Edge publish Linux .deb packages for amd64 only.
browser_arch_supported() {
    [ -n "$SYS_ARCH" ] || SYS_ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
    [ "$SYS_ARCH" = "amd64" ] || [ "$SYS_ARCH" = "x86_64" ]
}

# Terminate a runaway process tree (more than 3 processes). Matches the process
# NAME only (pgrep without -f) and excludes this script's own tree, so a command
# line that merely contains the browser name is never killed.
browser_kill_processes() {
    local label="$1" pattern="$2"
    local pid kill_pids="" count
    for pid in $(pgrep "$pattern" 2>/dev/null || true); do
        [ "$pid" = "$$" ] || [ "$pid" = "$PPID" ] || kill_pids="$kill_pids $pid"
    done
    count=$(echo $kill_pids | wc -w | tr -d ' ')
    if [ "$count" -gt 3 ]; then
        browser_log "Found $count $label process(es), cleaning up..."
        $USE_SUDO kill $kill_pids 2>/dev/null || true
    elif [ "$count" -gt 0 ]; then
        browser_log "Found $count $label process(es), normal range"
    fi
}

browser_write_policy() {
    local file="$1" desired="$2" label="$3"
    $USE_SUDO mkdir -p "$(dirname "$file")" 2>/dev/null || true
    if [ "$(cat "$file" 2>/dev/null)" != "$desired" ]; then
        printf '%s' "$desired" | $USE_SUDO tee "$file" >/dev/null
        browser_log "Wrote $label policy: $file (browser will show 'Managed by your organization')"
    else
        browser_log "$label policy already set: $file"
    fi
}

# Create or repair a /usr/local/bin symlink; also replaces dangling links and
# never links a path onto itself.
browser_ensure_symlink() {
    local link="$1" target="$2" current=""
    [ -n "$target" ] && [ -f "$target" ] && [ "$target" != "$link" ] || return 0
    [ -L "$link" ] && current="$(readlink "$link" 2>/dev/null)"
    if [ "$current" = "$target" ]; then
        browser_log "System symlink already correct: $link"
    else
        $USE_SUDO ln -sfn "$target" "$link"
        browser_log "System symlink set: $link -> $target (was: ${current:-absent})"
    fi
}

# Cap the whole browser process tree in one cgroup-v2 user scope and repoint the
# menu/desktop entry at the wrapper, with GPU flags baked in via --pre. Env-pct
# overrides stay machine-relative; never use --mem/--high/--cpu here.
browser_apply_limits() {
    local id="$1" exec_path="$2"
    [ -n "$BROWSER_GPU_FLAGS" ] || BROWSER_GPU_FLAGS="$(resolve_browser_gpu_flags)"
    APP_MEM_PCT="$BROWSER_MEM_PCT" APP_MEM_CAP_MB="$BROWSER_MEM_CAP_MB" \
    APP_HIGH_PCT="$BROWSER_HIGH_PCT" APP_CPU_PCT="$BROWSER_CPU_PCT" \
    apply_app_resource_limit \
        --id "$id" --exec "$exec_path" \
        --pre "$BROWSER_GPU_FLAGS" \
        --desktop all --field "%U"
}

browser_downloads_dir() {
    [ -n "$ACTUAL_DESKTOP_USER_HOME" ] || detect_actual_desktop_user
    if [ -n "$ACTUAL_DESKTOP_USER_HOME" ] && [ -d "$ACTUAL_DESKTOP_USER_HOME" ] \
        && mkdir -p "$ACTUAL_DESKTOP_USER_HOME/Downloads" 2>/dev/null; then
        echo "$ACTUAL_DESKTOP_USER_HOME/Downloads"
    else
        echo "/tmp"
    fi
}

# Download a .deb into BROWSER_DEB_PATH; an empty or failed download is discarded.
browser_download_deb() {
    local url="$1" target="$2"
    BROWSER_DEB_PATH=""
    browser_log "Downloading $url -> $target"
    if wget --show-progress --progress=bar:force -O "$target" "$url" && [ -s "$target" ]; then
        BROWSER_DEB_PATH="$target"
        return 0
    fi
    rm -f "$target"
    browser_log "Automatic download failed"
    return 1
}

# Resolve a .deb into BROWSER_DEB_PATH: newest in Downloads, else download it into
# Downloads (kept for future installs), else wait for a manual download.
browser_obtain_deb() {
    local glob="$1" url="$2" name="$3" manual_url="$4"
    BROWSER_DEB_PATH="$(find_file_in_downloads_from_common_functions "$glob" "newest")"
    if [ -n "$BROWSER_DEB_PATH" ]; then
        browser_log "Found package: $BROWSER_DEB_PATH"
        return 0
    fi
    browser_download_deb "$url" "$(browser_downloads_dir)/$name" && return 0
    browser_log "Please download manually from: $manual_url"
    BROWSER_DEB_PATH="$(prompt_and_wait_for_download_from_common_functions "$manual_url" "$glob" 0)"
    [ -n "$BROWSER_DEB_PATH" ]
}

browser_install_deb() {
    local deb="$1" log_file="$2"
    browser_log "Installing package: $deb"
    $USE_SUDO dpkg -i "$deb" >"$log_file" 2>&1 && return 0
    browser_log "dpkg reported issues, fixing dependencies..."
    $USE_SUDO apt-get install -f -y || cat "$log_file" 2>/dev/null
}

# Memory governance prerequisites shared by every browser: zram so the caps
# reclaim gracefully, systemd-oomd as the PSI backstop.
browser_ensure_memory_governance() {
    if ! ensure_zram_swap; then
        browser_log "[WARN] NO ACTIVE SWAP: memory caps without swap cause reclaim thrash (browser freezes at the cap);"
        browser_log "[WARN] the launch wrapper falls back to hard-OOM-only mode until swap/zram is enabled."
    fi
    ensure_systemd_oomd
}

# ----------------------------------------------------------------------------
# Google Chrome (real Chrome only; Chromium is never accepted nor used as fallback)
# ----------------------------------------------------------------------------

chrome_detect() {
    local chrome_path
    for chrome_path in \
        "/usr/bin/google-chrome" \
        "/usr/bin/google-chrome-stable" \
        "/opt/google/chrome/chrome" \
        "/var/lib/flatpak/exports/bin/com.google.Chrome" \
        "$CHROME_INSTALL_DIR/chrome"; do
        if [ -f "$chrome_path" ] && [ -x "$chrome_path" ]; then
            CHROME_BIN_PATH="$chrome_path"
            CHROME_VERSION=$("$chrome_path" --version 2>/dev/null || echo "unknown")
            browser_log "Google Chrome found at: $chrome_path (version: $CHROME_VERSION)"
            return 0
        fi
    done
    return 1
}

chrome_remove_repo_files() {
    local file
    for file in "$CHROME_REPO_LIST" "$CHROME_REPO_KEY"; do
        if [ -f "$file" ]; then
            browser_log "Removing Chrome repository file (direct .deb is used): $file"
            $USE_SUDO rm -f "$file"
        fi
    done
}

# Chromium must not coexist with Google Chrome; acts only when Chromium is present.
chrome_remove_chromium() {
    if ! command -v chromium >/dev/null 2>&1 \
        && ! command -v chromium-browser >/dev/null 2>&1 \
        && ! { command -v snap >/dev/null 2>&1 && snap list chromium >/dev/null 2>&1; } \
        && ! { command -v flatpak >/dev/null 2>&1 && flatpak info org.chromium.Chromium >/dev/null 2>&1; }; then
        browser_log "Chromium not present, nothing to remove"
        return 0
    fi
    browser_log "Removing Chromium (Google Chrome must not coexist with it)..."
    $USE_SUDO apt-get purge -y chromium chromium-browser chromium-common chromium-sandbox chromium-driver 2>/dev/null || true
    $USE_SUDO apt-get autoremove -y 2>/dev/null || true
    command -v snap >/dev/null 2>&1 && { $USE_SUDO snap remove chromium 2>/dev/null || true; }
    command -v flatpak >/dev/null 2>&1 && { $USE_SUDO flatpak uninstall -y org.chromium.Chromium 2>/dev/null || true; }
    browser_log "Chromium removal completed"
}

chrome_install_apt() {
    browser_obtain_deb "$CHROME_DEB_GLOB" "$CHROME_DOWNLOAD_URL" "$CHROME_DEB_NAME" "$CHROME_MANUAL_URL" || return 1
    browser_install_deb "$BROWSER_DEB_PATH" "/tmp/chrome_install.log"
    chrome_detect
}

chrome_install_direct() {
    browser_download_deb "$CHROME_DOWNLOAD_URL" "/tmp/$CHROME_DEB_NAME" || return 1
    browser_install_deb "$BROWSER_DEB_PATH" "/tmp/chrome_install.log"
    rm -f "$BROWSER_DEB_PATH"
    chrome_detect
}

chrome_install_flatpak() {
    if ! command -v flatpak >/dev/null 2>&1; then
        $USE_SUDO apt-get update
        $USE_SUDO apt-get install -y flatpak || return 1
    fi
    $USE_SUDO flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
    $USE_SUDO flatpak install -y flathub com.google.Chrome
    chrome_detect
}

chrome_install() {
    browser_log "Google Chrome not found, installing (method: $CHROME_INSTALL_METHOD)..."
    case "$CHROME_INSTALL_METHOD" in
        apt) chrome_install_apt ;;
        direct) chrome_install_direct ;;
        flatpak) chrome_install_flatpak ;;
        *) chrome_install_apt || chrome_install_direct || chrome_install_flatpak ;;
    esac
}

chrome_ensure_shortcut() {
    if [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
        browser_log "No desktop environment detected, skipping Chrome shortcut"
        return 0
    fi
    CHROME_DESKTOP_FILE="/usr/share/applications/google-chrome.desktop"
    create_desktop_shortcut_from_desktop_shortcut_manager \
        --id google-chrome \
        --name "Google Chrome" \
        --exec "$CHROME_BIN_PATH %U" \
        --icon google-chrome \
        --comment "Access the Internet" \
        --categories "Network;WebBrowser;" \
        --startup-wmclass "Google-chrome" \
        --mimetype "text/html;text/xml;application/xhtml+xml;application/vnd.mozilla.xul+xml;text/mml;x-scheme-handler/http;x-scheme-handler/https;x-scheme-handler/ftp;x-scheme-handler/chrome;application/x-extension-htm;application/x-extension-html;application/x-extension-shtml;application/xml;text/plain;" \
        --extra "StartupNotify=true" \
        --desktop all
    CHROME_SHORTCUT_CREATED=true
    browser_apply_limits google-chrome "$CHROME_BIN_PATH"
}

chrome_store_info() {
    set_var "CHROME_BIN" "$CHROME_BIN_PATH"
    set_var "CHROME_VERSION" "$CHROME_VERSION"
    set_var "CHROME_INSTALL_DIR" "$CHROME_INSTALL_DIR"
    set_var "CHROME_DESKTOP_FILE" "$CHROME_DESKTOP_FILE"
    set_var "CHROME_SHORTCUT_CREATED" "$CHROME_SHORTCUT_CREATED"
}

chrome_remove() {
    browser_log "INSTALL_CHROME is false - removing Google Chrome if present"
    if chrome_detect; then
        $USE_SUDO apt-get purge -y google-chrome-stable 2>/dev/null || true
        $USE_SUDO flatpak uninstall -y com.google.Chrome 2>/dev/null || true
    fi
    chrome_remove_chromium
    $USE_SUDO rm -f "$CHROME_SYMLINK" "$CHROME_POLICY_FILE" "$ARL_BIN_DIR/google-chrome-rlimit" 2>/dev/null || true
    remove_desktop_shortcut_from_desktop_shortcut_manager --id google-chrome --menu --desktop all
    CHROME_BIN_PATH=""
    CHROME_VERSION=""
    CHROME_INSTALL_DIR=""
    CHROME_DESKTOP_FILE=""
    CHROME_SHORTCUT_CREATED=false
    chrome_store_info
}

chrome_ensure() {
    chrome_remove_repo_files
    if [ "$INSTALL_CHROME" = "false" ]; then
        chrome_remove
        return 0
    fi
    if ! browser_arch_supported; then
        browser_log "Google Chrome is unavailable for architecture '$SYS_ARCH'; skipping (Chromium is not used as a substitute)."
        return 0
    fi
    CHROME_INSTALL_DIR=$(map_web_path "compile_dir" "applications/chrome")
    browser_write_policy "$CHROME_POLICY_FILE" "$CHROME_POLICY_JSON" "Chrome Memory Saver"
    if ! chrome_detect; then
        browser_kill_processes "Chrome" "chrome|chromium"
        if ! chrome_install; then
            browser_log "Error: failed to install Google Chrome"
            return 1
        fi
    fi
    browser_ensure_symlink "$CHROME_SYMLINK" "$CHROME_BIN_PATH"
    chrome_ensure_shortcut
    chrome_store_info
    chrome_remove_chromium
    browser_log "Google Chrome ready: $CHROME_BIN_PATH ($CHROME_VERSION)"
}

# ----------------------------------------------------------------------------
# Microsoft Edge
# ----------------------------------------------------------------------------

edge_detect() {
    command -v microsoft-edge >/dev/null 2>&1 || return 1
    EDGE_BIN_PATH="$(command -v microsoft-edge)"
    [ "$EDGE_BIN_PATH" = "$EDGE_SYMLINK" ] && EDGE_BIN_PATH="$(readlink -f "$EDGE_SYMLINK")"
    EDGE_VERSION="$(microsoft-edge --version 2>/dev/null || echo unknown)"
    browser_log "Microsoft Edge found at: $EDGE_BIN_PATH (version: $EDGE_VERSION)"
}

edge_install() {
    browser_log "Microsoft Edge not found, installing..."
    browser_obtain_deb "$EDGE_DEB_GLOB" "$EDGE_DOWNLOAD_URL" "$EDGE_DEB_NAME" "$EDGE_MANUAL_URL" || return 1
    browser_install_deb "$BROWSER_DEB_PATH" "/tmp/edge_install.log"
    edge_detect
}

edge_store_info() {
    set_var "EDGE_BIN" "$EDGE_BIN_PATH"
    set_var "EDGE_VERSION" "$EDGE_VERSION"
}

edge_remove() {
    browser_log "INSTALL_EDGE is false - removing Microsoft Edge if present"
    if edge_detect; then
        $USE_SUDO apt-get purge -y microsoft-edge-stable 2>/dev/null || true
    fi
    $USE_SUDO rm -f "$EDGE_SYMLINK" "$EDGE_POLICY_FILE" "$ARL_BIN_DIR/microsoft-edge-rlimit" 2>/dev/null || true
    remove_desktop_shortcut_from_desktop_shortcut_manager --id microsoft-edge --desktop all
    EDGE_BIN_PATH=""
    EDGE_VERSION=""
    edge_store_info
}

edge_ensure() {
    if [ "$INSTALL_EDGE" = "false" ]; then
        edge_remove
        return 0
    fi
    if ! browser_arch_supported; then
        browser_log "Microsoft Edge is unavailable for architecture '$SYS_ARCH'; skipping."
        return 0
    fi
    browser_write_policy "$EDGE_POLICY_FILE" "$EDGE_POLICY_JSON" "Edge Sleeping Tabs"
    # Edge ships NO AppArmor profile (unlike Chrome): kernels that restrict
    # unprivileged user namespaces break its sandbox.
    if [ "$(sysctl -n kernel.apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ]; then
        browser_log "[WARN] Kernel restricts unprivileged user namespaces and Edge ships no AppArmor profile;"
        browser_log "[WARN] Edge may crash at startup. Provide an AppArmor profile for /opt/microsoft/msedge/msedge or launch with --no-sandbox."
    fi
    if ! edge_detect; then
        browser_kill_processes "Edge" "msedge|microsoft-edge"
        if ! edge_install; then
            browser_log "Error: failed to install Microsoft Edge"
            return 1
        fi
    fi
    browser_ensure_symlink "$EDGE_SYMLINK" "$EDGE_BIN_PATH"
    browser_apply_limits microsoft-edge "$EDGE_BIN_PATH"
    edge_store_info
    browser_log "Microsoft Edge ready: $EDGE_BIN_PATH ($EDGE_VERSION)"
}

# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

browser_parse_args "$@"
browser_log "Browser Installation Script (browsers: $BROWSER_SELECTED; INSTALL_MODE: $INSTALL_MODE)"
browser_log "INSTALL_CHROME: $INSTALL_CHROME, CHROME_INSTALL_METHOD: $CHROME_INSTALL_METHOD, INSTALL_EDGE: $INSTALL_EDGE"

browser_is_selected chrome && [ "$INSTALL_CHROME" != "false" ] && BROWSER_ANY_ENABLED=true
browser_is_selected edge && [ "$INSTALL_EDGE" != "false" ] && BROWSER_ANY_ENABLED=true
if [ "$BROWSER_ANY_ENABLED" = true ] && browser_arch_supported; then
    browser_ensure_memory_governance
fi

browser_is_selected chrome && { chrome_ensure || BROWSER_FAILED="$BROWSER_FAILED chrome"; }
browser_is_selected edge && { edge_ensure || BROWSER_FAILED="$BROWSER_FAILED edge"; }

# Default browser: Chrome (Windows counterpart: Step22_SetChromeDefaultBrowser).
# xdg-settings is idempotent and silent; skipped on headless systems without xdg.
browser_set_chrome_default() {
    command -v xdg-settings >/dev/null 2>&1 || { browser_log "xdg-settings not available; skipping default-browser setup."; return 0; }
    local desktop_file="google-chrome.desktop" current=""
    current="$(xdg-settings get default-web-browser 2>/dev/null || true)"
    if [ "$current" = "$desktop_file" ]; then
        browser_log "Chrome is already the default browser (idempotent skip)."
        return 0
    fi
    if xdg-settings set default-web-browser "$desktop_file" 2>/dev/null; then
        browser_log "Chrome set as the default browser."
    else
        browser_log "Warning: could not set Chrome as the default browser (no desktop session?)."
    fi
    return 0
}
browser_is_selected chrome && [ "$INSTALL_CHROME" != "false" ] && browser_set_chrome_default

browser_log "==============================="
browser_log "Swap (required for usable memory caps): $(swapon --show=NAME,SIZE --noheadings 2>/dev/null | tr '\n' ' ')"
if grep -q '^ID=kali' /etc/os-release 2>/dev/null; then
    browser_log "Note: Kali is outside Google's/Microsoft's documented targets; browsers run as on Debian."
fi
browser_log "CHROME_BIN: $(get_var "CHROME_BIN" 2>/dev/null), CHROME_VERSION: $(get_var "CHROME_VERSION" 2>/dev/null)"
browser_log "EDGE_BIN: $(get_var "EDGE_BIN" 2>/dev/null), EDGE_VERSION: $(get_var "EDGE_VERSION" 2>/dev/null)"
browser_log "==============================="

if [ -n "$BROWSER_FAILED" ]; then
    browser_log "Error: failed browser(s):$BROWSER_FAILED"
    exit 1
fi
