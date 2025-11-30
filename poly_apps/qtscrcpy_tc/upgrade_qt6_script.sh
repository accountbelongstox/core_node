#!/bin/bash
# Qt 6.9 Upgrade Script for qtscrcpy_tc project
# This script updates all .pro files to Qt6 standards

echo "Starting Qt 6.9 upgrade for qtscrcpy_tc project..."

# Find all .pro files in the test directory
find ./test -name "*.pro" -type f | while read -r file; do
    echo "Processing: $file"

    # Backup original file
    cp "$file" "$file.qt5_backup"

    # 1. Remove greaterThan(QT_MAJOR_VERSION, 4) checks and directly add widgets
    sed -i '/greaterThan(QT_MAJOR_VERSION, 4):/d' "$file"

    # 2. If QT += core gui exists, add widgets module
    if grep -q "^QT.*+=.*core.*gui" "$file"; then
        sed -i 's/^QT\(.*\)+=\(.*\)core\(.*\)gui$/QT\1+=\2core\3gui widgets/' "$file"
    fi

    # 3. Change CONFIG += c++11 to CONFIG += c++17
    sed -i 's/CONFIG += c++11/CONFIG += c++17/g' "$file"

    # 4. Add Qt6 deprecated API disabling if not present
    if ! grep -q "QT_DISABLE_DEPRECATED_BEFORE" "$file"; then
        # Find the line with CONFIG and add after it
        sed -i '/^CONFIG += c++17/a\\n# Disable deprecated APIs before Qt 6.0.0\nDEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x060000' "$file"
    fi

    echo "  - Updated: $file"
done

echo ""
echo "Upgrade complete!"
echo "Note: Original files backed up with .qt5_backup extension"
echo ""
echo "Manual steps still required:"
echo "1. Review and test each updated .pro file"
echo "2. Update source code if needed (QRegExp, QString::SkipEmptyParts, etc.)"
echo "3. Check for usage of deprecated Qt5 APIs"
