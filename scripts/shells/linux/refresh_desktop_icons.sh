#!/bin/bash
# Refresh Desktop Icons and Caches
# This script clears icon and desktop caches to force refresh

echo "=== Refreshing Desktop Icons and Caches ==="
echo ""

# Detect desktop user
DESKTOP_USER="${SUDO_USER:-$USER}"
DESKTOP_HOME="$(getent passwd "$DESKTOP_USER" 2>/dev/null | cut -d: -f6)"
if [[ -z "$DESKTOP_HOME" ]] || [[ ! -d "$DESKTOP_HOME" ]]; then
    DESKTOP_HOME="$HOME"
fi

echo "Desktop user: $DESKTOP_USER"
echo "Desktop home: $DESKTOP_HOME"
echo ""

# Update desktop database
echo ">>> Updating desktop databases..."
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$DESKTOP_HOME/.local/share/applications" 2>/dev/null
    sudo update-desktop-database /usr/share/applications 2>/dev/null
    echo "  ✓ Desktop database updated"
else
    echo "  ⚠ update-desktop-database not found"
fi

# Clear GTK icon cache
echo ">>> Clearing GTK icon caches..."
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    # System icon themes
    for icon_theme in /usr/share/icons/hicolor /usr/share/icons/Yaru /usr/share/icons/gnome; do
        if [[ -d "$icon_theme" ]]; then
            echo "  - Updating $icon_theme..."
            sudo gtk-update-icon-cache -f -t "$icon_theme" 2>/dev/null
        fi
    done

    # User icon themes
    if [[ -d "$DESKTOP_HOME/.local/share/icons" ]]; then
        for icon_theme in "$DESKTOP_HOME/.local/share/icons"/*; do
            if [[ -d "$icon_theme" ]]; then
                echo "  - Updating $(basename "$icon_theme")..."
                gtk-update-icon-cache -f -t "$icon_theme" 2>/dev/null
            fi
        done
    fi
    echo "  ✓ Icon cache updated"
else
    echo "  ⚠ gtk-update-icon-cache not found"
fi

# Update MIME database
echo ">>> Updating MIME database..."
if command -v update-mime-database >/dev/null 2>&1; then
    update-mime-database "$DESKTOP_HOME/.local/share/applications" 2>/dev/null
    echo "  ✓ MIME database updated"
else
    echo "  ⚠ update-mime-database not found"
fi

# Check desktop environment and provide instructions
echo ""
echo ">>> Desktop Environment Detection"
if pgrep -x gnome-shell >/dev/null 2>&1; then
    echo "  GNOME Shell detected"
    echo ""
    echo "To apply changes immediately:"
    echo "  1. Press Alt+F2"
    echo "  2. Type 'r' and press Enter"
    echo "  3. Or log out and log back in"
elif pgrep -x plasmashell >/dev/null 2>&1; then
    echo "  KDE Plasma detected"
    echo ""
    echo "To apply changes immediately:"
    echo "  - Right-click desktop > Refresh Desktop"
    echo "  - Or restart plasmashell: killall plasmashell && plasmashell &"
elif pgrep -x xfce4-panel >/dev/null 2>&1; then
    echo "  XFCE detected"
    echo ""
    echo "To apply changes:"
    echo "  - Log out and log back in"
else
    echo "  Unknown desktop environment"
    echo "  - Try logging out and logging back in"
fi

echo ""
echo "=== Cache refresh completed ==="
