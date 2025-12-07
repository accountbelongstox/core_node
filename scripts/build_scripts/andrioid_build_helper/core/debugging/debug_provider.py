# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

"""
Debug Provider
Provides debug configuration and logging functionality for the build system
"""

import os
import sys
import traceback
from typing import Any, Optional
from datetime import datetime

class DebugProvider:
    """Central debug configuration and logging provider"""

    def __init__(self, debug_enabled: bool = True):
        """Initialize debug provider

        Args:
            debug_enabled (bool): Whether debug mode is enabled by default
        """
        self._debug_enabled = debug_enabled
        self._log_file = None
        self._log_buffer = []

        # Initialize log file if debug is enabled
        if self._debug_enabled:
            self._init_log_file()

    def _init_log_file(self) -> None:
        """Initialize log file for debug output"""
        try:
            script_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            log_dir = os.path.join(script_dir, ".debug_logs")

            if not os.path.exists(log_dir):
                os.makedirs(log_dir)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_filename = f"build_debug_{timestamp}.log"
            self._log_file = os.path.join(log_dir, log_filename)

            # Write initial log entry
            with open(self._log_file, 'w', encoding='utf-8') as f:
                f.write(f"=== Flutter Bloom Build System Debug Log ===\n")
                f.write(f"Started at: {datetime.now().isoformat()}\n")
                f.write(f"Python Version: {sys.version}\n")
                f.write(f"Working Directory: {os.getcwd()}\n")
                f.write("=" * 60 + "\n\n")

        except Exception as e:
            print(f"[DEBUG INIT ERROR] Failed to initialize log file: {e}")

    def _write_to_log(self, message: str) -> None:
        """Write message to log file"""
        if self._log_file:
            try:
                with open(self._log_file, 'a', encoding='utf-8') as f:
                    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                    f.write(f"[{timestamp}] {message}\n")
                    f.flush()
            except Exception:
                pass  # Silently fail to avoid disrupting main process

    def is_debug_enabled(self) -> bool:
        """Check if debug mode is enabled"""
        return self._debug_enabled

    def enable_debug(self) -> None:
        """Enable debug mode"""
        if not self._debug_enabled:
            self._debug_enabled = True
            self._init_log_file()
            self.debug("Debug mode enabled")

    def disable_debug(self) -> None:
        """Disable debug mode"""
        if self._debug_enabled:
            self.debug("Debug mode disabled")
            self._debug_enabled = False

    def debug(self, message: str, **kwargs) -> None:
        """Print debug message if debug mode is enabled

        Args:
            message (str): Debug message
            **kwargs: Additional context variables
        """
        if not self._debug_enabled:
            return

        formatted_message = f"[DEBUG] {message}"

        # Add context variables if provided
        if kwargs:
            context_str = ", ".join([f"{k}={v}" for k, v in kwargs.items()])
            formatted_message += f" ({context_str})"

        print(formatted_message)
        self._write_to_log(formatted_message)

    def info(self, message: str) -> None:
        """Print info message (always shown)

        Args:
            message (str): Info message
        """
        formatted_message = f"[INFO] {message}"
        print(formatted_message)
        self._write_to_log(formatted_message)

    def success(self, message: str) -> None:
        """Print success message (always shown)

        Args:
            message (str): Success message
        """
        formatted_message = f"[SUCCESS] {message}"
        print(formatted_message)
        self._write_to_log(formatted_message)

    def warning(self, message: str) -> None:
        """Print warning message (always shown)

        Args:
            message (str): Warning message
        """
        formatted_message = f"[WARNING] {message}"
        print(formatted_message)
        self._write_to_log(formatted_message)

    def error(self, message: str, exception: Optional[Exception] = None) -> None:
        """Print error message (always shown)

        Args:
            message (str): Error message
            exception (Optional[Exception]): Exception object for traceback
        """
        formatted_message = f"[ERROR] {message}"
        print(formatted_message)
        self._write_to_log(formatted_message)

        if exception and self._debug_enabled:
            traceback_str = traceback.format_exception(type(exception), exception, exception.__traceback__)
            traceback_message = "".join(traceback_str)
            print(f"[ERROR TRACEBACK]\n{traceback_message}")
            self._write_to_log(f"[ERROR TRACEBACK]\n{traceback_message}")

    def step(self, step_num: int, description: str) -> None:
        """Print formatted step information

        Args:
            step_num (int): Step number
            description (str): Step description
        """
        separator = "=" * (len(description) + 10)
        step_message = f"\n[STEP {step_num}] {description}\n{separator}"
        print(step_message)
        self._write_to_log(step_message)

    def variable_exchange_debug(self, action: str, name: str, value: Any = None) -> None:
        """Debug variable exchange operations

        Args:
            action (str): Action performed (get/set/clear)
            name (str): Variable name
            value (Any): Variable value (for set operations)
        """
        if not self._debug_enabled:
            return

        if action == "set" and value is not None:
            self.debug(f"Variable Exchange: SET {name} = {value}")
        elif action == "get":
            self.debug(f"Variable Exchange: GET {name} = {value}")
        elif action == "clear":
            self.debug(f"Variable Exchange: CLEAR {name}")
        else:
            self.debug(f"Variable Exchange: {action.upper()} {name}")

    def path_debug(self, path_type: str, path: str, exists: bool = None) -> None:
        """Debug path operations

        Args:
            path_type (str): Type of path (source, target, config, etc.)
            path (str): Path being processed
            exists (bool): Whether path exists (if checked)
        """
        if not self._debug_enabled:
            return

        existence_info = ""
        if exists is not None:
            existence_info = f" (exists: {exists})"

        self.debug(f"Path {path_type}: {path}{existence_info}")

    def process_debug(self, process_name: str, details: dict = None) -> None:
        """Debug process execution

        Args:
            process_name (str): Name of the process
            details (dict): Additional process details
        """
        if not self._debug_enabled:
            return

        message = f"Process: {process_name}"
        if details:
            detail_str = ", ".join([f"{k}={v}" for k, v in details.items()])
            message += f" ({detail_str})"

        self.debug(message)

    def performance_debug(self, operation: str, duration: float) -> None:
        """Debug performance information

        Args:
            operation (str): Operation name
            duration (float): Duration in seconds
        """
        if not self._debug_enabled:
            return

        self.debug(f"Performance: {operation} took {duration:.3f}s")

    def get_log_file_path(self) -> Optional[str]:
        """Get the path to the current log file

        Returns:
            Optional[str]: Path to log file or None if logging disabled
        """
        return self._log_file

    def dump_environment(self) -> None:
        """Dump current environment information for debugging"""
        if not self._debug_enabled:
            return

        self.debug("=== Environment Information ===")
        self.debug(f"Python Executable: {sys.executable}")
        self.debug(f"Python Path: {sys.path}")
        self.debug(f"Working Directory: {os.getcwd()}")
        self.debug(f"Script Directory: {os.path.dirname(__file__)}")

        # Environment variables
        important_env_vars = [
            'PATH', 'PYTHONPATH', 'TEMP', 'TMP', 'USERPROFILE', 'HOME'
        ]

        for var in important_env_vars:
            value = os.environ.get(var, 'NOT_SET')
            self.debug(f"Environment {var}: {value}")

        self.debug("=== End Environment Information ===")

# Global debug provider instance
_debug_provider = DebugProvider(debug_enabled=True)

# Convenience functions for global access
def get_debug_provider() -> DebugProvider:
    """Get the global debug provider instance"""
    return _debug_provider

def debug(message: str, **kwargs) -> None:
    """Global debug function"""
    _debug_provider.debug(message, **kwargs)

def info(message: str) -> None:
    """Global info function"""
    _debug_provider.info(message)

def success(message: str) -> None:
    """Global success function"""
    _debug_provider.success(message)

def warning(message: str) -> None:
    """Global warning function"""
    _debug_provider.warning(message)

def error(message: str, exception: Optional[Exception] = None) -> None:
    """Global error function"""
    _debug_provider.error(message, exception)

def step(step_num: int, description: str) -> None:
    """Global step function"""
    _debug_provider.step(step_num, description)

def enable_debug() -> None:
    """Enable debug mode globally"""
    _debug_provider.enable_debug()

def disable_debug() -> None:
    """Disable debug mode globally"""
    _debug_provider.disable_debug()

def is_debug_enabled() -> bool:
    """Check if debug mode is enabled globally"""
    return _debug_provider.is_debug_enabled()