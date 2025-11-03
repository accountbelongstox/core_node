"""
Media Compressor Batch Processing Module
Handles batch and sequential compression operations
"""

import os
import shutil
from pathlib import Path
from datetime import datetime

# Import unified media compressor components
try:
    from pycore.pyutils import CompressionTask
    UNIFIED_COMPRESSOR_AVAILABLE = True
except ImportError:
    UNIFIED_COMPRESSOR_AVAILABLE = False
    CompressionTask = None

try:
    from PIL import Image
except ImportError:
    Image = None


class MediaCompressorBatch:
    """Batch compression methods for MediaCompressor"""

    def scan_and_compress_batch(self):
        """
        Scan and compress files with auto mode selection
        - GPU available: Multi-threaded batch processing
        - No GPU: Fallback to one-by-one processing
        """
        # Display mode info and get user confirmation
        is_multithreaded = False
        workers = 1

        if self.unified_compressor:
            status = self.unified_compressor.get_status_info()
            gpu_available = status.get('cuda_available', False)
            workers = status.get('max_workers', 1)
            is_multithreaded = workers > 1

            print(f"\n{'='*60}")
            if gpu_available:
                print(f"Auto Mode: Multi-threaded Batch Processing")
                print(f"GPU: {status.get('gpu_name', 'Unknown')}")
                print(f"GPU Memory: {status.get('gpu_memory_gb', 0):.1f} GB")
                print(f"NVENC Support: {'Yes' if status.get('ffmpeg_cuda_support') else 'No'}")
            else:
                print(f"Auto Mode: CPU Multi-threaded Processing")

            if is_multithreaded:
                print(f"\n[*] Multi-threading: ENABLED")
                print(f"    Worker Threads: {workers}")
                print(f"    Concurrent Tasks: Up to {workers} files simultaneously")
            else:
                print(f"\n[!] Multi-threading: DISABLED (single worker)")

            print(f"{'='*60}")

            # User confirmation for multi-threaded mode
            if is_multithreaded:
                print(f"\nThis will use {workers} parallel worker threads.")
                print("Press 'y' or Enter to continue, any other key to cancel...")
                choice = input("Continue? [Y/n]: ").strip().lower()

                if choice and choice not in ['y', 'yes', '']:
                    print("Operation cancelled by user")
                    return

                print(f"\n[OK] Starting multi-threaded batch processing with {workers} workers...\n")
        else:
            print(f"\n{'='*60}")
            print(f"Auto Mode: Fallback to One-by-One Processing")
            print(f"{'='*60}")

        # Step 1: Scan files
        files = self.scan_files()

        total_files = sum(len(f) for f in files.values())
        if total_files == 0:
            print("No files to process")
            return

        # Step 2: Collect all tasks (with skip logic)
        if not UNIFIED_COMPRESSOR_AVAILABLE:
            print("\nWarning: Unified compressor not available, falling back to one-by-one mode")
            return self.scan_and_compress_one_by_one()

        tasks = []
        skipped = 0

        print(f"\n{'='*60}")
        print("Collecting compression tasks...")
        print(f"{'='*60}\n")

        for file_type, file_list in files.items():
            for filepath in file_list:
                # Rename file if it contains spaces
                filepath = self._rename_file_spaces(filepath)

                rel_path = self._get_relative_path(filepath)
                file_key = str(rel_path)

                # Skip if already compressed
                if file_key in self.cache['files']:
                    cached_status = self.cache['files'][file_key].get('status')
                    if cached_status == 'compressed':
                        print(f"Skip compressed: {rel_path}")
                        skipped += 1
                        continue
                    elif cached_status == 'failed':
                        print(f"Skip failed: {rel_path}")
                        skipped += 1
                        continue

                # Skip duplicate
                if self._is_duplicate_media(filepath, file_type[:-1]):
                    print(f"Skip duplicate: {rel_path}")
                    skipped += 1
                    continue

                # Skip corrupted files
                ext = filepath.suffix.lower()
                if ext in (self.VIDEO_EXTENSIONS | self.AUDIO_EXTENSIONS):
                    if not self._verify_file(filepath):
                        print(f"Skip corrupted: {rel_path}")
                        skipped += 1
                        continue

                # Create task
                compress_path = self.COMPRESS_DIR / rel_path

                # Determine task type and options
                if file_type == 'images':
                    task_type = 'image'
                    options = {
                        'quality': self.IMAGE_QUALITY,
                        'use_gpu': True
                    }
                    # Check if resize needed
                    if Image:
                        try:
                            with Image.open(filepath) as img:
                                width, height = img.size
                                if max(width, height) > self.IMAGE_MAX_DIMENSION:
                                    if width > height:
                                        new_width = self.IMAGE_MAX_DIMENSION
                                        new_height = int(height * (self.IMAGE_MAX_DIMENSION / width))
                                    else:
                                        new_height = self.IMAGE_MAX_DIMENSION
                                        new_width = int(width * (self.IMAGE_MAX_DIMENSION / height))
                                    options['resize'] = (new_width, new_height)
                        except:
                            pass

                elif file_type == 'videos':
                    task_type = 'video'
                    # Get video dimensions
                    width, height = self._get_video_dimensions(filepath)
                    resolution = None
                    if height > self.VIDEO_MAX_DIMENSION and width > 0 and height > 0:
                        new_height = self.VIDEO_MAX_DIMENSION
                        new_width = int(width * (self.VIDEO_MAX_DIMENSION / height))
                        new_width = new_width - (new_width % 2)
                        new_height = new_height - (new_height % 2)
                        resolution = (new_width, new_height)

                    options = {
                        'codec': 'h264',
                        'preset': self.VIDEO_PRESET,
                        'crf': self.VIDEO_CRF,
                        'resolution': resolution,
                        'use_gpu': True
                    }

                else:  # audio - skip for now, handle separately
                    continue

                # Create task with callback
                def make_callback(rel_path_str, file_key_str):
                    def task_callback(task_id, success, stats):
                        if success and stats:
                            # Update cache
                            self.cache['files'][file_key_str] = {
                                'type': file_type[:-1],
                                'status': 'compressed',
                                'original_size': stats.original_size,
                                'compressed_size': stats.compressed_size,
                                'compression_ratio': stats.compression_ratio
                            }
                            self._save_cache()
                        else:
                            # Mark as failed
                            self.cache['files'][file_key_str] = {
                                'type': file_type[:-1],
                                'status': 'failed',
                                'error': 'Compression failed'
                            }
                            self._save_cache()
                    return task_callback

                task = CompressionTask(
                    task_id=str(rel_path),
                    input_path=filepath,
                    output_path=compress_path,
                    task_type=task_type,
                    options=options,
                    callback=make_callback(str(rel_path), file_key)
                )
                tasks.append(task)

        print(f"\nCollected {len(tasks)} tasks (skipped {skipped})")

        if len(tasks) == 0:
            print("No tasks to process")
            return

        # Step 3: Process batch using unified compressor
        if not self.unified_compressor:
            print("\nWarning: Unified compressor not available, falling back to one-by-one mode")
            return self.scan_and_compress_one_by_one()

        print(f"\nStarting batch processing with {self.unified_compressor.max_workers} worker threads...\n")

        # Define queue callback
        def queue_callback(queue_stats):
            total_time = queue_stats.end_time - queue_stats.start_time
            total_saved = queue_stats.total_original_size - queue_stats.total_compressed_size
            total_ratio = (total_saved / queue_stats.total_original_size * 100) if queue_stats.total_original_size > 0 else 0

            print(f"\n{'='*60}")
            print("FINAL SUMMARY")
            print(f"{'='*60}")
            print(f"Total files: {queue_stats.total_tasks}")
            print(f"Completed: {queue_stats.completed_tasks}")
            print(f"Failed: {queue_stats.failed_tasks}")
            print(f"Skipped: {skipped}")
            print(f"Processing time: {total_time:.1f}s")
            print(f"Total space saved: {self._format_size(total_saved)} ({total_ratio:.1f}%)")
            print(f"{'='*60}\n")

        # Define progress callback
        def progress_callback(completed, total):
            pct = (completed / total) * 100
            print(f"Overall Progress: {completed}/{total} ({pct:.1f}%)")

        # Execute batch processing
        queue_stats = self.unified_compressor.process_batch(
            tasks=tasks,
            queue_callback=queue_callback,
            progress_callback=progress_callback
        )

        print("\nBatch processing complete!")
        print(f"Success rate: {queue_stats.completed_tasks}/{queue_stats.total_tasks}")

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
