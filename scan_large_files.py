#!/usr/bin/env python3
"""
扫描项目根目录，找出大文件
用于定位导致 Git 仓库过大的文件
"""

import os
import sys
from pathlib import Path
from collections import namedtuple

# 忽略的目录
IGNORE_DIRS = {
    '.git',
    'node_modules',
    '__pycache__',
    '.pytest_cache',
    '.venv',
    'venv',
    'env',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'target',
    'bin',
    'obj',
}

# 忽略的文件扩展名
IGNORE_EXTENSIONS = {
    '.pyc',
    '.pyo',
    '.pyd',
    '.so',
    '.dll',
    '.exe',
}

FileInfo = namedtuple('FileInfo', ['path', 'size', 'size_mb'])


def format_size(size_bytes):
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"


def scan_directory(root_path, min_size_mb=10):
    """扫描目录，找出大于指定大小的文件"""
    root = Path(root_path).resolve()
    if not root.exists():
        print(f"错误: 路径不存在: {root}")
        return []
    
    large_files = []
    min_size_bytes = min_size_mb * 1024 * 1024
    
    print(f"正在扫描: {root}")
    print(f"最小文件大小: {min_size_mb} MB")
    print("-" * 80)
    
    for file_path in root.rglob('*'):
        # 跳过目录
        if not file_path.is_file():
            continue
        
        # 检查是否在忽略的目录中
        if any(ignore_dir in file_path.parts for ignore_dir in IGNORE_DIRS):
            continue
        
        # 检查文件扩展名
        if file_path.suffix.lower() in IGNORE_EXTENSIONS:
            continue
        
        try:
            size = file_path.stat().st_size
            if size >= min_size_bytes:
                size_mb = size / (1024 * 1024)
                large_files.append(FileInfo(
                    path=str(file_path.relative_to(root)),
                    size=size,
                    size_mb=size_mb
                ))
        except (OSError, PermissionError) as e:
            # 跳过无法访问的文件
            continue
    
    # 按大小排序
    large_files.sort(key=lambda x: x.size, reverse=True)
    return large_files


def main():
    """主函数"""
    # 获取项目根目录（脚本所在目录）
    script_dir = Path(__file__).parent.resolve()
    
    # 可以指定最小文件大小（MB），默认10MB
    min_size_mb = 10
    if len(sys.argv) > 1:
        try:
            min_size_mb = float(sys.argv[1])
        except ValueError:
            print(f"警告: 无效的大小参数 '{sys.argv[1]}'，使用默认值 10 MB")
    
    print("=" * 80)
    print("大文件扫描工具")
    print("=" * 80)
    print()
    
    large_files = scan_directory(script_dir, min_size_mb)
    
    if not large_files:
        print(f"\n未找到大于 {min_size_mb} MB 的文件")
        return
    
    print(f"\n找到 {len(large_files)} 个大文件 (>= {min_size_mb} MB):\n")
    
    # 统计信息
    total_size = 0
    over_100mb_count = 0
    over_100mb_size = 0
    
    print(f"{'序号':<6} {'大小':<12} {'大小(MB)':<12} {'文件路径'}")
    print("-" * 80)
    
    for idx, file_info in enumerate(large_files, 1):
        total_size += file_info.size
        
        # 标记超过100MB的文件（Git限制）
        marker = ""
        if file_info.size_mb >= 100:
            marker = " ⚠️ 超过100MB限制"
            over_100mb_count += 1
            over_100mb_size += file_info.size
        
        print(f"{idx:<6} {format_size(file_info.size):<12} {file_info.size_mb:>10.2f} MB  {file_info.path}{marker}")
    
    print("-" * 80)
    print(f"\n统计信息:")
    print(f"  总文件数: {len(large_files)}")
    print(f"  总大小: {format_size(total_size)} ({total_size / (1024*1024):.2f} MB)")
    print(f"  超过100MB的文件数: {over_100mb_count}")
    if over_100mb_count > 0:
        print(f"  超过100MB的文件总大小: {format_size(over_100mb_size)} ({over_100mb_size / (1024*1024):.2f} MB)")
        print(f"\n⚠️  警告: 发现 {over_100mb_count} 个超过100MB的文件，这些文件可能导致Git推送失败！")
    
    # 显示前10大文件
    print(f"\n前10大文件:")
    print("-" * 80)
    for idx, file_info in enumerate(large_files[:10], 1):
        marker = " ⚠️" if file_info.size_mb >= 100 else ""
        print(f"  {idx}. {file_info.path}")
        print(f"     {format_size(file_info.size)} ({file_info.size_mb:.2f} MB){marker}")


if __name__ == '__main__':
    main()





