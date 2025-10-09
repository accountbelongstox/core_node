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
Print Helper
Provides consistent logging and output formatting with file logging
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Any
from shared.data_exchange.unified_variable_system import unified_vars

class PrintHelper:
    """Helper class for consistent logging and output with file logging"""

    MAX_LOG_LINES = 10000
    LOG_BACKUP_LINES = 5000
    DEFAULT_LOG_FILE = "flutter_bloom.log"

    @classmethod
    def _get_log_dir(cls) -> Path:
        """Get log directory path"""
        log_dir = unified_vars.temp_dir / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        return log_dir

    @classmethod
    def _write_to_file(cls, message: str, level: str = "INFO", source: str = None, log_filename: str = None):
        """Write log entry to file with rotation"""
        try:
            log_dir = cls._get_log_dir()
            log_file = log_dir / (log_filename or cls.DEFAULT_LOG_FILE)

            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            source_part = f"[{source}] " if source else ""
            log_entry = f"[{timestamp}] [{level}] {source_part}{message}\n"

            # Check if rotation is needed
            if log_file.exists():
                with open(log_file, 'r', encoding='utf-8') as f:
                    line_count = sum(1 for _ in f)

                if line_count >= cls.MAX_LOG_LINES:
                    cls._rotate_log(log_file)

            # Append log entry
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry)

        except Exception as e:
            # If file logging fails, continue with console only
            print(f"[LOG-ERROR] Failed to write to log file: {e}")

    @classmethod
    def _rotate_log(cls, log_file: Path):
        """Rotate log file when it gets too large"""
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                all_lines = f.readlines()

            total_lines = len(all_lines)
            if total_lines <= cls.MAX_LOG_LINES:
                return

            # Keep only the most recent lines
            keep_lines = total_lines - cls.LOG_BACKUP_LINES
            recent_lines = all_lines[keep_lines:]

            # Add rotation marker
            rotation_marker = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [INFO] [LOG-MANAGER] Log rotated - removed {keep_lines} old entries, kept {len(recent_lines)} recent entries\n"
            final_lines = [rotation_marker] + recent_lines

            # Write optimized content back
            with open(log_file, 'w', encoding='utf-8') as f:
                f.writelines(final_lines)

        except Exception as e:
            print(f"[LOG-ERROR] Failed to rotate log file: {e}")
    
    @classmethod
    def info(cls, message: str, source: str = None, log_filename: str = None):
        """Print info message to console and log file"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        console_msg = f"[{timestamp}] [INFO]" + (f" [{source}]" if source else "") + f" {message}"
        print(console_msg)
        cls._write_to_file(message, "INFO", source, log_filename)

    @classmethod
    def success(cls, message: str, source: str = None, log_filename: str = None):
        """Print success message to console and log file"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        console_msg = f"[{timestamp}] [SUCCESS]" + (f" [{source}]" if source else "") + f" {message}"
        print(console_msg)
        cls._write_to_file(message, "SUCCESS", source, log_filename)

    @classmethod
    def warning(cls, message: str, source: str = None, log_filename: str = None):
        """Print warning message to console and log file"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        console_msg = f"[{timestamp}] [WARNING]" + (f" [{source}]" if source else "") + f" {message}"
        print(console_msg)
        cls._write_to_file(message, "WARNING", source, log_filename)

    @classmethod
    def error(cls, message: str, source: str = None, log_filename: str = None):
        """Print error message to console and log file"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        console_msg = f"[{timestamp}] [ERROR]" + (f" [{source}]" if source else "") + f" {message}"
        print(console_msg)
        cls._write_to_file(message, "ERROR", source, log_filename)
    
    @classmethod
    def header(cls, title: str, source: str = None, log_filename: str = None):
        """Print formatted header to console and log file"""
        separator = "=" * 80
        formatted_title = title.upper()
        timestamp = datetime.now().strftime("%H:%M:%S")

        # Console output
        print(separator)
        print(formatted_title)
        print(separator)

        # Log file output
        cls._write_to_file(separator, "INFO", source, log_filename)
        cls._write_to_file(formatted_title, "INFO", source, log_filename)
        cls._write_to_file(separator, "INFO", source, log_filename)

    
    @staticmethod
    def debug(message: str, enabled: bool = False):
        """Print debug message if enabled"""
        if enabled:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] [DEBUG] {message}")
    
    @staticmethod
    def separator(char: str = "=", length: int = 60):
        """Print separator line"""
        print(char * length)
    
    @staticmethod
    def header(title: str):
        """Print formatted header"""
        PrintHelper.separator()
        print(f" {title} ")
        PrintHelper.separator()
    
    @staticmethod
    def config_summary(config_dict: dict):
        """Print configuration summary"""
        PrintHelper.header("Configuration Summary")
        for key, value in config_dict.items():
            print(f"  {key}: {value}")
        PrintHelper.separator()
    
    @staticmethod
    def results_summary(results: list):
        """Print results summary"""
        PrintHelper.header("Results Summary")
        success_count = sum(1 for r in results if r.get('status') == 'success')
        error_count = len(results) - success_count
        
        print(f"  Total Operations: {len(results)}")
        print(f"  Successful: {success_count}")
        print(f"  Failed: {error_count}")
        
        if error_count > 0:
            print("\n  Failed Operations:")
            for result in results:
                if result.get('status') != 'success':
                    print(f"    - {result.get('description', 'Unknown')}: {result.get('error', 'Unknown error')}")
        
        PrintHelper.separator()
