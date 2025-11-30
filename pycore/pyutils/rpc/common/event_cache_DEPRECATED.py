#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Event Cache - Shared event cache for HTTP and WebSocket RPC

This module provides a shared event cache that can be used by both
HTTP and WebSocket RPC implementations. Events are cached with TTL
and can be retrieved by both protocols.

Reference: ncore/utils/rpc/common/cache.js and response_cache.js
"""

import time
import threading
from typing import Dict, Optional, Any, List
from collections import OrderedDict

from pycore import ColorPrint


class EventCache:
    """
    Event Cache - Shared cache for RPC events
    
    Provides caching for events that can be shared between HTTP and WebSocket
    RPC implementations. Supports TTL, automatic cleanup, and size limits.
    
    Features:
    - Memory cache with TTL
    - Automatic cleanup of expired entries
    - Size limit with LRU eviction
    - Thread-safe operations
    
    Usage:
        cache = EventCache(namespace='rpc', max_size=10000, default_ttl=1800)
        cache.set('event:123', {'data': 'value'}, ttl=3600)
        value = cache.get('event:123')
    """
    
    def __init__(
        self,
        namespace: str = 'rpc',
        max_size: int = 10000,
        default_ttl: float = 1800.0,  # 30 minutes
        cleanup_interval: float = 60.0  # 1 minute
    ):
        """
        Initialize Event Cache
        
        Args:
            namespace: Cache namespace
            max_size: Maximum cache size
            default_ttl: Default TTL in seconds
            cleanup_interval: Cleanup interval in seconds
        """
        self.namespace = namespace
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cleanup_interval = cleanup_interval
        
        # Thread-safe cache storage
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._lock = threading.RLock()
        
        # Cleanup timer
        self._cleanup_timer: Optional[threading.Timer] = None
        self._running = False
    
    def _get_key(self, key: str) -> str:
        """Get namespaced key"""
        return f"{self.namespace}:{key}"
    
    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[float] = None,
        update_access: bool = True
    ) -> bool:
        """
        Set cache value
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (None for default)
            update_access: Whether to update access time (for LRU)
            
        Returns:
            True if set successfully
        """
        with self._lock:
            # Check size limit
            if len(self._cache) >= self.max_size and key not in self._cache:
                self._evict_oldest()
            
            full_key = self._get_key(key)
            expires_at = time.time() + (ttl or self.default_ttl)
            
            self._cache[full_key] = {
                'value': value,
                'created_at': time.time(),
                'expires_at': expires_at,
                'accessed_at': time.time() if update_access else 0,
                'access_count': 0
            }
            
            # Move to end (most recently used)
            self._cache.move_to_end(full_key)
            
            return True
    
    def get(self, key: str, remove: bool = False) -> Optional[Any]:
        """
        Get cache value
        
        Args:
            key: Cache key
            remove: Whether to remove after getting
            
        Returns:
            Cached value or None
        """
        with self._lock:
            full_key = self._get_key(key)
            
            if full_key not in self._cache:
                return None
            
            cached = self._cache[full_key]
            
            # Check expiration
            if time.time() > cached['expires_at']:
                del self._cache[full_key]
                return None
            
            # Update access info
            cached['accessed_at'] = time.time()
            cached['access_count'] += 1
            
            # Move to end (most recently used)
            self._cache.move_to_end(full_key)
            
            value = cached['value']
            
            if remove:
                del self._cache[full_key]
            
            return value
    
    def has(self, key: str) -> bool:
        """
        Check if key exists and is not expired
        
        Args:
            key: Cache key
            
        Returns:
            True if key exists and is valid
        """
        with self._lock:
            full_key = self._get_key(key)
            
            if full_key not in self._cache:
                return False
            
            cached = self._cache[full_key]
            
            if time.time() > cached['expires_at']:
                del self._cache[full_key]
                return False
            
            return True
    
    def delete(self, key: str) -> bool:
        """
        Delete cache entry
        
        Args:
            key: Cache key
            
        Returns:
            True if deleted
        """
        with self._lock:
            full_key = self._get_key(key)
            if full_key in self._cache:
                del self._cache[full_key]
                return True
            return False
    
    def clear(self) -> bool:
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()
            return True
    
    def size(self) -> int:
        """Get cache size"""
        with self._lock:
            return len(self._cache)
    
    def keys(self) -> List[str]:
        """Get all cache keys (without namespace prefix)"""
        with self._lock:
            prefix = f"{self.namespace}:"
            return [
                key[len(prefix):] if key.startswith(prefix) else key
                for key in self._cache.keys()
            ]
    
    def _evict_oldest(self):
        """Evict oldest entry (LRU)"""
        if self._cache:
            # Remove first (oldest) entry
            self._cache.popitem(last=False)
    
    def cleanup(self) -> int:
        """
        Clean up expired entries
        
        Returns:
            Number of entries cleaned
        """
        with self._lock:
            now = time.time()
            cleaned = 0
            expired_keys = []
            
            for key, cached in self._cache.items():
                if now > cached['expires_at']:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self._cache[key]
                cleaned += 1
            
            # Also check size limit
            while len(self._cache) > self.max_size:
                self._evict_oldest()
                cleaned += 1
            
            return cleaned
    
    def start_auto_cleanup(self):
        """Start automatic cleanup timer"""
        if self._running:
            return
        
        self._running = True
        
        def cleanup_loop():
            if self._running:
                cleaned = self.cleanup()
                if cleaned > 0:
                    ColorPrint.blue(f"[EventCache] Cleaned {cleaned} expired entries")
                
                # Schedule next cleanup
                self._cleanup_timer = threading.Timer(self.cleanup_interval, cleanup_loop)
                self._cleanup_timer.daemon = True
                self._cleanup_timer.start()
        
        # Start first cleanup
        self._cleanup_timer = threading.Timer(self.cleanup_interval, cleanup_loop)
        self._cleanup_timer.daemon = True
        self._cleanup_timer.start()
    
    def stop_auto_cleanup(self):
        """Stop automatic cleanup timer"""
        self._running = False
        if self._cleanup_timer:
            self._cleanup_timer.cancel()
            self._cleanup_timer = None
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Dictionary with cache statistics
        """
        with self._lock:
            now = time.time()
            stats = {
                'size': len(self._cache),
                'max_size': self.max_size,
                'expired': 0,
                'active': 0,
                'total_access': 0
            }
            
            for cached in self._cache.values():
                if now > cached['expires_at']:
                    stats['expired'] += 1
                else:
                    stats['active'] += 1
                    stats['total_access'] += cached['access_count']
            
            return stats


# Default global event cache instance
default_event_cache = EventCache(namespace='rpc_default', max_size=10000, default_ttl=1800.0)
default_event_cache.start_auto_cleanup()

__all__ = ['EventCache', 'default_event_cache']

