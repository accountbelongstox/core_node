param(
    [switch]$debug
)

if ($debug) {
    $logFile = "\\DESKTOP-ENII8GN\Users\MDEPC\Documents\RoS-BoT\Logs\logs.txt"
} else {
    $logFile = "$env:USERPROFILE\Documents\RoS-BoT\Logs\logs.txt"
}

if (-not (Test-Path $logFile)) {
    Write-Host "Log file does not exist: $logFile"
    exit
}

# Generate same-name .bat launcher in the same folder as this .ps1 script
$selfPath = $MyInvocation.MyCommand.Path
$selfName = [System.IO.Path]::GetFileNameWithoutExtension($selfPath)
$selfDir  = [System.IO.Path]::GetDirectoryName($selfPath)
$batPath  = Join-Path $selfDir "watch.bat"

# .bat content with %~dp0 to support network folders and spaces
$batContent = @"
@echo off
REM Auto-generated batch launcher for PowerShell script

set SCRIPT="%~dp0watch-log.ps1"

powershell.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -File %SCRIPT%
"@

# Write .bat file (overwrite)
Set-Content -Path $batPath -Value $batContent -Encoding ASCII

Write-Host "Batch launcher generated at: $batPath"


$wshShell = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath('Desktop')
$linkName = "watchlog.lnk"
$linkPath = Join-Path $desktopPath $linkName

if (-not (Test-Path $linkPath)) {
    try {
        $shortcut = $wshShell.CreateShortcut($linkPath)
        $shortcut.TargetPath = $batPath
        $shortcut.WorkingDirectory = $selfDir
        $shortcut.WindowStyle = 1
        $shortcut.Description = "Launcher for watch.bat"
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

$initialLength = (Get-Content -Path $logFile -Raw).Length
$lastLength = $initialLength

Write-Host "Watching $logFile..." -ForegroundColor Yellow

while ($true) {
    Start-Sleep -Milliseconds 500

    if (-not (Test-Path $logFile)) {
        continue
    }

    $currentContent = Get-Content -Path $logFile -Raw
    $currentLength = $currentContent.Length

    if ($currentLength -gt $lastLength) {
        $newContent = $currentContent.Substring($lastLength)
        $lines = $newContent -split "`n"
        foreach ($line in $lines) {
            $trim = $line.Trim()
            if ($trim -match "ERROR|Failed|Exception") {
                Write-Host $trim -ForegroundColor Red
            } elseif ($trim -match "Success|Successfull|Done") {
                Write-Host $trim -ForegroundColor Green
            } elseif ($trim -match "loading|Take portal|Vendor") {
                Write-Host $trim -ForegroundColor Yellow
            } elseif ($trim -match "INFO") {
                Write-Host $trim -ForegroundColor Gray
            } else {
                Write-Host $trim
            }
        }
        $lastLength = $currentLength
    }
}
