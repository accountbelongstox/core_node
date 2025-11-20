#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Base Utilities

Basic utility functions
"""

import hashlib
import uuid
from typing import Any
from urllib.parse import urlparse


class BaseUtils:
    """Basic utility functions"""

    @staticmethod
    def generate_id() -> str:
        """
        Generate unique ID

        Returns:
            UUID string
        """
        return str(uuid.uuid4())

    @staticmethod
    def hash_string(text: str) -> str:
        """
        Hash string using MD5

        Args:
            text: Input text

        Returns:
            MD5 hash
        """
        return hashlib.md5(text.encode()).hexdigest()

    @staticmethod
    def is_valid_url(url: str) -> bool:
        """
        Check if string is valid URL

        Args:
            url: URL string

        Returns:
            True if valid
        """
        result = urlparse(url)
        return bool(result.scheme and result.netloc)
