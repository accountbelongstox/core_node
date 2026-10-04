#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recursively clean directory <APP_INSTALL_DIR>\\GameTools\\Asia_36.0129
Delete all contents under the directory (or delete the directory itself).
"""
import argparse
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from pycore.pyfoundations.core_node_dirs import get_windows_program_dir

TARGET_DIR = get_windows_program_dir('app_root') / "GameTools" / "Asia_36.0129"


def main():
    parser = argparse.ArgumentParser(description="Recursively clean Asia_36.0129 directory")
    parser.add_argument("--dry-run", action="store_true", help="List items to be deleted only, do not actually delete")
    parser.add_argument("--path", type=str, default=None, help="Directory to clean (default: <APP_INSTALL_DIR>\\GameTools\\Asia_36.0129)")
    args = parser.parse_args()

    root = Path(args.path) if args.path else TARGET_DIR
    root = root.resolve()

    if not root.exists():
        print(f"Directory does not exist: {root}", file=sys.stderr)
        return 2
    if not root.is_dir():
        print(f"Not a directory: {root}", file=sys.stderr)
        return 2

    if args.dry_run:
        count = 0
        for p in sorted(root.rglob("*"), key=lambda x: (len(x.parts), str(x))):
            count += 1
            print(p)
        print(f"[dry-run] Will delete the above directory and all contents, {count} items total, then delete directory itself: {root}")
        return 0

    try:
        shutil.rmtree(root)
        print(f"Recursively deleted: {root}")
        return 0
    except OSError as e:
        print(f"Delete failed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
