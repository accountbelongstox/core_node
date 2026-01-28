#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
移动并重命名生活服务图标
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
    source_dir = Path(r"D:\programing\core_node\poly_apps\flutter_bloom\assets\apps\app_bank\images\extracted_sprites_20260123_121819")
    
    # 目标目录
    target_dir = Path(r"D:\programing\core_node\poly_apps\flutter_bloom\assets\apps\app_bank\images")
    
    # 图标映射：按顺序对应10个服务
    # 第一行5个：手机话费、电费、医保码、低碳生活、电影演出
    # 第二行5个：智慧食堂、积分汇、党费、燃气费、水费
    icon_mapping = [
        # 第一个截图 (life_service_icons_source_1) - 第一行
        {
            'source': source_dir / "life_service_icons_source_1" / "icon_001.png",
            'target': target_dir / "service_phone_fee.png",
            'name': '手机话费'
        },
        {
            'source': source_dir / "life_service_icons_source_1" / "icon_002.png",
            'target': target_dir / "service_electric.png",
            'name': '电费'
        },
        {
            'source': source_dir / "life_service_icons_source_1" / "icon_003.png",
            'target': target_dir / "service_medical_code.png",
            'name': '医保码'
        },
        {
            'source': source_dir / "life_service_icons_source_1" / "icon_004.png",
            'target': target_dir / "service_low_carbon.png",
            'name': '低碳生活'
        },
        {
            'source': source_dir / "life_service_icons_source_1" / "icon_005.png",
            'target': target_dir / "service_movie.png",
            'name': '电影演出'
        },
        # 第二个截图 (life_service_icons_source_2) - 第二行
        {
            'source': source_dir / "life_service_icons_source_2" / "icon_001.png",
            'target': target_dir / "service_canteen.png",
            'name': '智慧食堂'
        },
        {
            'source': source_dir / "life_service_icons_source_2" / "icon_002.png",
            'target': target_dir / "service_points.png",
            'name': '积分汇'
        },
        {
            'source': source_dir / "life_service_icons_source_2" / "icon_003.png",
            'target': target_dir / "service_party_fee.png",
            'name': '党费'
        },
        {
            'source': source_dir / "life_service_icons_source_2" / "icon_004.png",
            'target': target_dir / "service_gas.png",
            'name': '燃气费'
        },
        {
            'source': source_dir / "life_service_icons_source_2" / "icon_005.png",
            'target': target_dir / "service_water.png",
            'name': '水费'
        },
    ]
    
    print(f"开始移动和重命名图标...")
    print("=" * 60)
    
    success_count = 0
    error_count = 0
    
    for i, mapping in enumerate(icon_mapping, 1):
        source = mapping['source']
        target = mapping['target']
        name = mapping['name']
        
        if not source.exists():
            print(f"✗ [{i}/10] 错误: 源文件不存在: {source}")
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
            print(f"✓ [{i}/10] {name}: {source.name} → {target.name}")
            success_count += 1
            
        except Exception as e:
            print(f"✗ [{i}/10] 错误处理 {name}: {e}")
            error_count += 1
    
    print("\n" + "=" * 60)
    print(f"完成！成功: {success_count}, 失败: {error_count}")
    print(f"目标目录: {target_dir}")

if __name__ == "__main__":
    main()
