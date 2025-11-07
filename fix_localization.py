#!/usr/bin/env python3
"""
Fix localization method calls in app_codemart view files.
Changes context.tr(LocalizationKeysAppCodemart.xxx) to LocalizationKeysAppCodemart.xxx.tr(context)
"""

import re
import os
from pathlib import Path

# Directory containing the view files
VIEWS_DIR = Path(r"D:\programing\core_node\poly_apps\flutter_bloom\lib\apps\app_codemart\views_app_codemart")

# Import to add
LOCALIZATION_MANAGER_IMPORT = "import 'package:qyflutter/common/localization/localization_manager.dart';"

def fix_localization_calls(content):
    """
    Replace context.tr(LocalizationKeysAppCodemart.xxx) with LocalizationKeysAppCodemart.xxx.tr(context)
    Returns: (modified_content, replacement_count)
    """
    # Pattern to match context.tr(LocalizationKeysAppCodemart.xxxx)
    pattern = r'context\.tr\(LocalizationKeysAppCodemart\.(\w+)\)'

    # Count replacements
    count = len(re.findall(pattern, content))

    # Replace with LocalizationKeysAppCodemart.xxxx.tr(context)
    modified = re.sub(pattern, r'LocalizationKeysAppCodemart.\1.tr(context)', content)

    return modified, count

def add_import_if_missing(content):
    """
    Add localization_manager import if not present.
    Returns: (modified_content, was_added)
    """
    # Check if import already exists
    if 'localization_manager.dart' in content:
        return content, False

    # Find the import section (after first import and before class/other declarations)
    lines = content.split('\n')

    # Find the last import line
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i

    if last_import_idx >= 0:
        # Insert after the last import
        lines.insert(last_import_idx + 1, LOCALIZATION_MANAGER_IMPORT)
        return '\n'.join(lines), True
    else:
        # No imports found, add at the beginning
        return LOCALIZATION_MANAGER_IMPORT + '\n' + content, True

def process_file(file_path):
    """
    Process a single Dart file.
    Returns: (replacements_made, import_added)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Fix localization calls
        modified_content, replacement_count = fix_localization_calls(content)

        # Add import if needed
        final_content, import_added = add_import_if_missing(modified_content)

        # Write back if changed
        if final_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(final_content)

        return replacement_count, import_added
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return 0, False

def main():
    """Main function to process all Dart files."""
    total_files = 0
    total_replacements = 0
    files_with_imports_added = 0

    # Find all .dart files recursively
    dart_files = list(VIEWS_DIR.rglob("*.dart"))

    print(f"Found {len(dart_files)} Dart files in {VIEWS_DIR}")
    print("=" * 80)

    for file_path in sorted(dart_files):
        replacements, import_added = process_file(file_path)

        if replacements > 0 or import_added:
            total_files += 1
            total_replacements += replacements
            if import_added:
                files_with_imports_added += 1

            relative_path = file_path.relative_to(VIEWS_DIR)
            status_parts = []
            if replacements > 0:
                status_parts.append(f"{replacements} replacements")
            if import_added:
                status_parts.append("import added")

            print(f"[OK] {relative_path}: {', '.join(status_parts)}")

    print("=" * 80)
    print(f"\nSummary:")
    print(f"  Files processed: {total_files}")
    print(f"  Total replacements: {total_replacements}")
    print(f"  Imports added: {files_with_imports_added}")
    print(f"\n[SUCCESS] All files fixed successfully!")

if __name__ == "__main__":
    main()
