#!/bin/bash
# Wine runtime for WPF apps on Linux: Wine, upstream winetricks, a per-user 64-bit prefix with the
# .NET 8 Windows Desktop Runtime and the VC++ runtime. Every piece is detected first; only missing pieces are installed.

WINE_WPF_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WINE_WPF_PACKAGES=(wine wine64 fonts-wine cabextract unzip inotify-tools)
WINE_WPF_WINETRICKS_VERSION="20250102"
WINE_WPF_WINETRICKS_URL="https://raw.githubusercontent.com/Winetricks/winetricks/$WINE_WPF_WINETRICKS_VERSION/src/winetricks"
WINE_WPF_DOTNET_MAJOR="8"
WINE_WPF_DOTNET_URL="https://aka.ms/dotnet/$WINE_WPF_DOTNET_MAJOR.0/windowsdesktop-runtime-win-x64.exe"
WINE_WPF_VCREDIST_URL="https://aka.ms/vs/17/release/vc_redist.x64.exe"
WINE_WPF_DOWNLOAD_SUBDIR="downloads"
WINE_WPF_PREFIX_PREFIX="dotnet-wpf-"
WINE_WPF_VCRUN_MARKER=".cn_vcrun2022"
WINE_WPF_INSTALL_TIMEOUT=1200
WINE_WPF_USER=""
WINE_WPF_PREFIX=""
WINE_WPF_WINETRICKS=""
WINE_WPF_INSTALL_FAILED=false

wine_wpf_log() {
    if type log_message >/dev/null 2>&1; then
        log_message "$*"
    else
        echo "[wine-wpf] $*"
    fi
}

type run_as_user_plain >/dev/null 2>&1 || source "$WINE_WPF_COMMON_DIR/desktop_system_policy.sh" 2>/dev/null

wine_wpf_prefix_dir() {
    echo "$CN_WINE_WPF_ROOT/$WINE_WPF_PREFIX_PREFIX${1:-$(id -un)}"
}

wine_wpf_runtime_present() {
    local prefix="${1:-$(wine_wpf_prefix_dir)}"
    command -v wine >/dev/null 2>&1 || return 1
    compgen -G "$prefix/drive_c/Program Files/dotnet/shared/Microsoft.WindowsDesktop.App/$WINE_WPF_DOTNET_MAJOR.*" >/dev/null 2>&1
}

wine_wpf_target_user() {
    WINE_WPF_USER="$(resolve_desktop_user "" 2>/dev/null)"
    [ -n "$WINE_WPF_USER" ] || WINE_WPF_USER="$(id -un)"
    WINE_WPF_PREFIX="$(wine_wpf_prefix_dir "$WINE_WPF_USER")"
}

wine_wpf_run() {
    run_as_user_plain "$WINE_WPF_USER" env WINEPREFIX="$WINE_WPF_PREFIX" WINEARCH=win64 WINEDEBUG=-all \
        WINEDLLOVERRIDES="mscoree,mshtml=" "$@"
}

wine_wpf_run_headless() {
    wine_wpf_run env -u DISPLAY -u WAYLAND_DISPLAY timeout "$WINE_WPF_INSTALL_TIMEOUT" "$@"
}

wine_wpf_install_packages() {
    local pkg="" missing=()
    for pkg in "${WINE_WPF_PACKAGES[@]}"; do
        dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
    done
    if [ "${#missing[@]}" -eq 0 ]; then
        wine_wpf_log "Wine packages already installed"
        return 0
    fi
    wine_wpf_log "Installing Wine packages: ${missing[*]}"
    timeout 300 $USE_SUDO apt-get update >/dev/null 2>&1 || wine_wpf_log "Warning: apt update failed, continuing"
    timeout 1800 $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${missing[@]}"
}

wine_wpf_download() {
    local url="$1" dest="$2"
    [ -s "$dest" ] && return 0
    ensure_shared_dir 1777 "$(dirname "$dest")"
    wine_wpf_log "Downloading $url"
    curl -fsSL --retry 3 -o "$dest.part" "$url" && mv -f "$dest.part" "$dest"
}

wine_wpf_ensure_winetricks() {
    local base="${CN_TOOL_ROOT:-$CN_CACHE_ROOT}/winetricks/$WINE_WPF_WINETRICKS_VERSION"
    WINE_WPF_WINETRICKS="$base/winetricks"
    if [ ! -x "$WINE_WPF_WINETRICKS" ]; then
        $USE_SUDO mkdir -p "$base" || return 1
        wine_wpf_log "Installing upstream winetricks $WINE_WPF_WINETRICKS_VERSION"
        $USE_SUDO curl -fsSL --retry 3 -o "$WINE_WPF_WINETRICKS" "$WINE_WPF_WINETRICKS_URL" || return 1
        $USE_SUDO chmod 755 "$WINE_WPF_WINETRICKS"
    fi
}

wine_wpf_ensure_prefix() {
    if [ -f "$WINE_WPF_PREFIX/system.reg" ]; then
        wine_wpf_log "Wine prefix already initialized: $WINE_WPF_PREFIX"
        return 0
    fi
    ensure_shared_dir 1777 "$CN_WINE_WPF_ROOT"
    wine_wpf_log "Initializing 64-bit Wine prefix: $WINE_WPF_PREFIX"
    wine_wpf_run_headless wineboot --init >/dev/null 2>&1
    [ -f "$WINE_WPF_PREFIX/system.reg" ]
}

wine_wpf_ensure_dotnet() {
    local installer="$CN_WINE_WPF_ROOT/$WINE_WPF_DOWNLOAD_SUBDIR/windowsdesktop-runtime-win-x64.exe"
    if wine_wpf_runtime_present "$WINE_WPF_PREFIX"; then
        wine_wpf_log ".NET $WINE_WPF_DOTNET_MAJOR Windows Desktop Runtime already in the prefix"
        return 0
    fi
    wine_wpf_log "Installing .NET $WINE_WPF_DOTNET_MAJOR Windows Desktop Runtime (x64) into the prefix"
    if wine_wpf_download "$WINE_WPF_DOTNET_URL" "$installer"; then
        wine_wpf_run_headless wine "$installer" /install /quiet /norestart >/dev/null 2>&1
        wine_wpf_run_headless wineserver -w >/dev/null 2>&1
    fi
    wine_wpf_runtime_present "$WINE_WPF_PREFIX" && return 0
    wine_wpf_log "Official installer did not complete; falling back to winetricks dotnetdesktop$WINE_WPF_DOTNET_MAJOR"
    wine_wpf_ensure_winetricks || return 1
    wine_wpf_run_headless "$WINE_WPF_WINETRICKS" -q "dotnetdesktop$WINE_WPF_DOTNET_MAJOR" >/dev/null 2>&1
    wine_wpf_runtime_present "$WINE_WPF_PREFIX"
}

wine_wpf_ensure_vcrun() {
    local installer="$CN_WINE_WPF_ROOT/$WINE_WPF_DOWNLOAD_SUBDIR/vc_redist.x64.exe"
    if [ -f "$WINE_WPF_PREFIX/$WINE_WPF_VCRUN_MARKER" ]; then
        wine_wpf_log "VC++ 2015-2022 runtime already installed in the prefix"
        return 0
    fi
    wine_wpf_log "Installing VC++ 2015-2022 x64 runtime into the prefix"
    wine_wpf_download "$WINE_WPF_VCREDIST_URL" "$installer" || return 1
    wine_wpf_run_headless wine "$installer" /install /quiet /norestart >/dev/null 2>&1
    wine_wpf_run_headless wineserver -w >/dev/null 2>&1
    wine_wpf_run touch "$WINE_WPF_PREFIX/$WINE_WPF_VCRUN_MARKER"
}

wine_wpf_ensure() {
    WINE_WPF_INSTALL_FAILED=false
    wine_wpf_target_user
    wine_wpf_install_packages || { wine_wpf_log "Wine package install failed"; WINE_WPF_INSTALL_FAILED=true; return 0; }
    wine_wpf_ensure_winetricks || wine_wpf_log "Warning: winetricks unavailable (only needed as a fallback)"
    wine_wpf_ensure_prefix || { wine_wpf_log "Wine prefix init failed"; WINE_WPF_INSTALL_FAILED=true; return 0; }
    wine_wpf_ensure_dotnet || { wine_wpf_log ".NET Windows Desktop Runtime install failed"; WINE_WPF_INSTALL_FAILED=true; return 0; }
    wine_wpf_ensure_vcrun || wine_wpf_log "Warning: VC++ runtime install failed (native OCR libraries may not load)"
    wine_wpf_log "WPF runtime ready: user=$WINE_WPF_USER prefix=$WINE_WPF_PREFIX"
}
