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
Base Platform Debugger
Abstract base class for all platform-specific debuggers
"""

import os
import sys
import subprocess
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, List, Optional

from utils.print_helper import PrintHelper


class BaseDebugger(ABC):
    """
    Abstract base class for platform-specific debuggers
    """

    def __init__(self, app: str, action: str, entry_file: str, debug_port: str):
        """
        Initialize base debugger

        Args:
            app: App name to debug
            action: Action type (debug, build)
            entry_file: Path to entry file
            debug_port: Debug port number
        """
        self.app = app
        self.action = action
        self.entry_file = entry_file
        self.debug_port = debug_port
        # PrintHelper is now a static class
        self.current_dir = Path.cwd()
        self.project_root = self._find_project_root()

    def _find_project_root(self) -> Path:
        """Find Flutter project root directory"""
        current = self.current_dir
        while current.parent != current:
            if (current / "pubspec.yaml").exists():
                return current
            current = current.parent

        # If not found, assume current directory is project root
        return self.current_dir

    def _validate_flutter_project(self) -> bool:
        """Validate that we're in a Flutter project"""
        pubspec_path = self.project_root / "pubspec.yaml"
        if not pubspec_path.exists():
            PrintHelper.error(f"pubspec.yaml not found in {self.project_root}", self.get_platform_name())
            return False
        return True

    def _validate_entry_file(self) -> bool:
        """Validate that entry file exists"""
        if not self.entry_file:
            PrintHelper.warning("No entry file specified, using default", self.get_platform_name())
            return True

        entry_path = Path(self.entry_file)
        if not entry_path.exists():
            PrintHelper.error(f"Entry file not found: {self.entry_file}", self.get_platform_name())
            return False
        return True

    def _run_command(self, command: List[str], cwd: Optional[Path] = None, capture_output: bool = False) -> Dict[str, Any]:
        """
        Run a command and return result

        Args:
            command: Command and arguments list
            cwd: Working directory
            capture_output: Whether to capture output

        Returns:
            Dict with success status, output, and error
        """
        try:
            work_dir = cwd or self.project_root
            PrintHelper.info(f"Running: {' '.join(command)}", self.get_platform_name())
            PrintHelper.info(f"Working directory: {work_dir}", self.get_platform_name())

            if capture_output:
                result = subprocess.run(
                    command,
                    cwd=work_dir,
                    capture_output=True,
                    text=True,
                    check=False
                )
                return {
                    "success": result.returncode == 0,
                    "returncode": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
            else:
                result = subprocess.run(
                    command,
                    cwd=work_dir,
                    check=False
                )
                return {
                    "success": result.returncode == 0,
                    "returncode": result.returncode
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @abstractmethod
    def get_platform_name(self) -> str:
        """Get platform name for logging"""
        pass

    @abstractmethod
    def validate_platform_requirements(self) -> bool:
        """Validate platform-specific requirements"""
        pass

    @abstractmethod
    def prepare_debug_environment(self) -> bool:
        """Prepare platform-specific debug environment"""
        pass

    @abstractmethod
    def execute_debug_command(self) -> Dict[str, Any]:
        """Execute platform-specific debug command"""
        pass

    def start_debug(self) -> Dict[str, Any]:
        """
        Main debug entry point

        Returns:
            Dict with success status and any relevant data
        """
        try:
            platform_name = self.get_platform_name()
            PrintHelper.header(f"Starting {platform_name} Debug", platform_name)

            # Validation steps
            if not self._validate_flutter_project():
                return {"success": False, "error": "Flutter project validation failed"}

            if not self._validate_entry_file():
                return {"success": False, "error": "Entry file validation failed"}

            if not self.validate_platform_requirements():
                return {"success": False, "error": f"{platform_name} requirements validation failed"}

            # Preparation
            if not self.prepare_debug_environment():
                return {"success": False, "error": f"{platform_name} environment preparation failed"}

            # Execute debug
            result = self.execute_debug_command()

            if result["success"]:
                PrintHelper.success(f"{platform_name} debug completed successfully", platform_name)
            else:
                PrintHelper.error(f"{platform_name} debug failed", platform_name)

            return result

        except Exception as e:
            error_msg = f"{self.get_platform_name()} debug error: {e}"
            PrintHelper.error(error_msg, self.get_platform_name())
            return {"success": False, "error": error_msg}