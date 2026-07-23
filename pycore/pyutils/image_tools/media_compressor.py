#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Media Compressor (facade)
Provides video and image compression functionality with GPU acceleration support

Features:
- Image compression (JPEG, PNG, WebP)
- Video compression (H.264, H.265/HEVC)
- Automatic CUDA detection and acceleration
- Graceful fallback to CPU when GPU unavailable
- Configurable quality and preset settings
- Multi-threaded batch processing with GPU load balancing
- Task-level and queue-level callbacks

Structure (split out of this file):
- media_compressor_models.py  : pure dataclasses (CompressionStats / Task / QueueStats)
- media_capability_detector.py: GPU + FFmpeg/nvenc detection, ENCYCLOPEDIA cache,
                                 optimal-worker calc (reuses compute_caps.CUDADetector)
- media_compressor.py (this)  : MediaCompressor facade - delegates capability
                                 detection, then does image/video compression +
                                 batch queue + task/queue stats.

The dataclasses are re-exported here so existing callers that import them from
media_compressor (and via pycore.pyutils) keep working unchanged.
"""

import time
import subprocess
import uuid
from pathlib import Path
from typing import Optional, Dict, Tuple, Union, List, Callable

from pycore.pyfoundations.third_party import get_third_package_cv2
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import start_bus_task

# Re-exported data contracts (kept importable from this module for backwards
# compatibility with callers that import them from media_compressor).
from pycore.pyutils.image_tools.media_compressor_models import (
    CompressionStats,
    CompressionTask,
    QueueStats,
)
# Capability detection (GPU + FFmpeg + cache + optimal workers) is delegated here.
from pycore.pyutils.image_tools.media_capability_detector import MediaCapabilityDetector

import traceback


cv2 = get_third_package_cv2()

__all__ = [
    "MediaCompressor",
    "get_media_compressor",
    "CompressionStats",
    "CompressionTask",
    "QueueStats",
]


class MediaCompressor:
    """
    Unified media compressor with GPU acceleration support

    Supports both image and video compression with automatic CUDA detection.
    Falls back to CPU processing when GPU is unavailable.

    Capability detection (GPU + FFmpeg/nvenc) is delegated to
    MediaCapabilityDetector, which owns the single ENCYCLOPEDIA capability cache.

    Example:
        compressor = MediaCompressor(verbose=True)

        # Compress image
        compressor.compress_image('input.jpg', 'output.jpg', quality=85)

        # Compress video
        compressor.compress_video('input.mp4', 'output.mp4',
                                 preset='medium', crf=23)
    """

    def __init__(self, verbose: bool = True, max_workers: Optional[int] = None):
        """
        Initialize media compressor

        Args:
            verbose: Whether to print detailed information
            max_workers: Maximum number of worker threads (auto-detect based on GPU if None)
        """
        self.verbose = verbose

        # Delegate GPU + FFmpeg capability detection (with ENCYCLOPEDIA cache) to
        # the detector. It owns the single capability cache; the facade only
        # mirrors the resulting capability attributes for its own use.
        self._capability_detector = MediaCapabilityDetector(verbose=verbose)
        self.cuda_available = self._capability_detector.cuda_available
        self.gpu_device_count = self._capability_detector.gpu_device_count
        self.gpu_name = self._capability_detector.gpu_name
        self.gpu_memory_gb = self._capability_detector.gpu_memory_gb
        self.ffmpeg_available = self._capability_detector.ffmpeg_available
        self.ffmpeg_cuda_support = self._capability_detector.ffmpeg_cuda_support

        # Thread pool configuration
        self.max_workers = max_workers or self._capability_detector.calculate_optimal_workers()
        self.queue_stats = QueueStats()

        self._print(f"Initialized with {self.max_workers} worker threads")

    def _print(self, *args, **kwargs):
        """Print if verbose mode enabled"""
        if self.verbose:
            print(*args, **kwargs)

    def compress_image(self,
                      input_path: Union[str, Path],
                      output_path: Union[str, Path],
                      quality: int = 85,
                      format: Optional[str] = None,
                      resize: Optional[Tuple[int, int]] = None,
                      use_gpu: bool = True) -> CompressionStats:
        """
        Compress an image file

        Args:
            input_path: Path to input image
            output_path: Path to save compressed image
            quality: Compression quality (0-100, higher is better)
            format: Output format ('jpg', 'png', 'webp', auto-detect if None)
            resize: Optional resize dimensions (width, height)
            use_gpu: Whether to use GPU acceleration if available

        Returns:
            CompressionStats object with compression statistics
        """
        start_time = time.time()

        input_path = Path(input_path)
        output_path = Path(output_path)

        # Validate input
        if not input_path.exists():
            ColorPrint.red(f"Input file not found: {input_path}")
            return CompressionStats()

        # Determine output format
        if format is None:
            format = output_path.suffix.lower().lstrip('.')

        # Read image
        img = cv2.imread(str(input_path))
        if img is None:
            ColorPrint.red(f"Failed to read image: {input_path}")
            return CompressionStats()

        original_size = input_path.stat().st_size
        used_gpu = False

        # Resize if requested
        if resize is not None:
            if use_gpu and self.cuda_available:
                try:
                    gpu_img = cv2.cuda_GpuMat()
                    gpu_img.upload(img)
                    gpu_resized = cv2.cuda.resize(gpu_img, resize, interpolation=cv2.INTER_AREA)
                    img = gpu_resized.download()
                    used_gpu = True
                    self._print(f"✅ GPU-accelerated resize to {resize}")
                except Exception as e:
                    ColorPrint.yellow(f"GPU resize failed, using CPU: {e}")
                    img = cv2.resize(img, resize, interpolation=cv2.INTER_AREA)
            else:
                img = cv2.resize(img, resize, interpolation=cv2.INTER_AREA)

        # Set compression parameters based on format
        if format in ['jpg', 'jpeg']:
            params = [cv2.IMWRITE_JPEG_QUALITY, quality]
        elif format == 'png':
            # PNG compression level (0-9, higher = more compression)
            png_compression = int((100 - quality) / 11)  # Map 0-100 to 9-0
            params = [cv2.IMWRITE_PNG_COMPRESSION, png_compression]
        elif format == 'webp':
            params = [cv2.IMWRITE_WEBP_QUALITY, quality]
        else:
            params = []

        # Write compressed image
        success = cv2.imwrite(str(output_path), img, params)

        if not success:
            ColorPrint.red(f"Failed to write compressed image: {output_path}")
            return CompressionStats()

        # Calculate statistics
        compressed_size = output_path.stat().st_size
        compression_ratio = ((original_size - compressed_size) / original_size) * 100
        processing_time = time.time() - start_time

        stats = CompressionStats(
            original_size=original_size,
            compressed_size=compressed_size,
            compression_ratio=compression_ratio,
            processing_time=processing_time,
            used_gpu=used_gpu
        )

        ColorPrint.green(
            f"✅ Image compressed: {original_size/1024:.1f}KB -> {compressed_size/1024:.1f}KB "
            f"({compression_ratio:.1f}% reduction) in {processing_time:.2f}s"
        )
        if used_gpu:
            ColorPrint.cyan("   [GPU-accelerated]")

        return stats

    def compress_video(self,
                      input_path: Union[str, Path],
                      output_path: Union[str, Path],
                      codec: str = 'h264',
                      preset: str = 'medium',
                      crf: int = 23,
                      resolution: Optional[Tuple[int, int]] = None,
                      use_gpu: bool = True) -> CompressionStats:
        """
        Compress a video file using FFmpeg

        Args:
            input_path: Path to input video
            output_path: Path to save compressed video
            codec: Video codec ('h264', 'h265', 'hevc')
            preset: Encoding preset ('ultrafast', 'fast', 'medium', 'slow', 'veryslow')
            crf: Constant Rate Factor (0-51, lower is better quality, 23 is default)
            resolution: Optional output resolution (width, height)
            use_gpu: Whether to use GPU hardware encoding if available

        Returns:
            CompressionStats object with compression statistics
        """
        start_time = time.time()

        input_path = Path(input_path)
        output_path = Path(output_path)

        # Validate input
        if not input_path.exists():
            ColorPrint.red(f"Input file not found: {input_path}")
            return CompressionStats()

        if not self.ffmpeg_available:
            ColorPrint.red("FFmpeg not available, cannot compress video")
            return CompressionStats()

        original_size = input_path.stat().st_size
        used_gpu = False

        # Determine encoder
        if use_gpu and self.ffmpeg_cuda_support:
            if codec in ['h264', 'avc']:
                encoder = 'h264_nvenc'
                used_gpu = True
            elif codec in ['h265', 'hevc']:
                encoder = 'hevc_nvenc'
                used_gpu = True
            else:
                encoder = 'libx264'
        else:
            if codec in ['h265', 'hevc']:
                encoder = 'libx265'
            else:
                encoder = 'libx264'

        # Build FFmpeg command
        cmd = [
            'ffmpeg',
            '-y',  # Overwrite output
            '-i', str(input_path),
            '-c:v', encoder,
        ]

        # Add encoder-specific options
        if 'nvenc' in encoder:
            cmd.extend([
                '-preset', preset,
                '-cq', str(crf),  # Use -cq for NVENC instead of -crf
                '-b:v', '0',  # Variable bitrate
            ])
        else:
            cmd.extend([
                '-preset', preset,
                '-crf', str(crf),
            ])

        # Add resolution scaling if requested
        if resolution is not None:
            width, height = resolution
            if 'nvenc' in encoder:
                # Use GPU scaling for hardware encoding
                cmd.extend(['-vf', f'scale_cuda={width}:{height}'])
            else:
                cmd.extend(['-vf', f'scale={width}:{height}'])

        # Copy audio stream
        cmd.extend(['-c:a', 'copy'])

        # Output file
        cmd.append(str(output_path))

        # Execute FFmpeg with real-time output
        try:
            self._print(f"Running FFmpeg command: {' '.join(cmd)}")

            # Use Popen for real-time output
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )

            # Stream output in real-time
            for line in process.stdout:
                if self.verbose:
                    # Print FFmpeg progress output
                    line = line.strip()
                    if line and ('frame=' in line or 'time=' in line or 'speed=' in line):
                        print(f"  {line}", end='\r')

            # Wait for process to complete
            process.wait()

            if self.verbose:
                print()  # New line after progress

            if process.return_code != 0:
                ColorPrint.red(f"FFmpeg process failed with code {process.return_code}")
                return CompressionStats()

        except subprocess.TimeoutExpired:
            ColorPrint.red("FFmpeg timeout (> 1 hour)")
            try:
                process.kill()
            except:
                pass
            return CompressionStats()
        except Exception as e:
            ColorPrint.red(f"FFmpeg execution failed: {e}")
            return CompressionStats()

        # Verify output file exists and has valid size
        if not output_path.exists():
            ColorPrint.red(f"Output file not created: {output_path}")
            return CompressionStats()

        compressed_size = output_path.stat().st_size

        # Check if output file is valid (not empty or corrupted)
        if compressed_size == 0:
            ColorPrint.red(f"Output file is empty (0 KB): {output_path}")
            return CompressionStats()

        # Additional validation: file should be at least 1KB for valid video
        if compressed_size < 1024:
            ColorPrint.yellow(f"Warning: Output file is very small ({compressed_size} bytes): {output_path}")
            # Don't fail completely, but flag as suspicious
        compression_ratio = ((original_size - compressed_size) / original_size) * 100
        processing_time = time.time() - start_time

        stats = CompressionStats(
            original_size=original_size,
            compressed_size=compressed_size,
            compression_ratio=compression_ratio,
            processing_time=processing_time,
            used_gpu=used_gpu
        )

        ColorPrint.green(
            f"✅ Video compressed: {original_size/(1024*1024):.1f}MB -> {compressed_size/(1024*1024):.1f}MB "
            f"({compression_ratio:.1f}% reduction) in {processing_time:.1f}s"
        )
        if used_gpu:
            ColorPrint.cyan(f"   [GPU-accelerated with {encoder}]")

        return stats

    def get_status_info(self) -> Dict:
        """
        Get compressor status information

        Returns:
            Dictionary with status information
        """
        return {
            'cuda_available': self.cuda_available,
            'gpu_device_count': self.gpu_device_count,
            'gpu_name': self.gpu_name,
            'gpu_memory_gb': self.gpu_memory_gb,
            'ffmpeg_available': self.ffmpeg_available,
            'ffmpeg_cuda_support': self.ffmpeg_cuda_support,
            'max_workers': self.max_workers
        }

    def _process_task(self, task: CompressionTask) -> Tuple[bool, Optional[CompressionStats]]:
        """
        Process a single compression task with robust error handling

        Args:
            task: Compression task to process

        Returns:
            Tuple of (success, stats)
        """
        stats = None
        success = False

        try:
            # Validate input file exists
            if not task.input_path.exists():
                ColorPrint.red(f"Input file not found: {task.input_path}")
                raise FileNotFoundError(f"Input file not found: {task.input_path}")

            # Ensure output directory exists
            task.output_path.parent.mkdir(parents=True, exist_ok=True)

            # Process based on task type
            if task.task_type == 'image':
                stats = self.compress_image(
                    task.input_path,
                    task.output_path,
                    **task.options
                )
                success = stats.compressed_size > 0
            elif task.task_type == 'video':
                stats = self.compress_video(
                    task.input_path,
                    task.output_path,
                    **task.options
                )
                success = stats.compressed_size > 0
            else:
                ColorPrint.red(f"Unknown task type: {task.task_type}")
                raise ValueError(f"Unknown task type: {task.task_type}")

            # Double-check output file validity
            if success and task.output_path.exists():
                output_size = task.output_path.stat().st_size
                if output_size == 0:
                    ColorPrint.red(f"Output file is 0 KB: {task.output_path}")
                    success = False
                    stats.compressed_size = 0

            # Call task-level callback if provided
            if task.callback:
                try:
                    task.callback(task.task_id, success, stats)
                except Exception as e:
                    ColorPrint.yellow(f"Task callback error for {task.task_id}: {e}")

            return success, stats

        except KeyboardInterrupt:
            # Allow graceful shutdown on Ctrl+C
            ColorPrint.yellow(f"Task {task.task_id} interrupted by user")
            raise  # Re-raise to stop the thread pool

        except Exception as e:
            # Catch all other exceptions
            ColorPrint.red(f"Task processing error for {task.task_id}: {e}")
            if self.verbose:
                traceback.print_exc()

            # Call callback with failure status
            if task.callback:
                try:
                    task.callback(task.task_id, False, None)
                except Exception as cb_error:
                    ColorPrint.yellow(f"Callback error during failure handling: {cb_error}")

            return False, None

        finally:
            # Cleanup: remove partial output file if task failed
            if not success and task.output_path.exists():
                try:
                    if task.output_path.stat().st_size == 0:
                        task.output_path.unlink()
                        if self.verbose:
                            ColorPrint.yellow(f"Removed empty output file: {task.output_path}")
                except Exception as cleanup_error:
                    ColorPrint.yellow(f"Cleanup error: {cleanup_error}")

    def _process_task_lane(
        self,
        tasks: List[CompressionTask],
    ) -> List[Tuple[CompressionTask, bool, Optional[CompressionStats]]]:
        """Process one bus-delivered task lane without sharing mutable state."""
        results = []
        for task in tasks:
            success, stats = self._process_task(task)
            results.append((task, success, stats))
        return results

    def process_batch(self,
                     tasks: List[CompressionTask],
                     queue_callback: Optional[Callable[[QueueStats], None]] = None,
                     progress_callback: Optional[Callable[[int, int], None]] = None) -> QueueStats:
        """
        Process multiple compression tasks in parallel using thread pool

        Args:
            tasks: List of compression tasks to process
            queue_callback: Callback for queue completion (receives final QueueStats)
            progress_callback: Callback for progress updates (receives completed, total)

        Returns:
            QueueStats with final statistics

        Example:
            def task_done(task_id, success, stats):
                print(f"Task {task_id}: {'OK' if success else 'FAIL'}")

            def queue_done(queue_stats):
                print(f"Queue complete: {queue_stats.completed_tasks}/{queue_stats.total_tasks}")

            def progress(completed, total):
                print(f"Progress: {completed}/{total}")

            tasks = [
                CompressionTask('task1', 'img1.jpg', 'out1.jpg', 'image',
                               {'quality': 85}, task_done),
                CompressionTask('task2', 'video1.mp4', 'out1.mp4', 'video',
                               {'crf': 23}, task_done),
            ]

            stats = compressor.process_batch(tasks, queue_done, progress)
        """
        # Keep batch statistics local to the caller. Worker results cross THREAD_BUS.
        final_stats = QueueStats(
            total_tasks=len(tasks),
            start_time=time.time()
        )

        ColorPrint.cyan(f"\n{'='*80}")
        ColorPrint.cyan(f"Starting batch processing: {len(tasks)} tasks with {self.max_workers} workers")
        ColorPrint.cyan(f"{'='*80}\n")

        completed_count = 0
        interrupted = False

        # Process fixed bus-delivered lanes with named Thread subclasses.
        try:
            lane_count = min(max(1, self.max_workers), max(1, len(tasks)))
            lanes = [tasks[index::lane_count] for index in range(lane_count)]
            lane_signals = []
            for lane_index, lane_tasks in enumerate(lanes):
                response_signal = f"media_compressor.lane.{uuid.uuid4().hex}"
                lane_signals.append((response_signal, lane_tasks))
                start_bus_task(
                    self._process_task_lane,
                    lane_tasks,
                    thread_name=f"MediaCompressor-{lane_index + 1}",
                    response_signal=response_signal,
                )

            for response_signal, lane_tasks in lane_signals:
                lane_timeout = 3600 * max(1, len(lane_tasks))
                response = THREAD_BUS.wait_signal(response_signal, timeout=lane_timeout)
                THREAD_BUS.clear_signal(response_signal)
                if not isinstance(response, dict) or not response.get("success"):
                    error = response.get("error", "worker timed out") if isinstance(response, dict) else "worker timed out"
                    ColorPrint.red(f"Compression lane error: {error}")
                    final_stats.failed_tasks += len(lane_tasks)
                    completed_count += len(lane_tasks)
                    continue

                for task, success, stats in response.get("result", []):
                    try:
                        completed_count += 1
                        if success and stats is not None:
                            final_stats.completed_tasks += 1
                            final_stats.total_original_size += stats.original_size
                            final_stats.total_compressed_size += stats.compressed_size
                        else:
                            final_stats.failed_tasks += 1

                        # Progress callback
                        if progress_callback:
                            try:
                                progress_callback(completed_count, len(tasks))
                            except Exception as e:
                                ColorPrint.yellow(f"Progress callback error: {e}")

                        # Print progress
                        progress_pct = (completed_count / len(tasks)) * 100
                        status_icon = "✓" if success else "✗"
                        ColorPrint.green(f"[{completed_count}/{len(tasks)}] {status_icon} {task.task_id} ({progress_pct:.1f}%)")

                    except KeyboardInterrupt:
                        ColorPrint.yellow("\n⚠️  Batch processing interrupted by user")
                        interrupted = True
                        break

                    except Exception as e:
                        ColorPrint.red(f"Worker result error for {task.task_id}: {e}")
                        completed_count += 1
                        # Continue processing other tasks

                if interrupted:
                    break

        except KeyboardInterrupt:
            ColorPrint.yellow("\n⚠️  Batch processing interrupted during setup")
            interrupted = True

        # Publish the final immutable batch snapshot for compatibility.
        final_stats.end_time = time.time()
        self.queue_stats = final_stats

        # Calculate summary
        total_time = final_stats.end_time - final_stats.start_time
        if final_stats.total_original_size > 0:
            total_ratio = (1 - final_stats.total_compressed_size / final_stats.total_original_size) * 100
        else:
            total_ratio = 0.0

        # Print summary
        ColorPrint.cyan(f"\n{'='*80}")
        if interrupted:
            ColorPrint.yellow("BATCH PROCESSING INTERRUPTED")
        else:
            ColorPrint.cyan("BATCH PROCESSING COMPLETE")
        ColorPrint.cyan(f"{'='*80}")
        ColorPrint.green(f"Total tasks: {final_stats.total_tasks}")
        ColorPrint.green(f"Completed: {final_stats.completed_tasks}")
        if final_stats.failed_tasks > 0:
            ColorPrint.red(f"Failed: {final_stats.failed_tasks}")
        if interrupted:
            skipped = final_stats.total_tasks - final_stats.completed_tasks - final_stats.failed_tasks
            if skipped > 0:
                ColorPrint.yellow(f"Skipped: {skipped} (due to interruption)")
        ColorPrint.green(f"Total time: {total_time:.2f}s")
        if final_stats.total_original_size > 0:
            ColorPrint.green(f"Original size: {self._format_size(final_stats.total_original_size)}")
            ColorPrint.green(f"Compressed size: {self._format_size(final_stats.total_compressed_size)}")
            ColorPrint.green(f"Space saved: {total_ratio:.1f}%")
        ColorPrint.cyan(f"{'='*80}\n")

        # Queue callback
        if queue_callback:
            try:
                queue_callback(final_stats)
            except Exception as e:
                ColorPrint.yellow(f"Queue callback error: {e}")

        return final_stats

    def _format_size(self, size_bytes: int) -> str:
        """Format file size for display"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f}TB"


# Singleton instance
_media_compressor: Optional[MediaCompressor] = None


def get_media_compressor(verbose: bool = False) -> MediaCompressor:
    """
    Get or create the global media compressor instance

    Args:
        verbose: Whether to print information

    Returns:
        MediaCompressor instance
    """
    global _media_compressor
    if _media_compressor is None:
        _media_compressor = MediaCompressor(verbose=verbose)
    return _media_compressor


if __name__ == "__main__":
    # Test media compressor
    import sys

    compressor = MediaCompressor(verbose=True)

    # Print status
    print("\n" + "=" * 80)
    print("MEDIA COMPRESSOR STATUS")
    print("=" * 80)
    status = compressor.get_status_info()
    for key, value in status.items():
        print(f"{key}: {value}")
    print("=" * 80)

    # Example usage (uncomment to test with actual files)
    # if len(sys.argv) > 2:
    #     input_file = sys.argv[1]
    #     output_file = sys.argv[2]
    #
    #     if input_file.endswith(('.jpg', '.jpeg', '.png', '.webp')):
    #         stats = compressor.compress_image(input_file, output_file, quality=85)
    #     elif input_file.endswith(('.mp4', '.avi', '.mov', '.mkv')):
    #         stats = compressor.compress_video(input_file, output_file, preset='medium', crf=23)
    #     else:
    #         print("Unsupported file format")
