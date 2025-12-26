#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Split File Store
Stores data as separate files instead of one large JSON

IMPORTANT: Multi-Process Architecture
======================================
This module is designed for coordination between MULTIPLE INDEPENDENT PROCESSES.
Each record is stored as a separate file, preventing conflicts from large file updates.
"""

import json
import hashlib
import os
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

# Import FileLockManager - handle relative vs absolute imports
FileLockManager = None
try:
    from pycore.pyfoundations.file_lock_manager import FileLockManager
except ImportError:
    pass

if FileLockManager is None:
    from file_lock_manager import FileLockManager


JsonData = Dict[str, Any]


class SplitFileStore:
    """
    Split file storage for large datasets

    Structure:
        base_dir/
            .cache/
                metadata.json          # version, last_update, stats, scan_info
                files/
                    {md5_hash}.json    # individual file records

    Features:
    - Each file record stored separately
    - MD5 hash as filename
    - Metadata in single file
    - Multi-process safe via FileLockManager
    - Compatible with ThreadSafeJsonStore API
    """

    def __init__(
        self,
        base_path: str | Path,
        default_factory: Optional[Callable[[], JsonData]] = None,
        *,
        max_retries: int = None,
        retry_delay: float = None,
        verbose: bool = False,
    ):
        """
        Initialize SplitFileStore

        Args:
            base_path: Base directory path (e.g., E:/Evidences)
            default_factory: Factory for creating default data structure
            max_retries: For compatibility (ignored)
            retry_delay: For compatibility (ignored)
            verbose: Enable verbose logging
        """
        self.base_path = Path(base_path)
        self.cache_dir = self.base_path / '.cache'
        self.files_dir = self.cache_dir / 'files'
        self.metadata_file = self.cache_dir / 'metadata.json'
        self.default_factory = default_factory or (lambda: {'files': {}})
        self.verbose = verbose

        # Ensure directories exist
        self.files_dir.mkdir(parents=True, exist_ok=True)

        # Metadata lock manager
        self.metadata_lock = FileLockManager(
            self.metadata_file,
            default_factory=lambda: {
                'version': '1.0',
                'last_update': time.time(),
                'stats': {
                    'total_files': 0,
                    'compressed': 0,
                    'skipped': 0,
                    'failed': 0,
                },
                'scan_info': {},
            },
            verbose=False,
        )

        self._log("SplitFileStore initialized")
        self._log(f"  Base: {self.base_path}")
        self._log(f"  Cache: {self.cache_dir}")
        self._log(f"  Files: {self.files_dir}")

    def _log(self, message: str):
        """Print log message if verbose"""
        if self.verbose:
            print(f"[SplitFileStore] {message}", flush=True)

    @staticmethod
    def _path_to_hash(path: str) -> str:
        """Convert file path to MD5 hash for filename"""
        md5 = hashlib.md5()
        md5.update(path.encode('utf-8'))
        return md5.hexdigest()

    def _get_record_file(self, key: str) -> Path:
        """Get file path for a specific record"""
        hash_name = self._path_to_hash(key)
        return self.files_dir / f"{hash_name}.json"

    def _read_record(self, key: str) -> Optional[Dict]:
        """Read a single record file"""
        record_file = self._get_record_file(key)
        if not record_file.exists():
            return None

        # Check if file is readable
        if not os.access(record_file, os.R_OK):
            self._log(f"Warning: Cannot read {record_file.name}: Permission denied")
            return None

        # Read and parse JSON - let errors expose naturally
        with record_file.open('r', encoding='utf-8') as f:
            return json.load(f)

    def _write_record(self, key: str, data: Dict):
        """Write a single record file"""
        record_file = self._get_record_file(key)

        # Atomic write with tmp file
        tmp_file = record_file.with_suffix('.tmp')

        # Write to temporary file
        with tmp_file.open('w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())

        # Replace original file atomically
        tmp_file.replace(record_file)

    def _delete_record(self, key: str):
        """Delete a single record file"""
        record_file = self._get_record_file(key)
        # unlink with missing_ok=True won't raise if file doesn't exist
        record_file.unlink(missing_ok=True)

    def ensure_file(self):
        """Ensure metadata file exists (compatibility)"""
        self.metadata_lock.ensure_file()

    def read(self) -> JsonData:
        """
        Read all data (compatibility with ThreadSafeJsonStore)

        Returns complete data structure with all file records
        """
        self._log("Reading all data...")

        # Read metadata
        metadata = self.metadata_lock.read()

        # Scan all record files
        files_data = {}
        record_files = list(self.files_dir.glob('*.json'))

        self._log(f"  Found {len(record_files)} record files")

        for record_file in record_files:
            # Check if file is readable
            if not os.access(record_file, os.R_OK):
                self._log(f"Warning: Cannot read {record_file.name}: Permission denied")
                continue

            # Read and parse JSON - let errors expose naturally for debugging
            with record_file.open('r', encoding='utf-8') as f:
                data = json.load(f)
                # Record file contains single entry with path as key
                if isinstance(data, dict) and len(data) == 1:
                    files_data.update(data)
                elif 'path' in data:
                    # If stored as object with path field
                    files_data[data['path']] = data

        # Combine metadata and files
        result = {
            'version': metadata.get('version', '1.0'),
            'last_update': metadata.get('last_update', time.time()),
            'stats': metadata.get('stats', {}),
            'scan_info': metadata.get('scan_info', {}),
            'files': files_data,
        }

        self._log(f"  Loaded {len(files_data)} file records")
        return result

    def write(self, data: JsonData):
        """
        Write all data (compatibility with ThreadSafeJsonStore)

        Splits data into metadata and individual record files
        """
        self._log("Writing all data...")

        # Extract metadata
        metadata = {
            'version': data.get('version', '1.0'),
            'last_update': time.time(),
            'stats': data.get('stats', {}),
            'scan_info': data.get('scan_info', {}),
        }

        # Write metadata
        self.metadata_lock.write(metadata)

        # Write individual file records
        files_data = data.get('files', {})
        self._log(f"  Writing {len(files_data)} file records")

        for key, record in files_data.items():
            self._write_record(key, {key: record})

        self._log("  Write complete")

    def update(
        self,
        mutator: Callable[[JsonData], Any],
        *,
        max_retries: Optional[int] = None,
        retry_delay: Optional[float] = None,
    ):
        """
        Update data (compatibility with ThreadSafeJsonStore)

        For split file store, this reads all data, applies mutator, then writes back.
        This is inefficient for large datasets - use update_record() instead.
        """
        self._log("Update called (full read-modify-write)")

        # For compatibility, do full read-modify-write
        data = self.read()
        mutator(data)
        self.write(data)

        return True

    def update_record(self, key: str, mutator: Callable[[Dict], Any]):
        """
        Update a single record efficiently

        Args:
            key: Record key (file path)
            mutator: Function to modify the record
        """
        self._log(f"Updating record: {key[:50]}...")

        # Read current record
        record = self._read_record(key)
        if record is None:
            # Create new record
            record = {key: {}}

        # Apply mutator to the record data
        if key in record:
            mutator(record[key])
        else:
            # Handle case where record is stored differently
            mutator(record)

        # Write updated record
        self._write_record(key, record)

        # Update metadata timestamp
        def update_timestamp(meta):
            meta['last_update'] = time.time()

        self.metadata_lock.update(update_timestamp)

    def get_record(self, key: str) -> Optional[Dict]:
        """
        Get a single record efficiently

        Args:
            key: Record key (file path)

        Returns:
            Record data or None if not found
        """
        record = self._read_record(key)
        if record and key in record:
            return record[key]
        return record

    def delete_record(self, key: str):
        """
        Delete a single record

        Args:
            key: Record key (file path)
        """
        self._log(f"Deleting record: {key[:50]}...")
        self._delete_record(key)

    def update_metadata(self, mutator: Callable[[Dict], Any]):
        """
        Update metadata only (stats, scan_info, etc.)

        Args:
            mutator: Function to modify metadata
        """
        self._log("Updating metadata...")
        self.metadata_lock.update(mutator)

    def get_metadata(self) -> Dict:
        """Get metadata only"""
        return self.metadata_lock.read()

    def list_keys(self) -> list[str]:
        """
        List all record keys efficiently (without loading data)

        Returns:
            List of file paths
        """
        keys = []
        record_files = list(self.files_dir.glob('*.json'))

        for record_file in record_files:
            # Check if file is readable
            if not os.access(record_file, os.R_OK):
                continue

            # Read and parse JSON - skip corrupted files silently
            with record_file.open('r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    keys.extend(data.keys())

        return keys


def main():
    """Test function"""
    print("=" * 60)
    print("SplitFileStore Test")
    print("=" * 60)

    # Test directory
    test_dir = Path.home() / '.core_node' / 'split_store_test'
    test_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nTest directory: {test_dir}")

    # Create store
    store = SplitFileStore(test_dir, verbose=True)

    # Test 1: Write some records
    print("\n--- Test 1: Write Records ---")
    data = {
        'version': '1.0',
        'stats': {'compressed': 5, 'failed': 1},
        'scan_info': {'total_files': 10},
        'files': {
            'path/to/file1.jpg': {
                'status': 'compressed',
                'size': 1024,
            },
            'path/to/file2.jpg': {
                'status': 'pending',
                'size': 2048,
            },
        },
    }
    store.write(data)

    # Test 2: Read back
    print("\n--- Test 2: Read Back ---")
    loaded = store.read()
    print(f"Files: {len(loaded['files'])}")
    print(f"Stats: {loaded['stats']}")

    # Test 3: Update single record
    print("\n--- Test 3: Update Single Record ---")
    def update_status(record):
        record['status'] = 'completed'
        record['timestamp'] = time.time()

    store.update_record('path/to/file1.jpg', update_status)

    # Test 4: Get single record
    print("\n--- Test 4: Get Single Record ---")
    record = store.get_record('path/to/file1.jpg')
    print(f"Record: {record}")

    # Test 5: List keys
    print("\n--- Test 5: List Keys ---")
    keys = store.list_keys()
    print(f"Keys: {keys}")

    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
