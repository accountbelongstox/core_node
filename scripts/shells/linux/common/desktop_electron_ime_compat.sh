#!/bin/bash
# desktop_electron_ime_compat.sh - shared IME bridge for Electron/GTK apps
# (Cursor, VS Code, Chrome, etc.) on Debian/Ubuntu/Kali.
#
# Problem: Chromium/Electron apps often ignore system IME unless GTK_IM_MODULE and
# (on Wayland) --enable-wayland-ime are set explicitly. VS Code/Cursor docs and
# fcitx5 wiki recommend:
#   - GTK_IM_MODULE=fcitx (module id is "fcitx" even for fcitx5)
#   - ~/.config/gtk-3.0/settings.ini  -> gtk-im-module=fcitx
#   - ~/.gtkrc-2.0                    -> gtk-im-module = "fcitx"
#   - ~/.config/cursor-flags.conf     -> --enable-wayland-ime (Wayland)
#
# Idempotent: managed blocks are replaced in place; safe to call from both
# 173_install_chinese_wubi.sh and 155_install_cursor.sh (order-independent).
#
# Usage (source first):
#   source desktop_electron_ime_compat.sh
#   deic_ensure_electron_ime_compat "$user" "$home" [fcitx5|ibus]
#   deic_launcher_env_exports fcitx5
#   deic_pkexec_env_string fcitx5

DEIC_MARK_BEGIN="# >>> core_node electron-ime (managed) >>>"
DEIC_MARK_END="# <<< core_node electron-ime (managed) <<<"
DEIC_DBUS_ALLOW_ROOT_CONF="/etc/dbus-1/session.d/99-corenode-allow-root.conf"
DEIC_CURSOR_FLAGS=(
    "--ozone-platform-hint=auto"
    "--enable-wayland-ime"
    "--wayland-text-input-version=3"
)
DEIC_CODE_FLAGS=(
    "--ozone-platform-hint=auto"
    "--enable-wayland-ime"
    "--wayland-text-input-version=3"
)

deic_gtk_module_for_framework() {
    case "${1:-}" in
        fcitx5|fcitx) printf '%s' "fcitx" ;;
        ibus)         printf '%s' "ibus" ;;
        *)            printf '%s' "fcitx" ;;
    esac
}

deic_detect_im_framework() {
    local fw=""
    if [ -r /etc/environment ]; then
        if grep -q 'GTK_IM_MODULE=fcitx' /etc/environment 2>/dev/null; then
            fw="fcitx5"
        elif grep -q 'GTK_IM_MODULE=ibus' /etc/environment 2>/dev/null; then
            fw="ibus"
        fi
    fi
    if [ -z "$fw" ] && command -v im-config >/dev/null 2>&1; then
        fw="$(im-config -m 2>/dev/null | head -1 | tr -d '[:space:]')"
    fi
    if [ -z "$fw" ]; then
        if command -v fcitx5 >/dev/null 2>&1 || [ -d /usr/share/fcitx5 ]; then
            fw="fcitx5"
        elif command -v ibus-daemon >/dev/null 2>&1; then
            fw="ibus"
        else
            fw="fcitx5"
        fi
    fi
    printf '%s' "$fw"
}

deic_launcher_env_exports() {
    local fw="${1:-$(deic_detect_im_framework)}"
    local gtk_mod
    gtk_mod="$(deic_gtk_module_for_framework "$fw")"
    if [ "$fw" = "ibus" ]; then
        printf 'export GTK_IM_MODULE=%s\n' "$gtk_mod"
        printf 'export QT_IM_MODULE=%s\n' "$gtk_mod"
        printf 'export XMODIFIERS=@im=%s\n' "$gtk_mod"
        printf 'export CLUTTER_IM_MODULE=%s\n' "$gtk_mod"
    else
        printf 'export GTK_IM_MODULE=%s\n' "$gtk_mod"
        printf 'export QT_IM_MODULE=%s\n' "$gtk_mod"
        printf 'export XMODIFIERS=@im=%s\n' "$gtk_mod"
        printf 'export SDL_IM_MODULE=%s\n' "$gtk_mod"
        printf 'export CLUTTER_IM_MODULE=xim\n'
    fi
    printf 'export ELECTRON_OZONE_PLATFORM_HINT=auto\n'
}

deic_pkexec_env_string() {
    local fw="${1:-$(deic_detect_im_framework)}"
    local gtk_mod
    gtk_mod="$(deic_gtk_module_for_framework "$fw")"
    if [ "$fw" = "ibus" ]; then
        printf 'GTK_IM_MODULE=%s QT_IM_MODULE=%s XMODIFIERS=@im=%s CLUTTER_IM_MODULE=%s ELECTRON_OZONE_PLATFORM_HINT=auto' \
            "$gtk_mod" "$gtk_mod" "$gtk_mod" "$gtk_mod"
    else
        printf 'GTK_IM_MODULE=%s QT_IM_MODULE=%s XMODIFIERS=@im=%s SDL_IM_MODULE=%s CLUTTER_IM_MODULE=xim ELECTRON_OZONE_PLATFORM_HINT=auto' \
            "$gtk_mod" "$gtk_mod" "$gtk_mod" "$gtk_mod"
    fi
}

deic_ensure_dbus_root_access() {
    local dbus_dir="/etc/dbus-1/session.d"
    local conf_file="$DEIC_DBUS_ALLOW_ROOT_CONF"
    local sudo_cmd=""
    [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && sudo_cmd="sudo"

    $sudo_cmd mkdir -p "$dbus_dir" 2>/dev/null || true
    if [ ! -f "$conf_file" ] || ! grep -q '<allow user="root"/>' "$conf_file" 2>/dev/null; then
        $sudo_cmd tee "$conf_file" >/dev/null <<'EOF'
<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <policy context="mandatory">
    <allow user="root"/>
  </policy>
</busconfig>
EOF
        $sudo_cmd pkill -HUP -f 'dbus-daemon.*--session' 2>/dev/null || true
    fi
    return 0
}

deic_ensure_fcitx5_root_profile() {
    local source_profile="${1:-}"
    local root_fcitx5_dir="/root/.config/fcitx5"
    local root_profile="$root_fcitx5_dir/profile"
    local wubi_im="${2:-wubi-large}"

    mkdir -p "$root_fcitx5_dir" 2>/dev/null || true
    if [ -n "$source_profile" ] && [ -f "$source_profile" ]; then
        cp -f "$source_profile" "$root_profile" 2>/dev/null || true
    elif [ ! -f "$root_profile" ]; then
        cat > "$root_profile" <<EOF
[Groups/0]
Name=Default
Default Layout=us
DefaultIM=$wubi_im

[Groups/0/Items/0]
Name=keyboard-us
Layout=

[Groups/0/Items/1]
Name=$wubi_im
Layout=

[GroupOrder]
0=Default
EOF
    fi
}

deic_write_flags_file() {
    local file="$1"
    shift
    local flags=("$@")
    local flag line tmp
    [ -n "$file" ] || return 0
    mkdir -p "$(dirname "$file")" 2>/dev/null || true
    tmp="$(mktemp 2>/dev/null || echo "/tmp/deic_flags_$$")"
    if [ -f "$file" ]; then
        grep -vF "$DEIC_MARK_BEGIN" "$file" 2>/dev/null | grep -vF "$DEIC_MARK_END" > "$tmp" || true
        while IFS= read -r line; do
            case "$line" in
                "# >>> core_node electron-ime"*|"# <<< core_node electron-ime"*) continue ;;
                "--ozone-platform-hint=auto"|"--enable-wayland-ime"|"--wayland-text-input-version=3") continue ;;
            esac
            printf '%s\n' "$line"
        done < "$tmp" > "${tmp}.body"
        mv "${tmp}.body" "$tmp"
    else
        : > "$tmp"
    fi
    {
        cat "$tmp"
        echo "$DEIC_MARK_BEGIN"
        for flag in "${flags[@]}"; do
            echo "$flag"
        done
        echo "$DEIC_MARK_END"
    } > "$file"
    rm -f "$tmp"
}

deic_ensure_gtk_user_config() {
    local user="$1"
    local home="$2"
    local gtk_mod="$3"
    local gtk3_dir="$home/.config/gtk-3.0"
    local gtk3_ini="$gtk3_dir/settings.ini"
    local gtk2_rc="$home/.gtkrc-2.0"
    local sudo_cmd=""

    [ -n "$home" ] && [ -d "$home" ] || return 0
    if [ "$(id -u)" -eq 0 ] && [ -n "$user" ] && [ "$(id -un)" != "$user" ]; then
        sudo_cmd="sudo -u $user"
    fi

    mkdir -p "$gtk3_dir" 2>/dev/null || $sudo_cmd mkdir -p "$gtk3_dir" 2>/dev/null || true
    if [ -f "$gtk3_ini" ]; then
        if grep -q '^gtk-im-module=' "$gtk3_ini" 2>/dev/null; then
            sed -i "s/^gtk-im-module=.*/gtk-im-module=$gtk_mod/" "$gtk3_ini" 2>/dev/null \
                || $sudo_cmd sed -i "s/^gtk-im-module=.*/gtk-im-module=$gtk_mod/" "$gtk3_ini" 2>/dev/null || true
        elif grep -q '^\[Settings\]' "$gtk3_ini" 2>/dev/null; then
            sed -i "/^\[Settings\]/a gtk-im-module=$gtk_mod" "$gtk3_ini" 2>/dev/null \
                || $sudo_cmd sed -i "/^\[Settings\]/a gtk-im-module=$gtk_mod" "$gtk3_ini" 2>/dev/null || true
        else
            $sudo_cmd tee "$gtk3_ini" >/dev/null <<EOF
[Settings]
gtk-im-module=$gtk_mod
EOF
        fi
    else
        $sudo_cmd tee "$gtk3_ini" >/dev/null <<EOF
[Settings]
gtk-im-module=$gtk_mod
EOF
    fi

    if [ -f "$gtk2_rc" ] && grep -q 'gtk-im-module' "$gtk2_rc" 2>/dev/null; then
        sed -i "s/^gtk-im-module.*/gtk-im-module = \"$gtk_mod\"/" "$gtk2_rc" 2>/dev/null \
            || $sudo_cmd sed -i "s/^gtk-im-module.*/gtk-im-module = \"$gtk_mod\"/" "$gtk2_rc" 2>/dev/null || true
    else
        $sudo_cmd tee -a "$gtk2_rc" >/dev/null <<EOF
gtk-im-module = "$gtk_mod"
EOF
    fi

    if [ "$(id -u)" -eq 0 ] && [ -n "$user" ]; then
        chown "$user:$(id -gn "$user" 2>/dev/null || echo "$user")" "$gtk3_ini" "$gtk2_rc" 2>/dev/null || true
        chown -R "$user:$(id -gn "$user" 2>/dev/null || echo "$user")" "$gtk3_dir" 2>/dev/null || true
    fi
}

deic_ensure_electron_ime_compat() {
    local user="${1:-}"
    local home="${2:-}"
    local fw="${3:-}"
    local gtk_mod=""
    local config_dir=""
    local root_config_dir="/root/.config"

    [ -z "$fw" ] && fw="$(deic_detect_im_framework)"
    gtk_mod="$(deic_gtk_module_for_framework "$fw")"

    # Always ensure root D-Bus session bus authorization for client IME connection
    deic_ensure_dbus_root_access

    if [ -n "$home" ] && [ -d "$home" ]; then
        deic_ensure_gtk_user_config "$user" "$home" "$gtk_mod"

        config_dir="$home/.config"
        mkdir -p "$config_dir" 2>/dev/null || true
        deic_write_flags_file "$config_dir/cursor-flags.conf" "${DEIC_CURSOR_FLAGS[@]}"
        deic_write_flags_file "$config_dir/code-flags.conf" "${DEIC_CODE_FLAGS[@]}"

        if [ "$(id -u)" -eq 0 ] && [ -n "$user" ]; then
            chown -R "$user:$(id -gn "$user" 2>/dev/null || echo "$user")" \
                "$config_dir/cursor-flags.conf" "$config_dir/code-flags.conf" 2>/dev/null || true
        fi
    fi

    # Also configure /root when running as root so root-elevated IDEs have identical IME configuration
    if [ "$(id -u)" -eq 0 ] && [ -d "/root" ]; then
        deic_ensure_gtk_user_config "root" "/root" "$gtk_mod"
        mkdir -p "$root_config_dir" 2>/dev/null || true
        deic_write_flags_file "$root_config_dir/cursor-flags.conf" "${DEIC_CURSOR_FLAGS[@]}"
        deic_write_flags_file "$root_config_dir/code-flags.conf" "${DEIC_CODE_FLAGS[@]}"
        if [ "$fw" = "fcitx5" ]; then
            deic_ensure_fcitx5_root_profile "$home/.config/fcitx5/profile"
        fi
    fi

    return 0
}
