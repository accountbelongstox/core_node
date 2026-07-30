# -*- coding: utf-8 -*-
"""
Shared lazy-import service for the third_party package.

The mutable cache lives in the leaf-only _package_cache module. Keeping that
state separate lets every dependency stay at file scope without a cycle.
"""

import importlib

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyfoundations.third_party._deps import DEPENDENCY_MAP, OPTIONAL_PACKAGES, WINDOWS_ONLY_PACKAGES
from pycore.pyfoundations.third_party._hf_helpers import get_third_package_cnocr
from pycore.pyfoundations.third_party._package_cache import _PACKAGE_CACHE
from pycore.pyfoundations.third_party._pip_runner import build_pip_install_command, run_pip_install_with_realtime_output


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
