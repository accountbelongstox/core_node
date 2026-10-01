#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Design Structure Auto Expand

Creates and maintains the three-layer design documentation tree:
1. Concept layer (1_concept_designs/)
2. Rough page layer (2_page_designs_rough/)
3. Detailed page layer (3_page_designs_detailed/)

Missing folders and files are created at startup; existing files are never overwritten.
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.time_utils import utc_now_iso
from pycore.pyutils.flutter_dev_tools.utils.placeholder_generator import (
    ensure_images_readme,
    get_markdown_placeholder_comment,
    manage_placeholder,
)


# ============================================================
# Design documentation structure
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
# Templates
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
|-- README.md                      # This file
|-- 1_concept_designs/             # Layer 1: Concept designs (high-level)
|-- 2_page_designs_rough/          # Layer 2: Rough page designs (wireframes)
|-- 3_page_designs_detailed/       # Layer 3: Detailed designs (specs + code mapping)
|-- backend_bridge/                # Backend integration docs
|-- feature_progress/              # Feature progress tracking
|-- flows/                         # Flow diagrams
|-- progress_logs/                 # Progress logs
`-- wireframes/                    # Wireframes
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
|-- README.md              # Page documentation
|-- pageview_map.json      # UI element mapping (connects to code)
`-- design_specs.md        # Detailed design specifications
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
        "last_updated": utc_now_iso(),
        "pages": {}
    }


# ============================================================
# Auto expansion
# ============================================================

def ensure_directory(path: Path) -> bool:
    """Create the directory when missing."""
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
        ColorPrint.plain(f"[AutoExpand] Created directory: {path}")
        return True
    return False


def ensure_file(path: Path, content: str, force: bool = False) -> bool:
    """Create the file when missing (or when force is set)."""
    if path.exists() and not force:
        return False
    action = "Updated" if path.exists() else "Created"
    path.write_text(content, encoding='utf-8')
    ColorPrint.plain(f"[AutoExpand] {action} file: {path}")
    return True


def expand_layer_directory(base_path: Path, layer_name: str, layer_config: Dict, app_name: str):
    """Expand one layer directory."""
    layer_path = base_path / layer_name
    ensure_directory(layer_path)

    readme_content = get_readme_template(layer_name, app_name)
    if readme_content:
        ensure_file(layer_path / "README.md", readme_content)

    if "files" in layer_config:
        for filename, description in layer_config["files"].items():
            file_path = layer_path / filename
            if not file_path.exists():
                template_content = get_file_template(filename, app_name)
                if template_content:
                    ensure_file(file_path, template_content)

    if layer_config.get("has_images", False):
        images_dir = layer_path / "images"
        manage_placeholder(images_dir, f"{layer_name}/images")
        ensure_images_readme(images_dir, layer_name)

    if "subdirs" in layer_config:
        for subdir_name, subdir_config in layer_config["subdirs"].items():
            subdir_path = layer_path / subdir_name
            ensure_directory(subdir_path)

            if "files" in subdir_config:
                for filename in subdir_config["files"]:
                    file_path = subdir_path / filename

                    if filename == "README.md":
                        content = get_readme_template("page_subdir", app_name)
                        content = content.replace("{{page_name}}", subdir_name)
                        content = content.replace("{{page_name_cn}}", "Example Page")
                        ensure_file(file_path, content)

                    elif filename == "design_specs.md":
                        content = get_file_template("design_specs.md", app_name)
                        content = content.replace("{{page_name}}", subdir_name)
                        ensure_file(file_path, content)

            if subdir_config.get("has_images", False):
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
        "**/\u793a\u4f8b_*.md",  # Old Chinese example files
        "**/_placeholder.png",  # Old fixed placeholder name
        "3_page_designs_detailed/*/pageview_map.json",  # Old page-level pageview_map.json (now use root level)
    ]

    # Remove deprecated directories
    for dir_name in deprecated_dirs:
        dir_path = base_dir / dir_name
        if dir_path.exists() and dir_path.is_dir():
            try:
                shutil.rmtree(dir_path)
            except OSError as e:
                ColorPrint.yellow(f"[Cleanup] Failed to remove deprecated directory: path={dir_path} error={e}")
                continue
            removed_items.append(str(dir_path))
            ColorPrint.plain(f"[Cleanup] Removed deprecated directory: {dir_path}")

    # Remove deprecated files
    for pattern in deprecated_file_patterns:
        for file_path in base_dir.glob(pattern):
            if file_path.is_file():
                try:
                    file_path.unlink()
                except OSError as e:
                    ColorPrint.yellow(f"[Cleanup] Failed to remove deprecated file: path={file_path} error={e}")
                    continue
                removed_items.append(str(file_path))
                ColorPrint.plain(f"[Cleanup] Removed deprecated file: {file_path}")

    return removed_items


def ensure_design_structure(app_name: str, base_dir: Optional[Path] = None) -> bool:
    """
    Ensure the design documentation structure is complete.

    Args:
        app_name: Application name (e.g. "app_main")
        base_dir: Design docs directory (resolved from app_name when None)

    Returns:
        True if structure was created/updated
    """
    if base_dir is None:
        script_dir = Path(__file__).parent.parent.parent.parent  # flutter_bloom/
        base_dir = script_dir / "lib" / "apps" / app_name / "design_docs_and_progress"

    if not base_dir.exists():
        ColorPrint.plain(f"[AutoExpand] Creating design_docs_and_progress for {app_name}...")
        base_dir.mkdir(parents=True, exist_ok=True)
    else:
        # Cleanup deprecated files if directory exists
        cleanup_deprecated_files(base_dir)

    # Create root README
    root_readme = get_readme_template("root", app_name)
    ensure_file(base_dir / "README.md", root_readme)

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
        ColorPrint.plain(f"[AutoExpand] Created pageview_map.json at root level")

    ColorPrint.plain(f"[AutoExpand] Design structure ensured for {app_name}")
    return True


def ensure_all_apps_design_structure(flutter_bloom_dir: Optional[Path] = None) -> Dict[str, bool]:
    """
    Ensure the design documentation structure for every app.

    Args:
        flutter_bloom_dir: flutter_bloom directory

    Returns:
        Dict mapping app_name to success status
    """
    if flutter_bloom_dir is None:
        script_dir = Path(__file__).parent.parent.parent.parent
        flutter_bloom_dir = script_dir

    apps_dir = flutter_bloom_dir / "lib" / "apps"

    if not apps_dir.exists():
        ColorPrint.plain(f"[AutoExpand] Apps directory not found: {apps_dir}")
        return {}

    results = {}
    for app_dir in apps_dir.iterdir():
        if app_dir.is_dir() and app_dir.name.startswith("app_"):
            app_name = app_dir.name
            try:
                results[app_name] = ensure_design_structure(app_name)
            except OSError as e:
                ColorPrint.red(f"[AutoExpand] Failed to expand design structure: app={app_name} error={e}")
                results[app_name] = False

    return results
