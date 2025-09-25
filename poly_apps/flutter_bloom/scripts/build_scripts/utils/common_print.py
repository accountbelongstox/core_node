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
Common Print Methods with Debug Integration
Provides unified printing functionality with debug mode integration
Compatible with Flutter Global Variables system
"""

import sys
import os
import traceback
from datetime import datetime
from typing import Any, Optional, Dict
from pathlib import Path

# Add parent directories to path for imports
current_dir = Path(__file__).parent
build_scripts_dir = current_dir.parent
sys.path.insert(0, str(build_scripts_dir))

from core.gvar.flutter_global_var import get_global_var, is_debug_enabled

class CommonPrint:
    """Common printing methods with debug integration"""

    # Initialize class variables
    _instance = None
    _log_file = None
    _local_debug_override = None

    def __new__(cls):
        """Singleton pattern implementation"""
        if cls._instance is None:
            cls._instance = super(CommonPrint, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize the print system"""
        self._local_debug_override = None
        self._setup_log_file()

    def _setup_log_file(self):
        """Setup log file for debug output"""
        try:
            global_var = get_global_var()
            log_dir = global_var.script_root_dir / "scripts" / ".debug_logs"
            log_dir.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_filename = f"common_print_{timestamp}.log"
            self._log_file = log_dir / log_filename

            # Write initial log entry
            with open(self._log_file, 'w', encoding='utf-8') as f:
                f.write(f"=== Common Print Debug Log ===\n")
                f.write(f"Started at: {datetime.now().isoformat()}\n")
                f.write(f"Python Version: {sys.version}\n")
                f.write(f"Working Directory: {os.getcwd()}\n")
                f.write("=" * 50 + "\n\n")

        except Exception as e:
            print(f"[PRINT INIT ERROR] Failed to initialize log file: {e}")
            self._log_file = None

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

    def _is_debug_active(self) -> bool:
        """Check if debug mode is active (local override or global)"""
        if self._local_debug_override is not None:
            return self._local_debug_override
        return is_debug_enabled()

    def set_local_debug(self, debug_enabled: Optional[bool] = None) -> None:
        """Set local debug override for this instance

        Args:
            debug_enabled: True to enable, False to disable, None to use global setting
        """
        self._local_debug_override = debug_enabled

    def get_debug_status(self) -> Dict[str, Any]:
        """Get current debug status information"""
        return {
            'global_debug': is_debug_enabled(),
            'local_override': self._local_debug_override,
            'active_debug': self._is_debug_active(),
            'log_file': str(self._log_file) if self._log_file else None
        }

    def debug(self, message: str, local_debug: Optional[bool] = None, **kwargs) -> None:
        """Print debug message if debug mode is enabled

        Args:
            message: Debug message
            local_debug: Override global debug setting for this call
            **kwargs: Additional context variables
        """
        # Determine if debug should be active for this call
        debug_active = local_debug if local_debug is not None else self._is_debug_active()

        if not debug_active:
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
            message: Info message
        """
        formatted_message = f"[INFO] {message}"
        print(formatted_message)
        self._write_to_log(formatted_message)

    def success(self, message: str) -> None:
        """Print success message (always shown)

        Args:
            message: Success message
        """
        formatted_message = f"[SUCCESS] {message}"
        print(formatted_message)
        self._write_to_log(formatted_message)

    def warning(self, message: str) -> None:
        """Print warning message (always shown)

        Args:
            message: Warning message
        """
        formatted_message = f"[WARNING] {message}"
        print(formatted_message)
        self._write_to_log(formatted_message)

    def error(self, message: str, exception: Optional[Exception] = None, local_debug: Optional[bool] = None) -> None:
        """Print error message (always shown)

        Args:
            message: Error message
            exception: Exception object for traceback
            local_debug: Override global debug setting for traceback output
        """
        formatted_message = f"[ERROR] {message}"
        print(formatted_message)
        self._write_to_log(formatted_message)

        # Show traceback if debug is enabled
        debug_active = local_debug if local_debug is not None else self._is_debug_active()
        if exception and debug_active:
            traceback_str = traceback.format_exception(type(exception), exception, exception.__traceback__)
            traceback_message = "".join(traceback_str)
            print(f"[ERROR TRACEBACK]\n{traceback_message}")
            self._write_to_log(f"[ERROR TRACEBACK]\n{traceback_message}")

    def step(self, step_num: int, description: str) -> None:
        """Print formatted step information

        Args:
            step_num: Step number
            description: Step description
        """
        separator = "=" * (len(description) + 10)
        step_message = f"\n[STEP {step_num}] {description}\n{separator}"
        print(step_message)
        self._write_to_log(step_message)

    def variable_debug(self, action: str, name: str, value: Any = None, local_debug: Optional[bool] = None) -> None:
        """Debug variable operations

        Args:
            action: Action performed (get/set/clear)
            name: Variable name
            value: Variable value (for set operations)
            local_debug: Override global debug setting for this call
        """
        debug_active = local_debug if local_debug is not None else self._is_debug_active()

        if not debug_active:
            return

        if action == "set" and value is not None:
            self.debug(f"Variable: SET {name} = {value}")
        elif action == "get":
            self.debug(f"Variable: GET {name} = {value}")
        elif action == "clear":
            self.debug(f"Variable: CLEAR {name}")
        else:
            self.debug(f"Variable: {action.upper()} {name}")

    def path_debug(self, path_type: str, path: str, exists: Optional[bool] = None, local_debug: Optional[bool] = None) -> None:
        """Debug path operations

        Args:
            path_type: Type of path (source, target, config, etc.)
            path: Path being processed
            exists: Whether path exists (if checked)
            local_debug: Override global debug setting for this call
        """
        debug_active = local_debug if local_debug is not None else self._is_debug_active()

        if not debug_active:
            return

        existence_info = ""
        if exists is not None:
            existence_info = f" (exists: {exists})"

        self.debug(f"Path {path_type}: {path}{existence_info}")

    def process_debug(self, process_name: str, details: Optional[Dict[str, Any]] = None, local_debug: Optional[bool] = None) -> None:
        """Debug process execution

        Args:
            process_name: Name of the process
            details: Additional process details
            local_debug: Override global debug setting for this call
        """
        debug_active = local_debug if local_debug is not None else self._is_debug_active()

        if not debug_active:
            return

        message = f"Process: {process_name}"
        if details:
            detail_str = ", ".join([f"{k}={v}" for k, v in details.items()])
            message += f" ({detail_str})"

        self.debug(message)

    def performance_debug(self, operation: str, duration: float, local_debug: Optional[bool] = None) -> None:
        """Debug performance information

        Args:
            operation: Operation name
            duration: Duration in seconds
            local_debug: Override global debug setting for this call
        """
        debug_active = local_debug if local_debug is not None else self._is_debug_active()

        if not debug_active:
            return

        self.debug(f"Performance: {operation} took {duration:.3f}s")

    def dump_environment(self, local_debug: Optional[bool] = None) -> None:
        """Dump current environment information for debugging

        Args:
            local_debug: Override global debug setting for this call
        """
        debug_active = local_debug if local_debug is not None else self._is_debug_active()

        if not debug_active:
            return

        self.debug("=== Environment Information ===")
        self.debug(f"Python Executable: {sys.executable}")
        self.debug(f"Python Path: {sys.path}")
        self.debug(f"Working Directory: {os.getcwd()}")
        self.debug(f"Script Directory: {Path(__file__).parent}")

        # Environment variables
        important_env_vars = [
            'PATH', 'PYTHONPATH', 'TEMP', 'TMP', 'USERPROFILE', 'HOME'
        ]

        for var in important_env_vars:
            value = os.environ.get(var, 'NOT_SET')
            self.debug(f"Environment {var}: {value}")

        # Global variables status
        global_var = get_global_var()
        all_constants = global_var.get_all_constants()
        self.debug("=== Flutter Global Variables ===")
        for key, value in all_constants.items():
            self.debug(f"Global {key}: {value}")

        self.debug("=== End Environment Information ===")

    def get_log_file_path(self) -> Optional[str]:
        """Get the path to the current log file

        Returns:
            Path to log file or None if logging disabled
        """
        return str(self._log_file) if self._log_file else None

# Global instance
_common_print = CommonPrint()

# Convenience functions for global access
def get_common_print() -> CommonPrint:
    """Get the global CommonPrint instance"""
    return _common_print

def debug(message: str, local_debug: Optional[bool] = None, **kwargs) -> None:
    """Global debug function"""
    _common_print.debug(message, local_debug, **kwargs)

def info(message: str) -> None:
    """Global info function"""
    _common_print.info(message)

def success(message: str) -> None:
    """Global success function"""
    _common_print.success(message)

def warning(message: str) -> None:
    """Global warning function"""
    _common_print.warning(message)

def error(message: str, exception: Optional[Exception] = None, local_debug: Optional[bool] = None) -> None:
    """Global error function"""
    _common_print.error(message, exception, local_debug)

def step(step_num: int, description: str) -> None:
    """Global step function"""
    _common_print.step(step_num, description)

def set_local_debug(debug_enabled: Optional[bool] = None) -> None:
    """Set local debug override globally"""
    _common_print.set_local_debug(debug_enabled)

def get_debug_status() -> Dict[str, Any]:
    """Get current debug status globally"""
    return _common_print.get_debug_status()

def variable_debug(action: str, name: str, value: Any = None, local_debug: Optional[bool] = None) -> None:
    """Global variable debug function"""
    _common_print.variable_debug(action, name, value, local_debug)

def path_debug(path_type: str, path: str, exists: Optional[bool] = None, local_debug: Optional[bool] = None) -> None:
    """Global path debug function"""
    _common_print.path_debug(path_type, path, exists, local_debug)

def process_debug(process_name: str, details: Optional[Dict[str, Any]] = None, local_debug: Optional[bool] = None) -> None:
    """Global process debug function"""
    _common_print.process_debug(process_name, details, local_debug)

def performance_debug(operation: str, duration: float, local_debug: Optional[bool] = None) -> None:
    """Global performance debug function"""
    _common_print.performance_debug(operation, duration, local_debug)

def dump_environment(local_debug: Optional[bool] = None) -> None:
    """Global environment dump function"""
    _common_print.dump_environment(local_debug)