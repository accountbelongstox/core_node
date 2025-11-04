Special Software Environment Manager - Python Implementation
==============================================================

This directory contains the Python implementation of the Special Software
Environment Variables Manager, which replaces the Windows-only PowerShell version.

DIRECTORY STRUCTURE:
--------------------
.
├── __init__.py                              # Package initialization
├── special_software_env_manager.py          # Main entry point
├── common_utils.py                          # Common utilities (colors, menus, etc.)
├── config_manager.py                        # Configuration management for all tools
├── command_content_generator_windows.py     # Windows PowerShell script generator
├── command_content_generator_linux.py       # Linux bash script generator
└── README.txt                               # This file

USAGE:
------
From project root:
    python scripts/pytools/special_software_env_manager/special_software_env_manager.py

Or from this directory:
    python special_software_env_manager.py

FEATURES:
---------
1. Cross-platform support (Windows and Linux)
2. Interactive menu system for managing environment variables
3. Automatic generation of both Windows (.ps1) and Linux (.sh) scripts
4. Support for multiple AI tools: Claude AI, OpenAI, Factory AI Droid
5. SSH connection management
6. Smart recognition of API URLs and tokens

KEY DIFFERENCES FROM POWERSHELL VERSION:
----------------------------------------
1. Platform-independent Python code for menu and logic
2. command_content_generator_windows.py: Windows-specific PowerShell generation
3. command_content_generator_linux.py: Linux-specific bash script generation
4. Both generators are called automatically when creating commands

WINDOWS vs LINUX SCRIPTS:
--------------------------
Windows (.ps1):
- Full environment variable management
- SecretManager integration
- MCP server synchronization
- Pre-launch and upgrade tasks

Linux (.sh):
- Simple command execution
- Environment variables managed by linux_path_function.sh
- No complex logic, just launches the tool

REQUIREMENTS:
-------------
- Python 3.6+
- No external dependencies (uses only standard library)

NOTES:
------
- Administrator/root privileges recommended for system environment variable changes
- Windows scripts use SecretManager for secure credential storage
- Linux scripts rely on existing environment configuration
