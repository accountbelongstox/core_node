#!/bin/bash
# Ubuntu/Debian System Tray Support Installer
# Installs required packages for native AppIndicator3 support.
#
# Platform notes (official package archives):
# - Debian 13 (trixie, GNOME 48, Wayland default): only the Ayatana binding
#   exists (gir1.2-ayatanaappindicator3-0.1; legacy gir1.2-appindicator3-0.1 was
#   dropped from Debian). GNOME Shell shows NO tray icons without
#   gnome-shell-extension-appindicator (trixie main; shell UUID
#   ubuntu-appindicators@ubuntu.com). Enabling takes effect on the NEXT login.
# - Ubuntu 26.04 (resolute, GNOME 50): gnome-shell-extension-appindicator is a
#   VIRTUAL package already provided by the default gnome-shell-ubuntu-extensions,
#   so tray works out of the box.

set -e  # Exit on error

echo "=============================================="
echo " Ubuntu/Debian System Tray Support Installer"
echo "=============================================="
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "This script is for Linux only"
    exit 1
fi

# Check if running Ubuntu/Debian
if ! command -v apt-get &> /dev/null; then
    echo "[WARN]  Warning: apt-get not found. This script is designed for Ubuntu/Debian"
    echo "   You may need to adapt the commands for your distribution"
    exit 1
fi

echo " Installing system packages..."
echo ""

# Update package list
echo "Updating package list..."
sudo apt-get update

# Install GTK3 bindings and the AppIndicator GIR. Modern Debian/Kali/Ubuntu
# ship the Ayatana fork; older Ubuntu used gir1.2-appindicator3-0.1. Pick
# whichever the apt index actually offers.
echo ""
echo "Installing python3-gi and AppIndicator3..."
APPIND_PKG=""
for cand in gir1.2-ayatanaappindicator3-0.1 gir1.2-appindicator3-0.1; do
    if apt-cache show "$cand" >/dev/null 2>&1; then
        APPIND_PKG="$cand"
        break
    fi
done
if [[ -z "$APPIND_PKG" ]]; then
    echo "[WARN]  No AppIndicator GIR package in apt index (system-tray icon optional)"
    sudo apt-get install -y python3-gi gir1.2-gtk-3.0
else
    sudo apt-get install -y python3-gi gir1.2-gtk-3.0 "$APPIND_PKG"
fi

# Install development libraries (needed for pip install PyGObject)
echo ""
echo "Installing development libraries..."
sudo apt-get install -y \
    libgirepository1.0-dev \
    libcairo2-dev \
    python3-dev \
    build-essential

# Install GNOME Shell Extension (if GNOME detected)
echo ""
if [[ "$XDG_CURRENT_DESKTOP" == *"GNOME"* ]] || [[ "$XDG_CURRENT_DESKTOP" == *"ubuntu"* ]] || dpkg -s gnome-shell >/dev/null 2>&1; then
    echo "GNOME Shell detected"
    echo "Installing GNOME Shell AppIndicator extension..."
    # Debian 13: real package in main. Ubuntu 26.04: virtual package provided by
    # gnome-shell-ubuntu-extensions (already installed -> no-op).
    if apt-cache policy gnome-shell-extension-appindicator 2>/dev/null | grep -qE 'Candidate: [^(]'; then
        sudo apt-get install -y gnome-shell-extension-appindicator
    else
        echo "[WARN]  gnome-shell-extension-appindicator not in apt index; skipping"
    fi

    echo ""
    echo "Enabling AppIndicator extension..."
    if command -v gnome-extensions &> /dev/null; then
        # Debian package UUID is ubuntu-appindicators@ubuntu.com; upstream/EGO
        # builds use appindicatorsupport@rgcjonas.gmail.com. Enable whichever exists.
        enabled=0
        for uuid in ubuntu-appindicators@ubuntu.com appindicatorsupport@rgcjonas.gmail.com; do
            if gnome-extensions enable "$uuid" 2>/dev/null; then
                echo "Extension enabled: $uuid"
                enabled=1
                break
            fi
        done
        if [[ "$enabled" -eq 0 ]]; then
            echo "[WARN]  Extension not visible to the running shell yet."
            echo "   It will activate automatically at the NEXT LOGIN (Wayland shells"
            echo "   cannot load newly installed extensions at runtime)."
        fi
    else
        echo "[WARN]  gnome-extensions command not found"
        echo "   You may need to enable the extension manually:"
        echo "   1. Open GNOME Extensions app"
        echo "   2. Enable 'AppIndicator and KStatusNotifierItem Support'"
    fi
else
    echo "i  GNOME Shell not detected, skipping extension install"
    echo "   Current desktop: $XDG_CURRENT_DESKTOP"
fi

echo ""
echo "=============================================="
echo " Installation Complete"
echo "=============================================="
echo ""

# Verify installation
echo " Verification:"
echo ""

# Check python3-gi
if python3 -c "import gi" 2>/dev/null; then
    echo "python3-gi installed"
else
    echo "python3-gi NOT available"
fi

# Check AppIndicator3 (Ayatana preferred, legacy fallback)
if python3 -c "import gi; gi.require_version('AyatanaAppIndicator3', '0.1'); from gi.repository import AyatanaAppIndicator3" 2>/dev/null; then
    echo "AyatanaAppIndicator3 available"
elif python3 -c "import gi; gi.require_version('AppIndicator3', '0.1'); from gi.repository import AppIndicator3" 2>/dev/null; then
    echo "AppIndicator3 (legacy) available"
else
    echo "AppIndicator3 NOT available"
fi

# Check GNOME extension (if GNOME)
if [[ "$XDG_CURRENT_DESKTOP" == *"GNOME"* ]] || [[ "$XDG_CURRENT_DESKTOP" == *"ubuntu"* ]] || dpkg -s gnome-shell >/dev/null 2>&1; then
    if dpkg -s gnome-shell-extension-appindicator >/dev/null 2>&1 || dpkg -s gnome-shell-ubuntu-extensions >/dev/null 2>&1; then
        echo "AppIndicator shell extension package installed"
    else
        echo "[WARN]  AppIndicator shell extension package NOT installed"
    fi
fi

echo ""
echo "=============================================="
echo " Next Steps"
echo "=============================================="
echo ""
echo "1. If you're using Wayland, log out and log back in"
echo "   (Extension activation requires session restart)"
echo ""
echo "2. If you're using X11, restart GNOME Shell:"
echo "   Alt+F2, type 'r', press Enter"
echo ""
echo "3. Test AppIndicator in Python:"
echo "   python3 -m pycore.pyutils.native_ui.step6_tray.appindicator_system_tray"
echo ""

echo ""
echo "Done!"
