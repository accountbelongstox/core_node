"""
Baidu Netdisk Media File Compression Tool
Features: Scan, compress images/videos/audios, support resume and safe replacement
"""

import os
import json
import shutil
import hashlib
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple
import subprocess

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
        """Compress image"""
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
        """Compress video (no upscaling)"""
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

    def scan_and_compress_one_by_one(self):
        """Scan and compress files one by one (copy → compress → delete → next)"""
        print(f"\n{'='*60}")
        print(f"Starting One-by-One Processing (Low Disk Usage Mode)")
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

                # Check if already compressed or failed
                if file_key in self.cache['files']:
                    cached_status = self.cache['files'][file_key].get('status')
                    if cached_status == 'compressed':
                        print(f"\nSkip compressed: {rel_path}")
                        skipped += 1
                        continue
                    elif cached_status == 'failed':
                        cached_error = self.cache['files'][file_key].get('error', 'Unknown error')
                        print(f"\nSkip failed file: {rel_path}")
                        print(f"  Previous error: {cached_error}")
                        skipped += 1
                        continue

                # Check duplicate
                if self._is_duplicate_media(filepath, file_type[:-1]):  # Remove plural 's'
                    print(f"\nSkip duplicate: {rel_path}")
                    skipped += 1
                    self.cache['stats']['skipped'] += 1
                    continue

                processed += 1
                original_size = filepath.stat().st_size

                # Progress header
                print(f"\n{'-'*60}")
                print(f"[{processed}/{total_files - skipped}] Processing: {rel_path}")
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
                            if file_key not in self.cache['files']:
                                self.cache['files'][file_key] = {
                                    'type': file_type[:-1],
                                    'source': str(filepath),
                                    'size': original_size,
                                }
                            self.cache['files'][file_key]['status'] = 'failed'
                            self.cache['files'][file_key]['error'] = 'Source file corrupted'

                            if processed % 5 == 0:
                                self._save_cache()
                            continue
                    # Initialize cache entry
                    if file_key not in self.cache['files']:
                        self.cache['files'][file_key] = {
                            'type': file_type[:-1],  # Remove plural 's'
                            'source': str(filepath),
                            'size': original_size,
                            'status': 'pending'
                        }

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
                            self.cache['files'][file_key].update({
                                'status': 'compressed',
                                'compressed_size': compressed_size,
                                'compression_ratio': f"{ratio:.1f}%",
                                'compressed_at': datetime.now().isoformat()
                            })

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

                            # Save cache and continue
                            if processed % 5 == 0:
                                self._save_cache()
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
                        tmp_path.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(filepath, tmp_path)
                        self.cache['files'][file_key]['status'] = 'copied'

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
                            self.cache['files'][file_key].update({
                                'status': 'compressed',
                                'compressed_size': compressed_size,
                                'compression_ratio': f"{ratio:.1f}%",
                                'compressed_at': datetime.now().isoformat()
                            })

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

                # Save cache after each file
                if processed % 5 == 0:
                    self._save_cache()

        # Update final stats
        self.cache['stats']['compressed'] = success
        self.cache['stats']['failed'] = failed
        self.cache['stats']['skipped'] = skipped
        self._save_cache()

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
        for root, dirs, files in os.walk(self.TMP_DIR):
            for filename in files:
                tmp_path = Path(root) / filename
                rel_path = tmp_path.relative_to(self.TMP_DIR)
                file_key = str(rel_path)

                # Skip already compressed
                if file_key in self.cache['files']:
                    if self.cache['files'][file_key].get('status') == 'compressed':
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
                if file_key in self.cache['files']:
                    status = self.cache['files'][file_key].get('status')
                    if status == 'compressed':
                        continue

                processed += 1
                ext = tmp_path.suffix.lower()

                # Progress header
                print(f"\n{'-'*60}")
                print(f"[{processed}/{total_to_process}] Processing: {rel_path}")
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
                        if file_key not in self.cache['files']:
                            self.cache['files'][file_key] = {}

                        self.cache['files'][file_key].update({
                            'status': 'compressed',
                            'compressed_size': compressed_size,
                            'compression_ratio': f"{ratio:.1f}%",
                            'compressed_at': datetime.now().isoformat()
                        })

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

                # Save cache periodically
                if processed % 5 == 0:
                    self._save_cache()

        # Update stats
        self.cache['stats']['compressed'] = success
        self.cache['stats']['failed'] = failed
        self._save_cache()

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


def show_menu():
    """Show main menu"""
    print(f"\n{'='*60}")
    print(f"  Baidu Netdisk Media Compression Tool")
    print(f"{'='*60}")
    print("1. Scan and Compress Files (One-by-One)")
    print("   - Process each file individually")
    print("   - Copy → Compress → Delete temp → Next")
    print("   - Low disk usage mode")
    print()
    print("2. Replace Original Files")
    print("   - Replace originals with compressed")
    print("   - WARNING: Will overwrite originals!")
    print()
    print("3. Show Statistics")
    print()
    print("4. Retry Failed Files")
    print("   - Clear failed status and retry")
    print()
    print("0. Exit")
    print(f"{'='*60}")


def main():
    """Main program"""
    compressor = MediaCompressor()

    while True:
        show_menu()
        choice = input("\nSelect operation (0-4): ").strip()

        if choice == '1':
            print("\n" + "="*60)
            print("Executing: Scan and Compress (One-by-One Mode)")
            print("="*60)

            # One-by-one processing: copy → compress → delete → next
            compressor.scan_and_compress_one_by_one()

            print("\nProcess completed! Please verify compression results before replacing originals")

        elif choice == '2':
            compressor.replace_original_files()

        elif choice == '3':
            compressor.show_stats()

        elif choice == '4':
            compressor.retry_failed_files()

        elif choice == '0':
            print("\nGoodbye!")
            break

        else:
            print("Invalid choice, please try again")

        input("\nPress Enter to continue...")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProgram interrupted by user")
    except Exception as e:
        print(f"\nProgram error: {e}")
        import traceback
        traceback.print_exc()
