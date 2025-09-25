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
Variable Manager for Flutter Bloom Build System
Compatible with PowerShell GVar system using file exchange
"""

import os
import tempfile
import time
from typing import Dict, List

class VariableManager:
    """Manages variables using file exchange system compatible with PowerShell"""
    
    # Use same file exchange system as PowerShell
    GVAR_EXCHANGE_DIR = os.path.join(tempfile.gettempdir(), "flutter_dev_gvar")
    GVAR_EXCHANGE_FILE = os.path.join(GVAR_EXCHANGE_DIR, "variables.txt")
    GVAR_LOCK_FILE = os.path.join(GVAR_EXCHANGE_DIR, "gvar.lock")
    
    @classmethod
    def _ensure_dir(cls) -> None:
        """Ensure exchange directory exists"""
        if not os.path.exists(cls.GVAR_EXCHANGE_DIR):
            os.makedirs(cls.GVAR_EXCHANGE_DIR)
    
    @classmethod
    def _wait_lock(cls, timeout: int = 30) -> None:
        """Wait for lock to be released"""
        elapsed = 0
        while os.path.exists(cls.GVAR_LOCK_FILE) and elapsed < timeout:
            time.sleep(0.1)
            elapsed += 0.1
        
        if elapsed >= timeout:
            raise Exception("Variable lock timeout exceeded")
    
    @classmethod
    def _set_lock(cls) -> None:
        """Create lock file"""
        cls._ensure_dir()
        with open(cls.GVAR_LOCK_FILE, 'w') as f:
            f.write("")
    
    @classmethod
    def _remove_lock(cls) -> None:
        """Remove lock file"""
        if os.path.exists(cls.GVAR_LOCK_FILE):
            os.remove(cls.GVAR_LOCK_FILE)
    
    @classmethod
    def _read_variables(cls) -> Dict[str, str]:
        """Read all variables from exchange file"""
        variables = {}
        
        if not os.path.exists(cls.GVAR_EXCHANGE_FILE):
            return variables
        
        try:
            with open(cls.GVAR_EXCHANGE_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    for line in content.split('\n'):
                        if '=' in line:
                            key, value = line.split('=', 1)
                            variables[key.strip()] = value.strip()
        except Exception as e:
            raise Exception(f"Error reading variables: {str(e)}")
        
        return variables
    
    @classmethod
    def _write_variables(cls, variables: Dict[str, str]) -> None:
        """Write all variables to exchange file"""
        cls._ensure_dir()
        
        try:
            lines = []
            for key, value in variables.items():
                lines.append(f"{key}={value}")
            
            with open(cls.GVAR_EXCHANGE_FILE, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
        except Exception as e:
            raise Exception(f"Error writing variables: {str(e)}")
    
    @classmethod
    def set(cls, key: str, value: str) -> None:
        """Set a variable in the exchange system"""
        try:
            cls._wait_lock()
            cls._set_lock()
            
            variables = cls._read_variables()
            variables[key] = str(value)
            cls._write_variables(variables)
            
        finally:
            cls._remove_lock()
    
    @classmethod
    def get(cls, key: str, default: str = "") -> str:
        """Get a variable from the exchange system"""
        try:
            cls._wait_lock()
            cls._set_lock()
            
            variables = cls._read_variables()
            return variables.get(key, default)
            
        finally:
            cls._remove_lock()
    
    @classmethod
    def has(cls, key: str) -> bool:
        """Check if a variable exists"""
        try:
            cls._wait_lock()
            cls._set_lock()
            
            variables = cls._read_variables()
            return key in variables
            
        finally:
            cls._remove_lock()
    
    @classmethod
    def list_all(cls) -> List[str]:
        """List all variable keys"""
        try:
            cls._wait_lock()
            cls._set_lock()
            
            variables = cls._read_variables()
            return sorted(variables.keys())
            
        finally:
            cls._remove_lock()
    
    @classmethod
    def delete(cls, key: str) -> bool:
        """Delete a variable"""
        try:
            cls._wait_lock()
            cls._set_lock()
            
            variables = cls._read_variables()
            if key in variables:
                del variables[key]
                cls._write_variables(variables)
                return True
            return False
            
        finally:
            cls._remove_lock()
    
    @classmethod
    def clear_all(cls) -> None:
        """Clear all variables"""
        try:
            cls._wait_lock()
            cls._set_lock()
            
            cls._write_variables({})
            
        finally:
            cls._remove_lock()
    
    @classmethod
    def get_build_parameters(cls) -> Dict[str, str]:
        """Get build parameters set by PowerShell"""
        return {
            "app_name": cls.get("build_app_name", ""),
            "platform": cls.get("build_platform", ""),
            "action": cls.get("build_action", ""),
            "config_path": cls.get("app_config_path", ""),
            "timestamp": cls.get("build_timestamp", "")
        }

# Alias for backward compatibility
GVar = VariableManager
