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
Build Entry Point
Handles build operation execution with unified system integration
"""

import os
import sys
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional

from core.build_system import FlutterBloomBuildSystem
from shared.data_exchange.unified_variable_system import unified_vars
from utils.print_helper import PrintHelper


class BuildEntryPoint:
    """
    Entry point for build operations with environment management
    """

    def __init__(self):
        """Initialize build entry point"""
        # PrintHelper is now a static class
        self.current_dir = Path.cwd()
        self.user_cache_dir = Path.home() / ".core_node" / ".flutter_build" / ".cache" / "copy_flag_dir"
        self.temp_build_dir_file = self.user_cache_dir / "temp_build_dir.txt"

    def execute_build(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute build operation with given parameters

        Args:
            parameters: Build parameters

        Returns:
            Build operation result
        """
        try:
            PrintHelper.header("Starting Build Operation", "BUILD-ENTRY")

            # Initialize environment
            if not self._initialize_build_environment():
                return {"success": False, "error": "Build environment initialization failed"}

            # Log build parameters
            PrintHelper.info("Build parameters:", "BUILD-ENTRY")
            for key, value in parameters.items():
                PrintHelper.info(f"  {key}: {value}", "BUILD-ENTRY")

            # Check execution context
            if self._is_in_compile_directory():
                return self._handle_compile_directory_mode()
            else:
                return self._handle_normal_directory_mode()

        except Exception as e:
            error_message = f"Build entry point error: {e}"
            PrintHelper.error(error_message, "BUILD-ENTRY")
            return {"success": False, "error": error_message}

    def _initialize_build_environment(self) -> bool:
        """Initialize build environment"""
        try:
            PrintHelper.info("Initializing build environment...", "BUILD-PREFLIGHT")

            # Check Python environment
            result = subprocess.run([sys.executable, "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                python_version = result.stdout.strip()
                PrintHelper.info(f"Python detected: {python_version}", "PYTHON-SETUP")
            else:
                PrintHelper.error("Python not found", "PYTHON-SETUP")
                return False

            # Check required packages
            try:
                import pathlib
                import typing
                PrintHelper.info("Checking Python package requirements...", "PYTHON-SETUP")
                PrintHelper.success("Python environment setup completed successfully", "PYTHON-SETUP")
            except ImportError as e:
                PrintHelper.error(f"Required Python package missing: {e}", "PYTHON-SETUP")
                return False

            PrintHelper.success("Environment initialization completed successfully", "BUILD-PREFLIGHT")
            return True

        except Exception as e:
            PrintHelper.error(f"Environment initialization failed: {e}", "BUILD-PREFLIGHT")
            return False

    def _is_in_compile_directory(self) -> bool:
        """Check if we're in a compile directory"""
        current_path = str(self.current_dir)
        return ".build_dir" in current_path and "compile_factory" in current_path

    def _handle_compile_directory_mode(self) -> Dict[str, Any]:
        """Handle execution from compile directory (Phase 2)"""
        try:
            PrintHelper.info("Already in compile directory, skipping phase 1...", "BUILD-INFO")
            PrintHelper.info(f"Current directory: {self.current_dir}", "BUILD-INFO")

            # Show compilation menu
            selected_option = self._show_compilation_menu()

            if not selected_option:
                PrintHelper.info("Build cancelled by user", "BUILD-CANCELLED")
                return {"success": True, "cancelled": True}

            # Store selected option
            unified_vars.set_file_variable("SELECTED_COMPILATION_OPTION", selected_option["value"])
            unified_vars.set_file_variable("BUILD_PHASE", "compilation")

            PrintHelper.info(f"Selected: {selected_option['name']}", "BUILD-INFO")
            PrintHelper.info("Starting compilation process...", "BUILD-INFO")

            # Execute build system
            build_system = FlutterBloomBuildSystem()
            result = build_system.run()

            return result

        except Exception as e:
            return {"success": False, "error": f"Compile directory mode failed: {e}"}

    def _show_compilation_menu(self) -> Optional[Dict[str, str]]:
        """Show compilation menu"""
        options = [
            {"name": "Analyze Code - Run static analysis", "value": "analyze"},
            {"name": "Clean Build - Remove build cache and rebuild", "value": "clean"},
            {"name": "Debug Build - Development version with debugging", "value": "debug"},
            {"name": "Profile Build - Performance profiling version", "value": "profile"},
            {"name": "Release Build - Production optimized version", "value": "release"},
            {"name": "Run Tests - Execute test suite", "value": "test"}
        ]

        print("\n" + "="*50)
        print("COMPILATION MENU")
        print("="*50)

        for i, option in enumerate(options, 1):
            print(f"{i}. {option['name']}")

        print("0. Cancel")
        print()

        try:
            choice = input("Select compilation option (0-6): ").strip()
            if choice == "0":
                return None

            choice_num = int(choice)
            if 1 <= choice_num <= len(options):
                return options[choice_num - 1]
            else:
                print("Invalid selection")
                return None

        except (ValueError, KeyboardInterrupt):
            return None

    def _handle_normal_directory_mode(self) -> Dict[str, Any]:
        """Handle execution from normal directory (Phase 1)"""
        try:
            PrintHelper.header("Phase 1 - Project Copy", "BUILD-PHASE")

            # Debug: List file variables
            self._debug_list_file_variables()

            PrintHelper.info("Executing Python build system for project copy...", "BUILD-INFO")

            # Execute build system
            build_system = FlutterBloomBuildSystem()
            result = build_system.run()

            if not result["success"]:
                return result

            # Handle temp directory creation
            return self._handle_temp_directory_creation()

        except Exception as e:
            return {"success": False, "error": f"Normal directory mode failed: {e}"}

    def _debug_list_file_variables(self):
        """Debug function to list file variables"""
        temp_flutter_dir = Path.home() / ".core_node" / ".flutter_build" / ".cache" / "flutter_bloom"
        PrintHelper.info(f"Listing all file variables from: {temp_flutter_dir}", "BUILD-DEBUG")

        if temp_flutter_dir.exists():
            for file_path in temp_flutter_dir.iterdir():
                if file_path.is_file():
                    try:
                        content = file_path.read_text(encoding='utf-8').strip()
                        PrintHelper.info(f"  {file_path.name}: '{content}'", "BUILD-DEBUG")
                    except Exception:
                        PrintHelper.info(f"  {file_path.name}: <unreadable>", "BUILD-DEBUG")
        else:
            PrintHelper.warning(f"Temp directory does not exist: {temp_flutter_dir}", "BUILD-DEBUG")

    def _handle_temp_directory_creation(self) -> Dict[str, Any]:
        """Handle temp directory creation and compilation confirmation"""
        if not self.temp_build_dir_file.exists():
            PrintHelper.info("Build system completed (no directory switching required)", "BUILD-INFO")
            return {"success": True}

        try:
            temp_build_dir = self.temp_build_dir_file.read_text().strip()
            PrintHelper.warning(f"Project copied to temporary directory: {temp_build_dir}", "BUILD-INFO")

            # Compilation confirmation
            print()
            print("=" * 44)
            print("COMPILATION CONFIRMATION")
            print("=" * 44)
            print(f"Temporary directory: {temp_build_dir}")
            print()

            confirmation = input("Press ENTER or any key to continue, N to cancel: ").strip()

            if confirmation.upper() == "N":
                PrintHelper.info("Compilation cancelled by user", "BUILD-CANCELLED")
                self.temp_build_dir_file.unlink(missing_ok=True)
                return {"success": True, "cancelled": True}

            PrintHelper.success("Proceeding with compilation...", "BUILD-INFO")
            PrintHelper.info("Switching to temporary directory for continued build...", "BUILD-INFO")

            # Change to temp directory
            os.chdir(temp_build_dir)
            PrintHelper.success(f"Working directory changed to: {os.getcwd()}", "BUILD-INFO")

            # Clean up temp file
            self.temp_build_dir_file.unlink(missing_ok=True)

            # Re-execute from temp directory
            temp_main_script = Path(temp_build_dir) / "scripts" / "build_scripts" / "main.py"
            if temp_main_script.exists():
                PrintHelper.info("Re-executing main.py from temporary directory...", "BUILD-INFO")
                result = subprocess.run([sys.executable, str(temp_main_script)], cwd=temp_build_dir)

                if result.returncode != 0:
                    return {"success": False, "error": f"Second phase build failed with exit code: {result.returncode}"}
            else:
                PrintHelper.warning("main.py not found in temp directory, using fallback...", "BUILD-WARNING")
                build_system = FlutterBloomBuildSystem()
                result = build_system.run()
                if not result["success"]:
                    return result

            PrintHelper.success("Build system completed from temporary directory", "BUILD-SUCCESS")
            return {"success": True}

        except Exception as e:
            return {"success": False, "error": f"Temp directory handling failed: {e}"}