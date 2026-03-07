"""Folder opener for different operating systems. Delegates to pycore.system_launcher for open."""

from pathlib import Path
from typing import Dict, Any, Union

from pycore.pyutils.system_launcher import open_dir, open_file_with_notepad as _open_file_with_notepad


def open_folder(folder_path: Path) -> Dict[str, Any]:
    """
    Open folder in system file explorer (explorer / xdg-open / open). Uses pycore.system_launcher.open_path.
    """
    if not folder_path.exists() or not folder_path.is_dir():
        return {"success": False, "error": "Folder not found or not a directory"}
    if open_dir(folder_path):
        return {"success": True, "message": f"Opened folder: {folder_path.name}"}
    return {"success": False, "error": "Failed to open folder"}


def open_file_with_notepad(file_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Open a file with system Notepad (Windows) or default text editor (macOS/Linux).
    Delegates to pycore.pyutils.system_launcher.open_file_with_notepad.
    Accepts str or Path.

    Returns:
        Result dictionary with success/error.
    """
    ok = _open_file_with_notepad(file_path)
    if ok:
        p = Path(file_path).resolve()
        return {"success": True, "message": f"Opened: {p.name}"}
    return {"success": False, "error": "File not found or could not open"}
