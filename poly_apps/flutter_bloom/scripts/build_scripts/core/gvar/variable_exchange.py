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
Variable Exchange System
Compatible with PowerShell GVar system for cross-process communication
"""

import os
import tempfile
import time
from typing import Any, Dict, Optional

class VariableExchange:
    """Variable exchange system compatible with PowerShell GVar"""
    
    # Use same file exchange system as PowerShell
    GVAR_EXCHANGE_DIR = os.path.join(tempfile.gettempdir(), "flutter_dev_gvar")
    GVAR_EXCHANGE_FILE = os.path.join(GVAR_EXCHANGE_DIR, "variables.txt")
    GVAR_LOCK_FILE = os.path.join(GVAR_EXCHANGE_DIR, "gvar.lock")

    @staticmethod
    def _ensure_dir() -> None:
        """Ensure exchange directory exists"""
        if not os.path.exists(VariableExchange.GVAR_EXCHANGE_DIR):
            os.makedirs(VariableExchange.GVAR_EXCHANGE_DIR)

    @staticmethod
    def _wait_lock(timeout: int = 30) -> None:
        """Wait for lock to be released"""
        elapsed = 0
        while os.path.exists(VariableExchange.GVAR_LOCK_FILE) and elapsed < timeout:
            time.sleep(0.1)
            elapsed += 0.1

        if elapsed >= timeout:
            raise Exception("Variable exchange lock timeout exceeded")

    @staticmethod
    def _set_lock() -> None:
        """Create lock file"""
        VariableExchange._ensure_dir()
        with open(VariableExchange.GVAR_LOCK_FILE, 'w') as f:
            f.write("")

    @staticmethod
    def _remove_lock() -> None:
        """Remove lock file"""
        if os.path.exists(VariableExchange.GVAR_LOCK_FILE):
            os.remove(VariableExchange.GVAR_LOCK_FILE)

    @staticmethod
    def set(name: str, value: str) -> None:
        """Set a variable in the exchange system"""
        try:
            VariableExchange._wait_lock()
            VariableExchange._set_lock()
            
            # Read current variables
            variables = {}
            if os.path.exists(VariableExchange.GVAR_EXCHANGE_FILE):
                with open(VariableExchange.GVAR_EXCHANGE_FILE, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        for line in content.split('\n'):
                            if '=' in line:
                                var_name, var_value = line.split('=', 1)
                                variables[var_name.strip()] = var_value.strip()
            
            # Set new variable
            variables[name] = str(value)
            
            # Write back to file
            output_lines = []
            for key, val in variables.items():
                output_lines.append(f"{key}={val}")
            
            with open(VariableExchange.GVAR_EXCHANGE_FILE, 'w', encoding='utf-8') as f:
                f.write('\n'.join(output_lines))
                
        finally:
            VariableExchange._remove_lock()

    @staticmethod
    def get(name: str, default_value: str = "") -> str:
        """Get a variable from the exchange system"""
        try:
            VariableExchange._wait_lock()
            VariableExchange._set_lock()
            
            if not os.path.exists(VariableExchange.GVAR_EXCHANGE_FILE):
                return default_value
            
            with open(VariableExchange.GVAR_EXCHANGE_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    return default_value
                
                for line in content.split('\n'):
                    if '=' in line:
                        var_name, var_value = line.split('=', 1)
                        if var_name.strip() == name:
                            return var_value.strip()
            
            return default_value
            
        finally:
            VariableExchange._remove_lock()

    @staticmethod
    def get_all() -> Dict[str, str]:
        """Get all variables from the exchange system"""
        try:
            VariableExchange._wait_lock()
            VariableExchange._set_lock()
            
            variables = {}
            if not os.path.exists(VariableExchange.GVAR_EXCHANGE_FILE):
                return variables
            
            with open(VariableExchange.GVAR_EXCHANGE_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    return variables
                
                for line in content.split('\n'):
                    if '=' in line:
                        var_name, var_value = line.split('=', 1)
                        variables[var_name.strip()] = var_value.strip()
            
            return variables
            
        finally:
            VariableExchange._remove_lock()

    @staticmethod
    def clear() -> None:
        """Clear all variables"""
        try:
            VariableExchange._wait_lock()
            VariableExchange._set_lock()
            
            with open(VariableExchange.GVAR_EXCHANGE_FILE, 'w', encoding='utf-8') as f:
                f.write("")
                
        finally:
            VariableExchange._remove_lock()

# Alias for compatibility
GVar = VariableExchange
