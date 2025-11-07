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
        self.pycore_path = self.project_root / 'pycore'
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
        update_script_path = self.get_update_script_path(tool_type)
        sync_script_path = self.get_mcp_sync_script_path(tool_type)
        pre_launch_script_path = self.get_pre_launch_script_path(tool_type)

        pre_launch_section = f"""# Execute pre-launch script if it exists
if [ -f "{pre_launch_script_path.as_posix()}" ]; then
    current_working_dir="$(pwd)"
    echo "[INFO] Executing pre-launch script: {pre_launch_script_path.as_posix()}"
    echo "[INFO] Working Directory: $current_working_dir"
    echo ""
    bash "{pre_launch_script_path.as_posix()}" "$current_working_dir"
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
    if [ -f "{update_script_path.as_posix()}" ]; then
        # Launch in background to avoid blocking current environment
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal -- bash -c "{update_script_path.as_posix()}; read -p 'Press Enter to close'"
        elif command -v xterm &> /dev/null; then
            xterm -e "bash {update_script_path.as_posix()}; read -p 'Press Enter to close'" &
        else
            bash "{update_script_path.as_posix()}" &
        fi
        echo "[SUCCESS] Upgrade terminal opened"
    else
        echo "[WARNING] Upgrade script not found: {update_script_path.as_posix()}"
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
if [ -f "{sync_script_path.as_posix()}" ]; then
    echo "[INFO] Executing: python -u '{sync_script_path.as_posix()}' --target {target_name} --working-dir '$current_working_dir'"
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

    $PYTHON_CMD -u "{sync_script_path.as_posix()}" --target {target_name} --working-dir "$current_working_dir"
else
    echo "[WARNING] MCP sync script not found: {sync_script_path.as_posix()}"
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
scriptCurrentPath="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scriptsDirPath="$(dirname "$scriptCurrentPath")"
shellsDirPath="$scriptsDirPath/shells"
linuxDirPath="$shellsDirPath/linux"
linuxCommonDirPath="$linuxDirPath/linux_common"
pytoolsDirPath="$scriptsDirPath/pytools"
aiToolsDirPath="$pytoolsDirPath/ai_tools"

#region Custom User Directory Configuration
# ============================================================================
# CUSTOM USER DIRECTORY SETTING
# ============================================================================
# Automatically generates user directory at /tmp/Users/时间戳
# Format: /tmp/Users/YYYYMMDD_HHMMSS
# ============================================================================

# Generate timestamp for directory name
timestamp=$(date +"%Y%m%d_%H%M%S")
baseTempDir="/tmp/Users"
CustomUserDirectory="$baseTempDir/$timestamp"

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
    echo "[SUCCESS] Using auto-generated custom user directory: $userProfilePath"
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

# Test path resolution (can be removed in production)
echo "[DEBUG] Path Resolution Test:"
echo "  Script Path: $scriptCurrentPath"
echo "  Scripts Dir: $scriptsDirPath"
echo "  Shells Dir: $shellsDirPath"
echo "  Linux Dir: $linuxDirPath"
echo "  Linux Common Dir: $linuxCommonDirPath"
echo "  PyTools Dir: $pytoolsDirPath"
echo "  AI Tools Dir: $aiToolsDirPath"
echo "  User Profile: $userProfilePath"
echo "  User Home: $userHomePath"
echo "  Users Directory: $usersDirectoryPath"
echo ""
#endregion
"""

    def _generate_python_secret_loader(self, variables: List[Dict[str, Any]], file_number: int) -> str:
        """
        Generate Python script to load secrets from encrypted storage

        Args:
            variables: List of variable definitions
            file_number: File number to append to secret keys

        Returns:
            Python script as string
        """
        script_lines = [
            "import sys",
            "from pathlib import Path",
            "",
            "# Add pycore to path",
            f"pycore_path = Path(\"{self.pycore_path.as_posix()}\")",
            "sys.path.insert(0, str(pycore_path))",
            "",
            "try:",
            "    from pyfoundations import get_secret_key",
            "",
            "    # Load all secrets",
            "    secrets = {}"
        ]

        # Add loading code for each variable
        for var in variables:
            var_name = var['Name']
            display_name = var['DisplayName']
            secret_key_name = f"{var_name}_{file_number}"

            script_lines.extend([
                f"    try:",
                f"        value = get_secret_key('{secret_key_name}')",
                f"        if value:",
                f"            secrets['{var_name}'] = value",
                f"            print('[SUCCESS] Loaded {display_name}', file=sys.stderr)",
                f"        else:",
                f"            print('[WARNING] Failed to load {display_name}', file=sys.stderr)",
                f"    except Exception as e:",
                f"        print(f'[WARNING] Error loading {display_name}: {{e}}', file=sys.stderr)"
            ])

        script_lines.extend([
            "",
            "    # Output secrets in format: VAR_NAME=value",
            "    for key, value in secrets.items():",
            "        print(f\"{key}={value}\")",
            "",
            "except ImportError as e:",
            "    print(f'[ERROR] Failed to import secret_manager: {e}', file=sys.stderr)",
            "    sys.exit(1)",
            "except Exception as e:",
            "    print(f'[ERROR] Unexpected error: {e}', file=sys.stderr)",
            "    sys.exit(1)"
        ])

        return "\n".join(script_lines)

    def _generate_env_loading_section(self, variables: List[Dict[str, Any]], file_number: int) -> str:
        """
        Generate bash section to load environment variables from encrypted storage

        Args:
            variables: List of variable definitions
            file_number: File number to append to secret keys

        Returns:
            Bash script section as string
        """
        if not variables:
            return ""

        python_script = self._generate_python_secret_loader(variables, file_number)

        return f"""
# =============================================================================
# Load Environment Variables from Encrypted Storage
# =============================================================================
echo ""
echo "============================================================"
echo "Loading Environment Variables"
echo "============================================================"
echo ""

# Python script to load secrets
PYCORE_PATH="{self.pycore_path.as_posix()}"
LOAD_SECRETS_SCRIPT=$(cat <<'PYTHON_SCRIPT'
{python_script}
PYTHON_SCRIPT
)

# Execute Python script and load environment variables
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python not found"
    exit 1
fi

# Load secrets into environment variables
while IFS='=' read -r key value; do
    if [ -n "$key" ] && [ -n "$value" ]; then
        export "$key=$value"
        echo "[SUCCESS] Set $key"
    fi
done < <($PYTHON_CMD -c "$LOAD_SECRETS_SCRIPT" 2>&1 | grep -v '^\[')

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
#     - Generation Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
#
# Environment Variables:
#     Environment variables are loaded from encrypted storage using Python secret_manager
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
        ssh_connection = user_inputs.get('SSH_CONNECTION', '')
        ssh_password = user_inputs.get('SSH_PASSWORD', '')

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
#     Contains SSH connection setup for Linux systems
#
# Notes:
#     - Configuration: {config_name}
#     - SSH Connection: {ssh_connection}
#     - File Number: {file_number}
#     - File Name: {file_name}
#     - Generation Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
# =============================================================================

set -e

SSH_CONNECTION="{ssh_connection}"
"""

        password_section = ""
        if ssh_password:
            password_section = f'SSH_PASSWORD="{ssh_password}"\n'

        file_name_display = ""
        if file_name:
            file_name_display = f"""
echo ""
echo "============================================================"
echo "Running: {file_name}"
echo "============================================================"
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

echo "Executing: ssh $SSH_CONNECTION"
echo ""

if [ -n "$SSH_PASSWORD" ]; then
    if command -v sshpass &> /dev/null; then
        echo "[INFO] Using sshpass for password authentication"
        sshpass -p "$SSH_PASSWORD" ssh "$SSH_CONNECTION" "$@"
    else
        echo "[WARNING] sshpass not found, falling back to interactive password prompt"
        ssh "$SSH_CONNECTION" "$@"
    fi
else
    ssh "$SSH_CONNECTION" "$@"
fi

echo ""
echo "SSH session ended"
echo ""
"""

        return f"{header}{password_section}{file_name_display}{connection_section}"

    def write_linux_script(self, content: str, command_prefix: str, file_number: int) -> bool:
        """Write Linux script to liunxenvs directory"""
        liunxenvs_dir = self.scripts_dir / 'liunxenvs'

        if not liunxenvs_dir.exists():
            liunxenvs_dir.mkdir(parents=True, exist_ok=True)
            print(f"Created liunxenvs directory: {liunxenvs_dir}")

        file_name = f"{command_prefix}{file_number}.sh"
        target_path = liunxenvs_dir / file_name

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
