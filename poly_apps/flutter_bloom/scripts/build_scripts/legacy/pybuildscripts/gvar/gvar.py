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

import os
import tempfile
import time
import inspect
from typing import Any, List, Dict
import provider.build_provider as build_provider

class GVar:
    # Use same file exchange system as PowerShell
    GVAR_EXCHANGE_DIR = os.path.join(tempfile.gettempdir(), "flutter_dev_gvar")
    GVAR_EXCHANGE_FILE = os.path.join(GVAR_EXCHANGE_DIR, "variables.txt")
    GVAR_LOCK_FILE = os.path.join(GVAR_EXCHANGE_DIR, "gvar.lock")

    @staticmethod
    def _ensure_dir() -> None:
        if not os.path.exists(GVar.GVAR_EXCHANGE_DIR):
            os.makedirs(GVar.GVAR_EXCHANGE_DIR)

    @staticmethod
    def _wait_lock(timeout: int = 30) -> None:
        """Wait for lock to be released"""
        elapsed = 0
        while os.path.exists(GVar.GVAR_LOCK_FILE) and elapsed < timeout:
            time.sleep(0.1)
            elapsed += 0.1

        if elapsed >= timeout:
            raise Exception("Gvar lock timeout exceeded")

    @staticmethod
    def _set_lock() -> None:
        """Create lock file"""
        GVar._ensure_dir()
        with open(GVar.GVAR_LOCK_FILE, 'w') as f:
            f.write("")

    @staticmethod
    def _remove_lock() -> None:
        """Remove lock file"""
        if os.path.exists(GVar.GVAR_LOCK_FILE):
            os.remove(GVar.GVAR_LOCK_FILE)

    @staticmethod
    def _read_variables() -> Dict[str, str]:
        """Read all variables from exchange file"""
        variables = {}

        if not os.path.exists(GVar.GVAR_EXCHANGE_FILE):
            return variables

        try:
            with open(GVar.GVAR_EXCHANGE_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    for line in content.split('\n'):
                        if '=' in line:
                            key, value = line.split('=', 1)
                            variables[key.strip()] = value.strip()
        except Exception as e:
            raise Exception(f"Error reading variables: {str(e)}")

        return variables

    @staticmethod
    def _write_variables(variables: Dict[str, str]) -> None:
        """Write all variables to exchange file"""
        GVar._ensure_dir()

        try:
            lines = []
            for key, value in variables.items():
                lines.append(f"{key}={value}")

            with open(GVar.GVAR_EXCHANGE_FILE, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
        except Exception as e:
            raise Exception(f"Error writing variables: {str(e)}")

    @staticmethod
    def set(key: str, value: str) -> None:
        """Set a variable in the exchange system"""
        try:
            GVar._wait_lock()
            GVar._set_lock()

            variables = GVar._read_variables()
            variables[key] = str(value)
            GVar._write_variables(variables)

        finally:
            GVar._remove_lock()

    @staticmethod
    def get(key: str, default: str = "") -> str:
        """Get a variable from the exchange system"""
        try:
            GVar._wait_lock()
            GVar._set_lock()

            variables = GVar._read_variables()
            return variables.get(key, default)

        finally:
            GVar._remove_lock()

    @staticmethod
    def has(key: str) -> bool:
        """Check if a variable exists"""
        try:
            GVar._wait_lock()
            GVar._set_lock()

            variables = GVar._read_variables()
            return key in variables

        finally:
            GVar._remove_lock()

    @staticmethod
    def list() -> List[str]:
        """List all variable keys"""
        try:
            GVar._wait_lock()
            GVar._set_lock()

            variables = GVar._read_variables()
            return sorted(variables.keys())

        finally:
            GVar._remove_lock()

    @staticmethod
    def delete(key: str) -> bool:
        """Delete a variable"""
        try:
            GVar._wait_lock()
            GVar._set_lock()

            variables = GVar._read_variables()
            if key in variables:
                del variables[key]
                GVar._write_variables(variables)
                return True
            return False

        finally:
            GVar._remove_lock()

    @staticmethod
    def clear() -> None:
        """Clear all variables"""
        try:
            GVar._wait_lock()
            GVar._set_lock()

            GVar._write_variables({})

        finally:
            GVar._remove_lock()

    @staticmethod
    def init_build_provider_vars(mode: str = 'replace') -> None:
        GVar._ensure_dir()
        module_vars = inspect.getmembers(build_provider)
        variables = [
            (name, str(value)) for name, value in module_vars
            if not name.startswith('_') and 
            not inspect.isfunction(value) and 
            not inspect.ismodule(value) and
            not inspect.isclass(value)
        ]
        
        # Save each variable based on mode
        for name, value in variables:
            try:
                if mode == 'replace':
                    # Always save
                    GVar.set(name, value)
                elif mode == 'skip_existing':
                    # Only save if doesn't exist
                    if not GVar.has(name):
                        GVar.set(name, value)
                elif mode == 'add_missing':
                    # Only save if doesn't exist
                    if not GVar.has(name):
                        GVar.set(name, value)
            except Exception as e:
                print(f"Warning: Could not save variable {name}: {str(e)}")

# Example usage
if __name__ == "__main__":
    # Initialize build_provider variables with different modes
    GVar.init_build_provider_vars('replace')  # Replace all variables
    GVar.init_build_provider_vars('skip_existing')  # Skip existing variables
    GVar.init_build_provider_vars('add_missing')  # Only add missing variables
    
    # Set some variables
    GVar.set("test_string", "Hello, World!")
    GVar.set("test_number", "42")
    GVar.set("test_list", "[1, 2, 3, 4, 5]")
    GVar.set("test_dict", "{'name': 'John', 'age': 30}")
    
    # Get variables
    print(GVar.get("test_string"))  # Hello, World!
    print(GVar.get("test_number"))  # 42
    print(GVar.get("test_list"))    # [1, 2, 3, 4, 5]
    print(GVar.get("test_dict"))    # {'name': 'John', 'age': 30}
    
    # Check if variable exists
    print(GVar.has("test_string"))  # True
    print(GVar.has("nonexistent"))  # False
    
    # List all variables
    print(GVar.list())  # ['test_dict', 'test_list', 'test_number', 'test_string']
    
    # Delete a variable
    GVar.delete("test_string")
    print(GVar.has("test_string"))  # False
    
    # Clear all variables
    GVar.clear()
    print(GVar.list())  # []
