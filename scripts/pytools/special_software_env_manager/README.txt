Special Software Environment Manager - Python Implementation
==============================================================

This directory contains the Python implementation of the Special Software
Environment Variables Manager, which replaces the Windows-only PowerShell version.

VERSION: 1.0.0 - FULLY COMPLETED ✓

DIRECTORY STRUCTURE:
--------------------
.
├── __init__.py                              # Package initialization
├── __main__.py                              # Module execution support
├── main.py                                  # Entry point
├── special_software_env_manager.py          # Main program logic
├── secret_read.py                           # Standalone secret-decrypt helper
├── utils/                                   # common_utils.py, secret_manager.py, smart_recognition.py, local_test_helper.py
├── config/                                  # config_manager.py, path_config.py
├── generators/                              # command_content_generator_windows.py, command_content_generator_linux.py
├── managers/                                # environment_variable_manager.py, script_manager.py, backup_manager.py, menu_handler.py, command_handler.py, app_scanner.py, file_number_manager.py, variable_input_handler.py, encrypted_constants_manager.py
├── script_sections/                         # env_loading_section.py, ssh_command_generator.py, backup_restore_section.py, mcp_section.py, user_directory_section.py
├── backups/                                 # Configuration backups
└── README.txt                               # This file

USAGE:
------
From project root:
    python scripts/pytools/special_software_env_manager/special_software_env_manager.py

From this directory:
    python special_software_env_manager.py

As a module:
    python -m special_software_env_manager

FEATURES (ALL COMPLETED):
-------------------------
✓ Cross-platform support (Windows, WSL, Ubuntu Desktop, Linux Server)
✓ Automatic platform detection with detailed differentiation
✓ Interactive menu system with arrow key navigation
✓ Add Global Command - Generate startup scripts
✓ Set Environment Variables - Configure in current session
✓ View Environment Variables - Display current values
✓ View Scripts - List all generated scripts
✓ Restore Configuration - Restore from backups
✓ Automatic configuration backup on variable changes
✓ Secure credential storage (Windows SecretManager)
✓ MCP server synchronization (Claude/Codex)
✓ Path conversion for WSL environments

SUPPORTED PLATFORMS:
--------------------
1. Windows
   - Detection: platform.system() == 'Windows'
   - Scripts: PowerShell (.ps1)
   - Location: scripts/winenvs/

2. WSL (Windows Subsystem for Linux)
   - Detection: /proc/version contains 'microsoft' or 'wsl'
   - Scripts: Bash (.sh)
   - Location: scripts/liunxenvs/
   - Features: Automatic path conversion (C:\ <-> /mnt/c/)

3. Ubuntu Desktop
   - Detection: Ubuntu + DISPLAY or XDG_CURRENT_DESKTOP
   - Scripts: Bash (.sh)
   - Location: scripts/liunxenvs/

4. Linux Server
   - Detection: Linux without desktop environment
   - Scripts: Bash (.sh)
   - Location: scripts/liunxenvs/

5. Generic Linux
   - Fallback for other Linux distributions

SUPPORTED TOOLS:
----------------
1. Claude AI (Anthropic)
   - ANTHROPIC_BASE_URL
   - ANTHROPIC_AUTH_TOKEN
   - ANTHROPIC_API_KEY

2. OpenAI
   - OPENAI_API_BASE
   - OPENAI_API_KEY

3. Factory AI Droid
   - DROID_API_URL
   - DROID_API_KEY

4. SSH Connection
   - SSH_CONNECTION
   - SSH_PASSWORD

MENU OPTIONS:
-------------
Main Menu:
  → Tool Configuration Menus (Claude AI, OpenAI, Droid, SSH)
  → View All Environment Variables
  → Refresh Current Terminal Environment
  → Exit

Tool Configuration Menu:
  → Add {Tool} Global Command
  → Set {Tool} Environment Variables
  → View {Tool} Environment Variables
  → View {Tool} Scripts
  → Restore from Configuration
  → Back to Main Menu

SCRIPT GENERATION:
------------------
Windows Scripts (.ps1):
  - Full environment variable management
  - SecretManager integration for secure storage
  - MCP server synchronization (for Claude/Codex)
  - Tool upgrade option with separate window
  - Pre-launch script execution
  - Complete command execution wrapper

Linux Scripts (.sh):
  - Simple command execution wrapper
  - Environment variables managed externally
  - Executable permissions set automatically

Generated Files:
  - Windows: scripts/winenvs/{prefix}{number}.ps1
  - Linux:   scripts/liunxenvs/{prefix}{number}.sh

CONFIGURATION BACKUP:
---------------------
Location: scripts/pytools/special_software_env_manager/backups/
Format:   {prefix}_backup_{timestamp}.json

Backup Structure:
{
  "config_name": "Claude AI",
  "timestamp": "20250105_143022",
  "platform": "windows",
  "environment_variables": {
    "ANTHROPIC_API_KEY": "...",
    ...
  }
}

Backups are created automatically when:
  - Setting environment variables
  - Can be restored using "Restore from Configuration"

PLATFORM DETECTION:
-------------------
Functions in utils/common_utils.py:
  - get_platform_type() → 'windows'|'wsl'|'ubuntu_desktop'|'linux_server'|'linux'
  - is_wsl() → bool
  - is_desktop() → bool
  - is_server() → bool
  - convert_wsl_path(path) → Converts Windows path to WSL path
  - convert_path_for_platform(path, target) → Smart path conversion

WINDOWS vs LINUX SCRIPTS:
--------------------------
Windows (.ps1):
  - Full environment variable management
  - SecretManager integration
  - MCP server synchronization
  - Pre-launch and upgrade tasks
  - Command execution in new PowerShell process

Linux (.sh):
  - Simple command execution
  - Environment variables managed by linux_path_function.sh
  - No complex logic, just launches the tool

KEY DIFFERENCES FROM POWERSHELL VERSION:
----------------------------------------
1. ✓ Platform-independent Python code
2. ✓ Automatic platform detection (5 different environments)
3. ✓ Configuration backup and restore system
4. ✓ Script viewing and management
5. ✓ Both Windows and Linux script generation
6. ✓ Interactive menu with arrow key navigation
7. ✓ All features fully implemented (no "under development")

REQUIREMENTS:
-------------
- Python 3.6+
- No external dependencies (uses only standard library)
- Windows: SecretManager.ps1 (for persistent variable storage)
- Linux: Standard bash/zsh shell

COMPLETION STATUS:
------------------
[✓] Platform detection (Windows/WSL/Ubuntu Desktop/Server)
[✓] Add Global Command functionality
[✓] View Scripts functionality
[✓] Restore Configuration functionality
[✓] Environment variable viewing and setting
[✓] Configuration backup system
[✓] Cross-platform path handling
[✓] Menu system with navigation
[✓] Script generation (Windows & Linux)

ALL FEATURES 100% COMPLETE

NOTES:
------
- Administrator/root privileges recommended for system changes
- Windows: Use Set-SecretKey to store variables securely
- Linux: Add exports to ~/.bashrc or ~/.zshrc for persistence
- Generated scripts are ready to use immediately
- Configuration backups enable easy environment recreation
