#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
视频批量处理工具 - 裁剪并合并视频 (v2.0)
Video Batch Processing Tool - Trim and Concatenate Videos (v2.0)

功能 / Features:
- 🌍 自动翻译文件名为英文 (使用 Google Translate + 缓存)
- 🧹 清理文件名 (替换空格为下划线，移除特殊字符)
- ✂️ 裁剪视频开头和结尾
- 📦 批量处理目录中的所有视频
- 🔗 自动合并为单个视频文件
- 🕐 生成时间戳文件名
- 🔧 自动处理路径转义和特殊字符
- 🎵 修复音画不同步问题
- ⏭️ 支持跳过包含特定关键字的文件
- 📝 详细错误日志输出

Usage:
    # 基本使用
    python trim_and_concat_videos.py <video_directory>

    # Windows 路径示例（支持以下所有格式）
    python trim_and_concat_videos.py "D:\.tmp\BaiduNetdiskDownload\Laos\v"
    python trim_and_concat_videos.py D:\.tmp\BaiduNetdiskDownload\Laos\v
    python trim_and_concat_videos.py D:\\.tmp\\BaiduNetdiskDownload\\Laos\\v

    # 跳过包含"书写"关键字的文件（默认已启用）
    python trim_and_concat_videos.py ./videos

    # 跳过多个关键字
    python trim_and_concat_videos.py ./videos --skip-keywords 书写 测试

    # 自定义裁剪时间
    python trim_and_concat_videos.py ./videos --trim-start 5 --trim-end 4

    # 指定输出目录
    python trim_and_concat_videos.py ./videos --output ./output

音画同步修复:
    脚本使用自动回退机制确保视频兼容性:
    1. 首先尝试快速流复制
    2. 如果失败，自动使用重新编码
    3. 重新编码使用 H.264 + AAC 确保所有播放器都能播放

    重新编码参数:
    - Video: H.264, CRF 23 (高质量)
    - Audio: AAC, 192kbps
    - Optimization: faststart (流媒体优化)
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


async def translate_filename(filename: str) -> str:
    """
    Translate filename to English using GoogleTranslator

    Args:
        filename: Original filename (without extension)

    Returns:
        Translated filename
    """
    try:
        async with GoogleTranslator() as translator:
            result = await translator.translate_single(
                text=filename,
                src='auto',
                dest='en',
                use_cache=True
            )
            if result.error:
                print(f"Translation warning: {result.error}, using original name")
                return filename
            return result.translated_text
    except Exception as e:
        print(f"Translation error: {e}, using original name")
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
    规范化路径，自动处理转义和特殊字符

    Args:
        path_str: 原始路径字符串

    Returns:
        规范化的 Path 对象
    """
    # 移除路径两端的引号
    path_str = path_str.strip('\'"')

    # 转换为 Path 对象，自动处理转义
    path = Path(path_str)

    # 解析为绝对路径
    path = path.resolve()

    return path


class VideoProcessor:
    """视频处理器"""

    # 支持的视频格式
    SUPPORTED_FORMATS = {'.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v'}

    def __init__(self, trim_start: float = 5.0, trim_end: float = 4.0, skip_keywords: list = None):
        """
        初始化视频处理器

        Args:
            trim_start: 裁剪开头秒数 (default: 5.0)
            trim_end: 裁剪结尾秒数 (default: 4.0)
            skip_keywords: 跳过包含这些关键字的文件 (default: None)
        """
        self.trim_start = trim_start
        self.trim_end = trim_end
        self.skip_keywords = skip_keywords or []

    def check_ffmpeg(self) -> bool:
        """检查 FFmpeg 是否安装"""
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

    def find_videos(self, directory: Path) -> list:
        """
        查找目录中的所有视频文件

        Args:
            directory: 视频目录路径

        Returns:
            排序后的视频文件路径列表（已过滤跳过的关键字）
        """
        videos = []
        skipped = []

        for file_path in directory.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in self.SUPPORTED_FORMATS:
                # 检查是否包含跳过的关键字
                should_skip = False
                for keyword in self.skip_keywords:
                    if keyword.lower() in file_path.name.lower():
                        should_skip = True
                        skipped.append((file_path, keyword))
                        break

                if not should_skip:
                    videos.append(file_path)

        # 显示跳过的文件
        if skipped:
            print(f"\n⏭️  跳过 {len(skipped)} 个包含关键字的文件:")
            for file_path, keyword in skipped:
                print(f"   - {file_path.name} (关键字: {keyword})")
            print()

        # 按文件名排序
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

            # Step 1: Translate filename to English
            print(f"  - Translating to English...")
            translated_name = await translate_filename(stem)
            print(f"    Original: {stem}")
            print(f"    Translated: {translated_name}")

            # Step 2: Sanitize filename (remove special chars, replace spaces)
            sanitized_name = sanitize_filename(translated_name)
            print(f"    Sanitized: {sanitized_name}")

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
        获取视频时长

        Args:
            video_path: 视频文件路径

        Returns:
            视频时长（秒）
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
                print(f"警告: 无法获取视频时长 {video_path.name}")
                return 0.0
        except Exception as e:
            print(f"错误: 获取视频时长失败 - {e}")
            return 0.0

    def trim_video(self, input_path: Path, output_path: Path, use_reencode: bool = False) -> bool:
        """
        裁剪视频（去掉开头和结尾）
        使用重新编码确保兼容性和音画同步

        Args:
            input_path: 输入视频路径
            output_path: 输出视频路径
            use_reencode: 是否使用重新编码（默认False，流复制失败时自动重试）

        Returns:
            是否成功
        """
        # 获取视频时长
        duration = self.get_video_duration(input_path)

        if duration <= 0:
            print(f"Skip: {input_path.name} (cannot get duration)")
            return False

        # 计算裁剪后的时长
        trimmed_duration = duration - self.trim_start - self.trim_end

        if trimmed_duration <= 0:
            print(f"Skip: {input_path.name} (too short after trimming)")
            return False

        # 尝试两种方案：先流复制，失败则重新编码
        if not use_reencode:
            # 方案1: 流复制（快速但可能有兼容性问题）
            cmd = [
                'ffmpeg',
                '-ss', str(self.trim_start),   # 在 -i 之前更快
                '-i', str(input_path),
                '-t', str(trimmed_duration),
                '-c', 'copy',                  # 流复制
                '-avoid_negative_ts', '1',     # 修复时间戳
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
                    # 删除失败的输出文件
                    if output_path.exists():
                        output_path.unlink()
                    # 递归调用，使用重新编码
                    return self.trim_video(input_path, output_path, use_reencode=True)

            except subprocess.TimeoutExpired:
                print(f"Timeout: {input_path.name}")
                return False
            except Exception as e:
                print(f"Error: {input_path.name} - {e}")
                return False
        else:
            # 方案2: 重新编码（慢但可靠）
            cmd = [
                'ffmpeg',
                '-ss', str(self.trim_start),
                '-i', str(input_path),
                '-t', str(trimmed_duration),
                '-c:v', 'libx264',             # H.264 视频编码
                '-preset', 'medium',           # 编码速度
                '-crf', '23',                  # 质量（18-28，越小质量越高）
                '-c:a', 'aac',                 # AAC 音频编码
                '-b:a', '192k',                # 音频比特率
                '-movflags', '+faststart',     # 优化流媒体
                '-y',
                str(output_path)
            ]

            try:
                print(f"Processing (re-encode): {input_path.name} ({duration:.1f}s → {trimmed_duration:.1f}s)")
                result = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=600  # 重新编码需要更多时间
                )

                if result.returncode == 0:
                    print(f"Done (re-encoded): {output_path.name}")
                    return True
                else:
                    error_msg = result.stderr.decode('utf-8', errors='ignore')
                    print(f"Failed: {input_path.name}")
                    print(f"Error: {error_msg[:200]}")
                    return False

            except subprocess.TimeoutExpired:
                print(f"Timeout: {input_path.name}")
                return False
            except Exception as e:
                print(f"Error: {input_path.name} - {e}")
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
                '-y',
                str(output_path)
            ]

            print(f"\nConcatenating {len(video_paths)} videos (with re-encoding)...")
            print("Note: Re-encoding ensures compatibility and fixes sync issues")
            print("This may take a long time depending on video count and size...")

            timeout = 7200  # 120 minutes (2 hours)

            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout
            )

            if result.returncode == 0:
                print(f"Concatenation completed: {output_path.name}")
                return True
            else:
                error_msg = result.stderr.decode('utf-8', errors='ignore')
                print(f"\n" + "=" * 70)
                print("ERROR: Concatenation failed!")
                print("=" * 70)
                print(f"Return code: {result.returncode}")
                print(f"\n[Full Error Output]:")
                print(error_msg)
                print("=" * 70)

                # Save error log to file
                error_log_path = output_path.parent / f"concat_error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
                try:
                    with open(error_log_path, 'w', encoding='utf-8') as log_file:
                        log_file.write("FFmpeg Concatenation Error Log\n")
                        log_file.write("=" * 70 + "\n\n")
                        log_file.write(f"Command: {' '.join(cmd)}\n\n")
                        log_file.write(f"Return code: {result.returncode}\n\n")
                        log_file.write("Stderr output:\n")
                        log_file.write(error_msg)
                        log_file.write("\n\nConcat file content:\n")
                        with open(concat_file, 'r', encoding='utf-8') as cf:
                            log_file.write(cf.read())
                    print(f"\nError log saved to: {error_log_path}")
                except Exception as e:
                    print(f"Warning: Could not save error log: {e}")

                return False

        except subprocess.TimeoutExpired:
            print(f"Concatenation timeout (exceeded {timeout//60} minutes)")
            print(f"Suggestion: Too many videos or videos too large")
            print(f"Consider processing in smaller batches")
            return False
        except Exception as e:
            print(f"Concatenation error: {e}")
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
            Path to final output video
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
    """主函数"""
    parser = argparse.ArgumentParser(
        description='视频批量处理工具 - 裁剪并合并视频\n支持自动路径转义处理',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例 / Examples:
  # 基本使用
  python trim_and_concat_videos.py ./videos

  # Windows 路径（自动处理转义）
  python trim_and_concat_videos.py "D:\.tmp\BaiduNetdiskDownload\Laos\v"
  python trim_and_concat_videos.py D:\\.tmp\\BaiduNetdiskDownload\\Laos\\v

  # 自定义裁剪时间
  python trim_and_concat_videos.py ./videos --trim-start 5 --trim-end 4

  # 跳过包含特定关键字的文件（默认跳过"书写"）
  python trim_and_concat_videos.py ./videos --skip-keywords 书写 测试

  # 不跳过任何关键字
  python trim_and_concat_videos.py ./videos --skip-keywords

  # 指定输出目录
  python trim_and_concat_videos.py ./videos --output ./output

注意：脚本已自动修复音画不同步问题
        """
    )

    parser.add_argument(
        'directory',
        type=str,
        help='视频目录路径 / Video directory path'
    )

    parser.add_argument(
        '--trim-start',
        type=float,
        default=5.0,
        help='裁剪开头秒数 / Seconds to trim from start (default: 5.0)'
    )

    parser.add_argument(
        '--trim-end',
        type=float,
        default=4.0,
        help='裁剪结尾秒数 / Seconds to trim from end (default: 4.0)'
    )

    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='输出目录 / Output directory (default: same as input)'
    )

    parser.add_argument(
        '--skip-keywords',
        type=str,
        nargs='*',
        default=['书写'],
        help='跳过包含这些关键字的文件 / Skip files containing these keywords (default: 书写)'
    )

    args = parser.parse_args()

    # 验证目录 - 使用 normalize_path 自动处理转义
    try:
        directory = normalize_path(args.directory)
    except Exception as e:
        print(f"错误: 无法解析目录路径 - {e}")
        print(f"原始路径: {args.directory}")
        sys.exit(1)

    if not directory.exists():
        print(f"错误: 目录不存在 - {directory}")
        sys.exit(1)

    if not directory.is_dir():
        print(f"错误: 不是有效的目录 - {directory}")
        sys.exit(1)

    # 输出目录 - 使用 normalize_path 处理
    if args.output:
        try:
            output_dir = normalize_path(args.output)
        except Exception as e:
            print(f"错误: 无法解析输出目录路径 - {e}")
            print(f"原始路径: {args.output}")
            sys.exit(1)
    else:
        output_dir = directory

    output_dir.mkdir(parents=True, exist_ok=True)

    # 创建处理器
    processor = VideoProcessor(
        trim_start=args.trim_start,
        trim_end=args.trim_end,
        skip_keywords=args.skip_keywords
    )

    # 检查 FFmpeg
    if not processor.check_ffmpeg():
        print("错误: 未安装 FFmpeg 或无法访问")
        print("Error: FFmpeg is not installed or not accessible")
        print("\n请安装 FFmpeg:")
        print("Windows: https://ffmpeg.org/download.html")
        print("Linux: sudo apt-get install ffmpeg")
        print("macOS: brew install ffmpeg")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("Video Batch Processing Tool / 视频批量处理工具")
    print("v2.0.0 - Filename Translation + Re-encoding + Keep Temp Files")
    print("=" * 70)
    print(f"\nInput directory: {directory}")
    print(f"Output directory: {output_dir}")
    print(f"Trim settings: Start {args.trim_start}s, End {args.trim_end}s")
    if args.skip_keywords:
        print(f"Skip keywords: {', '.join(args.skip_keywords)}")
    print(f"Features:")
    print(f"  - Auto-translate filenames to English (Google Translate)")
    print(f"  - Sanitize filenames (remove special chars, replace spaces)")
    print(f"  - Re-encoding ALL videos (ensures maximum compatibility)")
    print(f"Quality: H.264 CRF 23, AAC 192kbps")
    print(f"Temp files: Will be PRESERVED for review")
    print(f"Timeout: 120 minutes for concatenation")

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
