#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Mapper

Maps URLs to local file paths for document offline downloads.
"""

import os
from pathlib import Path
from urllib.parse import urlparse, unquote
from typing import Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.pybrowser.utils.file_utils import FileUtils


class FileMapper:
    """
    URL to file path mapper

    Maps URLs to local file system paths while preserving URL structure.

    Features:
    - Handles 30+ file extensions
    - Auto-adds index.html for directories
    - Preserves URL structure in local filesystem
    - Cross-platform path handling
    - URL decode support
    """

    # Common file extensions that should be preserved
    KNOWN_EXTENSIONS = {
        # HTML/XML
        '.html', '.htm', '.xhtml', '.xml', '.svg',
        # Stylesheets
        '.css', '.scss', '.sass', '.less',
        # Scripts
        '.js', '.mjs', '.ts', '.jsx', '.tsx',
        # Images
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.bmp', '.svg',
        # Fonts
        '.woff', '.woff2', '.ttf', '.otf', '.eot',
        # Documents
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        # Media
        '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.avi', '.mov',
        # Data
        '.json', '.yaml', '.yml', '.csv', '.txt', '.md',
        # Archives
        '.zip', '.tar', '.gz', '.rar', '.7z'
    }

    def __init__(self, base_dir: str, origin: str):
        """
        Initialize file mapper

        Args:
            base_dir: Base directory for saving files
            origin: Origin of the website (e.g., 'https://example.com')
        """
        self.base_dir = Path(base_dir)
        self.origin = origin

        # Create base directory if needed
        if not self.base_dir.exists():
            self.base_dir.mkdir(parents=True, exist_ok=True)
            ColorPrint.green(f'[FileMapper] Created base directory: {self.base_dir}')

    def url_to_filepath(self, url: str, content_type: Optional[str] = None) -> str:
        """
        Convert URL to local file path

        Args:
            url: URL to convert
            content_type: Optional Content-Type header (e.g., 'text/html')

        Returns:
            Local file path (relative to base_dir)
        """
        parsed = urlparse(url)

        # URL decode the path
        path = unquote(parsed.path)

        # Remove leading slash
        if path.startswith('/'):
            path = path[1:]

        # Handle empty path (root)
        if not path:
            return 'index.html'

        # Check if path has extension
        _, ext = os.path.splitext(path)

        # If path ends with '/', add index.html
        if path.endswith('/'):
            return f'{path}index.html'

        # If path has known extension, use as-is
        if ext.lower() in self.KNOWN_EXTENSIONS:
            return path

        # If no extension, check content_type
        if content_type:
            if 'html' in content_type.lower():
                # HTML content without extension -> add .html
                return f'{path}.html'
            elif 'css' in content_type.lower():
                return f'{path}.css'
            elif 'javascript' in content_type.lower():
                return f'{path}.js'
            elif 'json' in content_type.lower():
                return f'{path}.json'
            elif 'xml' in content_type.lower():
                return f'{path}.xml'

        # Check if path looks like a directory (no extension)
        if not ext:
            # Treat as directory, add index.html
            return f'{path}/index.html'

        # Unknown extension, use as-is
        return path

    def get_absolute_path(self, url: str, content_type: Optional[str] = None) -> Path:
        """
        Get absolute file path for URL

        Args:
            url: URL to convert
            content_type: Optional Content-Type header

        Returns:
            Absolute Path object
        """
        relative_path = self.url_to_filepath(url, content_type)
        absolute_path = self.base_dir / relative_path
        return absolute_path

    def ensure_directory(self, filepath: Path):
        """
        Ensure directory exists for file path

        Delegates to FileUtils for consistency.

        Args:
            filepath: File path (Path object)
        """
        FileUtils.ensure_file_directory(filepath, log=False)

    def filepath_to_url(self, filepath: str) -> str:
        """
        Convert local file path back to URL

        Args:
            filepath: Local file path (relative to base_dir)

        Returns:
            URL string
        """
        # Normalize path separators
        filepath = filepath.replace('\\', '/')

        # Remove index.html if present
        if filepath.endswith('/index.html'):
            filepath = filepath[:-10]  # Remove 'index.html'
        elif filepath == 'index.html':
            filepath = ''

        # Add leading slash
        if filepath and not filepath.startswith('/'):
            filepath = '/' + filepath

        # Construct URL
        url = f'{self.origin}{filepath}'

        return url

    def get_resource_path(self, base_url: str, resource_url: str, content_type: Optional[str] = None) -> str:
        """
        Get relative path from base URL to resource URL

        Used for calculating relative paths in HTML/CSS.

        Args:
            base_url: Base page URL
            resource_url: Resource URL (can be relative or absolute)
            content_type: Optional Content-Type of resource

        Returns:
            Relative file path
        """
        # Convert both to file paths
        base_filepath = Path(self.url_to_filepath(base_url))
        resource_filepath = Path(self.url_to_filepath(resource_url, content_type))

        # Calculate relative path
        if base_filepath.parent == resource_filepath.parent:
            # Same directory
            return resource_filepath.name
        else:
            # Different directory, calculate relative path
            try:
                relative = os.path.relpath(
                    resource_filepath,
                    base_filepath.parent
                )
                # Normalize path separators for web
                return relative.replace('\\', '/')
            except ValueError:
                # Different drives on Windows, return absolute path
                return str(resource_filepath).replace('\\', '/')

    def get_stats(self) -> dict:
        """
        Get file mapper statistics

        Returns:
            Dictionary with mapper stats
        """
        return {
            'base_dir': str(self.base_dir),
            'origin': self.origin,
            'base_dir_exists': self.base_dir.exists(),
            'known_extensions': len(self.KNOWN_EXTENSIONS)
        }


__all__ = ['FileMapper']
