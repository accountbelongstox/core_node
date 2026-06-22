#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提取订单图标脚本
从截图中提取订单相关的图标并复制重命名
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
    input_image = Path(r"D:\programing\core_node\poly_apps\flutter_bloom\assets\apps\app_bank\images\order_icons_source.png")
    
    if not input_image.exists():
        print(f"错误: 文件不存在: {input_image}")
        return
    
    # 创建临时输出目录
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_output_dir = input_image.parent / f"extracted_order_icons_{timestamp}"
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
    # 假设提取了3个图标，分别对应：缴费订单、生活订单、善融订单
    icon_mapping = {
        0: "icon_order_payment.png",      # 缴费订单
        1: "icon_order_life.png",         # 生活订单
        2: "icon_order_shanrong.png",     # 善融订单
    }
    
    # 获取提取的图标文件（按文件名排序）
    extracted_icons = sorted(temp_output_dir.glob("icon_*.png"))
    
    if len(extracted_icons) < 3:
        print(f"\n警告: 只提取到 {len(extracted_icons)} 个图标，需要至少3个")
        print("请手动选择要使用的图标")
        print("\n提取的图标列表:")
        for i, icon_file in enumerate(extracted_icons):
            print(f"  {i}: {icon_file.name}")
        
        # 询问用户选择
        print("\n请输入要使用的图标索引（用空格分隔，例如: 0 1 2）:")
        try:
            user_input = input().strip()
            selected_indices = [int(x) for x in user_input.split()]
            
            if len(selected_indices) < 3:
                print("错误: 需要至少3个图标")
                return
            
            # 使用用户选择的图标
            for i, icon_idx in enumerate(selected_indices[:3]):
                if icon_idx < len(extracted_icons):
                    source_file = extracted_icons[icon_idx]
                    target_file = target_dir / icon_mapping[i]
                    shutil.copy2(source_file, target_file)
                    print(f"✓ 复制: {source_file.name} -> {target_file.name}")
        except (ValueError, KeyboardInterrupt):
            print("\n操作已取消")
            return
    else:
        # 自动使用前3个图标
        print(f"\n找到 {len(extracted_icons)} 个图标，使用前3个")
        for i in range(3):
            source_file = extracted_icons[i]
            target_file = target_dir / icon_mapping[i]
            shutil.copy2(source_file, target_file)
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
