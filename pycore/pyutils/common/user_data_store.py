#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared JSON-backed user settings owned by one serialized center."""

import copy
import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

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
# Settings (e.g. system_settings.rpcLanBind) are private to the pycore runtime
# user: the owner of the config dir. A root writer (sudo pyservice) hands the
# file to that user; nobody else can read or change it.
SETTINGS_FILE_MODE = 0o600
_PERMISSION_BITS = 0o777
USER_DATA_SECTION_SYSTEM_SETTINGS = "system_settings"
USER_DATA_SECTION_VIDEO_EXTRACT = "video_extract"
USER_DATA_SECTION_CAPABILITY_PRIORITIES = "capability_priorities"
USER_DATA_SECTION_TASK_CAPABILITY_CHAINS = "task_capability_chains"
USER_DATA_SECTION_ASSIST_LARAVEL = "assist_laravel"
USER_DATA_SECTION_SENTENCE_AUDIO_AUTO = "sentence_audio_auto"
USER_DATA_SECTION_WORD_TTS_AUTO = "word_tts_auto"
USER_DATA_SECTION_TTS = "tts"
USER_DATA_SECTION_AI_HUB_HISTORY = "ai_hub_history"


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


def _settings_owner(directory: Path) -> tuple:
    """(uid, gid) the settings file must have: the config dir owner when root
    writes, else the writing user."""
    stat = directory.stat()
    if os.geteuid() == 0:
        return stat.st_uid, stat.st_gid
    return os.geteuid(), os.getegid()


def _verify_private(path: Path, uid: int) -> None:
    stat = path.stat()
    if stat.st_uid != uid or stat.st_mode & _PERMISSION_BITS != SETTINGS_FILE_MODE:
        ColorPrint.red(
            f"[UserDataStore] {path} is uid={stat.st_uid} mode={oct(stat.st_mode & _PERMISSION_BITS)}; "
            f"expected uid={uid} mode={oct(SETTINGS_FILE_MODE)}"
        )


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
        init_serialized_owner(self, "user_data_store.document", "UserDataDocument")

    @serialized_method
    def execute(self, operation: str, payload: Dict[str, Any]) -> Any:
        return getattr(self, operation)(**payload)

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
        self._tighten_mode()
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

    def _rebuild_namespaces(self, namespaces: Iterable[str]) -> None:
        """Refresh only the changed namespaces of the effective document.

        Internal documents are never mutated in place (readers copy), so a
        namespace with no defaults shares the stored override object.
        """
        data = dict(self._data or {})
        for namespace in namespaces:
            default = (self._defaults or {}).get(namespace)
            overrides = self._overrides or {}
            if namespace not in overrides:
                if default is None:
                    data.pop(namespace, None)
                else:
                    data[namespace] = copy.deepcopy(default)
                continue
            override = overrides[namespace]
            if isinstance(default, dict) and isinstance(override, dict):
                data[namespace] = _deep_merge(default, override)
            else:
                data[namespace] = override
        self._data = data

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

    def _tighten_mode(self) -> None:
        """A settings file this user owns from before (0666) becomes private."""
        if os.name == "nt" or not self._path.is_file():
            return
        stat = self._path.stat()
        if stat.st_uid == os.geteuid() and stat.st_mode & _PERMISSION_BITS != SETTINGS_FILE_MODE:
            os.chmod(str(self._path), SETTINGS_FILE_MODE)

    def _write_overrides(self, overrides: Dict[str, Any]) -> None:
        """Atomic private write: a 0600 temp file (chowned to the runtime user
        when root writes) replaces the file, then ownership and mode are verified."""
        self._base_dir.mkdir(parents=True, exist_ok=True)
        temporary_path = self._path.with_suffix(
            self._path.suffix + f".tmp.{os.getpid()}.{uuid.uuid4().hex}"
        )
        descriptor = os.open(
            str(temporary_path),
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
            SETTINGS_FILE_MODE,
        )
        owner = None
        if os.name != "nt":
            owner = _settings_owner(self._base_dir)
            os.fchmod(descriptor, SETTINGS_FILE_MODE)
            if os.geteuid() == 0:
                os.fchown(descriptor, owner[0], owner[1])
        # json.dump and any indent run the pure-Python encoder, which holds the
        # GIL for seconds on a multi-megabyte document; dumps without indent
        # uses the C encoder.
        encoded = json.dumps(
            overrides,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        with os.fdopen(descriptor, "w", encoding="utf-8") as file_handle:
            file_handle.write(encoded)
            file_handle.flush()
            os.fsync(file_handle.fileno())
        os.replace(str(temporary_path), str(self._path))
        if owner is not None:
            _verify_private(self._path, owner[0])

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
        overrides = dict(self._overrides or {})
        for namespace, value in values.items():
            overrides[namespace] = copy.deepcopy(value or {})
        self._write_overrides(overrides)
        self._overrides = overrides
        self._rebuild_namespaces(values)

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
        overrides = dict(self._overrides or {})
        if key is None:
            overrides.pop(namespace, None)
        else:
            section = overrides.get(namespace)
            if isinstance(section, dict):
                overrides[namespace] = {
                    name: value for name, value in section.items() if name != key
                }
        self._write_overrides(overrides)
        self._overrides = overrides
        self._rebuild_namespaces((namespace,))

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

    def execute(
        self,
        store_key: str,
        operation: str,
        payload: Dict[str, Any],
    ) -> Any:
        document = self._document(store_key, operation, payload)
        if operation == "configure":
            return True
        return document.execute(operation, payload)

    @serialized_method
    def _document(self, store_key: str, operation: str, payload: Dict[str, Any]) -> _UserDataDocument:
        if operation == "configure":
            if store_key not in self._documents:
                self._documents[store_key] = _UserDataDocument(
                    base_dir=Path(payload["base_dir"]),
                    defaults_dir=Path(payload["defaults_dir"]),
                    file_name=payload["file_name"],
                )
        document = self._documents.get(store_key)
        if document is None:
            raise RuntimeError(f"User data store is not configured: {store_key}")
        return document


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
        return self._request("get_section", namespace=namespace) or {}

    def get_personalized_section(self, namespace: str) -> Dict[str, Any]:
        return self._request(
            "get_personalized_section",
            namespace=namespace,
        ) or {}

    def get_default_section(self, namespace: str) -> Dict[str, Any]:
        return self._request(
            "get_default_section",
            namespace=namespace,
        ) or {}

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
        return self._request("as_dict") or {}

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
    "USER_DATA_SECTION_AI_HUB_HISTORY",
    "USER_DATA_SECTION_ASSIST_LARAVEL",
    "USER_DATA_SECTION_CAPABILITY_PRIORITIES",
    "USER_DATA_SECTION_SENTENCE_AUDIO_AUTO",
    "USER_DATA_SECTION_SYSTEM_SETTINGS",
    "USER_DATA_SECTION_TASK_CAPABILITY_CHAINS",
    "USER_DATA_SECTION_TTS",
    "USER_DATA_SECTION_VIDEO_EXTRACT",
    "USER_DATA_SECTION_WORD_TTS_AUTO",
    "UserDataStore",
    "user_data_store",
    "user_data_store_center",
]
