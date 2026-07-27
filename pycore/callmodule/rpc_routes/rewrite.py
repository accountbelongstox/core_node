import re

with open('__init__.py', 'r', encoding='utf-8') as f:
    content = f.read()

imports = re.findall(r'from pycore\.callmodule\.rpc_routes\.(\w+) import (\w+)', content)

new_content = '''# -*- coding: utf-8 -*-
"""
RPC Routes - Modular Route Registration for the desktop UI WS bridge.

Exports the per-area route registration functions called by
callmodule.config._init_rpc_routes. Mirrors the pycore/pyctl/speech/rpc/routes
convention: one file per functional area, each exposing a
``register_<area>_routes(server)`` function.
"""

import importlib
from pycore import ColorPrint

_ROUTE_MODULES = [
'''

for mod, func in imports:
    new_content += f'    ("pycore.callmodule.rpc_routes.{mod}", "{func}"),\n'

new_content += ''']

def register_rpc_routes(server):
    """Register every callmodule RPC v2 route group.

    Each registrar is isolated: one failure must not skip the remaining groups.
    """
    for mod_name, func_name in _ROUTE_MODULES:
        try:
            mod = importlib.import_module(mod_name)
            registrar = getattr(mod, func_name)
            registrar(server)
        except Exception as e:
            ColorPrint.yellow(f"[RPC Routes] feature_unavailable: {mod_name} failed to load: {e}")

__all__ = ["register_rpc_routes"]
'''

with open('__init__.py', 'w', encoding='utf-8') as f:
    f.write(new_content)
