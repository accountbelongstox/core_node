#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Homepage Routes - Display available routes and parameters

Provides user-friendly web interface showing:
1. All available modules and methods
2. Method parameters and types
3. Example requests/responses
4. Route statistics
"""

from typing import TYPE_CHECKING, Dict, Any
from fastapi.responses import RedirectResponse

from .module_registry import SUPPORTED_MODULES, get_all_modules

if TYPE_CHECKING:
    from fastapi import FastAPI


def register_homepage_routes(app: 'FastAPI'):
    """
    Register homepage and API documentation routes

    Args:
        app: FastAPI application instance
    """

    @app.get("/")
    async def homepage():
        """Homepage - Redirect to Desktop Manager UI"""
        return RedirectResponse(url="/desktop/index.html", status_code=302)
    
    @app.get("/api/modules")
    async def list_modules():
        """API endpoint - List all available modules"""
        return {
            "modules": [
                {
                    "name": name,
                    "description": config.get("description", ""),
                    "methods": list(config.get("methods", {}).keys())
                }
                for name, config in SUPPORTED_MODULES.items()
            ]
        }
    
    @app.get("/api/modules/{module_name}")
    async def get_module_info(module_name: str):
        """API endpoint - Get module detailed information"""
        if module_name not in SUPPORTED_MODULES:
            return {"error": f"Module '{module_name}' not found"}
        
        module_config = SUPPORTED_MODULES[module_name]
        return {
            "name": module_name,
            "description": module_config.get("description", ""),
            "module_path": module_config.get("module_path", ""),
            "methods": module_config.get("methods", {})
        }


def generate_homepage_html() -> Dict[str, Any]:
    """Generate homepage data"""
    modules_info = []
    
    for module_name, module_config in SUPPORTED_MODULES.items():
        methods_info = []
        
        for method_name, method_config in module_config.get("methods", {}).items():
            route_name = f"{module_name}.{method_name}"
            
            # Build parameter info
            params_info = []
            for param_name, param_spec in method_config.get("params", {}).items():
                params_info.append({
                    "name": param_name,
                    "type": param_spec.get("type", "any"),
                    "required": param_spec.get("required", False),
                    "default": param_spec.get("default"),
                    "description": param_spec.get("description", "")
                })
            
            methods_info.append({
                "name": method_name,
                "route": route_name,
                "description": method_config.get("description", ""),
                "sync": method_config.get("sync", False),
                "timeout": method_config.get("timeout", 30.0),
                "params": params_info,
                "example": method_config.get("example", {})
            })
        
        modules_info.append({
            "name": module_name,
            "description": module_config.get("description", ""),
            "preload": module_config.get("preload", False),
            "methods": methods_info
        })
    
    return {
        "title": "Pycore RPC Server - Module Routes",
        "version": "2.0.0",
        "modules": modules_info,
        "endpoints": {
            "rpc_call": "POST /rpc/{route}",
            "rpc_query": "GET /rpc/query/{request_id}",
            "rpc_routes": "GET /rpc/routes",
            "websocket": "WS /rpc/ws"
        }
    }


__all__ = ['register_homepage_routes', 'generate_homepage_html']
