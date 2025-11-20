"""Reporting helper mixin."""

from __future__ import annotations


class ReportingMixin:
    """Provides size formatting and cache statistics reporting."""

    CACHE_JSON = None  # Provided by concrete class

    def _format_size(self, size_bytes: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f}TB"

    def show_stats(self):
        print(f"\n{'='*60}")
        print("Processing Statistics")
        print(f"{'='*60}")
        print(f"Cache file: {self.CACHE_JSON}")

        cache = self._read_cache_safe()
        print(f"Last update: {cache.get('last_update', 'N/A')}")
        print("\nFile statistics:")
        print(f"  - Total files: {len(cache['files'])}")

        status_count = {}
        for info in cache['files'].values():
            status = info.get('status', 'unknown')
            status_count[status] = status_count.get(status, 0) + 1

        for status, count in status_count.items():
            print(f"  - {status}: {count}")

        print("\nDirectory info:")
        print(f"  - Source: {self.SOURCE_DIR}")
        print(f"  - Temp: {self.TMP_DIR}")
        print(f"  - Compressed: {self.COMPRESS_DIR}")
        print(f"{'='*60}")
