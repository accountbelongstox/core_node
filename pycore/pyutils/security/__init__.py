# -*- coding: utf-8 -*-
"""Security utilities exposed without loading optional cryptography eagerly."""

from importlib import import_module
from typing import Dict, Tuple


_EXPORTS: Dict[str, Tuple[str, str]] = {
    "get_hardware_machine_id": (
        "pycore.pyutils.security.machine_id",
        "get_hardware_machine_id",
    ),
    "get_machine_id": ("pycore.pyutils.security.machine_id", "get_machine_id"),
    "VERIFY_PREFIX": (
        "pycore.pyutils.security.password_cipher",
        "VERIFY_PREFIX",
    ),
    "decrypt_password": (
        "pycore.pyutils.security.password_cipher",
        "decrypt_password",
    ),
    "encrypt_password": (
        "pycore.pyutils.security.password_cipher",
        "encrypt_password",
    ),
    "is_likely_ciphertext": (
        "pycore.pyutils.security.password_cipher",
        "is_likely_ciphertext",
    ),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    export = _EXPORTS.get(name)
    if export is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module_name, attribute_name = export
    value = getattr(import_module(module_name), attribute_name)
    globals()[name] = value
    return value


def __dir__():
    return sorted(set(globals()) | set(__all__))
