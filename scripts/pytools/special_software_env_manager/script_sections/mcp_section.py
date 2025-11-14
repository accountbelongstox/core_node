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
        support_npm_update: bool = False
    ) -> str:
        """Generate Windows PowerShell MCP section"""
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
Write-Host "Available tasks:" -ForegroundColor White
Write-Host "  [1] Upgrade {tool_display_name} to latest version (runs in separate window)" -ForegroundColor White
Write-Host "  [2] Sync MCP server configurations (runs now)" -ForegroundColor White
Write-Host ""

$upgradeChoice = Read-Host "Do you want to upgrade {tool_display_name}? (y/N)"
if ($upgradeChoice -eq "y" -or $upgradeChoice -eq "Y") {{
    $upgradeScript = Join-Path $aiToolsDirPath "{update_script_name}"
    Write-Host ""
    Write-Host "[INFO] Launching {tool_display_name} upgrade in separate window..." -ForegroundColor Yellow
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

    def generate_linux_mcp_section(
        self, tool_type: str, tool_display_name: str,
        target_name: str, support_upgrade: bool = True,
        support_npm_update: bool = False
    ) -> str:
        """Generate Linux bash MCP section"""
        update_script_name = self.path_config.get_update_script_path(tool_type, 'linux').name
        sync_script_name = self.path_config.get_mcp_sync_script_path(tool_type).name
        pre_launch_script_name = self.path_config.get_pre_launch_script_path(tool_type, 'linux').name

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


__all__ = ['MCPSectionGenerator']

