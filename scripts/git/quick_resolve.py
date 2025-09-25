#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git冲突快速解决脚本
简化版本，直接使用默认参数
"""

import sys
import os
from pathlib import Path

# 添加当前目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

from resolve_conflicts import GitConflictResolver

def main():
    print("🚀 Git冲突快速解决工具")
    print("📋 使用默认设置:")
    print("  - 扫描路径: ../../")
    print("  - 备份目录: ../../tmp/git_merge")
    print("  - 默认保留: 本地版本")
    print()
    
    # 询问用户确认
    choice = input("是否继续? (Y/n): ").strip().lower()
    if choice in ['n', 'no', '否']:
        print("❌ 用户取消操作")
        return
    
    try:
        resolver = GitConflictResolver()
        resolver.run(prefer_local=True, auto_resolve=False)
    except KeyboardInterrupt:
        print("\n⏹️  程序被用户中断")
    except Exception as e:
        print(f"❌ 程序运行出错: {e}")

if __name__ == '__main__':
    main()