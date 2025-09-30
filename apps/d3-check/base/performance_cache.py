#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Performance Cache Base Class
Provides caching functionality for improved performance
No dependencies on other project modules
"""

import os
import sys
import time
import threading
import weakref
from typing import Dict, List, Optional, Any, Callable, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field


@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    key: str
    value: Any
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: datetime = field(default_factory=datetime.now)
    access_count: int = 0
    ttl_seconds: Optional[float] = None
    
    def is_expired(self) -> bool:
        """Check if cache entry is expired"""
        if self.ttl_seconds is None:
            return False
        return (datetime.now() - self.created_at).total_seconds() > self.ttl_seconds
    
    def touch(self):
        """Update last accessed time and increment access count"""
        self.last_accessed = datetime.now()
        self.access_count += 1


class PerformanceCache:
    """
    High-performance cache with TTL, LRU eviction, and statistics
    Thread-safe implementation
    """
    
    def __init__(self, max_size: int = 1000, default_ttl: Optional[float] = None):
        """Initialize performance cache"""
        self.max_size = max_size
        self.default_ttl = default_ttl
        
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()
        
        # Statistics
        self._hits = 0
        self._misses = 0
        self._evictions = 0
        
        print(f"[CACHE] Initialized with max_size={max_size}, default_ttl={default_ttl}")
    
    def get(self, key: str, default=None) -> Any:
        """Get value from cache"""
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return default
            
            entry = self._cache[key]
            
            # Check if expired
            if entry.is_expired():
                del self._cache[key]
                self._misses += 1
                return default
            
            # Update access info
            entry.touch()
            self._hits += 1
            
            return entry.value
    
    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> bool:
        """Set value in cache"""
        with self._lock:
            # Use default TTL if not specified
            if ttl is None:
                ttl = self.default_ttl
            
            # Create cache entry
            entry = CacheEntry(key=key, value=value, ttl_seconds=ttl)
            
            # Check if we need to evict entries
            if len(self._cache) >= self.max_size and key not in self._cache:
                self._evict_lru()
            
            self._cache[key] = entry
            return True
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def clear(self):
        """Clear all cache entries"""
        with self._lock:
            cleared_count = len(self._cache)
            self._cache.clear()
            print(f"[CACHE] Cleared {cleared_count} entries")
    
    def _evict_lru(self):
        """Evict least recently used entry"""
        if not self._cache:
            return
        
        # Find LRU entry
        lru_key = min(self._cache.keys(), 
                     key=lambda k: self._cache[k].last_accessed)
        
        del self._cache[lru_key]
        self._evictions += 1
    
    def cleanup_expired(self) -> int:
        """Remove expired entries and return count"""
        with self._lock:
            expired_keys = [key for key, entry in self._cache.items() 
                           if entry.is_expired()]
            
            for key in expired_keys:
                del self._cache[key]
            
            if expired_keys:
                print(f"[CACHE] Cleaned up {len(expired_keys)} expired entries")
            
            return len(expired_keys)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = self._hits / total_requests if total_requests > 0 else 0
            
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": hit_rate,
                "evictions": self._evictions,
                "total_requests": total_requests
            }
    
    def print_stats(self):
        """Print cache statistics"""
        stats = self.get_stats()
        
        print("-" * 40)
        print("[CACHE_STATS] Performance Cache Statistics")
        print(f"Size: {stats['size']}/{stats['max_size']}")
        print(f"Hits: {stats['hits']}")
        print(f"Misses: {stats['misses']}")
        print(f"Hit Rate: {stats['hit_rate']:.1%}")
        print(f"Evictions: {stats['evictions']}")
        print(f"Total Requests: {stats['total_requests']}")
        print("-" * 40)
    
    def get_cache_info(self) -> List[Dict[str, Any]]:
        """Get detailed information about cache entries"""
        with self._lock:
            info = []
            for key, entry in self._cache.items():
                info.append({
                    "key": key,
                    "created_at": entry.created_at.isoformat(),
                    "last_accessed": entry.last_accessed.isoformat(),
                    "access_count": entry.access_count,
                    "ttl_seconds": entry.ttl_seconds,
                    "is_expired": entry.is_expired(),
                    "value_type": type(entry.value).__name__,
                    "value_size": sys.getsizeof(entry.value)
                })
            
            # Sort by last accessed (most recent first)
            info.sort(key=lambda x: x["last_accessed"], reverse=True)
            return info


class WindowMappingCache(PerformanceCache):
    """Specialized cache for window mappings"""
    
    def __init__(self, max_size: int = 100, default_ttl: float = 300):
        """Initialize window mapping cache with 5-minute default TTL"""
        super().__init__(max_size, default_ttl)
        print("[WINDOW_CACHE] Window mapping cache initialized")
    
    def get_window_mapping(self, window_handle: int):
        """Get window mapping by handle"""
        return self.get(f"window_{window_handle}")
    
    def set_window_mapping(self, window_handle: int, mapping_data: Any, ttl: Optional[float] = None):
        """Set window mapping by handle"""
        return self.set(f"window_{window_handle}", mapping_data, ttl)
    
    def invalidate_window(self, window_handle: int):
        """Invalidate specific window mapping"""
        return self.delete(f"window_{window_handle}")


class UIElementCache(PerformanceCache):
    """Specialized cache for UI elements"""
    
    def __init__(self, max_size: int = 500, default_ttl: float = 60):
        """Initialize UI element cache with 1-minute default TTL"""
        super().__init__(max_size, default_ttl)
        print("[UI_CACHE] UI element cache initialized")
    
    def get_elements(self, window_handle: int, criteria: Dict[str, Any]):
        """Get cached UI elements by criteria"""
        cache_key = f"elements_{window_handle}_{hash(str(sorted(criteria.items())))}"
        return self.get(cache_key)
    
    def set_elements(self, window_handle: int, criteria: Dict[str, Any], 
                    elements: List[Any], ttl: Optional[float] = None):
        """Cache UI elements by criteria"""
        cache_key = f"elements_{window_handle}_{hash(str(sorted(criteria.items())))}"
        return self.set(cache_key, elements, ttl)


def cached_function(cache: PerformanceCache, ttl: Optional[float] = None, 
                   key_func: Optional[Callable] = None):
    """Decorator for caching function results"""
    def decorator(func: Callable):
        def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = f"{func.__name__}_{hash(str(args) + str(sorted(kwargs.items())))}"
            
            # Try to get from cache
            result = cache.get(cache_key)
            if result is not None:
                return result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


# Global cache instances
WINDOW_MAPPING_CACHE = WindowMappingCache()
UI_ELEMENT_CACHE = UIElementCache()
GENERAL_CACHE = PerformanceCache()


def main():
    """Test function"""
    cache = PerformanceCache(max_size=5, default_ttl=2)
    
    # Test basic operations
    cache.set("key1", "value1")
    cache.set("key2", "value2", ttl=1)  # Short TTL
    
    print(f"Get key1: {cache.get('key1')}")
    print(f"Get key2: {cache.get('key2')}")
    print(f"Get missing: {cache.get('missing', 'default')}")
    
    # Test TTL expiration
    time.sleep(1.5)
    print(f"Get key2 after TTL: {cache.get('key2', 'expired')}")
    
    # Test LRU eviction
    for i in range(10):
        cache.set(f"key{i}", f"value{i}")
    
    cache.print_stats()
    
    # Test cached function
    @cached_function(cache, ttl=5)
    def expensive_function(x, y):
        print(f"Computing {x} + {y}")
        time.sleep(0.1)  # Simulate expensive operation
        return x + y
    
    # First call - should compute
    result1 = expensive_function(1, 2)
    # Second call - should use cache
    result2 = expensive_function(1, 2)
    
    print(f"Results: {result1}, {result2}")
    cache.print_stats()


if __name__ == "__main__":
    main()
