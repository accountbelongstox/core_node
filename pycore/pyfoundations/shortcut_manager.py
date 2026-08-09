# -*- coding: utf-8 -*-
"""
Universal Shortcut Manager
Provides a unified way to create desktop shortcuts for any application
"""

import sys
import platform
from pathlib import Path

import traceback

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.desktop_icon_generator import DesktopIconGenerator
from pycore.pyfoundations.system_paths import get_system_cache_dir


class ShortcutManager:
    """
    Universal Shortcut Manager

    Creates desktop shortcuts for any application with automatic:
    - Icon detection (searches for .ico, .png files)
    - BAT file generation
    - Windows version detection
    - Working directory management
    - i18n support for localized shortcut names and descriptions
    """

    def __init__(self, i18n_manager=None):
        """
        Initialize shortcut manager

        Args:
            i18n_manager: Optional I18nManager instance for localized shortcut names.
                          Inject one (e.g. native_ui's i18n) to localize names/descriptions;
                          if None, the provided names are used directly. Kept as dependency
                          injection so this desktop utility stays free of domain dependencies.
        """
        self.icon_generator = DesktopIconGenerator()
        self.i18n = i18n_manager

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
        # Windows places shortcut .bat files under D:\.dev_<winver>\.winenvs;
        # off-Windows fall back to a home dir so we don't create a literal
        # "D:\\..." folder in the cwd (Linux treats backslashes as filename chars).
        if platform.system() == 'Windows':
            win_version = ShortcutManager.get_windows_version()
            dev_path = Path(f'D:\\.dev_{win_version}\\.winenvs')
        else:
            dev_path = get_system_cache_dir() / '.winenvs'
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

        ColorPrint.plain(f"Created BAT file: {bat_path}")
        return bat_path

    def create_shortcut(self,
                       name,
                       command=None,
                       target_path=None,
                       icon_path=None,
                       icon_search_dir=None,
                       working_dir=None,
                       description=None,
                       use_bat=True,
                       i18n_name_key=None,
                       i18n_description_key=None,
                       app_user_model_id=None):
        """
        Create desktop shortcut for an application

        Args:
            name: Shortcut name (displayed on desktop)
                  Used as fallback if i18n_name_key is not provided or i18n is unavailable
            command: Command to execute (e.g., 'python ./pymain.py app=matrix')
                    Required if target_path is not provided
            target_path: Direct path to executable (alternative to command+BAT)
            icon_path: Direct path to icon file (optional)
            icon_search_dir: Directory to search for icons (optional)
            working_dir: Working directory (optional, required if command is specified)
            description: Shortcut description (optional)
                        Used as fallback if i18n_description_key is not provided or i18n is unavailable
            use_bat: Create BAT file for command (default: True)
            i18n_name_key: i18n key for shortcut name (e.g., "matrix.shortcut.name")
                          If provided and i18n is available, will use localized name
            i18n_description_key: i18n key for description (e.g., "matrix.shortcut.description")
                                 If provided and i18n is available, will use localized description
            app_user_model_id: AppUserModelID (optional, prevents duplicate taskbar icons when running as admin)
                              Format: CompanyName.ProductName[.SubProduct]
                              Example: "XingcanMedia.Matrix.Cloud"
                              IMPORTANT: Must match the AppUserModelID set in your application code

        Returns:
            Path: Path to created shortcut

        Raises:
            ValueError: If neither command nor target_path is provided
        """
        # Resolve localized name if i18n is available
        final_name = name
        localized_name_used = False
        if i18n_name_key and self.i18n:
            try:
                localized_name = self.i18n.get(i18n_name_key)
                if localized_name and localized_name != i18n_name_key:
                    final_name = localized_name
                    localized_name_used = True
                    current_lang = self.i18n.get_current_language()
                    ColorPrint.plain(f"[ShortcutManager] Using localized name: '{final_name}' (lang: {current_lang})")
            except Exception as e:
                ColorPrint.plain(f"[ShortcutManager] Warning: Failed to get localized name for key '{i18n_name_key}': {e}")

        # Resolve localized description if i18n is available
        final_description = description
        if i18n_description_key and self.i18n:
            try:
                localized_desc = self.i18n.get(i18n_description_key)
                if localized_desc and localized_desc != i18n_description_key:
                    final_description = localized_desc
                    if localized_name_used:
                        ColorPrint.plain(f"[ShortcutManager] Using localized description: '{final_description}'")
            except Exception as e:
                ColorPrint.plain(f"[ShortcutManager] Warning: Failed to get localized description for key '{i18n_description_key}': {e}")
        # Validate inputs
        if not command and not target_path:
            raise ValueError("Either 'command' or 'target_path' must be provided")

        # Determine target path (BAT file or direct executable)
        if command and use_bat:
            # Create BAT file for command (use original name for BAT file, not localized)
            bat_name = name.replace(' ', '_').lower()
            ColorPrint.plain(f"[ShortcutManager] Creating BAT file: {bat_name}.bat")
            bat_path = self.create_bat_file(command, bat_name, working_dir)
            final_target_path = bat_path
            ColorPrint.plain(f"[ShortcutManager] BAT file created: {bat_path}")
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
                ColorPrint.plain(f"Warning: Provided icon path does not exist: {icon_path}")
                final_icon_path = None

        if not final_icon_path and icon_search_dir:
            # Search for icon in directory (use original name for icon search, not localized)
            ColorPrint.plain(f"[ShortcutManager] Searching for icon in: {icon_search_dir}")
            found_icon = self.find_icon(icon_search_dir, name.replace(' ', '_').lower())
            if found_icon:
                final_icon_path = found_icon
                ColorPrint.plain(f"[ShortcutManager] Found icon: {final_icon_path}")

        # Use Python executable icon as fallback
        if not final_icon_path:
            final_icon_path = sys.executable
            ColorPrint.plain(f"[ShortcutManager] Using Python icon as fallback: {final_icon_path}")

        # Determine working directory
        if working_dir:
            final_working_dir = str(Path(working_dir).resolve())
        else:
            final_working_dir = str(final_target_path.parent)

        # Set default description (use localized description if available)
        if not final_description:
            final_description = f"Launch {final_name}"

        ColorPrint.plain(f"[ShortcutManager] Shortcut configuration:")
        ColorPrint.plain(f"  - Name: {final_name}")
        ColorPrint.plain(f"  - Target: {final_target_path}")
        ColorPrint.plain(f"  - Icon: {final_icon_path}")
        ColorPrint.plain(f"  - Working Dir: {final_working_dir}")
        ColorPrint.plain(f"  - Description: {final_description}")
        if app_user_model_id:
            ColorPrint.plain(f"  - AppUserModelID: {app_user_model_id}")

        # Create shortcut using DesktopIconGenerator (use localized name)
        # Note: DesktopIconGenerator.create_shortcut() has built-in idempotency check
        # It will only update if properties have changed
        try:
            ColorPrint.plain(f"[ShortcutManager] Calling DesktopIconGenerator.create_shortcut()...")
            shortcut_path = self.icon_generator.create_shortcut(
                target_path=final_target_path,
                name=final_name,
                icon_path=str(final_icon_path),
                working_dir=final_working_dir,
                description=final_description,
                app_user_model_id=app_user_model_id
            )
            ColorPrint.plain(f"[ShortcutManager] ✓ Desktop shortcut ready: {final_name}")
            return shortcut_path
        except Exception as e:
            ColorPrint.plain(f"[ShortcutManager] ✗ Failed to create desktop shortcut: {e}")
            raise

    def cleanup_old_shortcuts(self, current_name, possible_old_names):
        """
        Clean up old shortcuts with different names (e.g., different language versions)

        This is useful when app supports multiple languages and shortcut name changes
        based on system language. We want to keep only the current language shortcut
        and remove old ones.

        Args:
            current_name: Current shortcut name (the one we want to keep)
            possible_old_names: List of possible old shortcut names to check and remove
                               (e.g., ["Matrix Cloud", "星灿传媒云矩阵", "マトリックス"])

        Returns:
            list: List of removed shortcut paths
        """
        removed = []
        desktop_path = self.icon_generator.get_desktop_path()

        ColorPrint.plain(f"[ShortcutManager] Checking for old shortcuts to clean up...")
        ColorPrint.plain(f"[ShortcutManager] Current name: {current_name}")
        ColorPrint.plain(f"[ShortcutManager] Possible old names: {possible_old_names}")

        for old_name in possible_old_names:
            # Skip if this is the current name
            if old_name == current_name:
                continue

            # Check if old shortcut exists
            old_shortcut_path = desktop_path / f"{old_name}.lnk"
            if old_shortcut_path.exists():
                try:
                    ColorPrint.plain(f"[ShortcutManager] Found old shortcut: {old_name}")
                    old_shortcut_path.unlink()
                    removed.append(old_shortcut_path)
                    ColorPrint.plain(f"[ShortcutManager] ✓ Removed old shortcut: {old_name}")
                except Exception as e:
                    ColorPrint.plain(f"[ShortcutManager] ✗ Failed to remove old shortcut {old_name}: {e}")

        if not removed:
            ColorPrint.plain(f"[ShortcutManager] No old shortcuts found to clean up")
        else:
            ColorPrint.plain(f"[ShortcutManager] Cleaned up {len(removed)} old shortcut(s)")

        return removed

    def ensure_shortcut(self,
                       name,
                       command=None,
                       target_path=None,
                       icon_path=None,
                       icon_search_dir=None,
                       working_dir=None,
                       description=None,
                       use_bat=True,
                       i18n_name_key=None,
                       i18n_description_key=None,
                       cleanup_old_names=None,
                       app_user_model_id=None):
        """
        Ensure desktop shortcut exists (creates if missing, updates if different)

        Same parameters as create_shortcut(), plus:
            cleanup_old_names: Optional list of old shortcut names to clean up
                              (e.g., ["Matrix Cloud", "星灿传媒云矩阵"])
                              Useful when app name changes due to language switch
            app_user_model_id: AppUserModelID (prevents duplicate taskbar icons)

        Returns:
            Path: Path to shortcut
        """
        # Clean up old shortcuts if specified
        if cleanup_old_names:
            # Resolve final name first (with i18n)
            final_name = name
            if i18n_name_key and self.i18n:
                try:
                    localized_name = self.i18n.get(i18n_name_key)
                    if localized_name and localized_name != i18n_name_key:
                        final_name = localized_name
                except Exception:
                    pass

            # Clean up old shortcuts (excluding current name)
            self.cleanup_old_shortcuts(final_name, cleanup_old_names)

        return self.create_shortcut(
            name=name,
            command=command,
            target_path=target_path,
            icon_path=icon_path,
            icon_search_dir=icon_search_dir,
            working_dir=working_dir,
            description=description,
            use_bat=use_bat,
            i18n_name_key=i18n_name_key,
            i18n_description_key=i18n_description_key,
            app_user_model_id=app_user_model_id
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
    ColorPrint.plain("=" * 60)
    ColorPrint.plain("Shortcut Manager - Example Usage")
    ColorPrint.plain("=" * 60)

    # Example: Create shortcut for matrix application
    try:
        manager = ShortcutManager()

        # Find project root and matrix directory
        project_root = Path(__file__).parent.parent.parent
        matrix_dir = project_root / "pyapps" / "matrix"

        if matrix_dir.exists():
            ColorPrint.plain(f"\nCreating shortcut for Matrix application...")
            shortcut_path = manager.ensure_shortcut(
                name="Matrix Cloud",
                command=f'python "{project_root / "pymain.py"}" app=matrix',
                icon_search_dir=matrix_dir / "resources",
                working_dir=project_root,
                description="Launch Matrix Cloud - Android Device Manager"
            )
            ColorPrint.plain(f"Success! Shortcut created at: {shortcut_path}")
        else:
            ColorPrint.plain(f"Matrix directory not found: {matrix_dir}")

    except Exception as e:
        ColorPrint.plain(f"Error: {e}")
        traceback.print_exc()


if __name__ == '__main__':
    main()
