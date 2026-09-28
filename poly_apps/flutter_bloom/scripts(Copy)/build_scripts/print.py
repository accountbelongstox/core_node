#!/usr/bin/env python3
"""
generate_tree_md.py

扫描目标目录，并在该目录下生成 TREE.md 文件，内容为目录树。
自动忽略：隐藏文件/目录、__pycache__、*.pyc、*.pyo、*.pyd。
"""

import os, sys, argparse
from pathlib import Path
from datetime import datetime

# 需要忽略的目录和扩展名
IGNORE_DIRS = {"__pycache__"}
IGNORE_EXTS = {".pyc", ".pyo", ".pyd"}

def tree_lines(path: Path, prefix: str = ""):
    # 排序：目录在前，文件在后，字母顺序
    entries = sorted(list(path.iterdir()), key=lambda p: (p.is_file(), p.name.lower()))
    # 过滤掉隐藏文件/目录 和不需要的目录/文件
    entries = [
        e for e in entries
        if not e.name.startswith(".")  # 跳过隐藏
        and not (e.is_dir() and e.name in IGNORE_DIRS)
        and not (e.is_file() and e.suffix in IGNORE_EXTS)
    ]

    count = len(entries)
    for idx, entry in enumerate(entries, start=1):
        connector = "└── " if idx == count else "├── "
        if entry.is_dir():
            yield f"{prefix}{connector}{entry.name}/"
            extension = "    " if idx == count else "│   "
            yield from tree_lines(entry, prefix + extension)
        else:
            yield f"{prefix}{connector}{entry.name}"

def write_tree_md(target: Path, output_name: str = "TREE.md"):
    md_path = target / output_name
    with md_path.open("w", encoding="utf-8") as f:
        f.write(f"# Directory tree for `{target}`\n\n")
        f.write(f"_Generated: {datetime.utcnow().isoformat()}Z_\n\n")
        f.write("```\n")
        f.write(f"{target.name}/\n")
        for line in tree_lines(target):
            f.write(line + "\n")
        f.write("```\n")
    return md_path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("target", nargs="?", default=".", help="要扫描的目录，默认为当前目录")
    args = parser.parse_args()
    target = Path(args.target).resolve()
    if not target.is_dir():
        print(f"ERROR: 目录不存在: {target}")
        sys.exit(1)
    md = write_tree_md(target)
    print(f"目录树已生成: {md}")

if __name__ == "__main__":
    main()
