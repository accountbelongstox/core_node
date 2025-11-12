#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Mapper

Maps URLs to local file paths with intelligent extension handling
"""

import hashlib
import re
from pathlib import Path
from typing import Set
from urllib.parse import urlparse


DYNAMIC_FALLBACK_EXTENSIONS = {
    '.asp', '.aspx', '.ashx', '.jsp', '.jspx', '.php', '.php3', '.php4', '.php5', '.phtml',
    '.do', '.action', '.cfm', '.cgi', '.pl'
}


class FileMapper:
    """
    Maps URLs to local file system paths

    Features:
    - Intelligent extension detection
    - Query parameter hashing
    - Path sanitization
    - Dynamic page handling (.php, .jsp, etc.)
    """

    def __init__(self, allowed_extensions: Set[str] = None):
        """
        Initialize file mapper

        Args:
            allowed_extensions: Set of allowed file extensions
        """
        fallback_extensions = {'.html'}
        source = allowed_extensions if allowed_extensions else fallback_extensions
        normalized = {ext.lower() for ext in source if ext}
        self.allowed_extensions = normalized
        self.dynamic_extensions = DYNAMIC_FALLBACK_EXTENSIONS

    def map_path(self, parsed_url) -> str:
        """
        Map parsed URL to local file path

        Args:
            parsed_url: Parsed URL object from urlparse

        Returns:
            Local file path
        """
        pathname = parsed_url.path or '/'
        search = parsed_url.query or ''

        has_trailing_slash = pathname.endswith('/')
        segments = [s for s in pathname.split('/') if s]
        sanitized_segments = [self.sanitize(s) for s in segments if self.sanitize(s)]

        raw_last_segment = segments[-1] if segments else ''
        sanitized_last_segment = self.sanitize(raw_last_segment) if raw_last_segment else ''

        raw_extension = Path(raw_last_segment).suffix if raw_last_segment else ''
        normalized_extension = raw_extension.lower() if raw_extension else ''
        sanitized_base = self.sanitize(raw_last_segment.replace(raw_extension, '')) if raw_extension else sanitized_last_segment

        directory_segments = []
        filename = 'index'
        extension = '.html'

        if len(segments) == 0:
            filename = 'index'
            extension = '.html'
        elif has_trailing_slash:
            directory_segments.extend(sanitized_segments)
            filename = 'index'
            extension = '.html'
        elif normalized_extension:
            directory_slice = sanitized_segments[:-1]
            extension_part = normalized_extension[1:]  # Remove dot
            allowed_extension = self.is_allowed_extension(normalized_extension)
            base_is_numeric = bool(re.match(r'^[0-9]+$', sanitized_base or ''))
            looks_like_file_ext = len(extension_part) >= 2 and bool(re.match(r'^[a-zA-Z0-9]{2,8}$', extension_part))
            short_ext_looks_like_file = len(extension_part) == 1 and not base_is_numeric
            treat_as_file = allowed_extension or normalized_extension in self.dynamic_extensions or looks_like_file_ext or short_ext_looks_like_file

            if treat_as_file:
                directory_segments.extend(directory_slice)
                filename = sanitized_base or 'index'
                extension = normalized_extension if allowed_extension else '.html'
            else:
                directory_segments.extend(sanitized_segments)
                filename = 'index'
                extension = '.html'
        else:
            directory_segments.extend(sanitized_segments)
            filename = 'index'
            extension = '.html'

        # Handle query parameters with MD5 hash
        if search:
            normalized_search = search.lstrip('?')
            if normalized_search:
                hash_digest = hashlib.md5(normalized_search.encode()).hexdigest()[:8]
                filename = f"{filename}_{hash_digest}"

        # Compose final path
        safe_dir = str(Path(*directory_segments)) if directory_segments else ''
        safe_file = f"{filename}{extension}"

        if safe_dir:
            final_path = str(Path(safe_dir) / safe_file)
        else:
            final_path = safe_file

        return final_path.lstrip('/\\')

    def is_allowed_extension(self, ext: str) -> bool:
        """
        Check if extension is allowed

        Args:
            ext: File extension

        Returns:
            True if allowed
        """
        if not ext:
            return False
        return ext.lower() in self.allowed_extensions

    def sanitize(self, name: str) -> str:
        """
        Sanitize filename by replacing invalid characters

        Args:
            name: Filename to sanitize

        Returns:
            Sanitized filename
        """
        if not name:
            return ''
        return re.sub(r'[^a-zA-Z0-9._-]+', '_', name)
