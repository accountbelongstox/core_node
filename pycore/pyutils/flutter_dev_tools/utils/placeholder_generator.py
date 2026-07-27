#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont
"""
Placeholder Image Generator - 占位图生成器

自动生成和管理设计图占位图：
- 当 images/ 目录为空时，生成占位图提醒开发者
- 当有实际图片时，自动清理占位图
- 在 Markdown 注释中保留占位图说明
"""

from pathlib import Path
from typing import List, Tuple, Optional

# Example image names by layer (not fixed "_placeholder.png")
EXAMPLE_IMAGE_NAMES = {
    "1_concept_designs": "example_architecture.png",
    "2_page_designs_rough": "example_home_wireframe.png",
    "3_page_designs_detailed": "example_mockup.png",
    "home_page": "example_home_mockup.png",
    "profile_page": "example_profile_mockup.png",
    "settings_page": "example_settings_mockup.png",
}

# Default example image name
DEFAULT_EXAMPLE_NAME = "example_design.png"

# Supported image formats
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


def get_example_image_name(directory_label: str) -> str:
    """
    Get example image name based on directory context

    Args:
        directory_label: Directory label (e.g., "1_concept_designs/images")

    Returns:
        Example image filename
    """
    # Extract layer or page name from label
    for key in EXAMPLE_IMAGE_NAMES:
        if key in directory_label:
            return EXAMPLE_IMAGE_NAMES[key]

    return DEFAULT_EXAMPLE_NAME


def is_example_image(filename: str) -> bool:
    """Check if filename is an example/placeholder image"""
    return filename.startswith("example_") and filename.endswith((".png", ".jpg", ".jpeg"))


def get_actual_images(images_dir: Path) -> List[Path]:
    """
    Get actual images in directory (excluding example placeholders)

    Args:
        images_dir: Images directory

    Returns:
        List of actual image files
    """
    if not images_dir.exists():
        return []

    actual_images = []
    for file_path in images_dir.iterdir():
        if (file_path.is_file()
            and file_path.suffix.lower() in IMAGE_EXTENSIONS
            and not is_example_image(file_path.name)):
            actual_images.append(file_path)

    return actual_images


def get_example_images(images_dir: Path) -> List[Path]:
    """Get all example placeholder images in directory"""
    if not images_dir.exists():
        return []

    return [
        f for f in images_dir.iterdir()
        if f.is_file() and is_example_image(f.name)
    ]


def remove_example_images(images_dir: Path) -> int:
    """
    Remove all example placeholder images

    Args:
        images_dir: Images directory

    Returns:
        Number of images removed
    """
    example_images = get_example_images(images_dir)
    removed_count = 0

    for img_path in example_images:
        try:
            img_path.unlink()
            print(f"[PlaceholderCleanup] Removed: {img_path}")
            removed_count += 1
        except Exception as e:
            print(f"[PlaceholderCleanup] Error removing {img_path}: {e}")

    return removed_count


def manage_placeholder(images_dir: Path, directory_label: str = "") -> bool:
    """
    Manage placeholder images: generate or cleanup

    Logic:
    - If directory is empty or only has examples -> Generate example image
    - If has actual images -> Remove example images

    Args:
        images_dir: Images directory
        directory_label: Directory label (for placeholder display)

    Returns:
        True if action was taken
    """
    # Ensure directory exists
    images_dir.mkdir(parents=True, exist_ok=True)

    # Get actual images
    actual_images = get_actual_images(images_dir)

    # Get example image name based on directory context
    example_name = get_example_image_name(directory_label)
    example_path = images_dir / example_name

    if len(actual_images) == 0:
        # No actual images, ensure example exists
        if not example_path.exists():
            label = directory_label or images_dir.name
            return generate_placeholder(example_path, label)
        return False  # Example already exists

    else:
        # Has actual images, remove all example images
        removed = remove_example_images(images_dir)
        return removed > 0


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

## Example Image Mechanism

- **Filename**: Example images (e.g., `example_architecture.png`, `example_mockup.png`)
- **Purpose**: Auto-generated when directory is empty to remind developers to add actual designs
- **Cleanup**: Auto-removed when actual images are added

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
    Get Markdown placeholder comment template

    Args:
        layer_name: Layer name

    Returns:
        Comment text
    """
    if "concept" in layer_name.lower():
        suggested_images = """     - architecture.png: Architecture diagram
     - user_flow.png: User flow diagram
     - data_model.png: Data model diagram"""
    elif "rough" in layer_name.lower():
        suggested_images = """     - page_name_v1.png: Page design v1
     - page_name_v2.png: Page design v2 (iteration)"""
    else:
        suggested_images = """     - wireframe.png: Wireframe
     - mockup.png: High-fidelity mockup
     - components.png: Component annotations"""

    return f"""<!-- Design images directory: images/
     Example images: Auto-generated when empty (e.g., example_architecture.png)
     Auto-removed when actual images are added

     Suggested images:
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
