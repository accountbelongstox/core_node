#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Backward-compatible global configuration facade over user_data.json."""

from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.user_data_store import user_data_store


_SECTION = "global_config"


class GlobalConfig:
    """Expose the legacy configuration API through the unified settings map."""

    def __init__(self, database_name: str = "common") -> None:
        self.database_name = database_name
        init_serialized_owner(
            self,
            "pyutils.global_config.state",
            "GlobalConfigStateThread",
            timeout=300.0,
        )

    @property
    def DEFAULT_CONFIG(self) -> Dict[str, Any]:
        return user_data_store.get_default_section(_SECTION)

    @serialized_method
    def get(self, key: str, default: Any = None) -> Any:
        return user_data_store.get(_SECTION, key, default)

    @serialized_method
    def set(self, key: str, value: Any) -> bool:
        try:
            user_data_store.set(_SECTION, key, value)
            ColorPrint.green(f"[GlobalConfig] Set {key} = {value}")
            return True
        except Exception as exc:
            ColorPrint.red(f"[GlobalConfig] Failed to set {key}: {exc}")
            return False

    @serialized_method
    def get_all(self) -> Dict[str, Any]:
        return user_data_store.get_section(_SECTION)

    @serialized_method
    def update(self, config_dict: Dict[str, Any]) -> bool:
        try:
            user_data_store.update_section(_SECTION, config_dict or {})
            return True
        except Exception as exc:
            ColorPrint.red(f"[GlobalConfig] Failed to update: {exc}")
            return False

    @serialized_method
    def reset_to_defaults(self) -> None:
        user_data_store.delete(_SECTION)
        ColorPrint.yellow("[GlobalConfig] Reset to defaults")

    @serialized_method
    def has_key(self, key: str) -> bool:
        return key in user_data_store.get_section(_SECTION)

    @serialized_method
    def delete(self, key: str) -> bool:
        personalized = user_data_store.get_personalized_section(_SECTION)
        if key not in personalized:
            return False
        user_data_store.delete(_SECTION, key)
        ColorPrint.yellow(f"[GlobalConfig] Deleted personalized key: {key}")
        return True

    def get_default_language(self) -> str:
        return self.get("default_language", self.DEFAULT_CONFIG.get("default_language"))

    def set_default_language(self, language: str) -> None:
        self.set("default_language", language)

    def get_default_tts_provider(self) -> str:
        return self.get("default_tts_provider", self.DEFAULT_CONFIG.get("default_tts_provider"))

    def set_default_tts_provider(self, provider: str) -> None:
        self.set("default_tts_provider", provider)

    def get_supported_languages(self) -> list:
        return self.get("supported_languages", self.DEFAULT_CONFIG.get("supported_languages", []))

    def is_clipboard_sync_enabled(self) -> bool:
        return bool(self.get("clipboard_sync_enabled", self.DEFAULT_CONFIG.get("clipboard_sync_enabled")))

    def get_clipboard_sync_interval(self) -> int:
        return int(self.get("clipboard_sync_interval", self.DEFAULT_CONFIG.get("clipboard_sync_interval", 0)))

    def print_config(self) -> None:
        ColorPrint.blue("\n" + "=" * 70)
        ColorPrint.blue("[Global Configuration - Unified JSON]")
        ColorPrint.blue("=" * 70)
        for key, value in sorted(self.get_all().items()):
            ColorPrint.plain(f"{key}: {value}")
        ColorPrint.blue("=" * 70 + "\n")


global_config = GlobalConfig()


__all__ = ["GlobalConfig", "global_config"]
