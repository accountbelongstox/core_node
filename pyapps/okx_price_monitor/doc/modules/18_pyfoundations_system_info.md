# pyfoundations.system_info - System Information

## Overview

The `system_info` module provides cross-platform system information collection including screen resolution, memory, disk, CPU, and system version. Uses only Python standard library.

## Module Location

```
pycore/pyfoundations/system_info.py
```

## Core Components

### ScreenInfo

Screen resolution information:

```python
from pycore.pyfoundations.system_info import ScreenInfo

@dataclass
class ScreenInfo:
    width: int
    height: int
    dpi: int = 96
    
    @property
    def resolution(self) -> str:
        return f"{self.width}x{self.height}"
```

### MemoryInfo

Memory information:

```python
@dataclass
class MemoryInfo:
    total: int          # Total memory (bytes)
    available: int      # Available memory (bytes)
    used: int           # Used memory (bytes)
    percent: float      # Usage percentage
```

### DiskInfo

Disk information:

```python
@dataclass
class DiskInfo:
    path: str           # Mount path
    total: int          # Total space (bytes)
    used: int           # Used space (bytes)
    free: int           # Free space (bytes)
    percent: float      # Usage percentage
```

### CPUInfo

CPU information:

```python
@dataclass
class CPUInfo:
    cores: int          # Physical cores
    threads: int        # Logical threads
    frequency: float    # Current frequency (MHz)
    architecture: str   # x86_64, arm64, etc.
    model: str          # CPU model name
```

### SystemInfo

Complete system information:

```python
from pycore.pyfoundations.system_info import get_system_info

info = get_system_info()

# Screen
print(f"Screen: {info.screen.resolution}")

# Memory
print(f"Memory: {info.memory.used / 1e9:.1f}GB / {info.memory.total / 1e9:.1f}GB")

# Disk
for disk in info.disks:
    print(f"Disk {disk.path}: {disk.free / 1e9:.1f}GB free")

# CPU
print(f"CPU: {info.cpu.model} ({info.cpu.cores} cores)")

# System
print(f"OS: {info.os_name} {info.os_version}")
print(f"Python: {info.python_version}")
print(f"Hostname: {info.hostname}")
```

## Usage Examples

### Get All Info

```python
from pycore.pyfoundations.system_info import get_system_info

info = get_system_info()

print("=== System Information ===")
print(f"OS: {info.os_name} {info.os_version}")
print(f"Hostname: {info.hostname}")
print(f"Python: {info.python_version}")

print("\n=== CPU ===")
print(f"Model: {info.cpu.model}")
print(f"Cores: {info.cpu.cores}")
print(f"Threads: {info.cpu.threads}")

print("\n=== Memory ===")
print(f"Total: {info.memory.total / (1024**3):.1f} GB")
print(f"Available: {info.memory.available / (1024**3):.1f} GB")
print(f"Usage: {info.memory.percent:.1f}%")

print("\n=== Disks ===")
for disk in info.disks:
    print(f"{disk.path}: {disk.free / (1024**3):.1f} GB free ({disk.percent:.1f}% used)")

print("\n=== Screen ===")
print(f"Resolution: {info.screen.resolution}")
```

### Monitor Resources

```python
from pycore.pyfoundations.system_info import get_system_info
import time

while True:
    info = get_system_info()
    
    print(f"\rCPU: {info.cpu.frequency}MHz | "
          f"Memory: {info.memory.percent:.1f}% | "
          f"Disk: {info.disks[0].percent:.1f}%", end="")
    
    time.sleep(1)
```

## Platform Support

- Windows: Full support
- Linux: Full support
- macOS: Full support

## Best Practices

1. **Cache Results**: Don't call get_system_info() too frequently
2. **Handle Missing**: Some info may be unavailable on certain platforms
3. **Unit Conversion**: Results are in bytes, convert as needed

## Exports

```python
__all__ = [
    'ScreenInfo',
    'MemoryInfo',
    'DiskInfo',
    'CPUInfo',
    'SystemInfo',
    'get_system_info',
    'get_screen_info',
    'get_memory_info',
    'get_disk_info',
    'get_cpu_info',
]
```















