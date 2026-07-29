"""
Configuration service for pyMatrix.

Provides centralized access to global settings and device-specific overrides.
Persisted to a single JSON file to avoid duplicated logic across the codebase.
"""

from __future__ import annotations

import asyncio
import json
from copy import deepcopy
from pathlib import Path
from typing import Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pyapps.matrix.matrix_config import Config


class ConfigService:
    """Manage global and per-device configuration with persistence."""

    _instance: Optional["ConfigService"] = None

    # Allowed server parameter keys
    _ALLOWED_KEYS = {
        "max_size",
        "bit_rate",
        "max_fps",
        "codec",
        "control",
        "locked_video_orientation",
        "video_stream_mode",  # "h264" or "yuv"
    }

    def __init__(self) -> None:
        # Use platform-specific configuration directory
        # Windows: %USERPROFILE%/.core_node/scrcpy/config/settings.json
        # Linux: /var/_core_node/scrcpy/config/settings.json
        self._config_file: Path = Config.get_config_file_path()
        self._lock: asyncio.Lock = asyncio.Lock()
        self._data: Dict = self._load_from_disk()

    @classmethod
    def instance(cls) -> "ConfigService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    def _default_config(self) -> Dict:
        return {
            "global": deepcopy(Config.DEFAULT_DEVICE_PARAMS),
            "devices": {},
        }

    def _load_from_disk(self) -> Dict:
        if self._config_file.exists():
            try:
                with self._config_file.open("r", encoding="utf-8") as fp:
                    data = json.load(fp)
                if "global" not in data or "devices" not in data:
                    raise ValueError("Invalid configuration structure")
                return data
            except (json.JSONDecodeError, ValueError, IOError) as e:
                # Fall back to defaults if the file is corrupted
                ColorPrint.yellow(f"[ConfigService] Failed to load config file: {e}, using defaults")
                return self._default_config()
        return self._default_config()

    async def _write_locked(self) -> None:
        """Write current data to disk. Caller must hold the lock."""
        temp_file = self._config_file.with_suffix(".tmp")
        with temp_file.open("w", encoding="utf-8") as fp:
            json.dump(self._data, fp, indent=2, ensure_ascii=False)
        temp_file.replace(self._config_file)

    def _sanitise_payload(self, payload: Dict) -> Dict:
        """Return allowed keys with non-null values."""
        if not payload:
            return {}
        return {
            key: value
            for key, value in payload.items()
            if key in self._ALLOWED_KEYS and value is not None
        }

    def _match_device_key(self, device_name: Optional[str]) -> Optional[str]:
        """Find device config key using case-insensitive match."""
        if not device_name:
            return None
        lowered = device_name.lower()
        for key in self._data["devices"].keys():
            if key.lower() == lowered:
                return key
        return None

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    async def get_config(self) -> Dict:
        async with self._lock:
            return deepcopy(self._data)

    async def get_global(self) -> Dict:
        async with self._lock:
            return deepcopy(self._data["global"])

    async def update_global(self, payload: Dict) -> Dict:
        updates = self._sanitise_payload(payload)
        if not updates:
            async with self._lock:
                return deepcopy(self._data["global"])

        async with self._lock:
            old_config = deepcopy(self._data["global"])
            self._data["global"].update(updates)
            await self._write_locked()
            new_config = deepcopy(self._data["global"])

        # Log video_stream_mode changes
        if "video_stream_mode" in updates:
            old_mode = old_config.get("video_stream_mode")
            new_mode = new_config.get("video_stream_mode")
            if old_mode != new_mode:
                ColorPrint.green(f"[ConfigService] Video stream mode changed: {old_mode} -> {new_mode}")

        return new_config

    async def get_device_config(self, device_name: str) -> Optional[Dict]:
        async with self._lock:
            key = self._match_device_key(device_name)
            if key is None:
                return None
            return deepcopy(self._data["devices"][key])

    async def update_device_config(self, device_name: str, payload: Dict) -> Dict:
        updates = self._sanitise_payload(payload)
        async with self._lock:
            key = self._match_device_key(device_name) or device_name
            old_device_config = deepcopy(self._data["devices"].get(key, {}))
            device_config = self._data["devices"].get(key, {})
            device_config.update(updates)
            self._data["devices"][key] = device_config
            await self._write_locked()
            new_device_config = deepcopy(self._data["devices"][key])

        # Log video_stream_mode changes
        if "video_stream_mode" in updates:
            old_mode = old_device_config.get("video_stream_mode")
            new_mode = new_device_config.get("video_stream_mode")
            if old_mode != new_mode:
                ColorPrint.green(f"[ConfigService] Device {device_name} video stream mode changed: {old_mode} -> {new_mode}")

        return new_device_config

    async def delete_device_config(self, device_name: str) -> bool:
        async with self._lock:
            key = self._match_device_key(device_name)
            if key and key in self._data["devices"]:
                del self._data["devices"][key]
                await self._write_locked()
                return True
            return False

    async def get_effective_server_params(
        self,
        device_name: Optional[str] = None,
        overrides: Optional[Dict] = None,
    ) -> Dict:
        """Merge global, device-level, and runtime overrides."""
        async with self._lock:
            effective = deepcopy(self._data["global"])
            key = self._match_device_key(device_name)
            if key:
                effective.update(self._data["devices"][key])

        if overrides:
            effective.update(self._sanitise_payload(overrides))

        return effective
