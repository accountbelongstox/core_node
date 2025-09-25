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
Provides consistent logging and output formatting
"""

from datetime import datetime
from typing import Any

class PrintHelper:
    """Helper class for consistent logging and output"""
    
    @staticmethod
    def info(message: str):
        """Print info message"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [INFO] {message}")
    
    @staticmethod
    def success(message: str):
        """Print success message"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [SUCCESS] {message}")
    
    @staticmethod
    def warning(message: str):
        """Print warning message"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [WARNING] {message}")
    
    @staticmethod
    def error(message: str):
        """Print error message"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [ERROR] {message}")
    
    @staticmethod
    def step(step_num: int, description: str):
        """Print step information"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"\n[{timestamp}] [STEP {step_num}] {description}")
        print("=" * (len(description) + 20))
    
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
