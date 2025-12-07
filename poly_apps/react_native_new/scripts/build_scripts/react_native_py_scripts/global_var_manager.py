"""
Standalone Global Variable Manager for React Native Build Scripts
Independent implementation without pycore dependencies
"""

import json
import platform
from pathlib import Path
from typing import Any, Dict, Optional


class GlobalVarManager:
    """
    Standalone global variable manager for file-based IPC
    Uses ~/.core_node/.global_vars directory with namespace isolation
    """

    def __init__(self, namespace: Optional[str] = None) -> None:
        """
        Initialize GlobalVarManager

        Args:
            namespace: Optional namespace for variable isolation (e.g., "RN_BUILD")
        """
        self._base_dir = self._get_global_vars_dir()
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._namespace = self._sanitize(namespace) if namespace else None

    def _get_global_vars_dir(self) -> Path:
        """Get the global variables directory path"""
        home = Path.home()
        return home / ".core_node" / ".global_vars"

    def _sanitize(self, key: Optional[str]) -> str:
        """Sanitize key to contain only alphanumeric and underscore"""
        if not key:
            raise ValueError("Key must not be empty")
        sanitized = "".join(ch for ch in str(key).upper() if ch.isalnum() or ch == "_")
        if not sanitized:
            raise ValueError("Key contains no valid characters")
        return sanitized

    def _resolve_key(self, key: str) -> Path:
        """Resolve key to file path with namespace prefix"""
        sanitized = self._sanitize(key)
        if self._namespace:
            # Flat structure: {namespace}_{key}
            sanitized = f"{self._namespace}_{sanitized}"
        return self._base_dir / sanitized

    @property
    def base_dir(self) -> Path:
        """Get base directory path"""
        return self._base_dir

    def file_path(self, key: str) -> Path:
        """Get file path for a key"""
        return self._resolve_key(key)

    def set(self, key: str, value: Any) -> Path:
        """
        Set a string value

        Args:
            key: Variable key
            value: String value to store

        Returns:
            Path to the created file
        """
        path = self._resolve_key(key)
        textual = "" if value is None else str(value)
        path.write_text(textual, encoding="utf-8")
        return path

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """
        Get a string value

        Args:
            key: Variable key
            default: Default value if key doesn't exist

        Returns:
            String value or default
        """
        path = self._resolve_key(key)
        if not path.exists():
            return default
        return path.read_text(encoding="utf-8")

    def set_json(self, key: str, value: Any) -> Path:
        """
        Set a JSON-serializable value

        Args:
            key: Variable key
            value: JSON-serializable value (dict, list, etc.)

        Returns:
            Path to the created file
        """
        path = self._resolve_key(key)
        json_text = json.dumps(value, ensure_ascii=False, indent=2)
        path.write_text(json_text, encoding="utf-8")
        return path

    def get_json(self, key: str, default: Any = None) -> Any:
        """
        Get a JSON value

        Args:
            key: Variable key
            default: Default value if key doesn't exist or JSON is invalid

        Returns:
            Deserialized JSON value or default
        """
        path = self._resolve_key(key)
        if not path.exists():
            return default
        try:
            content = path.read_text(encoding="utf-8")
            return json.loads(content)
        except (json.JSONDecodeError, ValueError):
            return default

    def clear(self, key: str) -> None:
        """
        Delete a variable file

        Args:
            key: Variable key
        """
        path = self._resolve_key(key)
        path.unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        """
        Check if a variable exists

        Args:
            key: Variable key

        Returns:
            True if variable exists
        """
        return self._resolve_key(key).exists()

    def list_keys(self) -> list:
        """
        List all variable keys in namespace

        Returns:
            List of variable keys
        """
        prefix = f"{self._namespace}_" if self._namespace else ""
        keys = []

        for file_path in self._base_dir.iterdir():
            if file_path.is_file():
                name = file_path.name
                if self._namespace:
                    if name.startswith(prefix):
                        keys.append(name[len(prefix):])
                else:
                    keys.append(name)

        return keys
