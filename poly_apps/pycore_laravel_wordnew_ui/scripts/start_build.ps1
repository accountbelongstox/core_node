# Capacitor native build entry (Windows) for pycore_laravel_wordnew_ui.
# This script IMPLEMENTS NO INSTALLATION: every prerequisite repair is delegated
# to the idempotent DevInstaller steps referenced by FULL PATH (dd.cmd menu):
#   Step4_InstallNodeJS.ps1              - node + bun
#   Step8_InstallPython.ps1              - python
#   Step21_InstallApplications.ps1       - JDK 21 (-ExactPackageName Java -> Oracle.JDK.21,
#                                          wires JAVA_HOME/JDK_HOME/PATH via ApplicationsList)
#   Step62_InstallAndroidSdkPackages.ps1 - cmdline-tools + licenses + platform-tools +
#                                          platforms;android-36 + build-tools;36.0.0
# (each step is per-detail idempotent: every component is gated by binary existence)
# Flow control here uses NO exit codes and NO install functions: progress is judged
# purely by BINARY EXISTENCE. Toolchain constants and JDK/SDK detectors are
# CENTRALIZED in scripts/shells/win/win_common/AndroidBuildEnv.ps1 (shared with the
# dd step). Mutator functions are void. The script has ONE exit point. Then it
# delegates the flavor selection + web build + `cap sync` + Gradle APK assembly to
# scripts/flavor/build_apk.py (single build truth).
# dd constants come from win_common/GlobalVars.ps1 (single source of truth).
# HTTPS_PROXY/HTTP_PROXY is passed to sdkmanager/gradle via JAVA_TOOL_OPTIONS.
#
# Run from repo:
#   .\poly_apps\pycore_laravel_wordnew_ui\scripts\start_build.ps1
#   .\poly_apps\pycore_laravel_wordnew_ui\scripts\start_build.ps1 -App wordnew -BuildType release
#   .\poly_apps\pycore_laravel_wordnew_ui\scripts\start_build.ps1 -List
#   Device menu:  -AdbMenu | Pair: -AdbPair <IP:PORT> [-AdbPairCode <CODE>] | Connect: -AdbConnect <IP[:PORT]>
#   LAN scan:     -AdbScan | Disconnect: -AdbDisconnect <target|all> | TCP/IP: -AdbTcpip <port>
#   Install:      -AdbInstall [-AdbInstallPath <apk>] (builds first when no APK exists)
#   Live reload:  -LiveReload [-App wordnew] (connect + build + install + HMR + app logs)
# adb is resolved by BINARY EXISTENCE (SDK platform-tools -> PATH) and provisioned
# idempotently through the dd JDK + Step62 steps; this script installs nothing itself.

param(
    [Parameter(Mandatory = $false)]
    [string]$App,
    [Parameter(Mandatory = $false)]
    [switch]$List,
    [Parameter(Mandatory = $false)]
    [ValidateSet('ask', 'debug', 'release')]
    [string]$BuildType = 'ask',
    [Parameter(Mandatory = $false)]
    [ValidateSet('android', 'ios')]
    [string]$Platform = 'android',
    [Parameter(Mandatory = $false)]
    [switch]$SkipAssets,
    [Parameter(Mandatory = $false)]
    [switch]$Clean,
    [Parameter(Mandatory = $false)]
    [switch]$NoOpenOutput,
    [Parameter(Mandatory = $false)]
    [switch]$NonInteractive,
    [Parameter(Mandatory = $false)]
    [switch]$ForceInstall,
    [Parameter(Mandatory = $false)]
    [switch]$AdbMenu,
    [Parameter(Mandatory = $false)]
    [switch]$AdbDevices,
    [Parameter(Mandatory = $false)]
    [string]$AdbPair,
    [Parameter(Mandatory = $false)]
    [string]$AdbPairCode,
    [Parameter(Mandatory = $false)]
    [string]$AdbConnect,
    [Parameter(Mandatory = $false)]
    [string]$AdbDisconnect,
    [Parameter(Mandatory = $false)]
    [int]$AdbTcpip,
    [Parameter(Mandatory = $false)]
    [switch]$AdbInstall,
    [Parameter(Mandatory = $false)]
    [string]$AdbInstallPath,
    [Parameter(Mandatory = $false)]
    [switch]$AdbScan,
    [Parameter(Mandatory = $false)]
    [switch]$LiveReload
)

$ErrorActionPreference = 'Stop'
$OriginalDir = (Get-Location).Path
$ScriptDir = $PSScriptRoot
$AppRoot = Split-Path -Parent $ScriptDir
$PolyAppsDir = Split-Path -Parent $AppRoot
$RepoRoot = Split-Path -Parent $PolyAppsDir
$BuildApkScript = Join-Path $ScriptDir "flavor\build_apk.py"
$NodeModulesPath = Join-Path $AppRoot "node_modules"
$ViteBinPath = Join-Path $AppRoot "node_modules\vite\bin\vite.js"
$PackageJsonPath = Join-Path $AppRoot "package.json"
# dd component full paths (constants from the dd directory layout)
$WinShellsDir = Join-Path (Join-Path $RepoRoot 'scripts') 'shells\win'
$WinCommonDir = Join-Path $WinShellsDir 'win_common'
$InstallStepsDir = Join-Path $WinShellsDir 'install_powershells'
$GlobalVarsScript = Join-Path $WinCommonDir 'GlobalVars.ps1'
$NssmServiceManagerScript = Join-Path $WinCommonDir 'NssmServiceManager.ps1'
$AndroidBuildEnvScript = Join-Path $WinCommonDir 'AndroidBuildEnv.ps1'
$LiveDebugScript = Join-Path $ScriptDir 'flavor\live_debug.py'
$StepNodeJs = Join-Path $InstallStepsDir 'Step4_InstallNodeJS.ps1'
$StepPython = Join-Path $InstallStepsDir 'Step8_InstallPython.ps1'
$StepApplications = Join-Path $InstallStepsDir 'Step21_InstallApplications.ps1'
$StepAndroidSdk = Join-Path $InstallStepsDir 'Step62_InstallAndroidSdkPackages.ps1'
# Project-locals (env toolchain state lives in the central library's $Global: vars)
$PythonCommand = $null
$BuildArguments = @()
$HaveModules = $false
$AllReady = $true
$BuildOk = $false
# ADB device debugging state
$AdbDefaultPort = 5555
$AdbScanTimeoutMs = 1200
$AdbAuthorizeTries = 30
$AdbAuthorizePollSeconds = 2
$AdbKnownStates = @('device', 'unauthorized', 'offline')
$AdbMdnsServicePattern = '_adb(-tls-connect)?\._tcp'
$AdbIpTargetPattern = '^\d+\.\d+\.\d+\.\d+(:\d+)?$'
$AdbBin = $null
$AdbScanFound = $false
$AdbApkMissing = $false
$AdbActionsOk = $true
$BuildForInstall = $false
$LiveReloadActive = [bool]$LiveReload
$BuildTypeEffective = $BuildType
$DeviceMode = $false
$UserQuit = $false
$AdbTcpipPort = 0
$AdbDisconnectTarget = $null
$AdbInstallRequested = ([bool]$AdbInstall) -or (-not [string]::IsNullOrWhiteSpace($AdbInstallPath))

. $GlobalVarsScript
. $NssmServiceManagerScript
. $AndroidBuildEnvScript

function Write-Info { param([string]$Message) Write-Host "[nexus-build] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[nexus-build] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[nexus-build] $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message) Write-Host "[nexus-build] $Message" -ForegroundColor Red }

# ---------- Project-scoped binary-existence gates ----------

function Test-PythonReady { return [bool]((Get-Command python -ErrorAction SilentlyContinue) -or (Get-Command python3 -ErrorAction SilentlyContinue)) }

function Test-BunReady { return [bool](Get-Command bun -ErrorAction SilentlyContinue) }

function Test-ViteReady { return (Test-Path -LiteralPath $ViteBinPath) }

# ---------- Delegation: void invocations of the dd idempotent steps ----------

function Invoke-DevStep {
    param([string]$StepPath, [string[]]$StepArguments = @())
    if (-not (Test-Path -LiteralPath $StepPath)) {
        Write-Err "DevInstaller step not found: $StepPath"
        return
    }
    Write-Info "Invoking dd idempotent step: $(Split-Path -Leaf $StepPath)"
    if ($StepArguments.Count -gt 0) {
        powershell -NoProfile -ExecutionPolicy Bypass -File $StepPath @StepArguments
    } else {
        powershell -NoProfile -ExecutionPolicy Bypass -File $StepPath
    }
    Update-SessionPathFromRegistry
}

# ---------- Project dependencies (project deps, not an environment install) ----------

function Install-Deps {
    Push-Location -LiteralPath $AppRoot
    try {
        $HaveModules = $false
        if (Test-Path -LiteralPath $NodeModulesPath) {
            $HaveModules = [bool](Get-ChildItem -Path $NodeModulesPath -Directory -ErrorAction SilentlyContinue | Select-Object -First 1)
        }
        # One-time cutover from a pnpm-created node_modules (symlinked .pnpm layout):
        # rebuild the tree once so no stale pnpm symlinks survive.
        if (Test-Path -LiteralPath (Join-Path $NodeModulesPath ".pnpm")) {
            Write-Info "pnpm node_modules layout detected -> rebuilding it with bun..."
            Remove-Item -LiteralPath $NodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue
            $HaveModules = $false
        }
        if ($ForceInstall -or (-not $HaveModules) -or (-not (Test-ViteReady))) {
            Write-Info "Installing dependencies (node_modules/vite missing or -ForceInstall)..."
            bun install --force
        } else {
            Write-Info "node_modules present -> updating dependencies (bun install)..."
            bun install
        }
        if (-not (Test-ViteReady)) {
            Write-Info "vite still missing -> reinstalling dependencies from scratch..."
            bun install --force
        }
    } finally {
        Pop-Location
    }
}

# ---------- ADB device debugging (official Android wireless debugging) ----------
# Android 11+: `adb pair IP:PAIR_PORT` once, then `adb connect IP:PORT`; legacy
# devices: USB -> `adb tcpip 5555` -> `adb connect IP:5555`.

function Invoke-Adb {
    param([string[]]$AdbArguments)
    $ErrorActionPreference = 'Continue'
    $adbLines = & $AdbBin @AdbArguments 2>&1 | ForEach-Object { "$_".TrimEnd() }
    if ($null -eq $adbLines) { return @() }
    return @($adbLines)
}

function Write-AdbLines {
    param([string[]]$Lines)
    foreach ($line in $Lines) { if ($line) { Write-Host "  $line" } }
}

function Test-AdbReady { return [bool]($AdbBin -and (Test-Path -LiteralPath $AdbBin)) }

function Resolve-AdbBin {
    $script:AdbBin = $null
    Resolve-AndroidBuildSdkRoot
    $sdkAdb = Join-Path $Global:ANDROID_BUILD_SDK_ROOT 'platform-tools\adb.exe'
    if (Test-Path -LiteralPath $sdkAdb) {
        $script:AdbBin = $sdkAdb
        return
    }
    $pathAdb = Get-Command adb -ErrorAction SilentlyContinue
    if ($pathAdb) { $script:AdbBin = $pathAdb.Source }
}

function Confirm-AdbBin {
    Resolve-AdbBin
    if (Test-AdbReady) { return }
    Resolve-AndroidBuildJavaHome
    if (-not (Test-AndroidBuildJavaReady)) {
        Invoke-DevStep -StepPath $StepApplications -StepArguments @('-ExactPackageName', 'Java')
        Resolve-AndroidBuildJavaHome
    }
    if (Test-AndroidBuildJavaReady) {
        $env:JAVA_HOME = $Global:ANDROID_BUILD_JAVA_HOME
        $env:Path = "$(Join-Path $Global:ANDROID_BUILD_JAVA_HOME 'bin');$env:Path"
    }
    Write-Info "adb not found. Invoking dd idempotent step (cmdline-tools + platform-tools/adb)."
    Invoke-DevStep -StepPath $StepAndroidSdk
    Resolve-AdbBin
}

function Format-AdbTarget {
    param([string]$Target)
    $cleanTarget = $Target.Trim()
    if ($cleanTarget.Contains(':')) { return $cleanTarget }
    return "${cleanTarget}:$AdbDefaultPort"
}

function Get-AdbDevices {
    foreach ($line in (Invoke-Adb -AdbArguments @('devices'))) {
        $fields = @($line.Trim() -split '\s+')
        if ($fields.Count -ge 2 -and $AdbKnownStates -contains $fields[1]) {
            [pscustomobject]@{ Serial = $fields[0]; State = $fields[1] }
        }
    }
}

function Get-AdbDeviceState {
    param([string]$Target)
    $match = Get-AdbDevices | Where-Object { $_.Serial -eq $Target } | Select-Object -First 1
    if ($match) { return $match.State }
    return ''
}

function Get-AdbOnlineCount { return @(Get-AdbDevices | Where-Object { $_.State -eq 'device' }).Count }

function Show-AdbDevices { Write-AdbLines -Lines (Invoke-Adb -AdbArguments @('devices', '-l')) }

function Invoke-AdbPair {
    param([string]$Target, [string]$Code)
    if ([string]::IsNullOrWhiteSpace($Target) -or (-not $Target.Contains(':'))) {
        Write-Err "Pair target must be IP:PAIR_PORT from 'Wireless debugging -> Pair using pairing code'."
        return $false
    }
    Write-Info "Pairing with $Target (Android 11+ wireless debugging)..."
    $pairArguments = @('pair', $Target)
    if ($Code) { $pairArguments += $Code }
    Write-AdbLines -Lines (Invoke-Adb -AdbArguments $pairArguments)
    return $true
}

function Connect-AdbDevice {
    param([string]$Target)
    Write-Info "Connecting to $Target..."
    Write-AdbLines -Lines (Invoke-Adb -AdbArguments @('connect', $Target))
}

# Connect, then poll until the phone reports 'device' (re-issuing connect re-triggers
# the "Allow USB debugging" dialog). Already-authorized devices pass straight through.
function Connect-AdbAuthorized {
    param([string]$Target)
    if ([string]::IsNullOrWhiteSpace($Target)) {
        Write-Err "Connect target required: IP[:PORT] (default port $AdbDefaultPort)."
        return $false
    }
    $endpoint = Format-AdbTarget -Target $Target
    Connect-AdbDevice -Target $endpoint
    $state = Get-AdbDeviceState -Target $endpoint
    if ($state -eq 'device') {
        Write-Info "$endpoint is authorized and online."
        return $true
    }
    if (-not $state) {
        Write-Warn "$endpoint did not connect. Android 11+ devices need pairing first (menu option 2 / -AdbPair)."
        return $false
    }
    Write-Info "$endpoint state: $state. Confirm 'Allow USB debugging' ON THE PHONE (tick 'always allow')..."
    for ($attempt = 1; $attempt -le $AdbAuthorizeTries; $attempt++) {
        Start-Sleep -Seconds $AdbAuthorizePollSeconds
        if ((Get-AdbDeviceState -Target $endpoint) -eq 'device') {
            Write-Info "$endpoint authorized -> online."
            return $true
        }
        $null = Invoke-Adb -AdbArguments @('connect', $endpoint)
    }
    Write-Err "$endpoint was not authorized within $($AdbAuthorizeTries * $AdbAuthorizePollSeconds)s; re-run to retry (idempotent)."
    return $false
}

function Get-AdbMdnsEndpoints {
    foreach ($line in (Invoke-Adb -AdbArguments @('mdns', 'services'))) {
        $fields = @($line.Trim() -split '\s+')
        if ($fields.Count -ge 3 -and $fields[1] -match $AdbMdnsServicePattern) { $fields[2] }
    }
}

function Show-AdbMdns {
    Write-Info "mDNS services (devices broadcasting wireless debugging on this network)..."
    Write-AdbLines -Lines (Invoke-Adb -AdbArguments @('mdns', 'services'))
}

function Enable-AdbTcpip {
    param([int]$Port)
    Write-Info "Switching the USB-connected device to TCP/IP mode on port $Port..."
    Write-AdbLines -Lines (Invoke-Adb -AdbArguments @('tcpip', "$Port"))
}

function Disconnect-AdbDevice {
    param([string]$Target)
    if ([string]::IsNullOrWhiteSpace($Target) -or $Target -eq 'all') {
        Write-Info "Disconnecting all devices..."
        Write-AdbLines -Lines (Invoke-Adb -AdbArguments @('disconnect'))
        return
    }
    $endpoint = Format-AdbTarget -Target $Target
    Write-Info "Disconnecting $endpoint..."
    Write-AdbLines -Lines (Invoke-Adb -AdbArguments @('disconnect', $endpoint))
}

function Restart-AdbServer {
    Write-Info "Restarting adb server..."
    $null = Invoke-Adb -AdbArguments @('kill-server')
    $null = Invoke-Adb -AdbArguments @('start-server')
}

# ---------- LAN discovery ----------

function Get-LocalSubnetPrefixes {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        ForEach-Object { (($_.IPAddress -split '\.')[0..2]) -join '.' } |
        Sort-Object -Unique
}

# Parallel TCP probe of one /24 with TcpClient.ConnectAsync and a shared timeout.
function Find-OpenAdbHosts {
    param([string]$SubnetPrefix)
    $probes = New-Object System.Collections.Generic.List[object]
    foreach ($hostNumber in 1..254) {
        $address = "$SubnetPrefix.$hostNumber"
        $client = New-Object System.Net.Sockets.TcpClient
        $probes.Add([pscustomobject]@{ Address = $address; Client = $client; Task = $client.ConnectAsync($address, $AdbDefaultPort) })
    }
    try {
        [void][System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]@($probes | ForEach-Object { $_.Task }), $AdbScanTimeoutMs)
    } catch {
        Write-Verbose "Some probes were refused (expected): $($_.Exception.Message)"
    }
    foreach ($probe in $probes) {
        if ($probe.Task.Status -eq [System.Threading.Tasks.TaskStatus]::RanToCompletion -and $probe.Client.Connected) { $probe.Address }
        $probe.Client.Dispose()
    }
}

function Invoke-AdbLanScan {
    $script:AdbScanFound = $false
    Show-AdbMdns
    $hits = New-Object System.Collections.Generic.List[string]
    foreach ($subnetPrefix in @(Get-LocalSubnetPrefixes)) {
        Write-Info "Scanning $subnetPrefix.0/24 for open adb port $AdbDefaultPort..."
        foreach ($address in @(Find-OpenAdbHosts -SubnetPrefix $subnetPrefix)) { $hits.Add($address) }
    }
    foreach ($address in $hits) {
        $script:AdbScanFound = $true
        Write-Info "Found adb host: $address"
        $null = Connect-AdbAuthorized -Target $address
    }
    if (-not $AdbScanFound) {
        Write-Info "No hosts with port $AdbDefaultPort open found. Android 11+: enable Wireless debugging and pair first (option 2)."
    }
}

# Idempotent one-step online connect: adb prerequisites -> server -> mDNS endpoints
# -> LAN scan only when nothing is online yet -> device list.
function Connect-AdbOnline {
    Confirm-AdbBin
    if (-not (Test-AdbReady)) {
        Write-Err "adb is unavailable."
        return $false
    }
    $null = Invoke-Adb -AdbArguments @('start-server')
    foreach ($endpoint in @(Get-AdbMdnsEndpoints | Sort-Object -Unique)) {
        if ((Get-AdbDeviceState -Target $endpoint) -eq 'device') { continue }
        $null = Connect-AdbAuthorized -Target $endpoint
    }
    if ((Get-AdbOnlineCount) -eq 0) { Invoke-AdbLanScan }
    Show-AdbDevices
    return ((Get-AdbOnlineCount) -gt 0)
}

# ---------- Install / live-reload attach ----------

# Ctrl+C reaches the child python (KeyboardInterrupt -> clean exit) through the shared
# console; this compiled handler only keeps the PowerShell host alive so the script
# still reaches its single exit point.
function Enable-CtrlCGuard {
    if (-not ('CtrlCGuard' -as [type])) {
        Add-Type -TypeDefinition @'
public static class CtrlCGuard {
    private static void Ignore(object sender, System.ConsoleCancelEventArgs e) { e.Cancel = true; }
    public static void Enable() { System.Console.CancelKeyPress += Ignore; }
    public static void Disable() { System.Console.CancelKeyPress -= Ignore; }
}
'@
    }
    [CtrlCGuard]::Enable()
}

function Confirm-PythonCommand {
    if ($PythonCommand) { return }
    if (-not (Test-PythonReady)) { Invoke-DevStep -StepPath $StepPython }
    $script:PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $script:PythonCommand) { $script:PythonCommand = Get-Command python3 -ErrorAction SilentlyContinue }
}

function ConvertTo-QuotedArgument {
    param([string]$Value)
    return '"' + $Value + '"'
}

# Device-side work (install, attach, live logs, DevTools) is the shared live_debug.py.
# Returns the printed stdout lines for value actions; the script's console for the rest.
function Invoke-LiveDebug {
    param([string[]]$LiveDebugArguments, [switch]$Foreground)
    Confirm-PythonCommand
    $liveArguments = @($LiveDebugScript) + $LiveDebugArguments + @('--root', $AppRoot, '--adb', $AdbBin)
    if (-not $Foreground) {
        $ErrorActionPreference = 'Continue'
        return (& $PythonCommand.Source @liveArguments)
    }
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $PythonCommand.Source
    $startInfo.Arguments = (($liveArguments | ForEach-Object { ConvertTo-QuotedArgument -Value $_ }) -join ' ')
    $startInfo.UseShellExecute = $false
    Enable-CtrlCGuard
    try {
        $liveProcess = [System.Diagnostics.Process]::Start($startInfo)
        $liveProcess.WaitForExit()
        $liveProcess.Dispose()
    } finally {
        [CtrlCGuard]::Disable()
        Set-Location -LiteralPath $OriginalDir
    }
}

function Install-AdbApk {
    param([string]$ApkPath)
    $script:AdbApkMissing = $false
    if (-not $ApkPath) { $ApkPath = (@(Invoke-LiveDebug -LiveDebugArguments @('latest-apk')) -join '').Trim() }
    if ((-not $ApkPath) -or (-not (Test-Path -LiteralPath $ApkPath))) {
        $script:AdbApkMissing = $true
        Write-Err "APK not found. Build first or pass -AdbInstallPath."
        return $false
    }
    $installOutput = @(Invoke-LiveDebug -LiveDebugArguments @('install', '--apk', $ApkPath))
    Write-AdbLines -Lines ($installOutput | ForEach-Object { "$_" })
    return ($LASTEXITCODE -eq 0)
}

function Test-InteractiveConsole {
    return ([Environment]::UserInteractive -and (-not [Console]::IsInputRedirected) -and (-not [Console]::IsOutputRedirected))
}

# Y/n prompt defaulting to yes; non-interactive runs take the default.
function Read-DefaultYes {
    param([string]$Prompt)
    if ($NonInteractive -or (-not (Test-InteractiveConsole))) { return $true }
    $reply = (Read-Host "$Prompt [Y/n]").Trim()
    return (-not ($reply -match '^[nN]'))
}

function Invoke-AdbLiveAttach {
    $attachArguments = @('attach')
    if (-not (Test-InteractiveConsole)) { $attachArguments += '--no-follow' }
    Invoke-LiveDebug -LiveDebugArguments $attachArguments -Foreground
}

# ---------- Menus and actions ----------

function Start-DeviceMenu {
    $menuDone = $false
    while (-not $menuDone) {
        Write-Host ''
        Write-Info "=== ADB wireless device debugging (adb: $AdbBin) ==="
        Write-Host '  1) One-click device debugging (idempotent: prerequisites + connect + build + install + live reload)'
        Write-Host '  2) Pair device - Android 11+ (adb pair IP:PAIR_PORT CODE)'
        Write-Host "  3) Connect device (adb connect IP[:PORT], default $AdbDefaultPort)"
        Write-Host '  4) Discover devices via mDNS (adb mdns services)'
        Write-Host "  5) Enable TCP/IP mode on USB device (adb tcpip $AdbDefaultPort)"
        Write-Host '  6) Disconnect a device (or all)'
        Write-Host '  7) Restart adb server'
        Write-Host '  8) Install latest built APK to the connected device (offers a build when none exists)'
        Write-Host '  9) Auto-discover LAN devices (mDNS + subnet scan), connect + authorize'
        Write-Host '  0) Exit'
        Write-Host '  Tip: type an IP[:PORT] directly to connect + authorize.'
        $choice = (Read-Host 'Select an action [1]').Trim()
        if (-not $choice) { $choice = '1' }
        switch -Regex ($choice) {
            '^1$' {
                if (Connect-AdbOnline) {
                    $script:LiveReloadActive = $true
                    $script:BuildForInstall = $true
                    $script:BuildTypeEffective = 'debug'
                    $menuDone = $true
                } else {
                    Write-Warn "No online device yet. Android 11+: pair first (option 2)."
                }
            }
            '^2$' {
                $pairTarget = Read-Host 'Pair target IP:PAIR_PORT'
                $pairCode = Read-Host 'Pairing code'
                $null = Invoke-AdbPair -Target $pairTarget -Code $pairCode
            }
            '^3$' { $null = Connect-AdbAuthorized -Target (Read-Host 'Device IP[:PORT]') }
            '^4$' { Show-AdbMdns }
            '^5$' {
                $portInput = Read-Host "Port [$AdbDefaultPort]"
                $tcpipPort = $AdbDefaultPort
                if ($portInput -as [int]) { $tcpipPort = [int]$portInput }
                Enable-AdbTcpip -Port $tcpipPort
            }
            '^6$' { Disconnect-AdbDevice -Target (Read-Host 'Device IP[:PORT] (empty = all)') }
            '^7$' { Restart-AdbServer }
            '^8$' {
                $installed = Install-AdbApk -ApkPath ''
                if ((-not $installed) -and $AdbApkMissing) {
                    $answer = Read-Host 'No built APK found. Build one now (idempotent prerequisites + build), then install? [Y/n]'
                    if ($answer -notmatch '^[nN]') {
                        $script:BuildForInstall = $true
                        $menuDone = $true
                    }
                }
            }
            '^9$' { Invoke-AdbLanScan }
            '^0$' { $menuDone = $true }
            default {
                if ($choice -match $AdbIpTargetPattern) {
                    $null = Connect-AdbAuthorized -Target $choice
                } else {
                    Write-Warn "Unknown option: $choice"
                }
            }
        }
    }
}

# Non-interactive device actions (order: tcpip -> live -> scan -> pair -> connect -> disconnect -> install -> list).
function Invoke-DeviceActions {
    $script:AdbActionsOk = $true
    if ($AdbTcpipPort -gt 0) { Enable-AdbTcpip -Port $AdbTcpipPort }
    if ($LiveReloadActive) {
        if (Connect-AdbOnline) {
            $script:BuildForInstall = $true
            $script:BuildTypeEffective = 'debug'
        } else {
            $script:AdbActionsOk = $false
        }
    }
    if ($AdbScan) { Invoke-AdbLanScan }
    if ($AdbPair) {
        if (-not (Invoke-AdbPair -Target $AdbPair -Code $AdbPairCode)) { $script:AdbActionsOk = $false }
    }
    if ($AdbConnect) {
        if (-not (Connect-AdbAuthorized -Target $AdbConnect)) { $script:AdbActionsOk = $false }
    }
    if ($null -ne $AdbDisconnectTarget) { Disconnect-AdbDevice -Target $AdbDisconnectTarget }
    if ($AdbInstallRequested) {
        if (-not (Install-AdbApk -ApkPath $AdbInstallPath)) {
            if ($AdbApkMissing) {
                Write-Info "No built APK found; switching to the build workflow, then installing."
                $script:BuildForInstall = $true
            } else {
                $script:AdbActionsOk = $false
            }
        }
    }
    Show-AdbDevices
}

Write-Info "Original directory: $OriginalDir"
Write-Info "Working directory:  $AppRoot"
Write-Info "Constants: CACHE=$($Global:CORE_NODE_CACHE_DIR) | SDK=$($Global:ANDROID_SDK_DIR) | TOOLCHAIN=$($Global:LANG_COMPILER_DIR) | CENTRAL_LIB=$AndroidBuildEnvScript"

if ($Platform -eq 'ios') {
    Write-Err "iOS builds require macOS with Xcode 26+ (Capacitor 8). Run scripts/start_build.sh on a Mac."
    $AllReady = $false
}

# --- Device mode selection (any ADB / live-reload switch) ---
$AdbDisconnectRequested = $PSBoundParameters.ContainsKey('AdbDisconnect')
if ($AdbDisconnectRequested) { $AdbDisconnectTarget = $AdbDisconnect }
if ($PSBoundParameters.ContainsKey('AdbTcpip')) {
    $AdbTcpipPort = $AdbTcpip
    if ($AdbTcpipPort -le 0) { $AdbTcpipPort = $AdbDefaultPort }
}
if ($LiveReloadActive) { $BuildTypeEffective = 'debug' }
if ($AdbMenu -or $AdbDevices -or $AdbPair -or $AdbConnect -or $AdbDisconnectRequested -or ($AdbTcpipPort -gt 0) -or $AdbInstallRequested -or $AdbScan -or $LiveReloadActive) {
    $DeviceMode = $true
}

# --- Top-level menu (bare interactive run): build vs ADB device debugging ---
$IsBareRun = (-not $DeviceMode) -and (-not $NonInteractive) -and (-not $List) -and (-not $App) -and ($BuildTypeEffective -eq 'ask')
if ($AllReady -and $IsBareRun -and (Test-InteractiveConsole)) {
    Write-Host ''
    Write-Info "=== Nexus build menu ==="
    Write-Host '  1) Build APK (Capacitor native build)'
    Write-Host '  2) ADB device debugging (pair/connect a phone)'
    Write-Host '  0) Exit'
    $modeChoice = (Read-Host 'Select a mode [1]').Trim()
    if ($modeChoice -eq '2') { $AdbMenu = [switch]$true; $DeviceMode = $true }
    elseif ($modeChoice -eq '0') { $UserQuit = $true; $DeviceMode = $true }
}

# --- Device debugging phase (no build) ---
if ($AllReady -and $DeviceMode) {
    if ($UserQuit) {
        $BuildOk = $true
    } else {
        Confirm-AdbBin
        if (Test-AdbReady) {
            Write-Info "adb binary: $AdbBin"
            if ($AdbMenu) {
                Start-DeviceMenu
                $BuildOk = $true
            } else {
                Invoke-DeviceActions
                if ($AdbActionsOk -or $BuildForInstall) { $BuildOk = $true }
            }
        } else {
            Write-Err "adb still missing after Step62_InstallAndroidSdkPackages.ps1 (check network/proxy: HTTPS_PROXY)."
            $AllReady = $false
        }
    }
    if ($BuildForInstall -and $AllReady) {
        $DeviceMode = $false
        $BuildOk = $false
        Write-Info "Switching to the build workflow to produce an APK for installation..."
    }
}

# --- Prerequisite: node + bun (binary gate: bun on PATH) ---
if ($AllReady -and (-not $DeviceMode) -and (-not (Test-BunReady))) {
    Write-Info "bun not found. Invoking dd idempotent step (installs node + bun): Step4_InstallNodeJS.ps1"
    Invoke-DevStep -StepPath $StepNodeJs
    if (-not (Test-BunReady)) {
        Write-Err "bun still missing after Step4_InstallNodeJS.ps1."
        $AllReady = $false
    } else {
        Write-Success "Upgraded the frontend runtime to bun: $((Get-Command bun -ErrorAction SilentlyContinue).Source)"
    }
}

# --- Prerequisite: python (binary gate: python on PATH) ---
if ($AllReady -and (-not $DeviceMode) -and (-not (Test-PythonReady))) {
    Invoke-DevStep -StepPath $StepPython
    if (-not (Test-PythonReady)) {
        Write-Err "python still missing after Step8_InstallPython.ps1."
        $AllReady = $false
    }
}
if ($AllReady -and (-not $DeviceMode)) {
    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $PythonCommand) { $PythonCommand = Get-Command python3 -ErrorAction SilentlyContinue }
}

# --- Project dependencies (binary gate: vite.js) ---
if ($AllReady -and (-not $DeviceMode) -and (-not $List) -and (-not (Test-ViteReady))) {
    Install-Deps
    if (-not (Test-ViteReady)) {
        Write-Err "Dependencies incomplete (vite missing) after bun install."
        $AllReady = $false
    }
}

# --- Prerequisite: JDK 21 (central detector: java.exe with major >= 21) ---
if ($AllReady -and (-not $DeviceMode) -and (-not $List)) {
    Resolve-AndroidBuildJavaHome
    if (-not (Test-AndroidBuildJavaReady)) {
        Invoke-DevStep -StepPath $StepApplications -StepArguments @('-ExactPackageName', 'Java')
        Resolve-AndroidBuildJavaHome
        if (-not (Test-AndroidBuildJavaReady)) {
            Write-Err "JDK $($Global:ANDROID_BUILD_REQUIRED_JAVA_MAJOR)+ still missing after Step21_InstallApplications.ps1 -ExactPackageName Java."
            $AllReady = $false
        }
    }
}

# --- Prerequisite: Android SDK packages (central detector: sdkmanager + adb + platform + build-tools) ---
if ($AllReady -and (-not $DeviceMode) -and (-not $List)) {
    Resolve-AndroidBuildSdkRoot
    if (-not (Test-AndroidBuildSdkReady)) {
        Invoke-DevStep -StepPath $StepAndroidSdk
        Resolve-AndroidBuildSdkRoot
        if (-not (Test-AndroidBuildSdkReady)) {
            Write-Err "Android SDK packages still missing after Step62_InstallAndroidSdkPackages.ps1 (check network/proxy: HTTPS_PROXY)."
            $AllReady = $false
        }
    }
}

# --- Export resolved toolchain env for the build (central state) ---
if ($AllReady -and (-not $DeviceMode) -and (-not $List)) {
    $env:JAVA_HOME = $Global:ANDROID_BUILD_JAVA_HOME
    $env:Path = "$(Join-Path $Global:ANDROID_BUILD_JAVA_HOME 'bin');$env:Path"
    $env:ANDROID_HOME = $Global:ANDROID_BUILD_SDK_ROOT
    $env:ANDROID_SDK_ROOT = $Global:ANDROID_BUILD_SDK_ROOT
    $env:Path = "$(Join-Path $Global:ANDROID_BUILD_SDK_ROOT 'platform-tools');$(Join-Path $Global:ANDROID_BUILD_SDK_ROOT 'cmdline-tools\latest\bin');$env:Path"
    Write-Success "JAVA_HOME = $($Global:ANDROID_BUILD_JAVA_HOME)"
    Write-Success "ANDROID_HOME = $($Global:ANDROID_BUILD_SDK_ROOT)"
    if (Set-AndroidBuildJavaProxy) {
        Write-Info "Proxy enabled via JAVA_TOOL_OPTIONS for sdkmanager/gradle."
    }
}

# --- Online adb devices: offer to install the fresh APK (default yes) ---
if ($AllReady -and (-not $DeviceMode) -and (-not $List) -and (-not $BuildForInstall)) {
    Resolve-AdbBin
    if ((Test-AdbReady) -and ((Get-AdbOnlineCount) -gt 0)) {
        Write-Info "Online adb device(s) detected:"
        Show-AdbDevices
        if (Read-DefaultYes -Prompt 'Install the built APK to the connected device(s) after the build?') { $BuildForInstall = $true }
    }
}

if ($AllReady -and (-not $DeviceMode)) {
    $BuildArguments = @($BuildApkScript, '--root', $AppRoot, '--build-type', $BuildTypeEffective)
    if ($App) { $BuildArguments += @('--app', $App) }
    if ($List) { $BuildArguments += @('--list') }
    if ($SkipAssets) { $BuildArguments += @('--assets', 'no') }
    if ($Clean) { $BuildArguments += @('--clean', 'yes') }
    if ($NoOpenOutput) { $BuildArguments += @('--open', 'no') }
    if ($NonInteractive) { $BuildArguments += @('--non-interactive') }
    if ($LiveReloadActive) { $BuildArguments += @('--live-reload', '--assets', 'yes', '--clean', 'no', '--open', 'yes', '--build-type', 'debug') }

    Write-Info "Starting Capacitor native build workflow (platform: $Platform)."
    & $PythonCommand.Source @BuildArguments
    $BuildOk = ($LASTEXITCODE -eq 0)
    if ($BuildOk) { Write-Success "Native build workflow finished." } else { Write-Err "Native build workflow failed." }
} elseif (-not $DeviceMode) {
    Write-Err "Prerequisites are not ready; build was not started."
}

# --- Post-build install (device mode, or accepted online-device offer) ---
if ($BuildForInstall -and $AllReady) {
    if ($BuildOk) {
        Confirm-AdbBin
        if (Test-AdbReady) {
            if (Install-AdbApk -ApkPath '') {
                Write-Success "Freshly built APK installed to the connected device."
                if ($LiveReloadActive) { Invoke-AdbLiveAttach }
            } else {
                Write-Err "APK install failed."
                $BuildOk = $false
            }
        } else {
            Write-Err "adb unavailable; the APK was built but not installed."
            $BuildOk = $false
        }
    } else {
        Write-Err "Build failed; nothing was installed."
    }
}

Set-Location -LiteralPath $OriginalDir
if ($AllReady -and $BuildOk) { exit 0 } else { exit 1 }
