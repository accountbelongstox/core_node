#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Module Call Handler - Unified module calling interface

Provides:
1. Unified entry point for all module calls
2. Parameter validation based on registry
3. Async/sync method handling
4. Error handling and formatting
"""

import asyncio
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from .module_registry import get_module_info, get_method_info, SUPPORTED_MODULES
from .module_loader import ModuleLoader


class ModuleCallHandler:
    """Unified module call handler"""
    
    def __init__(self, module_loader: ModuleLoader, debug: bool = False):
        self.module_loader = module_loader
        self.debug = debug
        
        if self.debug:
            ColorPrint.blue("[ModuleCallHandler] Initialized")
    
    async def call_method(
        self,
        module: str,
        method: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Call module method with unified interface
        
        Args:
            module: Module name
            method: Method name
            params: Method parameters
            
        Returns:
            Method execution result
            
        Raises:
            ValueError: Module or method not supported
            Exception: Method execution error
        """
        params = params or {}
        
        # Validate module
        if module not in SUPPORTED_MODULES:
            raise ValueError(
                f"Module '{module}' not supported. "
                f"Supported modules: {list(SUPPORTED_MODULES.keys())}"
            )
        
        # Validate method
        method_info = get_method_info(module, method)
        if not method_info:
            module_info = get_module_info(module)
            supported_methods = list(module_info.get("methods", {}).keys())
            raise ValueError(
                f"Method '{method}' not supported for module '{module}'. "
                f"Supported methods: {supported_methods}"
            )
        
        if self.debug:
            ColorPrint.blue(f"[ModuleCallHandler] Calling {module}.{method} with params: {list(params.keys())}")
        
        # Get module instance
        instance = self.module_loader.get_instance(module)
        
        # For async context managers (like GoogleTranslator)
        if hasattr(instance, '__aenter__') and hasattr(instance, '__aexit__'):
            async with instance as ctx:
                return await self._execute_method(ctx, method, params, method_info)
        else:
            return await self._execute_method(instance, method, params, method_info)
    
    async def _execute_method(
        self,
        instance: Any,
        method: str,
        params: Dict[str, Any],
        method_info: Dict[str, Any]
    ) -> Any:
        """
        Execute method on instance
        
        Args:
            instance: Module instance
            method: Method name
            params: Method parameters
            method_info: Method metadata
            
        Returns:
            Method execution result
        """
        # Get method function
        if not hasattr(instance, method):
            raise AttributeError(f"Instance has no method '{method}'")
        
        func = getattr(instance, method)
        
        # Execute based on async/sync
        if asyncio.iscoroutinefunction(func):
            result = await func(**params)
        else:
            result = func(**params)
        
        # Convert dataclass to dict if needed
        if hasattr(result, '__dataclass_fields__'):
            if hasattr(result, 'to_dict'):
                return result.to_dict()
            else:
                return {
                    field: getattr(result, field)
                    for field in result.__dataclass_fields__
                }
        
        # Convert list of dataclasses
        if isinstance(result, list) and result and hasattr(result[0], '__dataclass_fields__'):
            return [
                item.to_dict() if hasattr(item, 'to_dict') else {
                    field: getattr(item, field)
                    for field in item.__dataclass_fields__
                }
                for item in result
            ]
        
        return result
    
    def validate_params(
        self,
        module: str,
        method: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate and fill default parameters
        
        Args:
            module: Module name
            method: Method name
            params: Input parameters
            
        Returns:
            Validated parameters with defaults
            
        Raises:
            ValueError: Missing required parameter or invalid type
        """
        method_info = get_method_info(module, method)
        if not method_info:
            return params
        
        param_specs = method_info.get("params", {})
        validated = {}
        
        for param_name, param_spec in param_specs.items():
            # Check required
            if param_spec.get("required", False):
                if param_name not in params:
                    raise ValueError(
                        f"Missing required parameter: {param_name} "
                        f"({param_spec.get('description', 'no description')})"
                    )
            
            # Use provided value or default
            if param_name in params:
                validated[param_name] = params[param_name]
            elif "default" in param_spec:
                validated[param_name] = param_spec["default"]
        
        return validated


__all__ = ['ModuleCallHandler']
