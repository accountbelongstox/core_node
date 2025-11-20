"""Path utility functions"""

from pathlib import Path

from pycore.pygvar import PROJECT_ROOT


def get_project_root() -> Path:
    """Get Flutter project root directory"""
    return Path(PROJECT_ROOT)


def get_apps_dir() -> Path:
    """Get Flutter apps directory"""
    return Path(PROJECT_ROOT) / "poly_apps" / "flutter_bloom" / "lib" / "apps"


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
