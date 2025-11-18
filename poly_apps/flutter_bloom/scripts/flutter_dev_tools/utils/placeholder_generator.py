#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Placeholder Image Generator - 占位图生成器

自动生成和管理设计图占位图：
- 当 images/ 目录为空时，生成占位图提醒开发者
- 当有实际图片时，自动清理占位图
- 在 Markdown 注释中保留占位图说明
"""

from pathlib import Path
from typing import List, Tuple, Optional

# 占位图文件名
PLACEHOLDER_FILENAME = "_placeholder.png"

# 支持的图片格式
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'}


def generate_placeholder(
    image_path: Path,
    directory_name: str,
    size: Tuple[int, int] = (800, 600)
) -> bool:
    """
    生成占位图

    Args:
        image_path: 占位图保存路径
        directory_name: 目录名称（用于显示）
        size: 图片尺寸 (width, height)

    Returns:
        True if generated successfully
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        # 如果没有 PIL，生成一个简单的文本文件作为占位符
        print("[PlaceholderGen] PIL not available, creating text placeholder")
        image_path.parent.mkdir(parents=True, exist_ok=True)
        image_path.with_suffix('.txt').write_text(
            f"Placeholder for {directory_name}\n\n"
            f"Please place design images here.\n"
            f"This file will be auto-removed when actual images are added.\n",
            encoding='utf-8'
        )
        return True

    try:
        # 创建图片
        img = Image.new('RGB', size, color='#F0F0F0')
        draw = ImageDraw.Draw(img)

        # 准备文字内容
        text_lines = [
            "📐 Design Images Placeholder",
            "",
            f"Directory: {directory_name}",
            "",
            "Please place your design images here",
            "",
            "Supported formats: PNG, JPG, SVG, GIF",
            "",
            "⚠️ This placeholder will be auto-removed",
            "when actual images are added"
        ]

        # 尝试加载字体
        try:
            # 尝试使用系统字体（Windows）
            font_large = ImageFont.truetype("arial.ttf", 24)
            font_small = ImageFont.truetype("arial.ttf", 16)
        except:
            try:
                # 尝试使用默认字体
                font_large = ImageFont.load_default()
                font_small = ImageFont.load_default()
            except:
                font_large = None
                font_small = None

        # 计算文字位置（居中）
        y_offset = 100
        for i, line in enumerate(text_lines):
            # 选择字体
            font = font_large if i == 0 else font_small

            if font:
                # 获取文字边界框
                try:
                    bbox = draw.textbbox((0, 0), line, font=font)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                except:
                    # 旧版本 PIL
                    text_width, text_height = draw.textsize(line, font=font)
            else:
                # 没有字体，估算大小
                text_width = len(line) * 10
                text_height = 20

            x = (size[0] - text_width) // 2
            y = y_offset

            # 绘制文字
            color = '#333333' if i == 0 else '#666666'
            if font:
                draw.text((x, y), line, fill=color, font=font)
            else:
                draw.text((x, y), line, fill=color)

            y_offset += text_height + 10

        # 确保父目录存在
        image_path.parent.mkdir(parents=True, exist_ok=True)

        # 保存图片
        img.save(image_path, 'PNG')
        print(f"[PlaceholderGen] Generated: {image_path}")
        return True

    except Exception as e:
        print(f"[PlaceholderGen] Error generating placeholder: {e}")
        return False


def get_actual_images(images_dir: Path) -> List[Path]:
    """
    获取目录中的实际图片（排除占位图）

    Args:
        images_dir: 图片目录

    Returns:
        实际图片文件列表
    """
    if not images_dir.exists():
        return []

    actual_images = []
    for file_path in images_dir.iterdir():
        if (file_path.is_file()
            and file_path.suffix.lower() in IMAGE_EXTENSIONS
            and file_path.name != PLACEHOLDER_FILENAME):
            actual_images.append(file_path)

    return actual_images


def has_placeholder(images_dir: Path) -> bool:
    """检查是否存在占位图"""
    placeholder = images_dir / PLACEHOLDER_FILENAME
    return placeholder.exists()


def remove_placeholder(images_dir: Path) -> bool:
    """
    删除占位图

    Args:
        images_dir: 图片目录

    Returns:
        True if removed
    """
    placeholder = images_dir / PLACEHOLDER_FILENAME
    if placeholder.exists():
        try:
            placeholder.unlink()
            print(f"[PlaceholderCleanup] Removed: {placeholder}")
            return True
        except Exception as e:
            print(f"[PlaceholderCleanup] Error removing placeholder: {e}")
            return False
    return False


def manage_placeholder(images_dir: Path, directory_label: str = "") -> bool:
    """
    管理占位图：生成或清理

    逻辑：
    - 如果目录为空或只有占位图 -> 生成占位图
    - 如果有实际图片 -> 删除占位图

    Args:
        images_dir: 图片目录
        directory_label: 目录标签（用于占位图显示）

    Returns:
        True if action was taken
    """
    # 确保目录存在
    images_dir.mkdir(parents=True, exist_ok=True)

    # 获取实际图片
    actual_images = get_actual_images(images_dir)
    placeholder = images_dir / PLACEHOLDER_FILENAME

    if len(actual_images) == 0:
        # 无实际图片，确保占位图存在
        if not placeholder.exists():
            label = directory_label or images_dir.name
            return generate_placeholder(placeholder, label)
        return False  # 占位图已存在，无需操作

    else:
        # 有实际图片，删除占位图
        if placeholder.exists():
            return remove_placeholder(images_dir)
        return False  # 占位图不存在，无需操作


def ensure_images_readme(images_dir: Path, layer_name: str = "") -> bool:
    """
    确保 images/ 目录有 README.md 说明

    Args:
        images_dir: 图片目录
        layer_name: 层级名称（concept_designs, page_designs_cn, 等）

    Returns:
        True if created
    """
    readme_path = images_dir / "README.md"

    if readme_path.exists():
        return False

    # 生成 README 内容
    content = f"""# Images Directory

本目录用于存放设计图片。

## 占位图机制

- **文件名**: `{PLACEHOLDER_FILENAME}`
- **说明**: 当目录为空时自动生成，提醒开发者放置实际设计图
- **清理**: 当有实际图片时会自动删除

## 建议放置的图片

根据设计需求，可放置以下类型的图片：
"""

    # 根据层级添加建议
    if "concept" in layer_name.lower():
        content += """
- `architecture.png`: 架构图
- `user_flow.png`: 用户流程图
- `data_model.png`: 数据模型图
"""
    elif "page_designs_cn" in layer_name.lower():
        content += """
- `页面名_v1.png`: 页面设计图（版本1）
- `页面名_v2.png`: 页面设计图（版本2）
"""
    else:  # page_designs_en
        content += """
- `wireframe.png`: 线框图（低保真）
- `wireframe_mobile.png`: 移动端线框图
- `mockup.png`: 高保真效果图
- `mockup_dark.png`: 深色模式效果图
- `components.png`: 组件标注图
- `interaction_flow.png`: 交互流程图
"""

    content += f"""
## 命名规范

- 使用 `snake_case` 命名（英文目录）或直接中文命名（中文目录）
- 描述性名称
- 版本号用 `_v1`, `_v2` 后缀
- 设备/模式用下划线分隔（如 `_mobile`, `_dark`）

## 支持的格式

- PNG（推荐，支持透明背景）
- JPG/JPEG（照片级效果图）
- SVG（矢量图，可缩放）
- GIF（动图）

## 参考文档

完整规范请参考: `doc/DESIGN_IMAGES_PLACEMENT.md`
"""

    try:
        readme_path.write_text(content, encoding='utf-8')
        print(f"[ImagesREADME] Created: {readme_path}")
        return True
    except Exception as e:
        print(f"[ImagesREADME] Error creating README: {e}")
        return False


def get_markdown_placeholder_comment(layer_name: str = "") -> str:
    """
    获取 Markdown 中的占位图注释模板

    Args:
        layer_name: 层级名称

    Returns:
        注释文本
    """
    if "concept" in layer_name.lower():
        suggested_images = """     - architecture.png: 架构图
     - user_flow.png: 用户流程图
     - data_model.png: 数据模型图"""
    elif "page_designs_cn" in layer_name.lower():
        suggested_images = """     - 页面名_v1.png: 页面设计图
     - 页面名_v2.png: 迭代版本"""
    else:
        suggested_images = """     - wireframe.png: 线框图
     - mockup.png: 高保真效果图
     - components.png: 组件标注图"""

    return f"""<!-- 设计图片目录：images/
     占位图：{PLACEHOLDER_FILENAME}（当目录为空时自动生成，有实际图片时自动清理）

     建议放置的图片：
{suggested_images}
-->"""


# ============================================================
# CLI Interface
# ============================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        test_dir = Path(sys.argv[1])
        print(f"Testing placeholder management for: {test_dir}")
        manage_placeholder(test_dir, test_dir.name)
        ensure_images_readme(test_dir, test_dir.name)
    else:
        # 生成测试占位图
        test_path = Path("test_placeholder.png")
        generate_placeholder(test_path, "test_directory")
        print(f"Generated test placeholder: {test_path}")
