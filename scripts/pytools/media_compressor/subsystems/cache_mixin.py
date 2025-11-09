"""Cache management mixin for the media compressor."""

from __future__ import annotations

import time
from datetime import datetime
from typing import Dict


class CacheMixin:
    """Provides cache and locking helpers backed by ThreadSafeJsonStore."""

    cache_store = None  # Expected to be set by concrete class
    lock_timeout_seconds: int
    client_id: str

    def _read_cache_safe(self, max_retries=20, retry_delay=1.0, allow_empty=False, silent=False) -> Dict:
        """Read cache data using the shared JSON store."""

        if not silent:
            print(f"    Reading cache file...", end='', flush=True)

        cache_data = self.cache_store.read()
        cache_data.setdefault('files', {})

        if not silent:
            file_count = len(cache_data.get('files', {}))
            print(f" loaded {file_count} entries", flush=True)

        return cache_data

    def _write_cache_safe(self, cache_data: Dict, max_retries=20, retry_delay=1.0):
        """Write cache data back to disk via the shared store."""

        cache_data['last_update'] = datetime.now().isoformat()
        cache_data.setdefault('files', {})
        return self.cache_store.write(cache_data)

    def _update_cache_file(self, update_func, max_retries=None, retry_delay=1.0) -> bool:
        """Apply an atomic read-modify-write using the shared JSON store."""

        def mutator(cache):
            cache.setdefault('files', {})
            update_func(cache)
            cache['last_update'] = datetime.now().isoformat()

        return self.cache_store.update(
            mutator,
            max_retries=max_retries,
            retry_delay=retry_delay,
        )

    def _get_cache_snapshot(self, silent=False) -> Dict:
        """Return a full cache snapshot for read-only operations."""

        return self._read_cache_safe(silent=silent)

    def _ensure_stats_block(self, cache: Dict) -> None:
        cache.setdefault('stats', {})
        stats = cache['stats']
        stats.setdefault('total_files', 0)
        stats.setdefault('compressed', 0)
        stats.setdefault('skipped', 0)
        stats.setdefault('failed', 0)

    def _update_file_entry(self, file_key: str, *, create: bool = True, **fields) -> None:
        """Merge fields into a cache entry."""

        def updater(cache: Dict) -> None:
            self._ensure_stats_block(cache)
            if create or file_key in cache['files']:
                entry = cache['files'].setdefault(file_key, {})
                entry.update(fields)
                cache['stats']['total_files'] = len(cache['files'])

        self._update_cache_file(updater)

    def _increment_stats(self, **deltas: int) -> None:
        """Increment numeric stats counters."""

        def updater(cache: Dict) -> None:
            self._ensure_stats_block(cache)
            for key, delta in deltas.items():
                cache['stats'][key] = cache['stats'].get(key, 0) + delta

        self._update_cache_file(updater)

    def _clear_file_entry(self, file_key: str) -> None:
        """Remove a file entry from cache."""

        def updater(cache: Dict) -> None:
            if file_key in cache['files']:
                cache['files'].pop(file_key, None)
                self._ensure_stats_block(cache)
                cache['stats']['total_files'] = len(cache['files'])

        self._update_cache_file(updater)

    def _get_file_entry(self, file_key: str) -> Dict | None:
        """Retrieve a single file record."""

        snapshot = self._get_cache_snapshot()
        return snapshot['files'].get(file_key)

    def _create_empty_cache(self) -> Dict:
        return {
            'version': '1.0',
            'last_update': datetime.now().isoformat(),
            'files': {},
            'stats': {
                'total_files': 0,
                'compressed': 0,
                'skipped': 0,
                'failed': 0,
            },
        }

    def _is_lock_expired(self, file_info: Dict) -> bool:
        if 'processing_start' not in file_info:
            return True

        try:
            processing_start = datetime.fromisoformat(file_info['processing_start'])
            elapsed = (datetime.now() - processing_start).total_seconds()
            return elapsed > self.lock_timeout_seconds
        except Exception:
            return True

    def _force_release_lock(self, file_key: str, *, expected_owner: str | None = None) -> None:
        """Reset processing metadata for a stale lock."""

        def clear_lock(cache: Dict) -> None:
            entry = cache['files'].get(file_key)
            if not entry:
                return

            if expected_owner and entry.get('processing_by') != expected_owner:
                return

            entry.pop('processing_by', None)
            entry.pop('processing_start', None)

            if entry.get('status') == 'processing':
                entry['status'] = 'pending'

        self._update_cache_file(clear_lock)

    def try_acquire_lock(self, file_key: str, cache_snapshot: Dict = None) -> bool:
        # Use provided snapshot if available, otherwise read fresh (silently)
        cache = cache_snapshot if cache_snapshot is not None else self._read_cache_safe(silent=True)

        if file_key in cache['files']:
            file_info = cache['files'][file_key]
            status = file_info.get('status')

            if status in ['compressed', 'failed']:
                return False

            if 'processing_by' in file_info:
                if self._is_lock_expired(file_info):
                    # Lock expired, reclaim it silently
                    owner_id = file_info.get('processing_by')
                    if owner_id:
                        self._force_release_lock(file_key, expected_owner=owner_id)
                    else:
                        self._force_release_lock(file_key)
                else:
                    # Being processed by another client, skip silently
                    if file_info.get('processing_by') != self.client_id:
                        return False

        def acquire(cache):
            if file_key not in cache['files']:
                cache['files'][file_key] = {}

            cache['files'][file_key]['processing_by'] = self.client_id
            cache['files'][file_key]['processing_start'] = datetime.now().isoformat()
            cache['files'][file_key]['status'] = 'processing'

        return self._update_cache_file(acquire)

    def release_lock(self, file_key: str, status: str, **kwargs):
        def release(cache):
            if file_key in cache['files']:
                cache['files'][file_key].pop('processing_by', None)
                cache['files'][file_key].pop('processing_start', None)

                cache['files'][file_key]['status'] = status
                cache['files'][file_key]['timestamp'] = datetime.now().isoformat()

                for key, value in kwargs.items():
                    cache['files'][file_key][key] = value

        self._update_cache_file(release)
