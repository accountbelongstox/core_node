# -*- coding: utf-8 -*-
"""Qt CONFIG helper: get/set with notify_config_changed (same semantics as ConfigBinding)."""

from typing import Any

from providor.providor_index import get_config_value_safe, set_config_value_async, queue_config_save
from share.values.config_change_hub import get_config_change_hub


def config_get(key_path: str, default: Any = None) -> Any:
    """Thread-safe get from CONFIG."""
    return get_config_value_safe(key_path, default)


def config_set(key_path: str, value: Any, notify: bool = True) -> None:
    """Write to CONFIG (async), queue save, optionally notify hub for rebinds/UI sync."""
    set_config_value_async(key_path, value)
    queue_config_save()
    if notify:
        get_config_change_hub().notify_config_changed(key_path)
