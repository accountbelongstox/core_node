"""
Storage Management for AI Collaboration MCP
Handles data persistence and cleanup
"""

import json
import time
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

class StorageManager:
    """Manages persistent storage for AI collaboration data"""

    def __init__(self, data_root: Path, max_storage_mb: int = 50):
        self.data_root = data_root
        self.max_storage_bytes = max_storage_mb * 1024 * 1024
        self._lock = threading.Lock()

        self.data_root.mkdir(parents=True, exist_ok=True)

    def save_json(self, file_path: Path, data: Any) -> bool:
        """Save data as JSON with atomic write"""
        try:
            with self._lock:
                temp_file = file_path.with_suffix('.tmp')

                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=True)

                temp_file.replace(file_path)
                return True
        except Exception as e:
            import sys
            print(f"Error saving JSON to {file_path}: {e}", file=sys.stderr)
            return False

    def load_json(self, file_path: Path, default: Any = None) -> Any:
        """Load JSON data from file"""
        try:
            if not file_path.exists():
                return default

            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            import sys
            print(f"Error loading JSON from {file_path}: {e}", file=sys.stderr)
            return default

    def append_to_queue(self, file_path: Path, item: Dict, max_length: int = 1000) -> bool:
        """Append item to a queue file and maintain max length"""
        try:
            with self._lock:
                queue = self.load_json(file_path, [])

                if not isinstance(queue, list):
                    queue = []

                queue.append(item)

                if len(queue) > max_length:
                    queue = queue[-max_length:]

                return self.save_json(file_path, queue)
        except Exception as e:
            import sys
            print(f"Error appending to queue {file_path}: {e}", file=sys.stderr)
            return False

    def get_directory_size(self, directory: Path) -> int:
        """Get total size of directory in bytes"""
        try:
            total_size = 0
            for file_path in directory.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
            return total_size
        except Exception as e:
            import sys
            print(f"Error calculating directory size: {e}", file=sys.stderr)
            return 0

    def cleanup_old_files(self, directory: Path, max_age_days: int = 30):
        """Remove files older than max_age_days"""
        try:
            with self._lock:
                cutoff_time = time.time() - (max_age_days * 24 * 60 * 60)

                for file_path in directory.rglob('*.json'):
                    if file_path.is_file():
                        if file_path.stat().st_mtime < cutoff_time:
                            file_path.unlink()
                            import sys
                            print(f"Cleaned up old file: {file_path}", file=sys.stderr)
        except Exception as e:
            import sys
            print(f"Error cleaning up old files: {e}", file=sys.stderr)

    def enforce_storage_limit(self):
        """Enforce storage size limit by removing oldest files"""
        try:
            with self._lock:
                current_size = self.get_directory_size(self.data_root)

                if current_size <= self.max_storage_bytes:
                    return

                import sys
                print(f"Storage limit exceeded: {current_size} > {self.max_storage_bytes}", file=sys.stderr)

                files = []
                for file_path in self.data_root.rglob('*.json'):
                    if file_path.is_file():
                        files.append((file_path.stat().st_mtime, file_path))

                files.sort()

                for mtime, file_path in files:
                    if current_size <= self.max_storage_bytes * 0.8:
                        break

                    try:
                        file_size = file_path.stat().st_size
                        file_path.unlink()
                        current_size -= file_size
                        print(f"Removed old file: {file_path}", file=sys.stderr)
                    except Exception as e:
                        print(f"Error removing file {file_path}: {e}", file=sys.stderr)

        except Exception as e:
            import sys
            print(f"Error enforcing storage limit: {e}", file=sys.stderr)

    def get_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        try:
            total_size = self.get_directory_size(self.data_root)

            file_count = sum(1 for _ in self.data_root.rglob('*.json'))

            return {
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'max_size_mb': self.max_storage_bytes / (1024 * 1024),
                'usage_percent': round((total_size / self.max_storage_bytes) * 100, 2),
                'file_count': file_count,
                'data_root': str(self.data_root)
            }
        except Exception as e:
            import sys
            print(f"Error getting storage stats: {e}", file=sys.stderr)
            return {'error': str(e)}
