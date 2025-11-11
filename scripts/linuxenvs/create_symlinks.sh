#!/bin/bash
# Auto-generated script to create symlinks for Linux environment scripts
# This script should be run on Linux to create symlinks in /usr/local/bin

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Creating symlinks in /usr/local/bin..."
echo ""

# Check if we need sudo
if [ -w /usr/local/bin ]; then
    USE_SUDO=""
else
    USE_SUDO="sudo"
fi

# Link claude1
$USE_SUDO chmod +x "$SCRIPT_DIR/claude1.sh"
$USE_SUDO ln -sf "$SCRIPT_DIR/claude1.sh" /usr/local/bin/claude1
echo "[LINK] claude1 -> $SCRIPT_DIR/claude1.sh"

# Link claude2
$USE_SUDO chmod +x "$SCRIPT_DIR/claude2.sh"
$USE_SUDO ln -sf "$SCRIPT_DIR/claude2.sh" /usr/local/bin/claude2
echo "[LINK] claude2 -> $SCRIPT_DIR/claude2.sh"

# Link claude3
$USE_SUDO chmod +x "$SCRIPT_DIR/claude3.sh"
$USE_SUDO ln -sf "$SCRIPT_DIR/claude3.sh" /usr/local/bin/claude3
echo "[LINK] claude3 -> $SCRIPT_DIR/claude3.sh"

# Link claude4
$USE_SUDO chmod +x "$SCRIPT_DIR/claude4.sh"
$USE_SUDO ln -sf "$SCRIPT_DIR/claude4.sh" /usr/local/bin/claude4
echo "[LINK] claude4 -> $SCRIPT_DIR/claude4.sh"

# Link claude5
$USE_SUDO chmod +x "$SCRIPT_DIR/claude5.sh"
$USE_SUDO ln -sf "$SCRIPT_DIR/claude5.sh" /usr/local/bin/claude5
echo "[LINK] claude5 -> $SCRIPT_DIR/claude5.sh"

# Link claude6
$USE_SUDO chmod +x "$SCRIPT_DIR/claude6.sh"
$USE_SUDO ln -sf "$SCRIPT_DIR/claude6.sh" /usr/local/bin/claude6
echo "[LINK] claude6 -> $SCRIPT_DIR/claude6.sh"

# Link codex1
$USE_SUDO chmod +x "$SCRIPT_DIR/codex1.sh"
$USE_SUDO ln -sf "$SCRIPT_DIR/codex1.sh" /usr/local/bin/codex1
echo "[LINK] codex1 -> $SCRIPT_DIR/codex1.sh"

# Link ssh1
$USE_SUDO chmod +x "$SCRIPT_DIR/ssh1.sh"
$USE_SUDO ln -sf "$SCRIPT_DIR/ssh1.sh" /usr/local/bin/ssh1
echo "[LINK] ssh1 -> $SCRIPT_DIR/ssh1.sh"

echo ""
echo "Symlinks created successfully!"
echo "You can now run these commands from anywhere:"

echo "  claude1"
echo "  claude2"
echo "  claude3"
echo "  claude4"
echo "  claude5"
echo "  claude6"
echo "  codex1"
echo "  ssh1"
