#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FLV转MP4批量转换工具
FLV to MP4 Batch Converter

功能 / Features:
- 递归扫描目录中的所有FLV文件
- 批量转换为MP4格式
- 支持保留或删除原文件
- 自动跳过已转换的文件
- 自动处理路径转义和特殊字符
- 支持多线程并行处理（可选）

Usage:
    # 基本使用
    python flv_to_mp4.py <directory>

    # 转换后删除原文件
    python flv_to_mp4.py <directory> --delete-original

    # 强制覆盖已存在的MP4文件
    python flv_to_mp4.py <directory> --overwrite

    # 指定输出目录
    python flv_to_mp4.py <directory> --output ./output

    # 使用并行处理（4个线程）
    python flv_to_mp4.py <directory> --parallel 4
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path
from typing import List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed


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


class FLVConverter:
    """FLV转MP4转换器"""

    def __init__(
        self,
        delete_original: bool = False,
        overwrite: bool = False,
        keep_structure: bool = True,
        output_dir: Path = None
    ):
        """
        初始化转换器

        Args:
            delete_original: 是否删除原FLV文件
            overwrite: 是否覆盖已存在的MP4文件
            keep_structure: 是否保持目录结构（仅在指定output_dir时有效）
            output_dir: 输出目录（None则在原位置生成）
        """
        self.delete_original = delete_original
        self.overwrite = overwrite
        self.keep_structure = keep_structure
        self.output_dir = output_dir

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

    def find_flv_files(self, directory: Path) -> List[Path]:
        """
        递归查找目录中的所有FLV文件

        Args:
            directory: 目录路径

        Returns:
            FLV文件路径列表
        """
        flv_files = []

        # 递归扫描
        for root, dirs, files in os.walk(directory):
            root_path = Path(root)
            for file in files:
                if file.lower().endswith('.flv'):
                    flv_files.append(root_path / file)

        # 排序
        flv_files.sort()
        return flv_files

    def get_output_path(self, input_path: Path, base_dir: Path) -> Path:
        """
        获取输出文件路径

        Args:
            input_path: 输入FLV文件路径
            base_dir: 基础目录（用于计算相对路径）

        Returns:
            输出MP4文件路径
        """
        if self.output_dir is None:
            # 在原位置生成
            return input_path.with_suffix('.mp4')
        else:
            if self.keep_structure:
                # 保持目录结构
                try:
                    relative_path = input_path.relative_to(base_dir)
                except ValueError:
                    # 如果无法计算相对路径，直接使用文件名
                    relative_path = input_path.name

                output_path = self.output_dir / relative_path
                output_path = output_path.with_suffix('.mp4')

                # 创建目录
                output_path.parent.mkdir(parents=True, exist_ok=True)

                return output_path
            else:
                # 所有文件输出到同一目录
                output_filename = input_path.stem + '.mp4'
                return self.output_dir / output_filename

    def convert_file(self, input_path: Path, output_path: Path) -> Tuple[bool, str]:
        """
        转换单个FLV文件为MP4

        Args:
            input_path: 输入FLV文件路径
            output_path: 输出MP4文件路径

        Returns:
            (是否成功, 错误信息)
        """
        # 检查输出文件是否已存在
        if output_path.exists() and not self.overwrite:
            return False, "输出文件已存在（使用 --overwrite 强制覆盖）"

        # FFmpeg 命令：转换FLV为MP4
        cmd = [
            'ffmpeg',
            '-i', str(input_path),
            '-c:v', 'libx264',      # 视频编码器：H.264
            '-c:a', 'aac',          # 音频编码器：AAC
            '-strict', 'experimental',
            '-b:a', '192k',         # 音频比特率
            '-movflags', '+faststart',  # 优化流媒体播放
        ]

        # 添加覆盖选项
        if self.overwrite:
            cmd.append('-y')
        else:
            cmd.append('-n')

        cmd.append(str(output_path))

        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=600  # 10分钟超时
            )

            if result.returncode == 0:
                # 转换成功，删除原文件（如果需要）
                if self.delete_original:
                    try:
                        input_path.unlink()
                    except Exception as e:
                        return True, f"转换成功但删除原文件失败: {e}"

                return True, "转换成功"
            else:
                error_msg = result.stderr.decode('utf-8', errors='ignore')
                return False, f"FFmpeg错误: {error_msg[:200]}"

        except subprocess.TimeoutExpired:
            return False, "转换超时（处理时间超过10分钟）"
        except Exception as e:
            return False, f"转换错误: {e}"

    def convert_single(self, input_path: Path, base_dir: Path, index: int, total: int) -> dict:
        """
        转换单个文件并返回结果

        Args:
            input_path: 输入文件路径
            base_dir: 基础目录
            index: 当前索引
            total: 总数

        Returns:
            结果字典
        """
        output_path = self.get_output_path(input_path, base_dir)

        print(f"\n[{index}/{total}] 处理中: {input_path.name}")
        print(f"  输入: {input_path}")
        print(f"  输出: {output_path}")

        success, message = self.convert_file(input_path, output_path)

        if success:
            # 获取文件大小
            input_size = input_path.stat().st_size if input_path.exists() else 0
            output_size = output_path.stat().st_size if output_path.exists() else 0

            print(f"  ✅ {message}")
            if input_size > 0 and output_size > 0:
                print(f"  大小: {input_size / (1024*1024):.2f} MB → {output_size / (1024*1024):.2f} MB")
        else:
            print(f"  ❌ 失败: {message}")

        return {
            'input': input_path,
            'output': output_path,
            'success': success,
            'message': message
        }

    def convert_directory(self, directory: Path, parallel: int = 1) -> dict:
        """
        转换目录中的所有FLV文件

        Args:
            directory: 目录路径
            parallel: 并行处理的线程数（1=顺序处理）

        Returns:
            结果统计字典
        """
        # 查找所有FLV文件
        flv_files = self.find_flv_files(directory)

        if not flv_files:
            print(f"错误: 在 {directory} 中未找到FLV文件")
            return {'total': 0, 'success': 0, 'failed': 0, 'skipped': 0}

        print(f"\n找到 {len(flv_files)} 个FLV文件")

        # 统计
        stats = {
            'total': len(flv_files),
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'results': []
        }

        print("=" * 70)

        if parallel > 1:
            # 并行处理
            print(f"使用 {parallel} 个线程并行处理...\n")

            with ThreadPoolExecutor(max_workers=parallel) as executor:
                futures = {
                    executor.submit(
                        self.convert_single,
                        flv_file,
                        directory,
                        i + 1,
                        len(flv_files)
                    ): flv_file
                    for i, flv_file in enumerate(flv_files)
                }

                for future in as_completed(futures):
                    result = future.result()
                    stats['results'].append(result)

                    if result['success']:
                        stats['success'] += 1
                    else:
                        if '已存在' in result['message']:
                            stats['skipped'] += 1
                        else:
                            stats['failed'] += 1
        else:
            # 顺序处理
            for i, flv_file in enumerate(flv_files):
                result = self.convert_single(flv_file, directory, i + 1, len(flv_files))
                stats['results'].append(result)

                if result['success']:
                    stats['success'] += 1
                else:
                    if '已存在' in result['message']:
                        stats['skipped'] += 1
                    else:
                        stats['failed'] += 1

        return stats


def print_summary(stats: dict):
    """打印转换摘要"""
    print("\n" + "=" * 70)
    print("转换摘要 / Conversion Summary")
    print("=" * 70)
    print(f"总文件数 / Total: {stats['total']}")
    print(f"✅ 成功 / Success: {stats['success']}")
    print(f"❌ 失败 / Failed: {stats['failed']}")
    print(f"⏭️  跳过 / Skipped: {stats['skipped']}")
    print("=" * 70)

    if stats['failed'] > 0:
        print("\n失败的文件 / Failed files:")
        for result in stats['results']:
            if not result['success'] and '已存在' not in result['message']:
                print(f"  ❌ {result['input'].name}")
                print(f"     原因: {result['message']}")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='FLV转MP4批量转换工具\n支持递归扫描和自动路径处理',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例 / Examples:
  # 基本使用
  python flv_to_mp4.py ./videos

  # Windows 路径
  python flv_to_mp4.py "D:\.tmp\videos"

  # 转换后删除原文件
  python flv_to_mp4.py ./videos --delete-original

  # 强制覆盖已存在的文件
  python flv_to_mp4.py ./videos --overwrite

  # 输出到指定目录（保持目录结构）
  python flv_to_mp4.py ./videos --output ./output

  # 输出到指定目录（所有文件放在同一目录）
  python flv_to_mp4.py ./videos --output ./output --no-keep-structure

  # 使用4个线程并行处理
  python flv_to_mp4.py ./videos --parallel 4
        """
    )

    parser.add_argument(
        'directory',
        type=str,
        help='FLV文件所在目录 / Directory containing FLV files'
    )

    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='输出目录 / Output directory (default: convert in place)'
    )

    parser.add_argument(
        '--delete-original',
        action='store_true',
        help='转换成功后删除原FLV文件 / Delete original FLV files after conversion'
    )

    parser.add_argument(
        '--overwrite',
        action='store_true',
        help='覆盖已存在的MP4文件 / Overwrite existing MP4 files'
    )

    parser.add_argument(
        '--no-keep-structure',
        action='store_true',
        help='不保持目录结构（所有文件输出到同一目录） / Do not keep directory structure'
    )

    parser.add_argument(
        '--parallel',
        type=int,
        default=1,
        help='并行处理的线程数 / Number of parallel threads (default: 1)'
    )

    args = parser.parse_args()

    # 验证目录
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

    # 输出目录
    output_dir = None
    if args.output:
        try:
            output_dir = normalize_path(args.output)
            output_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"错误: 无法创建输出目录 - {e}")
            sys.exit(1)

    # 创建转换器
    converter = FLVConverter(
        delete_original=args.delete_original,
        overwrite=args.overwrite,
        keep_structure=not args.no_keep_structure,
        output_dir=output_dir
    )

    # 检查 FFmpeg
    if not converter.check_ffmpeg():
        print("错误: 未安装 FFmpeg 或无法访问")
        print("Error: FFmpeg is not installed or not accessible")
        print("\n请安装 FFmpeg:")
        print("Windows: https://ffmpeg.org/download.html")
        print("Linux: sudo apt-get install ffmpeg")
        print("macOS: brew install ffmpeg")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("FLV转MP4批量转换工具 / FLV to MP4 Batch Converter")
    print("=" * 70)
    print(f"\n输入目录: {directory}")
    if output_dir:
        print(f"输出目录: {output_dir}")
        print(f"保持目录结构: {'是' if not args.no_keep_structure else '否'}")
    else:
        print(f"输出位置: 原位置转换")
    print(f"删除原文件: {'是' if args.delete_original else '否'}")
    print(f"覆盖已存在文件: {'是' if args.overwrite else '否'}")
    if args.parallel > 1:
        print(f"并行线程数: {args.parallel}")

    # 转换
    stats = converter.convert_directory(directory, parallel=args.parallel)

    # 打印摘要
    print_summary(stats)

    # 返回退出码
    if stats['failed'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
