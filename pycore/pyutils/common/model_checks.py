# -*- coding: utf-8 -*-
"""Shared boot-check primitives (cheap: no network, no weight loading)."""

import importlib.metadata
import importlib.util
from typing import Iterable, Optional

from pycore.pyfoundations.python_package_policy import DEPENDENCY_MAP
from pycore.pyutils.common.coded_message import CodedMessage
from pycore.pyutils.common.model_manifest import BootVerdict, blocked, deferred, ready


def module_present(module: str) -> bool:
    """True when a module can be imported, without importing it or installing it.

    Each dotted prefix is checked in order, so a missing parent package yields
    False instead of the ModuleNotFoundError ``find_spec`` raises."""
    parts = [part for part in str(module or "").split(".") if part]
    if not parts:
        return False
    for index in range(1, len(parts) + 1):
        if importlib.util.find_spec(".".join(parts[:index])) is None:
            return False
    return True


def dist_version(distribution: str) -> Optional[str]:
    """Installed version of a distribution, or None when it is not installed."""
    if not distribution:
        return None
    try:
        return importlib.metadata.version(distribution)
    except importlib.metadata.PackageNotFoundError:
        return None


def packages_check(modules: Iterable[str], missing: CodedMessage) -> BootVerdict:
    """Ready when every module is present. A missing module the dependency policy
    installs on first use is ``deferred``; any other missing module is ``blocked``."""
    absent = [module for module in modules if not module_present(module)]
    if not absent:
        return ready()
    if all(module in DEPENDENCY_MAP for module in absent):
        return deferred(missing)
    return blocked(missing)


__all__ = ["dist_version", "module_present", "packages_check"]
