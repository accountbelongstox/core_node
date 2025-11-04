"""
Media Compressor Core Module
Handles compression of images, videos, and audio files
"""

import os
import json
import shutil
import hashlib
import re
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

# Import unified media compressor from pyutils
try:
    from pycore.pyutils import MediaCompressor as UnifiedMediaCompressor, CompressionStats
    UNIFIED_COMPRESSOR_AVAILABLE = True
except ImportError:
    print("Warning: pycore.pyutils.MediaCompressor not available")
    print("Falling back to legacy compression methods")
    UNIFIED_COMPRESSOR_AVAILABLE = False
    UnifiedMediaCompressor = None
    CompressionStats = None

try:
    from PIL import Image
except ImportError:
    print("Warning: PIL/Pillow not installed, image compression will be disabled")
    print("Please run: pip install Pillow")
    Image = None


class MediaCompressor:
    """Media File Compressor"""

    # Configuration Constants
    SOURCE_DIR = Path(r"D:\.tmp\BaiduNetdiskDownload")
    TMP_DIR = Path(r"D:\.tmp\BaiduNetdiskDownload\_tmp")
    COMPRESS_DIR = Path(r"D:\.tmp\BaiduNetdiskDownload\_compress")
    CACHE_JSON = SOURCE_DIR / "compression_cache.json"

    # Supported File Types
    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff'}
    VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'}
    AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'}

    # Compression Parameters
    IMAGE_MAX_DIMENSION = 720  # 720P
    IMAGE_MAX_SIZE_KB = 500    # 500KB
    IMAGE_QUALITY = 85         # JPEG quality

    VIDEO_CRF = 28            # Video quality (18-28 recommended, higher = more compression)
    VIDEO_PRESET = 'medium'   # Compression speed (ultrafast/fast/medium/slow)
    VIDEO_MAX_DIMENSION = 720 # Max resolution

    AUDIO_BITRATE = '128k'    # Audio bitrate

    def __init__(self):
        """Initialize"""
        self.cache = self._load_cache()
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

    def _ensure_directories(self):
        """Ensure necessary directories exist"""
        self.TMP_DIR.mkdir(parents=True, exist_ok=True)
        self.COMPRESS_DIR.mkdir(parents=True, exist_ok=True)

    def _load_cache(self) -> Dict:
        """Load cache JSON"""
        if self.CACHE_JSON.exists():
            try:
                with open(self.CACHE_JSON, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Failed to load cache: {e}")
                return self._create_empty_cache()
        return self._create_empty_cache()

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

    def _save_cache(self):
        """Save cache"""
        self.cache['last_update'] = datetime.now().isoformat()
        try:
            with open(self.CACHE_JSON, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=2)
            print(f"Cache saved: {self.CACHE_JSON}")
        except Exception as e:
            print(f"Failed to save cache: {e}")

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

    def _is_duplicate_media(self, filepath: Path, file_type: str) -> bool:
        """Check if video/audio is duplicate (based on filename)"""
        if file_type not in ['video', 'audio']:
            return False

        filename = filepath.name
        for key, info in self.cache['files'].items():
            if info.get('type') == file_type and info.get('status') == 'compressed':
                cached_path = Path(key)
                if cached_path.name == filename and cached_path != filepath:
                    print(f"Found duplicate file (same filename): {filename}")
                    return True
        return False

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
                if self._is_duplicate_media(filepath, file_type[:-1]):  # Remove plural 's'
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
                # Ensure destination directory exists
                dst.parent.mkdir(parents=True, exist_ok=True)

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
                    input_path=src,
                    output_path=dst,
                    quality=self.IMAGE_QUALITY,
                    resize=resize_dims,
                    use_gpu=True  # Enable GPU if available
                )

                return stats.compressed_size > 0

            except Exception as e:
                print(f"  Unified compressor failed, falling back to legacy: {e}")
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
                dst.parent.mkdir(parents=True, exist_ok=True)

                # Force save as JPEG for better compression
                save_path = dst.with_suffix('.jpg') if dst.suffix.lower() != '.jpg' else dst
                img.save(save_path, 'JPEG', quality=self.IMAGE_QUALITY, optimize=True)

                # Update filename if extension changed
                if save_path != dst:
                    dst = save_path

                return True

        except Exception as e:
            print(f"Image compression failed: {e}")
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

    def _verify_file(self, filepath: Path) -> bool:
        """Verify file integrity"""
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

            # Other files are considered valid
            return True

        except Exception as e:
            print(f"Verification failed: {e}")
            return False

    def _format_size(self, size_bytes: int) -> str:
        """Format file size"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f}TB"

    def show_stats(self):
        """Show statistics"""
        print(f"\n{'='*60}")
        print(f"Processing Statistics")
        print(f"{'='*60}")
        print(f"Cache file: {self.CACHE_JSON}")
        print(f"Last update: {self.cache.get('last_update', 'N/A')}")
        print(f"\nFile statistics:")
        print(f"  - Total files: {len(self.cache['files'])}")

        status_count = {}
        for info in self.cache['files'].values():
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
        failed_files = [
            (key, info) for key, info in self.cache['files'].items()
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

        confirm = input("\nRetry all failed files? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("Operation cancelled")
            return

        # Clear failed status
        for key, info in failed_files:
            info['status'] = 'pending'
            if 'error' in info:
                del info['error']

        self._save_cache()
        print(f"\n✓ Cleared {len(failed_files)} failed status")
        print("Run option 1 to reprocess these files")

    def replace_original_files(self):
        """Replace original files with compressed files"""
        print(f"\nReplacing original files")
        print(f"WARNING: This will overwrite original files!")

        confirm = input("Confirm to continue? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("Operation cancelled")
            return

        replaced = 0
        failed = 0

        for file_key, info in self.cache['files'].items():
            if info.get('status') != 'compressed':
                continue

            rel_path = Path(file_key)
            compress_path = self.COMPRESS_DIR / rel_path
            source_path = Path(info['source'])

            if not compress_path.exists():
                print(f"Compressed file doesn't exist: {compress_path}")
                failed += 1
                continue

            try:
                # Backup original file (rename to .bak)
                backup_path = None
                if source_path.exists():
                    backup_path = source_path.with_suffix(source_path.suffix + '.bak')
                    shutil.move(source_path, backup_path)
                    print(f"Backed up original: {backup_path.name}")

                # Copy compressed file to original location
                shutil.copy2(compress_path, source_path)

                # Verify
                if self._verify_file(source_path):
                    # Delete backup
                    if backup_path and backup_path.exists():
                        backup_path.unlink()

                    # Update cache
                    info['status'] = 'replaced'
                    info['replaced_at'] = datetime.now().isoformat()

                    print(f"[{replaced+1}] Replaced: {rel_path}")
                    replaced += 1
                else:
                    # Restore backup
                    if backup_path and backup_path.exists():
                        shutil.move(backup_path, source_path)
                    print(f"Verification failed, restored original: {rel_path}")
                    failed += 1

            except Exception as e:
                print(f"Replacement failed {rel_path}: {e}")
                # Try to restore
                if backup_path and backup_path.exists():
                    try:
                        shutil.move(backup_path, source_path)
                    except:
                        pass
                failed += 1

        self._save_cache()

        print(f"\n{'='*60}")
        print(f"Replacement completed")
        print(f"  - Success: {replaced}")
        print(f"  - Failed: {failed}")
        print(f"{'='*60}")
