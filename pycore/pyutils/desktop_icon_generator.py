# -*- coding: utf-8 -*-
"""
Desktop Icon Generator
Powerful Windows desktop shortcut generator with support for grouping and organization
"""

import sys
from pathlib import Path
import os
import shutil
import tempfile

try:
    import win32com.client
    HAS_WIN32COM = True
except ImportError:
    HAS_WIN32COM = False
    print("Warning: win32com not available, some features may not work")


class DesktopIconGenerator:
    """Powerful Windows desktop shortcut generator"""
    
    def __init__(self):
        """Initialize desktop icon generator"""
        self.desktop_path = self.get_desktop_path()
        self._temp_ico_files = []  # Track temporary ICO files for cleanup
    
    def _convert_png_to_ico(self, png_path, ico_path=None):
        """
        Convert PNG to ICO format (Windows only)

        Args:
            png_path: Path to PNG file
            ico_path: Path to output ICO file (optional, saves in same directory as PNG if not provided)

        Returns:
            Path: Path to ICO file
        """
        if os.name != 'nt':  # Only on Windows
            raise NotImplementedError("PNG to ICO conversion only supported on Windows")

        png_path = Path(png_path)
        if not png_path.exists():
            raise FileNotFoundError(f"PNG file not found: {png_path}")

        # Try to import PIL/Pillow
        try:
            from PIL import Image
        except ImportError:
            try:
                # Try to install Pillow
                import subprocess
                import sys
                print("[INFO] Installing Pillow for PNG to ICO conversion...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
                from PIL import Image
                print("[INFO] Pillow installed successfully")
            except Exception as e:
                raise RuntimeError(f"Failed to import/install Pillow for PNG conversion: {e}")

        # Generate ICO path if not provided - save in same directory as PNG
        if ico_path is None:
            ico_path = png_path.parent / f"{png_path.stem}.ico"

        ico_path = Path(ico_path)

        # If ICO already exists and is newer than PNG, skip conversion
        if ico_path.exists():
            png_mtime = png_path.stat().st_mtime
            ico_mtime = ico_path.stat().st_mtime
            if ico_mtime >= png_mtime:
                print(f"[INFO] Using existing ICO (up to date): {ico_path}")
                return ico_path
        
        try:
            # Open PNG and convert to ICO
            img = Image.open(png_path)
            
            # Create ICO with multiple sizes (Windows supports 16x16, 32x32, 48x48, 256x256)
            sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
            img.save(str(ico_path), format='ICO', sizes=sizes)
            
            print(f"Converted PNG to ICO: {ico_path}")
            return ico_path
        except Exception as e:
            raise RuntimeError(f"Failed to convert PNG to ICO: {e}")
    
    def _resolve_icon_path(self, icon_path):
        """
        Resolve icon path, converting PNG to ICO if needed (Windows only)
        
        Args:
            icon_path: Path to icon file (PNG, ICO, EXE, etc.)
        
        Returns:
            str: Resolved icon path
        """
        if icon_path is None:
            return None
        
        icon_path = Path(icon_path)
        
        # Only process on Windows
        if os.name != 'nt':
            return str(icon_path)
        
        # If PNG, convert to ICO
        if icon_path.suffix.lower() == '.png':
            try:
                ico_path = self._convert_png_to_ico(icon_path)
                return str(ico_path)
            except Exception as e:
                print(f"Warning: Failed to convert PNG to ICO, using PNG directly: {e}")
                return str(icon_path)
        
        # For other formats (ICO, EXE, DLL), return as is
        return str(icon_path)
    
    @staticmethod
    def get_desktop_path():
        """
        Get Windows desktop path
        
        Returns:
            Path: Desktop directory path
        """
        try:
            # Try using shell COM object
            if HAS_WIN32COM:
                shell = win32com.client.Dispatch("WScript.Shell")
                desktop = shell.SpecialFolders("Desktop")
                return Path(desktop)
        except:
            pass
        
        # Fallback: use environment variable
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        if not os.path.exists(desktop):
            # For some Windows versions, desktop is in Public
            desktop = os.path.join(os.environ.get("PUBLIC", ""), "Desktop")
        
        return Path(desktop)
    
    def _shortcut_needs_update(self, shortcut_path, target_path, icon_path, working_dir, arguments, description):
        """
        Check if shortcut needs to be updated by comparing properties
        
        Args:
            shortcut_path: Path to shortcut file
            target_path: Expected target path
            icon_path: Expected icon path
            working_dir: Expected working directory
            arguments: Expected arguments
            description: Expected description
        
        Returns:
            bool: True if shortcut needs update, False if it matches
        """
        if not shortcut_path.exists():
            return True
        
        try:
            existing_info = self.get_shortcut_info(shortcut_path)
            
            # Normalize paths for comparison (handle path resolution errors)
            try:
                target_path_str = str(Path(target_path).resolve())
            except (OSError, RuntimeError):
                target_path_str = str(Path(target_path))
            
            try:
                existing_target = str(Path(existing_info['target']).resolve())
            except (OSError, RuntimeError):
                existing_target = str(Path(existing_info['target']))
            
            try:
                working_dir_str = str(Path(working_dir).resolve()) if working_dir else ""
            except (OSError, RuntimeError):
                working_dir_str = str(Path(working_dir)) if working_dir else ""
            
            try:
                existing_working_dir = str(Path(existing_info['working_dir']).resolve()) if existing_info['working_dir'] else ""
            except (OSError, RuntimeError):
                existing_working_dir = str(Path(existing_info['working_dir'])) if existing_info['working_dir'] else ""
            
            # Normalize icon path (resolve and compare, handle IconLocation format "path,index")
            try:
                icon_path_str = str(Path(icon_path).resolve()) if icon_path else ""
            except (OSError, RuntimeError):
                icon_path_str = str(Path(icon_path)) if icon_path else ""
            
            try:
                existing_icon_raw = existing_info['icon'].split(',')[0] if existing_info['icon'] else ""
                existing_icon = str(Path(existing_icon_raw).resolve()) if existing_icon_raw else ""
            except (OSError, RuntimeError):
                existing_icon_raw = existing_info['icon'].split(',')[0] if existing_info['icon'] else ""
                existing_icon = str(Path(existing_icon_raw)) if existing_icon_raw else ""
            
            # Compare all properties
            if existing_target != target_path_str:
                return True
            if existing_working_dir != working_dir_str:
                return True
            if existing_info['arguments'] != (arguments or ""):
                return True
            if existing_info['description'] != (description or ""):
                return True
            if existing_icon != icon_path_str:
                return True
            
            # All properties match, no update needed
            return False
        except Exception as e:
            # If we can't read shortcut info, assume it needs update
            print(f"Warning: Could not read shortcut info, will update: {e}")
            return True
    
    def create_shortcut(self, target_path, name=None, icon_path=None, working_dir=None, 
                       arguments="", description=""):
        """
        Create or modify a desktop shortcut (only updates if content differs)
        
        Args:
            target_path: Path to target executable or file
            name: Shortcut name (optional, uses basename if not provided)
            icon_path: Path to icon file (optional, uses target_path if not provided)
            working_dir: Working directory (optional, uses target's directory if not provided)
            arguments: Command line arguments (optional)
            description: Shortcut description (optional)
        
        Returns:
            Path: Path to created shortcut (.lnk file)
        """
        if not HAS_WIN32COM:
            raise RuntimeError("win32com.client is required for creating shortcuts")
        
        target_path = Path(target_path)
        if not target_path.exists():
            raise FileNotFoundError(f"Target path does not exist: {target_path}")
        
        # Generate name from basename if not provided
        if name is None:
            name = target_path.stem
        
        # Use target_path as icon if not provided
        if icon_path is None:
            icon_path = str(target_path)
        else:
            # Resolve icon path (convert PNG to ICO if needed, Windows only)
            icon_path = self._resolve_icon_path(icon_path)
        
        # Use target's directory as working directory if not provided
        if working_dir is None:
            working_dir = str(target_path.parent)
        else:
            working_dir = str(Path(working_dir))
        
        # Create shortcut path
        shortcut_path = self.desktop_path / f"{name}.lnk"
        
        # Check if shortcut exists and if it needs update
        shortcut_exists = shortcut_path.exists()
        if shortcut_exists:
            needs_update = self._shortcut_needs_update(
                shortcut_path, target_path, icon_path, working_dir, arguments, description
            )
            if not needs_update:
                print(f"Shortcut already exists and matches: {shortcut_path}")
                return shortcut_path
        
        # Create or update shortcut using COM object
        shell = win32com.client.Dispatch("WScript.Shell")
        shortcut = shell.CreateShortCut(str(shortcut_path))
        shortcut.TargetPath = str(target_path)
        shortcut.WorkingDirectory = working_dir
        shortcut.Arguments = arguments
        shortcut.Description = description
        shortcut.IconLocation = icon_path
        
        # Save shortcut
        shortcut.Save()
        
        action = "Updated" if shortcut_exists else "Created"
        print(f"{action} shortcut: {shortcut_path}")
        return shortcut_path
    
    def update_shortcut(self, shortcut_path, target_path=None, name=None, icon_path=None,
                       working_dir=None, arguments=None, description=None):
        """
        Update an existing shortcut
        
        Args:
            shortcut_path: Path to existing shortcut (.lnk file)
            target_path: New target path (optional)
            name: New shortcut name (optional)
            icon_path: New icon path (optional)
            working_dir: New working directory (optional)
            arguments: New arguments (optional)
            description: New description (optional)
        
        Returns:
            Path: Path to updated shortcut
        """
        if not HAS_WIN32COM:
            raise RuntimeError("win32com.client is required for updating shortcuts")
        
        shortcut_path = Path(shortcut_path)
        
        # If name is provided and different, rename the shortcut
        if name and shortcut_path.stem != name:
            new_path = shortcut_path.parent / f"{name}.lnk"
            if shortcut_path.exists():
                shortcut_path.rename(new_path)
            shortcut_path = new_path
        
        if not shortcut_path.exists():
            raise FileNotFoundError(f"Shortcut not found: {shortcut_path}")
        
        # Load existing shortcut
        shell = win32com.client.Dispatch("WScript.Shell")
        shortcut = shell.CreateShortCut(str(shortcut_path))
        
        # Update properties if provided
        if target_path:
            shortcut.TargetPath = str(Path(target_path))
        if icon_path:
            # Resolve icon path (convert PNG to ICO if needed, Windows only)
            resolved_icon = self._resolve_icon_path(icon_path)
            shortcut.IconLocation = resolved_icon
        elif target_path:
            shortcut.IconLocation = str(Path(target_path))
        if working_dir:
            shortcut.WorkingDirectory = str(Path(working_dir))
        if arguments is not None:
            shortcut.Arguments = arguments
        if description is not None:
            shortcut.Description = description
        
        # Save updated shortcut
        shortcut.Save()
        
        print(f"Updated shortcut: {shortcut_path}")
        return shortcut_path
    
    def delete_shortcut(self, name):
        """
        Delete a desktop shortcut
        
        Args:
            name: Shortcut name (without .lnk extension)
        
        Returns:
            bool: True if deleted, False if not found
        """
        shortcut_path = self.desktop_path / f"{name}.lnk"
        if shortcut_path.exists():
            shortcut_path.unlink()
            print(f"Deleted shortcut: {shortcut_path}")
            return True
        else:
            print(f"Shortcut not found: {shortcut_path}")
            return False
    
    def create_group_folder(self, folder_name, target_folder_path=None):
        """
        Create a folder on desktop for grouping shortcuts
        
        Args:
            folder_name: Name of the folder
            target_folder_path: Optional target folder path (if folder_name is .lnk, links to this)
        
        Returns:
            Path: Path to created folder or folder shortcut
        """
        if folder_name.endswith('.lnk'):
            # Create a shortcut to target folder (icon grouping)
            if target_folder_path is None:
                raise ValueError("target_folder_path is required when folder_name ends with .lnk")
            
            target_folder_path = Path(target_folder_path)
            if not target_folder_path.exists():
                raise FileNotFoundError(f"Target folder does not exist: {target_folder_path}")
            
            # Create folder shortcut
            folder_shortcut = self.desktop_path / folder_name
            self.create_shortcut(
                target_path=target_folder_path,
                name=folder_name[:-4],  # Remove .lnk extension
                icon_path=None,
                description=f"Shortcut to {target_folder_path}"
            )
            
            # Rename to .lnk if needed
            shortcut_path = self.desktop_path / f"{folder_name[:-4]}.lnk"
            if shortcut_path.exists() and folder_shortcut != shortcut_path:
                shortcut_path.rename(folder_shortcut)
            
            print(f"Created folder shortcut: {folder_shortcut}")
            return folder_shortcut
        else:
            # Create actual folder
            folder_path = self.desktop_path / folder_name
            folder_path.mkdir(exist_ok=True)
            print(f"Created folder: {folder_path}")
            return folder_path
    
    def create_shortcut_in_folder(self, folder_path, target_path, name=None, icon_path=None,
                                 working_dir=None, arguments="", description=""):
        """
        Create shortcut inside a folder (for grouping)
        
        Args:
            folder_path: Path to folder (desktop folder or folder shortcut)
            target_path: Path to target executable or file
            name: Shortcut name (optional)
            icon_path: Path to icon file (optional)
            working_dir: Working directory (optional)
            arguments: Command line arguments (optional)
            description: Shortcut description (optional)
        
        Returns:
            Path: Path to created shortcut
        """
        # Resolve folder path if it's a shortcut
        actual_folder_path = self.resolve_folder_path(folder_path)
        
        # Create shortcut in the folder
        target_path = Path(target_path)
        if name is None:
            name = target_path.stem
        
        shortcut_path = actual_folder_path / f"{name}.lnk"
        
        # Use same logic as create_shortcut but in the folder
        if not HAS_WIN32COM:
            raise RuntimeError("win32com.client is required for creating shortcuts")
        
        if icon_path is None:
            icon_path = str(target_path)
        else:
            icon_path = str(Path(icon_path))
        
        if working_dir is None:
            working_dir = str(target_path.parent)
        else:
            working_dir = str(Path(working_dir))
        
        shell = win32com.client.Dispatch("WScript.Shell")
        shortcut = shell.CreateShortCut(str(shortcut_path))
        shortcut.TargetPath = str(target_path)
        shortcut.WorkingDirectory = working_dir
        shortcut.Arguments = arguments
        shortcut.Description = description
        shortcut.IconLocation = icon_path
        shortcut.Save()
        
        print(f"Created shortcut in folder: {shortcut_path}")
        return shortcut_path
    
    def resolve_folder_path(self, folder_path):
        """
        Resolve folder path (handles .lnk shortcuts)
        
        Args:
            folder_path: Path to folder or folder shortcut
        
        Returns:
            Path: Resolved actual folder path
        """
        folder_path = Path(folder_path)
        
        # If it's a .lnk file, resolve the target
        if folder_path.suffix.lower() == '.lnk':
            if not HAS_WIN32COM:
                raise RuntimeError("win32com.client is required for resolving shortcuts")
            
            shell = win32com.client.Dispatch("WScript.Shell")
            shortcut = shell.CreateShortCut(str(folder_path))
            target = shortcut.TargetPath
            
            # Check if target is a directory
            target_path = Path(target)
            if target_path.is_dir():
                return target_path
            else:
                raise ValueError(f"Shortcut target is not a directory: {target}")
        
        # If it's already a directory, return as is
        if folder_path.is_dir():
            return folder_path
        
        # If it's on desktop, check if it exists
        desktop_folder = self.desktop_path / folder_path.name
        if desktop_folder.exists() and desktop_folder.is_dir():
            return desktop_folder
        
        # Otherwise assume it's a relative path to desktop folder
        return self.desktop_path / folder_path
    
    def batch_create_shortcuts(self, shortcuts_config):
        """
        Batch create multiple shortcuts
        
        Args:
            shortcuts_config: List of dicts, each containing:
                - target_path: Required
                - name: Optional
                - icon_path: Optional
                - working_dir: Optional
                - arguments: Optional
                - description: Optional
                - folder: Optional folder path to create shortcut in
        
        Returns:
            list: List of created shortcut paths
        """
        created = []
        for config in shortcuts_config:
            target_path = config.get('target_path')
            if not target_path:
                print("Warning: Skipping shortcut - target_path required")
                continue
            
            # Extract folder if provided
            folder = config.pop('folder', None)
            
            if folder:
                # Create in folder
                shortcut_path = self.create_shortcut_in_folder(
                    folder_path=folder,
                    **config
                )
            else:
                # Create on desktop
                shortcut_path = self.create_shortcut(**config)
            
            created.append(shortcut_path)
        
        return created
    
    def create_grouped_shortcuts(self, group_name, shortcuts_config, target_folder_path=None):
        """
        Create a group folder and shortcuts inside it
        
        Args:
            group_name: Name of the group folder
            shortcuts_config: List of shortcut configs (see batch_create_shortcuts)
            target_folder_path: Optional target folder for .lnk group
        
        Returns:
            tuple: (group_path, list of shortcut paths)
        """
        # Create group folder
        group_path = self.create_group_folder(group_name, target_folder_path)
        
        # Create shortcuts in the group
        shortcut_paths = []
        for config in shortcuts_config:
            config['folder'] = group_path
            shortcut_path = self.create_shortcut_in_folder(
                folder_path=group_path,
                **config
            )
            shortcut_paths.append(shortcut_path)
        
        return (group_path, shortcut_paths)
    
    def list_desktop_shortcuts(self):
        """
        List all shortcuts on desktop
        
        Returns:
            list: List of shortcut paths
        """
        shortcuts = []
        for item in self.desktop_path.iterdir():
            if item.suffix.lower() == '.lnk' and item.is_file():
                shortcuts.append(item)
        return shortcuts
    
    def get_shortcut_info(self, shortcut_path):
        """
        Get information about a shortcut
        
        Args:
            shortcut_path: Path to shortcut (.lnk file)
        
        Returns:
            dict: Shortcut information (target, icon, working_dir, arguments, description)
        """
        if not HAS_WIN32COM:
            raise RuntimeError("win32com.client is required")
        
        shortcut_path = Path(shortcut_path)
        if not shortcut_path.exists():
            raise FileNotFoundError(f"Shortcut not found: {shortcut_path}")
        
        shell = win32com.client.Dispatch("WScript.Shell")
        shortcut = shell.CreateShortCut(str(shortcut_path))
        
        return {
            'name': shortcut_path.stem,
            'target': shortcut.TargetPath,
            'icon': shortcut.IconLocation,
            'working_dir': shortcut.WorkingDirectory,
            'arguments': shortcut.Arguments,
            'description': shortcut.Description
        }


def main():
    """Example usage"""
    generator = DesktopIconGenerator()
    
    print(f"Desktop path: {generator.desktop_path}")
    print(f"\nAvailable shortcuts:")
    shortcuts = generator.list_desktop_shortcuts()
    for shortcut in shortcuts[:5]:  # Show first 5
        info = generator.get_shortcut_info(shortcut)
        print(f"  {info['name']}: {info['target']}")


if __name__ == '__main__':
    main()

