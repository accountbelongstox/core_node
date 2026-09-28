#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Update design_structure_auto_expand.py to English and rename directories
"""

from pathlib import Path
import re

# Translation mapping
TRANSLATIONS = {
    # Directory names
    "2_page_designs_cn": "2_page_designs_rough",
    "3_page_designs_en": "3_page_designs_detailed",

    # Chinese text to English
    "第一层：概念图（粗设计图）": "Layer 1: Concept Designs",
    "第二层：粗页面图（中文页面名）": "Layer 2: Rough Page Designs",
    "第三层：细页面图（英文页面名）": "Layer 3: Detailed Page Designs",
    "宏观架构和流程设计": "High-level architecture and flows",
    "页面级别设计": "Page-level layouts and wireframes",
    "详细设计与代码映射": "Detailed specs with code mapping",

    # File descriptions
    "概念设计层说明文档": "Concept design layer documentation",
    "架构概念图": "Architecture concept",
    "用户流程概念": "User flow concepts",
    "数据模型概念": "Data model concepts",
    "页面设计层说明文档": "Page design layer documentation",
    "细节设计层说明文档": "Detailed design layer documentation",

    # Example file names
    "示例_首页设计.md": "example_home_page_rough.md",
    "示例_个人中心设计.md": "example_profile_page_rough.md",

    # Common phrases
    "首页设计示例（可删除）": "Example: Home page rough design (can be deleted)",
    "个人中心设计示例（可删除）": "Example: Profile page rough design (can be deleted)",
    "示例：首页详细设计（可删除）": "Example: Home page detailed design (can be deleted)",
    "页面说明": "Page documentation",
    "UI元素映射": "UI element mapping",
    "详细设计规格": "Detailed design specifications",

    # Comments
    "# 是否需要 images/ 目录": "# Whether images/ directory is needed",
    "# 根目录不需要 images/，子目录需要": "# Root doesn't need images/, subdirs do",
    "# 子目录需要 images/": "# Subdirectories need images/",

    # Print messages
    "[AutoExpand] Created directory": "[AutoExpand] Created directory",
    "[AutoExpand] Created file": "[AutoExpand] Created file",
    "[AutoExpand] Updated file": "[AutoExpand] Updated file",
    "[AutoExpand] Design structure ensured for": "[AutoExpand] Design structure ensured for",
}


def update_file(file_path: Path):
    """Update file with English translations"""
    print(f"Updating: {file_path}")

    content = file_path.read_text(encoding='utf-8')

    # Apply translations
    for chinese, english in TRANSLATIONS.items():
        content = content.replace(chinese, english)

    # Save
    file_path.write_text(content, encoding='utf-8')
    print(f"Updated: {file_path}")


if __name__ == "__main__":
    script_dir = Path(__file__).parent
    target_file = script_dir / "design_structure_auto_expand.py"

    if target_file.exists():
        update_file(target_file)
        print("\nDone! Please review the changes.")
    else:
        print(f"File not found: {target_file}")
