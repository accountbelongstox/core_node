"""Path utility functions"""

from pathlib import Path
from typing import Optional


def get_project_root() -> Path:
    """Get Flutter project root directory"""
    script_dir = Path(__file__).resolve().parent.parent
    project_root = (script_dir / "../../../..").resolve()
    return project_root


def get_apps_dir() -> Path:
    """Get Flutter apps directory"""
    return get_project_root() / "poly_apps" / "flutter_bloom" / "lib" / "apps"


def get_design_dir(app_path: Path) -> Path:
    """Get design docs directory for an app"""
    return app_path / "design_docs_and_progress"


def is_safe_path(base_path: Path, target_path: Path) -> bool:
    """Check if target path is within base path (prevent directory traversal)"""
    try:
        target_resolved = target_path.resolve()
        base_resolved = base_path.resolve()
        return str(target_resolved).startswith(str(base_resolved))
    except Exception:
        return False
