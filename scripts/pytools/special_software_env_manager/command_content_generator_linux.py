"""
Command Content Generator for Linux

Generates bash scripts for Linux systems.
Linux scripts do NOT handle environment variables (handled by linux_path_function.sh)
Only ensure command availability for production.

This is the Linux-specific version of CommandContentGenerator.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any


class LinuxCommandContentGenerator:
    """Generate Linux bash command scripts"""

    def __init__(self):
        self.project_root = self._get_project_root()
        self.scripts_dir = self.project_root / 'scripts'
        self.ai_tools_dir = self.scripts_dir / 'pytools' / 'ai_tools'

    @staticmethod
    def _get_project_root() -> Path:
        """Get project root directory"""
        current_file = Path(__file__)
        pytools_dir = current_file.parent.parent
        scripts_dir = pytools_dir.parent
        return scripts_dir.parent

    def get_mcp_sync_script_path(self, tool_type: str) -> Path:
        """Get MCP sync script path for a specific tool"""
        return self.ai_tools_dir / f'{tool_type}_sync_mcp_servers.py'

    def get_pre_launch_script_path(self, tool_type: str) -> Path:
        """Get pre-launch script path for a specific tool"""
        return self.ai_tools_dir / f'{tool_type}_pre_launch.sh'

    def get_update_script_path(self, tool_type: str) -> Path:
        """Get update/upgrade script path for a specific tool"""
        return self.ai_tools_dir / f'{tool_type}_update.sh'

    def generate_mcp_section(self, tool_type: str, tool_display_name: str,
                           target_name: str, support_upgrade: bool = True, support_npm_update: bool = False) -> str:
        """Generate MCP synchronization section for any AI tool (Linux version)

        Args:
            tool_type: Type of AI tool (e.g., 'claude', 'codex')
            tool_display_name: Display name for the tool (e.g., 'Claude Code')
            target_name: Target name for MCP sync (e.g., 'claude')
            support_upgrade: Whether to include upgrade option
            support_npm_update: Whether to include npm/npx update option
        """
        update_script_name = self.get_update_script_path(tool_type).name
        sync_script_name = self.get_mcp_sync_script_path(tool_type).name
        pre_launch_script_name = self.get_pre_launch_script_path(tool_type).name

        pre_launch_section = f"""# Execute pre-launch script if it exists
preLaunchScript="$aiToolsDirPath/{pre_launch_script_name}"
if [ -f "$preLaunchScript" ]; then
    current_working_dir="$(pwd)"
    echo "[INFO] Executing pre-launch script: $preLaunchScript"
    echo "[INFO] Working Directory: $current_working_dir"
    echo ""
    bash "$preLaunchScript" "$current_working_dir"
    echo ""
fi"""

        upgrade_section = ""
        if support_upgrade:
            upgrade_section = f"""
echo "Available tasks:"
echo "  [1] Upgrade {tool_display_name} to latest version (runs in separate terminal)"
echo "  [2] Sync MCP server configurations (runs now)"
echo ""

read -p "Do you want to upgrade {tool_display_name}? (y/N): " upgrade_choice
if [ "$upgrade_choice" = "y" ] || [ "$upgrade_choice" = "Y" ]; then
    echo ""
    echo "[INFO] Launching {tool_display_name} upgrade in separate terminal..."
    upgrade_script="$aiToolsDirPath/{update_script_name}"
    if [ -f "$upgrade_script" ]; then
        # Launch in background to avoid blocking current environment
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal -- bash -c "$upgrade_script; read -p 'Press Enter to close'"
        elif command -v xterm &> /dev/null; then
            xterm -e "bash $upgrade_script; read -p 'Press Enter to close'" &
        else
            bash "$upgrade_script" &
        fi
        echo "[SUCCESS] Upgrade terminal opened"
    else
        echo "[WARNING] Upgrade script not found: $upgrade_script"
    fi
else
    echo "[INFO] Skipping upgrade"
fi

"""

        npm_update_section = ""
        if support_npm_update:
            npm_update_section = """
echo ""
read -p "Do you want to update npm global packages? (y/N): " npm_update_choice
if [ "$npm_update_choice" = "y" ] || [ "$npm_update_choice" = "Y" ]; then
    echo ""
    echo "[INFO] Updating npm global packages..."
    echo ""

    # Check if npm is available
    if command -v npm &> /dev/null; then
        echo "[INFO] Checking for npm updates..."
        npm update -g
        echo ""
        echo "[SUCCESS] npm global packages updated"
    else
        echo "[WARNING] npm command not found"
    fi
    echo ""
else
    echo "[INFO] Skipping npm update"
    echo ""
fi

"""

        sync_section = f"""current_working_dir="$(pwd)"
echo ""
echo "Syncing MCP Server Configurations..."
echo ""
sync_script="$aiToolsDirPath/{sync_script_name}"
if [ -f "$sync_script" ]; then
    echo "[INFO] Executing: python -u '$sync_script' --target {target_name} --working-dir '$current_working_dir'"
    echo "[INFO] Working Directory: $current_working_dir"
    echo ""

    # Detect Python command
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo "[ERROR] Python not found"
        exit 1
    fi

    $PYTHON_CMD -u "$sync_script" --target {target_name} --working-dir "$current_working_dir"
else
    echo "[WARNING] MCP sync script not found: $sync_script"
    echo "[INFO] Skipping MCP synchronization"
fi

echo ""
echo "============================================================"
echo "Press Enter to start {tool_display_name}..."
echo "============================================================"
read -p "Press Enter to continue"
"""

        return f"""echo "{tool_display_name} - Pre-Launch Tasks"
echo ""

{pre_launch_section}
{upgrade_section}{npm_update_section}
{sync_section}
"""

    def generate_custom_user_directory_section(self) -> str:
        """Generate custom user directory configuration section for Linux"""
        return """
#region Initialize Path Variables
# Resolve script real path (handle symlinks)
# When script is executed via symlink, BASH_SOURCE[0] returns symlink path
# We need to resolve it to actual file path to get correct directory
scriptSource="${BASH_SOURCE[0]}"
# Check if scriptSource is a symlink and resolve it
if [ -L "$scriptSource" ]; then
    # Resolve symlink to actual file path
    scriptSource="$(readlink -f "$scriptSource" 2>/dev/null || echo "$scriptSource")"
fi
# Get absolute path of script directory
scriptCurrentPath="$(cd "$(dirname "$scriptSource")" && pwd)"

# Calculate project structure paths
# Expected structure: project_root/scripts/linuxenvs/script.sh
scriptsDirPath="$(cd "$scriptCurrentPath/.." && pwd)"
projectRootPath="$(cd "$scriptsDirPath/.." && pwd)"

# Additional paths (optional, for compatibility)
shellsDirPath="$scriptsDirPath/shells"
linuxDirPath="$shellsDirPath/linux"
linuxCommonDirPath="$linuxDirPath/linux_common"
pytoolsDirPath="$scriptsDirPath/pytools"
aiToolsDirPath="$pytoolsDirPath/ai_tools"

# Path resolution algorithm:
#   Script (resolve symlink) -> Script Dir (linuxenvs) -> Scripts Dir -> Project Root

echo "[DEBUG] scriptSource:      $scriptSource"
echo "[DEBUG] scriptCurrentPath: $scriptCurrentPath"
echo "[DEBUG] scriptsDirPath:    $scriptsDirPath"
echo "[DEBUG] projectRootPath:   $projectRootPath"

#region Custom User Directory Configuration
# ============================================================================
# CUSTOM USER DIRECTORY SETTING
# ============================================================================
# Auto-scans /var/_core_node/Users/ for existing MyBest1, MyBest2, etc.
# Usage: script.sh [number|MyBestX]
#   - If number is provided: uses /var/_core_node/Users/MyBest[number]
#   - If full name is provided (e.g., MyBest1): uses /var/_core_node/Users/MyBest1
#   - If no argument: auto-finds next available MyBest[X] or creates new one
# ============================================================================

baseTempDir="/var/_core_node/Users"
userDirPrefix="MyBest"

# Get directory name/number from command line argument (if provided)
userDirName=""
if [ $# -gt 0 ]; then
    argValue="$1"
    # Check if it's a number
    if [[ "$argValue" =~ ^[0-9]+$ ]]; then
        userDirName="${userDirPrefix}${argValue}"
        echo "[INFO] Using specified number: $argValue -> $userDirName"
    # Check if it's a full name (MyBestX format)
    elif [[ "$argValue" =~ ^${userDirPrefix}[0-9]+$ ]]; then
        userDirName="$argValue"
        echo "[INFO] Using specified full name: $userDirName"
    fi
fi

# If no argument specified, auto-scan for existing MyBest directories
if [ -z "$userDirName" ]; then
    echo "[INFO] Auto-scanning for existing MyBest directories..."
    
    # Create base directory if it doesn't exist
    if [ ! -d "$baseTempDir" ]; then
        echo "[INFO] Creating base directory: $baseTempDir"
        mkdir -p "$baseTempDir"
    fi
    
    # Find existing MyBest directories
    existingNumbers=()
    if [ -d "$baseTempDir" ]; then
        for dir in "$baseTempDir"/${userDirPrefix}[0-9]*; do
            if [ -d "$dir" ]; then
                dirName=$(basename "$dir")
                if [[ "$dirName" =~ ^${userDirPrefix}([0-9]+)$ ]]; then
                    num="${BASH_REMATCH[1]}"
                    existingNumbers+=("$num")
                fi
            fi
        done
    fi
    
    # Find next available number
    if [ ${#existingNumbers[@]} -gt 0 ]; then
        # Find max number
        maxNumber=0
        for num in "${existingNumbers[@]}"; do
            if [ "$num" -gt "$maxNumber" ]; then
                maxNumber="$num"
            fi
        done
        nextNumber=$((maxNumber + 1))
        userDirName="${userDirPrefix}${nextNumber}"
        echo "[INFO] Found existing MyBest directories: ${existingNumbers[*]}"
        echo "[INFO] Using next available number: $nextNumber -> $userDirName"
    else
        userDirName="${userDirPrefix}1"
        echo "[INFO] No existing MyBest directories found, starting with: $userDirName"
    fi
fi

# Build directory path
CustomUserDirectory="$baseTempDir/$userDirName"

# Create the directory if it doesn't exist
if [ ! -d "$baseTempDir" ]; then
    echo "[INFO] Creating base directory: $baseTempDir"
    mkdir -p "$baseTempDir"
fi

if [ ! -d "$CustomUserDirectory" ]; then
    echo "[INFO] Creating custom user directory: $CustomUserDirectory"
    mkdir -p "$CustomUserDirectory"
fi

# Verify directory was created successfully
if [ -d "$CustomUserDirectory" ]; then
    userProfilePath="$CustomUserDirectory"
    echo "[SUCCESS] Using MyBest directory: $userProfilePath"
else
    echo "[WARNING] Failed to create custom directory, falling back to system default"
    userProfilePath="$HOME"
    echo "[INFO] Using system default user directory: $userProfilePath"
fi

userHomePath="$userProfilePath"
usersDirectoryPath="$(dirname "$userProfilePath")"

# Set environment variables for Node.js, React, Python, and other applications
# ============================================================================
# These environment variables will be available to all child processes
# including Node.js, React, Python, and other applications launched from this script
#
# Python usage examples:
#   import os
#   user_home = os.path.expanduser("~")  # Uses HOME
#   user_home = os.getenv("HOME")
#   from pathlib import Path
#   user_home = Path.home()  # Uses HOME
# ============================================================================
export HOME="$userProfilePath"
export USER_HOME="$userProfilePath"
export USER_DIR="$userProfilePath"

echo "[INFO] Environment variables set for Node.js/React/Python applications:"
echo "  HOME = $HOME"
echo "  USER_HOME = $USER_HOME"
echo "  USER_DIR = $USER_DIR"
echo ""
#endregion

#endregion
"""

    def _generate_env_loading_section(self, variables: List[Dict[str, Any]], file_number: int) -> str:
        """Generate bash section to load environment variables via secret_manager.sh"""

        if not variables:
            return ""

        load_calls = []
        for var in variables:
            secret_key_name = f"{var['Name']}_{file_number}"
            display_name = var.get('DisplayName', var['Name'])
            load_calls.append(
                f"load_secret_value \"{secret_key_name}\" \"{var['Name']}\" \"{display_name}\""
            )

        load_commands = "\n".join(load_calls)

        return f"""
# =============================================================================
# Load Environment Variables from Secret Manager
# =============================================================================
echo ""
echo "============================================================"
echo "Loading Environment Variables"
echo "============================================================"
echo ""

python_exec="python3"
if ! command -v "$python_exec" &> /dev/null; then
    if command -v python &> /dev/null; then
        python_exec="python"
    else
        echo "[ERROR] Python is required to load secrets"
        exit 1
    fi
fi

# Use relative path from script location to project root
secret_manager_script="$projectRootPath/pycore/pyfoundations/secret_manager.py"

echo "[DEBUG] Python executable: $python_exec"
echo "[DEBUG] Project root: $projectRootPath"
echo "[DEBUG] Secret manager script: $secret_manager_script"
echo "[DEBUG] Script file exists: $([ -f "$secret_manager_script" ] && echo "YES" || echo "NO")"

load_secret_value() {{
    local key_name="$1"
    local env_name="$2"
    local display_name="$3"
    local value=""

    echo "[DEBUG] Loading secret key: $key_name -> $env_name"
    echo "[DEBUG] Working directory: $projectRootPath"
    echo "[DEBUG] Command: cd \"$projectRootPath\" && $python_exec \"$secret_manager_script\" get_secret_key \"$key_name\""

    # Capture stderr to temp file for debugging
    local tmp_err=$(mktemp)
    # Switch to project root before calling Python
    value=$(cd "$projectRootPath" && $python_exec "$secret_manager_script" get_secret_key "$key_name" 2>"$tmp_err")
    local exit_code=$?

    # Show stderr if there were errors
    if [ -s "$tmp_err" ]; then
        echo "[DEBUG] Python stderr:"
        cat "$tmp_err"
    fi
    rm -f "$tmp_err"

    echo "[DEBUG] Exit code: $exit_code"
    echo "[DEBUG] Returned value length: ${{#value}}"

    if [ -n "$value" ]; then
        export "$env_name"=\"$value\"
        echo "[SUCCESS] Loaded $display_name = $value"
        echo "[INFO] Command executed: export $env_name=\"$value\""
        
        # Verify environment variable is correctly set
        current_value="${{!env_name}}"
        if [ "$current_value" = "$value" ]; then
            echo "[VERIFY] Environment variable $env_name is correctly set"
            echo "[VERIFY] Current value: $current_value"
        else
            echo "[WARNING] Environment variable $env_name verification failed"
            echo "[WARNING] Expected: $value"
            echo "[WARNING] Actual: $current_value"
        fi
        return 0
    fi

    echo "[WARNING] Failed to load $display_name (empty value returned)"
    return 1
}}

{load_commands}

echo ""
"""

    def _generate_env_display_section(self, variables: List[Dict[str, Any]]) -> str:
        """
        Generate bash section to display environment variables

        Args:
            variables: List of variable definitions

        Returns:
            Bash script section as string
        """
        if not variables:
            return ""

        lines = ["echo \"Environment Variables:\""]
        for var in variables:
            var_name = var['Name']
            lines.extend([
                f"if [ -n \"${{{var_name}}}\" ]; then",
                f"    echo \"  {var_name}=${{{var_name}}}\"",
                "fi"
            ])

        return "\n".join(lines) + "\n"

    def _generate_header(self, config_name: str, command_prefix: str,
                        ps_command: str, file_number: int, file_name: str = "") -> str:
        """
        Generate script header with metadata

        Returns:
            Bash script header as string
        """
        return f"""#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# =============================================================================
# {config_name} Global File #{file_number}
# =============================================================================
#
# Synopsis:
#     {config_name} Launch Script
#
# Description:
#     This file is automatically generated by Special Software Environment Manager
#     Contains environment variable setup and tool startup functionality for Linux systems
#
# Notes:
#     - Tool Name: {config_name}
#     - Command Prefix: {command_prefix}
#     - Command: {ps_command}
#     - File Number: {file_number}
#     - File Name: {file_name}
#
# Environment Variables:
#     Environment variables are loaded from encrypted storage using secret_manager.sh
# =============================================================================

set -e
"""

    def _generate_file_display(self, file_name: str = "") -> str:
        """
        Generate file name display section

        Returns:
            Bash script section as string
        """
        if not file_name:
            return ""

        return f"""
echo ""
echo "============================================================"
echo "Running: {file_name}"
echo "============================================================"
echo ""
"""

    def _generate_launch_section(self, config_name: str, ps_command: str,
                                 variables: List[Dict[str, Any]] = None) -> str:
        """
        Generate tool launch section

        Args:
            config_name: Configuration display name
            ps_command: Command to execute
            variables: Optional list of variables for display

        Returns:
            Bash script section as string
        """
        section = f"""
# =============================================================================
# Launch Tool
# =============================================================================
echo ""
echo "============================================================"
echo "Press Enter to start {config_name}..."
echo "============================================================"
read -p "Press Enter to continue"

echo ""
echo "Executing: {ps_command}"
echo ""
"""

        # Add environment variable display if variables exist
        if variables:
            section += self._generate_env_display_section(variables)
            section += "\n"

        section += f"""
echo ""
echo "Starting {config_name}..."
echo ""

# Execute command with environment variables
{ps_command}

echo ""
echo "Session ended"
echo ""
"""

        return section

    def generate_command_content(self, config_name: str, command_prefix: str,
                                ps_command: str, file_number: int,
                                variables: List[Dict[str, Any]],
                                mcp_section: str = "", file_name: str = "") -> str:
        """
        Generate Linux bash script content for AI tools

        Includes environment variable loading from encrypted storage using Python secret_manager.
        Uses modular helper methods for maintainability and reusability.

        Args:
            config_name: Configuration display name
            command_prefix: Command prefix for the tool
            ps_command: Command to execute
            file_number: File number for this script
            variables: List of variable definitions
            mcp_section: Optional MCP synchronization section
            file_name: Optional file name for display

        Returns:
            Complete bash script as string
        """
        # Generate all sections using helper methods
        header = self._generate_header(config_name, command_prefix, ps_command, file_number, file_name)
        file_display = self._generate_file_display(file_name)
        custom_user_dir_section = self.generate_custom_user_directory_section()
        env_loading = self._generate_env_loading_section(variables, file_number)

        # Add MCP section if provided
        mcp_section_content = ""
        if mcp_section:
            mcp_section_content = f"""
# =============================================================================
# MCP Server Synchronization
# =============================================================================
echo ""
echo "============================================================"
echo "MCP Server Synchronization"
echo "============================================================"
echo ""

{mcp_section}
"""

        launch = self._generate_launch_section(config_name, ps_command, variables)

        # Combine all sections
        return f"{header}{file_display}{custom_user_dir_section}{env_loading}{mcp_section_content}{launch}"

    def generate_ssh_command_content(self, config_name: str, file_number: int,
                                    user_inputs: Dict[str, str], file_name: str = "") -> str:
        """Generate Linux SSH connection bash script"""
        ssh_conn_key = f"SSH_CONNECTION_{file_number}"
        password_key_name = f"SSH_PASSWORD_{file_number}"

        header = f"""#!/bin/bash
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# =============================================================================
# {config_name} Global File #{file_number}
# =============================================================================
#
# Synopsis:
#     SSH Connection Script
#
# Description:
#     This file is automatically generated by Special Software Environment Manager
#     Contains SSH connection setup for Linux systems with encrypted password storage
#
# Notes:
#     - Configuration: {config_name}
#     - SSH Connection: Loaded dynamically from secret key {ssh_conn_key}
#     - File Number: {file_number}
#     - File Name: {file_name}
# =============================================================================

set -e
"""

        file_name_display = ""
        if file_name:
            file_name_display = f"""
echo ""
echo "============================================================"
echo "Running: {file_name}"
echo "============================================================"
echo ""
"""


        path_resolution = """
# =============================================================================
# Initialize Path Variables
# =============================================================================
# Resolve script real path (handle symlinks)
# When script is executed via symlink (e.g., from /usr/local/bin),
# BASH_SOURCE[0] returns symlink path. We need to resolve it to actual
# file path to get correct directory structure.
scriptSource="${BASH_SOURCE[0]}"

# Check if scriptSource is a symlink and resolve it
if [ -L "$scriptSource" ]; then
    # Resolve symlink to actual file path
    scriptSource="$(readlink -f "$scriptSource" 2>/dev/null || echo "$scriptSource")"
fi

# Get absolute path of script directory using cd + pwd for reliability
scriptCurrentPath="$(cd "$(dirname "$scriptSource")" && pwd)"

# Calculate project structure paths
# Expected structure: project_root/scripts/linuxenvs/script.sh
scriptsDirPath="$(cd "$scriptCurrentPath/.." && pwd)"
projectRootPath="$(cd "$scriptsDirPath/.." && pwd)"

echo "[DEBUG] Script Source: $scriptSource"
echo "[DEBUG] Script Path: $scriptCurrentPath"
echo "[DEBUG] Scripts Dir: $scriptsDirPath"
echo "[DEBUG] Project Root: $projectRootPath"
echo ""
"""

        load_secret_manager = f"""
# =============================================================================
# Load SSH Configuration via PyCore
# =============================================================================
echo ""
echo "============================================================"
echo "Loading SSH Configuration"
echo "============================================================"
echo ""

# Detect Python executable
PYTHON_EXECUTABLE=""
if command -v python3 &> /dev/null; then
    PYTHON_EXECUTABLE="python3"
elif command -v python &> /dev/null; then
    PYTHON_EXECUTABLE="python"
else
    echo "[ERROR] Python not found. Cannot load SSH secrets."
    exit 1
fi

SECRET_MANAGER_SCRIPT="$projectRootPath/pycore/pyfoundations/secret_manager.py"
echo "[DEBUG] Python executable: $PYTHON_EXECUTABLE"
echo "[DEBUG] Secret manager script: $SECRET_MANAGER_SCRIPT"
echo ""

# Function to get secret value
get_secret_value() {{
    local key_name="$1"
    echo "[DEBUG] Loading secret key: $key_name" >&2

    # Switch to project root for Python execution
    cd "$projectRootPath"

    local value
    value=$("$PYTHON_EXECUTABLE" "$SECRET_MANAGER_SCRIPT" get_secret_key "$key_name" 2>/dev/null)
    local exit_code=$?

    if [ $exit_code -eq 0 ] && [ -n "$value" ]; then
        echo "$value"
        return 0
    else
        echo "[DEBUG] Failed to load secret: $key_name (exit code: $exit_code)" >&2
        return 1
    fi
}}

SSH_CONNECTION=$(get_secret_value "{ssh_conn_key}")
if [ -n "$SSH_CONNECTION" ]; then
    echo "[SUCCESS] SSH Connection loaded: $SSH_CONNECTION"
else
    echo "[ERROR] SSH_CONNECTION not found"
    exit 1
fi

SSH_PASSWORD=$(get_secret_value "{password_key_name}")
if [ -n "$SSH_PASSWORD" ]; then
    echo "[SUCCESS] SSH password loaded: $SSH_PASSWORD"
else
    echo "[INFO] No password configured (using SSH key authentication)"
fi
echo ""
"""

        connection_section = f"""
# =============================================================================
# Execute SSH Connection
# =============================================================================
echo ""
echo "============================================================"
echo "Connecting to SSH Server"
echo "============================================================"
echo ""

if [ -z "$SSH_CONNECTION" ]; then
    echo "[ERROR] SSH connection string is empty"
    exit 1
fi

if [ -n "$SSH_PASSWORD" ]; then
    # Display password for copy-paste
    echo "============================================================"
    echo "  SSH PASSWORD (Copy this to clipboard):"
    echo "  $SSH_PASSWORD"
    echo "============================================================"
    echo ""
    echo "[INFO] SSH will prompt for password. Please paste the password above when prompted."
    echo ""
    echo "Executing: ssh $SSH_CONNECTION"
    echo ""

    # Execute SSH connection - it will prompt for password
    ssh "$SSH_CONNECTION" "$@"
else
    # No password configured, use SSH key authentication
    echo "[INFO] No password configured, using SSH key authentication"
    echo "Executing: ssh $SSH_CONNECTION"
    echo ""

    ssh "$SSH_CONNECTION" "$@"
fi

echo ""
echo "SSH session ended"
echo ""
"""

        return f"{header}{file_name_display}{path_resolution}{load_secret_manager}{connection_section}"

    def write_linux_script(self, content: str, command_prefix: str, file_number: int) -> bool:
        """Write Linux script to linuxenvs directory"""
        linuxenvs_dir = self.scripts_dir / 'linuxenvs'

        if not linuxenvs_dir.exists():
            linuxenvs_dir.mkdir(parents=True, exist_ok=True)
            print(f"Created linuxenvs directory: {linuxenvs_dir}")

        file_name = f"{command_prefix}{file_number}.sh"
        target_path = linuxenvs_dir / file_name

        try:
            with open(target_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Make script executable on Linux
            import platform
            if platform.system() != 'Windows':
                import stat
                os.chmod(target_path, os.stat(target_path).st_mode | stat.S_IEXEC)

            print(f"Linux script written to: {target_path}")

            if target_path.exists():
                file_size = target_path.stat().st_size
                print(f"File verification: SUCCESS - Size: {file_size} bytes")
                return True
            else:
                print("File verification: FAILED")
                return False

        except Exception as e:
            print(f"Failed to write Linux script: {e}")
            return False
