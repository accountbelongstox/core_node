#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auto Register - Automatically register module routes to RPC server

Features:
1. Auto-generate RPC routes from module registry
2. Register all methods with proper sync/async mode
3. Add route metadata (description, timeout)
"""

from typing import TYPE_CHECKING

from pycore import ColorPrint
from .module_registry import SUPPORTED_MODULES
from .module_loader import get_module_loader
from .module_call_handler import ModuleCallHandler

if TYPE_CHECKING:
    from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer


def register_module_routes(rpc_server: 'FastAPIRPCServer', debug: bool = False):
    """
    Auto-register all module routes to RPC server
    
    Args:
        rpc_server: FastAPIRPCServer instance
        debug: Enable debug logging
    """
    if debug:
        ColorPrint.blue("[AutoRegister] Starting module route registration...")
    
    # Initialize module loader and handler
    module_loader = get_module_loader(debug=debug)
    module_loader.preload_modules()
    
    module_call_handler = ModuleCallHandler(module_loader, debug=debug)
    
    registered_count = 0
    
    # Register routes for each module
    for module_name, module_config in SUPPORTED_MODULES.items():
        methods = module_config.get("methods", {})
        
        for method_name, method_config in methods.items():
            route_name = f"{module_name}.{method_name}"
            
            # Create route handler closure
            def create_handler(mod=module_name, meth=method_name):
                async def handler(**params):
                    return await module_call_handler.call_method(mod, meth, params)
                return handler
            
            handler = create_handler()
            
            # Register route
            rpc_server.route(
                name=route_name,
                handler=handler,
                sync=method_config.get("sync", False),
                description=method_config.get("description", "")
            )
            
            registered_count += 1
            
            if debug:
                sync_mode = "sync" if method_config.get("sync") else "async"
                ColorPrint.green(f"[AutoRegister] Registered: {route_name} ({sync_mode})")
    
    ColorPrint.blue(f"[AutoRegister] Registered {registered_count} module routes")
    
    return module_call_handler


__all__ = ['register_module_routes']
