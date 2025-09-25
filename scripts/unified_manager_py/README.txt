Unified Manager Python Version
===================================

This is a Python reimplementation of the unified_manager system that provides:
1. Complete application management functionality moved to Python
2. Cross-platform compatibility (Windows/Linux)
3. Registry-based application discovery and management
4. Script generation and execution coordination

Files Structure:
================

unified_manager.ps1  - PowerShell bridge script that calls Python and executes returned scripts
main.py             - Main Python implementation with all unified manager functionality
README.txt          - This documentation file

Key Features:
============

1. Registry-based App Management:
   - Reads from ../unified_manager/app_registry.json
   - Supports both regular apps and poly-apps
   - Preset configurations for multiple app combinations

2. Cross-platform Script Generation:
   - Generates .bat files on Windows, .sh files on Linux
   - Handles different script types (start, install, build, deploy, stop)
   - Automatic path resolution and command building

3. Interactive Menus:
   - Start Applications (with app/preset selection)
   - Install Dependencies
   - Build Applications
   - Back to Main Menu integration

4. Data Exchange:
   - Uses ~/.core_node/unified_manager/ for temporary files
   - PowerShell reads Python results and executes generated scripts

Usage:
======

Windows:
   powershell -ExecutionPolicy Bypass -File unified_manager.ps1

Linux:
   python3 main.py  # Direct execution
   # OR
   ./unified_manager.ps1  # If PowerShell Core is installed

Requirements:
=============

- Python 3.6+
- PowerShell (Windows built-in or PowerShell Core for Linux)
- Access to the project's app_registry.json file

How it Works:
============

1. unified_manager.ps1 launches main.py
2. main.py displays interactive menus and processes selections
3. main.py generates appropriate scripts in the data exchange directory
4. main.py returns the script path to PowerShell via "RESULT_PATH:" output
5. PowerShell executes the returned script using appropriate method (explorer, cmd, bash, etc.)

This design ensures:
- All logic is in Python (cross-platform)
- Scripts still execute in appropriate shell environments
- Full compatibility with existing app structures
- No dependency on other PowerShell scripts from unified_manager