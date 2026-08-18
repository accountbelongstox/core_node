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

#==============================================================================
# WeChat for Linux Installation Script
#==============================================================================
# Installs the OFFICIAL Tencent "WeChat for Linux" client from
# https://linux.weixin.qq.com/ via the official .deb package.
#
# Why .deb (not AppImage):
#   The official .deb declares a single dependency
#   (fonts-noto-cjk | google-noto-cjk-fonts) and BUNDLES its Electron/Chromium
#   runtime under /opt/wechat, so `apt install ./file.deb` resolves cleanly on
#   Debian, Ubuntu AND Kali. It needs NO libfuse2 (which Kali/Debian 13 renamed
#   libfuse2t64) and has NO t64 transition concern for the package itself, unlike
#   the AppImage path. The package registers /usr/bin/wechat and its own desktop
#   entry via postinst.
#
# Supported: Debian, Ubuntu, Kali (any Debian-family) on x86_64/arm64/LoongArch.
#   - Desktop systems only (skips on headless servers).
#   - Uses an existing .deb from Downloads, else auto-downloads, else prompts.
#   - Idempotent / re-runnable: prompts to update or keep an existing install.
#   - Pulls WeChat's UNDECLARED runtime libraries (best-effort, t64-aware) so it
#     also launches on lean/minimal desktops, and applies the --no-sandbox
#     workaround when the kernel restricts unprivileged user namespaces.
#==============================================================================

# Script identification and path setup
SCRIPT_INDEX="128"
SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"

# Source common libraries (common_functions transitively sources gvar_common)
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/get_real_user.sh"

# Initialize global variables (no-op compatibility shim)
init_global_vars

# Ensure sudo (works both as root and as a normal user)
if command -v sudo >/dev/null 2>&1; then
    USE_SUDO="sudo"
else
    USE_SUDO=""
fi

# Declare variables --------------------------------------------------------
APP_NAME="WeChat"
PKG_NAME="wechat"                 # dpkg package name (from .deb control)
EXEC_NAME="wechat"                # binary symlinked to /usr/bin by the .deb
DESKTOP_FILE="/usr/share/applications/wechat.desktop"   # entry shipped by the .deb
OFFICIAL_PAGE="https://linux.weixin.qq.com/"
DOWNLOAD_BASE="https://dldir1v6.qq.com/weixin/Universal/Linux"
DEB_GLOB="WeChatLinux_*.deb"      # Downloads-dir search glob (case-insensitive)
MIN_DEB_SIZE=50000000            # 50MB sanity floor (real .deb is 180-210MB)
MANUAL_WAIT_MAX=600              # seconds to wait for a manual download (0=skip)
WECHAT_ARCH=""                    # x86_64 | arm64 | LoongArch (resolved in main)
DEB_URL=""                        # official .deb URL (resolved in main)
RESOLVED_DEB=""                   # path to the .deb to install (set by obtain_*)

# WeChat's UNDECLARED runtime libraries. The .deb declares only the CJK font but
# dynamically links these system libs; full desktops already have them, lean/
# minimal ones may not. Each entry lists candidate package names in preference
# order (t64 name first for Debian13/Kali/Ubuntu24.04, then the pre-t64 name for
# Debian12/Ubuntu22.04); the first one with an install candidate is used.
WECHAT_RUNTIME_LIB_GROUPS=(
    "libnss3" "libnspr4"
    "libcups2t64 libcups2"
    "libasound2t64 libasound2"
    "libpulse0"
    "libatk1.0-0t64 libatk1.0-0"
    "libatk-bridge2.0-0t64 libatk-bridge2.0-0"
    "libatspi2.0-0t64 libatspi2.0-0"
    "libgtk-3-0t64 libgtk-3-0"
    "libgbm1" "libdrm2"
    "libxtst6" "libxcomposite1" "libxdamage1" "libxfixes3" "libxrandr2" "libxrender1"
    "libxkbcommon0" "libxkbcommon-x11-0"
    "libxcb-icccm4" "libxcb-image0" "libxcb-keysyms1" "libxcb-render-util0"
    "libxcb-randr0" "libxcb-shape0" "libxcb-sync1" "libxcb-xfixes0" "libxcb-xkb1"
    "libgssapi-krb5-2" "libpango-1.0-0" "libcairo2" "libfontconfig1" "libdbus-1-3"
)

# Install/cache directories (a copy of the .deb is kept here for reuse)
APPLICATIONS_DIR=$(map_web_path "compile_dir" "applications")
WECHAT_INSTALL_DIR="$APPLICATIONS_DIR/wechat"
WECHAT_DEB_DIR="$WECHAT_INSTALL_DIR/deb"
LEGACY_APPIMAGE_DIR="$APPLICATIONS_DIR/appimages/wechat"   # from the old AppImage installer

# Version tracking
APP_VERSIONS_DIR="$GLOBAL_VAR_DIR/app_versions"
VERSION_FILE="$APP_VERSIONS_DIR/wechat.version"

# Real user detection (for download location / ownership)
REAL_USER=$(get_real_user)
REAL_USER_HOME=$(get_real_user_home)
REAL_USER_DOWNLOADS=$(get_real_user_downloads)
REAL_USER_GROUP=$(id -gn "$REAL_USER" 2>/dev/null || echo "$REAL_USER")

# Map the running CPU architecture to the official WeChat .deb arch token.
# Tencent ships x86_64 (amd64), arm64 (aarch64) and LoongArch (.deb only).
resolve_wechat_arch() {
    local apt_arch machine
    apt_arch=$(dpkg --print-architecture 2>/dev/null || echo "")
    machine=$(uname -m 2>/dev/null || echo "")
    case "$apt_arch" in
        amd64)               echo "x86_64";    return 0 ;;
        arm64)               echo "arm64";     return 0 ;;
        loong64|loongarch64) echo "LoongArch"; return 0 ;;
    esac
    case "$machine" in
        x86_64|amd64)        echo "x86_64";    return 0 ;;
        aarch64|arm64)       echo "arm64";     return 0 ;;
        loongarch64|loong64) echo "LoongArch"; return 0 ;;
    esac
    echo ""
    return 1
}

# True when a package is installed (status "install ok installed")
pkg_is_installed() {
    dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

# True when a package has an installation candidate in the configured repos
pkg_has_candidate() {
    apt-cache policy "$1" 2>/dev/null | grep -q 'Candidate: [^(]'
}

# Version recorded in a .deb file's control (echo only)
dpkg_deb_version() {
    dpkg-deb -f "$1" Version 2>/dev/null
}

# Version of the currently installed wechat package (echo only)
get_dpkg_installed_version() {
    dpkg-query -W -f='${Version}' "$PKG_NAME" 2>/dev/null
}

# Version recorded by a previous run of this script (echo only)
get_installed_version() {
    if [ -f "$VERSION_FILE" ]; then
        grep '^VERSION=' "$VERSION_FILE" 2>/dev/null | cut -d= -f2
    fi
}

# True when WeChat is actually installed. Authoritative on dpkg status only:
# a bare PATH hit can be a stale ~/.local/bin/wechat from the old AppImage
# installer, which must NOT count as installed (else it suppresses the .deb).
is_wechat_installed() {
    pkg_is_installed "$PKG_NAME"
}

# Save installation metadata for idempotency/upgrade decisions
save_installation_info() {
    local version="$1"
    local pkgfile="$2"
    $USE_SUDO mkdir -p "$APP_VERSIONS_DIR"
    cat <<EOF | $USE_SUDO tee "$VERSION_FILE" >/dev/null
DATE=$(date '+%Y-%m-%d %H:%M:%S')
VERSION=$version
ARCH=$WECHAT_ARCH
PACKAGE=$(basename "$pkgfile")
URL=$DEB_URL
EOF
}

# Open a URL in the real user's session (xdg-open as root usually fails).
open_url_for_user() {
    local url="$1"
    command -v xdg-open >/dev/null 2>&1 || return 0
    if [ "$(id -u)" -eq 0 ] && [ "$REAL_USER" != "root" ] && command -v sudo >/dev/null 2>&1; then
        sudo -u "$REAL_USER" DISPLAY="${DISPLAY:-:0}" xdg-open "$url" >/dev/null 2>&1 &
    else
        xdg-open "$url" >/dev/null 2>&1 &
    fi
}

# Install the download tooling and the only declared runtime dependency.
# WeChat's ONLY apt dependency is the CJK font (fonts-noto-cjk |
# google-noto-cjk-fonts); apt resolves it during the .deb install, but install it
# up front so Chinese glyphs render even if the alternative is selected. No
# library list is hardcoded here (ensure_runtime_libs handles the undeclared ones
# defensively) - a single static list would fail wholesale on the t64 rename.
install_dependencies() {
    print_step_from_common_functions "Ensuring download tools and CJK fonts..."
    $USE_SUDO apt-get update -qq 2>/dev/null || $USE_SUDO apt-get update || true

    local tool
    for tool in wget curl ca-certificates; do
        command -v "$tool" >/dev/null 2>&1 && continue
        $USE_SUDO apt-get install -y "$tool" || true
    done

    # Satisfied if EITHER alternative of the declared font dependency is present.
    if ! pkg_is_installed fonts-noto-cjk && ! pkg_is_installed google-noto-cjk-fonts; then
        $USE_SUDO apt-get install -y fonts-noto-cjk || true
    fi
}

# Best-effort install of WeChat's undeclared runtime libraries (see the
# WECHAT_RUNTIME_LIB_GROUPS comment). Failure-tolerant: a missing candidate is
# skipped and never aborts the install.
ensure_runtime_libs() {
    print_step_from_common_functions "Ensuring WeChat runtime libraries (best-effort, t64-aware)..."
    local group cand chosen p
    local to_install=()
    for group in "${WECHAT_RUNTIME_LIB_GROUPS[@]}"; do
        chosen=""
        for cand in $group; do
            if pkg_is_installed "$cand"; then
                chosen=""
                break
            fi
            if pkg_has_candidate "$cand"; then
                chosen="$cand"
                break
            fi
        done
        [ -n "$chosen" ] && to_install+=("$chosen")
    done

    if [ "${#to_install[@]}" -eq 0 ]; then
        print_info_from_common_functions "Runtime libraries already satisfied"
        return 0
    fi

    print_info_from_common_functions "Installing ${#to_install[@]} runtime libraries: ${to_install[*]}"
    if ! $USE_SUDO apt-get install -y --no-install-recommends "${to_install[@]}"; then
        print_warning_from_common_functions "Batch install failed - retrying each library individually"
        for p in "${to_install[@]}"; do
            $USE_SUDO apt-get install -y --no-install-recommends "$p" || true
        done
    fi
}

# Resolve the .deb to install into RESOLVED_DEB. Order: existing file in any
# Downloads dir -> automatic download -> interactive manual download.
# NOTE: this function is NOT command-substituted (callers read RESOLVED_DEB), so
# it is free to use print_* helpers.
obtain_wechat_deb() {
    print_step_from_common_functions "Locating WeChat .deb package..."

    # Use an existing download ONLY if it passes the integrity check. A stale
    # 0-byte/partial file from a previously interrupted run would otherwise be
    # re-discovered every run and block installation forever, so discard it and
    # fall through to a fresh download.
    local found
    found=$(find_file_in_downloads_from_common_functions "$DEB_GLOB" "newest")
    if [ -n "$found" ] && [ -f "$found" ]; then
        if check_deb_integrity "$found"; then
            print_success_from_common_functions "Found in Downloads: $(basename "$found")"
            RESOLVED_DEB="$found"
            return 0
        fi
        print_warning_from_common_functions "Discarding unusable .deb in Downloads: $found"
        rm -f "$found" 2>/dev/null || $USE_SUDO rm -f "$found" 2>/dev/null || true
    fi

    # Resolve a download directory: the real user's Downloads (create it if
    # missing), else any existing Downloads dir, else /tmp.
    local dl_dir="$REAL_USER_DOWNLOADS"
    if [ -z "$dl_dir" ] || [ ! -d "$dl_dir" ]; then
        if [ -n "$REAL_USER_HOME" ] && [ -d "$REAL_USER_HOME" ]; then
            dl_dir="$REAL_USER_HOME/Downloads"
            if [ "$(id -u)" -eq 0 ] && [ "$REAL_USER" != "root" ] && command -v sudo >/dev/null 2>&1; then
                sudo -u "$REAL_USER" mkdir -p "$dl_dir" 2>/dev/null || mkdir -p "$dl_dir" 2>/dev/null || true
            else
                mkdir -p "$dl_dir" 2>/dev/null || true
            fi
        fi
    fi
    [ -d "$dl_dir" ] || dl_dir=$(find_all_downloads_dirs_from_common_functions 2>/dev/null | head -1)
    [ -n "$dl_dir" ] && [ -d "$dl_dir" ] || dl_dir="/tmp"
    local target="$dl_dir/WeChatLinux_${WECHAT_ARCH}.deb"

    print_step_from_common_functions "Downloading official WeChat .deb ($WECHAT_ARCH)..."
    print_info_from_common_functions "From: $DEB_URL"
    print_info_from_common_functions "To:   $target"

    # -c lets wget resume if the CDN drops a long download (server supports Range).
    local dl_ok=false
    if [ "$(id -u)" -eq 0 ] && [ "$REAL_USER" != "root" ] && [ "$dl_dir" != "/tmp" ] && command -v sudo >/dev/null 2>&1; then
        # Running as root: download as the real user so the file is user-owned.
        sudo -u "$REAL_USER" wget -c --tries=3 --timeout=120 --progress=bar:force -O "$target" "$DEB_URL" && dl_ok=true
    else
        # Non-root (or /tmp, or sudo missing): download directly.
        wget -c --tries=3 --timeout=120 --progress=bar:force -O "$target" "$DEB_URL" && dl_ok=true
        # Edge case (root without sudo): a root-written file in a user dir would
        # be undeletable by the user and re-discovered next run - hand it back.
        if [ "$dl_ok" = true ] && [ "$(id -u)" -eq 0 ] && [ "$REAL_USER" != "root" ] && [ "$dl_dir" != "/tmp" ]; then
            chown "$REAL_USER:$REAL_USER_GROUP" "$target" 2>/dev/null || true
        fi
    fi

    # Accept only a plausibly-complete file; otherwise drop the junk so it is not
    # re-discovered on the next run, then fall through to the manual path.
    if [ "$dl_ok" = true ] && [ -s "$target" ] \
        && [ "$(stat -c%s "$target" 2>/dev/null || echo 0)" -ge "$MIN_DEB_SIZE" ]; then
        print_success_from_common_functions "Downloaded: $(basename "$target")"
        RESOLVED_DEB="$target"
        return 0
    fi
    print_warning_from_common_functions "Download failed or produced an incomplete file"
    rm -f "$target" 2>/dev/null || $USE_SUDO rm -f "$target" 2>/dev/null || true

    # Manual fallback (interactive only). Poll Downloads directly via the
    # capture-safe finder so progress stays visible (do NOT command-substitute the
    # interactive prompt helper - it writes its UI to stdout).
    if [ ! -t 0 ] || [ "$MANUAL_WAIT_MAX" -le 0 ]; then
        print_error_from_common_functions "Automatic download failed and no interactive manual download is possible"
        return 1
    fi
    print_warning_from_common_functions "Falling back to manual download"
    print_info_from_common_functions "Opening official page: $OFFICIAL_PAGE"
    open_url_for_user "$OFFICIAL_PAGE"
    print_info_from_common_functions "Waiting up to ${MANUAL_WAIT_MAX}s for $DEB_GLOB in any Downloads folder (Ctrl-C to abort)..."

    local waited=0 manual=""
    while [ "$waited" -lt "$MANUAL_WAIT_MAX" ]; do
        manual=$(find_file_in_downloads_from_common_functions "$DEB_GLOB" "newest")
        if [ -n "$manual" ] && [ -f "$manual" ]; then
            print_success_from_common_functions "Detected manual download: $(basename "$manual")"
            RESOLVED_DEB="$manual"
            return 0
        fi
        sleep 3
        waited=$((waited + 3))
        if [ $((waited % 30)) -eq 0 ]; then
            print_info_from_common_functions "Still waiting... (${waited}s)"
        fi
    done

    print_error_from_common_functions "Timed out waiting for a manual WeChat .deb download"
    return 1
}

# Validate a .deb before installing (size floor, dpkg-deb parse, package name).
check_deb_integrity() {
    local deb="$1"
    local size pkg

    if [ ! -f "$deb" ]; then
        print_error_from_common_functions ".deb file not found: $deb"
        return 1
    fi

    size=$(stat -c%s "$deb" 2>/dev/null || echo 0)
    if [ "${size:-0}" -lt "$MIN_DEB_SIZE" ]; then
        print_warning_from_common_functions ".deb too small ($size bytes) - likely a partial download"
        return 1
    fi

    if ! dpkg-deb --info "$deb" >/dev/null 2>&1; then
        print_warning_from_common_functions ".deb is corrupted (dpkg-deb check failed)"
        return 1
    fi

    pkg=$(dpkg-deb -f "$deb" Package 2>/dev/null)
    if [ -n "$pkg" ] && [ "$pkg" != "$PKG_NAME" ]; then
        print_warning_from_common_functions "Unexpected package name '$pkg' (expected '$PKG_NAME')"
        return 1
    fi

    print_success_from_common_functions ".deb integrity check passed ($(numfmt --to=iec "$size" 2>/dev/null || echo "$size bytes"))"
    return 0
}

# Remove artifacts left by the previous AppImage-based version of this installer
# so a stale ~/.local/bin/wechat symlink does not shadow the .deb's /usr/bin/wechat.
# Scoped to symlinks that clearly point into our old AppImage tree (uses plain
# readlink on the immediate target so unrelated dangling links are NOT touched).
cleanup_legacy_appimage_install() {
    local home_dir symlink tgt
    local homes=()
    [ -n "$REAL_USER_HOME" ] && homes+=("$REAL_USER_HOME")
    for home_dir in /home/* /root; do
        [ -d "$home_dir" ] || continue
        case " ${homes[*]} " in *" $home_dir "*) ;; *) homes+=("$home_dir") ;; esac
    done

    for home_dir in "${homes[@]}"; do
        symlink="$home_dir/.local/bin/wechat"
        [ -L "$symlink" ] || continue
        tgt=$(readlink "$symlink" 2>/dev/null || echo "")
        case "$tgt" in
            "$LEGACY_APPIMAGE_DIR"/*|"$APPLICATIONS_DIR"/appimages/*)
                print_step_from_common_functions "Removing stale legacy symlink: $symlink"
                rm -f "$symlink" 2>/dev/null || $USE_SUDO rm -f "$symlink" 2>/dev/null || true
                ;;
        esac
    done

    if [ -d "$LEGACY_APPIMAGE_DIR" ]; then
        print_step_from_common_functions "Removing legacy AppImage tree: $LEGACY_APPIMAGE_DIR"
        $USE_SUDO rm -rf "$LEGACY_APPIMAGE_DIR" 2>/dev/null || true
    fi
}

# Install the local .deb. Install through apt so the package's Depends
# (fonts-noto-cjk | google-noto-cjk-fonts) resolve automatically across
# Debian/Ubuntu/Kali; fall back to dpkg + `apt-get install -f` on failure.
install_deb_package() {
    local deb="$1"
    local name installed

    $USE_SUDO mkdir -p "$WECHAT_DEB_DIR"
    name=$(basename "$deb")
    installed="$WECHAT_DEB_DIR/$name"

    if [ "$deb" != "$installed" ]; then
        print_step_from_common_functions "Copying .deb to $WECHAT_DEB_DIR"
        $USE_SUDO cp -f "$deb" "$installed"
    fi

    print_step_from_common_functions "Installing $name (apt resolves dependencies)..."
    if $USE_SUDO apt-get install -y "$installed"; then
        print_success_from_common_functions "WeChat installed via apt"
        return 0
    fi

    print_warning_from_common_functions "apt install failed - retrying with dpkg + dependency fix"
    $USE_SUDO dpkg -i "$installed" || true
    $USE_SUDO apt-get install -f -y || true
    if $USE_SUDO dpkg -i "$installed"; then
        print_success_from_common_functions "WeChat installed via dpkg after dependency fix"
        return 0
    fi

    print_error_from_common_functions "Failed to install $name"
    return 1
}

# WeChat embeds a Chromium-based runtime whose sandbox needs unprivileged user
# namespaces. Debian 13 / Kali / Ubuntu 24.04 restrict these by default, so the
# app fails to start. When a restriction is detected, add --no-sandbox to the
# .deb-provided desktop entry (idempotent; left enabled on permissive kernels).
ensure_sandbox_launch_compat() {
    local restricted=0 v

    v=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo "")
    [ "$v" = "1" ] && restricted=1
    v=$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo "")
    [ "$v" = "0" ] && restricted=1
    v=$(cat /proc/sys/user/max_user_namespaces 2>/dev/null || echo "")
    [ -n "$v" ] && [ "$v" = "0" ] && restricted=1

    if [ "$restricted" != "1" ]; then
        print_info_from_common_functions "Kernel permits the Chromium sandbox - leaving it enabled"
        return 0
    fi
    [ -f "$DESKTOP_FILE" ] || return 0
    if grep -q -- '--no-sandbox' "$DESKTOP_FILE"; then
        print_info_from_common_functions "Sandbox workaround already present in wechat.desktop"
        return 0
    fi

    print_step_from_common_functions "Restricted user namespaces detected - adding --no-sandbox to wechat.desktop"
    $USE_SUDO sed -i -E '/^Exec=\/usr\/bin\/wechat/ { /--no-sandbox/! s#^Exec=/usr/bin/wechat#Exec=/usr/bin/wechat --no-sandbox# }' "$DESKTOP_FILE"
}

# Refresh the desktop database so the .deb-provided menu entry shows up.
update_desktop_db() {
    if command -v update-desktop-database >/dev/null 2>&1; then
        $USE_SUDO update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
    fi
}

# Decide whether to (re)install. Returns 0 to proceed, 1 to keep existing.
prompt_update_or_skip() {
    if ! is_wechat_installed; then
        return 0
    fi

    local cur
    cur=$(get_dpkg_installed_version)
    [ -z "$cur" ] && cur=$(get_installed_version)
    print_info_from_common_functions "WeChat is already installed${cur:+ (version $cur)}"

    if [ ! -t 0 ]; then
        print_info_from_common_functions "Non-interactive shell - keeping existing installation"
        return 1
    fi

    local response
    echo -n "Update / reinstall WeChat? [Y/n]: "
    read -r response
    case "$response" in
        [nN] | [nN][oO])
            print_info_from_common_functions "Keeping existing installation"
            return 1
            ;;
        *)
            print_info_from_common_functions "Proceeding with update/reinstall..."
            return 0
            ;;
    esac
}

# Main installation logic
main() {
    print_header_from_common_functions "[$SCRIPT_INDEX] $APP_NAME for Linux Installation"

    # WeChat is a GUI app - skip on headless servers.
    if [ "$HAS_DESKTOP_ENVIRONMENT" != "true" ]; then
        print_info_from_common_functions "No desktop environment detected - skipping $APP_NAME (GUI application)"
        exit 0
    fi

    # Resolve architecture -> official .deb URL.
    WECHAT_ARCH=$(resolve_wechat_arch)
    if [ -z "$WECHAT_ARCH" ]; then
        print_error_from_common_functions "Unsupported CPU architecture: $(uname -m)"
        print_error_from_common_functions "Official WeChat .deb supports x86_64, arm64 and LoongArch only"
        exit 1
    fi
    DEB_URL="$DOWNLOAD_BASE/WeChatLinux_${WECHAT_ARCH}.deb"

    print_info_from_common_functions "Distro:     ${OS_NAME:-$OS_ID} ${OS_VERSION_ID}"
    print_info_from_common_functions "Arch:       $WECHAT_ARCH"
    print_info_from_common_functions "Package:    $DEB_URL"
    print_info_from_common_functions "Real user:  $REAL_USER ($REAL_USER_HOME)"

    if ! prompt_update_or_skip; then
        exit 0
    fi

    install_dependencies

    if ! obtain_wechat_deb; then
        print_error_from_common_functions "Could not obtain the WeChat .deb package"
        exit 1
    fi

    if ! check_deb_integrity "$RESOLVED_DEB"; then
        print_error_from_common_functions ".deb integrity check failed: $RESOLVED_DEB"
        exit 1
    fi

    if ! install_deb_package "$RESOLVED_DEB"; then
        exit 1
    fi

    # The .deb is in place: now retire the old AppImage-based install (only after
    # success, so a failed install never leaves the user with nothing).
    cleanup_legacy_appimage_install

    # Pull the undeclared runtime libraries and apply the sandbox workaround.
    ensure_runtime_libs
    ensure_sandbox_launch_compat
    update_desktop_db

    if ! is_wechat_installed; then
        print_error_from_common_functions "Install finished but '$EXEC_NAME' is not registered with dpkg"
        exit 1
    fi

    # Record the installed version.
    local ver
    ver=$(dpkg_deb_version "$RESOLVED_DEB")
    [ -z "$ver" ] && ver=$(get_dpkg_installed_version)
    save_installation_info "${ver:-unknown}" "$RESOLVED_DEB"

    echo ""
    print_success_from_common_functions "=========================================="
    print_success_from_common_functions "$APP_NAME Installation Completed"
    print_success_from_common_functions "=========================================="
    print_info_from_common_functions "  Version:  ${ver:-unknown}"
    print_info_from_common_functions "  Arch:     $WECHAT_ARCH"
    print_info_from_common_functions "  Binary:   $(command -v "$EXEC_NAME" 2>/dev/null || echo /usr/bin/$EXEC_NAME)"
    print_info_from_common_functions "  Package:  $WECHAT_DEB_DIR/$(basename "$RESOLVED_DEB")"
    echo ""
    print_info_from_common_functions "Launch $APP_NAME from the application menu or run: $EXEC_NAME"
    echo ""
}

main "$@"
