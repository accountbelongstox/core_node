# -*- coding: utf-8 -*-
"""
Module Loader - Dynamic module loading and calling
"""

import sys
import importlib
import importlib.util
from pathlib import Path
from typing import Any, Optional

from ..global_config import get_global_config


class ModuleLoader:
    """
    Handles dynamic loading and calling of pycore modules.

    Supports two loading methods:
    1. Standard import: importlib.import_module()
    2. File import: Direct file loading (bypass __init__)
    """

    def __init__(self):
        self.config = get_global_config()

    def load_module_standard(self, module_path: str):
        """
        Load module using standard import.

        Args:
            module_path: Module path (e.g., 'pycore.pyutils.ocr.ocr_manager')

        Returns:
            Loaded module object
        """
        return importlib.import_module(module_path)

    def load_module_from_file(self, file_path: str, module_name: Optional[str] = None):
        """
        Load module directly from file path.

        Args:
            file_path: Relative or absolute path to .py file
            module_name: Optional module name (default: use file stem)

        Returns:
            Loaded module object
        """
        # Convert to absolute path
        if not Path(file_path).is_absolute():
            full_path = self.config.pycore_root / file_path
        else:
            full_path = Path(file_path)

        if not full_path.exists():
            raise FileNotFoundError(f"Module file not found: {full_path}")

        # Use file stem as module name if not provided
        if module_name is None:
            module_name = full_path.stem

        # Load module from file
        spec = importlib.util.spec_from_file_location(module_name, full_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)

        return module

    def get_function_from_module(self, module, function_path: str):
        """
        Navigate to function/attribute in module.

        Args:
            module: Loaded module object
            function_path: Dot-separated path to function (e.g., 'manager.get_data')

        Returns:
            Function/attribute object
        """
        parts = function_path.split('.')
        obj = module

        for part in parts:
            obj = getattr(obj, part)

        return obj

    def call_module_function(
        self,
        module_path: str,
        function_path: str,
        args: list = None,
        kwargs: dict = None,
        use_file_import: bool = False
    ) -> Any:
        """
        Dynamically call a module function.

        Args:
            module_path: Module path or file path
            function_path: Dot-separated path to function
            args: Positional arguments
            kwargs: Keyword arguments
            use_file_import: Use file import instead of standard import

        Returns:
            Function result

        Raises:
            ValueError: If module is not allowed
            ImportError: If module/function not found
            Exception: If function call fails
        """
        if args is None:
            args = []
        if kwargs is None:
            kwargs = {}

        # Check if module is allowed
        allowed, reason = self.config.is_module_allowed(module_path)
        if not allowed:
            raise ValueError(f"Module call denied: {reason}")

        # Load module
        if use_file_import and self.config.allow_file_import:
            module = self.load_module_from_file(module_path)
        else:
            module = self.load_module_standard(module_path)

        # Get function
        func = self.get_function_from_module(module, function_path)

        # Call function
        result = func(*args, **kwargs)

        return result
