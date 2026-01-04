#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合并 docs/old_documents 目录中的过时文件
按主题分类整理到合并文档中
"""
import os
import sys
import io
from pathlib import Path
from datetime import datetime
import re

# 设置输出编码为UTF-8
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

ROOT_DIR = Path(__file__).parent.parent.parent
OLD_DOCS_DIR = ROOT_DIR / "docs" / "old_documents"
OUTPUT_FILE = ROOT_DIR / "docs" / "OLD_DOCUMENTS_MERGED.md"

# 文件分类规则
CATEGORIES = {
    "SCRCPY相关": [
        "SCRCPY", "scrcpy", "DUMMY_BYTE", "KEYFRAME", "VIDEO_DECODE", 
        "CONNECTION", "TUNNEL", "FORWARD", "DEADLOCK", "BUFFER"
    ],
    "启动和初始化": [
        "STARTUP", "BATCH_STARTUP", "CONCURRENT_STARTUP", "LAUNCHER", 
        "SINGLETON", "MODULE_LEVEL"
    ],
    "架构分析": [
        "ARCHITECTURE", "NCORE", "THREAD_BUS", "RPC", "FRAMEWORK"
    ],
    "API和接口": [
        "API", "BACKEND", "FRONTEND", "ALIGNMENT", "BRIDGE", "FORMAT"
    ],
    "平台和系统": [
        "PLATFORM", "UBUNTU", "TRAY", "GTK", "DBUS", "QT", "WEBENGINE", 
        "TITLEBAR", "WINDOW"
    ],
    "集成和迁移": [
        "INTEGRATION", "MIGRATION", "PYMATRIX", "PYCORE", "PYLAUNCHER",
        "EXPRESS_UTILS", "PNPM"
    ],
    "修复和问题": [
        "FIX", "ISSUE", "ERROR", "BUG", "PROBLEM", "DIAGNOSTIC", "DEBUG"
    ],
    "测试报告": [
        "TEST", "VERIFICATION", "REPORT", "RESULTS"
    ],
    "开发指南": [
        "GUIDE", "DEVELOPMENT", "IMPLEMENTATION", "COMPLETE", "SUMMARY",
        "CHANGES", "CLEANUP", "PHASE"
    ],
    "MCP相关": [
        "MCP", "CODEX", "CLAUDE", "STDIO", "CHROME"
    ],
    "其他": []  # 默认分类
}

def categorize_file(filename):
    """根据文件名分类"""
    filename_upper = filename.upper()
    for category, keywords in CATEGORIES.items():
        if category == "其他":
            continue
        for keyword in keywords:
            if keyword in filename_upper:
                return category
    return "其他"

def sanitize_for_markdown(content):
    """清理内容，确保Markdown格式正确"""
    # 移除可能的BOM
    if content.startswith('\ufeff'):
        content = content[1:]
    return content

def merge_documents():
    """合并所有文档"""
    if not OLD_DOCS_DIR.exists():
        print(f"目录不存在: {OLD_DOCS_DIR}")
        return
    
    # 按分类组织文件
    categorized_files = {}
    for file_path in sorted(OLD_DOCS_DIR.glob("*")):
        if file_path.is_file() and file_path.name != "_file_list.txt":
            category = categorize_file(file_path.name)
            if category not in categorized_files:
                categorized_files[category] = []
            categorized_files[category].append(file_path)
    
    # 生成合并文档
    output_lines = []
    output_lines.append("# 过时文档合并")
    output_lines.append("")
    output_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output_lines.append("")
    output_lines.append("本文档包含了 `docs/old_documents/` 目录下的所有过时文档，按主题分类整理。")
    output_lines.append("")
    output_lines.append("---")
    output_lines.append("")
    
    # 添加目录
    output_lines.append("## 目录")
    output_lines.append("")
    for category in sorted(categorized_files.keys()):
        file_count = len(categorized_files[category])
        output_lines.append(f"- [{category}](#{category.lower().replace(' ', '-')}) ({file_count} 个文件)")
    output_lines.append("")
    output_lines.append("---")
    output_lines.append("")
    
    # 按分类添加内容
    for category in sorted(categorized_files.keys()):
        files = categorized_files[category]
        output_lines.append(f"## {category}")
        output_lines.append("")
        output_lines.append(f"共 {len(files)} 个文件")
        output_lines.append("")
        
        for file_path in sorted(files):
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    content = sanitize_for_markdown(content)
                
                output_lines.append(f"### {file_path.name}")
                output_lines.append("")
                output_lines.append(f"**文件路径**: `{file_path.name}`")
                output_lines.append("")
                output_lines.append("---")
                output_lines.append("")
                output_lines.append(content)
                output_lines.append("")
                output_lines.append("---")
                output_lines.append("")
                
            except Exception as e:
                output_lines.append(f"### {file_path.name}")
                output_lines.append("")
                output_lines.append(f"**错误**: 无法读取文件 - {str(e)}")
                output_lines.append("")
                output_lines.append("---")
                output_lines.append("")
    
    # 写入输出文件
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write('\n'.join(output_lines))
        print(f"[SUCCESS] 合并完成: {OUTPUT_FILE}")
        print(f"   共处理 {sum(len(files) for files in categorized_files.values())} 个文件")
        for category, files in sorted(categorized_files.items()):
            print(f"   - {category}: {len(files)} 个文件")
    except Exception as e:
        print(f"[ERROR] 写入文件失败: {e}")

if __name__ == "__main__":
    merge_documents()

