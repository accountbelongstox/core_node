# -*- coding: utf-8 -*-
"""
Universal Shortcut Manager
Provides a unified way to create desktop shortcuts for any application
"""

import sys
import platform
from pathlib import Path
import tempfile

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyutils.desktop_icon_generator import DesktopIconGenerator


class ShortcutManager:
    """
    Universal Shortcut Manager

    Creates desktop shortcuts for any application with automatic:
    - Icon detection (searches for .ico, .png files)
    - BAT file generation
    - Windows version detection
    - Working directory management
    """

    def __init__(self):
        """Initialize shortcut manager"""
        self.icon_generator = DesktopIconGenerator()

    @staticmethod
    def get_windows_version():
        """
        Get Windows version (win10 or win11)

        Returns:
            str: 'win10' or 'win11'
        """
        try:
            version = platform.version()
            build = int(version.split('.')[-1]) if '.' in version else 0
            # Windows 11 build number is 22000 or higher
            return 'win11' if build >= 22000 else 'win10'
        except:
            # Default to win11 if detection fails
            return 'win11'

    @staticmethod
    def get_dev_env_path():
        """
        Get dev environment path based on Windows version

        Returns:
            Path: Dev environment directory path
        """
        win_version = ShortcutManager.get_windows_version()
        dev_path = Path(f'D:\\.dev_{win_version}\\.winenvs')
        dev_path.mkdir(parents=True, exist_ok=True)
        return dev_path

    def find_icon(self, search_dir, app_name=None):
        """
        Find icon file in directory

        Priority:
        1. icon.ico
        2. {app_name}.ico
        3. icon.png
        4. {app_name}.png
        5. logo.png
        6. First .ico file found
        7. First .png file found

        Args:
            search_dir: Directory to search for icons
            app_name: Application name (optional, used for {app_name}.ico search)

        Returns:
            Path or None: Path to icon file, or None if not found
        """
        search_dir = Path(search_dir)
        if not search_dir.exists():
            return None

        # Priority 1: icon.ico
        icon_ico = search_dir / 'icon.ico'
        if icon_ico.exists():
            return icon_ico

        # Priority 2: {app_name}.ico
        if app_name:
            app_ico = search_dir / f'{app_name}.ico'
            if app_ico.exists():
                return app_ico

        # Priority 3: icon.png
        icon_png = search_dir / 'icon.png'
        if icon_png.exists():
            return icon_png

        # Priority 4: {app_name}.png
        if app_name:
            app_png = search_dir / f'{app_name}.png'
            if app_png.exists():
                return app_png

        # Priority 5: logo.png
        logo_png = search_dir / 'logo.png'
        if logo_png.exists():
            return logo_png

        # Priority 6: First .ico file
        ico_files = list(search_dir.glob('*.ico'))
        if ico_files:
            return ico_files[0]

        # Priority 7: First .png file
        png_files = list(search_dir.glob('*.png'))
        if png_files:
            return png_files[0]

        return None

    def create_bat_file(self, command, bat_name, working_dir=None):
        """
        Create a BAT file in dev environment directory

        Args:
            command: Command to execute (e.g., 'python ./pymain.py app=matrix')
            bat_name: BAT file name (without .bat extension)
            working_dir: Working directory for the command (optional)

        Returns:
            Path: Path to created BAT file
        """
        dev_env_path = self.get_dev_env_path()
        bat_path = dev_env_path / f'{bat_name}.bat'

        # Create BAT file content
        bat_lines = ['@echo off']

        # Add working directory change if specified
        if working_dir:
            working_dir = Path(working_dir).resolve()
            bat_lines.append(f'cd /d "{working_dir}"')

        # Add command
        bat_lines.append(command)

        bat_content = '\r\n'.join(bat_lines) + '\r\n'

        # Write BAT file (overwrite if exists)
        with open(bat_path, 'w', encoding='utf-8', newline='\r\n') as f:
            f.write(bat_content)

        print(f"Created BAT file: {bat_path}")
        return bat_path

    def create_shortcut(self,
                       name,
                       command=None,
                       target_path=None,
                       icon_path=None,
                       icon_search_dir=None,
                       working_dir=None,
                       description=None,
                       use_bat=True):
        """
        Create desktop shortcut for an application

        Args:
            name: Shortcut name (displayed on desktop)
            command: Command to execute (e.g., 'python ./pymain.py app=matrix')
                    Required if target_path is not provided
            target_path: Direct path to executable (alternative to command+BAT)
            icon_path: Direct path to icon file (optional)
            icon_search_dir: Directory to search for icons (optional)
            working_dir: Working directory (optional, required if command is specified)
            description: Shortcut description (optional)
            use_bat: Create BAT file for command (default: True)

        Returns:
            Path: Path to created shortcut

        Raises:
            ValueError: If neither command nor target_path is provided
        """
        # Validate inputs
        if not command and not target_path:
            raise ValueError("Either 'command' or 'target_path' must be provided")

        # Determine target path (BAT file or direct executable)
        if command and use_bat:
            # Create BAT file for command
            bat_name = name.replace(' ', '_').lower()
            bat_path = self.create_bat_file(command, bat_name, working_dir)
            final_target_path = bat_path
        elif target_path:
            final_target_path = Path(target_path)
            if not final_target_path.exists():
                raise FileNotFoundError(f"Target path does not exist: {target_path}")
        else:
            raise ValueError("use_bat=False requires target_path to be provided")

        # Determine icon path
        final_icon_path = None
        if icon_path:
            # Use provided icon path
            final_icon_path = Path(icon_path)
            if not final_icon_path.exists():
                print(f"Warning: Provided icon path does not exist: {icon_path}")
                final_icon_path = None

        if not final_icon_path and icon_search_dir:
            # Search for icon in directory
            found_icon = self.find_icon(icon_search_dir, name.replace(' ', '_').lower())
            if found_icon:
                final_icon_path = found_icon
                print(f"Found icon: {final_icon_path}")

        # Use Python executable icon as fallback
        if not final_icon_path:
            final_icon_path = sys.executable
            print(f"Using Python icon as fallback: {final_icon_path}")

        # Determine working directory
        if working_dir:
            final_working_dir = str(Path(working_dir).resolve())
        else:
            final_working_dir = str(final_target_path.parent)

        # Set default description
        if not description:
            description = f"Launch {name}"

        # Create shortcut using DesktopIconGenerator
        try:
            shortcut_path = self.icon_generator.create_shortcut(
                target_path=final_target_path,
                name=name,
                icon_path=str(final_icon_path),
                working_dir=final_working_dir,
                description=description
            )
            print(f"Created/updated desktop shortcut: {name}")
            return shortcut_path
        except Exception as e:
            print(f"Failed to create desktop shortcut: {e}")
            raise

    def ensure_shortcut(self,
                       name,
                       command=None,
                       target_path=None,
                       icon_path=None,
                       icon_search_dir=None,
                       working_dir=None,
                       description=None,
                       use_bat=True):
        """
        Ensure desktop shortcut exists (creates if missing, updates if different)

        Same parameters as create_shortcut()

        Returns:
            Path: Path to shortcut
        """
        return self.create_shortcut(
            name=name,
            command=command,
            target_path=target_path,
            icon_path=icon_path,
            icon_search_dir=icon_search_dir,
            working_dir=working_dir,
            description=description,
            use_bat=use_bat
        )


def create_app_shortcut(app_name,
                       command=None,
                       target_path=None,
                       icon_search_dir=None,
                       working_dir=None,
                       description=None,
                       shortcut_name=None):
    """
    Convenience function to create application shortcut

    Args:
        app_name: Application name (used for shortcut name if shortcut_name not provided)
        command: Command to execute
        target_path: Direct path to executable (alternative to command)
        icon_search_dir: Directory to search for icons
        working_dir: Working directory
        description: Shortcut description
        shortcut_name: Custom shortcut name (optional, uses app_name if not provided)

    Returns:
        Path: Path to created shortcut
    """
    manager = ShortcutManager()

    # Use app_name as shortcut name if not provided
    if not shortcut_name:
        shortcut_name = app_name

    return manager.ensure_shortcut(
        name=shortcut_name,
        command=command,
        target_path=target_path,
        icon_search_dir=icon_search_dir,
        working_dir=working_dir,
        description=description,
        use_bat=True
    )


def main():
    """Example usage"""
    print("=" * 60)
    print("Shortcut Manager - Example Usage")
    print("=" * 60)

    # Example: Create shortcut for matrix application
    try:
        manager = ShortcutManager()

        # Find project root and matrix directory
        project_root = Path(__file__).parent.parent.parent
        matrix_dir = project_root / "pyapps" / "matrix"

        if matrix_dir.exists():
            print(f"\nCreating shortcut for Matrix application...")
            shortcut_path = manager.ensure_shortcut(
                name="Matrix Cloud",
                command=f'python "{project_root / "pymain.py"}" app=matrix',
                icon_search_dir=matrix_dir / "resources",
                working_dir=project_root,
                description="Launch Matrix Cloud - Android Device Manager"
            )
            print(f"Success! Shortcut created at: {shortcut_path}")
        else:
            print(f"Matrix directory not found: {matrix_dir}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
