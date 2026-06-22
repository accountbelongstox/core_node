#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提取最近使用图标脚本
从截图中提取最近使用相关的图标并复制重命名
"""

import sys
import os
import shutil
from pathlib import Path
from datetime import datetime

# 设置输出编码为 UTF-8
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 添加 icon_extractor 的路径
script_dir = Path(__file__).parent
project_root = script_dir.parent.parent.parent
icon_extractor_dir = project_root / "scripts" / "pytools" / "images_tools"

# 导入提取函数
sys.path.insert(0, str(icon_extractor_dir))
from icon_extractor import extract_icons_auto_detect

def main():
    # 输入图片路径
    input_image = Path(r"D:\programing\core_node\poly_apps\flutter_bloom\assets\apps\app_bank\images\recently_used_icons_source.png")
    
    if not input_image.exists():
        print(f"错误: 文件不存在: {input_image}")
        return
    
    # 创建临时输出目录
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_output_dir = input_image.parent / f"extracted_recently_used_icons_{timestamp}"
    temp_output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"开始提取图标...")
    print(f"输入文件: {input_image}")
    print(f"临时输出目录: {temp_output_dir}")
    print("=" * 60)
    
    # 提取图标（自动检测）
    try:
        extract_icons_auto_detect(
            input_image_path=str(input_image),
            output_dir=str(temp_output_dir),
            icon_names=None,
            threshold_percent=2,
            open_dir=False
        )
        print(f"\n✓ 图标提取完成")
    except Exception as e:
        print(f"✗ 提取图标时出错: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # 目标图标目录
    target_dir = input_image.parent
    print(f"\n目标目录: {target_dir}")
    
    # 图标映射：提取的图标索引 -> 目标文件名
    # 需要4个图标：建行客服、消息、卡面随心换、贷款
    icon_mapping = {
        0: "icon_recently_customer_service.png",  # 建行客服
        1: "icon_recently_message.png",           # 消息
        2: "icon_recently_card_change.png",       # 卡面随心换
        3: "icon_recently_loan.png",              # 贷款
    }
    
    # 获取提取的图标文件（按文件名排序）
    extracted_icons = sorted(temp_output_dir.glob("icon_*.png"))
    
    # 过滤出合理大小的图标（宽度和高度都在20-200像素之间）
    from PIL import Image
    valid_icons = []
    for icon_file in extracted_icons:
        try:
            img = Image.open(icon_file)
            width, height = img.size
            # 只保留合理大小的图标（不是误检测的大区域）
            if 20 <= width <= 200 and 20 <= height <= 200:
                valid_icons.append((icon_file, width * height))
        except Exception as e:
            print(f"警告: 无法读取 {icon_file.name}: {e}")
            continue
    
    # 按面积排序，选择最小的4个（通常是小图标）
    valid_icons.sort(key=lambda x: x[1])
    extracted_icons = [icon_file for icon_file, _ in valid_icons[:4]]
    
    if len(extracted_icons) < 4:
        print(f"\n警告: 只提取到 {len(extracted_icons)} 个有效图标，需要至少4个")
        print("请手动选择要使用的图标")
        print("\n提取的图标列表:")
        for i, icon_file in enumerate(extracted_icons):
            try:
                img = Image.open(icon_file)
                print(f"  {i}: {icon_file.name} ({img.size[0]}x{img.size[1]})")
            except:
                print(f"  {i}: {icon_file.name}")
        
        # 如果有效图标不足，使用所有提取的图标
        if len(extracted_icons) == 0:
            extracted_icons = sorted(temp_output_dir.glob("icon_*.png"))[:4]
            print(f"\n使用前4个提取的图标（可能较大）")
        
        if len(extracted_icons) < 4:
            print("错误: 图标数量不足")
            return
    
    # 自动使用前4个图标
    print(f"\n找到 {len(extracted_icons)} 个图标，使用前4个")
    for i in range(min(4, len(extracted_icons))):
        source_file = extracted_icons[i]
        target_file = target_dir / icon_mapping[i]
        shutil.copy2(source_file, target_file)
        try:
            img = Image.open(source_file)
            print(f"✓ 复制: {source_file.name} -> {target_file.name} ({img.size[0]}x{img.size[1]})")
        except:
            print(f"✓ 复制: {source_file.name} -> {target_file.name}")
    
    print("\n" + "=" * 60)
    print("图标提取和复制完成！")
    print(f"目标目录: {target_dir}")
    
    # 打开目标目录
    try:
        if sys.platform == "win32":
            os.startfile(str(target_dir))
        elif sys.platform == "darwin":
            os.system(f"open '{target_dir}'")
        else:
            os.system(f"xdg-open '{target_dir}'")
    except Exception as e:
        print(f"无法打开目录: {e}")

if __name__ == "__main__":
    main()
