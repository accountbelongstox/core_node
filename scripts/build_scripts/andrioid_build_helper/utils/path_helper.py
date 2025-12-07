#!/usr/bin/env python3
"""
Path Helper Module
Unified path handling utilities for the Flutter Bloom build system
Ensures consistent path format across Python and PowerShell

BEST PRACTICES FOR PATH HANDLING
==================================

1. ALWAYS use PathHelper for cross-language path operations
   - Python → PowerShell: Use normalize_for_powershell()
   - Flutter commands: Use normalize_for_flutter()
   - Windows file ops: Use normalize_for_windows()

2. When generating PowerShell scripts from Python:
   ```python
   from utils.path_helper import PathHelper

   # Bad:
   script_path = r"C:\\Users\\Test\\script.ps1".replace('\\\\', '/')

   # Good:
   script_path = PathHelper.normalize_for_powershell(r"C:\\Users\\Test\\script.ps1")
   ```

3. When writing paths to file variables (for PS/Python interop):
   ```python
   # Always normalize before storing
   unified_vars.set_file_variable(
       unified_vars.KEY_BUILD_ROOT,
       PathHelper.normalize_for_powershell(build_root)
   )
   ```

4. When building Flutter commands:
   ```python
   entry_file = PathHelper.normalize_for_flutter("lib/apps/app_wuy/main.dart")
   flutter_cmd = f"flutter build apk -t {entry_file}"
   ```

5. PowerShell script generation:
   ```python
   script_content = f'''
   Set-Location "{PathHelper.normalize_for_powershell(build_root)}"
   & "{PathHelper.normalize_for_powershell(script_path)}"
   '''
   ```

6. Batch path normalization:
   ```python
   paths = ['C:\\path1', 'D:\\path2', 'E:\\path3']
   normalized = PathHelper.normalize_batch(paths, for_powershell=True)
   ```

7. Joining paths safely:
   ```python
   # Bad:
   full_path = base + '/' + sub + '/' + file

   # Good:
   full_path = PathHelper.join(base, sub, file)
   ```

COMMON PITFALLS TO AVOID
=========================

DO NOT use string replacement directly:
   path.replace(backslash, forward_slash)

DO use PathHelper:
   PathHelper.normalize_for_powershell(path)

DO NOT hardcode separators:
   path = "C:" + backslash + folder + backslash + file

DO use join:
   path = PathHelper.join("C:", folder, file)

DO NOT mix path formats in the same script:
   powershell_path = path.replace(backslash, forward_slash)
   windows_path = path.replace(forward_slash, backslash)

DO be consistent:
   powershell_path = PathHelper.normalize_for_powershell(path)
   windows_path = PathHelper.normalize_for_windows(path)

WHY THIS MATTERS
=================

1. Cross-platform compatibility (Windows/Linux/Mac)
2. PowerShell/Python interoperability
3. Escape character issues (backslash is escape in many contexts)
4. UNC path handling (//server/share)
5. Relative vs absolute path handling
6. Consistent behavior across the entire build system
"""

import os
import re
from pathlib import Path, PureWindowsPath, PurePosixPath
from typing import Union, List, Optional


class PathHelper:
    """
    Global path processing helper
    Provides unified path handling for cross-platform compatibility
    """

    # Path format constants
    WINDOWS_SEPARATOR = '\\'
    UNIX_SEPARATOR = '/'
    POWERSHELL_SEPARATOR = '/'  # PowerShell accepts forward slashes

    @staticmethod
    def normalize_for_powershell(path: Union[str, Path]) -> str:
        """
        Normalize path for PowerShell execution
        PowerShell accepts both backslashes and forward slashes,
        but forward slashes are safer for avoiding escape issues

        Args:
            path: Input path (string or Path object)

        Returns:
            Normalized path with forward slashes

        Example:
            >>> PathHelper.normalize_for_powershell('C:\\\\Users\\\\Test\\\\file.txt')
            'C:/Users/Test/file.txt'
        """
        if not path:
            return ""

        try:
            path_str = str(path)

            # Replace multiple backslashes with single forward slash
            path_str = re.sub(r'\\+', '/', path_str)

            # Replace multiple forward slashes with single forward slash
            path_str = re.sub(r'/+', '/', path_str)

            # Remove leading slash if it's not a UNC path (//server/share)
            if path_str.startswith('/') and not path_str.startswith('//'):
                path_str = path_str[1:]

            return path_str
        except Exception as e:
            # If normalization fails, return original path as string
            print(f"[PathHelper WARNING] Failed to normalize path '{path}': {e}")
            return str(path)

    @staticmethod
    def normalize_for_windows(path: Union[str, Path]) -> str:
        """
        Normalize path for Windows file system operations

        Args:
            path: Input path (string or Path object)

        Returns:
            Normalized path with backslashes

        Example:
            >>> PathHelper.normalize_for_windows('C:/Users/Test/file.txt')
            'C:\\Users\\Test\\file.txt'
        """
        if not path:
            return ""

        path_str = str(path)

        # Replace multiple forward slashes with single backslash
        path_str = re.sub(r'/+', '\\', path_str)

        # Replace multiple backslashes with single backslash
        path_str = re.sub(r'\\+', '\\', path_str)

        return path_str

    @staticmethod
    def normalize_for_flutter(path: Union[str, Path]) -> str:
        """
        Normalize path for Flutter command-line arguments
        Flutter accepts forward slashes on all platforms

        Args:
            path: Input path (string or Path object)

        Returns:
            Normalized path with forward slashes

        Example:
            >>> PathHelper.normalize_for_flutter('lib\\apps\\app_wuy\\main.dart')
            'lib/apps/app_wuy/main.dart'
        """
        return PathHelper.normalize_for_powershell(path)

    @staticmethod
    def to_absolute(path: Union[str, Path], base_dir: Optional[Union[str, Path]] = None) -> str:
        """
        Convert relative path to absolute path

        Args:
            path: Input path (can be relative or absolute)
            base_dir: Base directory for relative paths (default: current working directory)

        Returns:
            Absolute path

        Example:
            >>> PathHelper.to_absolute('build/output', '/home/user/project')
            '/home/user/project/build/output'
        """
        if not path:
            return ""

        path_obj = Path(path)

        if path_obj.is_absolute():
            return str(path_obj)

        if base_dir:
            base_path = Path(base_dir)
        else:
            base_path = Path.cwd()

        return str(base_path / path_obj)

    @staticmethod
    def to_relative(path: Union[str, Path], base_dir: Union[str, Path]) -> str:
        """
        Convert absolute path to relative path

        Args:
            path: Input absolute path
            base_dir: Base directory to calculate relative path from

        Returns:
            Relative path

        Example:
            >>> PathHelper.to_relative('/home/user/project/build/output', '/home/user/project')
            'build/output'
        """
        if not path or not base_dir:
            return ""

        try:
            path_obj = Path(path)
            base_obj = Path(base_dir)
            return str(path_obj.relative_to(base_obj))
        except ValueError:
            # Paths are not relative to each other
            return str(path)

    @staticmethod
    def ensure_trailing_slash(path: Union[str, Path], separator: str = '/') -> str:
        """
        Ensure path ends with a separator

        Args:
            path: Input path
            separator: Separator to use (default: forward slash)

        Returns:
            Path with trailing separator

        Example:
            >>> PathHelper.ensure_trailing_slash('C:/Users/Test')
            'C:/Users/Test/'
        """
        if not path:
            return ""

        path_str = str(path)

        if not path_str.endswith(separator):
            return path_str + separator

        return path_str

    @staticmethod
    def remove_trailing_slash(path: Union[str, Path]) -> str:
        """
        Remove trailing slashes from path

        Args:
            path: Input path

        Returns:
            Path without trailing slashes

        Example:
            >>> PathHelper.remove_trailing_slash('C:/Users/Test/')
            'C:/Users/Test'
        """
        if not path:
            return ""

        path_str = str(path)

        # Remove trailing slashes (both / and \)
        while path_str and path_str[-1] in ('/', '\\'):
            path_str = path_str[:-1]

        return path_str

    @staticmethod
    def join(*paths: Union[str, Path], for_powershell: bool = True) -> str:
        """
        Join multiple path components

        Args:
            *paths: Path components to join
            for_powershell: If True, normalize for PowerShell (default: True)

        Returns:
            Joined path

        Example:
            >>> PathHelper.join('C:/Users', 'Test', 'Documents', 'file.txt')
            'C:/Users/Test/Documents/file.txt'
        """
        if not paths:
            return ""

        try:
            # Filter out empty paths
            valid_paths = [str(p) for p in paths if p]

            if not valid_paths:
                return ""

            # Use Path to join
            joined = Path(valid_paths[0])
            for p in valid_paths[1:]:
                joined = joined / p

            if for_powershell:
                return PathHelper.normalize_for_powershell(joined)
            else:
                return str(joined)
        except Exception as e:
            print(f"[PathHelper WARNING] Failed to join paths {paths}: {e}")
            # Fallback: simple string concatenation with forward slashes
            return '/'.join(str(p) for p in paths if p)

    @staticmethod
    def get_parent(path: Union[str, Path], levels: int = 1) -> str:
        """
        Get parent directory path

        Args:
            path: Input path
            levels: Number of levels to go up (default: 1)

        Returns:
            Parent directory path

        Example:
            >>> PathHelper.get_parent('C:/Users/Test/Documents/file.txt', 2)
            'C:/Users/Test'
        """
        if not path:
            return ""

        path_obj = Path(path)

        for _ in range(levels):
            path_obj = path_obj.parent

        return str(path_obj)

    @staticmethod
    def get_filename(path: Union[str, Path], with_extension: bool = True) -> str:
        """
        Get filename from path

        Args:
            path: Input path
            with_extension: Include file extension (default: True)

        Returns:
            Filename

        Example:
            >>> PathHelper.get_filename('C:/Users/Test/file.txt', with_extension=True)
            'file.txt'
            >>> PathHelper.get_filename('C:/Users/Test/file.txt', with_extension=False)
            'file'
        """
        if not path:
            return ""

        path_obj = Path(path)

        if with_extension:
            return path_obj.name
        else:
            return path_obj.stem

    @staticmethod
    def get_extension(path: Union[str, Path], with_dot: bool = True) -> str:
        """
        Get file extension from path

        Args:
            path: Input path
            with_dot: Include leading dot (default: True)

        Returns:
            File extension

        Example:
            >>> PathHelper.get_extension('file.txt', with_dot=True)
            '.txt'
            >>> PathHelper.get_extension('file.txt', with_dot=False)
            'txt'
        """
        if not path:
            return ""

        path_obj = Path(path)
        ext = path_obj.suffix

        if not with_dot and ext.startswith('.'):
            ext = ext[1:]

        return ext

    @staticmethod
    def change_extension(path: Union[str, Path], new_extension: str) -> str:
        """
        Change file extension

        Args:
            path: Input path
            new_extension: New extension (with or without leading dot)

        Returns:
            Path with new extension

        Example:
            >>> PathHelper.change_extension('file.txt', '.md')
            'file.md'
        """
        if not path:
            return ""

        path_obj = Path(path)

        # Ensure extension has leading dot
        if new_extension and not new_extension.startswith('.'):
            new_extension = '.' + new_extension

        return str(path_obj.with_suffix(new_extension))

    @staticmethod
    def exists(path: Union[str, Path]) -> bool:
        """
        Check if path exists

        Args:
            path: Path to check

        Returns:
            True if path exists, False otherwise
        """
        if not path:
            return False

        return Path(path).exists()

    @staticmethod
    def is_absolute(path: Union[str, Path]) -> bool:
        """
        Check if path is absolute

        Args:
            path: Path to check

        Returns:
            True if path is absolute, False otherwise
        """
        if not path:
            return False

        return Path(path).is_absolute()

    @staticmethod
    def normalize_batch(paths: List[Union[str, Path]], for_powershell: bool = True) -> List[str]:
        """
        Normalize a batch of paths

        Args:
            paths: List of paths to normalize
            for_powershell: If True, normalize for PowerShell (default: True)

        Returns:
            List of normalized paths

        Example:
            >>> PathHelper.normalize_batch(['C:\\Users\\Test', 'D:\\Projects\\App'])
            ['C:/Users/Test', 'D:/Projects/App']
        """
        if for_powershell:
            return [PathHelper.normalize_for_powershell(p) for p in paths]
        else:
            return [PathHelper.normalize_for_windows(p) for p in paths]

    @staticmethod
    def escape_for_powershell(path: Union[str, Path]) -> str:
        """
        Escape path for PowerShell string interpolation
        Wraps path in quotes if it contains spaces

        Args:
            path: Input path

        Returns:
            Escaped path for PowerShell

        Example:
            >>> PathHelper.escape_for_powershell('C:/Program Files/App')
            '"C:/Program Files/App"'
        """
        if not path:
            return ""

        normalized = PathHelper.normalize_for_powershell(path)

        # If path contains spaces, wrap in quotes
        if ' ' in normalized:
            return f'"{normalized}"'

        return normalized

    @staticmethod
    def create_dict_entry(key: str, path: Union[str, Path], for_powershell: bool = True) -> dict:
        """
        Create a dictionary entry with normalized path
        Useful for building path dictionaries

        Args:
            key: Dictionary key
            path: Path value
            for_powershell: If True, normalize for PowerShell (default: True)

        Returns:
            Dictionary with single key-value pair

        Example:
            >>> PathHelper.create_dict_entry('build_root', 'C:\\Users\\Test\\build')
            {'build_root': 'C:/Users/Test/build'}
        """
        if for_powershell:
            normalized = PathHelper.normalize_for_powershell(path)
        else:
            normalized = PathHelper.normalize_for_windows(path)

        return {key: normalized}


# Singleton instance for easy import
path_helper = PathHelper()


# Convenience functions for common operations
def normalize_path(path: Union[str, Path], target: str = 'powershell') -> str:
    """
    Convenience function to normalize path based on target

    Args:
        path: Input path
        target: Target format ('powershell', 'windows', 'flutter')

    Returns:
        Normalized path
    """
    if target.lower() == 'powershell':
        return PathHelper.normalize_for_powershell(path)
    elif target.lower() == 'windows':
        return PathHelper.normalize_for_windows(path)
    elif target.lower() == 'flutter':
        return PathHelper.normalize_for_flutter(path)
    else:
        return PathHelper.normalize_for_powershell(path)


def join_paths(*paths: Union[str, Path]) -> str:
    """
    Convenience function to join paths (PowerShell format)

    Args:
        *paths: Paths to join

    Returns:
        Joined path
    """
    return PathHelper.join(*paths, for_powershell=True)


# Example usage and testing
if __name__ == "__main__":
    # Test cases
    print("=== Path Helper Test Cases ===\n")

    # Test normalize_for_powershell
    test_path = r"C:\Users\Test\Documents\file.txt"
    print(f"Original: {test_path}")
    print(f"PowerShell: {PathHelper.normalize_for_powershell(test_path)}")
    print(f"Windows: {PathHelper.normalize_for_windows(test_path)}")
    print(f"Flutter: {PathHelper.normalize_for_flutter(test_path)}\n")

    # Test join
    print(f"Join: {PathHelper.join('C:/Users', 'Test', 'Documents', 'file.txt')}\n")

    # Test parent
    print(f"Parent (1 level): {PathHelper.get_parent(test_path, 1)}")
    print(f"Parent (2 levels): {PathHelper.get_parent(test_path, 2)}\n")

    # Test filename
    print(f"Filename with ext: {PathHelper.get_filename(test_path, True)}")
    print(f"Filename no ext: {PathHelper.get_filename(test_path, False)}")
    print(f"Extension: {PathHelper.get_extension(test_path)}\n")

    # Test batch normalize
    paths = [r"C:\Users\Test", r"D:\Projects\App", "lib\\apps\\main.dart"]
    print(f"Batch normalize: {PathHelper.normalize_batch(paths)}\n")

    # Test escape
    path_with_spaces = "C:/Program Files/My App/file.txt"
    print(f"Escaped: {PathHelper.escape_for_powershell(path_with_spaces)}")
