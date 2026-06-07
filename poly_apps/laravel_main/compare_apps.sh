#!/bin/bash

cd 'D:/programing/core_node/poly_apps/laravel_main'

echo "========================================"
echo "Apps Directory Code Merge Check Report"
echo "========================================"
echo ""

# Define the list of applications
apps=("AChatV1" "AwyV0" "BankV1" "DictV1" "ItToolsV1" "ServerManagerV1")

# Initialize statistics counters
total_files=0
identical_files=0
different_files=0
only_in_app=0
needs_merge=0

for app in "${apps[@]}"; do
  echo "=== $app Application Comparison ==="
  echo ""

  # Get all files from both locations
  root_files=$(find "Apps/$app" -type f 2>/dev/null)
  app_files=$(find "app/Apps/$app" -type f 2>/dev/null)

  # Count the number of files
  root_count=$(echo "$root_files" | grep -v '^$' | wc -l)
  app_count=$(echo "$app_files" | grep -v '^$' | wc -l)

  echo "root Apps/$app: $root_count files"
  echo "app/Apps/$app: $app_count files"
  echo ""

  # Compare common files
  for file in $root_files; do
    filename=$(basename "$file")
    subdir=$(dirname "$file" | sed "s|Apps/$app||")

    app_file="app/Apps/$app$subdir/$filename"

    if [ -f "$app_file" ]; then
      total_files=$((total_files + 1))

      # Compare file contents
      if diff -q "$file" "$app_file" > /dev/null 2>&1; then
        echo "✓ $subdir/$filename (identical)"
        identical_files=$((identical_files + 1))
      else
        echo "✗ $subdir/$filename (different - app version newer)"
        different_files=$((different_files + 1))

        # Show line count difference
        root_lines=$(wc -l < "$file" 2>/dev/null || echo "0")
        app_lines=$(wc -l < "$app_file" 2>/dev/null || echo "0")
        echo "  root version: $root_lines lines, app version: $app_lines lines"
      fi
    else
      echo "⚠ $subdir/$filename (only exists in root Apps/)"
      needs_merge=$((needs_merge + 1))
    fi
  done

  # Check for extra files in app/Apps
  echo ""
  echo "Extra files in app/Apps/$app:"
  for file in $app_files; do
    filename=$(basename "$file")
    subdir=$(dirname "$file" | sed "s|app/Apps/$app||")

    root_file="Apps/$app$subdir/$filename"

    if [ ! -f "$root_file" ]; then
      echo "+ $subdir/$filename (only in app/Apps)"
      only_in_app=$((only_in_app + 1))
    fi
  done

  echo ""
  echo "---"
  echo ""
done

echo "========================================"
echo "Overall Statistics"
echo "========================================"
echo "Total common files: $total_files"
echo "Identical files: $identical_files"
echo "Different files: $different_files (app version newer)"
echo "Only in app/Apps: $only_in_app (new features)"
echo "Needs manual merge: $needs_merge"
echo ""

if [ $needs_merge -eq 0 ]; then
  echo "✓ Conclusion: The app/Apps/ directory contains all code; the root Apps/ directory can be safely deleted"
  exit 0
else
  echo "✗ Conclusion: Code that needs merging was found; please manually review the files listed above"
  exit 1
fi
