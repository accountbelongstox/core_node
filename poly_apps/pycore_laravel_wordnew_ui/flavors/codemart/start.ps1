# Single entry (Windows) for the CodeMart flavor: the counterpart of start.sh in this folder.
# It only CALLS existing scripts, idempotently, and prints an OK/WARN/FAIL summary per step:
#   1 backend  laravel_main on FrankenPHP (contract port ports.laravel_api_backend): not running ->
#              poly_apps/laravel_main/scripts/start.ps1 --service with CodeMart init (elevated);
#              running -> data init only (sys:init, sys:codemartinit, codemart:admin-password --file
#              <contract secret file>), then FrankenPHP worker restart through the Caddy admin API
#   2 ui       nexus-dash on ports.nexus_dash_frontend: reused when listening, else started through
#              pycore_laravel_wordnew_ui/scripts/start.ps1 (service when elevated, else a hidden window)
#   3 scan     scripts/start_build.ps1 -AdbScan (live_debug.py scan), pair/connect when requested
#   4 app      scripts/start_build.ps1 builds the CodeMart debug APK and installs it (skipped without a device)
#   5 web      resolves this machine's MagicDNS name, verifies and opens <dns>:<ui port>/codemart
# Arguments: --no-app | --no-scan | --target IP[:PORT] | --pair-code CODE | --non-interactive | -h
# Run from repo: powershell -File poly_apps\pycore_laravel_wordnew_ui\flavors\codemart\start.ps1

# --- Variables (declared at the beginning of the file) ---
$OriginalDirectory = (Get-Location).Path
$ScriptDir = $PSScriptRoot
$FlavorsDir = Split-Path -Parent $ScriptDir
$AppRoot = Split-Path -Parent $FlavorsDir
$PolyAppsDir = Split-Path -Parent $AppRoot
$RepoRoot = Split-Path -Parent $PolyAppsDir
$SelfScript = Join-Path $ScriptDir "start.ps1"
$WinCommonDir = Join-Path $RepoRoot "scripts\shells\win\win_common"
$ServiceContractScript = Join-Path $WinCommonDir "ServiceContract.ps1"
$FrankenPhpManagerScript = Join-Path $WinCommonDir "FrankenPhpManager.ps1"
$NssmServiceManagerScript = Join-Path $WinCommonDir "NssmServiceManager.ps1"
$LaravelScriptsDir = Join-Path (Join-Path $PolyAppsDir "laravel_main") "scripts"
$LaravelStart = Join-Path $LaravelScriptsDir "start.ps1"
$UiScriptsDir = Join-Path $AppRoot "scripts"
$UiStart = Join-Path $UiScriptsDir "start.ps1"
$StartBuild = Join-Path $UiScriptsDir "start_build.ps1"
$FlavorId = "codemart"
$UiRoute = "/codemart"
$PowerShellExe = $null
$NoApp = $false
$NoScan = $false
$NonInteractive = $false
$HelpRequested = $false
$Target = ""
$PairCode = ""
$Argument = $null
$ArgumentIndex = 0
$ArgumentList = @($args)
$StepNames = [ordered]@{
    backend = "Backend (laravel_main)"
    ui      = "UI (nexus-dash)"
    scan    = "Device scan"
    app     = "App (APK)"
    web     = "Web"
}
$StepResults = [ordered]@{}
$StepKey = $null
$ApiPort = 0
$UiPort = 0
$AdminPort = 0
$LoopbackHost = ""
$BackendRunning = $false
$BackendOk = $true
$LaravelDir = ""
$PhpPath = ""
$ArtisanPath = ""
$PasswordFile = ""
$PasswordFileLines = @()
$ServiceWaitSeconds = 300
$UiWaitSeconds = 180
$ChildProcess = $null
$ChildEnvironment = @{}
$IsElevated = $false
$UiHealthUrl = ""
$UiHealthy = $false
$UiArguments = @()
$DeviceOutput = ""
$DeviceOnline = $false
$ScanArguments = @()
$BuildExit = 0
$InstallExit = 0
$DnsName = ""
$TailscaleExe = ""
$TailnetDomain = ""
$WebUrl = ""
$ApiUrl = ""
$WebVerified = $false
$ArtisanCommands = @()
$ArtisanCommand = $null
$ArtisanOk = $true
$RestartStatus = 0
$LastChildExit = 0
$ChildOutput = ""
$ExitCode = 0

for ($ArgumentIndex = 0; $ArgumentIndex -lt $ArgumentList.Count; $ArgumentIndex++) {
    $Argument = [string]$ArgumentList[$ArgumentIndex]
    switch ($Argument) {
        "--no-app" { $NoApp = $true }
        "--no-scan" { $NoScan = $true }
        "--non-interactive" { $NonInteractive = $true }
        "--help" { $HelpRequested = $true }
        "-h" { $HelpRequested = $true }
        "--target" { if (($ArgumentIndex + 1) -lt $ArgumentList.Count) { $Target = [string]$ArgumentList[$ArgumentIndex + 1] } }
        "--pair-code" { if (($ArgumentIndex + 1) -lt $ArgumentList.Count) { $PairCode = [string]$ArgumentList[$ArgumentIndex + 1] } }
    }
}

function Show-Usage {
    Write-Host "Usage: powershell -File `"$SelfScript`" [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  --no-app            Skip the device scan and the APK build/install steps."
    Write-Host "  --no-scan           Skip the device scan/pair/connect step."
    Write-Host "  --target IP[:PORT]  Wireless-debugging endpoint of the phone (adb connect; pair target with --pair-code)."
    Write-Host "  --pair-code CODE    6-digit pairing code from 'Wireless debugging -> Pair device with pairing code'."
    Write-Host "  --non-interactive   Never prompt."
    Write-Host "  --help, -h          Show this help message and exit."
}

if ($HelpRequested) {
    Show-Usage
    exit 0
}

. $ServiceContractScript
. $FrankenPhpManagerScript
. $NssmServiceManagerScript

$ApiPort = Get-ServiceContractPort -Name "laravel_api_backend"
$UiPort = Get-ServiceContractPort -Name "nexus_dash_frontend"
$AdminPort = Get-ServiceContractPort -Name "frankenphp_admin"
$LoopbackHost = Get-ServiceContractHost -Name "loopback"
$UiHealthUrl = "http://${LoopbackHost}:${UiPort}${UiRoute}"
$PowerShellExe = (Get-Command powershell.exe -ErrorAction SilentlyContinue).Source
if (-not $PowerShellExe) { $PowerShellExe = (Get-Command pwsh.exe -ErrorAction SilentlyContinue).Source }
$IsElevated = Test-AdminPrivileges
foreach ($StepKey in $StepNames.Keys) { $StepResults[$StepKey] = @{ Status = "SKIP"; Detail = "not run" } }

function Write-Info { param([string]$Message) Write-Host "[codemart] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[codemart] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[codemart] $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message) Write-Host "[codemart] $Message" -ForegroundColor Red }

function Set-StepResult {
    param([string]$Key, [string]$Status, [string]$Detail)
    $script:StepResults[$Key] = @{ Status = $Status; Detail = $Detail }
    if ($Status -eq "OK") { Write-Success "$($script:StepNames[$Key]): $Detail" }
    elseif ($Status -eq "WARN") { Write-Warn "$($script:StepNames[$Key]): $Detail" }
    elseif ($Status -eq "FAIL") { Write-Err "$($script:StepNames[$Key]): $Detail" }
    else { Write-Info "$($script:StepNames[$Key]): $Detail" }
}

function Test-LoopbackPortListening {
    param([int]$Port)
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Test-HttpOk {
    param([string]$Url, [int]$TimeoutSeconds = 5)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSeconds
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
    } catch {
        return $false
    }
}

# Contract path of the CodeMart account password file (service_contract.json codemart_admin_password),
# resolved by Laravel itself (same resolution as laravel_main/scripts/start.ps1 --show-codemart-password).
function Get-CodemartAdminPasswordFile {
    $phpCode = '$autoload = $argv[1]; $bootstrap = $argv[2]; require $autoload; $app = require $bootstrap; $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); echo PHP_EOL, \App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1AdminPassword::defaultPath();'
    $autoloadPath = Join-Path (Join-Path $script:LaravelDir "vendor") "autoload.php"
    $bootstrapPath = Join-Path (Join-Path $script:LaravelDir "bootstrap") "app.php"
    $ErrorActionPreference = "Continue"
    $lines = @(& $script:PhpPath -r $phpCode -- $autoloadPath $bootstrapPath)
    if ($lines.Count -eq 0) { return "" }
    return ([string]$lines[$lines.Count - 1]).Trim()
}

# Data init against the running (or just provisioned) Laravel tree. Returns $true when every command succeeded.
function Invoke-CodemartDataInit {
    $script:LaravelDir = Get-FrankenPhpLaravelDirectory
    $script:PhpPath = Get-FrankenPhpPhpPath
    $script:ArtisanPath = Join-Path $script:LaravelDir "artisan"
    $env:PHP_INI_SCAN_DIR = Split-Path -Parent (Get-FrankenPhpPhpIniPath)
    $ErrorActionPreference = "Continue"
    $allOk = $true
    if (-not (Test-Path -LiteralPath $script:ArtisanPath -PathType Leaf)) {
        Write-Err "artisan not found: $($script:ArtisanPath)"
        return $false
    }
    $script:PasswordFile = Get-CodemartAdminPasswordFile
    $script:ArtisanCommands = @(
        @("sys:init", "--no-interaction"),
        @("sys:codemartinit", "--no-interaction")
    )
    if ($script:PasswordFile -and (Test-Path -LiteralPath $script:PasswordFile -PathType Leaf)) {
        $script:ArtisanCommands += , @("codemart:admin-password", "--file", $script:PasswordFile, "--no-interaction")
    } else {
        Write-Warn "CodeMart password file not present yet ($($script:PasswordFile)); sys:init creates it, codemart:admin-password skipped."
    }
    Push-Location -LiteralPath $script:LaravelDir
    try {
        foreach ($command in $script:ArtisanCommands) {
            Write-Info "php artisan $($command -join ' ')"
            & $script:PhpPath $script:ArtisanPath @command
            if ($LASTEXITCODE -ne 0) {
                Write-Err "artisan $($command[0]) failed (exit $LASTEXITCODE)."
                $allOk = $false
                break
            }
        }
    } finally {
        Pop-Location
    }
    return $allOk
}

# Graceful FrankenPHP worker restart through the Caddy admin API (Linux twin: fm_domain_workers_restart).
function Restart-FrankenPhpWorkers {
    $url = "http://${LoopbackHost}:${AdminPort}/frankenphp/workers/restart"
    try {
        $response = Invoke-WebRequest -Uri $url -Method Post -UseBasicParsing -TimeoutSec 30
        return [int]$response.StatusCode
    } catch {
        return 0
    }
}

# Runs a sibling script; the exit code lands in $LastChildExit. With -Capture the combined output
# lands in $ChildOutput, otherwise the child output goes straight to this console.
function Invoke-ChildScript {
    param([string]$ScriptPath, [string[]]$ScriptArguments, [switch]$Capture)
    $ErrorActionPreference = "Continue"
    $script:ChildOutput = ""
    if ($Capture) {
        $script:ChildOutput = (& $script:PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @ScriptArguments 2>&1 | Out-String)
    } else {
        & $script:PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @ScriptArguments | Out-Host
    }
    $script:LastChildExit = $LASTEXITCODE
}

# --- 1) Backend ---
Write-Info "Step 1/5: backend (laravel_main on port $ApiPort)"
try {
    $BackendRunning = Test-LoopbackPortListening -Port $ApiPort
    if (-not $BackendRunning) {
        if (-not (Test-Path -LiteralPath $LaravelStart -PathType Leaf)) {
            Set-StepResult -Key "backend" -Status "FAIL" -Detail "laravel_main start script not found: $LaravelStart"
            $BackendOk = $false
        } elseif (-not $IsElevated) {
            Set-StepResult -Key "backend" -Status "FAIL" -Detail "port $ApiPort is not listening and starting the FrankenPHP service needs an elevated (Administrator) PowerShell"
            $BackendOk = $false
        } else {
            Write-Info "Port $ApiPort is not listening: starting laravel_main with CodeMart init..."
            $ChildEnvironment = @{ AS_SERVICE = "yes"; INCLUDE_UI = "no"; CODEMART_INIT = "yes"; DD_AUTO_CONTINUE = "1" }
            $ChildProcess = Start-ChildScriptWithEnv -PwshExePath $PowerShellExe -ScriptPath $LaravelStart `
                -ScriptArgs @("--service") -WorkingDirectory $LaravelScriptsDir -EnvironmentVars $ChildEnvironment -Wait
            if ($ChildProcess.ExitCode -ne 0) {
                Set-StepResult -Key "backend" -Status "FAIL" -Detail "laravel_main start.ps1 --service exited with $($ChildProcess.ExitCode)"
                $BackendOk = $false
            } elseif (-not (Wait-TcpPortListening -Port $ApiPort -TimeoutSeconds $ServiceWaitSeconds)) {
                Set-StepResult -Key "backend" -Status "FAIL" -Detail "laravel_main started but port $ApiPort is not listening"
                $BackendOk = $false
            } else {
                $ArtisanOk = Invoke-CodemartDataInit
                if ($ArtisanOk) {
                    Set-StepResult -Key "backend" -Status "OK" -Detail "started with CodeMart init; listening on port $ApiPort"
                } else {
                    Set-StepResult -Key "backend" -Status "WARN" -Detail "started on port $ApiPort but CodeMart data init reported errors"
                }
            }
        }
    } else {
        Write-Info "Port $ApiPort is listening: running CodeMart data init and restarting FrankenPHP workers..."
        $ArtisanOk = Invoke-CodemartDataInit
        $RestartStatus = Restart-FrankenPhpWorkers
        if (-not $ArtisanOk) {
            Set-StepResult -Key "backend" -Status "FAIL" -Detail "data init failed (sys:init / sys:codemartinit / codemart:admin-password)"
            $BackendOk = $false
        } elseif ($RestartStatus -eq 200) {
            Set-StepResult -Key "backend" -Status "OK" -Detail "already running; data init done, workers restarted"
        } else {
            Set-StepResult -Key "backend" -Status "WARN" -Detail "already running; data init done, worker restart endpoint unavailable (code $RestartStatus)"
        }
    }
} catch {
    Set-StepResult -Key "backend" -Status "FAIL" -Detail $_.Exception.Message
    $BackendOk = $false
}

# --- 2) UI ---
Write-Info "Step 2/5: UI (nexus-dash on port $UiPort)"
try {
    $UiHealthy = (Test-LoopbackPortListening -Port $UiPort) -and (Test-HttpOk -Url $UiHealthUrl)
    if ($UiHealthy) {
        Set-StepResult -Key "ui" -Status "OK" -Detail "already serving $UiHealthUrl"
    } elseif (-not (Test-Path -LiteralPath $UiStart -PathType Leaf)) {
        Set-StepResult -Key "ui" -Status "FAIL" -Detail "UI start script not found: $UiStart"
    } else {
        # The pycore dashboard runs in the user session, never as a Windows service.
        Write-Info "Starting the nexus-dash dev server in a hidden window..."
        $ChildProcess = Start-ChildScriptWithEnv -PwshExePath $PowerShellExe -ScriptPath $UiStart `
            -ScriptArgs @("-NoBackend", "-NonInteractive") -WorkingDirectory $UiScriptsDir -Hidden
        if (Wait-TcpPortListening -Port $UiPort -TimeoutSeconds $UiWaitSeconds) {
            $UiHealthy = Test-HttpOk -Url $UiHealthUrl -TimeoutSeconds 15
        }
        if ($UiHealthy) {
            Set-StepResult -Key "ui" -Status "OK" -Detail "started; serving $UiHealthUrl"
        } else {
            Set-StepResult -Key "ui" -Status "FAIL" -Detail "UI is not serving $UiHealthUrl after start"
        }
    }
} catch {
    Set-StepResult -Key "ui" -Status "FAIL" -Detail $_.Exception.Message
}

# --- 3) Device scan ---
Write-Info "Step 3/5: device scan"
if ($NoApp -or $NoScan) {
    Set-StepResult -Key "scan" -Status "SKIP" -Detail "skipped by --no-app / --no-scan"
} elseif (-not (Test-Path -LiteralPath $StartBuild -PathType Leaf)) {
    Set-StepResult -Key "scan" -Status "WARN" -Detail "start_build.ps1 not found: $StartBuild"
} else {
    try {
        $ScanArguments = @("-NonInteractive", "-AdbScan")
        if ($PairCode) {
            $ScanArguments += @("-AdbPairCode", $PairCode)
            if ($Target) { $ScanArguments += @("-AdbPair", $Target) }
        } elseif ($Target) {
            $ScanArguments += @("-AdbConnect", $Target)
        }
        Invoke-ChildScript -ScriptPath $StartBuild -ScriptArguments $ScanArguments
        Invoke-ChildScript -ScriptPath $StartBuild -ScriptArguments @("-NonInteractive", "-AdbDevices") -Capture
        $DeviceOutput = $ChildOutput
        $DeviceOnline = [bool]($DeviceOutput -match '(?m)^\s*\S+\s+device\b')
        if ($DeviceOnline) {
            Set-StepResult -Key "scan" -Status "OK" -Detail "an Android device is online"
        } else {
            Set-StepResult -Key "scan" -Status "WARN" -Detail "no online Android device found (pass --target IP[:PORT] and --pair-code CODE, or plug in USB)"
        }
    } catch {
        Set-StepResult -Key "scan" -Status "WARN" -Detail $_.Exception.Message
    }
}

# --- 4) App ---
Write-Info "Step 4/5: CodeMart debug APK"
if ($NoApp) {
    Set-StepResult -Key "app" -Status "SKIP" -Detail "skipped by --no-app"
} elseif (-not (Test-Path -LiteralPath $StartBuild -PathType Leaf)) {
    Set-StepResult -Key "app" -Status "WARN" -Detail "start_build.ps1 not found: $StartBuild"
} else {
    try {
        if ($NoScan) {
            Invoke-ChildScript -ScriptPath $StartBuild -ScriptArguments @("-NonInteractive", "-AdbDevices") -Capture
            $DeviceOutput = $ChildOutput
            $DeviceOnline = [bool]($DeviceOutput -match '(?m)^\s*\S+\s+device\b')
        }
        if (-not $DeviceOnline) {
            Set-StepResult -Key "app" -Status "WARN" -Detail "no online Android device; APK build and install skipped"
        } else {
            Invoke-ChildScript -ScriptPath $StartBuild -ScriptArguments @("-App", $FlavorId, "-BuildType", "debug", "-NonInteractive", "-NoOpenOutput")
            $BuildExit = $LastChildExit
            if ($BuildExit -ne 0) {
                Set-StepResult -Key "app" -Status "FAIL" -Detail "APK build failed (exit $BuildExit)"
            } else {
                Invoke-ChildScript -ScriptPath $StartBuild -ScriptArguments @("-App", $FlavorId, "-NonInteractive", "-AdbInstall")
                $InstallExit = $LastChildExit
                if ($InstallExit -eq 0) {
                    Set-StepResult -Key "app" -Status "OK" -Detail "debug APK built and installed"
                } else {
                    Set-StepResult -Key "app" -Status "FAIL" -Detail "APK install failed (exit $InstallExit)"
                }
            }
        }
    } catch {
        Set-StepResult -Key "app" -Status "FAIL" -Detail $_.Exception.Message
    }
}

# --- 5) Web ---
Write-Info "Step 5/5: web (MagicDNS)"
try {
    $TailscaleExe = [string](Find-TailscaleExecutable)
    $TailnetDomain = [string](Get-FrankenPhpTailscaleDomainConstant)
    if ($TailscaleExe) {
        $DnsName = [string](Get-FrankenPhpTailscaleDnsName -TailscaleExe $TailscaleExe -TailnetDomain $TailnetDomain)
    }
    if ([string]::IsNullOrWhiteSpace($DnsName)) {
        $DnsName = $LoopbackHost
        $WebUrl = "http://${DnsName}:${UiPort}${UiRoute}"
        $ApiUrl = "http://${DnsName}:${ApiPort}"
        $WebVerified = Test-HttpOk -Url $WebUrl
        if ($WebVerified) {
            if (-not $NonInteractive) { Start-Process $WebUrl }
            Set-StepResult -Key "web" -Status "WARN" -Detail "no MagicDNS name (mesh not connected); opened $WebUrl ; API $ApiUrl"
        } else {
            Set-StepResult -Key "web" -Status "FAIL" -Detail "no MagicDNS name and $WebUrl is not reachable"
        }
    } else {
        $WebUrl = "http://${DnsName}:${UiPort}${UiRoute}"
        $ApiUrl = "http://${DnsName}:${ApiPort}"
        $WebVerified = Test-HttpOk -Url $WebUrl
        if ($WebVerified) {
            if (-not $NonInteractive) { Start-Process $WebUrl }
            Set-StepResult -Key "web" -Status "OK" -Detail "$WebUrl verified ; API $ApiUrl"
        } else {
            Set-StepResult -Key "web" -Status "WARN" -Detail "$WebUrl is not reachable from this machine yet ; API $ApiUrl"
        }
    }
} catch {
    Set-StepResult -Key "web" -Status "FAIL" -Detail $_.Exception.Message
}

# --- 6) Summary ---
Write-Host ""
Write-Host "CodeMart start summary" -ForegroundColor Cyan
foreach ($StepKey in $StepNames.Keys) {
    $result = $StepResults[$StepKey]
    $color = "Gray"
    if ($result.Status -eq "OK") { $color = "Green" }
    elseif ($result.Status -eq "WARN") { $color = "Yellow" }
    elseif ($result.Status -eq "FAIL") { $color = "Red"; $ExitCode = 1 }
    Write-Host ("  [{0,-4}] {1,-24} {2}" -f $result.Status, $StepNames[$StepKey], $result.Detail) -ForegroundColor $color
}
Set-Location -LiteralPath $OriginalDirectory
exit $ExitCode
