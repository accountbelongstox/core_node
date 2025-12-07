#!/usr/bin/env python3
"""
统计Git仓库中各个包/目录的大小
支持统计：
1. Git对象数据库中的大小（实际存储在.git中的大小）
2. 工作目录中的大小（当前文件系统大小）
"""

import subprocess
import os
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, Tuple, Optional

def run_git_command(cmd: list, cwd: Optional[str] = None) -> str:
    """执行git命令并返回输出"""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=True,
            encoding='utf-8',
            errors='ignore'
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"警告: Git命令执行失败: {' '.join(cmd)}", file=sys.stderr)
        return ""
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        return ""

def get_git_root() -> Optional[Path]:
    """获取git仓库根目录"""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--show-toplevel'],
            capture_output=True,
            text=True,
            check=True
        )
        return Path(result.stdout.strip())
    except:
        return None

def format_size(size_bytes: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"

def get_git_tracked_files() -> list:
    """获取所有被git跟踪的文件列表"""
    output = run_git_command(['git', 'ls-files'])
    if not output:
        return []
    return [line.strip() for line in output.split('\n') if line.strip()]

def get_all_files_git_size(git_root: Path) -> Dict[str, int]:
    """批量获取所有文件在git对象数据库中的大小（更高效）"""
    file_sizes = {}
    
    # 使用git ls-files -s一次性获取所有文件的对象hash
    output = run_git_command(['git', 'ls-files', '-s'], cwd=str(git_root))
    if not output:
        return file_sizes
    
    lines = output.split('\n')
    print(f"  正在解析 {len(lines)} 个文件的对象信息...", end='\r', flush=True)
    
    # 收集所有对象hash
    obj_hashes = {}
    for line in lines:
        if not line.strip():
            continue
        
        # 格式: mode hash stage\tfilename 或 mode hash stage filename
        # 先尝试按tab分割
        if '\t' in line:
            parts = line.split('\t', 1)
            header = parts[0]
            file_path = parts[1] if len(parts) > 1 else ''
        else:
            # 如果没有tab，按空格分割，最后一个部分是文件名
            parts = line.split()
            if len(parts) < 3:
                continue
            header = ' '.join(parts[:3])
            file_path = ' '.join(parts[3:]) if len(parts) > 3 else ''
        
        header_parts = header.split()
        if len(header_parts) < 2:
            continue
        
        obj_hash = header_parts[1]
        if file_path:
            obj_hashes[obj_hash] = file_path
    
    # 批量获取对象大小（使用git cat-file --batch-check）
    print(f"  正在获取 {len(obj_hashes)} 个对象的大小...", end='\r', flush=True)
    
    # 准备输入（每行一个hash）
    hash_list = '\n'.join(obj_hashes.keys())
    
    try:
        result = subprocess.run(
            ['git', 'cat-file', '--batch-check'],
            input=hash_list,
            cwd=str(git_root),
            capture_output=True,
            text=True,
            check=True,
            encoding='utf-8',
            errors='ignore'
        )
        
        # 解析输出: hash type size
        for line in result.stdout.split('\n'):
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) < 3:
                continue
            
            obj_hash = parts[0]
            size_str = parts[2]
            
            if obj_hash in obj_hashes:
                try:
                    file_sizes[obj_hashes[obj_hash]] = int(size_str)
                except:
                    pass
    except Exception as e:
        print(f"\n  警告: 批量获取对象大小失败: {e}", file=sys.stderr)
        print("  回退到逐个获取方式...")
        # 回退到逐个获取
        for obj_hash, file_path in obj_hashes.items():
            size_output = run_git_command(['git', 'cat-file', '-s', obj_hash], cwd=str(git_root))
            if size_output:
                try:
                    file_sizes[file_path] = int(size_output)
                except:
                    pass
    
    print(f"  已获取 {len(file_sizes)} 个文件的对象大小        ")
    return file_sizes

def get_file_disk_size(file_path: Path) -> int:
    """获取文件在磁盘上的大小"""
    try:
        if file_path.exists() and file_path.is_file():
            return file_path.stat().st_size
    except:
        pass
    return 0

def categorize_files(files: list, git_root: Path) -> Dict[str, list]:
    """将文件按顶级目录分类"""
    categories = defaultdict(list)
    
    for file_path in files:
        # 获取相对于git根目录的路径
        rel_path = Path(file_path)
        
        # 获取顶级目录
        if len(rel_path.parts) > 0:
            top_level = rel_path.parts[0]
            categories[top_level].append(file_path)
        else:
            categories['root'].append(file_path)
    
    return categories

def calculate_package_sizes(
    categories: Dict[str, list],
    git_root: Path,
    use_git_size: bool = True,
    git_file_sizes: Optional[Dict[str, int]] = None
) -> Dict[str, int]:
    """计算每个包的大小"""
    package_sizes = {}
    
    for package, files in categories.items():
        total_size = 0
        file_count = len(files)
        
        print(f"  处理 {package} ({file_count} 个文件)...", end='\r', flush=True)
        
        for file_path in files:
            if use_git_size and git_file_sizes:
                # 使用预加载的git对象大小
                size = git_file_sizes.get(file_path, 0)
            else:
                # 使用磁盘上的大小
                full_path = git_root / file_path
                size = get_file_disk_size(full_path)
            
            total_size += size
        
        package_sizes[package] = total_size
        print(f"  {package}: {format_size(total_size)} ({file_count} 文件)      ")
    
    return package_sizes

def get_main_packages() -> list:
    """获取主要包列表（可根据项目结构调整）"""
    return [
        'poly_apps',
        'pycore',
        'pyapps',
        'ncore',
        'scripts',
        'apps',
        'pycore_module_caller.py',
        'pymain.py',
        'main.js',
        'package.json',
    ]

def main():
    print("=" * 80)
    print("Git仓库包大小统计工具")
    print("=" * 80)
    
    # 获取git根目录
    git_root = get_git_root()
    if not git_root:
        print("错误: 当前目录不是git仓库")
        sys.exit(1)
    
    print(f"\nGit仓库根目录: {git_root}")
    print(f"当前工作目录: {os.getcwd()}\n")
    
    # 获取所有被跟踪的文件
    print("正在获取git跟踪的文件列表...")
    tracked_files = get_git_tracked_files()
    
    if not tracked_files:
        print("警告: 没有找到被git跟踪的文件")
        sys.exit(1)
    
    print(f"找到 {len(tracked_files)} 个被跟踪的文件\n")
    
    # 按目录分类
    print("正在按目录分类文件...")
    categories = categorize_files(tracked_files, git_root)
    print(f"找到 {len(categories)} 个顶级目录/文件\n")
    
    # 批量获取所有文件的git对象大小（更高效）
    print("=" * 80)
    print("统计方式 1: Git对象数据库中的大小（实际存储在.git中的大小）")
    print("=" * 80)
    print("正在批量获取文件对象大小...")
    git_file_sizes = get_all_files_git_size(git_root)
    print()
    git_sizes = calculate_package_sizes(categories, git_root, use_git_size=True, git_file_sizes=git_file_sizes)
    
    # 统计磁盘上的大小
    print("\n" + "=" * 80)
    print("统计方式 2: 工作目录中的大小（当前文件系统大小）")
    print("=" * 80)
    disk_sizes = calculate_package_sizes(categories, git_root, use_git_size=False)
    
    # 显示结果
    print("\n" + "=" * 80)
    print("统计结果汇总")
    print("=" * 80)
    print(f"\n{'包/目录':<30} {'Git对象大小':<20} {'磁盘大小':<20} {'文件数':<10}")
    print("-" * 80)
    
    # 按大小排序
    sorted_packages = sorted(
        git_sizes.items(),
        key=lambda x: x[1],
        reverse=True
    )
    
    total_git_size = 0
    total_disk_size = 0
    total_files = 0
    
    for package, git_size in sorted_packages:
        disk_size = disk_sizes.get(package, 0)
        file_count = len(categories.get(package, []))
        
        total_git_size += git_size
        total_disk_size += disk_size
        total_files += file_count
        
        print(f"{package:<30} {format_size(git_size):<20} {format_size(disk_size):<20} {file_count:<10}")
    
    print("-" * 80)
    print(f"{'总计':<30} {format_size(total_git_size):<20} {format_size(total_disk_size):<20} {total_files:<10}")
    
    # 显示主要包
    print("\n" + "=" * 80)
    print("主要包统计（Top 10）")
    print("=" * 80)
    print(f"\n{'排名':<6} {'包/目录':<30} {'Git对象大小':<20} {'文件数':<10}")
    print("-" * 80)
    
    for i, (package, git_size) in enumerate(sorted_packages[:10], 1):
        file_count = len(categories.get(package, []))
        print(f"{i:<6} {package:<30} {format_size(git_size):<20} {file_count:<10}")
    
    # 保存结果到文件
    output_file = git_root / 'git_package_size_report.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("Git仓库包大小统计报告\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"统计时间: {subprocess.run(['date'], capture_output=True, text=True).stdout.strip()}\n")
        f.write(f"Git仓库: {git_root}\n")
        f.write(f"总文件数: {total_files}\n\n")
        
        f.write("完整统计结果:\n")
        f.write("-" * 80 + "\n")
        f.write(f"{'包/目录':<30} {'Git对象大小':<20} {'磁盘大小':<20} {'文件数':<10}\n")
        f.write("-" * 80 + "\n")
        
        for package, git_size in sorted_packages:
            disk_size = disk_sizes.get(package, 0)
            file_count = len(categories.get(package, []))
            f.write(f"{package:<30} {format_size(git_size):<20} {format_size(disk_size):<20} {file_count:<10}\n")
        
        f.write("-" * 80 + "\n")
        f.write(f"{'总计':<30} {format_size(total_git_size):<20} {format_size(total_disk_size):<20} {total_files:<10}\n")
    
    print(f"\n\n报告已保存到: {output_file}")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

