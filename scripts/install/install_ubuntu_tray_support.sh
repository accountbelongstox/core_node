#!/bin/bash
# Ubuntu System Tray Support Installer
# Installs required packages for native AppIndicator3 support on Ubuntu 22.04+

set -e  # Exit on error

echo "=============================================="
echo " Ubuntu System Tray Support Installer"
echo "=============================================="
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "‚ù?This script is for Linux only"
    exit 1
fi

# Check if running Ubuntu/Debian
if ! command -v apt-get &> /dev/null; then
    echo "‚ö†Ô∏è  Warning: apt-get not found. This script is designed for Ubuntu/Debian"
    echo "   You may need to adapt the commands for your distribution"
    exit 1
fi

echo "üì¶ Installing system packages..."
echo ""

# Update package list
echo "‚Ü?Updating package list..."
sudo apt-get update

# Install GTK3 and AppIndicator3
echo ""
echo "‚Ü?Installing python3-gi and AppIndicator3..."
sudo apt-get install -y python3-gi gir1.2-appindicator3-0.1

# Install development libraries (needed for pip install PyGObject)
echo ""
echo "‚Ü?Installing development libraries..."
sudo apt-get install -y \
    libgirepository1.0-dev \
    libcairo2-dev \
    python3-dev \
    build-essential

# Install GNOME Shell Extension (if GNOME detected)
echo ""
if [[ "$XDG_CURRENT_DESKTOP" == *"GNOME"* ]] || [[ "$XDG_CURRENT_DESKTOP" == *"ubuntu"* ]]; then
    echo "‚ú?GNOME Shell detected"
    echo "‚Ü?Installing GNOME Shell AppIndicator extension..."
    sudo apt-get install -y gnome-shell-extension-appindicator

    echo ""
    echo "‚Ü?Enabling AppIndicator extension..."
    if command -v gnome-extensions &> /dev/null; then
        gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com 2>/dev/null || true
        echo "‚ú?Extension enabled"
    else
        echo "‚ö†Ô∏è  gnome-extensions command not found"
        echo "   You may need to enable the extension manually:"
        echo "   1. Open GNOME Extensions app"
        echo "   2. Enable 'AppIndicator and KStatusNotifierItem Support'"
    fi
else
    echo "‚ÑπÔ∏è  GNOME Shell not detected, skipping extension install"
    echo "   Current desktop: $XDG_CURRENT_DESKTOP"
fi

echo ""
echo "=============================================="
echo " Installation Complete"
echo "=============================================="
echo ""

# Verify installation
echo "üìã Verification:"
echo ""

# Check python3-gi
if python3 -c "import gi" 2>/dev/null; then
    echo "‚ú?python3-gi installed"
else
    echo "‚ú?python3-gi NOT available"
fi

# Check AppIndicator3
if python3 -c "import gi; gi.require_version('AppIndicator3', '0.1'); from gi.repository import AppIndicator3" 2>/dev/null; then
    echo "‚ú?AppIndicator3 available"
else
    echo "‚ú?AppIndicator3 NOT available"
fi

# Check GNOME extension (if GNOME)
if [[ "$XDG_CURRENT_DESKTOP" == *"GNOME"* ]] || [[ "$XDG_CURRENT_DESKTOP" == *"ubuntu"* ]]; then
    if command -v gnome-extensions &> /dev/null; then
        if gnome-extensions list 2>/dev/null | grep -q "appindicator"; then
            echo "‚ú?AppIndicator extension installed"
        else
            echo "‚ö†Ô∏è  AppIndicator extension NOT found"
        fi
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
echo "   python3 pycore/pyutils/native_ui/step6_tray/appindicator_system_tray.py"
echo ""
echo "4. Or install Python packages:"
echo "   pip install -r requirements_linux.txt"
echo ""

# Ask if user wants to restart GNOME Shell (X11 only)
if [[ "$XDG_SESSION_TYPE" == "x11" ]]; then
    echo ""
    read -p "Restart GNOME Shell now? (X11 only) [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "‚Ü?Restarting GNOME Shell..."
        busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'global.reexec_self()'
    fi
else
    echo "‚ö†Ô∏è  You're using Wayland. Please log out and log back in for changes to take effect"
fi

echo ""
echo "‚ú?Done!"
