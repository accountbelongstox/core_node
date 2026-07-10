# -*- coding: utf-8 -*-
"""
Shared mutable singleton root for the third_party package.

_PACKAGE_CACHE is THE single package cache shared by every getter and by
_lazy_import. It MUST live in exactly this module and be imported everywhere
else ("from ._cache import _PACKAGE_CACHE") - never re-declared - or lazy
caching and cnocr cache-clear break silently.

_lazy_import is the lazy import helper with auto-install. Its cross-package
dependencies (get_third_package_cnocr, DEPENDENCY_MAP, build_pip_install_command,
...) are imported DEFERRED inside the function so that _cache can be imported
FIRST (leaf) without triggering a circular import.
"""

import importlib

# Global cache for loaded packages. THE shared mutable singleton root.
# Mutated by _lazy_import, all getters, and _clear_cnocr_cache.
_PACKAGE_CACHE = {}


def _lazy_import(package_name: str, import_statement: str):
    """
    Lazy import helper with caching and auto-install.

    Args:
        package_name: Cache key for the package
        import_statement: Python import statement to execute

    Returns:
        The imported module/package
    """
    if package_name == 'cnocr':
        # cnocr has its own GPU/CPU-aware loader; defer import to avoid a cycle
        # (_hf_helpers imports _PACKAGE_CACHE from this module).
        from ._hf_helpers import get_third_package_cnocr
        return get_third_package_cnocr()
    if package_name not in _PACKAGE_CACHE:
        local_vars = {}
        try:
            # Execute import statement and cache result
            exec(import_statement, globals(), local_vars)
            _PACKAGE_CACHE[package_name] = local_vars.get(package_name.split('.')[-1])
        except (ImportError, ModuleNotFoundError) as e:
            # Deferred imports break the load-time cycle (this module is leaf-first).
            from ._deps import DEPENDENCY_MAP, OPTIONAL_PACKAGES, WINDOWS_ONLY_PACKAGES
            from ._pip_runner import build_pip_install_command, run_pip_install_with_realtime_output
            from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
            # Package not installed, try to install it
            pip_package = None
            # Look up in DEPENDENCY_MAP
            if package_name in DEPENDENCY_MAP:
                pip_package = DEPENDENCY_MAP[package_name]
            elif package_name in OPTIONAL_PACKAGES:
                pip_package = OPTIONAL_PACKAGES[package_name]
            elif package_name in WINDOWS_ONLY_PACKAGES:
                pip_package = WINDOWS_ONLY_PACKAGES[package_name]

            if pip_package:
                ColorPrint.yellow(f"[INSTALL] Package '{package_name}' not found. Installing '{pip_package}'...")
                pip_cmd = build_pip_install_command(pip_package)
                run_pip_install_with_realtime_output(pip_cmd, pip_package)
                importlib.invalidate_caches()
                try:
                    exec(import_statement, globals(), local_vars)
                    _PACKAGE_CACHE[package_name] = local_vars.get(package_name.split('.')[-1])
                except (ImportError, ModuleNotFoundError) as retry_e:
                    raise retry_e
            else:
                # Package not in any dependency map, re-raise original error
                raise e
    return _PACKAGE_CACHE[package_name]
