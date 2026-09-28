#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从截图中提取快速操作图标
提取账户明细、转账汇款、财富体检三个图标
"""

import sys
import os
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
    # 输入图片路径 - 请根据实际路径修改
    # 可以放在桌面或项目目录中
    screenshot_name = "ScreenShot_2026-01-25_144839_527.png"
    
    # 尝试多个可能的路径
    possible_paths = [
        Path.home() / "Desktop" / screenshot_name,
        Path.home() / "Downloads" / screenshot_name,
        Path(r"D:\programing\core_node\poly_apps\flutter_bloom\assets\apps\app_bank\images") / screenshot_name,
        Path.cwd() / screenshot_name,
    ]
    
    input_path = None
    for path in possible_paths:
        if path.exists():
            input_path = path
            break
    
    if not input_path:
        print(f"错误: 找不到截图文件 {screenshot_name}")
        print("请将截图文件放在以下位置之一:")
        for path in possible_paths:
            print(f"  - {path}")
        return
    
    print(f"找到截图文件: {input_path}")
    
    # 输出目录
    output_dir = Path(r"D:\programing\core_node\poly_apps\flutter_bloom\assets\apps\app_bank\images")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_output_dir = output_dir / f"extracted_quick_action_icons_{timestamp}"
    base_output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"输出目录: {base_output_dir}")
    print("=" * 60)
    
    # 图标名称（按从左到右的顺序）
    icon_names = [
        "account_details",      # 账户明细
        "transfer_remittance",   # 转账汇款
        "wealth_checkup",        # 财富体检
    ]
    
    # 提取图标
    try:
        extract_icons_auto_detect(
            input_image_path=str(input_path),
            output_dir=str(base_output_dir),
            icon_names=icon_names,
            threshold_percent=2,
            open_dir=True
        )
        print(f"✓ 完成提取")
        print(f"\n提取的图标:")
        for i, name in enumerate(icon_names, 1):
            print(f"  {i}. {name}.png -> 账户明细/转账汇款/财富体检")
    except Exception as e:
        print(f"✗ 错误: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print(f"输出目录: {base_output_dir}")

if __name__ == "__main__":
    main()
