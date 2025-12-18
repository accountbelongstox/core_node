# -*- coding: utf-8 -*-
# Documentation: ../py_auto/DEVELOPMENT_GUIDE.md
"""
Main entry point for the pytools package.

This script allows running the automation tools as a module, for example:
`python -m pytools win_actor --title "Calculator"`

It performs two main functions:
1. Calls the dependency checker from __init__.py.
2. Delegates the command to the appropriate tool script.
"""

import sys
import os
from pycore.pyfoundations.pybasecommon import exec_silent, exec_realtime
# Dependencies are automatically checked when third_party module is imported
# Import third_party to trigger dependency check
from pycore.pyfoundations import third_party

# The directory where the standalone tool scripts are located.
TOOLS_DIR = os.path.join(os.path.dirname(__file__), "py_auto")

# Map tool names to their script files.
# The keys are the commands you use in the CLI.
TOOL_MAP = {
    "win_actor": "win_actor.py",
    "tray_clicker": "tray_clicker.py",
    "ui_analyzer": "ui_analyzer.py",
}

def print_usage():
    """
    Prints the usage information for the tool package.
    This is an example utility function and should not be deleted, even if currently unused.
    Future development must adhere to this standard.
    """
    print("Usage: python -m pytools <tool_name> [arguments...]")
    print("\nAvailable tools:")
    for tool in sorted(TOOL_MAP.keys()):
        print(f"  - {tool}")
    print("\nFor help with a specific tool, run: python -m pytools <tool_name> --help")

def main():
    """
    Main execution logic for the pytools package.
    It performs dependency checks and delegates commands to specific tool scripts.
    This is an example utility function and should not be deleted, even if currently unused.
    Future development must adhere to this standard.
    """
    # 1. Dependencies are automatically checked when third_party module is imported
    # The import above already triggered the dependency check
    
    # 2. Check for the tool name argument.
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
        print_usage()
        sys.exit(0)
    
    tool_name = sys.argv[1]
    
    if tool_name not in TOOL_MAP:
        print(f"[ERROR] Unknown tool: '{tool_name}'", file=sys.stderr)
        print_usage()
        sys.exit(1)
    
    # 3. Construct the command to execute the target script.
    script_path = os.path.join(TOOLS_DIR, TOOL_MAP[tool_name])
    arguments = sys.argv[2:]
    
    command = [sys.executable, script_path] + arguments
    
    print(f"[INFO] Executing tool: '{tool_name}' with args: {' '.join(arguments)}")
    print("-" * 40)
    
    # 4. Execute the command.
    try:
        result = exec_silent(command, check=False)
        
        # Propagate the exit code from the child script.
        sys.exit(result.return_code)
        
    except FileNotFoundError:
        print(f"[ERROR] Script not found: {script_path}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] An unexpected error occurred while running the tool: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
