"""
MCP Section Generator

Generates MCP synchronization sections for both Windows and Linux.
"""

from pathlib import Path
from typing import Dict


class MCPSectionGenerator:
    """Generates MCP synchronization sections"""

    def __init__(self, path_config):
        self.path_config = path_config

    def generate_windows_mcp_section(
        self, tool_type: str, tool_display_name: str,
        target_name: str, support_upgrade: bool = True,
        support_npm_update: bool = False,
        include_launch_pause: bool = True
    ) -> str:
        """Generate Windows PowerShell MCP section

        include_launch_pause: when False, omit the trailing 'Press Enter to
        continue' pause (used by codex which has its own single consolidated
        pause + variable summary before launch)."""
        update_script_name = self.path_config.get_update_script_path(tool_type, 'windows').name
        sync_script_name = self.path_config.get_mcp_sync_script_path(tool_type).name
        pre_launch_script_name = self.path_config.get_pre_launch_script_path(tool_type, 'windows').name

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
Write-Host ""
Write-Host "============================================================" -ForegroundColor Red
Write-Host "WARNING: Upgrade Option" -ForegroundColor Red
Write-Host "============================================================" -ForegroundColor Red
Write-Host "Upgrading {tool_display_name} may cause damage to your installation." -ForegroundColor Yellow
Write-Host "Only proceed if you are absolutely sure." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Red
Write-Host ""

$upgradeChoice = Read-Host "Do you want to upgrade {tool_display_name}? (y/N)"
if ($upgradeChoice -eq "y" -or $upgradeChoice -eq "Y") {{
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "FINAL CONFIRMATION REQUIRED" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "This upgrade process has been known to cause issues." -ForegroundColor Yellow
    Write-Host "Are you ABSOLUTELY SURE you want to continue?" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Red
    $finalConfirm = Read-Host "Type 'YES' in capital letters to confirm"

    if ($finalConfirm -eq "YES") {{
        $upgradeScript = Join-Path $aiToolsDirPath "{update_script_name}"
        Write-Host ""
        Write-Host "[INFO] Launching {tool_display_name} upgrade in separate window..." -ForegroundColor Yellow
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c","`"$upgradeScript`"" -WindowStyle Normal
        Write-Host "[SUCCESS] Upgrade window opened" -ForegroundColor Green
    }} else {{
        Write-Host "[INFO] Upgrade cancelled - confirmation not received" -ForegroundColor Cyan
    }}
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

        sync_section = f"""$syncScript = Join-Path $aiToolsDirPath "{sync_script_name}"
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Syncing MCP Server Configurations (Always Required)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] Executing: python -u `"$syncScript`"" -ForegroundColor Cyan
Write-Host ""

python -u "$syncScript"

if ($LASTEXITCODE -ne 0) {{
    Write-Host ""
    Write-Host "[WARNING] MCP synchronization failed" -ForegroundColor Yellow
    Write-Host "[INFO] Continuing anyway..." -ForegroundColor Cyan
}} else {{
    Write-Host ""
    Write-Host "[SUCCESS] MCP synchronization completed" -ForegroundColor Green
}}
"""
        if include_launch_pause:
            sync_section += f"""
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

    def generate_linux_mcp_section(
        self, tool_type: str, tool_display_name: str,
        target_name: str, support_upgrade: bool = True,
        support_npm_update: bool = False,
        include_launch_pause: bool = True
    ) -> str:
        """Generate Linux bash MCP section

        include_launch_pause: when False, omit the trailing 'Press Enter to
        continue' pause (codex consolidates to one pause + variable summary)."""
        update_script_name = self.path_config.get_update_script_path(tool_type, 'linux').name
        sync_script_name = self.path_config.get_mcp_sync_script_path(tool_type).name
        pre_launch_script_name = self.path_config.get_pre_launch_script_path(tool_type, 'linux').name

        pre_launch_section = f"""# Execute pre-launch script if it exists
preLaunchScript="$ai_tools_dir_path/{pre_launch_script_name}"
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
echo ""
echo "============================================================"
echo "WARNING: Upgrade Option"
echo "============================================================"
echo "Upgrading {tool_display_name} may cause damage to your installation."
echo "Only proceed if you are absolutely sure."
echo "============================================================"
echo ""

read -p "Do you want to upgrade {tool_display_name}? (y/N): " upgrade_choice
if [ "$upgrade_choice" = "y" ] || [ "$upgrade_choice" = "Y" ]; then
    echo ""
    echo "============================================================"
    echo "FINAL CONFIRMATION REQUIRED"
    echo "============================================================"
    echo "This upgrade process has been known to cause issues."
    echo "Are you ABSOLUTELY SURE you want to continue?"
    echo "============================================================"
    read -p "Type 'YES' in capital letters to confirm: " final_confirm

    if [ "$final_confirm" = "YES" ]; then
        echo ""
        echo "[INFO] Launching {tool_display_name} upgrade in separate terminal..."
        upgrade_script="$ai_tools_dir_path/{update_script_name}"
        if [ -f "$upgrade_script" ]; then
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
        echo "[INFO] Upgrade cancelled - confirmation not received"
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

        sync_section = f"""echo ""
echo "============================================================"
echo "Syncing MCP Server Configurations (Always Required)"
echo "============================================================"
echo ""
sync_script="$ai_tools_dir_path/{sync_script_name}"
if [ -f "$sync_script" ]; then
    echo "[INFO] Executing: python -u '$sync_script'"
    echo ""

    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo "[ERROR] Python not found"
        exit 1
    fi

    $PYTHON_CMD -u "$sync_script"

    if [ $? -ne 0 ]; then
        echo ""
        echo "[WARNING] MCP synchronization failed"
        echo "[INFO] Continuing anyway..."
    else
        echo ""
        echo "[SUCCESS] MCP synchronization completed"
    fi
else
    echo "[WARNING] MCP sync script not found: $sync_script"
    echo "[INFO] Skipping MCP synchronization"
fi
"""
        if include_launch_pause:
            sync_section += f"""
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


__all__ = ['MCPSectionGenerator']

