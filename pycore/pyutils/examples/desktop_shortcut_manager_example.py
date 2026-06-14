#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Desktop Shortcut Manager - Usage Examples
Demonstrates how to use the DesktopShortcutManager class
"""

import sys
from pathlib import Path

# Add parent directory to path
pytools_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(pytools_dir))

from pycore.pyutils.desktop.shortcut_manager import DesktopShortcutManager


def example_1_basic_shortcut():
    """Example 1: Create a basic shortcut"""
    print("=" * 60)
    print("Example 1: Create basic shortcut")
    print("=" * 60)

    manager = DesktopShortcutManager()

    result = manager.create_shortcut(
        name="Notepad",
        target_path="C:\\Windows\\System32\\notepad.exe",
        description="Open Notepad text editor"
    )

    print(f"Success: {result['success']}")
    print(f"Message: {result['message']}")
    if result['success']:
        print(f"Shortcut Path: {result['shortcut_path']}")
        print(f"Icon Used: {result['icon_used']}")
    print()


def example_2_shortcut_with_png_icon():
    """Example 2: Create shortcut with PNG icon (auto-converts to ICO)"""
    print("=" * 60)
    print("Example 2: Create shortcut with PNG icon")
    print("=" * 60)

    manager = DesktopShortcutManager()

    # Example with matrix app
    matrix_app = Path("D:/programing/core_node/pyapps/matrix")
    if matrix_app.exists():
        result = manager.create_shortcut(
            name="Matrix App",
            target_path="D:/programing/core_node/pymain.py",
            icon_path=str(matrix_app / "icon.png"),  # PNG will be auto-converted
            working_dir="D:/programing/core_node",
            arguments="app=matrix",
            description="Launch Matrix Application"
        )

        print(f"Success: {result['success']}")
        print(f"Message: {result['message']}")
        if result['success']:
            print(f"Shortcut Path: {result['shortcut_path']}")
            print(f"Icon Used: {result['icon_used']}")
            print(f"Icon Converted: {result.get('icon_converted', False)}")
    else:
        print("Matrix app not found, skipping example")
    print()


def example_3_auto_icon_search():
    """Example 3: Auto-search for icon in app directory"""
    print("=" * 60)
    print("Example 3: Auto-search for icon in app directory")
    print("=" * 60)

    manager = DesktopShortcutManager()

    # The manager will automatically search for icon.ico or icon.png in app_dir
    result = manager.create_shortcut(
        name="Matrix (Auto Icon)",
        target_path="D:/programing/core_node/pymain.py",
        app_dir="D:/programing/core_node/pyapps/matrix",  # Will auto-search here
        working_dir="D:/programing/core_node",
        arguments="app=matrix",
        description="Matrix with auto-detected icon"
    )

    print(f"Success: {result['success']}")
    print(f"Message: {result['message']}")
    if result['success']:
        print(f"Icon Used: {result['icon_used']}")
        print(f"Icon Converted: {result.get('icon_converted', False)}")
    print()


def example_4_batch_create():
    """Example 4: Batch create multiple shortcuts"""
    print("=" * 60)
    print("Example 4: Batch create shortcuts")
    print("=" * 60)

    manager = DesktopShortcutManager()

    shortcuts_config = [
        {
            'name': 'Notepad++',
            'target_path': 'C:\\Windows\\System32\\notepad.exe',
            'description': 'Text Editor'
        },
        {
            'name': 'Calculator',
            'target_path': 'C:\\Windows\\System32\\calc.exe',
            'description': 'Windows Calculator'
        }
    ]

    result = manager.batch_create_shortcuts(shortcuts_config)

    print(f"Total: {result['total']}")
    print(f"Success Count: {result['success_count']}")
    print(f"Failed Count: {result['failed_count']}")

    for i, r in enumerate(result['results'], 1):
        print(f"\n  Shortcut {i}:")
        print(f"    Success: {r['success']}")
        print(f"    Message: {r['message']}")
    print()


def example_5_list_shortcuts():
    """Example 5: List all desktop shortcuts"""
    print("=" * 60)
    print("Example 5: List all desktop shortcuts")
    print("=" * 60)

    manager = DesktopShortcutManager()

    shortcuts = manager.list_shortcuts()

    print(f"Found {len(shortcuts)} shortcuts on desktop:")
    for shortcut in shortcuts[:10]:  # Show first 10
        if 'error' in shortcut:
            print(f"  {shortcut['name']}: ERROR - {shortcut['error']}")
        else:
            target = shortcut.get('target', shortcut.get('path', 'N/A'))
            print(f"  {shortcut['name']}: {target}")
    print()


def example_6_get_shortcut_info():
    """Example 6: Get detailed shortcut information"""
    print("=" * 60)
    print("Example 6: Get shortcut information")
    print("=" * 60)

    manager = DesktopShortcutManager()

    result = manager.get_shortcut_info("Notepad")

    if result['success']:
        info = result['info']
        print("Shortcut Information:")
        for key, value in info.items():
            print(f"  {key}: {value}")
    else:
        print(f"Error: {result['error']}")
    print()


def example_7_delete_shortcut():
    """Example 7: Delete a shortcut"""
    print("=" * 60)
    print("Example 7: Delete shortcut")
    print("=" * 60)

    manager = DesktopShortcutManager()

    # Create a test shortcut first
    print("Creating test shortcut...")
    manager.create_shortcut(
        name="Test Shortcut",
        target_path="C:\\Windows\\System32\\notepad.exe"
    )

    # Delete it
    print("Deleting test shortcut...")
    result = manager.delete_shortcut("Test Shortcut")

    print(f"Success: {result['success']}")
    print(f"Message: {result['message']}")
    print()


def example_8_icon_priority_system():
    """Example 8: Demonstrate icon priority system"""
    print("=" * 60)
    print("Example 8: Icon Priority System")
    print("=" * 60)

    manager = DesktopShortcutManager()

    print("Icon search priority:")
    print("1. Specified icon_path from config")
    print("2. icon.ico in app directory")
    print("3. icon.png in app directory (auto-converts to ICO)")
    print("4. Default system icon")
    print()

    # Test with app directory
    app_dir = "D:/programing/core_node/pyapps/matrix"
    resolved = manager.resolve_icon_path(
        icon_path=None,  # No specific icon
        app_dir=app_dir,
        auto_search=True
    )

    print(f"Resolved icon for matrix app: {resolved}")
    print()


def main():
    """Run all examples"""
    print("\n")
    print("=" * 60)
    print("Desktop Shortcut Manager - Usage Examples")
    print("=" * 60)
    print()

    examples = [
        # example_1_basic_shortcut,
        example_2_shortcut_with_png_icon,
        example_3_auto_icon_search,
        # example_4_batch_create,
        example_5_list_shortcuts,
        # example_6_get_shortcut_info,
        # example_7_delete_shortcut,
        example_8_icon_priority_system,
    ]

    for example in examples:
        try:
            example()
        except Exception as e:
            print(f"Error in {example.__name__}: {e}")
            print()

    print("=" * 60)
    print("Examples completed!")
    print("=" * 60)


if __name__ == '__main__':
    main()
