#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Utilities

Helper functions for file and directory operations
"""

import os
from pathlib import Path
from typing import Optional, Union
from pycore.pyfoundations.color_print import ColorPrint


class FileUtils:
    """
    File Utility Class

    Provides common file and directory operations for browser automation.
    All methods are static and can be used independently.
    """

    @staticmethod
    def ensure_directory(path: Union[str, Path], log: bool = True) -> bool:
        """
        Ensure directory exists (create if needed)

        Args:
            path: Directory path (str or Path object)
            log: Log creation message (default: True)

        Returns:
            True if directory exists or was created, False if failed

        Example:
            FileUtils.ensure_directory('/path/to/output')
            FileUtils.ensure_directory(Path('/path/to/output'))
        """
        if not path:
            ColorPrint.red('[FileUtils] Path is required')
            return False

        try:
            # Convert to Path if string
            if isinstance(path, str):
                path = Path(path)

            # Handle file paths (ensure parent directory)
            if path.suffix:
                path = path.parent

            # Create directory if doesn't exist
            if not path.exists():
                path.mkdir(parents=True, exist_ok=True)
                if log:
                    ColorPrint.blue(f'[FileUtils] Created directory: {path}')

            return True
        except Exception as error:
            ColorPrint.red(f'[FileUtils] Failed to create directory {path}: {error}')
            return False

    @staticmethod
    def ensure_file_directory(filepath: Union[str, Path], log: bool = True) -> bool:
        """
        Ensure directory exists for a file path

        Extracts parent directory from file path and ensures it exists.

        Args:
            filepath: File path (str or Path object)
            log: Log creation message (default: True)

        Returns:
            True if successful, False if failed

        Example:
            FileUtils.ensure_file_directory('/path/to/file.txt')
            # Creates /path/to/ directory
        """
        if not filepath:
            ColorPrint.red('[FileUtils] File path is required')
            return False

        try:
            if isinstance(filepath, str):
                filepath = Path(filepath)

            directory = filepath.parent
            return FileUtils.ensure_directory(directory, log=log)
        except Exception as error:
            ColorPrint.red(f'[FileUtils] Failed to ensure directory for {filepath}: {error}')
            return False

    @staticmethod
    def get_next_filename(
        directory: Union[str, Path],
        prefix: str = 'file',
        extension: str = 'txt',
        start: int = 1,
        padding: int = 4
    ) -> str:
        """
        Generate next sequential filename in directory

        Scans directory for existing files with pattern: {prefix}_{number}.{extension}
        Returns next available filename.

        Args:
            directory: Target directory
            prefix: Filename prefix (default: 'file')
            extension: File extension without dot (default: 'txt')
            start: Starting number (default: 1)
            padding: Zero-padding width (default: 4)

        Returns:
            Full file path as string

        Example:
            path = FileUtils.get_next_filename('/output', 'screenshot', 'png')
            # Returns: '/output/screenshot_0001.png'

            path = FileUtils.get_next_filename('/output', 'log', 'txt', start=100)
            # Returns: '/output/log_0100.txt'
        """
        if not directory:
            ColorPrint.red('[FileUtils] Directory is required')
            return None

        # Ensure directory exists
        FileUtils.ensure_directory(directory, log=False)

        # Convert to Path
        if isinstance(directory, str):
            directory = Path(directory)

        # Find existing files with pattern
        pattern = f'{prefix}_*.{extension}'
        existing_files = list(directory.glob(pattern))

        # Extract numbers from filenames
        numbers = []
        for file in existing_files:
            stem = file.stem  # filename without extension
            # Extract number part after prefix_
            try:
                parts = stem.split('_')
                if len(parts) >= 2:
                    num = int(parts[-1])
                    numbers.append(num)
            except ValueError:
                continue

        # Determine next number
        if numbers:
            next_num = max(numbers) + 1
        else:
            next_num = start

        # Format filename
        filename = f'{prefix}_{next_num:0{padding}d}.{extension}'
        full_path = directory / filename

        ColorPrint.debug(f'[FileUtils] Generated filename: {full_path}')
        return str(full_path)

    @staticmethod
    def file_exists(path: Union[str, Path]) -> bool:
        """
        Check if file exists

        Args:
            path: File path

        Returns:
            True if file exists, False otherwise
        """
        if not path:
            return False

        if isinstance(path, str):
            path = Path(path)

        return path.exists() and path.is_file()

    @staticmethod
    def directory_exists(path: Union[str, Path]) -> bool:
        """
        Check if directory exists

        Args:
            path: Directory path

        Returns:
            True if directory exists, False otherwise
        """
        if not path:
            return False

        if isinstance(path, str):
            path = Path(path)

        return path.exists() and path.is_dir()

    @staticmethod
    def get_file_size(path: Union[str, Path]) -> Optional[int]:
        """
        Get file size in bytes

        Args:
            path: File path

        Returns:
            File size in bytes, or None if file doesn't exist
        """
        if not path:
            return None

        if isinstance(path, str):
            path = Path(path)

        if not path.exists() or not path.is_file():
            return None

        try:
            return path.stat().st_size
        except Exception as error:
            ColorPrint.red(f'[FileUtils] Failed to get file size for {path}: {error}')
            return None

    @staticmethod
    def normalize_path(path: Union[str, Path], absolute: bool = False) -> str:
        """
        Normalize path (resolve . and .. , convert separators)

        Args:
            path: Path to normalize
            absolute: If True, convert to absolute path (default: False)

        Returns:
            Normalized path as string

        Example:
            normalized = FileUtils.normalize_path('../test/./file.txt')
            # Returns: '../test/file.txt'
        """
        if not path:
            return ''

        if isinstance(path, str):
            path = Path(path)

        if absolute:
            path = path.resolve()
        else:
            # Just normalize without resolving to absolute
            path = Path(os.path.normpath(str(path)))

        return str(path)


__all__ = ['FileUtils']
