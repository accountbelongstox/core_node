"""
Backup and Restore Section Generator

Generates backup and restore sections for AI tools before command execution.
"""


class BackupRestoreSectionGenerator:
    """Generates backup and restore sections"""

    def __init__(self, path_config):
        self.path_config = path_config

    def generate_windows_backup_restore_section(
        self, tool_type: str, tool_display_name: str, binary_name: str
    ) -> str:
        """Generate Windows PowerShell backup/restore section"""

        backup_script = "$aiToolsDirPath\\ai_tools_backup_restore.py"

        return f"""
#region Backup and Restore Check
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Backup and Restore System" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if tool command exists
$toolExists = $false
$toolCommand = Get-Command {binary_name} -ErrorAction SilentlyContinue
if ($toolCommand) {{
    $toolExists = $true
    Write-Host "[OK] {tool_display_name} command found: $($toolCommand.Source)" -ForegroundColor Green
}} else {{
    Write-Host "[NOT FOUND] {tool_display_name} command not available" -ForegroundColor Red
}}

# Backup script path
$backupScript = Join-Path $aiToolsDirPath "ai_tools_backup_restore.py"

if (-not (Test-Path $backupScript)) {{
    Write-Host "[WARNING] Backup script not found, skipping backup/restore" -ForegroundColor Yellow
}} else {{
    if ($toolExists) {{
        # Tool exists - offer backup
        Write-Host ""
        Write-Host "[INFO] {tool_display_name} is available" -ForegroundColor Cyan
        Write-Host "[INFO] You can create a backup before running" -ForegroundColor Cyan
        Write-Host ""

        $backupChoice = Read-Host "Create backup of {tool_display_name}? (check existing backups first) (y/N)"
        if ($backupChoice -eq "y" -or $backupChoice -eq "Y") {{
            Write-Host ""
            Write-Host "[INFO] Starting backup process..." -ForegroundColor Yellow
            python -u "$backupScript" {tool_type} backup
            Write-Host ""
        }} else {{
            Write-Host "[INFO] Skipping backup" -ForegroundColor Cyan
        }}
    }} else {{
        # Tool not found - offer restore
        Write-Host ""
        Write-Host "[ERROR] {tool_display_name} command not found!" -ForegroundColor Red
        Write-Host "[INFO] You can restore from a previous backup" -ForegroundColor Cyan
        Write-Host ""

        $restoreChoice = Read-Host "Restore {tool_display_name} from backup? (Y/n)"
        if ($restoreChoice -ne "n" -and $restoreChoice -ne "N") {{
            Write-Host ""
            Write-Host "[INFO] Listing available backups..." -ForegroundColor Yellow
            python -u "$backupScript" {tool_type} list
            Write-Host ""

            $confirmRestore = Read-Host "Proceed with restore from latest backup? (Y/n)"
            if ($confirmRestore -ne "n" -and $confirmRestore -ne "N") {{
                Write-Host ""
                Write-Host "[INFO] Starting restore process..." -ForegroundColor Yellow
                python -u "$backupScript" {tool_type} restore
                Write-Host ""

                # Re-check if tool exists after restore
                $toolCommand = Get-Command {binary_name} -ErrorAction SilentlyContinue
                if ($toolCommand) {{
                    Write-Host "[SUCCESS] {tool_display_name} restored successfully!" -ForegroundColor Green
                }} else {{
                    Write-Host "[WARNING] Restore completed but command still not found" -ForegroundColor Yellow
                    Write-Host "[INFO] You may need to restart your terminal or check PATH" -ForegroundColor Cyan
                }}
            }} else {{
                Write-Host "[INFO] Restore cancelled" -ForegroundColor Cyan
            }}
        }} else {{
            Write-Host "[INFO] Skipping restore" -ForegroundColor Cyan
            Write-Host "[WARNING] {tool_display_name} will not be available" -ForegroundColor Yellow
        }}
    }}
}}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
#endregion
"""

    def generate_linux_backup_restore_section(
        self, tool_type: str, tool_display_name: str, binary_name: str
    ) -> str:
        """Generate Linux bash backup/restore section"""

        return f"""
#region Backup and Restore Check
echo ""
echo "============================================================"
echo "Backup and Restore System"
echo "============================================================"
echo ""

# Check if tool command exists
tool_exists=false
if command -v {binary_name} &> /dev/null; then
    tool_exists=true
    tool_path=$(which {binary_name})
    echo "[OK] {tool_display_name} command found: $tool_path"
else
    echo "[NOT FOUND] {tool_display_name} command not available"
fi

# Backup script path
backup_script="$ai_tools_dir_path/ai_tools_backup_restore.py"

if [ ! -f "$backup_script" ]; then
    echo "[WARNING] Backup script not found, skipping backup/restore"
else
    # Determine Python command
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo "[ERROR] Python not found, skipping backup/restore"
        PYTHON_CMD=""
    fi

    if [ -n "$PYTHON_CMD" ]; then
        if [ "$tool_exists" = true ]; then
            # Tool exists - offer backup
            echo ""
            echo "[INFO] {tool_display_name} is available"
            echo "[INFO] You can create a backup before running"
            echo ""

            read -p "Create backup of {tool_display_name}? (check existing backups first) (y/N): " backup_choice
            if [ "$backup_choice" = "y" ] || [ "$backup_choice" = "Y" ]; then
                echo ""
                echo "[INFO] Starting backup process..."
                $PYTHON_CMD -u "$backup_script" {tool_type} backup
                echo ""
            else
                echo "[INFO] Skipping backup"
            fi
        else
            # Tool not found - offer restore
            echo ""
            echo "[ERROR] {tool_display_name} command not found!"
            echo "[INFO] You can restore from a previous backup"
            echo ""

            read -p "Restore {tool_display_name} from backup? (Y/n): " restore_choice
            if [ "$restore_choice" != "n" ] && [ "$restore_choice" != "N" ]; then
                echo ""
                echo "[INFO] Listing available backups..."
                $PYTHON_CMD -u "$backup_script" {tool_type} list
                echo ""

                read -p "Proceed with restore from latest backup? (Y/n): " confirm_restore
                if [ "$confirm_restore" != "n" ] && [ "$confirm_restore" != "N" ]; then
                    echo ""
                    echo "[INFO] Starting restore process..."
                    $PYTHON_CMD -u "$backup_script" {tool_type} restore
                    echo ""

                    # Re-check if tool exists after restore
                    if command -v {binary_name} &> /dev/null; then
                        echo "[SUCCESS] {tool_display_name} restored successfully!"
                    else
                        echo "[WARNING] Restore completed but command still not found"
                        echo "[INFO] You may need to restart your terminal or check PATH"
                    fi
                else
                    echo "[INFO] Restore cancelled"
                fi
            else
                echo "[INFO] Skipping restore"
                echo "[WARNING] {tool_display_name} will not be available"
            fi
        fi
    fi
fi

echo ""
echo "============================================================"
echo ""
#endregion
"""


__all__ = ['BackupRestoreSectionGenerator']
