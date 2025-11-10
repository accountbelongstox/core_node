"""
Command Content Generator for Windows

Generates PowerShell scripts for Windows systems with full environment variable management.
This is the Windows-specific version of CommandContentGenerator.ps1
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional


class WindowsCommandContentGenerator:
    """Generate Windows PowerShell command scripts"""

    def __init__(self):
        self.project_root = self._get_project_root()
        self.scripts_dir = self.project_root / 'scripts'
        self.win_common_dir = self.scripts_dir / 'shells' / 'win' / 'win_common'
        self.secret_manager_path = self.win_common_dir / 'SecretManager.ps1'

    @staticmethod
    def _get_project_root() -> Path:
        """Get project root directory"""
        current_file = Path(__file__)
        pytools_dir = current_file.parent.parent
        scripts_dir = pytools_dir.parent
        return scripts_dir.parent

    def get_mcp_sync_script_path(self, tool_type: str) -> Path:
        """Get MCP sync script path for a specific tool"""
        return self.scripts_dir / 'pytools' / 'ai_tools' / f'{tool_type}_sync_mcp_servers.py'

    def get_pre_launch_script_path(self, tool_type: str) -> Path:
        """Get pre-launch script path for a specific tool"""
        return self.scripts_dir / 'pytools' / 'ai_tools' / f'{tool_type}_pre_launch.ps1'

    def get_update_script_path(self, tool_type: str) -> Path:
        """Get update/upgrade script path for a specific tool"""
        return self.scripts_dir / 'pytools' / 'ai_tools' / f'{tool_type}_update.bat'

    def generate_mcp_section(self, tool_type: str, tool_display_name: str,
                           target_name: str, support_upgrade: bool = True, support_npm_update: bool = False) -> str:
        """Generate MCP synchronization section for any AI tool

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
$preLaunchScript = Join-Path $aiToolsDirPath "{pre_launch_script_name}"
if (Test-Path $preLaunchScript) {{
    $currentWorkingDir = Get-Location
    Write-Host "[INFO] Executing pre-launch script: $preLaunchScript" -ForegroundColor Cyan
    Write-Host "[INFO] Working Directory: $currentWorkingDir" -ForegroundColor Cyan
    Write-Host ""
    & $preLaunchScript -WorkingDirectory "$currentWorkingDir"
    Write-Host ""
}}
"""

        upgrade_section = ""
        if support_upgrade:
            upgrade_section = f"""
Write-Host "Available tasks:" -ForegroundColor White
Write-Host "  [1] Upgrade {tool_display_name} to latest version (runs in separate window)" -ForegroundColor White
Write-Host "  [2] Sync MCP server configurations (runs now)" -ForegroundColor White
Write-Host ""

$upgradeChoice = Read-Host "Do you want to upgrade {tool_display_name}? (y/N)"
if ($upgradeChoice -eq "y" -or $upgradeChoice -eq "Y") {{
    $upgradeScript = Join-Path $aiToolsDirPath "{update_script_name}"
    Write-Host ""
    Write-Host "[INFO] Launching {tool_display_name} upgrade in separate window..." -ForegroundColor Yellow
    # Use Start-Process to launch in new window, preventing environment pollution
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c","`"$upgradeScript`"" -WindowStyle Normal
    Write-Host "[SUCCESS] Upgrade window opened" -ForegroundColor Green
}} else {{
    Write-Host "[INFO] Skipping upgrade" -ForegroundColor Cyan
}}

"""

        npm_update_section = ""
        if support_npm_update:
            npm_update_section = """
Write-Host ""
$npmUpdateChoice = Read-Host "Do you want to update npm global packages? (y/N)"
if ($npmUpdateChoice -eq "y" -or $npmUpdateChoice -eq "Y") {
    Write-Host ""
    Write-Host "[INFO] Updating npm global packages..." -ForegroundColor Yellow
    Write-Host ""

    # Check if npm is available
    $npmAvailable = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmAvailable) {
        Write-Host "[INFO] Checking for npm updates..." -ForegroundColor Cyan
        npm update -g
        Write-Host ""
        Write-Host "[SUCCESS] npm global packages updated" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] npm command not found" -ForegroundColor Yellow
    }
    Write-Host ""
} else {
    Write-Host "[INFO] Skipping npm update" -ForegroundColor Cyan
    Write-Host ""
}

"""

        sync_section = f"""$currentWorkingDir = Get-Location
$syncScript = Join-Path $aiToolsDirPath "{sync_script_name}"
Write-Host ""
Write-Host "Syncing MCP Server Configurations..." -ForegroundColor Yellow
Write-Host ""
Write-Host "[INFO] Executing: python -u `"$syncScript`" --target {target_name} --working-dir `"$currentWorkingDir`"" -ForegroundColor Cyan
Write-Host "[INFO] Working Directory: $currentWorkingDir" -ForegroundColor Cyan
Write-Host ""

python -u "$syncScript" --target {target_name} --working-dir "$currentWorkingDir"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Press Enter to start {tool_display_name}..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
$null = Read-Host "Press Enter to continue"
"""

        return f"""Write-Host "{tool_display_name} - Pre-Launch Tasks" -ForegroundColor Yellow
Write-Host ""

{pre_launch_section}
{upgrade_section}{npm_update_section}
{sync_section}
"""

    def generate_custom_user_directory_section(self) -> str:
        """Generate custom user directory configuration section"""
        return """
#region Initialize Path Variables
$scriptActualPath = $PSCommandPath
$item = Get-Item -LiteralPath $PSCommandPath
if ($item -and $item -is [System.IO.FileInfo] -and $item.LinkType) {
    $scriptActualPath = $item.Target
}
$scriptCurrentPath = Split-Path $scriptActualPath -Parent
if (-not $scriptCurrentPath) {
    $scriptCurrentPath = $PSScriptRoot
    if (-not $scriptCurrentPath) {
        $scriptCurrentPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
}
$scriptsDirPath = Split-Path $scriptCurrentPath -Parent
$projectRootPath = Split-Path $scriptsDirPath -Parent
$shellsDirPath = Join-Path $scriptsDirPath "shells"
$winDirPath = Join-Path $shellsDirPath "win"
$winCommonDirPath = Join-Path $winDirPath "win_common"
$pytoolsDirPath = Join-Path $scriptsDirPath "pytools"
$aiToolsDirPath = Join-Path $pytoolsDirPath "ai_tools"
# Path resolution algorithm:
#   Script -> Scripts Dir -> Project Root -> Tool-specific directories
Write-Host "[DEBUG] Script Path: $scriptCurrentPath" -ForegroundColor DarkGray
Write-Host "[DEBUG] Scripts Dir: $scriptsDirPath" -ForegroundColor DarkGray
Write-Host "[DEBUG] Project Root: $projectRootPath" -ForegroundColor DarkGray
#endregion
# Path resolution algorithm:
#   Script -> Scripts Dir -> Project Root -> Tool-specific directories

#region Custom User Directory Configuration
# ============================================================================
# CUSTOM USER DIRECTORY SETTING
# ============================================================================
# Uses fixed user directory at D:\\.tmp\\Users\\default
# Note: No timestamp to avoid git conflicts on regeneration
# ============================================================================

# Use fixed directory name (no timestamp)
$baseTempDir = "D:\\.tmp\\Users"
$CustomUserDirectory = Join-Path $baseTempDir "default"

# Create the directory if it doesn't exist
try {
    if (-not (Test-Path $baseTempDir)) {
        Write-Host "[INFO] Creating base directory: $baseTempDir" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $baseTempDir -Force | Out-Null
    }

    if (-not (Test-Path $CustomUserDirectory)) {
        Write-Host "[INFO] Creating custom user directory: $CustomUserDirectory" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $CustomUserDirectory -Force | Out-Null
    }

    # Verify directory was created successfully
    if (Test-Path $CustomUserDirectory) {
        $userProfilePath = $CustomUserDirectory
        Write-Host "[SUCCESS] Using auto-generated custom user directory: $userProfilePath" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Failed to create custom directory, falling back to system default" -ForegroundColor Yellow
        $userProfilePath = $env:USERPROFILE
        if (-not $userProfilePath) {
            $userProfilePath = [Environment]::GetFolderPath("UserProfile")
        }
        Write-Host "[INFO] Using system default user directory: $userProfilePath" -ForegroundColor Cyan
    }
} catch {
    Write-Host "[ERROR] Failed to create custom user directory: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[INFO] Falling back to system default..." -ForegroundColor Yellow
    $userProfilePath = $env:USERPROFILE
    if (-not $userProfilePath) {
        $userProfilePath = [Environment]::GetFolderPath("UserProfile")
    }
    Write-Host "[INFO] Using system default user directory: $userProfilePath" -ForegroundColor Cyan
}

$userHomePath = $userProfilePath
$usersDirectoryPath = Split-Path $userProfilePath -Parent

# Set environment variables for Node.js, React, Python, and other applications
# ============================================================================
# These environment variables will be available to all child processes
# including Node.js, React, Python, and other applications launched from this script
#
# Python usage examples:
#   import os
#   user_home = os.path.expanduser("~")  # Uses HOME or USERPROFILE
#   user_home = os.getenv("USERPROFILE") or os.getenv("HOME")
#   from pathlib import Path
#   user_home = Path.home()  # Uses HOME or USERPROFILE
# ============================================================================
$env:USERPROFILE = $userProfilePath
$env:HOME = $userProfilePath
$env:USER_HOME = $userProfilePath
$env:HOMEPATH = $userProfilePath
$env:USER_DIR = $userProfilePath

Write-Host "[INFO] Environment variables set for Node.js/React/Python applications:" -ForegroundColor Cyan
Write-Host "  USERPROFILE = $env:USERPROFILE" -ForegroundColor Gray
Write-Host "  HOME = $env:HOME" -ForegroundColor Gray
Write-Host "  USER_HOME = $env:USER_HOME" -ForegroundColor Gray
Write-Host "  HOMEPATH = $env:HOMEPATH" -ForegroundColor Gray
Write-Host "  USER_DIR = $env:USER_DIR" -ForegroundColor Gray
Write-Host ""
#endregion

# Test path resolution (can be removed in production)
Write-Host "[DEBUG] Path Resolution Test:" -ForegroundColor Magenta
Write-Host "  Script Path: $scriptCurrentPath" -ForegroundColor Gray
Write-Host "  Scripts Dir: $scriptsDirPath" -ForegroundColor Gray
Write-Host "  Shells Dir: $shellsDirPath" -ForegroundColor Gray
Write-Host "  Win Dir: $winDirPath" -ForegroundColor Gray
Write-Host "  Win Common Dir: $winCommonDirPath" -ForegroundColor Gray
Write-Host "  PyTools Dir: $pytoolsDirPath" -ForegroundColor Gray
Write-Host "  AI Tools Dir: $aiToolsDirPath" -ForegroundColor Gray
Write-Host "  User Profile: $userProfilePath" -ForegroundColor Gray
Write-Host "  User Home: $userHomePath" -ForegroundColor Gray
Write-Host "  Users Directory: $usersDirectoryPath" -ForegroundColor Gray
Write-Host ""
#endregion
"""

    def generate_command_content(self, config_name: str, command_prefix: str,
                                ps_command: str, file_number: int,
                                variables: List[Dict[str, Any]],
                                mcp_section: str = "", file_name: str = "") -> str:
        """Generate complete PowerShell command content"""
        header = f"""# ### AI SPECIAL ATTENTION RULES START ###
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

<#
.SYNOPSIS
    {config_name} Global File #{file_number}

.DESCRIPTION
    This file is automatically generated by Special Software Environment Manager
    Contains environment variable setup, MCP synchronization and tool startup functionality

.NOTES
    - Tool Name: {config_name}
    - Command Prefix: {command_prefix}
    - PowerShell Command: {ps_command}
    - File Number: {file_number}
    - File Name: {file_name}
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
"""

        file_name_display = ""
        if file_name:
            file_name_display = f"""
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Running: {file_name}" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
"""

        load_secret_manager = f"""
#region Load Environment Variables via PyCore caller
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Loading Environment Variables" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Detect Python executable (Windows prioritizes 'python' over 'python3')
$pythonExecutable = $null
if (Get-Command python -ErrorAction SilentlyContinue) {{
    $pythonExecutable = "python"
}} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {{
    $pythonExecutable = "python3"
}} else {{
    Write-Host "[ERROR] Python not found. Cannot load secrets." -ForegroundColor Red
    exit 1
}}

# Use relative path from script location to project root
$secretManagerScript = Join-Path $projectRootPath "pycore\pyfoundations\secret_manager.py"
Write-Host "[DEBUG] Python executable: $pythonExecutable" -ForegroundColor DarkGray
Write-Host "[DEBUG] Secret manager script: $secretManagerScript" -ForegroundColor DarkGray
Write-Host "[DEBUG] Project root: $projectRootPath" -ForegroundColor DarkGray

function Get-SecretValue {{
    param([string]$KeyName)
    Write-Host "[DEBUG] Loading secret key: $KeyName" -ForegroundColor DarkGray

    # Save current directory and switch to project root
    $originalLocation = Get-Location
    Set-Location $projectRootPath

    $arguments = @($secretManagerScript, 'get_secret_key', $KeyName)

    Write-Host "[DEBUG] Working directory: $projectRootPath" -ForegroundColor DarkGray
    Write-Host "[DEBUG] Command: $pythonExecutable $($arguments -join ' ')" -ForegroundColor DarkGray

    # Capture both stdout and stderr
    $output = & $pythonExecutable $arguments 2>&1
    $exitCode = $LASTEXITCODE

    # Restore original directory
    Set-Location $originalLocation

    Write-Host "[DEBUG] Exit code: $exitCode" -ForegroundColor DarkGray

    # Check if output contains error messages
    $errorOutput = $output | Where-Object {{ $_ -is [System.Management.Automation.ErrorRecord] }}
    if ($errorOutput) {{
        Write-Host "[DEBUG] Python stderr:" -ForegroundColor Yellow
        $errorOutput | ForEach-Object {{ Write-Host "  $_" -ForegroundColor Yellow }}
    }}

    # Get the actual value (non-error output)
    $value = ($output | Where-Object {{ $_ -isnot [System.Management.Automation.ErrorRecord] }}) -join "`n"

    if ($value) {{
        Write-Host "[DEBUG] Returned value length: $($value.Length)" -ForegroundColor DarkGray
        # Show masked preview (first 4 chars + *** + last 4 chars)
        if ($value.Length -gt 8) {{
            $masked = $value.Substring(0, 4) + "***" + $value.Substring($value.Length - 4)
            Write-Host "[DEBUG] Value preview (masked): $masked" -ForegroundColor DarkGray
        }}
    }} else {{
        Write-Host "[DEBUG] Returned empty value" -ForegroundColor Yellow
    }}

    return $value
}}

"""

        var_loading_code = ""
        for var in variables:
            secret_key_name = f"{var['Name']}_{file_number}"
            display_name = var.get('DisplayName', var['Name'])
            var_loading_code += f"""$env:{var['Name']} = Get-SecretValue "{secret_key_name}"
if ($env:{var['Name']}) {{
    Write-Host "[SUCCESS] Loaded {var['Name']} (Length: $($env:{var['Name']}.Length))" -ForegroundColor Green
    # Show masked value for verification
    if ($env:{var['Name']}.Length -gt 8) {{
        $maskedValue = $env:{var['Name']}.Substring(0, 4) + "***" + $env:{var['Name']}.Substring($env:{var['Name']}.Length - 4)
        Write-Host "[INFO] {display_name}: $maskedValue" -ForegroundColor Cyan
    }} else {{
        Write-Host "[INFO] {display_name}: ****" -ForegroundColor Cyan
    }}
}} else {{
    Write-Host "[WARNING] Failed to load {var['Name']}" -ForegroundColor Yellow
}}

"""

        build_command_code = """
#region Build Launch Command Display
$envVarsParts = @()

"""
        for var in variables:
            build_command_code += f"""if ($env:{var['Name']}) {{
    $envVarsParts += "`$env:{var['Name']}='$($env:{var['Name']})'"
}}

"""

        build_command_code += f"""$envVarsCommand = $envVarsParts -join '; '
if ($envVarsCommand) {{
    $fullCommandDisplay = "$envVarsCommand; {ps_command}"
}} else {{
    $fullCommandDisplay = "{ps_command}"
}}
#endregion

"""

        env_section = load_secret_manager + var_loading_code + build_command_code

        mcp_section_content = ""
        if mcp_section:
            mcp_section_content = f"""
#region MCP Server Synchronization
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "MCP Server Synchronization" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

{mcp_section}
#endregion

"""

        launch_section = f"""
#region Launch Tool
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Press Enter to start {config_name}..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
$null = Read-Host "Press Enter to continue"

Write-Host ""
Write-Host "Executing: {ps_command}" -ForegroundColor White
Write-Host ""
Write-Host "PowerShell Command: powershell -NoProfile -ExecutionPolicy Bypass -Command `"$fullCommandDisplay`"" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Yellow
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
powershell -NoProfile -ExecutionPolicy Bypass -Command $fullCommandDisplay

Write-Host ""
pause
#endregion
"""

        # Generate custom user directory section
        custom_user_dir_section = self.generate_custom_user_directory_section()

        return f"""{header}{file_name_display}{custom_user_dir_section}{env_section}{mcp_section_content}{launch_section}"""

    def generate_ssh_command_content(self, config_name: str, file_number: int,
                                    user_inputs: Dict[str, str], file_name: str = "") -> str:
        """Generate SSH connection PowerShell script"""
        ssh_connection = user_inputs.get('SSH_CONNECTION', '')
        password_key_name = f"SSH_PASSWORD_{file_number}"

        header = f"""# ### AI SPECIAL ATTENTION RULES START ###
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

<#
.SYNOPSIS
    {config_name} Global File #{file_number}

.DESCRIPTION
    This file is automatically generated by Special Software Environment Manager
    Contains SSH connection setup with encrypted password storage

.NOTES
    - Configuration: {config_name}
    - SSH Connection: {ssh_connection}
    - File Number: {file_number}
    - File Name: {file_name}
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
"""

        file_name_display = ""
        if file_name:
            file_name_display = f"""
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Running: {file_name}" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
"""

        load_secret_manager = f"""
#region Load SSH Configuration via PyCore caller
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Loading SSH Configuration" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$sshConnection = "{ssh_connection}"
Write-Host "[INFO] SSH Connection: $sshConnection" -ForegroundColor Green

# Detect Python executable (Windows prioritizes 'python' over 'python3')
$pythonExecutable = $null
if (Get-Command python -ErrorAction SilentlyContinue) {{
    $pythonExecutable = "python"
}} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {{
    $pythonExecutable = "python3"
}} else {{
    Write-Host "[ERROR] Python not found. Cannot load SSH secrets." -ForegroundColor Red
}}

# Use relative path from script location to project root
$secretManagerScript = Join-Path $projectRootPath "pycore\pyfoundations\secret_manager.py"
Write-Host "[DEBUG] Python executable: $pythonExecutable" -ForegroundColor DarkGray
Write-Host "[DEBUG] Secret manager script: $secretManagerScript" -ForegroundColor DarkGray
Write-Host "[DEBUG] Project root: $projectRootPath" -ForegroundColor DarkGray

function Get-SSHSecret {{
    param([string]$KeyName)
    if (-not $pythonExecutable) {{ return $null }}
    Write-Host "[DEBUG] Loading SSH secret key: $KeyName" -ForegroundColor DarkGray

    # Save current directory and switch to project root
    $originalLocation = Get-Location
    Set-Location $projectRootPath

    Write-Host "[DEBUG] Working directory: $projectRootPath" -ForegroundColor DarkGray
    $args = @($secretManagerScript, 'get_secret_key', $KeyName)
    $result = (& $pythonExecutable $args 2>$null)

    # Restore original directory
    Set-Location $originalLocation

    return $result
}}

$sshPassword = Get-SSHSecret "{password_key_name}"
if ($sshPassword) {{
    Write-Host "[SUCCESS] SSH password loaded (Length: $($sshPassword.Length))" -ForegroundColor Green
    # Show masked value for verification
    if ($sshPassword.Length -gt 8) {{
        $maskedValue = $sshPassword.Substring(0, 4) + "***" + $sshPassword.Substring($sshPassword.Length - 4)
        Write-Host "[INFO] Password: $maskedValue" -ForegroundColor Cyan
    }} else {{
        Write-Host "[INFO] Password: ****" -ForegroundColor Cyan
    }}
}} else {{
    Write-Host "[INFO] No password configured (using SSH key authentication)" -ForegroundColor Yellow
}}
#endregion

#region Execute SSH Connection
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Connecting to SSH Server" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($sshConnection)) {{
    Write-Host "[ERROR] SSH connection string is empty" -ForegroundColor Red
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}}

Write-Host "Executing: ssh $sshConnection" -ForegroundColor White
Write-Host ""

if ($sshPassword) {{
    Write-Host "[INFO] Password authentication enabled" -ForegroundColor Yellow
    Write-Host "[INFO] Note: You may need sshpass or similar tool for password authentication" -ForegroundColor Yellow
    Write-Host ""

    if (Get-Command sshpass -ErrorAction SilentlyContinue) {{
        Write-Host "[INFO] Using sshpass for password authentication" -ForegroundColor Green
        $env:SSHPASS = $sshPassword
        & sshpass -e ssh $sshConnection
    }} else {{
        Write-Host "[WARNING] sshpass not found, falling back to interactive password prompt" -ForegroundColor Yellow
        Write-Host "[INFO] Please enter password when prompted" -ForegroundColor Yellow
        Write-Host ""
        & ssh $sshConnection
    }}

    $env:SSHPASS = $null
}} else {{
    & ssh $sshConnection
}}

Write-Host ""
Write-Host "SSH session ended" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Yellow
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
#endregion
"""

        # Generate path resolution section (needed for $projectRootPath)
        path_resolution = """
#region Initialize Path Variables
$scriptActualPath = $PSCommandPath
$item = Get-Item -LiteralPath $PSCommandPath
if ($item -and $item -is [System.IO.FileInfo] -and $item.LinkType) {
    $scriptActualPath = $item.Target
}
$scriptCurrentPath = Split-Path $scriptActualPath -Parent
if (-not $scriptCurrentPath) {
    $scriptCurrentPath = $PSScriptRoot
    if (-not $scriptCurrentPath) {
        $scriptCurrentPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
}
$scriptsDirPath = Split-Path $scriptCurrentPath -Parent
$projectRootPath = Split-Path $scriptsDirPath -Parent
Write-Host "[DEBUG] Script Path: $scriptCurrentPath" -ForegroundColor DarkGray
Write-Host "[DEBUG] Scripts Dir: $scriptsDirPath" -ForegroundColor DarkGray
Write-Host "[DEBUG] Project Root: $projectRootPath" -ForegroundColor DarkGray
#endregion
"""

        return f"{header}{file_name_display}{path_resolution}{load_secret_manager}"
