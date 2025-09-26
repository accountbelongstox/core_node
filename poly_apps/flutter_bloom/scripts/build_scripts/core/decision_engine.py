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
Unified Decision Engine
Central decision maker for routing between debug and build operations
"""

from typing import Dict, Any, Optional
from pathlib import Path

from core.app_scanner import FlutterAppScanner
from core.app_selector import FlutterAppSelector
from utils.print_helper import PrintHelper
from shared.data_exchange.unified_variable_system import unified_vars


class FlutterDecisionEngine:
    """
    Central decision engine that determines which operations to perform
    """

    def __init__(self):
        """Initialize the decision engine"""
        # PrintHelper is now a static class
        self.scanner = FlutterAppScanner()
        self.selector = FlutterAppSelector(self.scanner)

    def initialize_environment(self) -> bool:
        """
        Initialize the Flutter development environment

        Returns:
            True if environment is ready, False otherwise
        """
        try:
            PrintHelper.header("Initializing Flutter environment...", "DECISION-ENGINE")

            # Validate Flutter project
            if not self.scanner.validate_project():
                PrintHelper.error("Invalid Flutter project structure", "DECISION-ENGINE")
                return False

            # Get project info
            project_info = self.scanner.get_project_info()
            PrintHelper.info(f"Project root: {project_info['root']}", "DECISION-ENGINE")
            PrintHelper.info(f"Applications found: {project_info['app_count']}", "DECISION-ENGINE")

            if project_info['app_count'] == 0:
                PrintHelper.warning("No Flutter applications found", "DECISION-ENGINE")

            PrintHelper.success("Environment initialization completed", "DECISION-ENGINE")
            return True

        except Exception as e:
            PrintHelper.error(f"Environment initialization failed: {e}", "DECISION-ENGINE")
            return False

    def perform_app_selection(self) -> Dict[str, Any]:
        """
        Perform interactive application selection

        Returns:
            Selection result with app information
        """
        try:
            PrintHelper.info("Starting application selection process...", "DECISION-ENGINE")

            # Check if we have cached selection and it's still valid
            cached_selection = self.selector.get_cached_selection()
            if cached_selection and self._is_selection_valid(cached_selection):
                PrintHelper.info(f"Using cached selection: {cached_selection['app']}", "DECISION-ENGINE")
                # Optionally allow user to override cached selection
                # For now, we'll always show the selector for consistency with original behavior

            # Perform interactive selection
            selection_result = self.selector.select_application()

            if not selection_result.get("success"):
                return selection_result

            selection_data = selection_result["selection"]
            PrintHelper.success("Application selection completed:", "DECISION-ENGINE")
            PrintHelper.info(f"  App: {selection_data['app']}", "DECISION-ENGINE")
            PrintHelper.info(f"  Action: {selection_data['action']}", "DECISION-ENGINE")
            PrintHelper.info(f"  Platform: {selection_data['platform']}", "DECISION-ENGINE")

            return selection_result

        except Exception as e:
            PrintHelper.error(f"App selection failed: {e}", "DECISION-ENGINE")
            return {"success": False, "error": str(e)}

    def _is_selection_valid(self, selection: Dict[str, Any]) -> bool:
        """
        Validate cached selection data

        Args:
            selection: Cached selection data

        Returns:
            True if selection is valid, False otherwise
        """
        try:
            app_name = selection.get("app")
            if not app_name:
                return False

            # Check if app still exists
            app_info = self.scanner.get_app_by_name(app_name)
            if not app_info:
                return False

            # Check if entry file exists
            entry_file = Path(selection.get("entry_file", ""))
            if entry_file and not entry_file.exists():
                PrintHelper.warning(f"Entry file not found: {entry_file}", "DECISION-ENGINE")
                # Still valid, just warning

            return True

        except Exception:
            return False

    def determine_operation_mode(self, selection_data: Dict[str, Any]) -> str:
        """
        Determine which operation mode to use based on selection

        Args:
            selection_data: Application selection data

        Returns:
            Operation mode: 'debug' or 'build'
        """
        action = selection_data.get("action", "Debug").lower()
        return "debug" if action == "debug" else "build"

    def prepare_operation_context(self, selection_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare context for the selected operation

        Args:
            selection_data: Application selection data

        Returns:
            Operation context dictionary
        """
        operation_mode = self.determine_operation_mode(selection_data)

        context = {
            "mode": operation_mode,
            "app": selection_data["app"],
            "platform": selection_data["platform"].lower(),
            "action": selection_data["action"],
            "entry_file": selection_data["entry_file"],
            "port": selection_data["port"],
            "index": selection_data["index"],
            "is_all_option": selection_data.get("is_all_option", False)
        }

        # Store in unified variables for other systems to access
        unified_vars.set_file_variable("OPERATION_MODE", operation_mode)
        unified_vars.set_file_variable("OPERATION_CONTEXT_APP", context["app"])
        unified_vars.set_file_variable("OPERATION_CONTEXT_PLATFORM", context["platform"])
        unified_vars.set_file_variable("OPERATION_CONTEXT_ACTION", context["action"])

        return context

    def get_debug_parameters(self, context: Dict[str, Any]) -> Dict[str, str]:
        """
        Get parameters for debug operation

        Args:
            context: Operation context

        Returns:
            Debug parameters dictionary
        """
        return {
            "platform": context["platform"],
            "app": context["app"],
            "action": context["action"].lower(),
            "entry_file": context["entry_file"],
            "port": context["port"]
        }

    def get_build_parameters(self, context: Dict[str, Any]) -> Dict[str, str]:
        """
        Get parameters for build operation

        Args:
            context: Operation context

        Returns:
            Build parameters dictionary
        """
        return {
            "app": context["app"],
            "platform": context["platform"],
            "mode": "build",
            "entry_file": context["entry_file"]
        }

    def should_show_verification_info(self) -> bool:
        """
        Determine if verification information should be displayed

        Returns:
            True if verification info should be shown
        """
        return True  # For now, always show verification

    def get_verification_info(self) -> Dict[str, str]:
        """
        Get verification information for display

        Returns:
            Dictionary of verification information
        """
        verification_keys = [
            "KEY_SELECTED_APP",
            "KEY_SELECTED_ACTION",
            "KEY_SELECTED_PLATFORM",
            "KEY_CURRENT_ACTIVE_APP",
            "KEY_CURRENT_ACTIVE_ACTION",
            "KEY_CURRENT_ACTIVE_PLATFORM",
            "KEY_APP_NAME",
            "KEY_BUILD_ACTION",
            "KEY_BUILD_PLATFORM",
            "KEY_SELECTED_ENTRY_FILE",
            "KEY_APP_INDEX",
            "KEY_DEBUG_PORT"
        ]

        verification_data = {}
        for key in verification_keys:
            value = unified_vars.get_file_variable(key, "NOT_SET")
            verification_data[key] = value

        return verification_data

    def log_verification_info(self):
        """Log verification information"""
        if not self.should_show_verification_info():
            return

        PrintHelper.header("VERIFICATION: Reading back all variables BEFORE operation execution", "VERIFICATION")

        verification_data = self.get_verification_info()
        for key, value in verification_data.items():
            PrintHelper.info(f"{key}: '{value}'", "VERIFICATION")

        PrintHelper.info("=" * 54, "VERIFICATION")