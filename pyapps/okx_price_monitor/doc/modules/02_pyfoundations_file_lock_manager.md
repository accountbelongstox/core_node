# pyfoundations.file_lock_manager - Multi-Process File Locking

## Overview

The `file_lock_manager.py` module provides a robust multi-process file locking mechanism for coordinating access to shared files across independent Python processes. Unlike thread locks, this module uses file system operations to coordinate between completely separate processes running on the same machine.

## Module Location

```
pycore/pyfoundations/file_lock_manager.py
```

## Architecture

### Multi-Process Design

This module is designed for coordination between **MULTIPLE INDEPENDENT PROCESSES**, not threads within a single Python process.

**Example Scenario:**
```
Terminal 1: python client_a.py  (PID 1234)
Terminal 2: python client_b.py  (PID 5678)
Terminal 3: python client_c.py  (PID 9012)
```

All three processes access the same data file and use FileLockManager to coordinate exclusive access through file system locks.

### Lock Structure

**Windows:**
```
C:\Users\{username}\.core_node\.cache\_lck\{md5}\{timestamp}.{pid}.lck
```

**Linux:**
```
/var/_core_node/_cache/_lck/{md5}/{timestamp}.{pid}.lck
```

## Dependencies

- Python Standard Library Only:
  - `json` - JSON serialization
  - `os` - Operating system interface
  - `sys` - System parameters
  - `time` - Time operations
  - `hashlib` - MD5 hashing
  - `contextlib` - Context managers
  - `pathlib.Path` - Filesystem paths
  - `typing` - Type hints

## Core Class: FileLockManager

### Class Definition

```python
class FileLockManager:
    """
    Multi-Process File Lock Manager
    
    Features:
    - Cross-platform cache directory support (Windows/Linux)
    - MD5-based lock directory isolation
    - Timestamp-based lock files (no content reading needed)
    - 5-minute zombie lock detection
    - Automatic retry on lock contention (1 second interval)
    - JSON read/write/update operations
    - Process-safe atomic operations
    """
```

### Configuration Constants

```python
LOCK_TIMEOUT_SECONDS = 300  # 5 minutes - zombie lock detection
LOCK_RETRY_INTERVAL = 1.0   # 1 second - retry interval
```

### Constructor

```python
def __init__(
    self,
    file_path: str | Path,
    default_factory: Optional[Callable[[], JsonData]] = None,
    *,
    json_indent: int = 2,
    indent: int = None,  # Compatibility alias
    lock_timeout: int = LOCK_TIMEOUT_SECONDS,
    retry_interval: float = LOCK_RETRY_INTERVAL,
    retry_delay: float = None,  # Compatibility alias
    max_retries: int = None,  # Compatibility (ignored)
    verbose: bool = True,
):
```

**Parameters:**
- `file_path` - Path to the file to manage
- `default_factory` - Factory function for default JSON content
- `json_indent` - JSON indentation (default: 2)
- `lock_timeout` - Lock timeout in seconds (default: 300)
- `retry_interval` - Retry interval in seconds (default: 1.0)
- `verbose` - Enable verbose logging (default: True)

### Private Methods

#### _get_cache_directory() -> Path

Returns platform-specific cache directory:
- Windows: `C:\Users\{username}\.core_node\.cache`
- Linux: `/var/_core_node/_cache`

#### _calculate_path_hash(path: str) -> str

Calculates MD5 hash of file path for lock directory isolation:

```python
@staticmethod
def _calculate_path_hash(path: str) -> str:
    md5 = hashlib.md5()
    md5.update(path.encode('utf-8'))
    return md5.hexdigest()
```

#### _get_lock_files() -> list[Path]

Returns all lock files in the lock directory, sorted by creation time (newest first).

#### _is_lock_stale(lock_file: Path) -> bool

Checks if a lock file is stale (older than timeout threshold):

```python
def _is_lock_stale(self, lock_file: Path) -> bool:
    if not lock_file.exists():
        return True
    stat = lock_file.stat()
    created_at = getattr(stat, 'st_ctime', stat.st_mtime)
    age = time.time() - created_at
    return age > self.lock_timeout
```

#### _cleanup_stale_locks()

Removes all stale lock files from the lock directory.

#### _check_self_deadlock(lock_file: Path) -> bool

Prevents self-deadlock by checking if a lock file belongs to the current process:

```python
def _check_self_deadlock(self, lock_file: Path) -> bool:
    parts = lock_file.stem.split('.')
    if len(parts) < 2:
        return False
    if not parts[-1].isdigit():
        return False
    lock_pid = int(parts[-1])
    return lock_pid == os.getpid()
```

### Public Methods

#### lock() - Context Manager

Acquires exclusive file lock:

```python
@contextmanager
def lock(self):
    """
    Context manager for acquiring exclusive file lock
    
    Usage:
        with manager.lock():
            # ... exclusive access ...
            pass
    """
    self._acquire_lock()
    try:
        yield
    finally:
        self._release_lock()
```

#### _acquire_lock()

Lock acquisition algorithm:

1. Create lock directory if needed
2. Scan for existing lock files
3. Clean up stale locks (older than timeout)
4. Check for self-deadlock (own PID)
5. If active locks exist, wait and retry
6. Create new lock file with timestamp + PID

**Lock File Format:**
```
{timestamp_microseconds}.{pid}.lck
```

**Example:**
```
1699123456789012.12345.lck
```

#### _release_lock()

Releases the acquired lock and sleeps 0.5 seconds to give other processes fair access.

#### read_json() -> JsonData

Reads JSON file with exclusive lock:

```python
def read_json(self) -> JsonData:
    with self.lock():
        return self._load_json_from_disk()
```

#### write_json(data: JsonData)

Writes JSON file with exclusive lock:

```python
def write_json(self, data: JsonData):
    with self.lock():
        self._write_json_to_disk(data)
```

#### update_json(mutator: Callable[[JsonData], Any])

Atomic read-modify-write operation:

```python
def update_json(self, mutator: Callable[[JsonData], Any]):
    with self.lock():
        data = self._load_json_from_disk()
        mutator(data)
        self._write_json_to_disk(data)
```

**Example:**
```python
def increment_counter(data):
    data['counter'] = data.get('counter', 0) + 1

manager.update_json(increment_counter)
```

#### ensure_file_exists()

Ensures target file exists with default content.

#### get_lock_status() -> Dict[str, Any]

Returns current lock status for debugging:

```python
{
    'file_path': '/path/to/data.json',
    'lock_dir': '/var/_core_node/_cache/_lck/abc123...',
    'path_hash': 'abc123...',
    'lock_count': 1,
    'locks': [
        {
            'filename': '1699123456789012.12345.lck',
            'pid': 12345,
            'age_seconds': 2.5,
            'is_stale': False
        }
    ]
}
```

### Atomic Write Implementation

The `_write_json_to_disk()` method uses atomic write to prevent data loss:

```python
def _write_json_to_disk(self, data: JsonData):
    # Ensure parent directory exists
    self.file_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Use PID + timestamp for unique tmp file name
    pid = os.getpid()
    timestamp = int(time.time() * 1000000)
    tmp_path = self.file_path.parent / f".{self.file_path.name}.tmp.{pid}.{timestamp}"
    
    # Write to tmp file
    with tmp_path.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=self.json_indent)
        f.flush()
        os.fsync(f.fileno())
    
    # Atomic replace
    tmp_path.replace(self.file_path)
```

**Key Features:**
1. Writes to temporary file first
2. Uses `fsync()` to ensure data is flushed to disk
3. Uses `replace()` for atomic file replacement
4. Prevents data loss on crash

## Usage Examples

### Basic Usage

```python
from pycore.pyfoundations.file_lock_manager import FileLockManager

# Create manager for a file
manager = FileLockManager('/path/to/data.json')

# Read JSON
data = manager.read_json()

# Write JSON
manager.write_json({'key': 'value'})

# Update JSON atomically
def mutator(data):
    data['counter'] = data.get('counter', 0) + 1
manager.update_json(mutator)
```

### With Default Factory

```python
manager = FileLockManager(
    '/path/to/data.json',
    default_factory=lambda: {'counter': 0, 'items': []},
    verbose=True
)

# File will be created with default content if not exists
manager.ensure_file_exists()
```

### Manual Lock Control

```python
manager = FileLockManager('/path/to/data.json')

with manager.lock():
    # Exclusive access to file
    data = manager._load_json_from_disk()
    # ... perform operations ...
    manager._write_json_to_disk(data)
```

### Multi-Process Coordination

**Process A (client_a.py):**
```python
from pycore.pyfoundations.file_lock_manager import FileLockManager

manager = FileLockManager('/shared/counter.json')

for i in range(10):
    manager.update_json(lambda d: d.update({'count': d.get('count', 0) + 1}))
    print(f"Process A incremented counter to {manager.read_json()['count']}")
```

**Process B (client_b.py):**
```python
from pycore.pyfoundations.file_lock_manager import FileLockManager

manager = FileLockManager('/shared/counter.json')

for i in range(10):
    manager.update_json(lambda d: d.update({'count': d.get('count', 0) + 1}))
    print(f"Process B incremented counter to {manager.read_json()['count']}")
```

**Result:** Both processes coordinate access, counter reaches 20.

## Compatibility API

For compatibility with `ThreadSafeJsonStore`:

```python
# These are equivalent:
manager.read_json()  # New API
manager.read()       # Compatibility alias

manager.write_json(data)  # New API
manager.write(data)       # Compatibility alias

manager.update_json(mutator)  # New API
manager.update(mutator)       # Compatibility alias

manager.ensure_file_exists()  # New API
manager.ensure_file()         # Compatibility alias
```

## Lock Debugging

### Check Lock Status

```python
manager = FileLockManager('/path/to/data.json')
status = manager.get_lock_status()

print(f"Lock directory: {status['lock_dir']}")
print(f"Active locks: {status['lock_count']}")

for lock in status['locks']:
    print(f"  PID {lock['pid']}: age={lock['age_seconds']}s, stale={lock['is_stale']}")
```

### Manual Lock Directory Inspection

```bash
# Windows
dir C:\Users\%USERNAME%\.core_node\.cache\_lck\

# Linux
ls -la /var/_core_node/_cache/_lck/
```

## Error Handling

The module follows pycore error handling guidelines:
- Lets errors propagate naturally
- Uses verbose logging for debugging
- No try-except blocks that hide errors

## Thread Safety

This module is designed for **multi-process** coordination, not multi-threading:
- Uses file system locks (works across processes)
- Does not use threading.Lock (only works within single process)
- Each process creates its own lock file
- Lock file naming includes PID for identification

## Performance Considerations

1. **Lock Acquisition Time**: O(n) where n = number of lock files
2. **Stale Lock Cleanup**: Performed on each acquisition attempt
3. **Fairness**: 0.5s sleep after release gives other processes a chance
4. **Retry Interval**: Configurable (default 1 second)

## Best Practices

1. **Keep Lock Duration Short**: Minimize time spent holding locks
2. **Use Atomic Updates**: Prefer `update_json()` over separate read/write
3. **Set Appropriate Timeout**: Adjust based on expected operation duration
4. **Enable Verbose Mode**: Useful for debugging coordination issues
5. **Handle Process Crashes**: Stale locks auto-cleaned after timeout

## Related Modules

- `pycore.pyfoundations.split_file_store` - Split file storage using FileLockManager
- `pycore.database` - Database operations with built-in locking
- `pycore.pyfoundations.encyclopedia` - Global cache (in-process only)

