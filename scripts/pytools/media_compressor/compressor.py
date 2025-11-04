"""High-level media compressor implementation."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

from colors import Colors
from json_store import ThreadSafeJsonStore

try:
    from pycore.pyutils import MediaCompressor as UnifiedMediaCompressor
    UNIFIED_COMPRESSOR_AVAILABLE = True
except ImportError:
    print("Warning: pycore.pyutils.MediaCompressor not available")
    print("Falling back to legacy compression methods")
    UNIFIED_COMPRESSOR_AVAILABLE = False
    UnifiedMediaCompressor = None

try:
    from PIL import Image
except ImportError:
    print("Warning: PIL/Pillow not installed, image compression will be limited")
    print("Please run: pip install Pillow")
    Image = None

__all__ = ["MediaCompressor"]

class MediaCompressor:
    """Media File Compressor"""

    # Configuration Constants
    SOURCE_DIR = Path(r"E:\Evidences")
    TMP_DIR = Path(r"E:\Evidences\_tmp")
    COMPRESS_DIR = Path(r"E:\Evidences\_compress")
    CACHE_JSON = SOURCE_DIR / "compression_cache.json"
    PRIORITY_DIR = SOURCE_DIR / "evident"  # Priority directory for duplicates

    # Supported File Types
    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff'}
    VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'}
    AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'}

    # Compression Parameters
    IMAGE_MAX_DIMENSION = 1080  # 1080P
    IMAGE_MAX_SIZE_KB = 500     # 500KB
    IMAGE_QUALITY = 85          # JPEG quality

    VIDEO_CRF = 28            # Video quality (18-28 recommended, higher = more compression)
    VIDEO_PRESET = 'medium'   # Compression speed (ultrafast/fast/medium/slow)
    VIDEO_MAX_DIMENSION = 720 # Max resolution 720P

    AUDIO_BITRATE = '128k'    # Audio bitrate

    def __init__(self):
        """Initialize"""
        self._ensure_directories()

        # Statistics tracking
        self.total_source_size = 0
        self.total_compressed_size = 0
        self.total_files_processed = 0

        # Initialize unified media compressor if available
        self.unified_compressor = None
        if UNIFIED_COMPRESSOR_AVAILABLE:
            try:
                self.unified_compressor = UnifiedMediaCompressor(verbose=False)
                print("✓ Unified MediaCompressor initialized (with GPU detection)")
            except Exception as e:
                print(f"Warning: Failed to initialize UnifiedMediaCompressor: {e}")
                self.unified_compressor = None

        # Client identification for distributed processing
        self.client_id = f"{socket.gethostname()}_{os.getpid()}_{int(time.time())}"
        self.lock_timeout_seconds = 3600  # 1 hour timeout
        print(f"{Colors.CYAN}Client ID: {self.client_id}{Colors.RESET}")
        print(f"{Colors.CYAN}Lock timeout: {self.lock_timeout_seconds // 60} minutes{Colors.RESET}")

        self.cache_store = ThreadSafeJsonStore(
            self.CACHE_JSON,
            self._create_empty_cache,
            max_retries=20,
            retry_delay=1.0,
        )
        self.cache_store.ensure_file()

    def _ensure_directories(self):
        """Ensure necessary directories exist"""
        self.TMP_DIR.mkdir(parents=True, exist_ok=True)
        self.COMPRESS_DIR.mkdir(parents=True, exist_ok=True)

    def _read_cache_safe(self, max_retries=20, retry_delay=1.0, allow_empty=False) -> Dict:
        """Read cache data using the shared JSON store."""
        cache_data = self.cache_store.read()
        cache_data.setdefault('files', {})
        return cache_data

    def _write_cache_safe(self, cache_data: Dict, max_retries=20, retry_delay=1.0):
        """Write cache data back to disk via the shared store."""
        cache_data['last_update'] = datetime.now().isoformat()
        cache_data.setdefault('files', {})
        return self.cache_store.write(cache_data)

    def _update_cache_file(self, update_func, max_retries=5, retry_delay=1.0) -> bool:
        """Apply an atomic read-modify-write using the shared JSON store."""

        def mutator(cache):
            cache.setdefault('files', {})
            update_func(cache)
            cache['last_update'] = datetime.now().isoformat()

        return self.cache_store.update(mutator, max_retries=max_retries, retry_delay=retry_delay)

    def _create_empty_cache(self) -> Dict:
        """Create empty cache structure"""
        return {
            'version': '1.0',
            'last_update': datetime.now().isoformat(),
            'files': {},  # File records
            'stats': {
                'total_files': 0,
                'compressed': 0,
                'skipped': 0,
                'failed': 0
            }
        }

    def _is_lock_expired(self, file_info: Dict) -> bool:
        """Check if file lock has expired (1 hour timeout)"""
        if 'processing_start' not in file_info:
            return True

        try:
            processing_start = datetime.fromisoformat(file_info['processing_start'])
            elapsed = (datetime.now() - processing_start).total_seconds()
            return elapsed > self.lock_timeout_seconds
        except:
            return True

    def try_acquire_lock(self, file_key: str) -> bool:
        """
        Try to acquire lock for processing a file
        Returns True if lock acquired, False if file is being processed by another client
        """
        # Read cache
        cache = self._read_cache_safe()

        if file_key in cache['files']:
            file_info = cache['files'][file_key]
            status = file_info.get('status')

            # Skip if already completed
            if status in ['compressed', 'failed']:
                return False

            # Check if being processed by another client
            if 'processing_by' in file_info:
                # Check if lock expired
                if self._is_lock_expired(file_info):
                    print(f"  {Colors.YELLOW}⚠ Lock expired, taking over from {file_info['processing_by']}{Colors.RESET}")
                else:
                    # Still being processed by another client
                    other_client = file_info.get('processing_by', 'unknown')
                    if other_client != self.client_id:
                        print(f"  {Colors.MAGENTA}⏩ Being processed by: {other_client}{Colors.RESET}")
                        return False

        # Acquire lock using atomic update
        def acquire(cache):
            if file_key not in cache['files']:
                cache['files'][file_key] = {}

            cache['files'][file_key]['processing_by'] = self.client_id
            cache['files'][file_key]['processing_start'] = datetime.now().isoformat()
            cache['files'][file_key]['status'] = 'processing'

        return self._update_cache_file(acquire)

    def release_lock(self, file_key: str, status: str, **kwargs):
        """
        Release lock after processing
        status: 'compressed' or 'failed'
        kwargs: additional fields to update (e.g., compressed_size, error)
        """
        def release(cache):
            if file_key in cache['files']:
                # Remove lock fields
                cache['files'][file_key].pop('processing_by', None)
                cache['files'][file_key].pop('processing_start', None)

                # Update status
                cache['files'][file_key]['status'] = status
                cache['files'][file_key]['timestamp'] = datetime.now().isoformat()

                # Update additional fields
                for key, value in kwargs.items():
                    cache['files'][file_key][key] = value

        self._update_cache_file(release)

    def _get_file_hash(self, filepath: Path) -> str:
        """Calculate file MD5 hash (for deduplication)"""
        md5 = hashlib.md5()
        try:
            with open(filepath, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    md5.update(chunk)
            return md5.hexdigest()
        except Exception as e:
            print(f"Failed to calculate hash {filepath}: {e}")
            return ""

    def _calculate_directory_size(self, directory: Path) -> int:
        """Calculate total size of directory"""
        total_size = 0
        if not directory.exists():
            return 0

        for root, dirs, files in os.walk(directory):
            for filename in files:
                filepath = Path(root) / filename
                try:
                    total_size += filepath.stat().st_size
                except (OSError, PermissionError):
                    continue
        return total_size

    def scan_files(self) -> Dict[str, List[Path]]:
        """Scan source directory, classify all media files"""
        print(f"\n{'='*60}")
        print(f"Scanning directory: {self.SOURCE_DIR}")
        print(f"{'='*60}")

        files = {
            'images': [],
            'videos': [],
            'audios': []
        }

        # Calculate total source directory size
        print("Calculating source directory size...")
        self.total_source_size = self._calculate_directory_size(self.SOURCE_DIR)
        print(f"Source directory total size: {self._format_size(self.total_source_size)}")

        # Scan files
        print("\nScanning media files...")
        file_count = 0
        for root, dirs, filenames in os.walk(self.SOURCE_DIR):
            # Skip temp and compress directories
            if '_tmp' in root or '_compress' in root:
                continue

            for filename in filenames:
                filepath = Path(root) / filename
                ext = filepath.suffix.lower()

                if ext in self.IMAGE_EXTENSIONS:
                    files['images'].append(filepath)
                    file_count += 1
                elif ext in self.VIDEO_EXTENSIONS:
                    files['videos'].append(filepath)
                    file_count += 1
                elif ext in self.AUDIO_EXTENSIONS:
                    files['audios'].append(filepath)
                    file_count += 1

                # Show progress every 100 files
                if file_count % 100 == 0:
                    print(f"  Found {file_count} media files...")

        # Calculate compressed directory size if exists
        if self.COMPRESS_DIR.exists():
            compressed_size = self._calculate_directory_size(self.COMPRESS_DIR)
            print(f"\nCompressed directory size: {self._format_size(compressed_size)}")
            if compressed_size > 0:
                saved = self.total_source_size - compressed_size
                ratio = (saved / self.total_source_size * 100) if self.total_source_size > 0 else 0
                print(f"Space saved: {self._format_size(saved)} ({ratio:.1f}%)")

        print(f"\n{'='*60}")
        print(f"Scan completed:")
        print(f"  - Images: {len(files['images'])}")
        print(f"  - Videos: {len(files['videos'])}")
        print(f"  - Audios: {len(files['audios'])}")
        print(f"  - Total: {file_count}")
        print(f"{'='*60}")

        return files

    def _get_relative_path(self, filepath: Path) -> Path:
        """Get path relative to source directory"""
        try:
            return filepath.relative_to(self.SOURCE_DIR)
        except ValueError:
            return Path(filepath.name)

    def _is_zl_file(self, filepath: Path) -> bool:
        """Check if file path starts with '资料整理'"""
        path_str = str(filepath)
        # Check if any part of the path starts with '资料整理'
        for part in filepath.parts:
            if part.startswith('资料整理'):
                return True
        return False

    def _format_processing_msg(self, rel_path: Path, processed: int, total: int) -> str:
        """Format processing message with color based on file path"""
        if self._is_zl_file(rel_path):
            # Use MAGENTA + BOLD for 资料整理 files to make them stand out
            msg = f"{Colors.BOLD}{Colors.MAGENTA}[{processed}/{total}] Processing: {rel_path}{Colors.RESET}"
            msg += f"\n{Colors.YELLOW}  ⚠ WARNING: This is a '资料整理' file - Please check if this should be processed!{Colors.RESET}"
            return msg
        else:
            # Normal color
            return f"[{processed}/{total}] Processing: {rel_path}"

    def _rename_file_spaces(self, filepath: Path) -> Path:
        """Rename file if it contains spaces, replace multiple spaces with single underscore"""
        if ' ' not in filepath.name:
            return filepath

        try:
            # Generate new name: replace one or more consecutive spaces with single underscore
            new_name = re.sub(r'\s+', '_', filepath.name)
            new_path = filepath.parent / new_name

            # Skip if no change
            if new_name == filepath.name:
                return filepath

            # Check if target already exists
            if new_path.exists():
                print(f"  ⚠ Cannot rename (target exists): {new_name}")
                return filepath

            # Rename file
            filepath.rename(new_path)
            print(f"  → Renamed: {filepath.name}")
            print(f"           → {new_name}")
            return new_path

        except Exception as e:
            print(f"  ⚠ Failed to rename file: {e}")
            return filepath

    def _is_duplicate_media(self, filepath: Path, file_type: str) -> tuple[bool, str]:
        """
        Check if video/audio is duplicate (based on filename)
        Returns: (is_duplicate, original_rel_path)
        """
        if file_type not in ['video', 'audio']:
            return (False, "")

        filename = filepath.name
        for key, info in self.cache['files'].items():
            if info.get('type') == file_type and info.get('status') == 'compressed':
                cached_path = Path(key)
                if cached_path.name == filename and str(cached_path) != str(self._get_relative_path(filepath)):
                    print(f"Found duplicate file (same filename): {filename}")
                    print(f"  Original: {key}")
                    return (True, key)
        return (False, "")

    def copy_files(self, files: Dict[str, List[Path]]) -> int:
        """Copy files to temporary directory"""
        print(f"\nCopying files to temp directory: {self.TMP_DIR}")

        total = sum(len(f) for f in files.values())
        copied = 0

        for file_type, file_list in files.items():
            for filepath in file_list:
                rel_path = self._get_relative_path(filepath)
                tmp_path = self.TMP_DIR / rel_path

                # Check if already compressed
                file_key = str(rel_path)
                if file_key in self.cache['files']:
                    if self.cache['files'][file_key].get('status') == 'compressed':
                        print(f"Skip compressed: {rel_path}")
                        continue

                # Check duplicate
                is_dup, original_path = self._is_duplicate_media(filepath, file_type[:-1])  # Remove plural 's'
                if is_dup:
                    print(f"Skip duplicate: {rel_path}")
                    self.cache['stats']['skipped'] += 1
                    continue

                # Create target directory
                tmp_path.parent.mkdir(parents=True, exist_ok=True)

                try:
                    # Copy file
                    shutil.copy2(filepath, tmp_path)
                    copied += 1

                    # Update cache
                    if file_key not in self.cache['files']:
                        self.cache['files'][file_key] = {
                            'type': file_type[:-1],  # Remove plural 's'
                            'source': str(filepath),
                            'size': filepath.stat().st_size,
                            'status': 'copied'
                        }

                    print(f"[{copied}/{total}] Copied: {rel_path}")

                except Exception as e:
                    print(f"Copy failed {rel_path}: {e}")

        self._save_cache()
        print(f"\nCopy completed: {copied} files")
        return copied

    def _compress_image(self, src: Path, dst: Path) -> bool:
        """Compress image using unified compressor or fallback to legacy method"""
        # Try unified compressor first (with GPU support)
        if self.unified_compressor is not None:
            try:
                # Ensure destination directory exists (handle Chinese paths)
                try:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                except Exception as e:
                    print(f"Failed to create directory: {dst.parent}")
                    print(f"Error: {e}")
                    return False

                # Determine if resize is needed
                file_size_kb = src.stat().st_size / 1024
                needs_resize = False
                resize_dims = None

                # Quick dimension check using PIL
                if Image is not None:
                    try:
                        with Image.open(src) as img:
                            width, height = img.size
                            if max(width, height) > self.IMAGE_MAX_DIMENSION:
                                needs_resize = True
                                if width > height:
                                    new_width = self.IMAGE_MAX_DIMENSION
                                    new_height = int(height * (self.IMAGE_MAX_DIMENSION / width))
                                else:
                                    new_height = self.IMAGE_MAX_DIMENSION
                                    new_width = int(width * (self.IMAGE_MAX_DIMENSION / height))
                                resize_dims = (new_width, new_height)
                    except:
                        pass

                # Check if compression needed
                needs_compress = file_size_kb > self.IMAGE_MAX_SIZE_KB

                if not needs_resize and not needs_compress:
                    # No compression needed, just copy
                    shutil.copy2(src, dst)
                    return True

                # Use unified compressor (with potential GPU acceleration)
                stats = self.unified_compressor.compress_image(
                    input_path=str(src),  # Convert to string for better path handling
                    output_path=str(dst),
                    quality=self.IMAGE_QUALITY,
                    resize=resize_dims,
                    use_gpu=True  # Enable GPU if available
                )

                return stats.compressed_size > 0

            except Exception as e:
                print(f"  Unified compressor failed, falling back to legacy: {e}")
                print(f"    Source: {src}")
                print(f"    Destination: {dst}")
                # Fall through to legacy method

        # Legacy PIL-based compression
        if Image is None:
            print("PIL not installed, cannot compress images")
            return False

        try:
            with Image.open(src) as img:
                # Convert RGBA to RGB (JPEG doesn't support transparency)
                if img.mode == 'RGBA':
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # Get original dimensions
                width, height = img.size

                # Check if compression needed
                file_size_kb = src.stat().st_size / 1024
                needs_resize = max(width, height) > self.IMAGE_MAX_DIMENSION
                needs_compress = file_size_kb > self.IMAGE_MAX_SIZE_KB

                if not needs_resize and not needs_compress:
                    # No compression needed, just copy
                    shutil.copy2(src, dst)
                    return True

                # Calculate new dimensions
                if needs_resize:
                    if width > height:
                        new_width = self.IMAGE_MAX_DIMENSION
                        new_height = int(height * (self.IMAGE_MAX_DIMENSION / width))
                    else:
                        new_height = self.IMAGE_MAX_DIMENSION
                        new_width = int(width * (self.IMAGE_MAX_DIMENSION / height))

                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                # Save compressed image
                try:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                except Exception as mkdir_err:
                    print(f"  Failed to create directory: {dst.parent}")
                    print(f"  Error: {mkdir_err}")
                    return False

                # Force save as JPEG for better compression
                save_path = dst.with_suffix('.jpg') if dst.suffix.lower() != '.jpg' else dst
                try:
                    img.save(save_path, 'JPEG', quality=self.IMAGE_QUALITY, optimize=True)
                except Exception as save_err:
                    print(f"  Failed to save image: {save_path}")
                    print(f"  Error: {save_err}")
                    return False

                # Update filename if extension changed
                if save_path != dst:
                    dst = save_path

                return True

        except Exception as e:
            print(f"Image compression failed: {e}")
            print(f"  Source: {src}")
            print(f"  Destination: {dst}")
            print(f"  Destination parent: {dst.parent}")
            print(f"  Parent exists: {dst.parent.exists() if dst.parent else 'N/A'}")
            return False

    def _check_ffmpeg(self) -> bool:
        """Check if ffmpeg is available"""
        try:
            subprocess.run(['ffmpeg', '-version'],
                         capture_output=True,
                         check=True,
                         timeout=5)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _get_video_dimensions(self, video_path: Path) -> Tuple[int, int]:
        """Get video dimensions using ffprobe"""
        try:
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height',
                '-of', 'csv=p=0',
                str(video_path)
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                encoding='utf-8',
                errors='ignore',
                timeout=30
            )
            if result.returncode == 0 and result.stdout and result.stdout.strip():
                output = result.stdout.strip()
                # Check if output contains valid data
                if ',' in output:
                    parts = output.split(',')
                    if len(parts) == 2 and parts[0] and parts[1]:
                        width, height = map(int, parts)
                        return width, height
        except Exception as e:
            print(f"  ⚠ Failed to get video dimensions: {e}")

        return 0, 0

    def _compress_video(self, src: Path, dst: Path) -> bool:
        """Compress video using unified compressor or fallback to legacy method (no upscaling)"""
        # Try unified compressor first (with GPU NVENC support)
        if self.unified_compressor is not None:
            try:
                # Ensure destination directory exists
                dst.parent.mkdir(parents=True, exist_ok=True)

                # Get original video dimensions
                width, height = self._get_video_dimensions(src)

                # Determine resolution for compression (no upscaling)
                resolution = None
                if height > self.VIDEO_MAX_DIMENSION:
                    # Calculate width to maintain aspect ratio
                    if width > 0 and height > 0:
                        new_height = self.VIDEO_MAX_DIMENSION
                        new_width = int(width * (self.VIDEO_MAX_DIMENSION / height))
                        # Ensure even dimensions (required for h264)
                        new_width = new_width - (new_width % 2)
                        new_height = new_height - (new_height % 2)
                        resolution = (new_width, new_height)
                        print(f"  Using unified compressor... (CRF={self.VIDEO_CRF}, {width}x{height} -> {new_width}x{new_height})")
                elif height > 0:
                    print(f"  Using unified compressor... (CRF={self.VIDEO_CRF}, keeping {width}x{height})")
                else:
                    print(f"  Using unified compressor... (CRF={self.VIDEO_CRF}, preset={self.VIDEO_PRESET})")

                # Use unified compressor (with potential GPU NVENC acceleration)
                stats = self.unified_compressor.compress_video(
                    input_path=src,
                    output_path=dst,
                    codec='h264',
                    preset=self.VIDEO_PRESET,
                    crf=self.VIDEO_CRF,
                    resolution=resolution,
                    use_gpu=True  # Enable GPU hardware encoding if available
                )

                if stats.compressed_size > 0:
                    if stats.used_gpu:
                        print(f"  ✓ Compressed with GPU acceleration: {self._format_size(stats.compressed_size)}")
                    else:
                        print(f"  ✓ Compressed with CPU: {self._format_size(stats.compressed_size)}")
                    return True
                else:
                    print(f"  Unified compressor returned no output, falling back to legacy")
                    # Fall through to legacy method

            except Exception as e:
                print(f"  Unified compressor failed, falling back to legacy: {e}")
                # Fall through to legacy method

        # Legacy FFmpeg-based compression
        if not self._check_ffmpeg():
            print("ffmpeg not installed or not in PATH")
            print("Please install ffmpeg: https://ffmpeg.org/download.html")
            return False

        try:
            dst.parent.mkdir(parents=True, exist_ok=True)

            # Get original video dimensions
            width, height = self._get_video_dimensions(src)

            # Build ffmpeg command
            cmd = [
                'ffmpeg',
                '-i', str(src),
                '-c:v', 'libx264',           # Video codec
                '-crf', str(self.VIDEO_CRF),  # Quality control
                '-preset', self.VIDEO_PRESET, # Compression speed
            ]

            # Only apply scale filter if height > 720 (no upscaling)
            if height > self.VIDEO_MAX_DIMENSION:
                cmd.extend(['-vf', f'scale=-2:{self.VIDEO_MAX_DIMENSION}'])
                print(f"  Compressing... (CRF={self.VIDEO_CRF}, {width}x{height} -> {self.VIDEO_MAX_DIMENSION}p)")
            elif height > 0:
                print(f"  Compressing... (CRF={self.VIDEO_CRF}, keeping {width}x{height})")
            else:
                print(f"  Compressing... (CRF={self.VIDEO_CRF}, preset={self.VIDEO_PRESET})")

            cmd.extend([
                '-c:a', 'aac',                # Audio codec
                '-b:a', self.AUDIO_BITRATE,   # Audio bitrate
                '-movflags', '+faststart',    # Optimize streaming
                '-y',                         # Overwrite output
                str(dst)
            ])

            # Print command for debugging
            print(f"  Command: {' '.join(cmd)}")
            print(f"  Processing (output below):")
            print(f"  {'-'*50}")

            # Run with real-time output
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                encoding='utf-8',
                errors='ignore',
                bufsize=1,
                universal_newlines=True
            )

            # Print output in real-time
            for line in process.stdout:
                line = line.strip()
                if line:
                    print(f"  {line}")

            # Wait for completion (no timeout, let it finish naturally)
            process.wait()
            print(f"  {'-'*50}")

            # Check success by verifying output file exists and has size > 0
            if dst.exists() and dst.stat().st_size > 0:
                print(f"  ✓ Output file created: {self._format_size(dst.stat().st_size)}")
                return True
            else:
                print(f"  ✗ Output file not created or empty")
                return False

        except Exception as e:
            print(f"  ✗ Video compression failed: {e}")
            return False

    def _compress_audio(self, src: Path, dst: Path) -> bool:
        """Compress audio"""
        if not self._check_ffmpeg():
            print("ffmpeg not installed or not in PATH")
            return False

        try:
            dst.parent.mkdir(parents=True, exist_ok=True)

            # ffmpeg compression command
            cmd = [
                'ffmpeg',
                '-i', str(src),
                '-c:a', 'aac',                # Audio codec
                '-b:a', self.AUDIO_BITRATE,   # Bitrate
                '-vn',                        # Remove video stream
                '-y',                         # Overwrite output
                str(dst)
            ]

            print(f"  Compressing... (bitrate={self.AUDIO_BITRATE})")
            print(f"  Command: {' '.join(cmd)}")
            print(f"  Processing (output below):")
            print(f"  {'-'*50}")

            # Run with real-time output
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                encoding='utf-8',
                errors='ignore',
                bufsize=1,
                universal_newlines=True
            )

            # Print output in real-time
            for line in process.stdout:
                line = line.strip()
                if line:
                    print(f"  {line}")

            # Wait for completion (no timeout, let it finish naturally)
            process.wait()
            print(f"  {'-'*50}")

            # Check success by verifying output file exists and has size > 0
            if dst.exists() and dst.stat().st_size > 0:
                print(f"  ✓ Output file created: {self._format_size(dst.stat().st_size)}")
                return True
            else:
                print(f"  ✗ Output file not created or empty")
                return False

        except Exception as e:
            print(f"  ✗ Audio compression failed: {e}")
            return False

    def _verify_file(self, filepath: Path):
        """
        Verify file integrity
        Returns: True (valid), False (corrupted), None (cannot verify)
        """
        try:
            # Basic check: file exists and size > 0
            if not filepath.exists():
                return False

            if filepath.stat().st_size == 0:
                return False

            # Image verification
            if filepath.suffix.lower() in self.IMAGE_EXTENSIONS and Image:
                with Image.open(filepath) as img:
                    img.verify()
                return True

            # Video/Audio verification (using ffprobe)
            if filepath.suffix.lower() in (self.VIDEO_EXTENSIONS | self.AUDIO_EXTENSIONS):
                if self._check_ffmpeg():
                    result = subprocess.run(
                        ['ffprobe', '-v', 'error', str(filepath)],
                        capture_output=True,
                        encoding='utf-8',
                        errors='ignore',
                        timeout=30
                    )
                    return result.returncode == 0
                else:
                    # Cannot verify without ffmpeg
                    return None

            # Other files are considered valid
            return True

        except subprocess.TimeoutExpired:
            # Timeout means likely corrupted
            return False
        except Exception as e:
            # Cannot verify
            return None

    def scan_and_compress_batch(self):
        """
        Scan and compress files from E:\\Evidences
        - Scan all videos, images, audios
        - Video max 720p, Image max 1080p
        - Detect duplicates and create placeholders
        - Detect corrupted files and move to _corrupted_videos
        - Priority: evident directory first
        - Generate JSON report
        """
        print(f"\n{'='*60}")
        print(f"Scan and Compress: {self.SOURCE_DIR}")
        print(f"{'='*60}\n")

        # Step 1: Scan all files and build index
        print("Step 1: Scanning all files and building index...")
        all_files = []
        filename_index = {}  # filename -> [list of file_info]

        for root, dirs, files in os.walk(self.SOURCE_DIR):
            # Skip special directories
            if any(skip in root for skip in ['_tmp', '_compress', '_corrupted_videos']):
                continue

            for filename in files:
                filepath = Path(root) / filename
                ext = filepath.suffix.lower()

                # Check if it's a media file
                file_type = None
                if ext in self.IMAGE_EXTENSIONS:
                    file_type = 'image'
                elif ext in self.VIDEO_EXTENSIONS:
                    file_type = 'video'
                elif ext in self.AUDIO_EXTENSIONS:
                    file_type = 'audio'

                if file_type:
                    try:
                        size = filepath.stat().st_size
                        rel_path = filepath.relative_to(self.SOURCE_DIR)
                        is_priority = str(rel_path).startswith('evident')

                        file_info = {
                            'path': filepath,
                            'rel_path': rel_path,
                            'filename': filename,
                            'type': file_type,
                            'size': size,
                            'is_priority': is_priority
                        }
                        all_files.append(file_info)

                        # Add to filename index
                        if filename not in filename_index:
                            filename_index[filename] = []
                        filename_index[filename].append(file_info)

                    except Exception as e:
                        print(f"{Colors.RED}✗ Cannot access: {filepath} - {e}{Colors.RESET}")

        print(f"Found {len(all_files)} media files\n")

        if len(all_files) == 0:
            print("No files to process")
            return

        # Step 2: Detect and remove corrupted videos FIRST
        print(f"\nStep 2: Checking video integrity...")

        # Check if integrity check already completed by another client
        cache = self._read_cache_safe()
        integrity_check = cache.get('integrity_check', {})
        if integrity_check.get('completed'):
            completed_by = integrity_check.get('completed_by', 'unknown')
            completed_at = integrity_check.get('completed_at', 'unknown')
            corrupted_count = integrity_check.get('corrupted_count', 0)
            print(f"  {Colors.CYAN}✓ Integrity check already completed by: {completed_by}{Colors.RESET}")
            print(f"  {Colors.CYAN}  Completed at: {completed_at}{Colors.RESET}")
            print(f"  {Colors.CYAN}  Corrupted files found: {corrupted_count}{Colors.RESET}")

            # Remove files that are in _corrupted_videos from all_files list
            # (they may have been moved by another client)
            original_count = len(all_files)
            files_to_remove = [f for f in all_files if not f['path'].exists()]
            all_files = [f for f in all_files if f['path'].exists()]
            removed_count = original_count - len(all_files)

            # Update filename_index
            for removed_file in files_to_remove:
                filename = removed_file['filename']
                if filename in filename_index:
                    filename_index[filename] = [f for f in filename_index[filename] if f['path'].exists()]
                    if not filename_index[filename]:
                        del filename_index[filename]

            if removed_count > 0:
                print(f"  {Colors.YELLOW}  Removed {removed_count} files already moved to _corrupted_videos{Colors.RESET}")

            corrupted_files = []  # No new corrupted files
        else:
            # Perform integrity check
            print(f"  {Colors.CYAN}Starting video integrity check...{Colors.RESET}")
            corrupted_files = []
            corrupted_indices = []  # Track indices to remove

            for idx, file_info in enumerate(all_files):
                if file_info['type'] == 'video':
                    filepath = file_info['path']
                    is_valid = self._verify_file(filepath)

                    if is_valid == False:
                        print(f"  {Colors.RED}✗ CORRUPTED: {file_info['rel_path']}{Colors.RESET}")

                        # Move to corrupted directory
                        try:
                            corrupted_dir = self.SOURCE_DIR / "_corrupted_videos"
                            dest_dir = corrupted_dir / file_info['rel_path'].parent
                            dest_dir.mkdir(parents=True, exist_ok=True)
                            dest_path = dest_dir / file_info['filename']

                            shutil.move(str(filepath), str(dest_path))
                            print(f"    → Moved to: {dest_path.relative_to(self.SOURCE_DIR)}")

                            corrupted_files.append({
                                'original_path': str(file_info['rel_path']),
                                'corrupted_path': str(dest_path.relative_to(self.SOURCE_DIR)),
                                'size': file_info['size']
                            })

                            corrupted_indices.append(idx)

                        except Exception as e:
                            print(f"    {Colors.RED}✗ Failed to move: {e}{Colors.RESET}")

            # Remove corrupted files from the list and index
            for idx in reversed(corrupted_indices):
                corrupted_file = all_files[idx]
                filename = corrupted_file['filename']

                # Remove from all_files
                all_files.pop(idx)

                # Remove from filename_index
                if filename in filename_index:
                    filename_index[filename] = [f for f in filename_index[filename] if f['path'] != corrupted_file['path']]
                    if not filename_index[filename]:
                        del filename_index[filename]

            # Mark integrity check as completed
            def mark_integrity_complete(cache):
                cache['integrity_check'] = {
                    'completed': True,
                    'completed_by': self.client_id,
                    'completed_at': datetime.now().isoformat(),
                    'corrupted_count': len(corrupted_files)
                }

            self._update_cache_file(mark_integrity_complete)
            print(f"  Found {len(corrupted_files)} corrupted videos, moved to _corrupted_videos")

        print(f"  Remaining files to process: {len(all_files)}\n")

        # Step 2.5: Pre-populate cache with all files (status: pending)
        print(f"Step 2.5: Pre-populating cache with all files...")

        # Pre-populate using atomic update
        new_files_added = [0]  # Use list to allow modification in closure

        def prepopulate(cache):
            for file_info in all_files:
                file_key = str(file_info['rel_path'])
                if file_key not in cache['files']:
                    cache['files'][file_key] = {
                        'type': file_info['type'],
                        'status': 'pending',
                        'original_size': file_info['size'],
                        'scanned_at': datetime.now().isoformat()
                    }
                    new_files_added[0] += 1

        self._update_cache_file(prepopulate)

        if new_files_added[0] > 0:
            print(f"  Added {new_files_added[0]} new files to cache")

        # Read cache to get total count
        cache = self._read_cache_safe()
        print(f"  Total files in cache: {len(cache['files'])}\n")

        # Step 3: Sort files by priority (evident directory first)
        all_files.sort(key=lambda x: (not x['is_priority'], str(x['rel_path'])))

        # Step 4: Process files
        print(f"Step 3: Processing files...")
        print(f"Priority: evident directory first")
        print(f"Settings: Video/Image max 720p\n")

        confirm = input(f"Start processing {len(all_files)} files? (yes/no, default: yes): ").strip().lower()
        if confirm in ['no', 'n']:
            print("Operation cancelled")
            return

        # Statistics
        stats = {
            'total': len(all_files) + len(corrupted_files),  # Include corrupted in total
            'compressed': 0,
            'skipped_duplicate': 0,
            'skipped_cached': 0,
            'corrupted': len(corrupted_files),
            'failed': 0,
            'placeholders_created': 0
        }

        processed_filenames = set()  # Track which filenames have been processed
        duplicate_details = []  # Track duplicate file details

        for idx, file_info in enumerate(all_files, 1):
            filepath = file_info['path']
            filename = file_info['filename']
            rel_path = file_info['rel_path']
            file_type = file_info['type']

            print(f"\n[{idx}/{len(all_files)}] {rel_path}")
            print(f"  Type: {file_type}, Size: {self._format_size(file_info['size'])}")

            # Check if this filename was already processed (duplicate)
            if filename in processed_filenames:
                print(f"  {Colors.YELLOW}→ Duplicate filename detected{Colors.RESET}")

                # Create placeholder
                try:
                    # Find the original (priority) file
                    same_name_files = filename_index[filename]
                    priority_file = next((f for f in same_name_files if f['is_priority']), same_name_files[0])

                    placeholder_content = f"This file is a duplicate of:\n{priority_file['rel_path']}\n\nOriginal file location:\n{priority_file['path']}"
                    placeholder_path = filepath.parent / f"{filepath.stem}_DUPLICATE.txt"

                    with open(placeholder_path, 'w', encoding='utf-8') as f:
                        f.write(placeholder_content)

                    # Delete duplicate file
                    filepath.unlink()

                    print(f"  {Colors.GREEN}✓ Created placeholder and removed duplicate{Colors.RESET}")
                    stats['skipped_duplicate'] += 1
                    stats['placeholders_created'] += 1

                    duplicate_details.append({
                        'duplicate_path': str(rel_path),
                        'original_path': str(priority_file['rel_path']),
                        'placeholder': str(placeholder_path.relative_to(self.SOURCE_DIR))
                    })

                except Exception as e:
                    print(f"  {Colors.RED}✗ Failed to create placeholder: {e}{Colors.RESET}")

                continue

            # Mark this filename as processed
            processed_filenames.add(filename)

            # Try to acquire lock for this file
            file_key = str(rel_path)
            if not self.try_acquire_lock(file_key):
                # Can't process - skip
                continue

            # Compress file
            tmp_path = self.TMP_DIR / rel_path
            compress_path = self.COMPRESS_DIR / rel_path

            # Create directories
            tmp_path.parent.mkdir(parents=True, exist_ok=True)
            compress_path.parent.mkdir(parents=True, exist_ok=True)

            # Copy to tmp
            try:
                shutil.copy2(str(filepath), str(tmp_path))
            except Exception as e:
                print(f"  {Colors.RED}✗ Failed to copy to tmp: {e}{Colors.RESET}")
                stats['failed'] += 1
                # Release lock and mark as failed
                self.release_lock(
                    file_key,
                    status='failed',
                    type=file_type,
                    error=f"Failed to copy: {str(e)}"
                )
                continue

            # Compress
            success = False
            if file_type == 'image':
                success = self._compress_image(tmp_path, compress_path)
            elif file_type == 'video':
                success = self._compress_video(tmp_path, compress_path)
            elif file_type == 'audio':
                success = self._compress_audio(tmp_path, compress_path)

            if success:
                print(f"  {Colors.GREEN}✓ Compressed{Colors.RESET}")
                stats['compressed'] += 1

                # Release lock and update status
                self.release_lock(
                    file_key,
                    status='compressed',
                    type=file_type,
                    original_size=file_info['size'],
                    compressed_size=compress_path.stat().st_size
                )
            else:
                print(f"  {Colors.RED}✗ Compression failed{Colors.RESET}")
                stats['failed'] += 1

                # Release lock and mark as failed
                self.release_lock(
                    file_key,
                    status='failed',
                    type=file_type
                )

        # Step 4: Generate report
        report = {
            'scan_time': datetime.now().isoformat(),
            'source_directory': str(self.SOURCE_DIR),
            'priority_directory': str(self.PRIORITY_DIR),
            'statistics': stats,
            'duplicates': duplicate_details,
            'corrupted_files': corrupted_files
        }

        report_path = self.SOURCE_DIR / 'compression_report.json'
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        # Summary
        print(f"\n{'='*60}")
        print(f"Compression Summary")
        print(f"{'='*60}")
        print(f"  Total files: {stats['total']}")
        print(f"  {Colors.GREEN}Compressed: {stats['compressed']}{Colors.RESET}")
        print(f"  {Colors.CYAN}Skipped (already compressed): {stats['skipped_cached']}{Colors.RESET}")
        print(f"  {Colors.YELLOW}Skipped (duplicate): {stats['skipped_duplicate']}{Colors.RESET}")
        print(f"    - Placeholders created: {stats['placeholders_created']}")
        print(f"  {Colors.RED}Corrupted: {stats['corrupted']}{Colors.RESET}")
        print(f"  {Colors.RED}Failed: {stats['failed']}{Colors.RESET}")
        print(f"\n{Colors.GREEN}✓ Report saved: {report_path}{Colors.RESET}")
        print(f"{'='*60}\n")

    def scan_and_compress_one_by_one(self):
        """Scan and compress files one by one (copy → compress → delete → next) - Fallback mode"""
        print(f"\n{'='*60}")
        print(f"Starting One-by-One Processing (Fallback/Low Memory Mode)")
        print(f"{'='*60}")

        # Step 1: Scan files
        files = self.scan_files()

        total_files = sum(len(f) for f in files.values())
        if total_files == 0:
            print("No files to process")
            return

        # Counters
        processed = 0
        success = 0
        failed = 0
        skipped = 0
        cumulative_original_size = 0
        cumulative_compressed_size = 0

        # Process each file type
        for file_type, file_list in files.items():
            for filepath in file_list:
                # Step 0: Rename file if it contains spaces
                filepath = self._rename_file_spaces(filepath)

                rel_path = self._get_relative_path(filepath)
                file_key = str(rel_path)
                original_size = filepath.stat().st_size

                # Check if already compressed or failed
                cache = self._read_cache_safe()
                if file_key in cache['files']:
                    cached_status = cache['files'][file_key].get('status')
                    if cached_status == 'compressed':
                        print(f"\nSkip compressed: {rel_path}")
                        skipped += 1
                        continue
                    elif cached_status == 'failed':
                        cached_error = cache['files'][file_key].get('error', 'Unknown error')
                        print(f"\nSkip failed file: {rel_path}")
                        print(f"  Previous error: {cached_error}")
                        skipped += 1
                        continue

                # Check duplicate
                is_dup, original_path = self._is_duplicate_media(filepath, file_type[:-1])  # Remove plural 's'
                if is_dup:
                    print(f"\nSkip duplicate: {rel_path}")

                    # Mark as duplicate in cache with reference to original
                    def mark_duplicate(cache):
                        cache['files'][file_key] = {
                            'type': file_type[:-1],
                            'source': str(filepath),
                            'size': original_size,
                            'status': 'duplicate',
                            'duplicate_of': original_path  # Reference to the original compressed file
                        }
                        if 'stats' not in cache:
                            cache['stats'] = {'skipped': 0}
                        cache['stats']['skipped'] = cache['stats'].get('skipped', 0) + 1

                    self._update_cache_file(mark_duplicate)
                    skipped += 1
                    continue

                processed += 1

                # Progress header
                print(f"\n{'-'*60}")
                print(self._format_processing_msg(rel_path, processed, total_files - skipped))
                print(f"  Original size: {self._format_size(original_size)}")

                tmp_path = self.TMP_DIR / rel_path
                compress_path = self.COMPRESS_DIR / rel_path

                try:
                    # Verify source file integrity for video/audio
                    ext = filepath.suffix.lower()
                    if ext in (self.VIDEO_EXTENSIONS | self.AUDIO_EXTENSIONS):
                        if not self._verify_file(filepath):
                            print(f"  ✗ Source file is corrupted, skipping")
                            print(f"     File may be damaged: moov atom missing or invalid format")
                            failed += 1

                            # Mark as failed in cache
                            def mark_corrupted(cache):
                                if file_key not in cache['files']:
                                    cache['files'][file_key] = {
                                        'type': file_type[:-1],
                                        'source': str(filepath),
                                        'size': original_size,
                                    }
                                cache['files'][file_key]['status'] = 'failed'
                                cache['files'][file_key]['error'] = 'Source file corrupted'

                            self._update_cache_file(mark_corrupted)
                            continue
                    # Initialize cache entry
                    def init_cache_entry(cache):
                        if file_key not in cache['files']:
                            cache['files'][file_key] = {
                                'type': file_type[:-1],  # Remove plural 's'
                                'source': str(filepath),
                                'size': original_size,
                                'status': 'pending'
                            }

                    self._update_cache_file(init_cache_entry)

                    # Check if compressed file already exists and is valid
                    if compress_path.exists():
                        print(f"  → Compressed file exists, verifying...")
                        if self._verify_file(compress_path):
                            # Compressed file is valid, just update JSON
                            compressed_size = compress_path.stat().st_size
                            ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0

                            print(f"  ✓ Compressed file valid, updating cache only")
                            print(f"  ✓ Size: {self._format_size(compressed_size)} (saved {ratio:.1f}%)")

                            # Update cache
                            def update_compressed(cache):
                                if file_key in cache['files']:
                                    cache['files'][file_key].update({
                                        'status': 'compressed',
                                        'compressed_size': compressed_size,
                                        'compression_ratio': f"{ratio:.1f}%",
                                        'compressed_at': datetime.now().isoformat()
                                    })

                            self._update_cache_file(update_compressed)

                            # Clean up tmp if exists
                            if tmp_path.exists():
                                tmp_path.unlink()

                            # Update cumulative stats
                            cumulative_original_size += original_size
                            cumulative_compressed_size += compressed_size
                            success += 1

                            # Show stats
                            cumulative_ratio = (1 - cumulative_compressed_size / cumulative_original_size) * 100 if cumulative_original_size > 0 else 0
                            saved = cumulative_original_size - cumulative_compressed_size
                            print(f"  📊 Cumulative: {self._format_size(cumulative_original_size)} -> {self._format_size(cumulative_compressed_size)} (saved {self._format_size(saved)}, {cumulative_ratio:.1f}%)")
                            progress_pct = (processed / (total_files - skipped) * 100) if (total_files - skipped) > 0 else 0
                            print(f"  Progress: {progress_pct:.1f}% ({success} success, {failed} failed, {skipped} skipped)")

                            continue
                        else:
                            # Compressed file is corrupted, delete it
                            print(f"  ⚠ Compressed file corrupted, deleting...")
                            compress_path.unlink()

                    # Check if tmp file already exists and is valid
                    need_copy = True
                    if tmp_path.exists():
                        print(f"  → Temp file exists, verifying...")
                        # Check if tmp file size matches source
                        if tmp_path.stat().st_size == original_size:
                            # Verify file integrity (all types, including video/audio)
                            if self._verify_file(tmp_path):
                                print(f"  ✓ Temp file valid, skipping copy")
                                need_copy = False
                            else:
                                print(f"  ⚠ Temp file corrupted, deleting...")
                                tmp_path.unlink()
                        else:
                            print(f"  ⚠ Temp file incomplete (size mismatch), deleting...")
                            tmp_path.unlink()

                    # Step 1: Copy to temp (if needed)
                    if need_copy:
                        print(f"  → Copying to temp...")
                        try:
                            # Ensure parent directory exists (handle Chinese paths)
                            tmp_path.parent.mkdir(parents=True, exist_ok=True)
                            shutil.copy2(filepath, tmp_path)

                            # Update status to copied
                            def mark_copied(cache):
                                if file_key in cache['files']:
                                    cache['files'][file_key]['status'] = 'copied'

                            self._update_cache_file(mark_copied)
                        except Exception as e:
                            print(f"  ✗ Failed to copy to temp: {e}")
                            print(f"     Source: {filepath}")
                            print(f"     Temp: {tmp_path}")
                            failed += 1

                            # Mark as failed
                            def mark_copy_failed(cache):
                                cache['files'][file_key] = {
                                    'type': file_type[:-1],
                                    'source': str(filepath),
                                    'size': original_size,
                                    'status': 'failed',
                                    'error': f'Copy failed: {str(e)}'
                                }

                            self._update_cache_file(mark_copy_failed)
                            continue

                    # Step 2: Compress
                    print(f"  → Compressing...")
                    compress_success = False
                    ext = tmp_path.suffix.lower()

                    if ext in self.IMAGE_EXTENSIONS:
                        compress_success = self._compress_image(tmp_path, compress_path)
                    elif ext in self.VIDEO_EXTENSIONS:
                        compress_success = self._compress_video(tmp_path, compress_path)
                    elif ext in self.AUDIO_EXTENSIONS:
                        compress_success = self._compress_audio(tmp_path, compress_path)

                    if compress_success:
                        # Step 3: Verify
                        print(f"  → Verifying...")
                        if self._verify_file(compress_path):
                            # Calculate compression ratio
                            compressed_size = compress_path.stat().st_size
                            ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0

                            # Update cumulative stats
                            cumulative_original_size += original_size
                            cumulative_compressed_size += compressed_size

                            print(f"  ✓ Compressed: {self._format_size(compressed_size)} (saved {ratio:.1f}%)")

                            # Step 4: Update cache
                            def update_success(cache):
                                if file_key in cache['files']:
                                    cache['files'][file_key].update({
                                        'status': 'compressed',
                                        'compressed_size': compressed_size,
                                        'compression_ratio': f"{ratio:.1f}%",
                                        'compressed_at': datetime.now().isoformat()
                                    })

                            self._update_cache_file(update_success)

                            # Step 5: Delete temp file
                            print(f"  → Deleting temp file...")
                            tmp_path.unlink()

                            success += 1

                            # Real-time cumulative statistics
                            cumulative_ratio = (1 - cumulative_compressed_size / cumulative_original_size) * 100 if cumulative_original_size > 0 else 0
                            saved = cumulative_original_size - cumulative_compressed_size

                            print(f"  📊 Cumulative: {self._format_size(cumulative_original_size)} -> {self._format_size(cumulative_compressed_size)} (saved {self._format_size(saved)}, {cumulative_ratio:.1f}%)")

                            # Show progress percentage
                            progress_pct = (processed / (total_files - skipped) * 100) if (total_files - skipped) > 0 else 0
                            print(f"  Progress: {progress_pct:.1f}% ({success} success, {failed} failed, {skipped} skipped)")

                        else:
                            print(f"  ✗ Compressed file verification failed")
                            compress_path.unlink(missing_ok=True)
                            tmp_path.unlink(missing_ok=True)
                            failed += 1
                    else:
                        print(f"  ✗ Compression failed")
                        tmp_path.unlink(missing_ok=True)
                        failed += 1

                except Exception as e:
                    print(f"  ✗ Error processing file: {e}")
                    # Cleanup
                    tmp_path.unlink(missing_ok=True)
                    compress_path.unlink(missing_ok=True)
                    failed += 1

        # Update final stats
        def update_final_stats(cache):
            if 'stats' not in cache:
                cache['stats'] = {}
            cache['stats']['compressed'] = success
            cache['stats']['failed'] = failed
            cache['stats']['skipped'] = skipped

        self._update_cache_file(update_final_stats)

        # Final statistics
        print(f"\n{'='*60}")
        print(f"Processing Completed")
        print(f"{'='*60}")
        print(f"  Total processed: {processed}")
        print(f"  Success: {success}")
        print(f"  Failed: {failed}")
        print(f"  Skipped: {skipped}")
        print(f"\n  📊 Final Statistics:")
        if cumulative_original_size > 0:
            cumulative_ratio = (1 - cumulative_compressed_size / cumulative_original_size) * 100
            saved = cumulative_original_size - cumulative_compressed_size
            print(f"    Original total: {self._format_size(cumulative_original_size)}")
            print(f"    Compressed total: {self._format_size(cumulative_compressed_size)}")
            print(f"    Space saved: {self._format_size(saved)} ({cumulative_ratio:.1f}%)")

        # Final directory comparison
        if self.total_source_size > 0:
            compress_dir_size = self._calculate_directory_size(self.COMPRESS_DIR)
            print(f"\n  📁 Directory Comparison:")
            print(f"    Source directory: {self._format_size(self.total_source_size)}")
            print(f"    Compressed directory: {self._format_size(compress_dir_size)}")
            if compress_dir_size > 0:
                total_saved = self.total_source_size - compress_dir_size
                total_ratio = (total_saved / self.total_source_size * 100) if self.total_source_size > 0 else 0
                print(f"    Total space saved: {self._format_size(total_saved)} ({total_ratio:.1f}%)")

        print(f"{'='*60}")

    def compress_all(self):
        """Compress all files in temp directory with real-time progress"""
        print(f"\n{'='*60}")
        print(f"Starting Compression")
        print(f"{'='*60}")

        if not self.TMP_DIR.exists():
            print("Temp directory doesn't exist, please run copy operation first")
            return

        # Count total files to process
        total_to_process = 0
        cache = self._read_cache_safe()
        for root, dirs, files in os.walk(self.TMP_DIR):
            for filename in files:
                tmp_path = Path(root) / filename
                rel_path = tmp_path.relative_to(self.TMP_DIR)
                file_key = str(rel_path)

                # Skip already compressed
                if file_key in cache['files']:
                    if cache['files'][file_key].get('status') == 'compressed':
                        continue
                total_to_process += 1

        print(f"Files to process: {total_to_process}")

        # Traverse temp directory
        processed = 0
        success = 0
        failed = 0
        cumulative_original_size = 0
        cumulative_compressed_size = 0

        for root, dirs, files in os.walk(self.TMP_DIR):
            for filename in files:
                tmp_path = Path(root) / filename
                rel_path = tmp_path.relative_to(self.TMP_DIR)
                compress_path = self.COMPRESS_DIR / rel_path

                file_key = str(rel_path)

                # Check cache status
                cache = self._read_cache_safe()
                if file_key in cache['files']:
                    status = cache['files'][file_key].get('status')
                    if status == 'compressed':
                        continue

                processed += 1
                ext = tmp_path.suffix.lower()

                # Progress header
                print(f"\n{'-'*60}")
                print(self._format_processing_msg(rel_path, processed, total_to_process))
                original_size = tmp_path.stat().st_size
                print(f"  Original size: {self._format_size(original_size)}")

                # Compress by type
                compress_success = False

                if ext in self.IMAGE_EXTENSIONS:
                    compress_success = self._compress_image(tmp_path, compress_path)
                elif ext in self.VIDEO_EXTENSIONS:
                    compress_success = self._compress_video(tmp_path, compress_path)
                elif ext in self.AUDIO_EXTENSIONS:
                    compress_success = self._compress_audio(tmp_path, compress_path)
                else:
                    print(f"  Unsupported file type: {ext}")
                    continue

                if compress_success:
                    # Verify compressed file
                    if self._verify_file(compress_path):
                        # Calculate compression ratio
                        compressed_size = compress_path.stat().st_size
                        ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0

                        # Update cumulative stats
                        cumulative_original_size += original_size
                        cumulative_compressed_size += compressed_size

                        print(f"  ✓ Compressed: {self._format_size(compressed_size)} (saved {ratio:.1f}%)")

                        # Update cache
                        def update_compressed(cache):
                            if file_key not in cache['files']:
                                cache['files'][file_key] = {}

                            cache['files'][file_key].update({
                                'status': 'compressed',
                                'compressed_size': compressed_size,
                                'compression_ratio': f"{ratio:.1f}%",
                                'compressed_at': datetime.now().isoformat()
                            })

                        self._update_cache_file(update_compressed)

                        # Delete temp file
                        try:
                            tmp_path.unlink()
                        except Exception as e:
                            print(f"  ! Failed to delete temp file: {e}")

                        success += 1

                        # Real-time cumulative statistics
                        cumulative_ratio = (1 - cumulative_compressed_size / cumulative_original_size) * 100 if cumulative_original_size > 0 else 0
                        saved = cumulative_original_size - cumulative_compressed_size

                        print(f"  📊 Cumulative: {self._format_size(cumulative_original_size)} -> {self._format_size(cumulative_compressed_size)} (saved {self._format_size(saved)}, {cumulative_ratio:.1f}%)")

                        # Calculate and show compressed directory total size
                        compress_dir_size = self._calculate_directory_size(self.COMPRESS_DIR)
                        print(f"  📁 Compressed directory total: {self._format_size(compress_dir_size)}")

                        # Show progress percentage
                        progress_pct = (processed / total_to_process * 100) if total_to_process > 0 else 0
                        print(f"  Progress: {progress_pct:.1f}% ({success} success, {failed} failed)")

                    else:
                        print(f"  ✗ Compressed file verification failed")
                        compress_path.unlink(missing_ok=True)
                        failed += 1
                else:
                    print(f"  ✗ Compression failed")
                    failed += 1

        # Update final stats
        def update_final_stats(cache):
            if 'stats' not in cache:
                cache['stats'] = {}
            cache['stats']['compressed'] = success
            cache['stats']['failed'] = failed

        self._update_cache_file(update_final_stats)

        # Final statistics
        print(f"\n{'='*60}")
        print(f"Compression Completed")
        print(f"{'='*60}")
        print(f"  Total processed: {processed}")
        print(f"  Success: {success}")
        print(f"  Failed: {failed}")
        print(f"\n  📊 Final Statistics:")
        if cumulative_original_size > 0:
            cumulative_ratio = (1 - cumulative_compressed_size / cumulative_original_size) * 100
            saved = cumulative_original_size - cumulative_compressed_size
            print(f"    Original total: {self._format_size(cumulative_original_size)}")
            print(f"    Compressed total: {self._format_size(cumulative_compressed_size)}")
            print(f"    Space saved: {self._format_size(saved)} ({cumulative_ratio:.1f}%)")

        # Final directory comparison
        if self.total_source_size > 0:
            compress_dir_size = self._calculate_directory_size(self.COMPRESS_DIR)
            print(f"\n  📁 Directory Comparison:")
            print(f"    Source directory: {self._format_size(self.total_source_size)}")
            print(f"    Compressed directory: {self._format_size(compress_dir_size)}")
            if compress_dir_size > 0:
                total_saved = self.total_source_size - compress_dir_size
                total_ratio = (total_saved / self.total_source_size * 100) if self.total_source_size > 0 else 0
                print(f"    Total space saved: {self._format_size(total_saved)} ({total_ratio:.1f}%)")

        print(f"{'='*60}")

    def _format_size(self, size_bytes: int) -> str:
        """Format file size"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f}TB"

    def replace_original_files(self):
        """Replace original files with compressed files"""
        print(f"\n{'='*60}")
        print(f"Replace Original Files with Compressed Versions")
        print(f"{'='*60}")
        print(f"\n{Colors.RED}WARNING: This will overwrite original files!{Colors.RESET}")
        print(f"Make sure you have backups before proceeding.\n")

        confirm = input("Confirm to continue? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("Operation cancelled")
            return

        # Find all compressed files
        print(f"\nScanning compressed files in: {self.COMPRESS_DIR}")
        compressed_files = []

        for root, dirs, files in os.walk(self.COMPRESS_DIR):
            for filename in files:
                compressed_path = Path(root) / filename
                rel_path = compressed_path.relative_to(self.COMPRESS_DIR)
                original_path = self.SOURCE_DIR / rel_path

                # Skip if original doesn't exist (might be duplicate/corrupted)
                if original_path.exists():
                    compressed_files.append({
                        'compressed': compressed_path,
                        'original': original_path,
                        'rel_path': rel_path
                    })

        if not compressed_files:
            print("No compressed files found to replace.")
            return

        print(f"Found {len(compressed_files)} compressed files to replace\n")

        # Replace files
        replaced = 0
        failed = 0

        for idx, file_info in enumerate(compressed_files, 1):
            compressed_path = file_info['compressed']
            original_path = file_info['original']
            rel_path = file_info['rel_path']

            print(f"[{idx}/{len(compressed_files)}] {rel_path}")

            try:
                # Get sizes
                original_size = original_path.stat().st_size
                compressed_size = compressed_path.stat().st_size

                # Replace
                shutil.copy2(str(compressed_path), str(original_path))

                print(f"  {Colors.GREEN}✓ Replaced{Colors.RESET}")
                print(f"    Original: {self._format_size(original_size)}")
                print(f"    Compressed: {self._format_size(compressed_size)}")
                print(f"    Saved: {self._format_size(original_size - compressed_size)}")

                replaced += 1

            except Exception as e:
                print(f"  {Colors.RED}✗ Failed: {e}{Colors.RESET}")
                failed += 1

        # Summary
        print(f"\n{'='*60}")
        print(f"Replacement Summary")
        print(f"{'='*60}")
        print(f"  Total files: {len(compressed_files)}")
        print(f"  {Colors.GREEN}Replaced: {replaced}{Colors.RESET}")
        print(f"  {Colors.RED}Failed: {failed}{Colors.RESET}")
        print(f"{'='*60}\n")

    def show_stats(self):
        """Show statistics"""
        print(f"\n{'='*60}")
        print(f"Processing Statistics")
        print(f"{'='*60}")
        print(f"Cache file: {self.CACHE_JSON}")

        cache = self._read_cache_safe()
        print(f"Last update: {cache.get('last_update', 'N/A')}")
        print(f"\nFile statistics:")
        print(f"  - Total files: {len(cache['files'])}")

        status_count = {}
        for info in cache['files'].values():
            status = info.get('status', 'unknown')
            status_count[status] = status_count.get(status, 0) + 1

        for status, count in status_count.items():
            print(f"  - {status}: {count}")

        print(f"\nDirectory info:")
        print(f"  - Source: {self.SOURCE_DIR}")
        print(f"  - Temp: {self.TMP_DIR}")
        print(f"  - Compressed: {self.COMPRESS_DIR}")
        print(f"{'='*60}")

    def retry_failed_files(self):
        """Retry processing failed files"""
        print(f"\n{'='*60}")
        print(f"Retry Failed Files")
        print(f"{'='*60}")

        # Count failed files
        cache = self._read_cache_safe()
        failed_files = [
            (key, info) for key, info in cache['files'].items()
            if info.get('status') == 'failed'
        ]

        if not failed_files:
            print("No failed files to retry")
            return

        print(f"Found {len(failed_files)} failed files")
        print("\nFailed files list:")
        for i, (key, info) in enumerate(failed_files[:10], 1):
            error = info.get('error', 'Unknown error')
            print(f"  {i}. {key}")
            print(f"     Error: {error}")

        if len(failed_files) > 10:
            print(f"  ... and {len(failed_files) - 10} more")

        confirm = input("\nRetry all failed files? (yes/no, default: yes): ").strip().lower()
        if confirm in ['no', 'n']:
            print("Operation cancelled")
            return

        # Clear failed status
        failed_keys = [key for key, info in failed_files]

        def clear_failed_status(cache):
            for key in failed_keys:
                if key in cache['files']:
                    cache['files'][key]['status'] = 'pending'
                    if 'error' in cache['files'][key]:
                        del cache['files'][key]['error']

        self._update_cache_file(clear_failed_status)
        print(f"\n✓ Cleared {len(failed_files)} failed status")
        print("Run option 1 to reprocess these files")

    def scan_and_deduplicate_progressive(self):
        """
        Progressive deduplication: scan directories one by one in order
        Each directory is compared with all subsequent directories
        Already compared directories are skipped
        Supports priority directory (e.g., 'evident')
        """
        print(f"\n{'='*60}")
        print(f"Progressive Directory Deduplication")
        print(f"{'='*60}")
        print(f"Source directory: {self.SOURCE_DIR}")
        print(f"{'='*60}\n")

        # Step 1: Get all first-level directories
        print("Step 1: Scanning first-level directories...")
        first_level_dirs = []

        for item in self.SOURCE_DIR.iterdir():
            if item.is_dir():
                # Skip special directories
                if item.name.startswith('_') or item.name.startswith('.'):
                    continue
                first_level_dirs.append(item)

        first_level_dirs.sort(key=lambda x: x.name.lower())

        print(f"Found {len(first_level_dirs)} first-level directories:")
        for idx, dir_path in enumerate(first_level_dirs, 1):
            print(f"  {idx}. {dir_path.name}")

        if len(first_level_dirs) < 2:
            print(f"\nNeed at least 2 directories for deduplication. Exiting.")
            return

        # Step 2: Ask for priority directory (e.g., evident)
        print(f"\n{'='*60}")
        print(f"Priority Directory Option:")
        print(f"  You can specify a directory to have absolute priority")
        print(f"  (e.g., 'evident' to keep all files from evident)")
        print(f"{'='*60}")

        priority_input = input("\nEnter priority directory name (press Enter to skip): ").strip()

        priority_dir_path = None
        if priority_input:
            # Find the directory
            for dir_path in first_level_dirs:
                if dir_path.name.lower() == priority_input.lower():
                    priority_dir_path = dir_path
                    break

            if priority_dir_path:
                print(f"\n{Colors.GREEN}✓ Priority directory set: {priority_dir_path.name}{Colors.RESET}")
                print(f"  This directory will be processed first and have absolute priority")

                # Move priority directory to the front
                first_level_dirs.remove(priority_dir_path)
                first_level_dirs.insert(0, priority_dir_path)

                print(f"\nProcessing order:")
                for idx, dir_path in enumerate(first_level_dirs, 1):
                    if idx == 1:
                        print(f"  {idx}. {dir_path.name} {Colors.YELLOW}← PRIORITY{Colors.RESET}")
                    else:
                        print(f"  {idx}. {dir_path.name}")
            else:
                print(f"\n{Colors.RED}✗ Priority directory '{priority_input}' not found{Colors.RESET}")
                print(f"  Continuing with alphabetical order")

        # Step 3: Ask user to confirm
        print(f"\n{'='*60}")
        print(f"Deduplication Strategy:")
        if priority_dir_path:
            print(f"  - '{priority_dir_path.name}' will be processed FIRST (absolute priority)")
            print(f"  - All files in '{priority_dir_path.name}' will be kept")
            print(f"  - Duplicates in ALL other directories will be replaced")
        print(f"  - Each directory will be compared with all subsequent directories")
        print(f"  - Files in earlier directories have priority (will be kept)")
        print(f"  - Duplicate files in later directories will be replaced with placeholders")
        print(f"  - Supports all media types: videos, audios, images")
        print(f"{'='*60}\n")

        confirm = input("Start progressive deduplication? (yes/no, default: yes): ").strip().lower()
        if confirm in ['no', 'n']:
            print("Operation cancelled")
            return

        # Step 4: Progressive deduplication
        total_replaced = 0
        total_failed = 0
        total_saved = 0

        all_results = {
            'scan_time': datetime.now().isoformat(),
            'strategy': 'progressive',
            'priority_directory': priority_dir_path.name if priority_dir_path else None,
            'directories': [d.name for d in first_level_dirs],
            'comparisons': []
        }

        for idx, current_dir_path in enumerate(first_level_dirs):
            # Skip if this is the last directory (nothing to compare with)
            if idx >= len(first_level_dirs) - 1:
                break

            current_dir = current_dir_path.name
            remaining_dirs = first_level_dirs[idx + 1:]

            print(f"\n{'='*60}")
            print(f"Processing: {current_dir}")
            if idx == 0 and priority_dir_path:
                print(f"{Colors.YELLOW}  [PRIORITY DIRECTORY - Absolute precedence]{Colors.RESET}")
            print(f"Comparing with {len(remaining_dirs)} subsequent directories")
            print(f"{'='*60}\n")

            # Scan current directory
            replaced, failed, saved = self._deduplicate_one_vs_many(
                current_dir_path,
                remaining_dirs
            )

            total_replaced += replaced
            total_failed += failed
            total_saved += saved

            all_results['comparisons'].append({
                'priority_directory': current_dir,
                'is_user_priority': (idx == 0 and priority_dir_path is not None),
                'compared_with': [d.name for d in remaining_dirs],
                'replaced': replaced,
                'failed': failed,
                'saved_bytes': saved
            })

        # Save comprehensive report
        report_path = self.SOURCE_DIR / 'progressive_deduplication_report.json'
        all_results['summary'] = {
            'total_replaced': total_replaced,
            'total_failed': total_failed,
            'total_saved_bytes': total_saved
        }

        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)

        # Final summary
        print(f"\n{'='*60}")
        print(f"Progressive Deduplication Completed")
        print(f"{'='*60}")
        if priority_dir_path:
            print(f"  - Priority directory: {Colors.GREEN}{priority_dir_path.name}{Colors.RESET}")
            print(f"    All files in this directory were kept")
        print(f"  - Total replaced: {total_replaced}")
        print(f"  - Total failed: {total_failed}")
        print(f"  - Total space saved: {self._format_size(total_saved)}")
        print(f"  - Report saved: {report_path}")
        print(f"{'='*60}")

        if priority_dir_path:
            print(f"\n{Colors.GREEN}✓ Success!{Colors.RESET} All files in '{priority_dir_path.name}' have been preserved.")
            print(f"  Duplicate files in other directories have been replaced with placeholders.")
            print(f"  No duplicates remain in {self.SOURCE_DIR.name}")
        print()

    def _deduplicate_one_vs_many(self, priority_dir_path: Path, target_dirs: list) -> tuple:
        """
        Compare one priority directory with multiple target directories
        Supports videos, audios, and images
        Returns: (replaced_count, failed_count, saved_bytes)
        """
        priority_dir = priority_dir_path.name

        # Scan priority directory for all media files (videos, audios, images)
        print(f"  Scanning '{priority_dir}'...")
        priority_media = {}  # filename -> (full_path, media_type)

        video_count = 0
        audio_count = 0
        image_count = 0

        for root, dirs, files in os.walk(priority_dir_path):
            for filename in files:
                filepath = Path(root) / filename
                ext = filepath.suffix.lower()

                media_type = None
                if ext in self.VIDEO_EXTENSIONS:
                    media_type = 'video'
                    video_count += 1
                elif ext in self.AUDIO_EXTENSIONS:
                    media_type = 'audio'
                    audio_count += 1
                elif ext in self.IMAGE_EXTENSIONS:
                    media_type = 'image'
                    image_count += 1

                if media_type and filename not in priority_media:
                    priority_media[filename] = (filepath, media_type)

        total_count = video_count + audio_count + image_count
        print(f"  Found {total_count} unique media files in '{priority_dir}' (videos: {video_count}, audios: {audio_count}, images: {image_count})")

        if total_count == 0:
            print(f"  No media files found, skipping.")
            return (0, 0, 0)

        # Scan target directories for duplicate filenames
        print(f"  Scanning {len(target_dirs)} target directories...")
        duplicates_found = {}  # filename -> [list of paths in target directories]

        for target_dir_path in target_dirs:
            for root, dirs, files in os.walk(target_dir_path):
                for filename in files:
                    filepath = Path(root) / filename
                    ext = filepath.suffix.lower()

                    # Check if this is a media file
                    is_media = (ext in self.VIDEO_EXTENSIONS or
                               ext in self.AUDIO_EXTENSIONS or
                               ext in self.IMAGE_EXTENSIONS)

                    if is_media and filename in priority_media:
                        if filename not in duplicates_found:
                            duplicates_found[filename] = []
                        duplicates_found[filename].append(filepath)

        if len(duplicates_found) == 0:
            print(f"  No duplicates found.")
            return (0, 0, 0)

        # Display results
        total_duplicate_files = sum(len(paths) for paths in duplicates_found.values())
        total_size = sum(
            dup_path.stat().st_size
            for paths in duplicates_found.values()
            for dup_path in paths
        )

        print(f"  {Colors.YELLOW}Found {len(duplicates_found)} duplicate filenames ({total_duplicate_files} files){Colors.RESET}")
        print(f"  {Colors.CYAN}Potential savings: {self._format_size(total_size)}{Colors.RESET}")

        # Replace duplicates with placeholders
        replaced = 0
        failed = 0
        saved_space = 0

        for filename, dup_paths in duplicates_found.items():
            priority_path, media_type = priority_media[filename]
            priority_rel = priority_path.relative_to(self.SOURCE_DIR)

            for dup_path in dup_paths:
                dup_rel = dup_path.relative_to(self.SOURCE_DIR)

                try:
                    original_size = dup_path.stat().st_size

                    # Create placeholder content with media type
                    media_type_label = {
                        'video': 'video',
                        'audio': 'audio',
                        'image': 'image'
                    }.get(media_type, 'media file')

                    txt_content = f"""# Duplicate Filename Placeholder (Progressive Deduplication)
# This {media_type_label} has the same filename as a {media_type_label} in the priority directory
# Priority file location: {priority_rel}
#
# Original file: {filename}
# Media type: {media_type}
# This location: {dup_rel}
# Priority location: {priority_rel}
# Replaced at: {datetime.now().isoformat()}
#
# To restore: Copy the file from {priority_rel}
# Note: This file was replaced during progressive deduplication ('{priority_dir}' has priority)
"""

                    # Backup and replace
                    backup_path = dup_path.with_suffix(dup_path.suffix + '.bak')
                    shutil.move(dup_path, backup_path)

                    txt_path = dup_path.with_suffix('.duplicate_priority.txt')
                    txt_path.write_text(txt_content, encoding='utf-8')

                    backup_path.unlink()

                    replaced += 1
                    saved_space += original_size

                except Exception as e:
                    print(f"    {Colors.RED}✗ Failed: {dup_rel} - {e}{Colors.RESET}")
                    failed += 1

        print(f"  {Colors.GREEN}✓ Replaced: {replaced}, Failed: {failed}, Saved: {self._format_size(saved_space)}{Colors.RESET}")

        return (replaced, failed, saved_space)

    def _deduplicate_directory(self, root_dir: Path) -> dict:
        """
        Deduplicate files within a directory (progressive deduplication)
        Returns: {'replaced': int, 'failed': int, 'saved': int}
        """
        print(f"Scanning subdirectories in {root_dir}...")

        # Get all first-level directories
        first_level_dirs = []
        for item in root_dir.iterdir():
            if item.is_dir():
                # Skip special directories
                if item.name.startswith('_') or item.name.startswith('.'):
                    continue
                first_level_dirs.append(item)

        first_level_dirs.sort(key=lambda x: x.name.lower())

        print(f"Found {len(first_level_dirs)} subdirectories")

        if len(first_level_dirs) < 2:
            print("Need at least 2 directories for deduplication")
            return {'replaced': 0, 'failed': 0, 'saved': 0}

        # Show processing order
        print(f"\nProcessing order:")
        for idx, dir_path in enumerate(first_level_dirs, 1):
            print(f"  {idx}. {dir_path.name}")

        total_replaced = 0
        total_failed = 0
        total_saved = 0

        # Progressive deduplication
        for idx, current_dir_path in enumerate(first_level_dirs):
            # Skip if this is the last directory (nothing to compare with)
            if idx >= len(first_level_dirs) - 1:
                break

            current_dir = current_dir_path.name
            remaining_dirs = first_level_dirs[idx + 1:]

            print(f"\n{Colors.CYAN}Processing: {current_dir}{Colors.RESET}")
            print(f"Comparing with {len(remaining_dirs)} subsequent directories")

            # Scan current directory for media files
            priority_media = {}  # filename -> (full_path, media_type)
            video_count = 0
            audio_count = 0
            image_count = 0

            for root, dirs, files in os.walk(current_dir_path):
                for filename in files:
                    filepath = Path(root) / filename
                    ext = filepath.suffix.lower()

                    media_type = None
                    if ext in self.VIDEO_EXTENSIONS:
                        media_type = 'video'
                        video_count += 1
                    elif ext in self.AUDIO_EXTENSIONS:
                        media_type = 'audio'
                        audio_count += 1
                    elif ext in self.IMAGE_EXTENSIONS:
                        media_type = 'image'
                        image_count += 1

                    if media_type and filename not in priority_media:
                        priority_media[filename] = (filepath, media_type)

            total_count = video_count + audio_count + image_count
            print(f"  Found {total_count} media files (videos: {video_count}, audios: {audio_count}, images: {image_count})")

            if total_count == 0:
                print(f"  No media files, skipping")
                continue

            # Scan target directories for duplicates
            duplicates_found = {}  # filename -> [list of paths]

            for target_dir_path in remaining_dirs:
                for root, dirs, files in os.walk(target_dir_path):
                    for filename in files:
                        filepath = Path(root) / filename
                        ext = filepath.suffix.lower()

                        is_media = (ext in self.VIDEO_EXTENSIONS or
                                   ext in self.AUDIO_EXTENSIONS or
                                   ext in self.IMAGE_EXTENSIONS)

                        if is_media and filename in priority_media:
                            if filename not in duplicates_found:
                                duplicates_found[filename] = []
                            duplicates_found[filename].append(filepath)

            if len(duplicates_found) == 0:
                print(f"  No duplicates found")
                continue

            # Replace duplicates with placeholders
            replaced = 0
            failed = 0
            saved_space = 0

            for filename, dup_paths in duplicates_found.items():
                priority_path, media_type = priority_media[filename]
                priority_rel = priority_path.relative_to(root_dir)

                for dup_path in dup_paths:
                    dup_rel = dup_path.relative_to(root_dir)

                    try:
                        original_size = dup_path.stat().st_size

                        # Create placeholder content
                        media_type_label = {
                            'video': 'video',
                            'audio': 'audio',
                            'image': 'image'
                        }.get(media_type, 'media file')

                        txt_content = f"""# Duplicate Filename Placeholder (External Drive Deduplication)
# This {media_type_label} has the same filename as a {media_type_label} in another directory
# Original file location: {priority_rel}
#
# Original file: {filename}
# Media type: {media_type}
# This location: {dup_rel}
# Reference location: {priority_rel}
# Replaced at: {datetime.now().isoformat()}
#
# To restore: Copy the file from {priority_rel}
# Note: This file was replaced during external drive deduplication
"""

                        # Backup and replace
                        backup_path = dup_path.with_suffix(dup_path.suffix + '.bak')
                        shutil.move(dup_path, backup_path)

                        txt_path = dup_path.with_suffix('.duplicate_external.txt')
                        txt_path.write_text(txt_content, encoding='utf-8')

                        backup_path.unlink()

                        replaced += 1
                        saved_space += original_size

                    except Exception as e:
                        print(f"    {Colors.RED}✗ Failed: {dup_rel} - {e}{Colors.RESET}")
                        failed += 1

            print(f"  {Colors.GREEN}✓ Replaced: {replaced}, Failed: {failed}, Saved: {self._format_size(saved_space)}{Colors.RESET}")

            total_replaced += replaced
            total_failed += failed
            total_saved += saved_space

        return {
            'replaced': total_replaced,
            'failed': total_failed,
            'saved': total_saved
        }

    def copy_to_external_drive(self):
        """
        Copy files from source to external drive with smart handling
        - Skip Windows ' Copy' files during copy
        - Compare file sizes before replacing
        - Clean up ' Copy' files after copying
        """
        source_dir = self.SOURCE_DIR
        target_dir = Path(r"E:\Evidences")

        print(f"\n{'='*60}")
        print(f"Smart Copy to External Drive")
        print(f"{'='*60}")
        print(f"Source: {source_dir}")
        print(f"Target: {target_dir}")
        print(f"{'='*60}\n")

        # Check if target directory exists
        if not target_dir.exists():
            print(f"{Colors.YELLOW}Target directory does not exist. Creating...{Colors.RESET}")
            target_dir.mkdir(parents=True, exist_ok=True)
            print(f"{Colors.GREEN}✓ Created: {target_dir}{Colors.RESET}\n")

        # Step 1: Scan source files
        print("Step 1: Scanning source files...")
        all_files = []
        skipped_copy_files = []

        for root, dirs, files in os.walk(source_dir):
            # Skip special directories
            if '_tmp' in root or '_compress' in root:
                continue

            for filename in files:
                source_path = Path(root) / filename
                rel_path = source_path.relative_to(source_dir)

                # Check if this is a Windows ' Copy' file
                name_without_ext = source_path.stem
                if name_without_ext.endswith(' Copy'):
                    skipped_copy_files.append(rel_path)
                    continue

                all_files.append((source_path, rel_path))

        print(f"Found {len(all_files)} files to copy")
        print(f"Skipped {len(skipped_copy_files)} Windows ' Copy' files\n")

        if len(all_files) == 0:
            print("No files to copy. Exiting.")
            return

        # Step 2: Confirm
        confirm = input(f"Start copying {len(all_files)} files? (yes/no, default: yes): ").strip().lower()
        if confirm in ['no', 'n']:
            print("Operation cancelled")
            return

        # Step 3: Copy files
        print(f"\n{'='*60}")
        print(f"Copying files...")
        print(f"{'='*60}\n")

        copied = 0
        replaced = 0
        skipped = 0
        failed = 0

        for idx, (source_path, rel_path) in enumerate(all_files, 1):
            target_path = target_dir / rel_path

            try:
                # Create target directory
                target_path.parent.mkdir(parents=True, exist_ok=True)

                # Check if target exists
                if target_path.exists():
                    source_size = source_path.stat().st_size
                    target_size = target_path.stat().st_size

                    print(f"[{idx}/{len(all_files)}] {Colors.YELLOW}Exists:{Colors.RESET} {rel_path}")
                    print(f"  Source: {self._format_size(source_size)}")
                    print(f"  Target: {self._format_size(target_size)}")

                    if source_size == target_size:
                        print(f"  {Colors.CYAN}→ Same size, skipping{Colors.RESET}")
                        skipped += 1
                        continue
                    elif target_size > source_size:
                        # Target is larger, replace with source
                        print(f"  {Colors.GREEN}→ Target larger, replacing with source{Colors.RESET}")
                        shutil.copy2(source_path, target_path)
                        replaced += 1
                    else:
                        # Source is larger, keep target
                        print(f"  {Colors.MAGENTA}→ Source larger, keeping target{Colors.RESET}")
                        skipped += 1
                        continue
                else:
                    # New file, copy
                    shutil.copy2(source_path, target_path)

                    if (idx % 50) == 0:  # Print progress every 50 files
                        print(f"[{idx}/{len(all_files)}] Copying... {rel_path}")

                    copied += 1

            except Exception as e:
                print(f"[{idx}/{len(all_files)}] {Colors.RED}✗ Failed:{Colors.RESET} {rel_path}")
                print(f"  Error: {e}")
                failed += 1

        print(f"\n{'='*60}")
        print(f"Copy completed")
        print(f"  - New files copied: {copied}")
        print(f"  - Files replaced: {replaced}")
        print(f"  - Files skipped (same size): {skipped}")
        print(f"  - Failed: {failed}")
        print(f"{'='*60}\n")

        # Step 4: Clean up ' Copy' files in target directory
        print(f"{'='*60}")
        print(f"Step 2: Cleaning up Windows ' Copy' files in target...")
        print(f"{'='*60}\n")

        copy_files = []
        for root, dirs, files in os.walk(target_dir):
            for filename in files:
                file_path = Path(root) / filename
                name_without_ext = file_path.stem

                if name_without_ext.endswith(' Copy'):
                    copy_files.append(file_path)

        print(f"Found {len(copy_files)} Windows ' Copy' files in target directory")

        if len(copy_files) == 0:
            print("No ' Copy' files to clean up.\n")
            return

        deleted = 0
        renamed = 0

        for copy_file in copy_files:
            # Generate normal filename
            original_name = copy_file.stem.replace(' Copy', '') + copy_file.suffix
            original_path = copy_file.parent / original_name

            try:
                if original_path.exists():
                    # Normal file exists, delete ' Copy' file
                    copy_file.unlink()
                    print(f"{Colors.GREEN}✓ Deleted:{Colors.RESET} {copy_file.relative_to(target_dir)}")
                    print(f"  (Normal file exists: {original_path.name})")
                    deleted += 1
                else:
                    # Normal file doesn't exist, rename ' Copy' file
                    copy_file.rename(original_path)
                    print(f"{Colors.CYAN}→ Renamed:{Colors.RESET} {copy_file.relative_to(target_dir)}")
                    print(f"  To: {original_path.name}")
                    renamed += 1

            except Exception as e:
                print(f"{Colors.RED}✗ Failed:{Colors.RESET} {copy_file.relative_to(target_dir)}")
                print(f"  Error: {e}")

        print(f"\n{'='*60}")
        print(f"Cleanup completed")
        print(f"  - ' Copy' files deleted: {deleted}")
        print(f"  - ' Copy' files renamed: {renamed}")
        print(f"{'='*60}\n")

        # Step 5: Deduplicate files in target directory
        print(f"{'='*60}")
        print(f"Step 3: Deduplicating files in target directory...")
        print(f"{'='*60}\n")

        dedup_confirm = input("Perform deduplication on E:\\Evidences? (yes/no, default: yes): ").strip().lower()
        if dedup_confirm in ['no', 'n']:
            print("Deduplication skipped")
            print(f"{Colors.GREEN}✓ Copy operations completed!{Colors.RESET}")
            print(f"Target directory: {target_dir}\n")
            return

        # Deduplicate target directory
        dedup_stats = self._deduplicate_directory(target_dir)

        print(f"\n{'='*60}")
        print(f"Deduplication completed")
        print(f"  - Duplicates replaced: {dedup_stats['replaced']}")
        print(f"  - Failed: {dedup_stats['failed']}")
        print(f"  - Space saved: {self._format_size(dedup_stats['saved'])}")
        print(f"{'='*60}\n")

        print(f"{Colors.GREEN}✓ All operations completed!{Colors.RESET}")
        print(f"Target directory: {target_dir}")
        print(f"No duplicate files remain in target directory\n")

    def detect_corrupted_videos(self):
        """
        Detect corrupted video files and move them to subdirectory
        - Scan primary directory for corrupted videos
        - Move corrupted videos to _corrupted_videos subdirectory
        - Also move corresponding files from secondary directory
        """
        print(f"\n{'='*60}")
        print(f"Detect Corrupted Videos")
        print(f"{'='*60}\n")

        # Primary directory to scan
        primary_dir_input = input("Primary directory (default: D:\\.tmp\\BaiduNetdiskDownload): ").strip()
        primary_dir = Path(primary_dir_input) if primary_dir_input else Path(r"D:\.tmp\BaiduNetdiskDownload")

        # Secondary directory (mirror structure)
        secondary_dir_input = input("Secondary directory (default: E:\\Evidences): ").strip()
        secondary_dir = Path(secondary_dir_input) if secondary_dir_input else Path(r"E:\Evidences")

        # Check if primary directory exists
        if not primary_dir.exists():
            print(f"{Colors.RED}Error: Primary directory does not exist: {primary_dir}{Colors.RESET}")
            return

        # Create corrupted subdirectories
        primary_corrupted_dir = primary_dir / "_corrupted_videos"
        primary_corrupted_dir.mkdir(parents=True, exist_ok=True)

        secondary_corrupted_dir = None
        if secondary_dir.exists():
            secondary_corrupted_dir = secondary_dir / "_corrupted_videos"
            secondary_corrupted_dir.mkdir(parents=True, exist_ok=True)
            print(f"Secondary directory found: {secondary_dir}")
        else:
            print(f"{Colors.YELLOW}Warning: Secondary directory not found: {secondary_dir}{Colors.RESET}")
            print(f"Will only process primary directory")

        print(f"\nScanning directory: {primary_dir}")
        print(f"Corrupted videos will be moved to: {primary_corrupted_dir}")
        if secondary_corrupted_dir:
            print(f"Secondary corrupted videos will be moved to: {secondary_corrupted_dir}\n")
        else:
            print()

        # Scan primary directory
        print("Scanning for video files...")
        all_videos = []

        for root, dirs, files in os.walk(primary_dir):
            # Skip special directories
            if '_corrupted_videos' in root or '_tmp' in root or '_compress' in root:
                continue

            for filename in files:
                filepath = Path(root) / filename
                ext = filepath.suffix.lower()

                if ext in self.VIDEO_EXTENSIONS:
                    try:
                        size = filepath.stat().st_size
                        rel_path = filepath.relative_to(primary_dir)
                        video_info = {
                            'path': filepath,
                            'rel_path': rel_path,
                            'size': size,
                            'filename': filename
                        }
                        all_videos.append(video_info)

                    except Exception as e:
                        print(f"{Colors.RED}✗ Cannot access: {filepath} - {e}{Colors.RESET}")

        print(f"Found {len(all_videos)} video files\n")

        if len(all_videos) == 0:
            print("No video files found. Exiting.")
            return

        # Confirm
        confirm = input(f"Start checking {len(all_videos)} videos? (yes/no, default: yes): ").strip().lower()
        if confirm in ['no', 'n']:
            print("Operation cancelled")
            return

        # Check ffmpeg availability
        if not self._check_ffmpeg():
            print(f"{Colors.RED}Error: ffmpeg/ffprobe not found in PATH{Colors.RESET}")
            print("Please install ffmpeg to use this feature")
            return

        # Check each video
        print(f"\n{'='*60}")
        print(f"Checking video files...")
        print(f"{'='*60}\n")

        corrupted = []
        valid = []
        failed_check = []
        moved_primary = 0
        moved_secondary = 0

        for idx, video_info in enumerate(all_videos, 1):
            filepath = video_info['path']
            rel_path = video_info['rel_path']

            print(f"[{idx}/{len(all_videos)}] Checking: {rel_path}")

            # Verify video
            is_valid = self._verify_file(filepath)

            if is_valid is None:
                # Failed to check
                failed_check.append(video_info)
                print(f"  {Colors.YELLOW}⚠ Cannot verify{Colors.RESET}")
            elif is_valid:
                # Valid video
                valid.append(video_info)
                if idx % 50 == 0:  # Only print every 50 files
                    print(f"  {Colors.GREEN}✓ Valid{Colors.RESET}")
            else:
                # Corrupted video
                corrupted.append(video_info)
                print(f"  {Colors.RED}✗ CORRUPTED{Colors.RESET}")
                print(f"    Size: {self._format_size(video_info['size'])}")

                # Move to corrupted subdirectory in primary directory
                try:
                    # Create subdirectory structure if needed
                    dest_rel_dir = rel_path.parent
                    dest_dir = primary_corrupted_dir / dest_rel_dir
                    dest_dir.mkdir(parents=True, exist_ok=True)

                    dest_path = dest_dir / filepath.name

                    # If file already exists, add number suffix
                    if dest_path.exists():
                        base_name = filepath.stem
                        ext = filepath.suffix
                        counter = 1
                        while dest_path.exists():
                            dest_path = dest_dir / f"{base_name}_{counter}{ext}"
                            counter += 1

                    shutil.move(str(filepath), str(dest_path))
                    moved_primary += 1
                    print(f"    {Colors.GREEN}→ Moved to: {dest_path.relative_to(primary_dir)}{Colors.RESET}")
                    video_info['moved_primary'] = True
                except Exception as e:
                    print(f"    {Colors.RED}✗ Failed to move from primary: {e}{Colors.RESET}")
                    video_info['moved_primary'] = False

                # Also move from secondary directory if exists
                if secondary_corrupted_dir and secondary_dir.exists():
                    try:
                        secondary_file = secondary_dir / rel_path
                        if secondary_file.exists():
                            # Create same subdirectory structure
                            secondary_dest_dir = secondary_corrupted_dir / dest_rel_dir
                            secondary_dest_dir.mkdir(parents=True, exist_ok=True)

                            secondary_dest_path = secondary_dest_dir / filepath.name

                            # If file already exists, add number suffix
                            if secondary_dest_path.exists():
                                base_name = filepath.stem
                                ext = filepath.suffix
                                counter = 1
                                while secondary_dest_path.exists():
                                    secondary_dest_path = secondary_dest_dir / f"{base_name}_{counter}{ext}"
                                    counter += 1

                            shutil.move(str(secondary_file), str(secondary_dest_path))
                            moved_secondary += 1
                            print(f"    {Colors.GREEN}→ Also moved from secondary: {secondary_dest_path.relative_to(secondary_dir)}{Colors.RESET}")
                            video_info['moved_secondary'] = True
                        else:
                            print(f"    {Colors.YELLOW}⚠ No corresponding file in secondary directory{Colors.RESET}")
                            video_info['moved_secondary'] = False
                    except Exception as e:
                        print(f"    {Colors.RED}✗ Failed to move from secondary: {e}{Colors.RESET}")
                        video_info['moved_secondary'] = False
                else:
                    video_info['moved_secondary'] = False

        # Summary
        print(f"\n{'='*60}")
        print(f"Scan Results")
        print(f"{'='*60}")
        print(f"  - Total videos scanned: {len(all_videos)}")
        print(f"  - Valid: {Colors.GREEN}{len(valid)}{Colors.RESET}")
        print(f"  - Corrupted: {Colors.RED}{len(corrupted)}{Colors.RESET}")
        print(f"    - Moved from primary directory: {Colors.GREEN}{moved_primary}{Colors.RESET}")
        if secondary_corrupted_dir:
            print(f"    - Moved from secondary directory: {Colors.GREEN}{moved_secondary}{Colors.RESET}")
        print(f"  - Failed to check: {Colors.YELLOW}{len(failed_check)}{Colors.RESET}")
        print(f"{'='*60}\n")

        # Show corrupted files
        if corrupted:
            print(f"{Colors.RED}Corrupted Videos:{Colors.RESET}")
            for video_info in corrupted:
                print(f"  - {video_info['rel_path']}")
                print(f"    Size: {self._format_size(video_info['size'])}")
                if video_info.get('moved_primary'):
                    print(f"    {Colors.GREEN}✓ Moved from primary{Colors.RESET}")
                if video_info.get('moved_secondary'):
                    print(f"    {Colors.GREEN}✓ Moved from secondary{Colors.RESET}")
            print()

        # Save report
        report = {
            'scan_time': datetime.now().isoformat(),
            'primary_directory': str(primary_dir),
            'secondary_directory': str(secondary_dir) if secondary_dir.exists() else None,
            'primary_corrupted_dir': str(primary_corrupted_dir),
            'secondary_corrupted_dir': str(secondary_corrupted_dir) if secondary_corrupted_dir else None,
            'summary': {
                'total': len(all_videos),
                'valid': len(valid),
                'corrupted': len(corrupted),
                'moved_from_primary': moved_primary,
                'moved_from_secondary': moved_secondary,
                'failed_check': len(failed_check)
            },
            'corrupted_videos': [
                {
                    'path': str(v['rel_path']),
                    'full_path': str(v['path']),
                    'size': v['size'],
                    'moved_primary': v.get('moved_primary', False),
                    'moved_secondary': v.get('moved_secondary', False),
                    'filename': v['filename']
                }
                for v in corrupted
            ],
            'failed_check': [
                {
                    'path': str(v['rel_path']),
                    'full_path': str(v['path']),
                    'size': v['size']
                }
                for v in failed_check
            ]
        }

        report_path = Path.cwd() / 'corrupted_videos_report.json'
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        print(f"{Colors.GREEN}✓ Report saved: {report_path}{Colors.RESET}\n")

