# -*- coding: utf-8 -*-
"""
Shared lazy-import service for the third_party package.

The mutable cache lives in the leaf-only _package_cache module. Keeping that
state separate lets every dependency stay at file scope without a cycle.
"""

import importlib
import sys
from typing import Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyfoundations.third_party._deps import DEPENDENCY_MAP, LINUX_ONLY_PACKAGES, OPTIONAL_PACKAGES, WINDOWS_ONLY_PACKAGES
from pycore.pyfoundations.third_party._hf_helpers import get_third_package_cnocr
from pycore.pyfoundations.third_party._package_cache import _PACKAGE_CACHE
from pycore.pyfoundations.third_party._pip_runner import build_pip_install_command, run_pip_install_with_realtime_output

COMPOSED_CACHE_SUFFIX = ':composed'


def _lazy_import(package_name: str, import_statement: str):
    """
    Lazy import helper with caching and auto-install.

    Args:
        package_name: Cache key for the package
        import_statement: Python import statement to execute

    Returns:
        The imported module/package, or None (reported) when it stays unimportable
        after the one install attempt, so a missing package never blocks startup.
    """
    if package_name == 'cnocr':
        return get_third_package_cnocr()
    if package_name not in _PACKAGE_CACHE:
        local_vars = {}
        try:
            # Execute import statement and cache result
            exec(import_statement, globals(), local_vars)
            _PACKAGE_CACHE[package_name] = local_vars.get(package_name.split('.')[-1])
        except (ImportError, ModuleNotFoundError) as e:
            # Package not installed, try to install it
            pip_package = None
            # Look up in DEPENDENCY_MAP
            if package_name in DEPENDENCY_MAP:
                pip_package = DEPENDENCY_MAP[package_name]
            elif package_name in OPTIONAL_PACKAGES:
                pip_package = OPTIONAL_PACKAGES[package_name]
            elif package_name in WINDOWS_ONLY_PACKAGES:
                pip_package = WINDOWS_ONLY_PACKAGES[package_name]
            elif package_name in LINUX_ONLY_PACKAGES:
                pip_package = LINUX_ONLY_PACKAGES[package_name]

            if pip_package:
                ColorPrint.yellow(f"[INSTALL] Package '{package_name}' not found. Installing '{pip_package}'...")
                pip_cmd = build_pip_install_command(pip_package)
                run_pip_install_with_realtime_output(pip_cmd, pip_package)
                importlib.invalidate_caches()
                try:
                    exec(import_statement, globals(), local_vars)
                    _PACKAGE_CACHE[package_name] = local_vars.get(package_name.split('.')[-1])
                except (ImportError, ModuleNotFoundError) as retry_e:
                    ColorPrint.red(
                        f"[INSTALL] '{package_name}' still not importable after installing '{pip_package}' "
                        f"({retry_e}); run the pycore prerequisite installer (pyservice.sh / pyservice.ps1)"
                    )
                    _PACKAGE_CACHE[package_name] = None
            else:
                ColorPrint.red(
                    f"[INSTALL] '{package_name}' is not importable and not registered in third_party "
                    f"dependency maps: {e}"
                )
                _PACKAGE_CACHE[package_name] = None
    return _PACKAGE_CACHE[package_name]


def _pip_spec(package_name: str):
    for mapping in (DEPENDENCY_MAP, OPTIONAL_PACKAGES, WINDOWS_ONLY_PACKAGES, LINUX_ONLY_PACKAGES):
        if package_name in mapping:
            return mapping[package_name]
    return None


def _resolve_parts(package, parts: Dict[str, str]):
    for name, target in parts.items():
        module_name, _, attribute = target.partition(':')
        module = importlib.import_module(module_name)
        setattr(package, name, getattr(module, attribute) if attribute else module)
    return package


def _forget_modules(package_name: str) -> None:
    prefix = package_name + '.'
    for name in [name for name in sys.modules if name == package_name or name.startswith(prefix)]:
        del sys.modules[name]
    _PACKAGE_CACHE.pop(package_name, None)
    importlib.invalidate_caches()


def _lazy_compose(package_name: str, import_statement: str, parts: Dict[str, str]):
    """
    Lazy import plus the submodule attributes a getter exposes ({name: 'module' or 'module:attr'}).

    An installed but incompatible package (e.g. a new major version without these submodules)
    is repaired once with its policy pip spec and re-imported; if it still does not fit, the
    getter returns None (reported) so its feature degrades instead of blocking startup.
    """
    cache_key = package_name + COMPOSED_CACHE_SUFFIX
    if cache_key in _PACKAGE_CACHE:
        return _PACKAGE_CACHE[cache_key]
    package = _lazy_import(package_name, import_statement)
    composed = None
    if package is not None:
        try:
            composed = _resolve_parts(package, parts)
        except (ImportError, AttributeError) as error:
            pip_package = _pip_spec(package_name)
            ColorPrint.yellow(
                f"[INSTALL] '{package_name}' is installed but incompatible ({type(error).__name__}: {error}); "
                + (f"repairing with '{pip_package}'" if pip_package else "no pip spec to repair with")
            )
            if pip_package:
                run_pip_install_with_realtime_output(build_pip_install_command(pip_package), pip_package)
                _forget_modules(package_name)
                package = _lazy_import(package_name, import_statement)
                try:
                    composed = _resolve_parts(package, parts) if package is not None else None
                except (ImportError, AttributeError) as retry_error:
                    composed = None
                    error = retry_error
            if composed is None:
                ColorPrint.red(
                    f"[INSTALL] '{package_name}' stays incompatible ({error}); features using it are disabled; "
                    f"run the pycore prerequisite installer (pyservice.sh / pyservice.ps1)"
                )
    _PACKAGE_CACHE[cache_key] = composed
    return composed
