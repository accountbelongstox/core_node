param(
    [switch]$debug
)

# --- Root Directory and Python Script Path ---
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScriptPath = Join-Path $rootDir "utils\anti_stuck_tool.py"

Write-Host "Root Directory: $rootDir" -ForegroundColor Cyan
Write-Host "Python Script Path: $pythonScriptPath" -ForegroundColor Cyan

if (-not (Test-Path $pythonScriptPath)) {
    Write-Host "Warning: Python script not found at: $pythonScriptPath" -ForegroundColor Yellow
}

if ($debug) {
    $logFile = "\\DESKTOP-ENII8GN\Users\MDEPC\Documents\RoS-BoT\Logs\logs.txt"
}
else {
    $logFile = "$env:USERPROFILE\Documents\RoS-BoT\Logs\logs.txt"
}

if (-not (Test-Path $logFile)) {
    Write-Host "Log file does not exist: $logFile"
    exit
}

# Detection strings
$START_PICKING_ITEMS = "Start picking up items dropped"
$TOWN_PORTAL_SUCCESS = "Town portal: UpdateGem Success BackTown"

# Timer variables
$isTimerActive = $false
$timerStartTime = $null
$timeoutSeconds = 15

Write-Host "Timer Detection Enabled:" -ForegroundColor Cyan
Write-Host "  - Pick Items Detection: '$START_PICKING_ITEMS'" -ForegroundColor Cyan
Write-Host "  - Town Portal Detection: '$TOWN_PORTAL_SUCCESS'" -ForegroundColor Cyan
Write-Host "  - Timeout: $timeoutSeconds seconds" -ForegroundColor Cyan

# Generate same-name .bat launcher in the same folder as this .ps1 script
$selfPath = $MyInvocation.MyCommand.Path
$selfName = [System.IO.Path]::GetFileNameWithoutExtension($selfPath)
$selfDir = [System.IO.Path]::GetDirectoryName($selfPath)
$batPath = Join-Path $selfDir "analyzer-log.bat"

# .bat content with %~dp0 to support network folders and spaces
$batContent = @"
@echo off
REM Auto-generated batch launcher for PowerShell script

set SCRIPT="%~dp0analyzer-log.ps1"

powershell.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -File %SCRIPT%
"@

# Write .bat file (overwrite)
Set-Content -Path $batPath -Value $batContent -Encoding ASCII

Write-Host "Batch launcher generated at: $batPath"


$wshShell = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath('Desktop')
$linkName = "analyzer-log.lnk"
$linkPath = Join-Path $desktopPath $linkName

if (-not (Test-Path $linkPath)) {
    try {
        $shortcut = $wshShell.CreateShortcut($linkPath)
        $shortcut.TargetPath = $batPath
        $shortcut.WorkingDirectory = $selfDir
        $shortcut.WindowStyle = 1
        $shortcut.Description = "Launcher for analyzer-log.bat"
        $shortcut.Save()
        Write-Host "Shortcut created on Desktop: $linkPath"
    }
    catch {
        Write-Host "Failed to create shortcut: $_" -ForegroundColor Red
    }
}
else {
    Write-Host "Shortcut already exists on Desktop: $linkPath"
}

# --- Log watching logic starts here ---

# Display monitoring setup instructions
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "⚠️  IMPORTANT: Start the Anti-Stuck Monitor First!" -ForegroundColor Yellow
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Before this log analyzer can trigger anti-stuck actions, you need to:" -ForegroundColor White
Write-Host ""
Write-Host "1. Open a NEW PowerShell/CMD window" -ForegroundColor White
Write-Host "2. Run this command:" -ForegroundColor White
Write-Host ""
$pythonCommand = "python.exe `"$pythonScriptPath`""
Write-Host "   $pythonCommand" -ForegroundColor Green
Write-Host ""
Write-Host "3. Keep that monitor window running alongside this log analyzer" -ForegroundColor White
Write-Host ""
Write-Host "💡 The monitor will execute anti-stuck actions when triggers are detected." -ForegroundColor Gray
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

$initialLength = (Get-Content -Path $logFile -Raw).Length
$lastLength = $initialLength

Write-Host "Watching $logFile..." -ForegroundColor Yellow

while ($true) {
    Start-Sleep -Milliseconds 500
    # --- Timer Logic (outside of ticking) ---
    if ($isTimerActive) {
        $elapsedTime = (Get-Date) - $timerStartTime
        if ($elapsedTime.TotalSeconds -ge $timeoutSeconds) {
            Write-Host "`n[TIMER EXPIRED] Timeout ($timeoutSeconds seconds) reached! Executing Python script." -ForegroundColor Red
            $isTimerActive = $false
            $timerStartTime = $null
            try {
                Write-Host "Timer: Writing trigger file for anti-stuck tool..." -ForegroundColor Cyan
                $triggerFile = Join-Path $env:USERPROFILE "anti_stuck_trigger.txt"
                $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                Set-Content -Path $triggerFile -Value "Timer trigger at $timestamp" -Encoding UTF8
                Write-Host "Trigger file written: $triggerFile" -ForegroundColor Green
            } catch {
                Write-Host "Failed to write trigger file: $_" -ForegroundColor Red
            }
        }
    }

    if (-not (Test-Path $logFile)) {
        continue
    }

    $currentContent = Get-Content -Path $logFile -Raw
    $currentLength = $currentContent.Length
    if ($currentLength -gt $lastLength) {
        $newContent = $currentContent.Substring($lastLength)
        $lines = $newContent -split "`n"
        foreach ($line in $lines) {
            $logLineTrim = $line.Trim()
            
            # --- Log Line Processing ---
            if ($logLineTrim -match "ERROR|Failed|Exception") {
                Write-Host $logLineTrim -ForegroundColor Red
            }
            elseif ($logLineTrim -match "Success|Successfull|Done") {
                Write-Host $logLineTrim -ForegroundColor Green
            }
            elseif ($logLineTrim -match "loading|Take portal|Vendor") {
                Write-Host $logLineTrim -ForegroundColor Yellow
            }
            elseif ($logLineTrim -match "INFO") {
                Write-Host $logLineTrim -ForegroundColor Gray
            }
            else {
                Write-Host $logLineTrim
            }
            
            # --- Timer Control Logic ---
            if ($logLineTrim -match $START_PICKING_ITEMS) {
                if (-not $isTimerActive) {
                    $isTimerActive = $true
                    $timerStartTime = Get-Date
                    Write-Host "`n[TIMER STARTED] Pick Items detected - Timer started ($timeoutSeconds seconds)" -ForegroundColor Green
                }
            }
            elseif ($logLineTrim -like "*$TOWN_PORTAL_SUCCESS*") {
                if ($isTimerActive) {
                    $isTimerActive = $false
                    $timerStartTime = $null
                    Write-Host "`n[TIMER CANCELLED] Town Portal detected - Timer stopped" -ForegroundColor Yellow
                }
            }
        }
        $lastLength = $currentLength
    }
}
