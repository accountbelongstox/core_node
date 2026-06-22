"""
File Writer API - Save file content with validation
"""

import json
from pathlib import Path
from typing import Dict, Any


def validate_json_content(content: str) -> Dict[str, Any]:
    """
    Validate JSON content before saving.

    Args:
        content: JSON string to validate

    Returns:
        Dict with success status and error message if any
    """
    try:
        json.loads(content)
        return {"valid": True, "error": None}
    except json.JSONDecodeError as e:
        return {
            "valid": False,
            "error": f"Invalid JSON at line {e.lineno}, column {e.colno}: {e.msg}"
        }
    except Exception as e:
        return {"valid": False, "error": str(e)}


def save_file_content(file_path: Path, content: str, validate_json: bool = False) -> Dict[str, Any]:
    """
    Save content to file with optional JSON validation.

    Args:
        file_path: Path to file
        content: Content to save
        validate_json: Whether to validate JSON before saving

    Returns:
        Dict with success status and message
    """
    try:
        # Validate JSON if requested
        if validate_json:
            validation = validate_json_content(content)
            if not validation["valid"]:
                return {
                    "success": False,
                    "error": f"JSON validation failed: {validation['error']}"
                }

        # Ensure parent directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Write content
        file_path.write_text(content, encoding='utf-8')

        return {
            "success": True,
            "message": f"File saved successfully",
            "bytes_written": len(content.encode('utf-8'))
        }

    except PermissionError:
        return {"success": False, "error": "Permission denied"}
    except OSError as e:
        return {"success": False, "error": f"File system error: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}
