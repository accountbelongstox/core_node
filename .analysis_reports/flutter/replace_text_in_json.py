#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Replace text in all JSON files
Replace specific Chinese text in JSON files
"""

import json
import sys
from pathlib import Path

def replace_text_in_json(file_path, old_text, new_text):
    """Replace text in a JSON file"""
    try:
        # Read JSON file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if old text exists
        if old_text not in content:
            return False, 0

        # Count occurrences
        count = content.count(old_text)

        # Replace text
        new_content = content.replace(old_text, new_text)

        # Validate JSON after replacement
        try:
            json.loads(new_content)
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON validation failed for {file_path}: {e}")
            return False, 0

        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        return True, count

    except Exception as e:
        print(f"[ERROR] Failed to process {file_path}: {e}")
        return False, 0

def main():
    """Main function"""

    docs_dir = Path("D:/programing/core_node/poly_apps/flutter_bloom/lib/apps/app_qy/docs")
    old_text = "扇贝"
    new_text = "千语"

    print("=" * 60)
    print("JSON Text Replacement Tool")
    print("=" * 60)
    print(f"\nDirectory: {docs_dir}")
    print(f"Replace: '{old_text}' -> '{new_text}'")
    print()

    # Find all JSON files
    json_files = list(docs_dir.glob("*.json"))

    if not json_files:
        print("No JSON files found!")
        return 1

    print(f"Found {len(json_files)} JSON files\n")

    # Process each file
    total_files = 0
    total_replacements = 0
    success_files = []
    failed_files = []

    for json_file in json_files:
        success, count = replace_text_in_json(json_file, old_text, new_text)

        if success:
            total_files += 1
            total_replacements += count
            success_files.append((json_file.name, count))
            print(f"[OK] {json_file.name}: {count} replacements")
        elif count == 0:
            # No occurrences found, not an error
            pass
        else:
            failed_files.append(json_file.name)
            print(f"[FAIL] {json_file.name}")

    # Summary
    print(f"\n{'=' * 60}")
    print("Replacement Summary")
    print(f"{'=' * 60}")
    print(f"Total JSON files: {len(json_files)}")
    print(f"Files modified: {total_files}")
    print(f"Total replacements: {total_replacements}")
    print(f"Failed: {len(failed_files)}")

    if failed_files:
        print(f"\nFailed files:")
        for f in failed_files:
            print(f"  - {f}")

    print(f"{'=' * 60}\n")

    return 0 if not failed_files else 1

if __name__ == "__main__":
    sys.exit(main())
