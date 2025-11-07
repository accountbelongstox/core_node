"""
Utility functions for Installation Monitor
"""

import os
import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any


def create_timestamp_dir(base_path: Path, software_name: str = None) -> Path:
    """
    Create a directory with timestamp

    Args:
        base_path: Base directory path
        software_name: Optional software name

    Returns:
        Path to created directory
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if software_name:
        dir_name = f"{software_name}_{timestamp}"
    else:
        dir_name = f"monitor_{timestamp}"

    dir_path = base_path / dir_name
    dir_path.mkdir(parents=True, exist_ok=True)

    return dir_path


def should_skip_path(path: str, skip_patterns: List[str]) -> bool:
    """
    Check if a path should be skipped based on patterns

    Args:
        path: Path to check
        skip_patterns: List of patterns to skip

    Returns:
        True if path should be skipped
    """
    path_lower = path.lower()

    for pattern in skip_patterns:
        if pattern.lower() in path_lower:
            return True

    return False


def should_skip_first_level_directory(dir_name: str, skip_first_level_patterns: List[str], skip_dot_prefixed: bool = True) -> bool:
    """
    Check if a first-level directory should be skipped

    Args:
        dir_name: Directory name to check
        skip_first_level_patterns: List of patterns to skip for first level
        skip_dot_prefixed: Whether to skip dot-prefixed directories

    Returns:
        True if directory should be skipped
    """
    dir_name_lower = dir_name.lower()
    
    # Check against first-level skip patterns
    for pattern in skip_first_level_patterns:
        if pattern.lower() in dir_name_lower:
            return True
    
    # Check for dot-prefixed directories (first level only)
    if skip_dot_prefixed and dir_name.startswith('.'):
        return True
    
    return False


def should_skip_by_depth(current_depth: int, max_depth: int) -> bool:
    """
    Check if scanning should stop based on depth limit

    Args:
        current_depth: Current scanning depth
        max_depth: Maximum allowed depth (-1 for unlimited)

    Returns:
        True if should skip due to depth limit
    """
    if max_depth == -1:  # Unlimited depth
        return False
    return current_depth >= max_depth


def save_json(data: Any, file_path: Path) -> None:
    """
    Save data to JSON file

    Args:
        data: Data to save
        file_path: Path to save file
    """
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


def load_json(file_path: Path) -> Any:
    """
    Load data from JSON file

    Args:
        file_path: Path to JSON file

    Returns:
        Loaded data
    """
    if not file_path.exists():
        return None

    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_file_info(file_path: Path) -> Dict[str, Any]:
    """
    Get file information

    Args:
        file_path: Path to file

    Returns:
        Dictionary with file information
    """
    try:
        stat = file_path.stat()
        return {
            "path": str(file_path),
            "size": stat.st_size,
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "is_dir": file_path.is_dir()
        }
    except Exception as e:
        return {
            "path": str(file_path),
            "error": str(e)
        }


def copy_with_structure(src: Path, dest_base: Path) -> None:
    """
    Copy file/directory maintaining structure

    Args:
        src: Source path
        dest_base: Destination base path
    """
    try:
        dest = dest_base / src.relative_to(src.anchor)
        dest.parent.mkdir(parents=True, exist_ok=True)

        if src.is_file():
            shutil.copy2(src, dest)
        elif src.is_dir():
            shutil.copytree(src, dest, dirs_exist_ok=True)
    except Exception as e:
        print(f"Error copying {src}: {e}")


def format_size(size: int) -> str:
    """
    Format file size in human-readable format

    Args:
        size: Size in bytes

    Returns:
        Formatted size string
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} PB"


def list_monitoring_sessions(base_path: Path) -> List[Dict[str, Any]]:
    """
    List all monitoring sessions

    Args:
        base_path: Base path containing monitoring results

    Returns:
        List of session information
    """
    if not base_path.exists():
        return []

    sessions = []

    for item in base_path.iterdir():
        if item.is_dir():
            info_file = item / "session_info.json"
            if info_file.exists():
                info = load_json(info_file)
                if info:
                    info['path'] = str(item)
                    sessions.append(info)
            else:
                # Create basic info from directory name
                sessions.append({
                    'name': item.name,
                    'path': str(item),
                    'timestamp': item.stat().st_ctime
                })

    # Sort by timestamp, newest first
    sessions.sort(key=lambda x: x.get('timestamp', 0), reverse=True)

    return sessions


def save_monitor_options(options: Dict[str, bool], cache_dir: Path) -> None:
    """
    Save monitoring options to cache
    
    Args:
        options: Dictionary of monitoring options
        cache_dir: Cache directory path
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    options_file = cache_dir / "monitor_options.json"
    
    # Convert BooleanVar objects to boolean values
    options_dict = {}
    for key, var in options.items():
        if hasattr(var, 'get'):
            options_dict[key] = var.get()
        else:
            options_dict[key] = var
    
    save_json(options_dict, options_file)


def load_monitor_options(cache_dir: Path) -> Dict[str, bool]:
    """
    Load monitoring options from cache
    
    Args:
        cache_dir: Cache directory path
        
    Returns:
        Dictionary of monitoring options
    """
    options_file = cache_dir / "monitor_options.json"
    
    if options_file.exists():
        return load_json(options_file) or {}
    
    return {}
