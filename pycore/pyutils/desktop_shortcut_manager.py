# -*- coding: utf-8 -*-
"""
Desktop Shortcut Manager - Powerful cross-platform desktop shortcut management
Supports Windows with automatic PNG to ICO conversion and intelligent shortcut management
"""

import sys
import json
import argparse
from pathlib import Path
import os
import platform

# Add parent directory to path for dependency checking
pytools_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(pytools_dir))

from pycore import check_and_install_dependencies
check_and_install_dependencies()

from pycore.pyutils.desktop_icon_generator import DesktopIconGenerator


class DesktopShortcutManager:
    """
    Powerful desktop shortcut manager with automatic icon conversion and organization

    Features:
    - Automatic PNG to ICO conversion (Windows)
    - Multi-platform support (Windows primary, Linux partial)
    - Intelligent shortcut update detection
    - Batch operations support
    - Icon priority system
    - Group/folder organization
    """

    def __init__(self):
        """Initialize desktop shortcut manager"""
        self.platform = platform.system()

        if self.platform == 'Windows':
            self.generator = DesktopIconGenerator()
            self.desktop_path = self.generator.desktop_path
        else:
            # Linux/Mac support
            self.generator = None
            self.desktop_path = Path.home() / "Desktop"
            if not self.desktop_path.exists():
                self.desktop_path = Path.home() / ".local" / "share" / "applications"

    def resolve_icon_path(self, icon_path, app_dir=None, auto_search=True):
        """
        Resolve icon path with priority system and automatic conversion

        Priority:
        1. Specified icon_path (from config or parameter)
        2. icon.ico in app directory
        3. icon.png in app directory (auto-convert on Windows)
        4. Default system icon

        Args:
            icon_path: Icon path from config or None
            app_dir: Application directory to search for icons
            auto_search: If True, search app_dir for icon.ico/icon.png

        Returns:
            str: Resolved icon path (ICO on Windows, PNG/ICO on Linux)
        """
        # Priority 1: Use specified icon_path if provided and exists
        if icon_path:
            icon_file = Path(icon_path)

            # If relative path, resolve from app_dir
            if not icon_file.is_absolute() and app_dir:
                icon_file = Path(app_dir) / icon_path

            if icon_file.exists():
                # On Windows, auto-convert PNG to ICO
                if self.platform == 'Windows' and icon_file.suffix.lower() == '.png':
                    try:
                        ico_path = self.generator._resolve_icon_path(icon_file)
                        print(f"[INFO] Converted PNG to ICO: {ico_path}")
                        return ico_path
                    except Exception as e:
                        print(f"[WARNING] Failed to convert PNG: {e}")
                        return str(icon_file)
                return str(icon_file)

        # Priority 2 & 3: Auto-search in app directory
        if auto_search and app_dir:
            app_path = Path(app_dir)

            # Priority 2: Check for icon.ico
            ico_file = app_path / "icon.ico"
            if ico_file.exists():
                print(f"[INFO] Found icon.ico in app directory")
                return str(ico_file)

            # Priority 3: Check for icon.png (auto-convert on Windows)
            png_file = app_path / "icon.png"
            if png_file.exists():
                print(f"[INFO] Found icon.png in app directory")
                if self.platform == 'Windows':
                    try:
                        ico_path = self.generator._resolve_icon_path(png_file)
                        print(f"[INFO] Converted PNG to ICO: {ico_path}")
                        return ico_path
                    except Exception as e:
                        print(f"[WARNING] Failed to convert PNG: {e}")
                        return str(png_file)
                return str(png_file)

        # Priority 4: Default icon
        if self.platform == 'Windows':
            return "powershell.exe"
        else:
            return "utilities-terminal"

    def create_shortcut(self, name, target_path, icon_path=None, working_dir=None,
                       arguments="", description="", app_dir=None):
        """
        Create or update desktop shortcut with intelligent icon handling

        Args:
            name: Shortcut display name
            target_path: Path to executable or script
            icon_path: Icon file path (optional, will auto-search if not provided)
            working_dir: Working directory (optional, uses target's directory if not provided)
            arguments: Command line arguments (optional)
            description: Shortcut description (optional)
            app_dir: Application directory for icon auto-search (optional)

        Returns:
            dict: Result with status, shortcut_path, and icon_info
        """
        if self.platform != 'Windows':
            return self._create_linux_desktop_entry(
                name, target_path, icon_path, working_dir, arguments, description, app_dir
            )

        # Windows shortcut creation
        target = Path(target_path)

        # Resolve icon with priority system
        resolved_icon = self.resolve_icon_path(icon_path, app_dir, auto_search=True)

        # Resolve working directory
        if working_dir is None:
            if target.is_file():
                working_dir = str(target.parent)
            else:
                working_dir = str(target)

        try:
            # Use DesktopIconGenerator to create shortcut
            shortcut_path = self.generator.create_shortcut(
                target_path=target_path,
                name=name,
                icon_path=resolved_icon,
                working_dir=working_dir,
                arguments=arguments,
                description=description
            )

            return {
                'success': True,
                'shortcut_path': str(shortcut_path),
                'icon_used': resolved_icon,
                'icon_converted': resolved_icon.endswith('.ico') and (icon_path or '').endswith('.png'),
                'message': f"Shortcut created: {shortcut_path}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': f"Failed to create shortcut: {e}"
            }

    def _create_linux_desktop_entry(self, name, target_path, icon_path, working_dir,
                                   arguments, description, app_dir):
        """Create Linux .desktop entry"""
        # Resolve icon
        resolved_icon = self.resolve_icon_path(icon_path, app_dir, auto_search=True)

        # Resolve working directory
        target = Path(target_path)
        if working_dir is None:
            if target.is_file():
                working_dir = str(target.parent)
            else:
                working_dir = str(target)

        # Create desktop entry
        desktop_file = self.desktop_path / f"{name}.desktop"

        # Build Exec command
        exec_cmd = str(target_path)
        if arguments:
            exec_cmd += f" {arguments}"

        try:
            content = f"""[Desktop Entry]
Version=1.0
Type=Application
Name={name}
Comment={description or f'Launch {name}'}
Exec={exec_cmd}
Path={working_dir}
Icon={resolved_icon}
Terminal=false
Categories=Application;
"""
            desktop_file.write_text(content)
            desktop_file.chmod(0o755)

            return {
                'success': True,
                'shortcut_path': str(desktop_file),
                'icon_used': resolved_icon,
                'message': f"Desktop entry created: {desktop_file}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': f"Failed to create desktop entry: {e}"
            }

    def update_shortcut(self, name, target_path=None, icon_path=None, working_dir=None,
                       arguments=None, description=None, app_dir=None):
        """
        Update existing shortcut

        Args:
            name: Shortcut name to update
            target_path: New target path (optional)
            icon_path: New icon path (optional)
            working_dir: New working directory (optional)
            arguments: New arguments (optional)
            description: New description (optional)
            app_dir: Application directory for icon search (optional)

        Returns:
            dict: Update result
        """
        if self.platform != 'Windows':
            return {'success': False, 'message': 'Update not implemented for non-Windows platforms'}

        # Resolve icon if provided
        resolved_icon = None
        if icon_path:
            resolved_icon = self.resolve_icon_path(icon_path, app_dir, auto_search=False)

        try:
            shortcut_path = self.generator.update_shortcut(
                shortcut_path=self.desktop_path / f"{name}.lnk",
                target_path=target_path,
                icon_path=resolved_icon,
                working_dir=working_dir,
                arguments=arguments,
                description=description
            )

            return {
                'success': True,
                'shortcut_path': str(shortcut_path),
                'message': f"Shortcut updated: {shortcut_path}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': f"Failed to update shortcut: {e}"
            }

    def delete_shortcut(self, name):
        """
        Delete desktop shortcut

        Args:
            name: Shortcut name (without extension)

        Returns:
            dict: Deletion result
        """
        if self.platform == 'Windows':
            try:
                success = self.generator.delete_shortcut(name)
                return {
                    'success': success,
                    'message': f"Shortcut {'deleted' if success else 'not found'}: {name}"
                }
            except Exception as e:
                return {
                    'success': False,
                    'error': str(e),
                    'message': f"Failed to delete shortcut: {e}"
                }
        else:
            # Linux
            desktop_file = self.desktop_path / f"{name}.desktop"
            if desktop_file.exists():
                desktop_file.unlink()
                return {'success': True, 'message': f"Desktop entry deleted: {desktop_file}"}
            return {'success': False, 'message': f"Desktop entry not found: {name}"}

    def list_shortcuts(self):
        """
        List all desktop shortcuts

        Returns:
            list: List of shortcut information dicts
        """
        shortcuts = []

        if self.platform == 'Windows':
            lnk_files = list(self.desktop_path.glob("*.lnk"))
            for lnk_file in lnk_files:
                try:
                    info = self.generator.get_shortcut_info(lnk_file)
                    shortcuts.append(info)
                except Exception as e:
                    shortcuts.append({
                        'name': lnk_file.stem,
                        'error': str(e)
                    })
        else:
            # Linux
            desktop_files = list(self.desktop_path.glob("*.desktop"))
            for desktop_file in desktop_files:
                shortcuts.append({
                    'name': desktop_file.stem,
                    'path': str(desktop_file)
                })

        return shortcuts

    def batch_create_shortcuts(self, shortcuts_config):
        """
        Batch create multiple shortcuts

        Args:
            shortcuts_config: List of shortcut configs, each containing:
                - name: Required
                - target_path: Required
                - icon_path: Optional
                - working_dir: Optional
                - arguments: Optional
                - description: Optional
                - app_dir: Optional

        Returns:
            dict: Results with success count and individual results
        """
        results = []
        success_count = 0

        for config in shortcuts_config:
            name = config.get('name')
            target_path = config.get('target_path')

            if not name or not target_path:
                results.append({
                    'success': False,
                    'error': 'name and target_path are required',
                    'config': config
                })
                continue

            result = self.create_shortcut(
                name=name,
                target_path=target_path,
                icon_path=config.get('icon_path'),
                working_dir=config.get('working_dir'),
                arguments=config.get('arguments', ''),
                description=config.get('description', ''),
                app_dir=config.get('app_dir')
            )

            if result['success']:
                success_count += 1

            results.append(result)

        return {
            'success': success_count == len(shortcuts_config),
            'total': len(shortcuts_config),
            'success_count': success_count,
            'failed_count': len(shortcuts_config) - success_count,
            'results': results
        }

    def get_shortcut_info(self, name):
        """
        Get information about a shortcut

        Args:
            name: Shortcut name (without extension)

        Returns:
            dict: Shortcut information or error
        """
        if self.platform == 'Windows':
            shortcut_path = self.desktop_path / f"{name}.lnk"
            try:
                info = self.generator.get_shortcut_info(shortcut_path)
                return {'success': True, 'info': info}
            except Exception as e:
                return {'success': False, 'error': str(e)}
        else:
            desktop_file = self.desktop_path / f"{name}.desktop"
            if desktop_file.exists():
                return {
                    'success': True,
                    'info': {
                        'name': name,
                        'path': str(desktop_file),
                        'exists': True
                    }
                }
            return {'success': False, 'error': 'Desktop entry not found'}


def main():
    """Command-line interface for desktop shortcut manager"""
    parser = argparse.ArgumentParser(
        description='Desktop Shortcut Manager - Create and manage desktop shortcuts with automatic icon conversion',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create shortcut with auto icon search
  python -m pycore.pyutils.desktop_shortcut_manager create --name "My App" --target "C:/app/app.exe" --app-dir "C:/app"

  # Create shortcut with specific PNG icon (auto-converts to ICO on Windows)
  python -m pycore.pyutils.desktop_shortcut_manager create --name "My App" --target "C:/app/app.exe" --icon "C:/app/icon.png"

  # List all shortcuts
  python -m pycore.pyutils.desktop_shortcut_manager list

  # Delete shortcut
  python -m pycore.pyutils.desktop_shortcut_manager delete --name "My App"
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # Create command
    create_parser = subparsers.add_parser('create', help='Create desktop shortcut')
    create_parser.add_argument('--name', required=True, help='Shortcut display name')
    create_parser.add_argument('--target', required=True, help='Target executable or script path')
    create_parser.add_argument('--icon', help='Icon file path (PNG will be auto-converted on Windows)')
    create_parser.add_argument('--working-dir', help='Working directory')
    create_parser.add_argument('--arguments', default='', help='Command line arguments')
    create_parser.add_argument('--description', default='', help='Shortcut description')
    create_parser.add_argument('--app-dir', help='App directory for auto icon search')
    create_parser.add_argument('--json', action='store_true', help='Output result as JSON')

    # Update command
    update_parser = subparsers.add_parser('update', help='Update existing shortcut')
    update_parser.add_argument('--name', required=True, help='Shortcut name to update')
    update_parser.add_argument('--target', help='New target path')
    update_parser.add_argument('--icon', help='New icon path')
    update_parser.add_argument('--working-dir', help='New working directory')
    update_parser.add_argument('--arguments', help='New arguments')
    update_parser.add_argument('--description', help='New description')
    update_parser.add_argument('--app-dir', help='App directory for icon search')
    update_parser.add_argument('--json', action='store_true', help='Output result as JSON')

    # Delete command
    delete_parser = subparsers.add_parser('delete', help='Delete desktop shortcut')
    delete_parser.add_argument('--name', required=True, help='Shortcut name to delete')
    delete_parser.add_argument('--json', action='store_true', help='Output result as JSON')

    # List command
    list_parser = subparsers.add_parser('list', help='List all desktop shortcuts')
    list_parser.add_argument('--json', action='store_true', help='Output as JSON')

    # Info command
    info_parser = subparsers.add_parser('info', help='Get shortcut information')
    info_parser.add_argument('--name', required=True, help='Shortcut name')
    info_parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Skip dependency checks for faster execution
    os.environ.setdefault('PYCORE_SKIP_DEP_CHECK', '1')

    manager = DesktopShortcutManager()

    if args.command == 'create':
        result = manager.create_shortcut(
            name=args.name,
            target_path=args.target,
            icon_path=args.icon,
            working_dir=args.working_dir,
            arguments=args.arguments,
            description=args.description,
            app_dir=args.app_dir
        )

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(result['message'])
            if result['success']:
                print(f"Icon used: {result['icon_used']}")
                if result.get('icon_converted'):
                    print("PNG icon was automatically converted to ICO")

        return 0 if result['success'] else 1

    elif args.command == 'update':
        result = manager.update_shortcut(
            name=args.name,
            target_path=args.target,
            icon_path=args.icon,
            working_dir=args.working_dir,
            arguments=args.arguments,
            description=args.description,
            app_dir=args.app_dir
        )

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(result['message'])

        return 0 if result['success'] else 1

    elif args.command == 'delete':
        result = manager.delete_shortcut(args.name)

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            print(result['message'])

        return 0 if result['success'] else 1

    elif args.command == 'list':
        shortcuts = manager.list_shortcuts()

        if args.json:
            print(json.dumps(shortcuts, indent=2))
        else:
            print(f"Desktop shortcuts ({len(shortcuts)}):")
            for shortcut in shortcuts:
                if 'error' in shortcut:
                    print(f"  {shortcut['name']}: ERROR - {shortcut['error']}")
                else:
                    print(f"  {shortcut['name']}: {shortcut.get('target', shortcut.get('path', 'N/A'))}")

        return 0

    elif args.command == 'info':
        result = manager.get_shortcut_info(args.name)

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if result['success']:
                info = result['info']
                print(f"Shortcut: {info['name']}")
                for key, value in info.items():
                    if key != 'name':
                        print(f"  {key}: {value}")
            else:
                print(f"Error: {result['error']}")

        return 0 if result['success'] else 1


if __name__ == '__main__':
    sys.exit(main())
