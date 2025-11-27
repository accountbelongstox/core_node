"""File content reading API"""

from pathlib import Path
from typing import Dict, Any


def read_file_content(file_path: Path, max_size: int = 1024 * 1024) -> Dict[str, Any]:
    """
    Read file content safely.

    Args:
        file_path: Path to file
        max_size: Maximum file size to read (default 1MB)

    Returns:
        Dictionary with content and metadata
    """
    if not file_path.exists() or not file_path.is_file():
        return {
            "success": False,
            "error": "File not found"
        }

    # Check file size
    file_size = file_path.stat().st_size
    if file_size > max_size:
        return {
            "success": False,
            "error": f"File too large ({file_size} bytes). Maximum size: {max_size} bytes"
        }

    # Determine if file is text-based
    text_extensions = [
        '.md', '.txt', '.json', '.yaml', '.yml',
        '.dart', '.py', '.js', '.html', '.css',
        '.xml', '.csv', '.log'
    ]

    extension = file_path.suffix.lower()
    is_text = extension in text_extensions

    try:
        if is_text:
            content = file_path.read_text(encoding='utf-8', errors='replace')
            return {
                "success": True,
                "content": content,
                "type": "text",
                "size": file_size,
                "extension": extension,
                "name": file_path.name
            }
        else:
            return {
                "success": False,
                "error": "Binary file not supported for viewing",
                "type": "binary",
                "size": file_size,
                "extension": extension,
                "name": file_path.name
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to read file: {str(e)}"
        }
