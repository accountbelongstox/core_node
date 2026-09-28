#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Design Structure Auto Expand - 设计文档结构自动扩展

自动创建和维护三层设计文档体系：
1. 概念图层 (1_concept_designs/)
2. 粗页面图层 (2_page_designs_rough/)
3. 细页面图层 (3_page_designs_detailed/)

功能：
- 启动时检查并创建缺失的文件夹和文件
- 跳过已存在的文件（不覆盖）
- 为每个文件夹生成 README.md 模板
- 更新必要的元数据字段
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Import placeholder generator
try:
    from .placeholder_generator import (
        manage_placeholder,
        ensure_images_readme,
        get_markdown_placeholder_comment
    )
    PLACEHOLDER_AVAILABLE = True
except ImportError:
    PLACEHOLDER_AVAILABLE = False
    print("[Warning] placeholder_generator not available")


# ============================================================
# 设计文档结构定义
# ============================================================

DESIGN_STRUCTURE = {
    "1_concept_designs": {
        "description": "Layer 1: Concept Designs - High-level architecture and flows",
        "has_images": True,
        "files": {
            "README.md": "Concept design layer documentation",
            "architecture.md": "Architecture concept",
            "user_flows.md": "User flow concepts",
            "data_model.md": "Data model concepts"
        }
    },
    "2_page_designs_rough": {
        "description": "Layer 2: Rough Page Designs - Page-level layouts and wireframes",
        "has_images": True,
        "files": {
            "README.md": "Rough page design layer documentation",
            "example_home_page_rough.md": "Example: Home page rough design (can be deleted)",
            "example_profile_page_rough.md": "Example: Profile page rough design (can be deleted)"
        }
    },
    "3_page_designs_detailed": {
        "description": "Layer 3: Detailed Page Designs - Detailed specs with code mapping",
        "has_images": False,
        "subdirs": {
            "example_home_page": {
                "description": "Example: Home page detailed design (can be deleted)",
                "has_images": True,
                "files": {
                    "README.md": "Page documentation",
                    "pageview_map.json": "UI element mapping",
                    "design_specs.md": "Detailed design specifications"
                }
            }
        },
        "files": {
            "README.md": "Detailed design layer documentation"
        }
    }
}


# ============================================================
# 模板内容
# ============================================================

def get_readme_template(layer: str, app_name: str) -> str:
    """Get README template content"""
    timestamp = datetime.now().strftime("%Y-%m-%d")

    templates = {
        "root": f"""# Design Docs & Progress - {app_name}

**Application**: {app_name}
**Created**: {timestamp}
**Last Updated**: {timestamp}

## Directory Structure

```
design_docs_and_progress/
├── README.md                      # This file
├── 1_concept_designs/             # Layer 1: Concept designs (high-level)
├── 2_page_designs_rough/          # Layer 2: Rough page designs (wireframes)
├── 3_page_designs_detailed/       # Layer 3: Detailed designs (specs + code mapping)
├── backend_bridge/                # Backend integration docs
├── feature_progress/              # Feature progress tracking
├── flows/                         # Flow diagrams
├── progress_logs/                 # Progress logs
└── wireframes/                    # Wireframes
```

## Three-Layer Design System

### Layer 1: Concept Designs (1_concept_designs/)
- **Purpose**: High-level architecture and concepts
- **Content**: Architecture diagrams, user flows, data models

### Layer 2: Rough Page Designs (2_page_designs_rough/)
- **Purpose**: Page-level layouts and wireframes
- **Content**: Page functions, layout sketches, interaction notes

### Layer 3: Detailed Page Designs (3_page_designs_detailed/)
- **Purpose**: Detailed specs with code mapping
- **Content**: pageview_map.json, detailed specifications

## Workflow

1. **Concept Phase**: Create architecture designs in `1_concept_designs/`
2. **Page Design**: Design page layouts in `2_page_designs_rough/`
3. **Detailed Design**: Create detailed specs in `3_page_designs_detailed/`
4. **Development**: Implement components based on pageview_map.json

## Reference

Full documentation: `doc/DESIGN_DOCS_STRUCTURE.md`
""",

        "1_concept_designs": f"""# Concept Designs - {app_name}

**Layer**: Layer 1 - Concept Designs
**Purpose**: High-level architecture and concepts, no page-specific details

## Files

- `architecture.md`: Overall architecture design (MVVM, data flow, etc.)
- `user_flows.md`: User flow diagrams
- `data_model.md`: Data model design

## Design Principles

1. **Clear Architecture**: Well-defined layers and responsibilities
2. **Extensibility**: Design for future growth
3. **Performance**: Consider optimization strategies

## Updates

- {timestamp}: Initialized concept design layer
""",

        "2_page_designs_rough": f"""# Rough Page Designs - {app_name}

**Layer**: Layer 2 - Rough Page Designs
**Purpose**: Page-level layouts and wireframes

## Page List

(Add page design files here)

Examples:
- `example_home_page_rough.md` - App home page
- `example_profile_page_rough.md` - User profile
- `example_settings_page_rough.md` - App settings

## Design Template

Each page design file should include:
1. Page function description
2. Layout structure
3. Main interactions
4. Corresponding detailed page name (for Layer 3)

## Updates

- {timestamp}: Initialized rough page design layer
""",

        "3_page_designs_detailed": f"""# Detailed Page Designs - {app_name}

**Layer**: Layer 3 - Detailed Page Designs
**Purpose**: Detailed specifications with code mapping

## Page Directories

(Add detailed page design directories here)

Examples:
- `home_page/` - Home page
- `profile_page/` - User profile
- `settings_page/` - Settings page

## Directory Structure

Each page directory contains:
```
page_name/
├── README.md              # Page documentation
├── pageview_map.json      # UI element mapping (connects to code)
└── design_specs.md        # Detailed design specifications
```

## pageview_map.json

Maps design elements to Flutter Widgets. See `example_home_page/pageview_map.json` for format.

## Updates

- {timestamp}: Initialized detailed design layer
""",

        "page_subdir": f"""# {{page_name}} - Page Design

**Page Name**: {{page_name}}
**Created**: {timestamp}

## Overview

(Fill in page function description)

## Files

- `README.md`: This file
- `pageview_map.json`: UI element mapping (connects to Flutter code)
- `design_specs.md`: Detailed design specs (colors, fonts, spacing, etc.)

## Development Status

- [ ] Design complete
- [ ] UI implementation
- [ ] Feature implementation
- [ ] Testing complete

## Updates

- {timestamp}: Initialized page design
"""
    }

    return templates.get(layer, "")


def get_file_template(filename: str, app_name: str) -> str:
    """Get file template content - Leave all files empty"""
    # All template files should be created empty
    # Users will fill them with actual content
    return ""


def get_pageview_map_template(app_name: str) -> Dict:
    """
    Get pageview_map.json template (v2.0 - single file for entire app)

    NOTE: pageview_map.json is now placed at design_docs_and_progress root,
    NOT in individual page directories
    """
    return {
        "version": "2.0",
        "app_name": app_name,
        "last_updated": datetime.now().isoformat(),
        "pages": {}
    }


# ============================================================
# 自动扩展功能
# ============================================================

def ensure_directory(path: Path) -> bool:
    """确保目录存在，不存在则创建"""
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
        print(f"[AutoExpand] Created directory: {path}")
        return True
    return False


def ensure_file(path: Path, content: str, force: bool = False) -> bool:
    """确保文件存在，不存在则创建"""
    if not path.exists() or force:
        path.write_text(content, encoding='utf-8')
        action = "Created" if not path.exists() else "Updated"
        print(f"[AutoExpand] {action} file: {path}")
        return True
    return False


def expand_layer_directory(base_path: Path, layer_name: str, layer_config: Dict, app_name: str):
    """扩展单个层级目录"""
    layer_path = base_path / layer_name
    ensure_directory(layer_path)

    # 创建层级说明文件
    readme_content = get_readme_template(layer_name, app_name)
    if readme_content:
        ensure_file(layer_path / "README.md", readme_content)

    # 创建层级中的文件
    if "files" in layer_config:
        for filename, description in layer_config["files"].items():
            file_path = layer_path / filename
            if not file_path.exists():
                template_content = get_file_template(filename, app_name)
                if template_content:
                    ensure_file(file_path, template_content)

    # 管理 images/ 目录和占位图
    if layer_config.get("has_images", False) and PLACEHOLDER_AVAILABLE:
        images_dir = layer_path / "images"
        manage_placeholder(images_dir, f"{layer_name}/images")
        ensure_images_readme(images_dir, layer_name)

    # 创建子目录（用于第三层）
    if "subdirs" in layer_config:
        for subdir_name, subdir_config in layer_config["subdirs"].items():
            subdir_path = layer_path / subdir_name
            ensure_directory(subdir_path)

            # 创建子目录中的文件
            if "files" in subdir_config:
                for filename in subdir_config["files"]:
                    file_path = subdir_path / filename

                    if filename == "README.md":
                        content = get_readme_template("page_subdir", app_name)
                        content = content.replace("{{page_name}}", subdir_name)
                        content = content.replace("{{page_name_cn}}", "示例页面")
                        ensure_file(file_path, content)

                    elif filename == "pageview_map.json":
                        # SKIP: pageview_map.json is now created at root level only
                        # Individual page directories no longer have their own pageview_map.json
                        pass

                    elif filename == "design_specs.md":
                        content = get_file_template("design_specs.md", app_name)
                        content = content.replace("{{page_name}}", subdir_name)
                        ensure_file(file_path, content)

            # 管理子目录的 images/ 和占位图
            if subdir_config.get("has_images", False) and PLACEHOLDER_AVAILABLE:
                images_dir = subdir_path / "images"
                manage_placeholder(images_dir, f"{layer_name}/{subdir_name}/images")
                ensure_images_readme(images_dir, layer_name)


def cleanup_deprecated_files(base_dir: Path) -> List[str]:
    """
    Remove deprecated files and directories

    Args:
        base_dir: Design docs base directory

    Returns:
        List of removed items
    """
    removed_items = []

    # Deprecated directory names (old naming scheme)
    deprecated_dirs = [
        "2_page_designs_cn",  # Renamed to 2_page_designs_rough
        "3_page_designs_en",  # Renamed to 3_page_designs_detailed
    ]

    # Deprecated file patterns
    deprecated_file_patterns = [
        "**/示例_*.md",  # Old Chinese example files
        "**/_placeholder.png",  # Old fixed placeholder name
        "3_page_designs_detailed/*/pageview_map.json",  # Old page-level pageview_map.json (now use root level)
    ]

    # Remove deprecated directories
    for dir_name in deprecated_dirs:
        dir_path = base_dir / dir_name
        if dir_path.exists() and dir_path.is_dir():
            try:
                import shutil
                shutil.rmtree(dir_path)
                removed_items.append(str(dir_path))
                print(f"[Cleanup] Removed deprecated directory: {dir_path}")
            except Exception as e:
                print(f"[Cleanup] Error removing {dir_path}: {e}")

    # Remove deprecated files
    for pattern in deprecated_file_patterns:
        for file_path in base_dir.glob(pattern):
            if file_path.is_file():
                try:
                    file_path.unlink()
                    removed_items.append(str(file_path))
                    print(f"[Cleanup] Removed deprecated file: {file_path}")
                except Exception as e:
                    print(f"[Cleanup] Error removing {file_path}: {e}")

    return removed_items


def ensure_design_structure(app_name: str, base_dir: Optional[Path] = None) -> bool:
    """
    确保设计文档结构完整

    Args:
        app_name: 应用名称（如 "app_main"）
        base_dir: 基础目录（如果为None，自动查找）

    Returns:
        True if structure was created/updated
    """
    # 确定基础路径
    if base_dir is None:
        # 从 scripts/flutter_dev_tools/utils/ 向上找到 flutter_bloom/
        script_dir = Path(__file__).parent.parent.parent.parent  # flutter_bloom/
        base_dir = script_dir / "lib" / "apps" / app_name / "design_docs_and_progress"

    if not base_dir.exists():
        print(f"[AutoExpand] Creating design_docs_and_progress for {app_name}...")
        base_dir.mkdir(parents=True, exist_ok=True)
    else:
        # Cleanup deprecated files if directory exists
        cleanup_deprecated_files(base_dir)

    # Create root README
    root_readme = get_readme_template("root", app_name)
    ensure_file(base_dir / "README.md", root_readme)

    # 扩展三层目录
    for layer_name, layer_config in DESIGN_STRUCTURE.items():
        expand_layer_directory(base_dir, layer_name, layer_config, app_name)

    # Create root-level pageview_map.json (v2.0 - single file for all pages)
    pageview_map_path = base_dir / "pageview_map.json"
    if not pageview_map_path.exists():
        pageview_map_content = get_pageview_map_template(app_name)
        ensure_file(
            pageview_map_path,
            json.dumps(pageview_map_content, indent=2, ensure_ascii=False)
        )
        print(f"[AutoExpand] Created pageview_map.json at root level")

    print(f"[AutoExpand] Design structure ensured for {app_name}")
    return True


def ensure_all_apps_design_structure(flutter_bloom_dir: Optional[Path] = None) -> Dict[str, bool]:
    """
    为所有应用确保设计文档结构

    Args:
        flutter_bloom_dir: flutter_bloom 目录路径

    Returns:
        Dict mapping app_name to success status
    """
    if flutter_bloom_dir is None:
        # 从 scripts/flutter_dev_tools/utils/ 向上找到 flutter_bloom/
        script_dir = Path(__file__).parent.parent.parent.parent
        flutter_bloom_dir = script_dir

    apps_dir = flutter_bloom_dir / "lib" / "apps"

    if not apps_dir.exists():
        print(f"[AutoExpand] Apps directory not found: {apps_dir}")
        return {}

    results = {}
    for app_dir in apps_dir.iterdir():
        if app_dir.is_dir() and app_dir.name.startswith("app_"):
            app_name = app_dir.name
            try:
                results[app_name] = ensure_design_structure(app_name)
            except Exception as e:
                print(f"[AutoExpand] Error expanding {app_name}: {e}")
                results[app_name] = False

    return results


# ============================================================
# CLI Interface
# ============================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        app_name = sys.argv[1]
        ensure_design_structure(app_name)
    else:
        # 扩展所有应用
        results = ensure_all_apps_design_structure()
        print(f"\n[AutoExpand] Summary:")
        for app, success in results.items():
            status = "✓" if success else "✗"
            print(f"  {status} {app}")
