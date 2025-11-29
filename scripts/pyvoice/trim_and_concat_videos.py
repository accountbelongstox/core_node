#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Video Batch Processing Tool - Trim and Concatenate Videos (v2.2)

Features:
- 🚀 CUDA/NVENC hardware acceleration (NVIDIA GPU 3-5x speed boost)
- 🌍 Auto-translate filenames to English (Google Translate + cache)
- 🧹 Sanitize filenames (replace spaces with underscores, remove special chars)
- ✂️ Trim video start and end
- 📦 Batch process all videos in directory
- 🔗 Auto-merge into single video file
- 🕐 Generate timestamped filenames
- 🔧 Auto-handle path escaping and special characters
- 🎵 Fix audio-video sync issues
- ⏭️ Skip files containing specific keywords
- 📝 Detailed error logging
- 📊 Real-time FFmpeg progress display

Usage:
    # Basic usage
    python trim_and_concat_videos.py <video_directory>

    # Windows path examples (all formats supported)
    python trim_and_concat_videos.py "D:\videos"
    python trim_and_concat_videos.py D:\videos
    python trim_and_concat_videos.py D:\\videos

    # Skip files containing "writing" keyword (default enabled)
    python trim_and_concat_videos.py ./videos --skip-keywords writing

    # Skip multiple keywords
    python trim_and_concat_videos.py ./videos --skip-keywords writing test

    # Custom trim times
    python trim_and_concat_videos.py ./videos --trim-start 5 --trim-end 4

    # Specify output directory
    python trim_and_concat_videos.py ./videos --output ./output

Audio-Video Sync Fix:
    Script uses automatic fallback mechanism to ensure video compatibility:
    1. First try fast stream copy
    2. If failed, auto-use re-encoding
    3. Re-encoding uses H.264 + AAC to ensure playback on all players

    Re-encoding parameters:
    - Video: H.264, CRF 23 (high quality)
    - Audio: AAC, 192kbps
    - Optimization: faststart (streaming optimization)
"""

import os
import sys
import subprocess
import tempfile
import argparse
import asyncio
import re
import shutil
from pathlib import Path
from datetime import datetime

# Add project root to path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from pycore.pyutils.translator import GoogleTranslator


async def translate_filename(filename: str, src_lang: str = 'zh-CN', verbose: bool = True, retry_count: int = 2) -> str:
    """
    Translate filename to English using GoogleTranslator

    Args:
        filename: Original filename (without extension)
        src_lang: Source language code (default: 'zh-CN' for Chinese)
        verbose: Print detailed debug info
        retry_count: Number of retries on failure

    Returns:
        Translated filename
    """
    for attempt in range(retry_count + 1):
        try:
            if attempt > 0:
                print(f"    [RETRY] Attempt {attempt + 1}/{retry_count + 1}")
                # Wait a bit before retry
                await asyncio.sleep(1)

            async with GoogleTranslator() as translator:
                if verbose and attempt == 0:
                    print(f"    [INFO] Translating: '{filename}'")
                    print(f"    [INFO] Text length: {len(filename)} chars")
                    print(f"    [INFO] Source language: {src_lang} (forced)")

                result = await translator.translate_single(
                    text=filename,
                    src=src_lang,  # Use specified source language instead of 'auto'
                    dest='en',
                    use_cache=True
                )

                if verbose:
                    print(f"    [DEBUG] Translation Details:")
                    print(f"      - Original text: {result.original_text}")
                    print(f"      - Translated text: {result.translated_text}")
                    print(f"      - Detected source lang: {result.src_lang}")
                    print(f"      - Target lang: {result.dest_lang}")
                    print(f"      - From cache: {result.from_cache}")
                    if result.pronunciation:
                        print(f"      - Pronunciation: {result.pronunciation}")

                if result.error:
                    print(f"    [WARNING] Translation API returned error: {result.error}")
                    if attempt < retry_count:
                        continue  # Retry
                    print(f"    [INFO] Using original name after {retry_count + 1} attempts")
                    return filename

                # Success
                if verbose:
                    print(f"    [SUCCESS] Translation completed")
                return result.translated_text

        except Exception as e:
            print(f"    [ERROR] Translation exception (attempt {attempt + 1}/{retry_count + 1}):")
            print(f"      Type: {type(e).__name__}")
            print(f"      Message: {e}")

            if verbose:
                import traceback
                print(f"    [DEBUG] Full traceback:")
                traceback.print_exc()

            if attempt < retry_count:
                print(f"    [INFO] Retrying...")
                continue
            else:
                print(f"    [INFO] Using original name after {retry_count + 1} failed attempts")
                return filename

    # Should not reach here, but just in case
    return filename


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename: remove special characters and replace spaces with underscores

    Args:
        filename: Filename to sanitize

    Returns:
        Sanitized filename
    """
    # Replace spaces with underscores
    filename = filename.replace(' ', '_')

    # Remove or replace special characters (keep only alphanumeric, underscore, hyphen, dot)
    filename = re.sub(r'[^\w\-\.]', '_', filename)

    # Replace multiple underscores with single underscore
    filename = re.sub(r'_+', '_', filename)

    # Remove leading/trailing underscores
    filename = filename.strip('_')

    return filename


def normalize_path(path_str: str) -> Path:
    """
    Normalize path, auto-handle escaping and special characters

    Args:
        path_str: Original path string

    Returns:
        Normalized Path object
    """
    # Remove quotes from both ends
    path_str = path_str.strip('\'"')

    # Convert to Path object, auto-handle escaping
    path = Path(path_str)

    # Resolve to absolute path
    path = path.resolve()

    return path


class VideoProcessor:
    """Video processor for batch trimming and concatenating videos"""

    # Supported video formats
    SUPPORTED_FORMATS = {'.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v'}

    def __init__(self, trim_start: float = 5.0, trim_end: float = 4.0, skip_keywords: list = None, verbose: bool = True, src_lang: str = 'zh-CN'):
        """
        Initialize video processor

        Args:
            trim_start: Seconds to trim from start (default: 5.0)
            trim_end: Seconds to trim from end (default: 4.0)
            skip_keywords: Skip files containing these keywords (default: None)
            verbose: Enable detailed debug output (default: True)
            src_lang: Source language code for translation (default: 'zh-CN')
        """
        self.trim_start = trim_start
        self.trim_end = trim_end
        self.skip_keywords = skip_keywords or []
        self.verbose = verbose
        self.src_lang = src_lang

        # Auto-detect CUDA support (enabled by default)
        self.cuda_available = self.check_cuda_support()

    def check_ffmpeg(self) -> bool:
        """Check if FFmpeg is installed"""
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def check_cuda_support(self) -> bool:
        """
        Check if FFmpeg supports NVIDIA CUDA/NVENC hardware acceleration

        Returns:
            True if CUDA is supported, False otherwise
        """
        try:
            # Check if FFmpeg encoder list contains h264_nvenc
            result = subprocess.run(
                ['ffmpeg', '-encoders'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                output = result.stdout
                has_nvenc = 'h264_nvenc' in output

                if has_nvenc:
                    print("✅ CUDA/NVENC hardware acceleration detected")
                    print("   Encoder: h264_nvenc (NVIDIA GPU)")
                    return True
                else:
                    print("⚠️  CUDA/NVENC not available")
                    print("   FFmpeg was not compiled with NVENC support")
                    print("   Falling back to CPU encoding (libx264)")
                    return False
            else:
                print("⚠️  Could not detect CUDA support")
                print("   Falling back to CPU encoding")
                return False

        except Exception as e:
            print(f"⚠️  Error checking CUDA support: {e}")
            print("   Falling back to CPU encoding")
            return False

    def find_videos(self, directory: Path) -> list:
        """
        Find all video files in directory

        Args:
            directory: Video directory path

        Returns:
            Sorted list of video file paths (filtered by skip keywords)
        """
        videos = []
        skipped = []

        for file_path in directory.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in self.SUPPORTED_FORMATS:
                # Check if contains skip keywords
                should_skip = False
                for keyword in self.skip_keywords:
                    if keyword.lower() in file_path.name.lower():
                        should_skip = True
                        skipped.append((file_path, keyword))
                        break

                if not should_skip:
                    videos.append(file_path)

        # Display skipped files
        if skipped:
            print(f"\n⏭️  Skipped {len(skipped)} files containing keywords:")
            for file_path, keyword in skipped:
                print(f"   - {file_path.name} (keyword: {keyword})")
            print()

        # Sort by filename
        videos.sort()
        return videos

    async def prepare_videos_with_translation(self, videos: list, temp_dir: Path) -> list:
        """
        Prepare videos: translate filenames to English and copy to temp directory

        Args:
            videos: List of original video file paths
            temp_dir: Temporary directory to store renamed videos

        Returns:
            List of renamed video file paths
        """
        print("\n" + "=" * 70)
        print("STEP 1: Translating and sanitizing filenames")
        print("=" * 70)

        renamed_videos = []

        for i, video_path in enumerate(videos, 1):
            stem = video_path.stem  # filename without extension
            suffix = video_path.suffix  # file extension

            print(f"\n[{i}/{len(videos)}] Processing: {video_path.name}")
            print(f"  - Original filename: {stem}")

            # Step 1: Translate filename to English
            print(f"  - Translating to English (from {self.src_lang})...")
            translated_name = await translate_filename(stem, src_lang=self.src_lang, verbose=self.verbose)

            if not self.verbose:
                # Only show summary if verbose is off
                print(f"    Translated: {translated_name}")

            # Step 2: Sanitize filename (remove special chars, replace spaces)
            sanitized_name = sanitize_filename(translated_name)
            if sanitized_name != translated_name:
                print(f"  - Sanitized: {sanitized_name}")
            else:
                print(f"  - Sanitization: No changes needed")

            # Step 3: Generate new filename
            new_filename = f"{sanitized_name}{suffix}"
            new_path = temp_dir / new_filename

            # Handle filename conflicts
            counter = 1
            while new_path.exists():
                new_filename = f"{sanitized_name}_{counter}{suffix}"
                new_path = temp_dir / new_filename
                counter += 1

            # Step 4: Copy file to temp directory with new name
            print(f"  - Copying to: {new_filename}")
            try:
                shutil.copy2(video_path, new_path)
                renamed_videos.append(new_path)
                print(f"  ✓ Success")
            except Exception as e:
                print(f"  ✗ Failed to copy: {e}")
                print(f"    Using original file instead")
                renamed_videos.append(video_path)

        print("\n" + "=" * 70)
        print(f"Filename translation completed: {len(renamed_videos)}/{len(videos)} files")
        print("=" * 70)

        return renamed_videos

    def get_video_duration(self, video_path: Path) -> float:
        """
        Get video duration

        Args:
            video_path: Video file path

        Returns:
            Video duration in seconds
        """
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(video_path)
        ]

        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return float(result.stdout.strip())
            else:
                print(f"Warning: Cannot get video duration {video_path.name}")
                return 0.0
        except Exception as e:
            print(f"Error: Failed to get video duration - {e}")
            return 0.0

    def trim_video(self, input_path: Path, output_path: Path, use_reencode: bool = False) -> bool:
        """
        Trim video (remove start and end portions)
        Uses re-encoding to ensure compatibility and audio-video sync

        Args:
            input_path: Input video path
            output_path: Output video path
            use_reencode: Use re-encoding (default False, auto-retry on stream copy failure)

        Returns:
            True if successful, False otherwise
        """
        # Get video duration
        duration = self.get_video_duration(input_path)

        if duration <= 0:
            print(f"Skip: {input_path.name} (cannot get duration)")
            return False

        # Calculate trimmed duration
        trimmed_duration = duration - self.trim_start - self.trim_end

        if trimmed_duration <= 0:
            print(f"Skip: {input_path.name} (too short after trimming)")
            return False

        # Try two methods: stream copy first, then re-encode on failure
        if not use_reencode:
            # Method 1: Stream copy (fast but may have compatibility issues)
            cmd = [
                'ffmpeg',
                '-ss', str(self.trim_start),   # Before -i for faster seek
                '-i', str(input_path),
                '-t', str(trimmed_duration),
                '-c', 'copy',                  # Stream copy
                '-avoid_negative_ts', '1',     # Fix timestamps
                '-y',
                str(output_path)
            ]

            try:
                print(f"Processing (fast): {input_path.name} ({duration:.1f}s → {trimmed_duration:.1f}s)")
                result = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=300
                )

                if result.returncode == 0:
                    print(f"Done: {output_path.name}")
                    return True
                else:
                    print(f"Fast mode failed, retrying with re-encoding...")
                    # Remove failed output file
                    if output_path.exists():
                        output_path.unlink()
                    # Recursive call with re-encoding
                    return self.trim_video(input_path, output_path, use_reencode=True)

            except subprocess.TimeoutExpired:
                print(f"Timeout: {input_path.name}")
                return False
            except Exception as e:
                print(f"Error: {input_path.name} - {e}")
                return False
        else:
            # Method 2: Re-encoding (slow but reliable)
            # Choose encoding parameters based on CUDA availability
            if self.cuda_available:
                # CUDA/NVENC hardware accelerated encoding
                cmd = [
                    'ffmpeg',
                    '-ss', str(self.trim_start),
                    '-i', str(input_path),
                    '-t', str(trimmed_duration),
                    '-c:v', 'h264_nvenc',          # NVIDIA H.264 hardware encoder
                    '-preset', 'p4',               # NVENC preset (p1-p7, p4=medium)
                    '-rc', 'vbr',                  # Rate control mode: variable bitrate
                    '-cq', '23',                   # Constant quality (like CRF, 18-28)
                    '-b:v', '0',                   # Set to 0 for VBR mode
                    '-c:a', 'aac',                 # AAC audio encoding
                    '-b:a', '192k',                # Audio bitrate
                    '-movflags', '+faststart',     # Optimize for streaming
                    '-progress', 'pipe:1',         # Output progress to stdout
                    '-y',
                    str(output_path)
                ]
                encode_mode = "CUDA/NVENC (GPU)"
            else:
                # CPU software encoding (libx264)
                cmd = [
                    'ffmpeg',
                    '-ss', str(self.trim_start),
                    '-i', str(input_path),
                    '-t', str(trimmed_duration),
                    '-c:v', 'libx264',             # H.264 CPU encoding
                    '-preset', 'medium',           # Encoding speed
                    '-crf', '23',                  # Quality (18-28, lower = better)
                    '-c:a', 'aac',                 # AAC audio encoding
                    '-b:a', '192k',                # Audio bitrate
                    '-movflags', '+faststart',     # Optimize for streaming
                    '-progress', 'pipe:1',         # Output progress to stdout
                    '-y',
                    str(output_path)
                ]
                encode_mode = "CPU (libx264)"

            try:
                print(f"Processing (re-encode): {input_path.name} ({duration:.1f}s → {trimmed_duration:.1f}s)")
                print(f"Encoder: {encode_mode}")
                print(f"FFmpeg command: {' '.join(cmd)}")
                print(f"[FFmpeg Output Start] " + "=" * 50)

                # Real-time FFmpeg output
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,  # Merge stderr to stdout
                    universal_newlines=True,
                    bufsize=1
                )

                # Read and display output in real-time
                for line in process.stdout:
                    print(line.rstrip())

                # Wait for process to finish
                process.wait(timeout=600)

                print(f"[FFmpeg Output End] " + "=" * 50)

                if process.returncode == 0:
                    print(f"✅ Done (re-encoded): {output_path.name}")
                    return True
                else:
                    print(f"❌ Failed: {input_path.name} (return code: {process.returncode})")
                    return False

            except subprocess.TimeoutExpired:
                print(f"❌ Timeout: {input_path.name}")
                process.kill()
                return False
            except Exception as e:
                print(f"❌ Error: {input_path.name} - {e}")
                import traceback
                traceback.print_exc()
                return False

    def concat_videos(self, video_paths: list, output_path: Path) -> bool:
        """
        Concatenate multiple videos into one
        Using re-encoding for maximum compatibility

        Args:
            video_paths: List of video file paths
            output_path: Output video path

        Returns:
            bool: Success status
        """
        if not video_paths:
            print("Error: No videos to concatenate")
            return False

        # Create FFmpeg concat file list with proper escaping
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8') as f:
            concat_file = Path(f.name)
            for video_path in video_paths:
                abs_path = str(video_path.absolute()).replace('\\', '/')
                # Properly escape single quotes by replacing ' with '\''
                escaped_path = abs_path.replace("'", "'\\''")
                f.write(f"file '{escaped_path}'\n")

        print(f"\n[DEBUG] Concat file created at: {concat_file}")
        print(f"[DEBUG] Concat file contains {len(video_paths)} video paths")

        try:
            # FFmpeg concat command - using re-encoding for compatibility
            # Choose encoding parameters based on CUDA availability
            if self.cuda_available:
                # CUDA/NVENC hardware accelerated encoding
                cmd = [
                    'ffmpeg',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', str(concat_file),
                    '-c:v', 'h264_nvenc',          # NVIDIA H.264 hardware encoder
                    '-preset', 'p4',               # NVENC preset (p1-p7, p4=medium)
                    '-rc', 'vbr',                  # Rate control mode: variable bitrate
                    '-cq', '23',                   # Constant quality (like CRF)
                    '-b:v', '0',                   # Set to 0 for VBR mode
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-movflags', '+faststart',
                    '-progress', 'pipe:1',         # Output progress to stdout
                    '-y',
                    str(output_path)
                ]
                encode_mode = "CUDA/NVENC (GPU)"
            else:
                # CPU software encoding (libx264)
                cmd = [
                    'ffmpeg',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', str(concat_file),
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-movflags', '+faststart',
                    '-progress', 'pipe:1',  # Output progress to stdout
                    '-y',
                    str(output_path)
                ]
                encode_mode = "CPU (libx264)"

            print(f"\n🔗 Concatenating {len(video_paths)} videos (with re-encoding)...")
            print(f"🚀 Encoder: {encode_mode}")
            print("📝 Note: Re-encoding ensures compatibility and fixes sync issues")
            print("⏱️  This may take a long time depending on video count and size...")
            print(f"FFmpeg command: {' '.join(cmd)}")
            print(f"[FFmpeg Concat Output Start] " + "=" * 50)

            timeout = 7200  # 120 minutes (2 hours)

            # Real-time FFmpeg output
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,  # Merge stderr to stdout
                universal_newlines=True,
                bufsize=1
            )

            # Read and display output in real-time
            for line in process.stdout:
                print(line.rstrip())

            # Wait for process to finish
            process.wait(timeout=timeout)

            print(f"[FFmpeg Concat Output End] " + "=" * 50)

            if process.returncode == 0:
                print(f"✅ Concatenation completed: {output_path.name}")
                return True
            else:
                print(f"\n" + "=" * 70)
                print("❌ ERROR: Concatenation failed!")
                print("=" * 70)
                print(f"Return code: {process.returncode}")
                print("=" * 70)

                # Save error log to file
                error_log_path = output_path.parent / f"concat_error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
                try:
                    with open(error_log_path, 'w', encoding='utf-8') as log_file:
                        log_file.write("FFmpeg Concatenation Error Log\n")
                        log_file.write("=" * 70 + "\n\n")
                        log_file.write(f"Command: {' '.join(cmd)}\n\n")
                        log_file.write(f"Return code: {process.returncode}\n\n")
                        log_file.write("\n\nConcat file content:\n")
                        with open(concat_file, 'r', encoding='utf-8') as cf:
                            log_file.write(cf.read())
                    print(f"\n📄 Error log saved to: {error_log_path}")
                except Exception as e:
                    print(f"⚠️  Warning: Could not save error log: {e}")

                return False

        except subprocess.TimeoutExpired:
            print(f"❌ Concatenation timeout (exceeded {timeout//60} minutes)")
            print(f"💡 Suggestion: Too many videos or videos too large")
            print(f"💡 Consider processing in smaller batches")
            process.kill()
            return False
        except Exception as e:
            print(f"❌ Concatenation error: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            # Clean up temp file
            if concat_file.exists():
                concat_file.unlink()

    async def process_directory(self, directory: Path, output_dir: Path = None) -> Path:
        """
        Process all videos in directory (async version with translation)

        Args:
            directory: Input video directory
            output_dir: Output directory (default: same as input)

        Returns:
            Path to final output video, or None if failed
        """
        if output_dir is None:
            output_dir = directory

        # Find all videos
        videos = self.find_videos(directory)

        if not videos:
            print(f"Error: No supported video files found in {directory}")
            print(f"Supported formats: {', '.join(self.SUPPORTED_FORMATS)}")
            return None

        print(f"\nFound {len(videos)} video files:")
        for i, video in enumerate(videos, 1):
            print(f"  {i}. {video.name}")

        # Create temp directory for renamed and trimmed videos
        temp_dir = output_dir / f"temp_processing_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        temp_dir.mkdir(exist_ok=True)

        print(f"\nTemp directory: {temp_dir}")

        # STEP 1: Translate and sanitize filenames
        renamed_videos = await self.prepare_videos_with_translation(videos, temp_dir)

        if not renamed_videos:
            print("\nError: No videos were successfully renamed")
            temp_dir.rmdir()
            return None

        # STEP 2: Trim all videos
        print("\n" + "=" * 70)
        print("STEP 2: Trimming videos")
        print("=" * 70)
        print(f"Trim settings: Remove {self.trim_start}s from start, {self.trim_end}s from end\n")

        trimmed_dir = temp_dir / "trimmed"
        trimmed_dir.mkdir(exist_ok=True)

        trimmed_videos = []
        for video in renamed_videos:
            # Keep the renamed filename
            output_name = video.name
            output_path = trimmed_dir / output_name

            if self.trim_video(video, output_path, use_reencode=True):  # Force re-encoding
                trimmed_videos.append(output_path)

        if not trimmed_videos:
            print("\nError: No videos were successfully trimmed")
            return None

        print("\n" + "=" * 70)
        print(f"Successfully trimmed {len(trimmed_videos)}/{len(renamed_videos)} videos")
        print("=" * 70)

        # STEP 3: Concatenate videos
        print("\n" + "=" * 70)
        print("STEP 3: Concatenating videos")
        print("=" * 70)

        # Generate timestamp filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"concatenated_{timestamp}.mp4"
        output_path = output_dir / output_filename

        # Concatenate videos
        success = self.concat_videos(trimmed_videos, output_path)

        # Do NOT clean up temp files - keep them for review
        print(f"\nTemp files preserved in: {temp_dir}")
        print("You can review individual renamed and trimmed videos before deleting")

        if success:
            return output_path
        else:
            return None


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description='Video Batch Processing Tool - Trim and Concatenate Videos\nSupports automatic path escaping',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python trim_and_concat_videos.py ./videos

  # Windows path (auto-handle escaping)
  python trim_and_concat_videos.py "D:\videos"
  python trim_and_concat_videos.py D:\\videos

  # Custom trim times
  python trim_and_concat_videos.py ./videos --trim-start 5 --trim-end 4

  # Skip files containing specific keywords
  python trim_and_concat_videos.py ./videos --skip-keywords writing test

  # Don't skip any keywords
  python trim_and_concat_videos.py ./videos --skip-keywords

  # Specify output directory
  python trim_and_concat_videos.py ./videos --output ./output

Note: Script automatically fixes audio-video sync issues
        """
    )

    parser.add_argument(
        'directory',
        type=str,
        help='Video directory path'
    )

    parser.add_argument(
        '--trim-start',
        type=float,
        default=5.0,
        help='Seconds to trim from start (default: 5.0)'
    )

    parser.add_argument(
        '--trim-end',
        type=float,
        default=4.0,
        help='Seconds to trim from end (default: 4.0)'
    )

    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='Output directory (default: same as input)'
    )

    parser.add_argument(
        '--skip-keywords',
        type=str,
        nargs='*',
        default=['writing'],
        help='Skip files containing these keywords (default: writing)'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        default=True,
        help='Show detailed debug information (default: True)'
    )

    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Quiet mode, show only important info'
    )

    parser.add_argument(
        '--src-lang',
        type=str,
        default='zh-CN',
        help='Source language code for translation (default: zh-CN for Chinese)'
    )

    args = parser.parse_args()

    # Validate directory - use normalize_path to auto-handle escaping
    try:
        directory = normalize_path(args.directory)
    except Exception as e:
        print(f"Error: Cannot parse directory path - {e}")
        print(f"Original path: {args.directory}")
        sys.exit(1)

    if not directory.exists():
        print(f"Error: Directory does not exist - {directory}")
        sys.exit(1)

    if not directory.is_dir():
        print(f"Error: Not a valid directory - {directory}")
        sys.exit(1)

    # Output directory - use normalize_path to handle
    if args.output:
        try:
            output_dir = normalize_path(args.output)
        except Exception as e:
            print(f"Error: Cannot parse output directory path - {e}")
            print(f"Original path: {args.output}")
            sys.exit(1)
    else:
        output_dir = directory

    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine verbose setting
    verbose = not args.quiet  # If --quiet is set, verbose=False

    # Create processor (auto-detect CUDA)
    processor = VideoProcessor(
        trim_start=args.trim_start,
        trim_end=args.trim_end,
        skip_keywords=args.skip_keywords,
        verbose=verbose,
        src_lang=args.src_lang
    )

    # Check FFmpeg
    if not processor.check_ffmpeg():
        print("Error: FFmpeg is not installed or not accessible")
        print("\nPlease install FFmpeg:")
        print("Windows: https://ffmpeg.org/download.html")
        print("Linux: sudo apt-get install ffmpeg")
        print("macOS: brew install ffmpeg")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("Video Batch Processing Tool")
    print("v2.2.0 - Auto CUDA + Translation + Re-encoding")
    print("=" * 70)
    print(f"\n📂 Input directory: {directory}")
    print(f"📂 Output directory: {output_dir}")
    print(f"✂️  Trim settings: Start {args.trim_start}s, End {args.trim_end}s")
    if args.skip_keywords:
        print(f"⏭️  Skip keywords: {', '.join(args.skip_keywords)}")
    print(f"\n🔧 Features:")
    print(f"  - Auto-translate filenames to English (Google Translate)")
    print(f"    Source language: {args.src_lang} (forced, not auto-detect)")
    print(f"  - Sanitize filenames (remove special chars, replace spaces)")
    print(f"  - Re-encoding ALL videos (ensures maximum compatibility)")

    # CUDA status display (auto-detected)
    if processor.cuda_available:
        print(f"\n🚀 Hardware Acceleration: ENABLED (Auto-detected)")
        print(f"   Encoder: h264_nvenc (NVIDIA GPU)")
        print(f"   Preset: p4 (medium quality/speed balance)")
        print(f"   Expected: 3-5x faster than CPU encoding")
    else:
        print(f"\n🖥️  Encoder: CPU (libx264)")
        print(f"   CUDA not available, using CPU encoding")

    print(f"\n📊 Quality: H.264 CQ 23, AAC 192kbps")
    print(f"💾 Temp files: Will be PRESERVED for review")
    print(f"⏱️  Timeout: 120 minutes for concatenation")
    print(f"🐛 Verbose mode: {'ON (detailed logs)' if verbose else 'OFF (quiet mode)'}")

    # Process videos (async call)
    output_path = asyncio.run(processor.process_directory(directory, output_dir))

    if output_path and output_path.exists():
        print("\n" + "=" * 70)
        print("✅ Processing Completed!")
        print("=" * 70)
        print(f"Output file: {output_path}")
        print(f"File size: {output_path.stat().st_size / (1024*1024):.2f} MB")
        print("\nVideo should now play correctly in all media players.")
        print("If issues persist, see FIX_PLAYBACK_ERROR.md")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        print("❌ Processing Failed!")
        print("=" * 70)
        sys.exit(1)


if __name__ == "__main__":
    main()
