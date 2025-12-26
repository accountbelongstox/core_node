#!/bin/bash
# Script to analyze pip install usage in all shell scripts
# Checks for:
# 1. Missing --break-system-packages flag
# 2. Missing --no-user flag (allows user directory installation)
# 3. pip install without sudo (may install to user directory)

echo "=================================="
echo "ANALYZING PIP INSTALL IN SCRIPTS"
echo "=================================="
echo ""

# Find all scripts with pip install
SCRIPTS=$(find /www/programing/core_node/scripts -name "*.sh" -type f -exec grep -l "pip.*install\|pip3.*install" {} \;)

echo "Found $(echo "$SCRIPTS" | wc -l) scripts using pip install"
echo ""

issue_count=0

for script in $SCRIPTS; do
    echo "Analyzing: $script"

    # Check for pip install without --break-system-packages
    if grep -n "pip.*install" "$script" | grep -v "\-\-break-system-packages" | grep -v "^#" | head -5; then
        echo "  [WARN] Missing --break-system-packages flag"
        ((issue_count++))
    fi

    # Check for pip install without --no-user
    if grep -n "pip.*install" "$script" | grep "\-\-break-system-packages" | grep -v "\-\-no-user" | grep -v "^#" | head -5; then
        echo "  [WARN] Missing --no-user flag (may install to user directory)"
        ((issue_count++))
    fi

    # Check for pip install without sudo
    if grep -n "pip.*install" "$script" | grep -v "sudo\|USE_SUDO\|\$USE_SUDO" | grep -v "^#" | head -3; then
        echo "  [WARN] pip install without sudo (will install to user directory)"
        ((issue_count++))
    fi

    echo ""
done

echo "=================================="
echo "ANALYSIS COMPLETE"
echo "=================================="
echo "Total issues found: $issue_count"
echo ""
echo "Scripts needing attention:"
echo "$SCRIPTS"
