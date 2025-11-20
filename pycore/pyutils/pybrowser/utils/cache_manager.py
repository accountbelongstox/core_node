#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cache Manager

Caching functionality for browser automation
"""

import time
from typing import Dict, Any, Optional
from pycore.pyfoundations.color_print import ColorPrint


class CacheManager:
    """Cache manager for storing temporary data"""

    def __init__(self, ttl: int = 3600):
        """
        Initialize cache manager

        Args:
            ttl: Time to live in seconds
        """
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl

    def set(self, key: str, value: Any, ttl: int = None):
        """
        Set cache entry

        Args:
            key: Cache key
            value: Cache value
            ttl: Time to live (optional)
        """
        expiry = time.time() + (ttl if ttl is not None else self.ttl)
        self.cache[key] = {
            'value': value,
            'expiry': expiry
        }
        ColorPrint.debug(f"Cache set: {key}")

    def get(self, key: str) -> Optional[Any]:
        """
        Get cache entry

        Args:
            key: Cache key

        Returns:
            Cached value or None
        """
        entry = self.cache.get(key)
        if not entry:
            return None

        if time.time() > entry['expiry']:
            del self.cache[key]
            return None

        return entry['value']

    def delete(self, key: str):
        """
        Delete cache entry

        Args:
            key: Cache key
        """
        if key in self.cache:
            del self.cache[key]
            ColorPrint.debug(f"Cache deleted: {key}")

    def clear(self):
        """Clear all cache entries"""
        self.cache.clear()
        ColorPrint.debug('Cache cleared')

    def cleanup_expired(self):
        """Remove expired cache entries"""
        current_time = time.time()
        expired_keys = [
            key for key, entry in self.cache.items()
            if current_time > entry['expiry']
        ]

        for key in expired_keys:
            del self.cache[key]

        if expired_keys:
            ColorPrint.debug(f"Removed {len(expired_keys)} expired entries")
