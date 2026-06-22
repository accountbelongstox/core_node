#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重命名生活页面banner图片
"""

import sys
import os
import shutil
from pathlib import Path

# 设置输出编码为 UTF-8
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def main():
    # 源目录
    source_dir = Path(r"D:\programing\core_node\poly_apps\flutter_bloom\assets\apps\app_bank\images")
    
    # 文件映射
    file_mapping = [
        {
            'source': source_dir / "life_banner_source_1.png",
            'target': source_dir / "life_banner_1.png",
            'name': '生活页面Banner 1'
        },
        {
            'source': source_dir / "life_banner_source_2.png",
            'target': source_dir / "life_banner_2.png",
            'name': '生活页面Banner 2'
        },
    ]
    
    print(f"开始重命名banner图片...")
    print("=" * 60)
    
    success_count = 0
    error_count = 0
    
    for i, mapping in enumerate(file_mapping, 1):
        source = mapping['source']
        target = mapping['target']
        name = mapping['name']
        
        if not source.exists():
            print(f"✗ [{i}/2] 错误: 源文件不存在: {source}")
            error_count += 1
            continue
        
        try:
            # 如果目标文件已存在，先备份
            if target.exists():
                backup = target.with_suffix('.png.bak')
                shutil.copy2(target, backup)
                print(f"  → 已备份现有文件: {backup.name}")
            
            # 复制并重命名
            shutil.copy2(source, target)
            print(f"✓ [{i}/2] {name}: {source.name} → {target.name}")
            success_count += 1
            
        except Exception as e:
            print(f"✗ [{i}/2] 错误处理 {name}: {e}")
            error_count += 1
    
    print("\n" + "=" * 60)
    print(f"完成！成功: {success_count}, 失败: {error_count}")
    print(f"目标目录: {source_dir}")

if __name__ == "__main__":
    main()
