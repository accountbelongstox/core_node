"""Global variable management utilities for Core Node Python components."""

import tempfile
import json
import platform
from pathlib import Path
from typing import Any, Dict, Optional

# Calculate paths
_system = platform.system().lower()
_home = Path.home()

# Global directory paths (all uppercase)
GLOBAL_VARS_DIR = _home / ".core_node" / ".global_vars"
PYTOOLS_TMP_DIR = _home / ".core_node" / "pytools" / "tmp"

# Ensure directories exist
try:
    GLOBAL_VARS_DIR.mkdir(parents=True, exist_ok=True)
    PYTOOLS_TMP_DIR.mkdir(parents=True, exist_ok=True)
except (OSError, PermissionError):
    # Fallback to /tmp if home directory is read-only or inaccessible
    _tmp_base = Path(tempfile.gettempdir()) / ".core_node"
    GLOBAL_VARS_DIR = _tmp_base / ".global_vars"
    PYTOOLS_TMP_DIR = _tmp_base / "pytools" / "tmp"
    GLOBAL_VARS_DIR.mkdir(parents=True, exist_ok=True)
    PYTOOLS_TMP_DIR.mkdir(parents=True, exist_ok=True)

__all__ = ["GlobalVarManager", "GLOBAL_VARS_DIR", "PYTOOLS_TMP_DIR"]


class GlobalVarManager:
    """Provide cross-platform access to shared global variable files."""

    def __init__(self, base_dir: Optional[Path] = None, namespace: Optional[str] = None) -> None:
        self._base_dir = Path(base_dir) if base_dir else self._discover_base_dir()
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._namespace = self._sanitize(namespace) if namespace else None

    def _discover_base_dir(self) -> Path:
        if _system == "windows":
            return GLOBAL_VARS_DIR

        wsl_users = Path("/mnt/c/Users")
        if wsl_users.exists():
            for user_dir in sorted(wsl_users.iterdir()):
                candidate = user_dir / ".core_node" / "global_var"
                if candidate.exists():
                    return self._ensure_directory(candidate)

        default_dir = Path("/usr/.core_node/global_var")
        # Check if we can write to /usr directory
        if default_dir.parent.exists() and default_dir.parent.stat().st_mode & 0o200:
            return self._ensure_directory(default_dir)

        # Use home directory fallback
        fallback = _home / ".core_node" / "global_var"
        return self._ensure_directory(fallback)

    @staticmethod
    def _ensure_directory(path: Path) -> Path:
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _sanitize(self, key: Optional[str]) -> str:
        if not key:
            raise ValueError("Key must not be empty")
        sanitized = "".join(ch for ch in str(key).upper() if ch.isalnum() or ch == "_")
        if not sanitized:
            raise ValueError("Key contains no valid characters")
        return sanitized

    def _resolve_key(self, key: str) -> Path:
        sanitized = self._sanitize(key)
        if self._namespace:
            sanitized = f"{self._namespace}_{sanitized}"
        return self._base_dir / sanitized

    @property
    def base_dir(self) -> Path:
        return self._base_dir

    def file_path(self, key: str) -> Path:
        return self._resolve_key(key)

    def set(self, key: str, value: Any) -> Path:
        path = self._resolve_key(key)
        textual = "" if value is None else str(value)
        path.write_text(textual, encoding="utf-8")
        return path

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        path = self._resolve_key(key)
        if not path.exists():
            return default
        return path.read_text(encoding="utf-8")

    def clear(self, key: str) -> None:
        path = self._resolve_key(key)
        if path.exists():
            path.unlink()

    def set_json(self, key: str, data: Dict[str, Any]) -> Path:
        return self.set(key, json.dumps(data, ensure_ascii=False))

    def get_json(self, key: str, default: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        raw = self.get(key)
        if not raw:
            return default

        # Check if raw data looks like JSON
        raw_stripped = raw.strip()
        if not raw_stripped:
            return default
        if not (raw_stripped.startswith('{') or raw_stripped.startswith('[')):
            return default

        # Parse JSON - let errors expose naturally
        return json.loads(raw)
