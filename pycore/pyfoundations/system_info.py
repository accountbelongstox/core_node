#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Information Module

Provides cross-platform system information collection.
Only uses Python standard library (no third-party packages).

Features:
- Screen resolution detection
- Memory information
- Disk information (Windows: drive letters, Linux: df -h)
- CPU information
- System version
"""

import os
import sys
import platform
import subprocess
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class ScreenInfo:
    """Screen resolution information"""
    width: int
    height: int

    def __str__(self) -> str:
        return f"{self.width}x{self.height}"

    @property
    def aspect_ratio(self) -> float:
        """Calculate aspect ratio"""
        return self.width / self.height if self.height > 0 else 0.0


@dataclass
class MemoryInfo:
    """Memory information"""
    total_mb: int
    total_gb: float

    def __str__(self) -> str:
        return f"{self.total_gb:.1f}GB ({self.total_mb}MB)"


@dataclass
class DiskInfo:
    """Disk information"""
    mount_point: str  # Windows: "C:", Linux: "/"
    total_gb: float
    used_gb: float
    free_gb: float
    usage_percent: float

    def __str__(self) -> str:
        return f"{self.mount_point}: {self.used_gb:.1f}GB/{self.total_gb:.1f}GB ({self.usage_percent:.1f}%)"


def get_screen_resolution() -> Optional[ScreenInfo]:
    """
    Get primary screen resolution (cross-platform).

    Windows: Uses ctypes to call GetSystemMetrics
    Linux: Tries xrandr, xdpyinfo, or falls back to environment variables

    Returns:
        ScreenInfo object or None if detection fails
    """
    system = platform.system()

    if system == 'Windows':
        # Windows: Use ctypes
        from ctypes import windll
        width = windll.user32.GetSystemMetrics(0)
        height = windll.user32.GetSystemMetrics(1)
        if width > 0 and height > 0:
            return ScreenInfo(width=width, height=height)

    elif system == 'Linux':
        # Try xrandr first
        result = subprocess.run(
            ['xrandr'],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                if ' connected' in line and 'primary' in line:
                    # Parse line like: "eDP-1 connected primary 1920x1080+0+0"
                    parts = line.split()
                    for part in parts:
                        if 'x' in part and '+' in part:
                            resolution = part.split('+')[0]
                            width, height = resolution.split('x')
                            return ScreenInfo(width=int(width), height=int(height))

        # Fallback: Try xdpyinfo
        result = subprocess.run(
            ['xdpyinfo'],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            width, height = None, None
            for line in result.stdout.split('\n'):
                if 'dimensions:' in line:
                    # Parse "  dimensions:    1920x1080 pixels"
                    parts = line.split()
                    if len(parts) >= 2:
                        resolution = parts[1]
                        if 'x' in resolution:
                            w, h = resolution.split('x')
                            return ScreenInfo(width=int(w), height=int(h))

    return None


def get_memory_info() -> Optional[MemoryInfo]:
    """
    Get system memory information (cross-platform).

    Windows: Uses ctypes to call GlobalMemoryStatusEx
    Linux: Reads /proc/meminfo

    Returns:
        MemoryInfo object or None if detection fails
    """
    system = platform.system()

    if system == 'Windows':
        # Use ctypes to call GlobalMemoryStatusEx (more reliable than wmic)
        from ctypes import Structure, c_uint32, c_uint64, sizeof, windll, byref

        class MEMORYSTATUSEX(Structure):
            _fields_ = [
                ("dwLength", c_uint32),
                ("dwMemoryLoad", c_uint32),
                ("ullTotalPhys", c_uint64),
                ("ullAvailPhys", c_uint64),
                ("ullTotalPageFile", c_uint64),
                ("ullAvailPageFile", c_uint64),
                ("ullTotalVirtual", c_uint64),
                ("ullAvailVirtual", c_uint64),
                ("sullAvailExtendedVirtual", c_uint64),
            ]

        stat = MEMORYSTATUSEX()
        stat.dwLength = sizeof(MEMORYSTATUSEX)
        result = windll.kernel32.GlobalMemoryStatusEx(byref(stat))

        if result != 0:  # Success
            total_bytes = stat.ullTotalPhys
            total_mb = total_bytes // (1024 * 1024)
            total_gb = total_mb / 1024.0
            return MemoryInfo(total_mb=total_mb, total_gb=total_gb)

    elif system == 'Linux':
        # Read /proc/meminfo
        if os.path.exists('/proc/meminfo'):
            with open('/proc/meminfo', 'r') as f:
                for line in f:
                    if line.startswith('MemTotal:'):
                        # Parse "MemTotal:       16384000 kB"
                        parts = line.split()
                        if len(parts) >= 2:
                            total_kb = int(parts[1])
                            total_mb = total_kb // 1024
                            total_gb = total_mb / 1024.0
                            return MemoryInfo(total_mb=total_mb, total_gb=total_gb)

    return None


def get_windows_disk_info() -> List[DiskInfo]:
    """
    Get Windows disk information for all available drives.

    Returns:
        List of DiskInfo objects
    """
    import string
    from ctypes import windll, c_ulonglong, c_wchar_p, byref

    disks = []

    # Get available drive letters
    bitmask = windll.kernel32.GetLogicalDrives()
    for letter in string.ascii_uppercase:
        if bitmask & 1:
            drive = f'{letter}:\\'

            # Get disk space info
            free_bytes = c_ulonglong(0)
            total_bytes = c_ulonglong(0)

            result = windll.kernel32.GetDiskFreeSpaceExW(
                c_wchar_p(drive),
                byref(free_bytes),
                byref(total_bytes),
                None
            )

            if result:
                total_gb = total_bytes.value / (1024**3)
                free_gb = free_bytes.value / (1024**3)
                used_gb = total_gb - free_gb
                usage_percent = (used_gb / total_gb * 100) if total_gb > 0 else 0.0

                disks.append(DiskInfo(
                    mount_point=f"{letter}:",
                    total_gb=total_gb,
                    used_gb=used_gb,
                    free_gb=free_gb,
                    usage_percent=usage_percent
                ))

        bitmask >>= 1

    return disks


def get_linux_disk_info() -> List[DiskInfo]:
    """
    Get Linux disk information using df command.

    Returns:
        List of DiskInfo objects
    """
    disks = []

    # Run df -h
    result = subprocess.run(
        ['df', '-h'],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        lines = result.stdout.strip().split('\n')

        # Skip header line
        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 6:
                # df output: Filesystem Size Used Avail Use% Mounted
                filesystem = parts[0]
                size = parts[1]
                used = parts[2]
                avail = parts[3]
                usage_percent_str = parts[4].rstrip('%')
                mount_point = parts[5]

                # Skip special filesystems
                if filesystem.startswith('/dev/'):
                    # Convert size strings to GB
                    total_gb = _parse_size_string(size)
                    used_gb = _parse_size_string(used)
                    free_gb = _parse_size_string(avail)

                    if usage_percent_str.isdigit():
                        usage_percent = float(usage_percent_str)
                    else:
                        usage_percent = 0.0

                    disks.append(DiskInfo(
                        mount_point=mount_point,
                        total_gb=total_gb,
                        used_gb=used_gb,
                        free_gb=free_gb,
                        usage_percent=usage_percent
                    ))

    return disks


def _parse_size_string(size_str: str) -> float:
    """
    Parse df size string (e.g., "100G", "1.5T", "500M") to GB.

    Args:
        size_str: Size string from df command

    Returns:
        Size in GB
    """
    size_str = size_str.upper()

    if size_str.endswith('T'):
        return float(size_str[:-1]) * 1024
    elif size_str.endswith('G'):
        return float(size_str[:-1])
    elif size_str.endswith('M'):
        return float(size_str[:-1]) / 1024
    elif size_str.endswith('K'):
        return float(size_str[:-1]) / (1024 * 1024)
    else:
        # Assume bytes
        return float(size_str) / (1024**3) if size_str.isdigit() else 0.0


def get_disk_info() -> List[DiskInfo]:
    """
    Get disk information (cross-platform).

    Windows: Returns all drive letters with space info
    Linux: Returns df -h output parsed as DiskInfo objects

    Returns:
        List of DiskInfo objects
    """
    system = platform.system()

    if system == 'Windows':
        return get_windows_disk_info()
    elif system == 'Linux':
        return get_linux_disk_info()
    else:
        return []


def get_system_summary() -> Dict:
    """
    Get comprehensive system information summary.

    Returns:
        Dictionary with all system information
    """
    system = platform.system()

    summary = {
        'platform': {
            'system': system,
            'version': platform.version(),
            'platform': platform.platform(),
            'machine': platform.machine(),
            'processor': platform.processor(),
        },
        'cpu': {
            'count': os.cpu_count() or 1,
            'processor': platform.processor(),
        }
    }

    # Screen resolution
    screen = get_screen_resolution()
    if screen:
        summary['screen'] = {
            'width': screen.width,
            'height': screen.height,
            'resolution': str(screen),
            'aspect_ratio': screen.aspect_ratio,
        }

    # Memory
    memory = get_memory_info()
    if memory:
        summary['memory'] = {
            'total_mb': memory.total_mb,
            'total_gb': memory.total_gb,
            'display': str(memory),
        }

    # Disk
    disks = get_disk_info()
    if disks:
        summary['disks'] = [
            {
                'mount_point': disk.mount_point,
                'total_gb': disk.total_gb,
                'used_gb': disk.used_gb,
                'free_gb': disk.free_gb,
                'usage_percent': disk.usage_percent,
                'display': str(disk),
            }
            for disk in disks
        ]

    return summary


# Auto-initialize system info on module load
SCREEN_RESOLUTION = get_screen_resolution()
MEMORY_INFO = get_memory_info()
DISK_INFO = get_disk_info()
SYSTEM_SUMMARY = get_system_summary()


__all__ = [
    'ScreenInfo',
    'MemoryInfo',
    'DiskInfo',
    'get_screen_resolution',
    'get_memory_info',
    'get_windows_disk_info',
    'get_linux_disk_info',
    'get_disk_info',
    'get_system_summary',
    'SCREEN_RESOLUTION',
    'MEMORY_INFO',
    'DISK_INFO',
    'SYSTEM_SUMMARY',
]
