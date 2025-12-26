"""Folder opener for different operating systems"""

from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
import sys
from pathlib import Path
from typing import Dict, Any
import subprocess


def open_folder(folder_path: Path) -> Dict[str, Any]:
    """
    Open folder in system file explorer.

    Args:
        folder_path: Path to folder to open

    Returns:
        Result dictionary
    """
    if not folder_path.exists() or not folder_path.is_dir():
        return {
            "success": False,
            "error": "Folder not found or not a directory"
        }

    try:
        if sys.platform == "win32":
            # Windows: use explorer
            subprocess.Popen(["explorer", str(folder_path)])
            return {
                "success": True,
                "message": f"Opened folder in Explorer: {folder_path.name}"
            }

        elif sys.platform == "darwin":
            # macOS: use open
            subprocess.Popen(["open", str(folder_path)])
            return {
                "success": True,
                "message": f"Opened folder in Finder: {folder_path.name}"
            }

        elif sys.platform.startswith("linux"):
            # Linux: try xdg-open
            try:
                subprocess.Popen(["xdg-open", str(folder_path)])
                return {
                    "success": True,
                    "message": f"Opened folder: {folder_path.name}"
                }
            except FileNotFoundError:
                # Fallback to nautilus or other file managers
                for cmd in ["nautilus", "dolphin", "thunar", "pcmanfm"]:
                    try:
                        subprocess.Popen([cmd, str(folder_path)])
                        return {
                            "success": True,
                            "message": f"Opened folder with {cmd}: {folder_path.name}"
                        }
                    except FileNotFoundError:
                        continue

                return {
                    "success": False,
                    "error": "No suitable file manager found on Linux"
                }

        else:
            return {
                "success": False,
                "error": f"Unsupported platform: {sys.platform}"
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to open folder: {str(e)}"
        }
