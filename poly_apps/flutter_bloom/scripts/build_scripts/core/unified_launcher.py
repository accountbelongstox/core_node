#!/usr/bin/env python3
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

"""
Unified Flutter Launcher
Central launcher that integrates all functionality from original start.py
"""

import sys
from typing import Dict, Any, Optional

from core.decision_engine import FlutterDecisionEngine
from core.debug_entry import DebugEntryPoint
from core.build_entry import BuildEntryPoint
from utils.print_helper import PrintHelper


class FlutterUnifiedLauncher:
    """
    Unified launcher that handles the complete workflow
    """

    def __init__(self):
        """Initialize the unified launcher"""
        # PrintHelper is now a static class
        self.decision_engine = FlutterDecisionEngine()
        self.debug_entry = DebugEntryPoint()
        self.build_entry = BuildEntryPoint()

    def launch_interactive_mode(self) -> Dict[str, Any]:
        """
        Launch interactive mode with app selection (equivalent to original start.py)

        Returns:
            Launch result
        """
        try:
            PrintHelper.header("Flutter Bloom Unified System", "LAUNCHER")

            # Initialize environment
            if not self.decision_engine.initialize_environment():
                return {"success": False, "error": "Environment initialization failed"}

            # Perform app selection
            selection_result = self.decision_engine.perform_app_selection()
            if not selection_result.get("success"):
                return selection_result

            selection_data = selection_result["selection"]

            # Prepare operation context
            context = self.decision_engine.prepare_operation_context(selection_data)

            # Log verification info
            self.decision_engine.log_verification_info()

            # Execute operation based on context
            return self._execute_operation(context)

        except Exception as e:
            error_message = f"Unified launcher error: {e}"
            PrintHelper.error(error_message, "LAUNCHER")
            return {"success": False, "error": error_message}

    def launch_direct_mode(self, mode: str, **kwargs) -> Dict[str, Any]:
        """
        Launch direct mode with parameters (equivalent to command line mode)

        Args:
            mode: Operation mode ('debug' or 'build')
            **kwargs: Additional parameters

        Returns:
            Launch result
        """
        try:
            PrintHelper.header(f"Flutter Bloom {mode.title()} Mode", "LAUNCHER")

            # Initialize environment
            if not self.decision_engine.initialize_environment():
                return {"success": False, "error": "Environment initialization failed"}

            # Prepare context from parameters
            context = self._prepare_direct_context(mode, **kwargs)

            # Execute operation
            return self._execute_operation(context)

        except Exception as e:
            error_message = f"Direct launcher error: {e}"
            PrintHelper.error(error_message, "LAUNCHER")
            return {"success": False, "error": error_message}

    def _prepare_direct_context(self, mode: str, **kwargs) -> Dict[str, Any]:
        """Prepare context for direct mode"""
        context = {
            "mode": mode,
            "app": kwargs.get("app", ""),
            "platform": kwargs.get("platform", "web"),
            "action": kwargs.get("action", "debug"),
            "entry_file": kwargs.get("entry_file", ""),
            "port": kwargs.get("port", "10000"),
            "index": kwargs.get("index", "0"),
            "is_all_option": kwargs.get("is_all_option", False)
        }
        return context

    def _execute_operation(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute operation based on context

        Args:
            context: Operation context

        Returns:
            Operation result
        """
        try:
            mode = context["mode"]

            if mode == "debug":
                PrintHelper.info("Executing debug operation...", "LAUNCHER")
                parameters = self.decision_engine.get_debug_parameters(context)
                result = self.debug_entry.execute_debug(parameters)
            elif mode == "build":
                PrintHelper.info("Executing build operation...", "LAUNCHER")
                parameters = self.decision_engine.get_build_parameters(context)
                result = self.build_entry.execute_build(parameters)
            else:
                return {"success": False, "error": f"Unknown operation mode: {mode}"}

            if result["success"]:
                PrintHelper.success(f"{mode.title()} operation completed successfully", "LAUNCHER")
            else:
                PrintHelper.error(f"{mode.title()} operation failed: {result.get('error', 'Unknown error')}", "LAUNCHER")

            return result

        except Exception as e:
            error_message = f"Operation execution error: {e}"
            PrintHelper.error(error_message, "LAUNCHER")
            return {"success": False, "error": error_message}

    def get_system_info(self) -> Dict[str, Any]:
        """
        Get system information

        Returns:
            System information dictionary
        """
        return {
            "scanner": self.decision_engine.scanner.get_project_info(),
            "debug_platforms": self.debug_entry.get_supported_platforms(),
            "cached_selection": self.decision_engine.selector.get_cached_selection()
        }