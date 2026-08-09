#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared JSON-backed user settings owned by one serialized center."""

import copy
import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR, CORE_NODE_ROOT


STORE_FILE_NAME = "user_data.json"
DEFAULT_CONFIG_DIR = CORE_NODE_ROOT / "config"
DEFAULT_FILE_PATTERNS = ("*.config.json", "*.settings.json")
DEFAULT_FILE_EXCLUDES = frozenset({"queue_center_contract.json"})


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Return a recursive map merge where personalized values win."""
    merged = copy.deepcopy(base)
    for key, value in override.items():
        current = merged.get(key)
        if isinstance(current, dict) and isinstance(value, dict):
            merged[key] = _deep_merge(current, value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def _read_json_object(path: Path) -> Dict[str, Any]:
    if not path.is_file():
        return {}
    with path.open("r", encoding="utf-8") as file_handle:
        loaded = json.load(file_handle)
    return loaded if isinstance(loaded, dict) else {}


class _UserDataDocument:
    """One JSON document whose state is owned by the shared store center."""

    def __init__(self, base_dir: Path, defaults_dir: Path, file_name: str) -> None:
        self._base_dir = base_dir
        self._defaults_dir = defaults_dir
        self._path = base_dir / file_name
        self._defaults: Optional[Dict[str, Any]] = None
        self._overrides: Optional[Dict[str, Any]] = None
        self._data: Optional[Dict[str, Any]] = None

    @property
    def path(self) -> Path:
        return self._path

    @property
    def base_dir(self) -> Path:
        return self._base_dir

    def _load_defaults(self) -> Dict[str, Any]:
        defaults: Dict[str, Any] = {}
        seen: set[Path] = set()
        for pattern in DEFAULT_FILE_PATTERNS:
            for path in sorted(self._defaults_dir.glob(pattern)):
                if path in seen or path.name in DEFAULT_FILE_EXCLUDES:
                    continue
                seen.add(path)
                try:
                    defaults = _deep_merge(defaults, _read_json_object(path))
                except Exception as exc:
                    ColorPrint.yellow(
                        f"[UserDataStore] Failed to read defaults {path}: {exc}"
                    )
        return defaults

    def _ensure_loaded(self) -> Dict[str, Any]:
        if self._data is not None:
            return self._data
        self._defaults = self._load_defaults()
        try:
            self._overrides = _read_json_object(self._path)
        except Exception as exc:
            ColorPrint.yellow(f"[UserDataStore] Failed to read {self._path}: {exc}")
            self._backup_corrupt_file()
            self._overrides = {}
        self._rebuild_effective()
        return self._data or {}

    def _rebuild_effective(self) -> None:
        self._data = _deep_merge(self._defaults or {}, self._overrides or {})

    def _backup_corrupt_file(self) -> None:
        try:
            if self._path.exists():
                backup_path = self._path.with_suffix(self._path.suffix + ".corrupt")
                os.replace(str(self._path), str(backup_path))
                ColorPrint.yellow(
                    f"[UserDataStore] Backed up corrupt settings to {backup_path}"
                )
        except Exception:
            pass

    def _write_overrides(self, overrides: Dict[str, Any]) -> None:
        self._base_dir.mkdir(parents=True, exist_ok=True)
        temporary_path = self._path.with_suffix(
            self._path.suffix + f".tmp.{os.getpid()}.{uuid.uuid4().hex}"
        )
        with temporary_path.open("w", encoding="utf-8") as file_handle:
            json.dump(
                overrides,
                file_handle,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            file_handle.flush()
            os.fsync(file_handle.fileno())
        os.replace(str(temporary_path), str(self._path))
        if os.name != "nt":
            try:
                os.chmod(str(self._path), 0o666)
            except OSError:
                pass

    def save(self) -> None:
        self._write_overrides(self._overrides or {})

    def reload(self) -> None:
        self._defaults = None
        self._overrides = None
        self._data = None

    def get_section(self, namespace: str) -> Dict[str, Any]:
        section = self._ensure_loaded().get(namespace)
        return copy.deepcopy(section) if isinstance(section, dict) else {}

    def get_personalized_section(self, namespace: str) -> Dict[str, Any]:
        self._ensure_loaded()
        section = (self._overrides or {}).get(namespace)
        return copy.deepcopy(section) if isinstance(section, dict) else {}

    def get_default_section(self, namespace: str) -> Dict[str, Any]:
        self._ensure_loaded()
        section = (self._defaults or {}).get(namespace)
        return copy.deepcopy(section) if isinstance(section, dict) else {}

    def set_section(self, namespace: str, value: Dict[str, Any]) -> None:
        self.set_sections({namespace: value})

    def set_sections(self, values: Dict[str, Dict[str, Any]]) -> None:
        self._ensure_loaded()
        overrides = copy.deepcopy(self._overrides or {})
        for namespace, value in values.items():
            overrides[namespace] = copy.deepcopy(value or {})
        self._write_overrides(overrides)
        self._overrides = overrides
        self._rebuild_effective()

    def update_section(self, namespace: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        section = self.get_section(namespace)
        section = _deep_merge(section, dict(patch or {}))
        self.set_section(namespace, section)
        return self.get_section(namespace)

    def get(
        self,
        namespace: str,
        key: Optional[str] = None,
        default: Any = None,
    ) -> Any:
        section = self._ensure_loaded().get(namespace)
        if key is None:
            return copy.deepcopy(section) if isinstance(section, dict) else default
        if isinstance(section, dict) and key in section:
            return copy.deepcopy(section[key])
        return default

    def set(self, namespace: str, key: str, value: Any) -> None:
        section = self.get_section(namespace)
        section[key] = value
        self.set_section(namespace, section)

    def delete(self, namespace: str, key: Optional[str] = None) -> None:
        self._ensure_loaded()
        overrides = copy.deepcopy(self._overrides or {})
        if key is None:
            overrides.pop(namespace, None)
        else:
            section = overrides.get(namespace)
            if isinstance(section, dict):
                section.pop(key, None)
        self._write_overrides(overrides)
        self._overrides = overrides
        self._rebuild_effective()

    def as_dict(self) -> Dict[str, Any]:
        return copy.deepcopy(self._ensure_loaded())

    def record_content_history(self, entry: Dict[str, Any], cap: int = 200) -> None:
        if not isinstance(entry, dict):
            return
        section = self.get_section("content_history")
        entries = section.get("entries")
        entries = list(entries) if isinstance(entries, list) else []
        record = dict(entry)
        if not record.get("ts"):
            record["ts"] = time.time()
        record_key = (record.get("source_key"), record.get("type"))
        if record_key != (None, None):
            entries = [
                item
                for item in entries
                if (item.get("source_key"), item.get("type")) != record_key
            ]
        entries.append(record)
        if cap and len(entries) > cap:
            entries = entries[-cap:]
        self.set_section("content_history", {"entries": entries})

    def get_content_history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        entries = self.get_section("content_history").get("entries")
        result = list(reversed(entries)) if isinstance(entries, list) else []
        if limit is not None:
            result = result[:max(0, int(limit))]
        return [dict(item) for item in result if isinstance(item, dict)]

    def feature_config_path(self, name: str, ext: str = "json") -> Path:
        return self._path

    def load_feature_config(self, name: str) -> Dict[str, Any]:
        return self.get_section(name)

    def save_feature_config(self, name: str, data: Dict[str, Any]) -> None:
        self.set_section(name, data)


class _UserDataStoreCenter:
    """Own every JSON document behind one process-wide serialized instance."""

    def __init__(self) -> None:
        self._documents: Dict[str, _UserDataDocument] = {}
        init_serialized_owner(
            self,
            "user_data_store.center",
            "UserDataStoreCenter",
        )

    @serialized_method
    def execute(
        self,
        store_key: str,
        operation: str,
        payload: Dict[str, Any],
    ) -> Any:
        if operation == "configure":
            if store_key not in self._documents:
                self._documents[store_key] = _UserDataDocument(
                    base_dir=Path(payload["base_dir"]),
                    defaults_dir=Path(payload["defaults_dir"]),
                    file_name=payload["file_name"],
                )
            return True
        document = self._documents.get(store_key)
        if document is None:
            raise RuntimeError(f"User data store is not configured: {store_key}")
        return getattr(document, operation)(**payload)


user_data_store_center = _UserDataStoreCenter()


class UserDataStore:
    """Configured facade backed by the process-wide user-data store center."""

    def __init__(
        self,
        base_dir: Optional[Path] = None,
        file_name: str = STORE_FILE_NAME,
        defaults_dir: Optional[Path] = None,
    ) -> None:
        self._base_dir = Path(base_dir) if base_dir else APP_CONFIG_DIR
        self._defaults_dir = Path(defaults_dir) if defaults_dir else DEFAULT_CONFIG_DIR
        self._path = self._base_dir / file_name
        self._store_key = str(self._path.resolve())
        self._request(
            "configure",
            base_dir=str(self._base_dir),
            defaults_dir=str(self._defaults_dir),
            file_name=file_name,
        )

    @property
    def path(self) -> Path:
        return self._path

    @property
    def base_dir(self) -> Path:
        return self._base_dir

    def save(self) -> None:
        self._request("save")

    def reload(self) -> None:
        self._request("reload")

    def get_section(self, namespace: str) -> Dict[str, Any]:
        section = self._request("get_section", namespace=namespace) or {}
        return copy.deepcopy(section)

    def get_personalized_section(self, namespace: str) -> Dict[str, Any]:
        section = self._request(
            "get_personalized_section",
            namespace=namespace,
        ) or {}
        return copy.deepcopy(section)

    def get_default_section(self, namespace: str) -> Dict[str, Any]:
        section = self._request(
            "get_default_section",
            namespace=namespace,
        ) or {}
        return copy.deepcopy(section)

    def set_section(self, namespace: str, value: Dict[str, Any]) -> None:
        self._request("set_section", namespace=namespace, value=value)

    def set_sections(self, values: Dict[str, Dict[str, Any]]) -> None:
        self._request("set_sections", values=values)

    def update_section(self, namespace: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        section = self._request(
            "update_section",
            namespace=namespace,
            patch=patch,
        ) or {}
        return dict(section)

    def get(
        self,
        namespace: str,
        key: Optional[str] = None,
        default: Any = None,
    ) -> Any:
        return self._request(
            "get",
            namespace=namespace,
            key=key,
            default=default,
        )

    def set(self, namespace: str, key: str, value: Any) -> None:
        self._request("set", namespace=namespace, key=key, value=value)

    def delete(self, namespace: str, key: Optional[str] = None) -> None:
        self._request("delete", namespace=namespace, key=key)

    def as_dict(self) -> Dict[str, Any]:
        return copy.deepcopy(self._request("as_dict") or {})

    def record_content_history(self, entry: Dict[str, Any], cap: int = 200) -> None:
        self._request("record_content_history", entry=entry, cap=cap)

    def get_content_history(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        result = self._request("get_content_history", limit=limit) or []
        return [dict(item) for item in result if isinstance(item, dict)]

    def feature_config_path(self, name: str, ext: str = "json") -> Path:
        return self._path

    def load_feature_config(self, name: str) -> Dict[str, Any]:
        return self.get_section(name)

    def save_feature_config(self, name: str, data: Dict[str, Any]) -> None:
        self.set_section(name, data)

    def _request(self, operation: str, **payload: Any) -> Any:
        return user_data_store_center.execute(
            self._store_key,
            operation,
            payload,
        )


user_data_store = UserDataStore()


__all__ = [
    "DEFAULT_CONFIG_DIR",
    "STORE_FILE_NAME",
    "UserDataStore",
    "user_data_store",
    "user_data_store_center",
]
