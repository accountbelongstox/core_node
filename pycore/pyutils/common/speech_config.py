#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Backward-compatible speech configuration facade over user_data.json."""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.user_data_store import user_data_store


_SECTION = "speech_config"


def _category(key: str) -> str:
    for prefix in ("tts", "stt", "ui"):
        if key.startswith(f"{prefix}_"):
            return prefix
    return "general"


def _value_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "dict"
    return "string"


class SpeechConfig:
    """Expose the legacy speech configuration API through unified JSON."""

    def __init__(self, database_name: str = "speech", auto_migrate: bool = True) -> None:
        self.database_name = database_name
        self._auto_migrate = auto_migrate
        init_serialized_owner(
            self,
            "pyutils.speech_config.state",
            "SpeechConfigStateThread",
            timeout=300.0,
        )
        if auto_migrate:
            self._migrate_from_global_config()

    @property
    def DEFAULT_CONFIG(self) -> Dict[str, Any]:
        return user_data_store.get_default_section(_SECTION)

    def _migrate_from_global_config(self) -> None:
        if user_data_store.get_personalized_section(_SECTION):
            return
        global_personalized = user_data_store.get_personalized_section("global_config")
        migrated = {
            key[len("speech_"):]: value
            for key, value in global_personalized.items()
            if key.startswith("speech_")
        }
        if migrated:
            user_data_store.update_section(_SECTION, migrated)

    @serialized_method
    def get(self, key: str, default: Any = None) -> Any:
        return user_data_store.get(_SECTION, key, default)

    @serialized_method
    def set(self, key: str, value: Any, description: Optional[str] = None) -> bool:
        try:
            user_data_store.set(_SECTION, key, value)
            ColorPrint.green(f"[SpeechConfig] Set {key} = {value}")
            return True
        except Exception as exc:
            ColorPrint.red(f"[SpeechConfig] Failed to set {key}: {exc}")
            return False

    @serialized_method
    def get_all(self) -> Dict[str, Any]:
        return user_data_store.get_section(_SECTION)

    @serialized_method
    def get_by_category(self, category: str) -> Dict[str, Any]:
        normalized = str(category or "").strip().lower()
        return {
            key: value
            for key, value in self.get_all().items()
            if _category(key) == normalized
        }

    @serialized_method
    def update(self, config_dict: Dict[str, Any]) -> bool:
        try:
            user_data_store.update_section(_SECTION, config_dict or {})
            return True
        except Exception as exc:
            ColorPrint.red(f"[SpeechConfig] Failed to update: {exc}")
            return False

    @serialized_method
    def has_key(self, key: str) -> bool:
        return key in user_data_store.get_section(_SECTION)

    @serialized_method
    def delete(self, key: str) -> bool:
        personalized = user_data_store.get_personalized_section(_SECTION)
        if key not in personalized:
            return False
        user_data_store.delete(_SECTION, key)
        return True

    @serialized_method
    def reset_to_defaults(self) -> None:
        user_data_store.delete(_SECTION)
        ColorPrint.yellow("[SpeechConfig] Reset to defaults")

    @serialized_method
    def get_statistics(self) -> Dict[str, Any]:
        values = self.get_all()
        by_category: Dict[str, int] = {}
        by_type: Dict[str, int] = {}
        for key, value in values.items():
            category = _category(key)
            value_type = _value_type(value)
            by_category[category] = by_category.get(category, 0) + 1
            by_type[value_type] = by_type.get(value_type, 0) + 1
        return {
            "total_configs": len(values),
            "by_category": by_category,
            "by_type": by_type,
        }

    def get_tts_provider(self) -> str:
        return self.get("tts_provider", self.DEFAULT_CONFIG.get("tts_provider"))

    def set_tts_provider(self, provider: str) -> None:
        self.set("tts_provider", provider)

    def get_stt_provider(self) -> str:
        return self.get("stt_provider", self.DEFAULT_CONFIG.get("stt_provider"))

    def set_stt_provider(self, provider: str) -> None:
        self.set("stt_provider", provider)

    def get_default_language(self) -> str:
        return self.get("default_language", self.DEFAULT_CONFIG.get("default_language"))

    def set_default_language(self, language: str) -> None:
        self.set("default_language", language)

    def is_auto_use_cached(self) -> bool:
        return bool(self.get("auto_use_cached", self.DEFAULT_CONFIG.get("auto_use_cached")))

    def print_config(self) -> None:
        ColorPrint.blue("\n" + "=" * 70)
        ColorPrint.blue("[Speech Configuration - Unified JSON]")
        ColorPrint.blue("=" * 70)
        categories: Dict[str, Dict[str, Any]] = {}
        for key, value in self.get_all().items():
            categories.setdefault(_category(key).upper(), {})[key] = value
        for category in sorted(categories):
            ColorPrint.green(f"\n[{category}]")
            for key, value in sorted(categories[category].items()):
                ColorPrint.plain(f"  {key}: {value}")
        ColorPrint.blue("=" * 70 + "\n")


speech_config = SpeechConfig()


__all__ = ["SpeechConfig", "speech_config"]
