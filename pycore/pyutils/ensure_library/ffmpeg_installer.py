#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FFmpeg Installation Manager

Automatically detects, downloads, and installs FFmpeg on Windows/Linux.
No try-except blocks - uses project-standard tools.

Supported Platforms:
- Windows: Downloads from gyan.dev (essentials build)
- Linux: Uses apt-get (Debian/Ubuntu)

Author: Pycore Team
"""

import os
import sys
import platform
import shutil
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon import Commander
from pycore.pyfoundations.system_paths import map_web_path
from pycore.pyutils.common.robust_downloader import RobustDownloader

# FFmpeg download URLs (gyan.dev builds - updated 2025-12-18)
# Source: https://www.gyan.dev/ffmpeg/builds/
FFMPEG_WINDOWS_URL = "https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-2025-12-10-git-4f947880bd-essentials_build.7z"
FFMPEG_WINDOWS_FALLBACK_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z"

# Installation directories
# Windows: D:\_win10\ffmpeg\ or D:\_win11\ffmpeg\
# Linux: /mnt/d/_ubuntu24/ffmpeg/ or similar
FFMPEG_INSTALL_DIR = map_web_path("compile_dir", "ffmpeg")


def get_system_platform():
    """
    Get normalized system platform name

    Returns:
        str: 'windows', 'linux', 'darwin', or 'unknown'
    """
    system = platform.system().lower()

    if system == 'windows':
        return 'windows'
    elif system == 'linux':
        return 'linux'
    elif system == 'darwin':
        return 'darwin'
    else:
        return 'unknown'


def check_command_exists(command):
    """
    Check if a command exists in PATH

    Args:
        command: Command name (e.g., 'ffmpeg', '7z')

    Returns:
        str or None: Full path to command if found, None otherwise
    """
    result = shutil.which(command)
    return result


def check_ffmpeg_in_path():
    """
    Check if FFmpeg is already in system PATH

    Returns:
        str or None: Full path to ffmpeg executable if found
    """
    ColorPrint.blue("[FFmpegInstaller] Checking if FFmpeg is in PATH...")

    ffmpeg_path = check_command_exists('ffmpeg')

    if ffmpeg_path:
        ColorPrint.green(f"[FFmpegInstaller] ✓ FFmpeg found in PATH: {ffmpeg_path}")

        # Verify it works by getting version
        result = Commander.exec_silent([ffmpeg_path, '-version'])

        if result.success:
            version_line = result.get_output().split('\n')[0]
            ColorPrint.green(f"[FFmpegInstaller] ✓ {version_line}")
            return ffmpeg_path
        else:
            ColorPrint.yellow(f"[FFmpegInstaller] ✗ FFmpeg found but not working: {ffmpeg_path}")
            return None
    else:
        ColorPrint.yellow("[FFmpegInstaller] ✗ FFmpeg not found in PATH")
        return None


def check_ffmpeg_in_install_dir():
    """
    Check if FFmpeg is in our managed installation directory

    Returns:
        str or None: Full path to ffmpeg executable if found
    """
    ColorPrint.blue(f"[FFmpegInstaller] Checking managed install directory: {FFMPEG_INSTALL_DIR}")

    if not os.path.exists(FFMPEG_INSTALL_DIR):
        ColorPrint.yellow(f"[FFmpegInstaller] Install directory does not exist: {FFMPEG_INSTALL_DIR}")
        return None

    # Search for ffmpeg executable in install directory and subdirectories
    system_platform = get_system_platform()

    if system_platform == 'windows':
        executable_name = 'ffmpeg.exe'
    else:
        executable_name = 'ffmpeg'

    # Search recursively
    for root, dirs, files in os.walk(FFMPEG_INSTALL_DIR):
        if executable_name in files:
            ffmpeg_path = os.path.join(root, executable_name)
            ColorPrint.green(f"[FFmpegInstaller] ✓ Found FFmpeg in install dir: {ffmpeg_path}")

            # Verify it works
            result = Commander.exec_silent([ffmpeg_path, '-version'])

            if result.success:
                version_line = result.get_output().split('\n')[0]
                ColorPrint.green(f"[FFmpegInstaller] ✓ {version_line}")
                return ffmpeg_path
            else:
                ColorPrint.yellow(f"[FFmpegInstaller] ✗ FFmpeg found but not working: {ffmpeg_path}")
                continue

    ColorPrint.yellow("[FFmpegInstaller] ✗ FFmpeg not found in install directory")
    return None


def download_file(url, destination):
    """
    Download file from URL to destination using RobustDownloader

    Args:
        url: Download URL
        destination: Destination file path

    Returns:
        bool: True if download succeeded
    """
    ColorPrint.blue(f"[FFmpegInstaller] Downloading from: {url}")
    ColorPrint.blue(f"[FFmpegInstaller] Destination: {destination}")

    # Create parent directory
    os.makedirs(os.path.dirname(destination), exist_ok=True)

    # Use RobustDownloader with retry support
    downloader = RobustDownloader(
        max_retries=5,
        timeout=120,  # 120s timeout for large FFmpeg packages
        chunk_size=8192,
        retry_delay=2.0,
        max_retry_delay=30.0
    )

    def progress_callback(downloaded: int, total: int, attempt: int):
        if total > 0:
            # Progress indicator every 10MB
            if downloaded % (10 * 1024 * 1024) < 8192 or downloaded == total:
                progress = (downloaded / total * 100)
                mb_downloaded = downloaded / (1024 * 1024)
                mb_total = total / (1024 * 1024)
                ColorPrint.blue(f"[FFmpegInstaller] Attempt {attempt}/5: {progress:.1f}% ({mb_downloaded:.2f}/{mb_total:.2f} MB)")

    success = downloader.download(url, Path(destination), progress_callback)

    if success:
        ColorPrint.green(f"[FFmpegInstaller] ✓ Download complete: {destination}")
    else:
        ColorPrint.red(f"[FFmpegInstaller] ✗ Download failed")

    return success


def extract_7z_windows(archive_path, extract_to):
    """
    Extract 7z archive on Windows

    Args:
        archive_path: Path to 7z archive
        extract_to: Extraction destination directory

    Returns:
        bool: True if extraction succeeded
    """
    ColorPrint.blue(f"[FFmpegInstaller] Extracting 7z archive: {archive_path}")
    ColorPrint.blue(f"[FFmpegInstaller] Extract to: {extract_to}")

    # Check if 7z is available
    seven_zip_path = check_command_exists('7z')

    if not seven_zip_path:
        ColorPrint.yellow("[FFmpegInstaller] 7z not found in PATH, trying common installation paths...")

        # Common 7-Zip installation paths
        common_paths = [
            r"C:\Program Files\7-Zip\7z.exe",
            r"C:\Program Files (x86)\7-Zip\7z.exe",
        ]

        for path in common_paths:
            if os.path.exists(path):
                seven_zip_path = path
                ColorPrint.green(f"[FFmpegInstaller] ✓ Found 7z at: {seven_zip_path}")
                break

    if not seven_zip_path:
        ColorPrint.red("[FFmpegInstaller] ✗ 7-Zip not found. Please install 7-Zip first.")
        ColorPrint.yellow("[FFmpegInstaller] Download from: https://www.7-zip.org/")
        ColorPrint.yellow("[FFmpegInstaller] Or run: winget install 7zip.7zip")
        return False

    # Create extraction directory
    os.makedirs(extract_to, exist_ok=True)

    # Extract using 7z
    result = Commander.exec_realtime(
        [seven_zip_path, 'x', archive_path, f'-o{extract_to}', '-y'],
        info=True,
        show_output=True
    )

    if result.success:
        ColorPrint.green(f"[FFmpegInstaller] ✓ Extraction complete")
        return True
    else:
        ColorPrint.red(f"[FFmpegInstaller] ✗ Extraction failed")
        return False


def install_ffmpeg_windows():
    """
    Install FFmpeg on Windows

    Returns:
        str or None: Path to ffmpeg.exe if successful
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[FFmpegInstaller] Installing FFmpeg on Windows")
    ColorPrint.blue("=" * 80)

    # Download archive
    archive_path = os.path.join(FFMPEG_INSTALL_DIR, "ffmpeg-essentials.7z")

    download_success = download_file(FFMPEG_WINDOWS_URL, archive_path)

    if not download_success:
        ColorPrint.yellow("[FFmpegInstaller] Primary download failed, trying fallback URL...")
        download_success = download_file(FFMPEG_WINDOWS_FALLBACK_URL, archive_path)

    if not download_success:
        ColorPrint.red("[FFmpegInstaller] ✗ Download failed")
        return None

    # Extract archive
    extract_success = extract_7z_windows(archive_path, FFMPEG_INSTALL_DIR)

    if not extract_success:
        ColorPrint.red("[FFmpegInstaller] ✗ Extraction failed")
        return None

    # Find ffmpeg.exe in extracted files
    ColorPrint.blue("[FFmpegInstaller] Searching for ffmpeg.exe in extracted files...")

    ffmpeg_path = None
    for root, dirs, files in os.walk(FFMPEG_INSTALL_DIR):
        if 'ffmpeg.exe' in files:
            candidate_path = os.path.join(root, 'ffmpeg.exe')

            # Verify it's in a bin directory (to avoid finding it in other places)
            if 'bin' in root.lower():
                ffmpeg_path = candidate_path
                ColorPrint.green(f"[FFmpegInstaller] ✓ Found ffmpeg.exe: {ffmpeg_path}")
                break

    if not ffmpeg_path:
        # If not found in bin, just take the first one found
        for root, dirs, files in os.walk(FFMPEG_INSTALL_DIR):
            if 'ffmpeg.exe' in files:
                ffmpeg_path = os.path.join(root, 'ffmpeg.exe')
                ColorPrint.green(f"[FFmpegInstaller] ✓ Found ffmpeg.exe: {ffmpeg_path}")
                break

    if not ffmpeg_path:
        ColorPrint.red("[FFmpegInstaller] ✗ Could not find ffmpeg.exe in extracted files")
        return None

    # Clean up archive
    if os.path.exists(archive_path):
        os.remove(archive_path)
        ColorPrint.blue("[FFmpegInstaller] Cleaned up archive file")

    ColorPrint.green("=" * 80)
    ColorPrint.green(f"[FFmpegInstaller] ✓ FFmpeg installed successfully: {ffmpeg_path}")
    ColorPrint.green("=" * 80)

    return ffmpeg_path


def install_ffmpeg_linux():
    """
    Install FFmpeg on Linux using apt-get

    Returns:
        str or None: Path to ffmpeg if successful
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[FFmpegInstaller] Installing FFmpeg on Linux")
    ColorPrint.blue("=" * 80)

    # Update package lists
    ColorPrint.blue("[FFmpegInstaller] Updating package lists...")
    result = Commander.exec_realtime(
        ['sudo', 'apt-get', 'update'],
        info=True,
        show_output=True
    )

    if not result.success:
        ColorPrint.yellow("[FFmpegInstaller] ✗ apt-get update failed, continuing anyway...")

    # Install FFmpeg
    ColorPrint.blue("[FFmpegInstaller] Installing FFmpeg package...")
    result = Commander.exec_realtime(
        ['sudo', 'apt-get', 'install', '-y', 'ffmpeg'],
        info=True,
        show_output=True
    )

    if not result.success:
        ColorPrint.red("[FFmpegInstaller] ✗ FFmpeg installation failed")
        return None

    # Verify installation
    ffmpeg_path = check_command_exists('ffmpeg')

    if ffmpeg_path:
        ColorPrint.green("=" * 80)
        ColorPrint.green(f"[FFmpegInstaller] ✓ FFmpeg installed successfully: {ffmpeg_path}")
        ColorPrint.green("=" * 80)
        return ffmpeg_path
    else:
        ColorPrint.red("[FFmpegInstaller] ✗ FFmpeg installation completed but command not found")
        return None


def ensure_ffmpeg(auto_install=True):
    """
    Ensure FFmpeg is available on the system

    This function:
    1. Checks if FFmpeg is already in PATH
    2. Checks if FFmpeg is in our managed install directory
    3. If not found and auto_install=True, downloads and installs it

    Args:
        auto_install: If True, automatically install FFmpeg if not found

    Returns:
        str or None: Full path to ffmpeg executable, or None if not available

    Example:
        >>> ffmpeg_path = ensure_ffmpeg()
        >>> if ffmpeg_path:
        >>>     print(f"FFmpeg available at: {ffmpeg_path}")
    """
    ColorPrint.blue("=" * 80)
    ColorPrint.blue("[FFmpegInstaller] Ensuring FFmpeg availability")
    ColorPrint.blue("=" * 80)

    # Step 1: Check if FFmpeg is in PATH
    ffmpeg_path = check_ffmpeg_in_path()
    if ffmpeg_path:
        return ffmpeg_path

    # Step 2: Check if FFmpeg is in our managed install directory
    ffmpeg_path = check_ffmpeg_in_install_dir()
    if ffmpeg_path:
        return ffmpeg_path

    # Step 3: If not found and auto_install is enabled, install it
    if not auto_install:
        ColorPrint.yellow("[FFmpegInstaller] ✗ FFmpeg not found and auto_install is disabled")
        return None

    ColorPrint.yellow("[FFmpegInstaller] FFmpeg not found, attempting automatic installation...")

    system_platform = get_system_platform()

    if system_platform == 'windows':
        ffmpeg_path = install_ffmpeg_windows()
    elif system_platform == 'linux':
        ffmpeg_path = install_ffmpeg_linux()
    elif system_platform == 'darwin':
        ColorPrint.red("[FFmpegInstaller] ✗ macOS automatic installation not yet supported")
        ColorPrint.yellow("[FFmpegInstaller] Please install FFmpeg manually:")
        ColorPrint.yellow("[FFmpegInstaller]   brew install ffmpeg")
        return None
    else:
        ColorPrint.red(f"[FFmpegInstaller] ✗ Unsupported platform: {system_platform}")
        return None

    return ffmpeg_path


def get_ffmpeg_info(ffmpeg_path):
    """
    Get detailed information about FFmpeg installation

    Args:
        ffmpeg_path: Path to ffmpeg executable

    Returns:
        dict: FFmpeg information including version, codecs, formats
    """
    if not ffmpeg_path or not os.path.exists(ffmpeg_path):
        ColorPrint.red("[FFmpegInstaller] ✗ Invalid FFmpeg path")
        return None

    info = {
        'path': ffmpeg_path,
        'version': None,
        'codecs': [],
        'formats': [],
    }

    # Get version
    result = Commander.exec_silent([ffmpeg_path, '-version'])
    if result.success:
        output = result.get_output()
        lines = output.split('\n')
        if lines:
            info['version'] = lines[0]

    # Get codecs
    result = Commander.exec_silent([ffmpeg_path, '-codecs'])
    if result.success:
        output = result.get_output()
        # Parse codec lines (format: "DEV... codec_name  description")
        for line in output.split('\n'):
            if line.strip() and not line.startswith(' ') and not line.startswith('-'):
                if 'Codecs:' not in line and 'configuration:' not in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        codec_name = parts[1]
                        if codec_name not in ['D', 'E', 'V', 'codec']:
                            info['codecs'].append(codec_name)

    # Get formats
    result = Commander.exec_silent([ffmpeg_path, '-formats'])
    if result.success:
        output = result.get_output()
        # Parse format lines (format: "DE format_name  description")
        for line in output.split('\n'):
            if line.strip() and not line.startswith(' ') and not line.startswith('-'):
                if 'File formats:' not in line and 'configuration:' not in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        format_name = parts[1]
                        if format_name not in ['D', 'E', 'format']:
                            info['formats'].append(format_name)

    return info


# Export all functions
__all__ = [
    'ensure_ffmpeg',
    'get_ffmpeg_info',
    'check_ffmpeg_in_path',
    'check_ffmpeg_in_install_dir',
]
