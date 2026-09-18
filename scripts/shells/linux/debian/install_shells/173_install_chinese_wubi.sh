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
# Chinese Wubi (wu bi) Input Method Installation Script
#==============================================================================
# Installs a Chinese Wubi input method on Debian-family desktops, idempotently.
# Targets: Debian 11/12/13, Ubuntu 18.04-26.x, Kali (rolling/latest).
#
# Strategy (runtime apt-cache detection, no hard-coded per-release matrix):
#   - Prefer Fcitx5 when fcitx5-chinese-addons is available
#     (Debian 11+, Kali, Ubuntu 22.04+); its built-in `wbx` already provides
#     Wubi 86, and fcitx5-table-extra (Debian 13+/Ubuntu 24.04+/Kali) adds the
#     richer `wubi-large` tables when present. Installed with
#     --install-recommends per the Debian wiki, plus the GNOME kimpanel
#     extension / KDE KCM when those desktops are available. The kimpanel
#     extension is also seeded into GNOME's enabled-extensions, because the
#     package alone never activates it and the fcitx5 top-bar icon stays
#     invisible until it is.
#   - Fall back to IBus (ibus-table-wubi) which exists on EVERY target,
#     including Ubuntu 18.04/20.04 where fcitx5 is absent or too old; the Wubi
#     engine is also appended to GNOME's input-source list so it shows up in
#     the keyboard switcher (Super+Space) without manual setup.
# Every optional package is filtered through apt-cache so the install never
# requests a package that does not exist on the running release. This is what
# makes ONE script work across Debian, Ubuntu and Kali without a release matrix.
#
# Why some apps cannot type Chinese (the real cross-distro problem this fixes):
#   - Missing GTK/Qt "frontend" bridge modules -> the IME never reaches GTK3/4 +
#     Qt5/6 apps (Chrome, VS Code, etc.). We install ALL frontends (via
#     fcitx5-frontend-all + explicit gtk2, or the individual ibus immodules).
#   - IME env vars not exported -> set via im-config + /etc/environment.
#   - zh_CN.UTF-8 locale / CJK font missing -> Chinese shows as tofu, and some
#     terminals refuse the IME. install_language_support handles both.
#
# Only runs on desktop systems (an IME is useless on a headless server).
# Re-runnable: apt installs are idempotent, the IM framework / env vars are set
# in place, and the per-user Wubi profile is written only when absent.
#==============================================================================

SCRIPT_CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR_LEVEL_1="$(dirname "$SCRIPT_CURRENT_DIR")"
PARENT_DIR_LEVEL_2="$(dirname "$PARENT_DIR_LEVEL_1")"
SCRIPT_INDEX="173"

# Source common files
source "$PARENT_DIR_LEVEL_2/common/gvar_common.sh"
source "$PARENT_DIR_LEVEL_2/common/common_functions.sh"
source "$PARENT_DIR_LEVEL_2/common/get_real_user.sh"
source "$PARENT_DIR_LEVEL_2/common/desktop_electron_ime_compat.sh"

# Declare variables
APP_NAME="Chinese Wubi IME"
FRAMEWORK=""
APT_UPDATED=0
WUBI_IM=""
IBUS_ENGINE=""
ENV_FILE="/etc/environment"
ENV_MARK_BEGIN="# >>> core_node chinese-wubi (managed) >>>"
ENV_MARK_END="# <<< core_node chinese-wubi (managed) <<<"
ENV_PAIRS=()
KIMPANEL_EXTENSION_UUID="kimpanel@kde.org"
KIMPANEL_EXTENSION_DIR="/usr/share/gnome-shell/extensions/kimpanel@kde.org"

# Required core packages per framework (must exist on the chosen path).
FCITX5_REQUIRED=("fcitx5" "fcitx5-chinese-addons" "im-config")
IBUS_REQUIRED=("ibus" "ibus-table" "ibus-table-wubi" "im-config")
# Optional packages: installed only when apt-cache shows them on this release.
# Fcitx5 frontends are the GTK/Qt bridge IM modules that let the IME work in
# GTK3/4 + Qt5/6 apps. fcitx5-frontend-all pulls gtk3/gtk4/qt5/qt6 (NOT gtk2),
# so gtk2 is listed separately; the individual frontends are also listed as a
# fallback for releases without the metapackage (e.g. Ubuntu 22.04). The Wayland
# frontend is built into fcitx5-modules (a core dep) since 5.0.20 -> not listed.
FCITX5_OPTIONAL=(
    "fcitx5-config-qt"
    "fcitx5-frontend-all"
    "fcitx5-frontend-gtk2"
    "fcitx5-frontend-gtk3"
    "fcitx5-frontend-gtk4"
    "fcitx5-frontend-qt5"
    "fcitx5-frontend-qt6"
    "fcitx5-table-extra"
    # Debian wiki (I18n/Fcitx5): GNOME users should install the kimpanel
    # extension; KDE users get the KCM config module. Both are
    # availability-filtered, so non-GNOME/non-KDE releases skip them.
    "gnome-shell-extension-kimpanel"
    "kde-config-fcitx5"
)
IBUS_OPTIONAL=("ibus-gtk" "ibus-gtk3" "ibus-gtk4" "ibus-clutter")

# Real user (the per-user IME config target; the installer may run as root).
REAL_USER=$(get_real_user)
REAL_USER_HOME=$(get_real_user_home)
REAL_USER_GROUP=$(id -gn "$REAL_USER" 2>/dev/null || echo "$REAL_USER")

echo "=========================================="
echo "[$SCRIPT_INDEX] $APP_NAME Installation"
echo "=========================================="
echo ""

# An input method only makes sense with a GUI session.
if [ "$HAS_DESKTOP_ENVIRONMENT" = false ]; then
    print_info_from_common_functions "Non-desktop system detected - skipping $APP_NAME installation"
    print_info_from_common_functions "A graphical input method has no effect on a headless server"
    echo ""
    print_success_from_common_functions "Skipping installation automatically"
    exit 0
fi

# True when an apt package exists for the running release (real or virtual).
pkg_available() {
    apt-cache show "$1" >/dev/null 2>&1
}

# Run apt-get update at most once per invocation.
ensure_apt_update() {
    if [ "$APT_UPDATED" -eq 1 ]; then
        return 0
    fi
    print_step_from_common_functions "Refreshing apt package lists..."
    $USE_SUDO apt-get update -qq || print_warning_from_common_functions "apt-get update reported issues, continuing"
    APT_UPDATED=1
}

# Install the given packages (idempotent; apt skips already-installed ones).
apt_install() {
    local pkgs=("$@")
    if [ ${#pkgs[@]} -eq 0 ]; then
        return 0
    fi
    ensure_apt_update
    print_step_from_common_functions "Installing: ${pkgs[*]}"
    # sudo treats a leading VAR=value assignment as the command name ("command
    # not found"); route the env var through env(1) so both root and sudo work.
    $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y \
        -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" \
        "${pkgs[@]}"
}

# Variant with --install-recommends. Debian wiki (I18n/Fcitx5) recommends it for
# the fcitx5 core pair so the module packs most users need come along.
apt_install_with_recommends() {
    local pkgs=("$@")
    if [ ${#pkgs[@]} -eq 0 ]; then
        return 0
    fi
    ensure_apt_update
    print_step_from_common_functions "Installing (with recommends): ${pkgs[*]}"
    $USE_SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y --install-recommends \
        -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" \
        "${pkgs[@]}"
}

# Echo only the packages from the argument list that exist on this release.
filter_available() {
    local pkg
    local available=()
    for pkg in "$@"; do
        if pkg_available "$pkg"; then
            available+=("$pkg")
        else
            print_info_from_common_functions "Skipping unavailable package on this release: $pkg" >&2
        fi
    done
    echo "${available[@]}"
}

# Run a command as the real user. When already that user, run directly so the
# live DISPLAY/DBUS session env survives (needed by gsettings/ibus); only hop via
# sudo when running as root for a different target user.
run_as_real_user() {
    local cur
    cur="$(id -un 2>/dev/null)"
    if [ -n "$REAL_USER" ] && [ "$cur" != "$REAL_USER" ] && [ "$(id -u)" -eq 0 ] && command -v sudo >/dev/null 2>&1; then
        sudo -u "$REAL_USER" "$@"
    else
        "$@"
    fi
}

# Choose Fcitx5 when its Chinese support is installable, else IBus (universal).
choose_framework() {
    ensure_apt_update
    if pkg_available "fcitx5" && pkg_available "fcitx5-chinese-addons"; then
        FRAMEWORK="fcitx5"
    else
        FRAMEWORK="ibus"
    fi
    print_info_from_common_functions "Selected input-method framework: $FRAMEWORK"
}

# Install the Fcitx5 stack + Wubi support + every available GTK/Qt frontend.
install_fcitx5() {
    local optional
    print_step_from_common_functions "Installing Fcitx5 + Chinese (Wubi) support..."
    apt_install_with_recommends "${FCITX5_REQUIRED[@]}"
    optional=$(filter_available "${FCITX5_OPTIONAL[@]}")
    if [ -n "$optional" ]; then
        # shellcheck disable=SC2086
        apt_install $optional
    fi

    # Resolve the Wubi input-method unique name from what actually got installed:
    # the richer table-extra `wubi-large`, else the chinese-addons built-in `wbx`.
    if [ -f /usr/share/fcitx5/inputmethod/wubi-large.conf ]; then
        WUBI_IM="wubi-large"
    elif [ -f /usr/share/fcitx5/inputmethod/wbx.conf ]; then
        WUBI_IM="wbx"
    else
        WUBI_IM="wbx"
        print_warning_from_common_functions "No Wubi .conf found under /usr/share/fcitx5/inputmethod; defaulting to '$WUBI_IM'"
    fi
    print_success_from_common_functions "Fcitx5 Wubi input method: $WUBI_IM"
}

# Install the IBus stack + Wubi engine + every available GTK immodule.
install_ibus() {
    local optional
    print_step_from_common_functions "Installing IBus + Wubi engine..."
    apt_install "${IBUS_REQUIRED[@]}"
    optional=$(filter_available "${IBUS_OPTIONAL[@]}")
    if [ -n "$optional" ]; then
        # shellcheck disable=SC2086
        apt_install $optional
    fi

    # Resolve the Wubi engine string from the installed table db (jidian is the
    # standard variant); fall back to haifeng if only that one is present.
    if [ -f /usr/share/ibus-table/tables/wubi-jidian86.db ]; then
        IBUS_ENGINE="table:wubi-jidian86"
    elif [ -f /usr/share/ibus-table/tables/wubi-haifeng86.db ]; then
        IBUS_ENGINE="table:wubi-haifeng86"
    else
        IBUS_ENGINE="table:wubi-jidian86"
        print_warning_from_common_functions "No Wubi table db found under /usr/share/ibus-table/tables; defaulting to '$IBUS_ENGINE'"
    fi
    print_success_from_common_functions "IBus Wubi engine: $IBUS_ENGINE"
}

# Make the chosen framework the system default via im-config (Debian/Ubuntu's
# scriptable mechanism; as root it writes /etc/X11/xinit/xinputrc system-wide).
# On next login im-config sources /usr/share/im-config/data/*.rc which exports the
# IME env vars and starts the daemon.
set_default_im() {
    if ! command -v im-config >/dev/null 2>&1; then
        print_warning_from_common_functions "im-config not found; skipping default-IM selection"
        return 0
    fi
    print_step_from_common_functions "Setting default input method to $FRAMEWORK (im-config)..."
    if $USE_SUDO im-config -n "$FRAMEWORK" >/dev/null 2>&1; then
        print_success_from_common_functions "Default input method set to $FRAMEWORK"
    else
        print_warning_from_common_functions "im-config could not set the default (a hand-edited xinputrc is left untouched)"
    fi
}

# Write the framework env vars into /etc/environment inside a managed block so a
# re-run (or a framework switch) replaces them cleanly instead of stacking up.
# This backstops im-config for app launchers / sessions that do not source the
# im-config rc (e.g. some Wayland/display-manager paths).
write_env_vars() {
    if [ "$FRAMEWORK" = "fcitx5" ]; then
        # Exact official set shipped in /usr/share/im-config/data/23_fcitx5.rc.
        # The module VALUE is `fcitx` (not `fcitx5`) - fcitx5 registers its IM
        # modules under the legacy id `fcitx` for compatibility. CLUTTER uses
        # `xim`. (GLFW_IM_MODULE/INPUT_METHOD are intentionally NOT set here -
        # they are not part of the official fcitx5 env set.)
        ENV_PAIRS=(
            "GTK_IM_MODULE=fcitx"
            "QT_IM_MODULE=fcitx"
            "XMODIFIERS=@im=fcitx"
            "SDL_IM_MODULE=fcitx"
            "CLUTTER_IM_MODULE=xim"
        )
    else
        ENV_PAIRS=(
            "GTK_IM_MODULE=ibus"
            "QT_IM_MODULE=ibus"
            "XMODIFIERS=@im=ibus"
            "CLUTTER_IM_MODULE=ibus"
        )
    fi

    print_step_from_common_functions "Writing input-method environment variables to $ENV_FILE..."
    $USE_SUDO touch "$ENV_FILE"
    # Drop any previous managed block (idempotent re-run / framework switch).
    $USE_SUDO sed -i "/$ENV_MARK_BEGIN/,/$ENV_MARK_END/d" "$ENV_FILE"
    # Ensure the file ends with a newline so the marker starts on its own line and
    # no blank line accumulates across re-runs.
    if [ -s "$ENV_FILE" ] && [ -n "$(tail -c1 "$ENV_FILE" 2>/dev/null)" ]; then
        printf '\n' | $USE_SUDO tee -a "$ENV_FILE" >/dev/null
    fi
    {
        echo "$ENV_MARK_BEGIN"
        local kv
        for kv in "${ENV_PAIRS[@]}"; do
            echo "$kv"
        done
        echo "$ENV_MARK_END"
    } | $USE_SUDO tee -a "$ENV_FILE" >/dev/null
    print_success_from_common_functions "Environment variables set (effective after re-login)"
}

# Best-effort enable Wubi for the real user (per-user config; non-fatal).
enable_fcitx5_wubi() {
    local fcitx5_dir="$REAL_USER_HOME/.config/fcitx5"
    local profile_path="$fcitx5_dir/profile"

    if [ -z "$REAL_USER_HOME" ] || [ ! -d "$REAL_USER_HOME" ]; then
        print_warning_from_common_functions "Real user home not found; skipping per-user Fcitx5 profile"
        return 0
    fi
    # Do not clobber an existing profile the user may have customized.
    if [ -f "$profile_path" ]; then
        print_info_from_common_functions "Fcitx5 profile already exists; leaving it untouched"
        print_info_from_common_functions "Add Wubi via fcitx5-configtool if it is not enabled yet"
        return 0
    fi

    print_step_from_common_functions "Writing default Fcitx5 profile enabling Wubi ($WUBI_IM)..."
    $USE_SUDO mkdir -p "$fcitx5_dir"
    {
        echo "[Groups/0]"
        echo "Name=Default"
        echo "Default Layout=us"
        echo "DefaultIM=$WUBI_IM"
        echo ""
        echo "[Groups/0/Items/0]"
        echo "Name=keyboard-us"
        echo "Layout="
        echo ""
        echo "[Groups/0/Items/1]"
        echo "Name=$WUBI_IM"
        echo "Layout="
        echo ""
        echo "[GroupOrder]"
        echo "0=Default"
    } | $USE_SUDO tee "$profile_path" >/dev/null
    safe_chown_R "$REAL_USER:$REAL_USER_GROUP" "$fcitx5_dir"
    print_success_from_common_functions "Fcitx5 Wubi profile written for $REAL_USER"
    # Reload a running fcitx5 so the change applies without a relaunch (best-effort).
    run_as_real_user fcitx5-remote -r >/dev/null 2>&1 || true
}

# gsettings as the real user with a resolvable session-bus address. sudo strips
# DBUS_SESSION_BUS_ADDRESS on the hop from root, and a root shell often has no
# bus at all, so derive unix:path=/run/user/<uid>/bus when unset. Without a bus
# the call fails soft (returns non-zero) and the caller treats it as a no-op.
gsettings_for_real_user() {
    local real_uid=""
    local bus_addr="${DBUS_SESSION_BUS_ADDRESS:-}"
    real_uid="$(id -u "$REAL_USER" 2>/dev/null || true)"
    if [ -z "$bus_addr" ] && [ -n "$real_uid" ] && [ -S "/run/user/$real_uid/bus" ]; then
        bus_addr="unix:path=/run/user/$real_uid/bus"
    fi
    if [ -n "$REAL_USER" ] && [ "$(id -u)" -eq 0 ] && [ "$(id -un 2>/dev/null)" != "$REAL_USER" ] && command -v sudo >/dev/null 2>&1; then
        sudo -u "$REAL_USER" DBUS_SESSION_BUS_ADDRESS="$bus_addr" gsettings "$@"
    else
        DBUS_SESSION_BUS_ADDRESS="$bus_addr" gsettings "$@"
    fi
}

# Enable the GNOME kimpanel extension (the fcitx5 tray/input indicator in the
# GNOME top bar). Installing gnome-shell-extension-kimpanel alone is not enough:
# GNOME Shell only activates extensions listed in enabled-extensions, so the
# icon stays invisible until the uuid is seeded here. Idempotent (appended only
# when absent) and fail-soft on non-GNOME desktops (Kali Xfce, KDE, headless):
# no extension dir or no org.gnome.shell schema -> skip; unreachable user bus ->
# warn only. The dconf write takes effect on the next login even when the
# running shell has not rescanned the newly installed extension yet.
enable_gnome_kimpanel_extension() {
    [ -d "$KIMPANEL_EXTENSION_DIR" ] || return 0
    command -v gsettings >/dev/null 2>&1 || return 0
    gsettings list-schemas 2>/dev/null | grep -qx "org.gnome.shell" || return 0

    local current=""
    local updated=""
    current="$(gsettings_for_real_user get org.gnome.shell enabled-extensions 2>/dev/null)"
    if [ -z "$current" ]; then
        print_warning_from_common_functions "Could not read GNOME enabled-extensions for $REAL_USER (no session bus?); enable kimpanel after re-login"
        return 0
    fi
    case "$current" in
        *"$KIMPANEL_EXTENSION_UUID"*)
            print_info_from_common_functions "GNOME kimpanel extension already enabled"
            return 0
            ;;
    esac
    if [ "$current" = "@as []" ]; then
        updated="['$KIMPANEL_EXTENSION_UUID']"
    else
        updated="${current%]}, '$KIMPANEL_EXTENSION_UUID']"
    fi
    if gsettings_for_real_user set org.gnome.shell enabled-extensions "$updated" >/dev/null 2>&1; then
        print_success_from_common_functions "GNOME kimpanel extension enabled (fcitx5 top-bar icon; active after next login)"
    else
        print_warning_from_common_functions "Could not enable kimpanel now; enable it in GNOME Extensions or after re-login"
    fi
}

# Register the Wubi engine in GNOME's input-source list (the visible keyboard
# switcher, Super+Space). preload-engines alone only warms the engine cache -
# without a sources entry the user must add Wubi by hand in Settings. Idempotent:
# the engine tuple is appended only when absent. Non-GNOME sessions (Kali Xfce,
# KDE, headless) lack the schema, so every step fails soft.
add_ibus_engine_to_gnome_sources() {
    command -v gsettings >/dev/null 2>&1 || return 0
    local engine_name="${IBUS_ENGINE#table:}"
    local current updated
    current="$(run_as_real_user gsettings get org.gnome.desktop.input-sources sources 2>/dev/null)"
    [ -n "$current" ] || return 0
    case "$current" in
        *"ibus', '${engine_name}'"*) return 0 ;;
    esac
    if [ "$current" = "@as []" ]; then
        updated="[('xkb', 'us'), ('ibus', '${engine_name}')]"
    else
        updated="${current%]}, ('ibus', '${engine_name}')]"
    fi
    if run_as_real_user gsettings set org.gnome.desktop.input-sources sources "$updated" >/dev/null 2>&1; then
        print_success_from_common_functions "GNOME input sources now include Wubi ($engine_name)"
    else
        print_info_from_common_functions "GNOME input sources unchanged (add Wubi in Settings > Keyboard if desired)"
    fi
}

enable_ibus_wubi() {
    print_step_from_common_functions "Enabling IBus Wubi engine ($IBUS_ENGINE) for $REAL_USER..."
    # Regenerate the engine registry so the freshly installed table is visible.
    run_as_real_user ibus write-cache >/dev/null 2>&1 || true
    if command -v gsettings >/dev/null 2>&1; then
        if run_as_real_user gsettings set org.freedesktop.ibus.general preload-engines \
            "['xkb:us::eng', '$IBUS_ENGINE']" >/dev/null 2>&1; then
            print_success_from_common_functions "Preloaded IBus engines incl. $IBUS_ENGINE"
            run_as_real_user ibus engine "$IBUS_ENGINE" >/dev/null 2>&1 || true
        else
            print_warning_from_common_functions "Could not preload the engine now (no active session?); add it via ibus-setup"
        fi
    fi
    add_ibus_engine_to_gnome_sources
}

# Install Chinese language support: a CJK font + the zh_CN.UTF-8 locale. The IME
# packages (fcitx5-chinese-addons / ibus) pull NO CJK font, so without this Chinese
# renders as tofu (boxes) even though typing works; a missing zh_CN locale also makes
# some terminals refuse the IME. Idempotent: apt skips installed packages, every
# optional package is availability-filtered, the locale block is a no-op once
# generated, and the system default LANG is left untouched.
install_language_support() {
    local fonts optional
    print_step_from_common_functions "Installing Chinese language support (CJK fonts + locale)..."

    # fonts-noto-cjk = universal CJK font (Simplified + Traditional), present on
    # every Debian/Ubuntu/Kali target; `locales` provides /etc/locale.gen + locale-gen.
    fonts=$(filter_available "fonts-noto-cjk" "locales")
    if [ -n "$fonts" ]; then
        # shellcheck disable=SC2086
        apt_install $fonts
    fi
    # Optional, availability-gated: extra Noto weights + WenQuanYi fallback, and the
    # Ubuntu-only localized-UI packs (auto-skipped on Debian/Kali where they do not exist).
    optional=$(filter_available "fonts-noto-cjk-extra" "fonts-wqy-zenhei" "fonts-wqy-microhei" "language-pack-zh-hans" "language-pack-gnome-zh-hans")
    if [ -n "$optional" ]; then
        # shellcheck disable=SC2086
        apt_install $optional
    fi
    # Rebuild the font cache so the newly installed CJK font is picked up.
    command -v fc-cache >/dev/null 2>&1 && $USE_SUDO fc-cache -f >/dev/null 2>&1 || true

    # Make zh_CN.UTF-8 AVAILABLE (cross-distro: uncomment in /etc/locale.gen + regen).
    # Input works under any UTF-8 locale, so this only ADDS zh_CN.UTF-8 - it never
    # runs update-locale / changes the system default LANG.
    if locale -a 2>/dev/null | grep -qiE "^zh_CN\.utf-?8$"; then
        print_info_from_common_functions "zh_CN.UTF-8 locale already available"
    elif [ -f /etc/locale.gen ] && command -v locale-gen >/dev/null 2>&1; then
        if grep -qE "^#?[[:space:]]*zh_CN\.UTF-8[[:space:]]+UTF-8" /etc/locale.gen; then
            $USE_SUDO sed -i 's/^#[[:space:]]*\(zh_CN\.UTF-8[[:space:]]\+UTF-8\)/\1/' /etc/locale.gen
        else
            echo "zh_CN.UTF-8 UTF-8" | $USE_SUDO tee -a /etc/locale.gen >/dev/null
        fi
        $USE_SUDO locale-gen >/dev/null 2>&1 || true
        print_success_from_common_functions "zh_CN.UTF-8 locale generated (system default LANG unchanged)"
    else
        print_warning_from_common_functions "locale-gen/locale.gen unavailable; skipped locale generation"
    fi
}

main() {
    print_step_from_common_functions "Starting $APP_NAME installation..."
    print_info_from_common_functions "Distro: ${OS_NAME:-unknown} ${OS_VERSION_ID:-} (ID=${OS_ID:-?})"
    print_info_from_common_functions "Real user: $REAL_USER (home: $REAL_USER_HOME)"
    echo ""

    choose_framework

    if [ "$FRAMEWORK" = "fcitx5" ]; then
        install_fcitx5
    else
        install_ibus
    fi

    set_default_im
    write_env_vars

    if [ "$FRAMEWORK" = "fcitx5" ]; then
        enable_fcitx5_wubi
        enable_gnome_kimpanel_extension
    else
        enable_ibus_wubi
    fi

    install_language_support

    # Electron/GTK apps (Cursor, VS Code, Chrome) need explicit GTK + Wayland IME
    # bridges; idempotent, also invoked from 155_install_cursor.sh.
    print_step_from_common_functions "Configuring Electron app IME compatibility (Cursor/VS Code)..."
    deic_ensure_electron_ime_compat "$REAL_USER" "$REAL_USER_HOME" "$FRAMEWORK"
    print_success_from_common_functions "Electron IME compatibility configured for $REAL_USER"

    # Re-bake the Cursor launcher's IME env so it tracks the now-active framework.
    # Cursor is the only Electron app here that bakes IME env into its wrapper; VS
    # Code/Chrome read flags/GTK dynamically (handled by deic_ above). Idempotent and
    # a no-op when Cursor is not installed, so every Wubi re-run stays safe.
    if [ -f /usr/share/applications/cursor.desktop ] || [ -L /usr/local/bin/cursor ]; then
        print_step_from_common_functions "Refreshing Cursor launcher IME bridge..."
        bash "$SCRIPT_CURRENT_DIR/155_install_cursor.sh" refresh || true
    fi

    echo ""
    print_success_from_common_functions "=========================================="
    print_success_from_common_functions "$APP_NAME Installation Completed"
    print_success_from_common_functions "=========================================="
    echo ""
    print_info_from_common_functions "Framework : $FRAMEWORK"
    if [ "$FRAMEWORK" = "fcitx5" ]; then
        print_info_from_common_functions "Wubi IME  : $WUBI_IM"
        print_info_from_common_functions "Configure : fcitx5-configtool (add/adjust Wubi if needed)"
        print_info_from_common_functions "GNOME     : kimpanel extension enabled (fcitx5 top-bar icon)"
    else
        print_info_from_common_functions "Wubi engine: $IBUS_ENGINE"
        print_info_from_common_functions "Configure  : ibus-setup (add Wubi under Input Method if needed)"
    fi
    echo ""
    print_info_from_common_functions "Language  : fonts-noto-cjk (CJK font) + zh_CN.UTF-8 locale installed"
    print_warning_from_common_functions "Log out and back in for the input method to take effect."
    print_info_from_common_functions "Toggle the IME with the framework hotkey (default: Ctrl+Space)."
    print_info_from_common_functions "Cursor/VS Code: ~/.config/cursor-flags.conf + GTK_IM_MODULE are configured."
    echo ""
}

main
