# Unified App Manager - Windows PS1 (multi-file, no Python)
# Entry point for dd.ps1 / dd.cmd on Windows. Scans apps, shows menu, launches selected app.

$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptPath)))

# Load GlobalVars for $Global:PYTHON_EXE_PATH (pycore/ncore and python.exe)
if (-not $Global:PYTHON_EXE_PATH) {
    $GlobalVarsPath = Join-Path $RootDir "scripts\shells\win\win_common\GlobalVars.ps1"
    if (Test-Path -LiteralPath $GlobalVarsPath) { . $GlobalVarsPath }
}

. (Join-Path $ScriptPath "config\app_config.ps1")
. (Join-Path $ScriptPath "core\app_scanner.ps1")
. (Join-Path $ScriptPath "core\command_generator.ps1")
. (Join-Path $ScriptPath "utils\variable_keys.ps1")

$Script:Apps = @()
$Script:CurrentIndex = 0
$Script:MaxAppNameWidth = 8
$Colors = @{ Header = "Cyan"; Success = "Green"; Warning = "Yellow"; Error = "Red"; Info = "DarkGray"; Highlight = "White" }

function Write-AMHeader { param([string]$Message) Write-Host "=== $Message ===" -ForegroundColor $Colors.Header }
function Write-AMSuccess { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor $Colors.Success }
function Write-AMWarning { param([string]$Message) Write-Host "[!!] $Message" -ForegroundColor $Colors.Warning }
function Write-AMError   { param([string]$Message) Write-Host "[X] $Message" -ForegroundColor $Colors.Error }
function Write-AMInfo   { param([string]$Message) Write-Host $Message -ForegroundColor $Colors.Info }

function Start-ApplicationScan {
    Write-AMHeader "Starting Application Scan"
    $Script:Apps = Get-ScannedApplications -RootDir $RootDir
    Set-AppCommands -Apps $Script:Apps -RootDir $RootDir
    $Script:MaxAppNameWidth = 8
    foreach ($a in $Script:Apps) {
        if ($a.Name.Length -gt $Script:MaxAppNameWidth) { $Script:MaxAppNameWidth = $a.Name.Length }
    }
    Write-AMSuccess "Scan complete - found $($Script:Apps.Count) applications"
    return $true
}

function Show-Menu {
    Clear-Host
    Write-AMHeader "Unified App Manager (Windows PS1)"
    Write-AMInfo "Platform: Windows | Root: $RootDir"
    Write-Host ""

    if ($Script:Apps.Count -eq 0) {
        Write-AMWarning "No applications found."
        Write-AMInfo "Scanned: apps\, pyapps\, poly_apps\ under the root above."
        Write-AMInfo "Use R to rescan, Q to quit."
        Write-Host ""
        Write-Host "Enter command (R / Q): " -ForegroundColor $Colors.Header -NoNewline
        return
    }

    $NameWidth = [Math]::Max($Script:MaxAppNameWidth, 8)
    Write-AMWarning "Application List:"
    $HeaderFormat = "No. | {0,-$NameWidth} | {1,-11} | {2,-14} | Port  | Debug"
    Write-Host ($HeaderFormat -f "App Name", "Type", "Framework")
    Write-Host ("----|" + ("-" * ($NameWidth + 2)) + "|-------------|----------------|-------|------")

    for ($i = 0; $i -lt $Script:Apps.Count; $i++) {
        $a = $Script:Apps[$i]
        $ind = " "; $col = $Colors.Highlight
        if ($i -eq $Script:CurrentIndex) { $ind = ">"; $col = $Colors.Warning }
        $line = "{0}{1,2} | {2,-$NameWidth} | {3,-11} | {4,-14} | {5,-5} | {6}" -f $ind, ($i + 1), $a.Name, $a.Type, $a.Framework, $a.Port, $a.Debug
        Write-Host $line -ForegroundColor $col
    }
    Write-Host ""
    Write-AMWarning "Controls:"
    Write-Host "Enter app number to select | L: Launch | R: Rescan | Q: Quit"
    Write-Host ""
    Write-Host "Enter app number (1-$($Script:Apps.Count)) or command: " -ForegroundColor $Colors.Header -NoNewline
}

function Start-CurrentApp {
    if ($Script:Apps.Count -eq 0) { Write-AMError "No applications available"; return $false }
    $a = $Script:Apps[$Script:CurrentIndex]
    if ([string]::IsNullOrEmpty($a.Command)) { Write-AMError "No command for $($a.Name)"; return $false }
    Write-AMHeader "Launching $($a.Name)"
    Write-AMInfo "Command: $($a.Command)"
    Write-AMInfo "Port: $($a.Port) | Debug: $($a.Debug)"
    Write-Host ""

    $cmd = $a.Command
    if ($cmd -match '^cd\s+/d\s+"([^"]+)"\s+&&\s+(.+)$') {
        $workDir = $Matches[1]
        $exec = $Matches[2]
        Push-Location $workDir
        try {
            Invoke-Expression $exec
        } finally {
            Pop-Location
        }
    } else {
        cmd /c $cmd
    }
    return $true
}

function Start-MainLoop {
    if (-not (Start-ApplicationScan)) {
        Write-AMError "Initial application scan failed"
        exit 1
    }
    while ($true) {
        Show-Menu
        $inputLine = Read-Host
        $inputUpper = $inputLine.ToUpper()

        if ($inputLine -match '^\d+$') {
            $num = [int]$inputLine
            $idx = $num - 1
            if ($idx -ge 0 -and $idx -lt $Script:Apps.Count) {
                $Script:CurrentIndex = $idx
                Write-AMSuccess "Selected app #$num`: $($Script:Apps[$idx].Name)"
                Start-Sleep -Seconds 1
            } else {
                Write-AMError "Invalid app number: $num"
                Start-Sleep -Seconds 1
            }
        } elseif ($inputUpper -eq "L") {
            Start-CurrentApp
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor $Colors.Warning
            [Console]::ReadKey() | Out-Null
        } elseif ($inputUpper -eq "R") {
            Start-ApplicationScan
            Start-Sleep -Seconds 1
        } elseif ($inputUpper -eq "Q" -or $inputUpper -eq "QUIT" -or $inputUpper -eq "EXIT") {
            Write-AMWarning "Exiting"
            exit 0
        } elseif ([string]::IsNullOrWhiteSpace($inputLine)) {
            Start-CurrentApp
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor $Colors.Warning
            [Console]::ReadKey() | Out-Null
        } else {
            Write-AMError "Unknown command: $inputLine"
            Write-AMInfo "Valid: L (launch), R (rescan), Q (quit) or app number 1-$($Script:Apps.Count)"
            Start-Sleep -Seconds 2
        }
    }
}

try {
    Start-MainLoop
} catch {
    Write-AMError "Unhandled error: $($_.Exception.Message)"
    exit 1
}
