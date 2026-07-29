#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
递归文件/文件夹重命名工具
Recursive File/Folder Renaming Tool

功能 / Features:
- 🔄 递归处理所有子目录和文件
- 🌍 自动翻译文件名为英文 (Google Translate)
- 🔤 全角字符转半角 (１２３ → 123)
- 🧹 空格替换为下划线
- 📝 实时显示处理进度
- 💾 支持预览模式（不实际重命名）
- 🐛 详细日志输出

注意事项 / Important:
- ⚠️  从最深层目录开始处理，避免路径变化问题
- ⚠️  重命名文件夹后会自动更新子路径
- ⚠️  建议先使用 --dry-run 预览

Usage:
    # 基本使用（预览模式）
    python rename_files_recursive.py "D:\folder" --dry-run

    # 实际重命名
    python rename_files_recursive.py "D:\folder"

    # 只重命名文件，不重命名文件夹
    python rename_files_recursive.py "D:\folder" --files-only

    # 只重命名文件夹，不重命名文件
    python rename_files_recursive.py "D:\folder" --folders-only

    # 静默模式
    python rename_files_recursive.py "D:\folder" --quiet
"""

import os
import sys
import re
import argparse
import asyncio
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from datetime import datetime

# Add project root to path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from pycore.pyutils.translator.google_translator import GoogleTranslator


def contains_non_ascii(text: str) -> bool:
    """
    Check if text contains non-ASCII characters (e.g., Chinese, Japanese, Korean, Thai, etc.)

    Args:
        text: Input text

    Returns:
        True if contains non-ASCII characters, False otherwise
    """
    # Check for common non-ASCII character ranges:
    # - Chinese (CJK): \u4e00-\u9fff
    # - Japanese Hiragana: \u3040-\u309f
    # - Japanese Katakana: \u30a0-\u30ff
    # - Korean: \uac00-\ud7af
    # - Thai: \u0e00-\u0e7f
    # - Arabic: \u0600-\u06ff
    # - Any other non-ASCII: ord(char) > 127

    for char in text:
        if ord(char) > 127:
            return True
    return False


def full_to_half_width(text: str) -> str:
    """
    Convert full-width characters to half-width

    Args:
        text: Input text

    Returns:
        Converted text
    """
    result = []
    for char in text:
        code = ord(char)
        # Full-width space
        if code == 0x3000:
            result.append(' ')
        # Full-width characters (except space) range: 0xFF01-0xFF5E
        # Corresponding half-width range: 0x0021-0x007E
        elif 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        else:
            result.append(char)
    return ''.join(result)


async def translate_name(name: str, src_lang: str = 'zh-CN', verbose: bool = False) -> str:
    """
    Translate name to English

    Args:
        name: Original name
        src_lang: Source language code
        verbose: Show detailed information

    Returns:
        Translated name
    """
    try:
        async with GoogleTranslator() as translator:
            result = await translator.translate_single(
                text=name,
                src=src_lang,
                dest='en',
                use_cache=True
            )

            if verbose:
                print(f"      [Translation] {name} → {result.translated_text}")
                if result.from_cache:
                    print(f"      [Cache] Used cached translation")

            if result.error:
                if verbose:
                    print(f"      [Warning] Translation failed: {result.error}")
                return name

            return result.translated_text

    except Exception as e:
        if verbose:
            print(f"      [Error] Translation exception: {e}")
        return name


def sanitize_name(name: str) -> str:
    """
    Sanitize filename/folder name

    Steps:
    1. Convert full-width → half-width
    2. Replace spaces with underscores
    3. Remove special characters (keep: letters, digits, underscores, hyphens, dots)
    4. Clean up extra underscores

    Args:
        name: Original name

    Returns:
        Sanitized name
    """
    # Step 1: Full-width → half-width
    name = full_to_half_width(name)

    # Step 2: Spaces → underscores
    name = name.replace(' ', '_')

    # Step 3: Remove special characters (keep basic characters)
    # Note: Keep non-ASCII characters (Chinese, Japanese, etc.), only remove special symbols
    # Allowed: letters, digits, underscores, hyphens, dots, non-ASCII characters
    name = re.sub(r'[^\w\-\.\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0e00-\u0e7f]', '_', name)

    # Step 4: Clean up extra underscores
    name = re.sub(r'_+', '_', name)  # Multiple underscores → single
    name = name.strip('_')  # Remove leading/trailing underscores

    return name


class FileRenamer:
    """文件/文件夹递归重命名器"""

    def __init__(
        self,
        root_dir: Path,
        src_lang: str = 'zh-CN',
        dry_run: bool = False,
        files_only: bool = False,
        folders_only: bool = False,
        verbose: bool = True
    ):
        """
        初始化重命名器

        Args:
            root_dir: 根目录
            src_lang: 翻译源语言
            dry_run: 预览模式（不实际重命名）
            files_only: 只重命名文件
            folders_only: 只重命名文件夹
            verbose: 详细输出
        """
        self.root_dir = root_dir
        self.src_lang = src_lang
        self.dry_run = dry_run
        self.files_only = files_only
        self.folders_only = folders_only
        self.verbose = verbose

        # 统计信息
        self.stats = {
            'total_items': 0,
            'renamed_items': 0,
            'skipped_items': 0,
            'failed_items': 0,
            'total_files': 0,
            'total_folders': 0,
            'renamed_files': 0,
            'renamed_folders': 0,
        }

        # 路径映射（旧路径 → 新路径）
        self.path_mapping: Dict[Path, Path] = {}

    def scan_directory(self) -> List[Tuple[Path, int]]:
        """
        扫描目录，返回所有文件和文件夹（按深度排序）

        Returns:
            [(path, depth), ...] 深度大的排在前面（从深层到浅层）
        """
        items = []

        for root, dirs, files in os.walk(self.root_dir):
            root_path = Path(root)
            depth = len(root_path.relative_to(self.root_dir).parts)

            # 添加文件
            if not self.folders_only:
                for file in files:
                    file_path = root_path / file
                    items.append((file_path, depth))
                    self.stats['total_files'] += 1

            # 添加文件夹
            if not self.files_only:
                for dir_name in dirs:
                    dir_path = root_path / dir_name
                    items.append((dir_path, depth))
                    self.stats['total_folders'] += 1

        # 按深度降序排序（深层优先）
        items.sort(key=lambda x: x[1], reverse=True)

        self.stats['total_items'] = len(items)
        return items

    async def process_item(self, item_path: Path, index: int, total: int) -> bool:
        """
        处理单个文件或文件夹

        Args:
            item_path: 项目路径
            index: 当前索引（从1开始）
            total: 总数

        Returns:
            是否成功
        """
        # 检查父目录是否被重命名
        parent = item_path.parent
        if parent in self.path_mapping:
            # 使用新的父目录路径
            new_parent = self.path_mapping[parent]
            item_path = new_parent / item_path.name

        # 检查路径是否仍然存在
        if not item_path.exists():
            if self.verbose:
                print(f"\n[{index}/{total}] ⏭️  Skipped (path no longer exists): {item_path.name}")
            self.stats['skipped_items'] += 1
            return False

        # 获取原始名称（不含扩展名）
        is_file = item_path.is_file()
        if is_file:
            stem = item_path.stem
            suffix = item_path.suffix
        else:
            stem = item_path.name
            suffix = ''

        item_type = "📄 File" if is_file else "📁 Folder"
        print(f"\n[{index}/{total}] {item_type}: {item_path.name}")

        # Check if filename contains non-ASCII characters
        needs_translation = contains_non_ascii(stem)

        # Step 1: Translate name (only if needed)
        if needs_translation:
            if self.verbose:
                print(f"  ⏳ Step 1: Translating...")

            translated_stem = await translate_name(stem, src_lang=self.src_lang, verbose=self.verbose)
        else:
            if self.verbose:
                print(f"  ⏭️  Step 1: Skipped (no non-ASCII characters)")
            translated_stem = stem

        # Step 2: Sanitize name
        if self.verbose:
            print(f"  ⏳ Step 2: Sanitizing...")

        sanitized_stem = sanitize_name(translated_stem)

        if self.verbose:
            if stem != translated_stem and needs_translation:
                print(f"    Original:   {stem}")
                print(f"    Translated: {translated_stem}")
            if translated_stem != sanitized_stem:
                print(f"    Sanitized:  {sanitized_stem}")

        # Step 3: Generate new name
        new_name = f"{sanitized_stem}{suffix}" if is_file else sanitized_stem

        # Check if renaming is needed
        if new_name == item_path.name:
            print(f"  ✅ No change needed")
            self.stats['skipped_items'] += 1
            return True

        # Generate new path
        new_path = item_path.parent / new_name

        # Handle filename conflicts
        counter = 1
        original_new_path = new_path
        while new_path.exists() and new_path != item_path:
            if is_file:
                new_name = f"{sanitized_stem}_{counter}{suffix}"
            else:
                new_name = f"{sanitized_stem}_{counter}"
            new_path = item_path.parent / new_name
            counter += 1

        if new_path != original_new_path:
            print(f"  ⚠️  Conflict detected, using: {new_name}")

        # Step 4: Rename
        if self.dry_run:
            print(f"  🔍 [DRY RUN] Would rename to: {new_name}")
            self.stats['renamed_items'] += 1
            if is_file:
                self.stats['renamed_files'] += 1
            else:
                self.stats['renamed_folders'] += 1
            return True
        else:
            try:
                item_path.rename(new_path)
                print(f"  ✅ Renamed to: {new_name}")

                # Record path mapping (for updating child paths)
                self.path_mapping[item_path] = new_path

                self.stats['renamed_items'] += 1
                if is_file:
                    self.stats['renamed_files'] += 1
                else:
                    self.stats['renamed_folders'] += 1

                return True

            except Exception as e:
                print(f"  ❌ Failed to rename: {e}")
                self.stats['failed_items'] += 1
                return False

    async def run(self):
        """执行重命名"""
        print("\n" + "=" * 70)
        print("Recursive File/Folder Renaming Tool")
        print("递归文件/文件夹重命名工具")
        print("=" * 70)
        print(f"\n📂 Root directory: {self.root_dir}")
        print(f"🌍 Source language: {self.src_lang}")
        print(f"🔧 Mode: {'DRY RUN (Preview)' if self.dry_run else 'ACTUAL RENAME'}")
        if self.files_only:
            print(f"📄 Target: Files only")
        elif self.folders_only:
            print(f"📁 Target: Folders only")
        else:
            print(f"🎯 Target: Files and folders")

        # Step 1: 扫描目录
        print(f"\n{'=' * 70}")
        print("Step 1: Scanning directory...")
        print(f"{'=' * 70}")

        items = self.scan_directory()

        print(f"\n📊 Scan results:")
        print(f"  - Total items: {self.stats['total_items']}")
        print(f"  - Files: {self.stats['total_files']}")
        print(f"  - Folders: {self.stats['total_folders']}")

        if not items:
            print("\n⚠️  No items to process")
            return

        # Step 2: 处理所有项目
        print(f"\n{'=' * 70}")
        print("Step 2: Processing items (from deepest to shallowest)...")
        print(f"{'=' * 70}")

        for index, (item_path, depth) in enumerate(items, 1):
            await self.process_item(item_path, index, len(items))

        # Step 3: 显示统计信息
        self.print_summary()

    def print_summary(self):
        """打印统计摘要"""
        print(f"\n{'=' * 70}")
        print("Summary / 统计摘要")
        print(f"{'=' * 70}")
        print(f"\n📊 Statistics:")
        print(f"  - Total items processed: {self.stats['total_items']}")
        print(f"    - Files: {self.stats['total_files']}")
        print(f"    - Folders: {self.stats['total_folders']}")
        print(f"\n✅ Results:")
        print(f"  - Renamed: {self.stats['renamed_items']}")
        print(f"    - Files: {self.stats['renamed_files']}")
        print(f"    - Folders: {self.stats['renamed_folders']}")
        print(f"  - Skipped (no change needed): {self.stats['skipped_items']}")
        print(f"  - Failed: {self.stats['failed_items']}")

        if self.dry_run:
            print(f"\n🔍 This was a DRY RUN - no actual changes were made")
            print(f"💡 Remove --dry-run to perform actual renaming")

        print(f"\n{'=' * 70}")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='递归重命名文件和文件夹工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例 / Examples:
  # 预览模式（不实际重命名）
  python rename_files_recursive.py "D:\\folder" --dry-run

  # 实际重命名
  python rename_files_recursive.py "D:\\folder"

  # 只重命名文件
  python rename_files_recursive.py "D:\\folder" --files-only

  # 只重命名文件夹
  python rename_files_recursive.py "D:\\folder" --folders-only

  # 日语文件名
  python rename_files_recursive.py "D:\\folder" --src-lang ja

  # 静默模式
  python rename_files_recursive.py "D:\\folder" --quiet

功能 / Features:
  - 递归处理所有子目录和文件
  - 自动翻译为英文（Google Translate）
  - 全角字符转半角（１２３ → 123）
  - 空格替换为下划线
  - 从最深层开始处理，避免路径变化问题
        """
    )

    parser.add_argument(
        'directory',
        type=str,
        help='要处理的目录 / Directory to process'
    )

    parser.add_argument(
        '--src-lang',
        type=str,
        default='zh-CN',
        help='翻译源语言代码 / Source language code (default: zh-CN)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='预览模式，不实际重命名 / Preview mode, do not actually rename'
    )

    parser.add_argument(
        '--files-only',
        action='store_true',
        help='只重命名文件 / Rename files only'
    )

    parser.add_argument(
        '--folders-only',
        action='store_true',
        help='只重命名文件夹 / Rename folders only'
    )

    parser.add_argument(
        '--quiet',
        action='store_true',
        help='静默模式 / Quiet mode'
    )

    args = parser.parse_args()

    # 验证目录
    directory = Path(args.directory).resolve()
    if not directory.exists():
        print(f"❌ Error: Directory does not exist - {directory}")
        sys.exit(1)

    if not directory.is_dir():
        print(f"❌ Error: Not a valid directory - {directory}")
        sys.exit(1)

    # 检查互斥选项
    if args.files_only and args.folders_only:
        print(f"❌ Error: Cannot use --files-only and --folders-only together")
        sys.exit(1)

    # 创建重命名器
    renamer = FileRenamer(
        root_dir=directory,
        src_lang=args.src_lang,
        dry_run=args.dry_run,
        files_only=args.files_only,
        folders_only=args.folders_only,
        verbose=not args.quiet
    )

    # 执行重命名
    asyncio.run(renamer.run())


if __name__ == "__main__":
    main()
