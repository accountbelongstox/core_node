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
                           target_name: str, support_upgrade: bool = True) -> str:
        """Generate MCP synchronization section for any AI tool"""
        update_script_path = self.get_update_script_path(tool_type)
        sync_script_path = self.get_mcp_sync_script_path(tool_type)
        pre_launch_script_path = self.get_pre_launch_script_path(tool_type)

        pre_launch_section = f"""# Execute pre-launch script if it exists
if (Test-Path "{pre_launch_script_path}") {{
    $currentWorkingDir = Get-Location
    Write-Host "[INFO] Executing pre-launch script: {pre_launch_script_path}" -ForegroundColor Cyan
    Write-Host "[INFO] Working Directory: $currentWorkingDir" -ForegroundColor Cyan
    Write-Host ""
    & "{pre_launch_script_path}" -WorkingDirectory "$currentWorkingDir"
    Write-Host ""
}}"""

        upgrade_section = ""
        if support_upgrade:
            upgrade_section = f"""
Write-Host "Available tasks:" -ForegroundColor White
Write-Host "  [1] Upgrade {tool_display_name} to latest version (runs in separate window)" -ForegroundColor White
Write-Host "  [2] Sync MCP server configurations (runs now)" -ForegroundColor White
Write-Host ""

$upgradeChoice = Read-Host "Do you want to upgrade {tool_display_name}? (y/N)"
if ($upgradeChoice -eq "y" -or $upgradeChoice -eq "Y") {{
    Write-Host ""
    Write-Host "[INFO] Launching {tool_display_name} upgrade in separate window..." -ForegroundColor Yellow
    # Use Start-Process to launch in new window, preventing environment pollution
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c","`"{update_script_path}`"" -WindowStyle Normal
    Write-Host "[SUCCESS] Upgrade window opened" -ForegroundColor Green
}} else {{
    Write-Host "[INFO] Skipping upgrade" -ForegroundColor Cyan
}}

"""

        sync_section = f"""$currentWorkingDir = Get-Location
Write-Host ""
Write-Host "Syncing MCP Server Configurations..." -ForegroundColor Yellow
Write-Host ""
Write-Host "[INFO] Executing: python -u `"{sync_script_path}`" --target {target_name} --working-dir `"$currentWorkingDir`"" -ForegroundColor Cyan
Write-Host "[INFO] Working Directory: $currentWorkingDir" -ForegroundColor Cyan
Write-Host ""

python -u "{sync_script_path}" --target {target_name} --working-dir "$currentWorkingDir"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Press Enter to start {tool_display_name}..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
$null = Read-Host "Press Enter to continue"
"""

        return f"""Write-Host "{tool_display_name} - Pre-Launch Tasks" -ForegroundColor Yellow
Write-Host ""

{pre_launch_section}
{upgrade_section}
{sync_section}
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
    - Generation Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
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
#region Load SecretManager
$secretManagerPath = "{self.secret_manager_path}"

if (Test-Path $secretManagerPath) {{
    . $secretManagerPath
    Write-Host "[INFO] SecretManager loaded successfully" -ForegroundColor Green
}} else {{
    Write-Host "[WARNING] SecretManager not found at: $secretManagerPath" -ForegroundColor Yellow
    Write-Host "[WARNING] Environment variables will not be loaded" -ForegroundColor Yellow
}}
#endregion

#region Load Environment Variables from SecretManager
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Loading Environment Variables" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

"""

        var_loading_code = ""
        for var in variables:
            secret_key_name = f"{var['Name']}_{file_number}"
            var_loading_code += f"""$env:{var['Name']} = Get-SecretKey -KeyName "{secret_key_name}"
if ($env:{var['Name']}) {{
    Write-Host "[SUCCESS] Loaded {var['Name']} = $($env:{var['Name']})" -ForegroundColor Green
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

        return f"""{header}{file_name_display}{env_section}{mcp_section_content}{launch_section}"""

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
    - Generation Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
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
#region Load SecretManager
$secretManagerPath = "{self.secret_manager_path}"

if (Test-Path $secretManagerPath) {{
    . $secretManagerPath
    Write-Host "[INFO] SecretManager loaded successfully" -ForegroundColor Green
}} else {{
    Write-Host "[WARNING] SecretManager not found at: $secretManagerPath" -ForegroundColor Yellow
}}
#endregion

#region Load SSH Configuration
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Loading SSH Configuration" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$sshConnection = "{ssh_connection}"
Write-Host "[INFO] SSH Connection: $sshConnection" -ForegroundColor Green

$sshPassword = $null
if (Get-Command Get-SecretKey -ErrorAction SilentlyContinue) {{
    $sshPassword = Get-SecretKey -KeyName "{password_key_name}"
    if ($sshPassword) {{
        Write-Host "[SUCCESS] SSH password loaded from SecretManager" -ForegroundColor Green
    }} else {{
        Write-Host "[INFO] No password configured (using SSH key authentication)" -ForegroundColor Yellow
    }}
}} else {{
    Write-Host "[INFO] SecretManager not available" -ForegroundColor Yellow
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

        return f"{header}{file_name_display}{load_secret_manager}"
