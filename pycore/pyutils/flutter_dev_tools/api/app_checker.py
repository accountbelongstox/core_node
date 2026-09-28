"""Application design documentation checker"""

from pathlib import Path
from typing import List, Dict, Any
import json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

DESIGN_DIR_NAME = "design_docs_and_progress"

REQUIRED_SUBDIRS = [
    "concept_notes",
    "wireframes",
    "flows",
    "final_designs",
    "progress_logs",
    "feature_progress",
    "backend_bridge",
]

PROGRESS_FILES = [
    ("progress_logs", "concept_progress.md"),
    ("progress_logs", "wireframe_progress.md"),
    ("progress_logs", "flow_progress.md"),
    ("progress_logs", "design_progress.md"),
    ("progress_logs", "ui_dev_progress.md"),
]

MAP_FILE = ("final_designs", "pageview_map.json")

PROGRESS_TEMPLATE = "# Progress Log\n\nDescribe progress milestones here.\n"

MAP_PLACEHOLDER = {
    "image_file": "",
    "page_key": "",
    "descriptions": {
        "purpose": "This file maps UI elements from design wireframes for Flutter implementation",
        "specifications": {
            "architecture": "Follow MVVM pattern: separate UI layer and Data layer with distinct responsibilities",
            "naming_conventions": {
                "widgets": "UpperCamelCase for widget classes",
                "variables": "lowerCamelCase for variables and functions",
                "files": "snake_case for files and folders",
                "constants": "UPPER_SNAKE_CASE for constants"
            },
            "ui_guidelines": {
                "responsive": "Ensure adaptive design for multiple screen sizes",
                "accessibility": "Support screen readers and semantic labels",
                "performance": "Use const constructors, avoid rebuilds, leverage Impeller rendering"
            },
            "documentation": "Clearly describe architectural decisions and design patterns for team onboarding"
        },
        "version": "2025",
        "reference": "https://docs.flutter.dev/app-architecture"
    },
    "elements": [
        {
            "type": "text",
            "text": "",
            "bbox": [0, 0, 0, 0],
            "color": "#000000",
            "notes": "Add details here"
        }
    ]
}


def list_apps(apps_dir: Path) -> List[Path]:
    """List all Flutter apps (directories starting with 'app_')"""
    if not apps_dir.exists():
        return []
    return sorted(
        p for p in apps_dir.iterdir()
        if p.is_dir() and p.name.startswith("app_")
    )


def has_child_directory(path: Path) -> bool:
    """Check if path has child directories"""
    if not path.exists():
        return False
    return any(child.is_dir() and not child.name.startswith('.') for child in path.iterdir())


def build_tree_structure(missing_items: List[str], base_path: str) -> Dict:
    """Build a tree structure from missing items for visualization"""
    tree = {"name": "design_docs_and_progress", "type": "folder", "children": {}}

    for item in missing_items:
        rel_path = item.replace(base_path, "").replace("\\", "/").strip("/")
        if not rel_path:
            continue

        parts = rel_path.split("/")
        current = tree["children"]

        for i, part in enumerate(parts):
            is_last = i == len(parts) - 1

            if part not in current:
                is_file = is_last and ("." in part or part.endswith(".md") or part.endswith(".json"))
                current[part] = {
                    "name": part,
                    "type": "file" if is_file else "folder",
                    "path": "/".join(parts[:i+1]),
                    "children": {} if not is_file else None
                }

            if not is_last:
                current = current[part]["children"]

    return tree


def check_app(app_path: Path) -> Dict[str, Any]:
    """Check an app's design documentation structure"""
    issues: List[str] = []
    missing: List[str] = []
    design_dir = app_path / DESIGN_DIR_NAME

    if not design_dir.exists():
        issues.append(f"missing directory: {DESIGN_DIR_NAME}")
        missing.append(str(design_dir))
        tree = build_tree_structure(missing, str(design_dir.parent))
        return {
            "app": app_path.name,
            "design_path": str(design_dir),
            "issues": issues,
            "missing": missing,
            "tree": tree,
            "has_design_dir": False,
        }

    for sub in REQUIRED_SUBDIRS:
        sub_path = design_dir / sub
        if not sub_path.exists():
            issues.append(f"missing subdirectory: {DESIGN_DIR_NAME}/{sub}")
            missing.append(str(sub_path))

    for parent, filename in PROGRESS_FILES:
        parent_path = design_dir / parent
        if parent_path.exists():
            file_path = parent_path / filename
            if not file_path.exists():
                issues.append(f"missing progress file: {DESIGN_DIR_NAME}/{parent}/{filename}")
                missing.append(str(file_path))
        else:
            issues.append(f"missing progress directory: {DESIGN_DIR_NAME}/{parent}")
            missing.append(str(parent_path))

    map_parent, map_name = MAP_FILE
    map_path = design_dir / map_parent / map_name
    if not map_path.exists():
        issues.append(f"missing OCR map: {DESIGN_DIR_NAME}/{map_parent}/{map_name}")
        missing.append(str(map_path))

    func_dir = design_dir / "feature_progress"
    backend_dir = design_dir / "backend_bridge"
    if func_dir.exists() and not has_child_directory(func_dir):
        issues.append("feature_progress folder should contain at least one module subdirectory")
        missing.append(str(func_dir / "sample_module"))
    if backend_dir.exists() and not has_child_directory(backend_dir):
        issues.append("backend_bridge folder should contain subsystem subdirectories")
        missing.append(str(backend_dir / "sample_bridge"))

    tree = build_tree_structure(missing, str(design_dir.parent))

    return {
        "app": app_path.name,
        "design_path": str(design_dir),
        "issues": issues,
        "missing": missing,
        "tree": tree,
        "has_design_dir": design_dir.exists(),
    }


def update_pageview_map_descriptions(map_path: Path) -> bool:
    """
    Update pageview_map.json with latest descriptions field.
    Preserves existing content, only updates/adds descriptions.

    Returns:
        True if updated, False if no update needed or error
    """
    if not map_path.exists():
        return False

    try:
        # Read existing content
        content = json.loads(map_path.read_text(encoding='utf-8'))

        # Check if descriptions need update
        current_descriptions = content.get('descriptions', {})
        target_descriptions = MAP_PLACEHOLDER['descriptions']

        # Update descriptions if different
        if current_descriptions != target_descriptions:
            content['descriptions'] = target_descriptions
            map_path.write_text(json.dumps(content, indent=2, ensure_ascii=False), encoding='utf-8')
            ColorPrint.plain(f"[UPDATED] pageview_map.json descriptions: {map_path.parent.name}")
            return True

        return False

    except Exception as e:
        ColorPrint.plain(f"[ERROR] Failed to update {map_path}: {e}")
        return False


def create_missing_items(app_path: Path) -> List[str]:
    """
    Create missing design documentation structure for an app.

    IMPORTANT: This function NEVER overwrites existing files or directories.
    All creation operations use exist_ok=True for directories and
    check file existence before writing for files.
    """
    created: List[str] = []
    design_dir = app_path / DESIGN_DIR_NAME

    # Create main design directory if missing
    if not design_dir.exists():
        design_dir.mkdir(parents=True, exist_ok=True)
        created.append(str(design_dir))

    # Create required subdirectories (NEVER overwrites existing)
    for sub in REQUIRED_SUBDIRS:
        sub_path = design_dir / sub
        if not sub_path.exists():
            sub_path.mkdir(parents=True, exist_ok=True)
            created.append(str(sub_path))

    # Create progress files (NEVER overwrites existing)
    for parent, filename in PROGRESS_FILES:
        parent_path = design_dir / parent
        parent_path.mkdir(parents=True, exist_ok=True)
        file_path = parent_path / filename

        # CRITICAL: Only write if file does NOT exist
        if not file_path.exists():
            file_path.write_text(PROGRESS_TEMPLATE, encoding="utf-8")
            created.append(str(file_path))

    # Create OCR map file (NEVER overwrites existing)
    map_parent, map_name = MAP_FILE
    map_parent_path = design_dir / map_parent
    map_parent_path.mkdir(parents=True, exist_ok=True)
    map_path = map_parent_path / map_name

    # CRITICAL: Only write if file does NOT exist
    if not map_path.exists():
        map_path.write_text(json.dumps(MAP_PLACEHOLDER, indent=2, ensure_ascii=False), encoding="utf-8")
        created.append(str(map_path))
    else:
        # Update descriptions if file exists
        if update_pageview_map_descriptions(map_path):
            created.append(f"{map_path} (descriptions updated)")

    # Create sample feature module if none exist (NEVER overwrites existing)
    feature_dir = design_dir / "feature_progress"
    if not has_child_directory(feature_dir):
        sample_module = feature_dir / "sample_module"
        sample_module.mkdir(parents=True, exist_ok=True)
        progress_file = sample_module / "progress.md"

        # CRITICAL: Only write if file does NOT exist
        if not progress_file.exists():
            progress_file.write_text(PROGRESS_TEMPLATE, encoding="utf-8")
            created.append(str(progress_file))

        if str(sample_module) not in created:
            created.append(str(sample_module))

    # Create sample backend bridge if none exist (NEVER overwrites existing)
    backend_dir = design_dir / "backend_bridge"
    if not has_child_directory(backend_dir):
        sample_bridge = backend_dir / "sample_bridge"
        sample_bridge.mkdir(parents=True, exist_ok=True)
        progress_file = sample_bridge / "progress.md"

        # CRITICAL: Only write if file does NOT exist
        if not progress_file.exists():
            progress_file.write_text(PROGRESS_TEMPLATE, encoding="utf-8")
            created.append(str(progress_file))

        if str(sample_bridge) not in created:
            created.append(str(sample_bridge))

    return created


def auto_initialize_all_apps(apps_dir: Path) -> Dict[str, any]:
    """
    Auto-initialize design structure for all apps on startup.
    Creates missing directories and files, skips existing ones.

    Returns:
        Summary dictionary with statistics
    """
    ColorPrint.plain("\n" + "=" * 60)
    ColorPrint.plain("AUTO-INITIALIZATION: Design Documentation Structure")
    ColorPrint.plain("=" * 60)

    apps = list_apps(apps_dir)
    total_apps = len(apps)
    apps_created = 0
    files_created = 0
    files_updated = 0

    for app in apps:
        ColorPrint.plain(f"\n[STEP] Processing: {app.name}")

        created = create_missing_items(app)

        if created:
            apps_created += 1
            for item in created:
                if "updated" in str(item).lower():
                    files_updated += 1
                else:
                    files_created += 1
            ColorPrint.plain(f"  [OK] Created/Updated {len(created)} items")
        else:
            ColorPrint.plain(f"  [OK] All items exist")

    ColorPrint.plain("\n" + "=" * 60)
    ColorPrint.plain(f"SUMMARY: {total_apps} apps processed")
    ColorPrint.plain(f"  - Apps with changes: {apps_created}")
    ColorPrint.plain(f"  - Files created: {files_created}")
    ColorPrint.plain(f"  - Files updated: {files_updated}")
    ColorPrint.plain("=" * 60 + "\n")

    return {
        "total_apps": total_apps,
        "apps_created": apps_created,
        "files_created": files_created,
        "files_updated": files_updated
    }
