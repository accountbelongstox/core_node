#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix Desktop Shortcut Creator
Standalone script to create Matrix Cloud desktop shortcut
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyutils.desktop.universal_shortcut import ShortcutManager


def create_matrix_shortcut():
    """Create Matrix Cloud desktop shortcut"""
    print("=" * 60)
    print("Matrix Cloud - Desktop Shortcut Creator")
    print("=" * 60)

    try:
        # Initialize shortcut manager
        manager = ShortcutManager()

        # Get paths
        app_dir = Path(__file__).parent
        resources_dir = app_dir / "resources"

        print(f"\nProject Root: {PROJECT_ROOT}")
        print(f"App Directory: {app_dir}")
        print(f"Resources Directory: {resources_dir}")

        # Find icon
        icon_path = manager.find_icon(resources_dir, app_name="matrix")
        if icon_path:
            print(f"[OK] Found icon: {icon_path}")
        else:
            print("[WARN] No icon found, will use default")

        # Create/update shortcut
        print("\nCreating desktop shortcut...")
        manager.ensure_shortcut(
            name="Matrix Cloud",
            command=f'python "{PROJECT_ROOT / "pymain.py"}" app=matrix',
            icon_search_dir=resources_dir,
            working_dir=PROJECT_ROOT,
            description="Launch Matrix Cloud - Android Device Manager"
        )

        print("\n" + "=" * 60)
        print("[SUCCESS] Desktop shortcut created successfully!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n[FAILED] Failed to create desktop shortcut: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = create_matrix_shortcut()
    sys.exit(0 if success else 1)
