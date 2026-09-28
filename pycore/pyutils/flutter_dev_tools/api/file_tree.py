"""File tree generation for design documentation directories"""

from pathlib import Path
from typing import Dict, List, Any
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def build_file_tree(root_path: Path, relative_to: Path = None) -> Dict[str, Any]:
    """
    Build a complete file tree structure for a directory.

    Args:
        root_path: Root directory to scan
        relative_to: Base path for relative path calculation

    Returns:
        Tree structure dictionary
    """
    if relative_to is None:
        relative_to = root_path.parent

    if not root_path.exists():
        return {}

    def scan_directory(path: Path) -> Dict[str, Any]:
        """Recursively scan directory"""
        try:
            name = path.name
            rel_path = str(path.relative_to(relative_to)).replace("\\", "/")

            if path.is_file():
                return {
                    "name": name,
                    "type": "file",
                    "path": rel_path,
                    "size": path.stat().st_size,
                    "extension": path.suffix.lower()
                }
            elif path.is_dir():
                children = []
                try:
                    for item in sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                        if not item.name.startswith('.'):
                            child_node = scan_directory(item)
                            if child_node:
                                children.append(child_node)
                except PermissionError:
                    pass

                return {
                    "name": name,
                    "type": "folder",
                    "path": rel_path,
                    "children": children,
                    "childCount": len(children)
                }

            return None

        except Exception as e:
            ColorPrint.plain(f"[ERROR] Failed to scan {path}: {e}")
            return None

    tree = scan_directory(root_path)
    return tree if tree else {}


def get_file_info(file_path: Path) -> Dict[str, Any]:
    """Get detailed file information"""
    if not file_path.exists() or not file_path.is_file():
        return {}

    stat = file_path.stat()
    return {
        "name": file_path.name,
        "path": str(file_path),
        "size": stat.st_size,
        "extension": file_path.suffix.lower(),
        "modified": stat.st_mtime,
        "is_text": file_path.suffix.lower() in ['.md', '.txt', '.json', '.dart', '.yaml', '.yml']
    }
