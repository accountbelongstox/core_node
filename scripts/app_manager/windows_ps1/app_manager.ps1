# Unified App Manager - Windows PS1 (multi-file, no Python)
# Entry point for dd.ps1 / dd.cmd on Windows. Scans apps, shows menu, launches selected app.
# App types: ncoreApp (.\apps), pycoreApp (.\pyapps), polyApp (.\poly_apps).
# UI: Up/Down to select, Enter to launch; last selection persisted to .app_manager_last_index.

$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptPath)))
$Script:StateFile = Join-Path $RootDir ".app_manager_last_index"

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
# Active per row: "start" or "install-service"
$Script:AppActives = @()
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
    $Script:AppActives = @()
    foreach ($a in $Script:Apps) {
        if ($a.Name.Length -gt $Script:MaxAppNameWidth) { $Script:MaxAppNameWidth = $a.Name.Length }
        $Script:AppActives += "start"
    }
    Load-LastIndex
    Write-AMSuccess "Scan complete - found $($Script:Apps.Count) applications"
    return $true
}

function Load-LastIndex {
    if (-not (Test-Path -LiteralPath $Script:StateFile)) { return }
    $idx = Get-Content -LiteralPath $Script:StateFile -Raw -ErrorAction SilentlyContinue
    if ($null -eq $idx) { return }
    $idx = $idx.Trim()
    if (-not ($idx -match '^\d+$')) { return }
    $Script:CurrentIndex = [int]$idx
    if ($Script:Apps.Count -gt 0 -and $Script:CurrentIndex -ge $Script:Apps.Count) {
        $Script:CurrentIndex = $Script:Apps.Count - 1
    }
    if ($Script:CurrentIndex -lt 0) { $Script:CurrentIndex = 0 }
}

function Save-LastIndex {
    if ($Script:Apps.Count -le 0) { return }
    try {
        Set-Content -LiteralPath $Script:StateFile -Value $Script:CurrentIndex -ErrorAction Stop
    } catch { }
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
        Write-Host "Press key (R / Q): " -ForegroundColor $Colors.Header -NoNewline
        return
    }

    $NameWidth = [Math]::Max($Script:MaxAppNameWidth, 8)
    Write-AMWarning "Application List:"
    $HeaderFormat = "No. | {0,-$NameWidth} | {1,-11} | {2,-14} | {3,-6} | Port  | Debug"
    Write-Host ($HeaderFormat -f "App Name", "Type", "Framework", "Active")
    Write-Host ("----|" + ("-" * ($NameWidth + 2)) + "|-------------|----------------|--------|-------|------")

    for ($i = 0; $i -lt $Script:Apps.Count; $i++) {
        $a = $Script:Apps[$i]
        $ind = " "; $col = $Colors.Highlight
        if ($i -eq $Script:CurrentIndex) { $ind = ">"; $col = $Colors.Warning }
        $active = if ($Script:AppActives.Count -gt $i) { $Script:AppActives[$i] } else { "start" }
        $line = "{0}{1,2} | {2,-$NameWidth} | {3,-11} | {4,-14} | {5,-6} | {6,-5} | {7}" -f $ind, ($i + 1), $a.Name, $a.Type, $a.Framework, $active, $a.Port, $a.Debug
        Write-Host $line -ForegroundColor $col
    }
    Write-Host ""
    Write-AMWarning "Controls:"
    Write-Host "Up/Down: select app | Left/Right: toggle Active (start / install-service) | Enter: Launch or Install | R: Rescan | Q: Quit"
    Write-Host ""
    Write-Host "Press key: " -ForegroundColor $Colors.Header -NoNewline
}

function Start-CurrentApp {
    if ($Script:Apps.Count -eq 0) { Write-AMError "No applications available"; return $false }
    $a = $Script:Apps[$Script:CurrentIndex]
    $name = $a.Name
    $type = $a.Type
    $port = $a.Port

    switch ($type) {
        ncoreApp {
            $mainJs = Join-Path $RootDir "main.js"
            if (-not (Test-Path -LiteralPath $mainJs)) {
                Write-AMError "ncoreApp requires root\main.js. Missing: $mainJs"
                return $false
            }
            Write-AMHeader "Launching $name"
            Write-AMInfo "Command: node .\main.js app=$name (cwd: $RootDir)"
            Push-Location -LiteralPath $RootDir
            try {
                node .\main.js app=$name
            } finally { Pop-Location }
            return $true
        }
        pycoreApp {
            $pyMain = Join-Path $RootDir "pyapps\$name\main.py"
            if (-not (Test-Path -LiteralPath $pyMain)) {
                Write-AMError "pycoreApp requires pyapps\$name\main.py. Missing: $pyMain"
                return $false
            }
            Write-AMHeader "Launching $name"
            Write-AMInfo "Command: python .\pyapps\$name\main.py (cwd: $RootDir)"
            Push-Location -LiteralPath $RootDir
            try {
                $py = if ($Global:PYTHON_EXE_PATH) { $Global:PYTHON_EXE_PATH } else { "python" }
                & $py ".\pyapps\$name\main.py"
            } finally { Pop-Location }
            return $true
        }
        polyApp {
            $startPs1 = Join-Path $RootDir "poly_apps\$name\scripts\start.ps1"
            $startSh = Join-Path $RootDir "poly_apps\$name\scripts\start.sh"
            $workDir = Join-Path $RootDir "poly_apps\$name"
            if (Test-Path -LiteralPath $startPs1) {
                Write-AMHeader "Launching $name"
                Write-AMInfo "Command: .\scripts\start.ps1 (Port: $port)"
                $env:PORT = $port
                Push-Location -LiteralPath $workDir
                try {
                    & ".\scripts\start.ps1"
                } finally { Pop-Location }
                return $true
            }
            if (Test-Path -LiteralPath $startSh) {
                Write-AMHeader "Launching $name"
                Write-AMInfo "Command: bash scripts/start.sh $port"
                Push-Location -LiteralPath $workDir
                try {
                    bash ./scripts/start.sh $port
                } finally { Pop-Location }
                return $true
            }
            Write-AMError "polyApp requires poly_apps\$name\scripts\start.ps1 or start.sh. Missing in $workDir"
            return $false
        }
        default {
            Write-AMError "Unknown app type: $type"
            return $false
        }
    }
}

function Install-CurrentAsService {
    if ($Script:Apps.Count -eq 0) { Write-AMError "No applications available"; return $false }
    $a = $Script:Apps[$Script:CurrentIndex]
    $name = $a.Name
    $type = $a.Type
    $port = $a.Port
    $svcName = "app-manager-$name"
    $nssm = $null
    foreach ($p in @("nssm", "nssm.exe")) {
        $exe = Get-Command $p -ErrorAction SilentlyContinue
        if ($exe) { $nssm = $exe.Source; break }
    }
    $nssmPath = Join-Path $env:ProgramFiles "nssm\nssm.exe"
    if (-not $nssm -and (Test-Path -LiteralPath $nssmPath)) { $nssm = $nssmPath }

    if (-not $nssm) {
        Write-AMWarning "NSSM not found. Install NSSM to register as Windows service, or run the app manually."
        Write-AMInfo "To install service manually (Admin): nssm install $svcName <node|python|script> <args...>"
        return $false
    }

    $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    $pythonExe = if ($Global:PYTHON_EXE_PATH) { $Global:PYTHON_EXE_PATH } else { (Get-Command python -ErrorAction SilentlyContinue).Source }

    switch ($type) {
        ncoreApp {
            $mainJs = Join-Path $RootDir "main.js"
            if (-not (Test-Path -LiteralPath $mainJs)) {
                Write-AMError "ncoreApp requires root\main.js. Missing: $mainJs"
                return $false
            }
            if (-not $nodeExe) { Write-AMError "node not in PATH"; return $false }
            & $nssm install $svcName $nodeExe "main.js" "app=$name"
            & $nssm set $svcName AppDirectory $RootDir
        }
        pycoreApp {
            $pyMain = Join-Path $RootDir "pyapps\$name\main.py"
            if (-not (Test-Path -LiteralPath $pyMain)) {
                Write-AMError "pycoreApp requires pyapps\$name\main.py. Missing: $pyMain"
                return $false
            }
            if (-not $pythonExe) { Write-AMError "python not in PATH"; return $false }
            & $nssm install $svcName $pythonExe ".\pyapps\$name\main.py"
            & $nssm set $svcName AppDirectory $RootDir
        }
        polyApp {
            $startPs1 = Join-Path $RootDir "poly_apps\$name\scripts\start.ps1"
            $workDir = Join-Path $RootDir "poly_apps\$name"
            if (-not (Test-Path -LiteralPath $startPs1)) {
                Write-AMError "polyApp requires poly_apps\$name\scripts\start.ps1. Missing: $startPs1"
                return $false
            }
            $pwsh = (Get-Command powershell -ErrorAction SilentlyContinue).Source
            & $nssm install $svcName $pwsh "-NoProfile -ExecutionPolicy Bypass -File `"$startPs1`""
            & $nssm set $svcName AppDirectory $workDir
            & $nssm set $svcName AppEnvironmentExtra "PORT=$port"
        }
        default {
            Write-AMError "Unknown app type: $type"
            return $false
        }
    }
    Write-AMSuccess "Service $svcName installed. Start with: nssm start $svcName"
    return $true
}

function Start-MainLoop {
    if (-not (Start-ApplicationScan)) {
        Write-AMError "Initial application scan failed"
        exit 1
    }
    while ($true) {
        Show-Menu
        $keyInfo = [Console]::ReadKey($true)
        $key = $keyInfo.Key

        switch ($key) {
            UpArrow {
                if ($Script:Apps.Count -gt 0 -and $Script:CurrentIndex -gt 0) {
                    $Script:CurrentIndex--
                    Save-LastIndex
                }
            }
            DownArrow {
                if ($Script:Apps.Count -gt 0 -and $Script:CurrentIndex -lt ($Script:Apps.Count - 1)) {
                    $Script:CurrentIndex++
                    Save-LastIndex
                }
            }
            LeftArrow {
                if ($Script:Apps.Count -gt 0 -and $Script:AppActives.Count -gt $Script:CurrentIndex -and $Script:AppActives[$Script:CurrentIndex] -eq "install-service") {
                    $Script:AppActives[$Script:CurrentIndex] = "start"
                }
            }
            RightArrow {
                if ($Script:Apps.Count -gt 0 -and $Script:AppActives.Count -gt $Script:CurrentIndex -and $Script:AppActives[$Script:CurrentIndex] -eq "start") {
                    $Script:AppActives[$Script:CurrentIndex] = "install-service"
                }
            }
            Enter {
                if ($Script:Apps.Count -gt 0) {
                    Save-LastIndex
                    if ($Script:AppActives[$Script:CurrentIndex] -eq "install-service") {
                        Install-CurrentAsService
                    } else {
                        Start-CurrentApp
                    }
                    Write-Host ""
                    Write-Host "Press any key to return to menu..." -ForegroundColor $Colors.Warning
                    [Console]::ReadKey() | Out-Null
                }
            }
            R {
                Start-ApplicationScan
                Start-Sleep -Seconds 1
            }
            Q {
                Save-LastIndex
                Write-AMWarning "Exiting"
                exit 0
            }
            default {
                Write-AMInfo "Up/Down: select | Left/Right: Active | Enter: Launch/Install | R: Rescan | Q: Quit"
                Start-Sleep -Seconds 1
            }
        }
    }
}

try {
    Start-MainLoop
} catch {
    Write-AMError "Unhandled error: $($_.Exception.Message)"
    exit 1
}
