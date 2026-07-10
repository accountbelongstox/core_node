#!/bin/bash
# desktop_electron_ime_compat.sh — shared IME bridge for Electron/GTK apps
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
# 131_install_chinese_wubi.sh and 122_install_cursor.sh (order-independent).
#
# Usage (source first):
#   source desktop_electron_ime_compat.sh
#   deic_ensure_electron_ime_compat "$user" "$home" [fcitx5|ibus]
#   deic_launcher_env_exports fcitx5
#   deic_pkexec_env_string fcitx5

DEIC_MARK_BEGIN="# >>> core_node electron-ime (managed) >>>"
DEIC_MARK_END="# <<< core_node electron-ime (managed) <<<"
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
}

deic_pkexec_env_string() {
    local fw="${1:-$(deic_detect_im_framework)}"
    local gtk_mod
    gtk_mod="$(deic_gtk_module_for_framework "$fw")"
    if [ "$fw" = "ibus" ]; then
        printf 'GTK_IM_MODULE=%s QT_IM_MODULE=%s XMODIFIERS=@im=%s CLUTTER_IM_MODULE=%s' \
            "$gtk_mod" "$gtk_mod" "$gtk_mod" "$gtk_mod"
    else
        printf 'GTK_IM_MODULE=%s QT_IM_MODULE=%s XMODIFIERS=@im=%s SDL_IM_MODULE=%s CLUTTER_IM_MODULE=xim' \
            "$gtk_mod" "$gtk_mod" "$gtk_mod" "$gtk_mod"
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

    [ -z "$fw" ] && fw="$(deic_detect_im_framework)"
    gtk_mod="$(deic_gtk_module_for_framework "$fw")"

    if [ -z "$home" ] || [ ! -d "$home" ]; then
        return 0
    fi

    deic_ensure_gtk_user_config "$user" "$home" "$gtk_mod"

    config_dir="$home/.config"
    mkdir -p "$config_dir" 2>/dev/null || true
    deic_write_flags_file "$config_dir/cursor-flags.conf" "${DEIC_CURSOR_FLAGS[@]}"
    deic_write_flags_file "$config_dir/code-flags.conf" "${DEIC_CODE_FLAGS[@]}"

    if [ "$(id -u)" -eq 0 ] && [ -n "$user" ]; then
        chown -R "$user:$(id -gn "$user" 2>/dev/null || echo "$user")" \
            "$config_dir/cursor-flags.conf" "$config_dir/code-flags.conf" 2>/dev/null || true
    fi
    return 0
}
