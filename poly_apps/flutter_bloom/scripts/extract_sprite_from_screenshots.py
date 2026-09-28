#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能提取精灵图脚本
从截图文件中自动检测并提取精灵图
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
    # 输入图片目录
    input_dir = Path(r"D:\programing\core_node\poly_apps\flutter_bloom\assets\apps\app_bank\images")
    
    # 要处理的文件列表
    image_files = [
        "sprite_source_screenshot.png"
    ]
    
    # 创建带时间戳的输出目录
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_output_dir = input_dir / f"extracted_sprites_{timestamp}"
    base_output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"输出目录: {base_output_dir}")
    print("=" * 60)
    
    # 处理每个文件
    for image_file in image_files:
        input_path = input_dir / image_file
        
        if not input_path.exists():
            print(f"警告: 文件不存在: {input_path}")
            continue
        
        print(f"\n处理文件: {image_file}")
        print("-" * 60)
        
        # 为每个文件创建单独的输出目录
        image_file_path = Path(image_file)
        file_output_dir = base_output_dir / image_file_path.stem
        file_output_dir.mkdir(parents=True, exist_ok=True)
        
        # 提取精灵图
        try:
            extract_icons_auto_detect(
                input_image_path=str(input_path),
                output_dir=str(file_output_dir),
                icon_names=None,
                threshold_percent=2,
                open_dir=False  # 最后统一打开目录
            )
            print(f"✓ 完成: {image_file}")
        except Exception as e:
            print(f"✗ 错误处理 {image_file}: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print(f"所有文件处理完成！")
    print(f"输出目录: {base_output_dir}")
    
    # 打开输出目录
    try:
        import os
        if sys.platform == "win32":
            os.startfile(str(base_output_dir))
        elif sys.platform == "darwin":
            os.system(f"open '{base_output_dir}'")
        else:
            os.system(f"xdg-open '{base_output_dir}'")
    except Exception as e:
        print(f"无法打开目录: {e}")

if __name__ == "__main__":
    main()
