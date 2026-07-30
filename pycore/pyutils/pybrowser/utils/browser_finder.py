"""Locate installed browser and WebDriver executables."""

import os
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Optional


_BROWSER_NAMES: Dict[str, List[str]] = {
    "chrome": ["chrome", "chrome.exe", "google-chrome", "google-chrome-stable"],
    "edge": ["msedge", "msedge.exe", "microsoft-edge"],
    "firefox": ["firefox", "firefox.exe"],
}
_DRIVER_NAMES: Dict[str, List[str]] = {
    "chrome": ["chromedriver", "chromedriver.exe"],
    "edge": ["msedgedriver", "msedgedriver.exe"],
    "firefox": ["geckodriver", "geckodriver.exe"],
}


def find_browser(browser: str = "chrome") -> Optional[str]:
    """Return an installed browser executable path."""
    name = browser.lower()
    candidates = list(_BROWSER_NAMES.get(name, [browser]))
    if sys.platform == "win32":
        program_dirs = [os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")]
        suffixes = {
            "chrome": ["Google/Chrome/Application/chrome.exe"],
            "edge": ["Microsoft/Edge/Application/msedge.exe"],
            "firefox": ["Mozilla Firefox/firefox.exe"],
        }
        for base_dir in program_dirs:
            if not base_dir:
                continue
            for suffix in suffixes.get(name, []):
                candidates.append(str(Path(base_dir) / Path(suffix)))
    return _find_executable(candidates)


def find_driver(browser: str = "chrome") -> Optional[str]:
    """Return a matching WebDriver executable path from PATH."""
    return _find_executable(_DRIVER_NAMES.get(browser.lower(), [browser]))


def _find_executable(candidates: List[str]) -> Optional[str]:
    for candidate in candidates:
        path = Path(candidate)
        if path.is_file():
            return str(path.resolve())
        resolved = shutil.which(candidate)
        if resolved:
            return str(Path(resolved).resolve())
    return None


__all__ = ["find_browser", "find_driver"]
