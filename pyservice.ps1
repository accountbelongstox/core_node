<#
.SYNOPSIS
    Service entry point for the Pycore Module Caller (Windows / PowerShell).

.DESCRIPTION
    `pyservice.ps1` is ONLY an entry point. It does two things, in order:

        1. PREREQUISITES (idempotent): default `run` always runs
           PreparePycorePrerequisites (Step*.ps1 installers skip when already satisfied).
           Orchestration lives in scripts\shells\win\main_powershells\PreparePycorePrerequisites.ps1.
           Use `-Only` to provision without launching the worker. The main worker
           uses system Python 3.13; incompatible TTS subprocesses use pre-built,
           engine-specific isolated environments.

        2. LAUNCH: starts pycore\pycore_module_caller.py (the real worker, which
           now lives inside the pycore package, not at the repo root).

        3. BACKGROUND SERVICE (same meaning as `./pyservice.sh install`):
           `install` runs the idempotent prerequisites, then installs + enables +
           starts the Windows service `pycore` (NSSM, automatic start, headless:
           `pyservice.ps1 run -NoUi -NoInstall -NoServicePrompt`, no tray).
           `uninstall|start|stop|restart|status` manage it; admin rights are
           requested through a UAC self-elevation. An interactive `run` offers
           the install when the service is absent and otherwise ensures the
           installed service is running instead of starting a second worker.

    Prerequisites and the worker are invoked through absolute paths resolved from
    this script's own folder, so the repo can live anywhere.

.PARAMETER BindHost
    Host the RPC server binds to. Default: 0.0.0.0

.PARAMETER Port
    Port the RPC server binds to. Default: 59000

.PARAMETER DebugMode
    Enable the worker's debug mode. (Named -DebugMode because -Debug is a reserved
    PowerShell common parameter.)

.PARAMETER NoReload
    Accepted and ignored: hot reload is off. After code changes restart pycore
    (service restart or pyservice restart).

.PARAMETER Only
    Run ONLY the idempotent prerequisite step and exit (do not launch the worker
    and do not install the service).

.EXAMPLE
    .\pyservice.ps1
    Idempotent prerequisites, then launch on 127.0.0.1:59000. A LAN bind
    (-BindHost 0.0.0.0) is honored only with the pycore LAN bind setting:
    .\pyservice.ps1 config system set --key rpcLanBind --value true
    and then admits only client-key signed machine callers.

.PARAMETER NoUi
    Do not launch the unified dashboard UI; the PySide6 webview falls back to the
    legacy in-process /web/subtitle page.

.PARAMETER UiBuild
    Build the dashboard UI (vite build) and serve the production bundle (vite
    preview) instead of running the Vite dev server. No live-reload.

.PARAMETER UiPort
    Port the UI server listens on (PySide6 loads it). Default: 13054.

.PARAMETER NoInstall
    Skip all PowerShell prerequisite installers and launch the service directly
    (with `install`: register the background service without provisioning first).

.PARAMETER NoServicePrompt
    Do not offer the background-service install [Y/n] on an interactive `run`
    (also --no-service-prompt). The service's own command always passes it.

.PARAMETER TtsSelfcheck
    Run the TTS batch self-check as a STANDALONE step before the worker starts:
    probe each engine (kokoro, parler, chattts, gptsovits) with RAM/GPU memory
    gates, generate a real batch sample, log resource before/after, then release
    memory/GPU; the worker (RPC + services) starts only after it exits.
    before serving. Same as setting $env:TTS_STARTUP_SELFCHECK = '1'.

.EXAMPLE
    .\pyservice.ps1 install
    Idempotent prerequisites, then install + enable + start the `pycore` Windows
    service (re-running repairs a drifted service and starts it when stopped).

.EXAMPLE
    .\pyservice.ps1 status
    Show the `pycore` Windows service state, start type, command and log path.

.EXAMPLE
    .\pyservice.ps1 -Only
    Provision prerequisites only (Step installers via PreparePycorePrerequisites).

.EXAMPLE
    .\pyservice.ps1 -UiBuild
    Build the dashboard UI and serve it (vite preview), then launch the worker.

.EXAMPLE
    .\pyservice.ps1 -NoUi
    Use the legacy /web/subtitle UI (no dashboard dev server).

.EXAMPLE
    .\pyservice.ps1 -NoInstall
    Skip all prerequisite installers and launch the service directly.

.NOTES
    /pycore-manager/queue-center is served BY pycore (proxying laravel_main's
    /assist/overview), never a direct web connection -- keep it and laravel_main's
    /laravel-manager#/task-center aligned when either side's task categories change.
#>

# --------------------------------------------------------------------------- #
# Subcommands: run (default) | config | install | start | stop | restart |      #
# status | uninstall | help. install/start/stop/restart/status/uninstall manage  #
# the Windows service `pycore` (NSSM; same meaning as pyservice.sh's systemd     #
# unit `pycore`: headless, no tray). `config` is cross-platform.                 #
#
# Headless config CLI:  .\pyservice.ps1 config ...  -> python -m pycore.pyservice_cli
#   HTTP-first, file-fallback: while the service runs, edits go through its HTTP
#   API and apply live (broadcast to any open UI); while stopped, persistent
#   settings are written straight to their files and take effect next start.
#   Runtime-only toggles (distribute, skip-update) require the running service.
#   This is the headless equivalent of the Settings UI + Code Sync page.
#
#     # System settings (theme, lang, accent, blur, ...)
#     .\pyservice.ps1 config system get
#     .\pyservice.ps1 config system set --key theme --value light
#     .\pyservice.ps1 config system set --json '{"theme":"dark","lang":"zh"}'
#     # Code sync - role / peers (persistent; offline-capable)
#     .\pyservice.ps1 config codesync show
#     .\pyservice.ps1 config codesync role [dev]        # print / set this device's role
#     .\pyservice.ps1 config codesync peers add --name lab --host 192.168.1.10 --role dev
#     .\pyservice.ps1 config codesync peers remove --id 192.168.1.10:59000
#     # Code sync - runtime toggles (need the running service)
#     .\pyservice.ps1 config codesync distribute on     # dev only: start pushing code
#     .\pyservice.ps1 config codesync skip-update on     # client: temporarily reject code
#
#   Config storage:
#     - System settings     : ~/.core_node/config/user_data.json  (system_settings section)
#     - Code-sync role/peers : pycore/pyutils/codesync/code_sync_peers.json  (committed)
#
# UI vs headless:
#   `run` serves the unified shell poly_apps\pycore_laravel_wordnew_ui (its pycore-manager
#   end) at http://localhost:<UiPort>/pycore-manager, loaded by PySide6 via
#   PYCORE_UI_URL. Backend controllers and replayable events use HTTP on :59000.
#   A global floating collapsible log panel is available on every pycore page.
#   The old standalone React app
#   pycore\pyctl\desktop\desktop-manager (dev server :15654) was superseded by the
#   unified shell (poly_apps\pycore_laravel_wordnew_ui) and has been removed.
#   -NoUi falls back to the legacy in-process /web/subtitle page.
# --------------------------------------------------------------------------- #
[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [string]$Command = 'run',
    [string]$BindHost = '127.0.0.1',
    [int]   $Port     = 59000,
    [switch]$DebugMode,
    [switch]$NoReload,
    [switch]$Only,
    [switch]$NoUi,
    [ValidateSet('1', '2')]
    [string]$ServiceMode = '1',
    [switch]$UiBuild,
    [int]$UiPort = 13054,
    [switch]$NoInstall,
    [switch]$NoServicePrompt,
    [switch]$ElevatedRelaunch,
    [switch]$TtsSelfcheck,
    [string[]]$InstallInclude = @(),
    [string]$InstallWhisperModel = '',
    [string]$InstallFasterWhisperModel = '',
    [string]$InstallVoskModel = '',
    [switch]$InstallFull,
    [switch]$InstallForce,
    # Trailing args forwarded to subcommands (e.g. `config ...`, `codesync ...`).
    # Required because [CmdletBinding()] otherwise rejects extra positional args.
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Rest = @()
)

$ErrorActionPreference = 'Stop'
$env:PYCORE_HTTP_EVENTS_ENABLED = '1'

$sharedCacheEnv = Join-Path $PSScriptRoot 'scripts\shells\win\win_common\SharedCacheEnv.ps1'
. $sharedCacheEnv
Set-Variable -Name 'PycoreSharedCacheEnvLoaded' -Scope Script -Value $true

$winCommonDir = Join-Path $PSScriptRoot 'scripts\shells\win\win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
Set-Variable -Name 'PycoreGlobalVarsLoaded' -Scope Script -Value $true
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')
Set-Variable -Name 'PycorePythonRuntimeCommonLoaded' -Scope Script -Value $true

$rpcListener = $null
$workerExitCode = $null
# Worker exit code for a restart handoff or a yield to a newer instance
# (process_restart / pycore_module_caller): the UI server stays running.
$workerHandoffExitCode = 3
$uiResponse = $null
$powerShellPath = $null
$uiStartPath = $null
$uiStartArguments = @()
$helpRequested = $false
$pycoreServiceName = 'pycore'
$pycoreServiceDisplayName = 'Pycore Module Caller'
$pycoreServiceDescription = 'Pycore Module Caller (headless)'
$pycoreServiceCommands = @('install', 'uninstall', 'start', 'stop', 'restart', 'status')
$pycoreServiceNssmScript = Join-Path $winCommonDir 'NssmServiceManager.ps1'
$pycoreServiceLogDir = Join-Path (Join-Path $Global:CORE_NODE_CACHE_DIR 'pycore') 'logs'
$pycoreServiceStdoutLog = Join-Path $pycoreServiceLogDir 'pycore.service.out.log'
$pycoreServiceStderrLog = Join-Path $pycoreServiceLogDir 'pycore.service.err.log'
$pycoreServiceRegistryKey = Join-Path 'HKLM:\SYSTEM\CurrentControlSet\Services' $pycoreServiceName
$pycoreServiceEnvironment = @('PYCORE_NO_TRAY=1', 'PYCORE_SERVICE_RUN=1')
$pycoreServiceScriptPath = Join-Path $PSScriptRoot 'pyservice.ps1'
$pycoreServiceArguments = ('-NoProfile -ExecutionPolicy Bypass -File "{0}" run -NoUi -NoInstall -NoServicePrompt' -f $pycoreServiceScriptPath)
$pycoreServiceExitCode = 0
$preparePath = Join-Path $PSScriptRoot 'scripts\shells\win\main_powershells\PreparePycorePrerequisites.ps1'
$secretManagerPath = Join-Path $winCommonDir 'SecretManager.ps1'
. $pycoreServiceNssmScript

if ($Command -in @('1', '2')) {
    $ServiceMode = $Command
    $Command = 'run'
}

# GNU-style stacking: if the leading positional token is a dashed option (e.g.
# `.\pyservice.ps1 --tts-selfcheck` - PowerShell binds it to $Command, NOT to
# the switch parameter), push it back into $Rest so the parameter-library walk
# below applies it like any other stacked token.
if ($Command -match '^-') {
    $Rest = @($Command) + @($Rest)
    $Command = 'run'
}

# Run-mode parameter stacking: walk every leftover token against the WHOLE
# parameter library. Recognized tokens apply in ANY position and STACK (mode
# digit, help, GNU double-dash aliases like --no-ui / --port 8000, dashless
# forms like -TtsSelfcheck), instead of requiring a fixed position. Tokens are
# normalized (lowercased, leading dashes and inner -/_ stripped) before
# matching, so --tts-selfcheck / -tts-selfcheck / -TtsSelfcheck are equivalent.
if (($Command -ieq 'run' -or $Command -ieq 'install') -and $Rest.Count -gt 0) {
    $stackedRest = @()
    $i = 0
    while ($i -lt $Rest.Count) {
        $tok = "$($Rest[$i])"
        $opt = ($tok.ToLowerInvariant() -replace '^-+', '') -replace '[-_]', ''
        switch ($opt) {
            { $_ -in @('1', '2') }     { $ServiceMode = $_ }
            { $_ -in @('help', 'h') }  { $helpRequested = $true }
            { $_ -in @('colab', 'kaggle') } { $Command = $_ }
            'ttsselfcheck'             { $TtsSelfcheck = $true }
            { $_ -in @('debug', 'debugmode') } { $DebugMode = $true }
            'noreload'                 { $NoReload = $true }
            'only'                     { $Only = $true }
            'noui'                     { $NoUi = $true }
            'uibuild'                  { $UiBuild = $true }
            'noinstall'                { $NoInstall = $true }
            'noserviceprompt'          { $NoServicePrompt = $true }
            'installfull'              { $InstallFull = $true }
            'installforce'             { $InstallForce = $true }
            { $_ -in @('host', 'bindhost') } {
                if ($i + 1 -lt $Rest.Count) { $i++; $BindHost = "$($Rest[$i])" }
            }
            'port' {
                if ($i + 1 -lt $Rest.Count) { $i++; $v = "$($Rest[$i])" -as [int]; if ($null -ne $v) { $Port = $v } }
            }
            'uiport' {
                if ($i + 1 -lt $Rest.Count) { $i++; $v = "$($Rest[$i])" -as [int]; if ($null -ne $v) { $UiPort = $v } }
            }
            'installinclude' {
                if ($i + 1 -lt $Rest.Count) { $i++; $InstallInclude = @("$($Rest[$i])") }
            }
            'installwhispermodel' {
                if ($i + 1 -lt $Rest.Count) { $i++; $InstallWhisperModel = "$($Rest[$i])" }
            }
            'installfasterwhispermodel' {
                if ($i + 1 -lt $Rest.Count) { $i++; $InstallFasterWhisperModel = "$($Rest[$i])" }
            }
            'installvoskmodel' {
                if ($i + 1 -lt $Rest.Count) { $i++; $InstallVoskModel = "$($Rest[$i])" }
            }
            default { $stackedRest += $tok }
        }
        $i++
    }
    $Rest = $stackedRest
}

# --------------------------------------------------------------------------- #
# Single system Python 3.13 (D:\.dev_win10\python313); no venv, no py launcher #
# fallbacks to other minors.                                                   #
# --------------------------------------------------------------------------- #
function Resolve-Python {
    $exe = $Global:PYTHON_EXE_PATH
    if (-not $exe -or -not (Test-Path -LiteralPath $exe)) {
        Write-Host ("[!] System Python not found at {0}." -f $Global:PYTHON_EXE_PATH) -ForegroundColor Red
        return $null
    }
    # Reject venv / virtualenv Pythons: only the system Python 3.13 is allowed.
    $exeDir = Split-Path -Parent $exe
    $pyvenvCfg = Join-Path $exeDir 'pyvenv.cfg'
    if (Test-Path -LiteralPath $pyvenvCfg) {
        Write-Host ("[!] Refusing venv Python at {0} (pyvenv.cfg found; system Python 3.13 required)." -f $exe) -ForegroundColor Red
        return $null
    }
    if (-not (Test-PythonExeVersionMatches -PythonExe $exe)) {
        Write-Host ("[!] Python at {0} is not 3.13." -f $exe) -ForegroundColor Red
        return $null
    }
    $versionText = Get-PythonVersionTextFromExe -PythonExe $exe
    return [PSCustomObject]@{
        Path    = $exe
        Version = if ($versionText) { $versionText } else { 'Python 3.13' }
    }
}

# --------------------------------------------------------------------------- #
# Usage / help.                                                                #
# --------------------------------------------------------------------------- #
function Show-Usage {
    Write-Host 'pyservice.ps1 - entry point for the Pycore Module Caller (Windows)' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Usage:'
    Write-Host '  .\pyservice.ps1 [1|2] [-Param value ...]'
    Write-Host '  GNU-style aliases are accepted and STACK in any position, e.g.'
    Write-Host '  .\pyservice.ps1 --tts-selfcheck --no-ui --port 8000 2'
    Write-Host ''
    Write-Host 'Subcommands:'
    Write-Host '  1            Launch the local dashboard mode (default)'
    Write-Host '  2            Launch the Relay intermediary mode'
    Write-Host '  run          Idempotent prerequisites, then launch (default)'
    Write-Host '  config       Edit/show headless config via the cross-platform Python CLI'
    Write-Host '               (forwards args to: python -m pycore.pyservice_cli config)'
    Write-Host '  install      Install + enable + start the pycore Windows service (NSSM, automatic'
    Write-Host '               start, headless, no tray). Runs the idempotent prerequisites first'
    Write-Host '               (-NoInstall skips them); re-running repairs and starts the service'
    Write-Host '  start        Start the pycore Windows service'
    Write-Host '  stop         Stop the pycore Windows service'
    Write-Host '  restart      Restart the pycore Windows service'
    Write-Host '  status       Show the pycore Windows service status'
    Write-Host '  uninstall    Stop + remove the pycore Windows service'
    Write-Host '  colab        Google Colab VM Relay agent; Linux-only via pyservice.sh (notice on Windows)'
    Write-Host '  kaggle       Kaggle notebook VM Relay agent; Linux-only via pyservice.sh (notice on Windows)'
    Write-Host '  help         Show this help (also -h / --help)'
    Write-Host ''
    Write-Host 'Parameters (apply to run; -NoInstall and -Only also apply to install):'
    Write-Host '  -BindHost HOST    Host the RPC server binds to (default: 0.0.0.0)'
    Write-Host '  -Port PORT        Port the RPC server binds to (default: 59000)'
    Write-Host '  -DebugMode        Enable the worker''s debug mode'
    Write-Host '  -NoReload         Accepted and ignored: hot reload is off; restart pycore after code changes'
    Write-Host '  -NoServicePrompt  Do not offer the background-service install [Y/n] (interactive run'
    Write-Host '                    offers it when the service is absent; an installed service is'
    Write-Host '                    ensured running and reported instead of a second foreground worker)'
    Write-Host '  -Only             Run ONLY the prerequisite step, then exit (no service install)'
    Write-Host '  -NoUi             Do not launch the dashboard UI; use legacy /web/subtitle'
    Write-Host '  -UiBuild          Build the dashboard UI and serve it (vite preview)'
    Write-Host '  -UiPort PORT      Port the UI server listens on (default: 13054)'
    Write-Host '  -NoInstall        Skip all PowerShell prerequisite installers'
    Write-Host '  -TtsSelfcheck     Probe + batch-test each TTS engine, log RAM/GPU before/after,'
    Write-Host '                    release resources, then serve (same as $env:TTS_STARTUP_SELFCHECK=1)'
    Write-Host '  -InstallInclude   Run only named prerequisite entries'
    Write-Host '  -InstallWhisperModel       Select the openai-whisper model'
    Write-Host '  -InstallFasterWhisperModel Select the faster-whisper model'
    Write-Host '  -InstallVoskModel          Select auto, small, or large for Vosk'
    Write-Host '  -InstallFull      Pass Full to installers that support it'
    Write-Host '  -InstallForce     Pass Force to installers that support it'
    Write-Host '  $env:PYCORE_LOCAL_AI_INSTALL=1  Install the local AI translation runtime'
    Write-Host '                    (Ollama + translation model; or -InstallInclude ollama)'
    Write-Host ''
    Write-Host 'Examples:'
    Write-Host '  .\pyservice.ps1'
    Write-Host '  .\pyservice.ps1 2'
    Write-Host '  .\pyservice.ps1 install'
    Write-Host '  .\pyservice.ps1 status'
    Write-Host '  .\pyservice.ps1 run -NoUi -Port 8000'
    Write-Host '  .\pyservice.ps1 run -NoServicePrompt'
    Write-Host '  .\pyservice.ps1 -NoInstall'
    Write-Host '  .\pyservice.ps1 -TtsSelfcheck'
    Write-Host '  .\pyservice.ps1 config -show'
    Write-Host '  .\pyservice.ps1 -Only -InstallInclude ollama'
}

# --------------------------------------------------------------------------- #
# Idempotent prerequisite installers (shared by run and the service install). #
# --------------------------------------------------------------------------- #
function Invoke-PycorePrerequisites {
    param([Parameter(Mandatory = $true)][string]$PythonPath)
    $prerequisiteArgs = @{ Python = $PythonPath }
    Write-Host '[i] Installation is idempotent and SELF-REPAIRING: re-running repairs missing artifacts' -ForegroundColor Cyan
    Write-Host '    (installed pip distributions are preserved; incomplete model' -ForegroundColor Cyan
    Write-Host '    weights resume). Safe to re-run any time. See docs_fix/DESIGN_TTS_AI_RUNTIME.md.' -ForegroundColor Cyan
    Write-Host '[..] Running idempotent prerequisite installers (PreparePycorePrerequisites -> Step*.ps1) ...' -ForegroundColor Yellow
    if (-not $env:NEURAL_TTS_INSTALL) { $env:NEURAL_TTS_INSTALL = '1' }
    if ($InstallInclude.Count -gt 0) { $prerequisiteArgs['Include'] = $InstallInclude }
    if ($InstallWhisperModel) { $prerequisiteArgs['WhisperModel'] = $InstallWhisperModel }
    if ($InstallFasterWhisperModel) { $prerequisiteArgs['FasterWhisperModel'] = $InstallFasterWhisperModel }
    if ($InstallVoskModel) { $prerequisiteArgs['VoskModel'] = $InstallVoskModel }
    if ($InstallFull) { $prerequisiteArgs['Full'] = $true }
    if ($InstallForce) { $prerequisiteArgs['Force'] = $true }
    & $preparePath @prerequisiteArgs
}

# --------------------------------------------------------------------------- #
# Background service `pycore` (NSSM-backed Windows service; Windows twin of   #
# the systemd unit `pycore`). Headless, no tray: the service command passes   #
# -NoUi -NoInstall -NoServicePrompt and PYCORE_NO_TRAY=1.                     #
# --------------------------------------------------------------------------- #
function Test-PycoreInteractiveSession {
    if ($env:PYCORE_SERVICE_RUN -eq '1') { return $false }
    if (-not [Environment]::UserInteractive) { return $false }
    return (-not [Console]::IsInputRedirected)
}

function Invoke-PycoreServiceElevated {
    param([Parameter(Mandatory = $true)][string]$ServiceCommand)
    $powerShellExe = (Get-Process -Id $PID).Path
    $elevatedArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $pycoreServiceScriptPath), $ServiceCommand, '-ElevatedRelaunch')
    $elevatedProcess = $null
    if ($NoInstall) { $elevatedArgs += '-NoInstall' }
    if ($InstallFull) { $elevatedArgs += '-InstallFull' }
    if ($InstallForce) { $elevatedArgs += '-InstallForce' }
    if ($InstallInclude.Count -gt 0) { $elevatedArgs += @('-InstallInclude', ('"{0}"' -f ($InstallInclude -join ','))) }
    if ($InstallWhisperModel) { $elevatedArgs += @('-InstallWhisperModel', ('"{0}"' -f $InstallWhisperModel)) }
    if ($InstallFasterWhisperModel) { $elevatedArgs += @('-InstallFasterWhisperModel', ('"{0}"' -f $InstallFasterWhisperModel)) }
    if ($InstallVoskModel) { $elevatedArgs += @('-InstallVoskModel', ('"{0}"' -f $InstallVoskModel)) }
    Write-Host ("[i] Administrator rights are required for '{0}'; relaunching elevated (UAC) ..." -f $ServiceCommand) -ForegroundColor Yellow
    try {
        $elevatedProcess = Start-Process -FilePath $powerShellExe -Verb RunAs -Wait -PassThru -ArgumentList $elevatedArgs
    } catch {
        Write-Host ("[!] Elevation declined or failed: {0}" -f $_.Exception.Message) -ForegroundColor Red
        return 1
    }
    return [int]$elevatedProcess.ExitCode
}

function Get-PycoreServiceExePath {
    $powerShellCommand = Get-Command -Name 'powershell.exe' -ErrorAction SilentlyContinue
    if (-not $powerShellCommand) { $powerShellCommand = Get-Command -Name 'pwsh.exe' -ErrorAction SilentlyContinue }
    if (-not $powerShellCommand) { return $null }
    return [string]$powerShellCommand.Source
}

function Get-PycoreServiceDrift {
    param([Parameter(Mandatory = $true)][string]$ExePath)
    $drift = @()
    $parametersKey = Join-Path $pycoreServiceRegistryKey 'Parameters'
    $serviceInfo = Get-CimInstance -ClassName Win32_Service -Filter ("Name='{0}'" -f $pycoreServiceName) -ErrorAction SilentlyContinue
    $parameterItem = $null
    $expectedPairs = @(@('Application', $ExePath), @('AppParameters', $pycoreServiceArguments))
    $pair = $null
    $currentProperty = $null
    $environmentValues = @()
    $environmentLine = $null
    if ($serviceInfo -and ([string]$serviceInfo.StartMode -ne 'Auto')) { $drift += 'start type' }
    if (-not (Test-Path -LiteralPath $parametersKey)) { return @($drift + 'parameters') }
    $parameterItem = Get-ItemProperty -LiteralPath $parametersKey
    foreach ($pair in $expectedPairs) {
        $currentProperty = $parameterItem.PSObject.Properties[$pair[0]]
        if ((-not $currentProperty) -or ([string]$currentProperty.Value -ne $pair[1])) { $drift += $pair[0] }
    }
    $currentProperty = $parameterItem.PSObject.Properties['AppEnvironmentExtra']
    if ($currentProperty) { $environmentValues = @($currentProperty.Value) }
    foreach ($environmentLine in $pycoreServiceEnvironment) {
        if ($environmentValues -notcontains $environmentLine) { $drift += 'environment'; break }
    }
    return @($drift)
}

function Show-PycoreServiceStatus {
    $service = Get-Service -Name $pycoreServiceName -ErrorAction SilentlyContinue
    $serviceInfo = $null
    $rpcListener = $null
    if (-not $service) {
        Write-Host ("[i] Service '{0}' is not installed. Install it with: .\pyservice.ps1 install" -f $pycoreServiceName) -ForegroundColor Yellow
        return 1
    }
    $serviceInfo = Get-CimInstance -ClassName Win32_Service -Filter ("Name='{0}'" -f $pycoreServiceName) -ErrorAction SilentlyContinue
    $rpcListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    Write-Host ("[i] Service : {0} ({1})" -f $pycoreServiceName, $pycoreServiceDisplayName) -ForegroundColor Cyan
    Write-Host ("    State   : {0}" -f $service.Status)
    if ($serviceInfo) {
        Write-Host ("    Start   : {0}" -f $serviceInfo.StartMode)
        Write-Host ("    PID     : {0}" -f $serviceInfo.ProcessId)
    }
    Write-Host ("    RPC     : port {0} {1}" -f $Port, $(if ($rpcListener) { 'listening' } else { 'not listening' }))
    Write-Host ("    Logs    : Get-Content -LiteralPath '{0}' -Wait -Tail 50" -f $pycoreServiceStdoutLog)
    if ([string]$service.Status -eq 'Running') { return 0 }
    return 1
}

function Wait-PycoreServiceStatus {
    param([Parameter(Mandatory = $true)][string]$DesiredStatus)
    $service = Get-Service -Name $pycoreServiceName -ErrorAction SilentlyContinue
    if (-not $service) { return ($DesiredStatus -eq 'Stopped') }
    try {
        $service.WaitForStatus($DesiredStatus, [TimeSpan]::FromSeconds(30))
    } catch {
        return $false
    }
    return $true
}

function Install-PycoreService {
    $python = $null
    $nssmPath = $null
    $powerShellExe = $null
    $existingService = $null
    $drift = @()
    $registerResult = @()
    $registered = $false
    if (-not (Test-AdminPrivileges)) { return (Invoke-PycoreServiceElevated -ServiceCommand 'install') }

    if (-not $NoInstall) {
        $python = Resolve-Python
        if (-not $python) {
            Write-Host ("[!] System Python 3.13 was not found at {0}; run Step8_InstallDefaultPython.ps1." -f $Global:PYTHON_EXE_PATH) -ForegroundColor Red
            return 1
        }
        Ensure-CoreNodePythonPath -LogPrefix '[pyservice]'
        Push-Location -LiteralPath $PSScriptRoot
        try {
            Invoke-PycorePrerequisites -PythonPath $python.Path
        } finally {
            Pop-Location
        }
    } else {
        Write-Host '[i] Skipping all PowerShell prerequisite installers (-NoInstall).' -ForegroundColor DarkYellow
    }

    $nssmPath = Ensure-Nssm -RepoRootDir $PSScriptRoot
    if (-not $nssmPath) {
        Write-Host '[!] NSSM unavailable and auto-install (winget) failed -> cannot register the pycore service.' -ForegroundColor Red
        Write-Host "    Install it manually ('winget install NSSM.NSSM' or https://nssm.cc/), then re-run: .\pyservice.ps1 install" -ForegroundColor DarkYellow
        return 1
    }
    $powerShellExe = Get-PycoreServiceExePath
    if (-not $powerShellExe) {
        Write-Host '[!] powershell.exe was not found; cannot build the service command.' -ForegroundColor Red
        return 1
    }
    if (-not (Test-Path -LiteralPath $pycoreServiceLogDir)) { New-Item -ItemType Directory -Force -Path $pycoreServiceLogDir | Out-Null }

    $existingService = Get-Service -Name $pycoreServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        $drift = @(Get-PycoreServiceDrift -ExePath $powerShellExe)
        if ($drift.Count -gt 0) {
            Write-Host ("[i] Service {0} drifted ({1}); repairing ..." -f $pycoreServiceName, ($drift -join ', ')) -ForegroundColor Yellow
        } else {
            Write-Host ("[i] Service {0} already installed; ensuring it is automatic and running." -f $pycoreServiceName) -ForegroundColor Cyan
        }
    }
    # A healthy installed service keeps running (configuration refresh only); a new or drifted one is (re)started.
    $registerResult = @(Register-NssmService -NssmPath $nssmPath -ServiceName $pycoreServiceName `
        -DisplayName $pycoreServiceDisplayName -Description $pycoreServiceDescription `
        -ExePath $powerShellExe -Arguments $pycoreServiceArguments -WorkingDirectory $PSScriptRoot `
        -EnvironmentExtra $pycoreServiceEnvironment `
        -StdoutLog $pycoreServiceStdoutLog -StderrLog $pycoreServiceStderrLog `
        -NoRestart:([bool]($existingService -and ($drift.Count -eq 0))))
    $registered = ($registerResult.Count -gt 0) -and ($registerResult[$registerResult.Count - 1] -eq $true)
    if (-not $registered) {
        Write-Host ("[!] Service {0} registration failed." -f $pycoreServiceName) -ForegroundColor Red
        return 1
    }
    if ((Get-ServiceRunState -ServiceName $pycoreServiceName) -ne 'running') {
        try { Start-Service -Name $pycoreServiceName } catch { Write-Host ("[!] Start failed: {0}" -f $_.Exception.Message) -ForegroundColor Red }
    }
    if (-not (Wait-PycoreServiceStatus -DesiredStatus 'Running')) {
        Show-PycoreServiceStatus | Out-Null
        Write-Host ("[!] Service {0} did not reach Running." -f $pycoreServiceName) -ForegroundColor Red
        return 1
    }
    Write-Host ("[OK] Service {0} installed (automatic start) and running." -f $pycoreServiceName) -ForegroundColor Green
    Show-PycoreServiceStatus | Out-Null
    return 0
}

function Uninstall-PycoreService {
    if (-not (Get-Service -Name $pycoreServiceName -ErrorAction SilentlyContinue)) {
        Write-Host ("[i] Service {0} is not installed; nothing to remove." -f $pycoreServiceName) -ForegroundColor Yellow
        return 0
    }
    if (-not (Test-AdminPrivileges)) { return (Invoke-PycoreServiceElevated -ServiceCommand 'uninstall') }
    if (Remove-NssmService -ServiceName $pycoreServiceName) { return 0 }
    return 1
}

function Invoke-PycoreServiceControl {
    param([Parameter(Mandatory = $true)][ValidateSet('start', 'stop', 'restart')][string]$Action)
    $runState = Get-ServiceRunState -ServiceName $pycoreServiceName
    $desiredStatus = if ($Action -eq 'stop') { 'Stopped' } else { 'Running' }
    if ($runState -eq 'absent') {
        Write-Host ("[!] Service {0} is not installed. Install it with: .\pyservice.ps1 install" -f $pycoreServiceName) -ForegroundColor Red
        return 1
    }
    if (-not (Test-AdminPrivileges)) { return (Invoke-PycoreServiceElevated -ServiceCommand $Action) }
    try {
        switch ($Action) {
            'start'   { if ($runState -eq 'running') { Write-Host ("[OK] Service {0} is already running." -f $pycoreServiceName) -ForegroundColor Green } else { Start-Service -Name $pycoreServiceName } }
            'stop'    { if ($runState -eq 'stopped') { Write-Host ("[OK] Service {0} is already stopped." -f $pycoreServiceName) -ForegroundColor Green } else { Stop-Service -Name $pycoreServiceName -Force } }
            'restart' { Restart-Service -Name $pycoreServiceName -Force }
        }
    } catch {
        Write-Host ("[!] {0} failed: {1}" -f $Action, $_.Exception.Message) -ForegroundColor Red
        return 1
    }
    if (-not (Wait-PycoreServiceStatus -DesiredStatus $desiredStatus)) {
        Write-Host ("[!] Service {0} did not reach {1}." -f $pycoreServiceName, $desiredStatus) -ForegroundColor Red
        Show-PycoreServiceStatus | Out-Null
        return 1
    }
    Write-Host ("[OK] Service {0}: {1} done." -f $pycoreServiceName, $Action) -ForegroundColor Green
    if ($Action -ne 'stop') { Show-PycoreServiceStatus | Out-Null }
    return 0
}

function Invoke-PycoreServiceCommand {
    param([Parameter(Mandatory = $true)][string]$ServiceCommand)
    $commandExitCode = 1
    switch ($ServiceCommand) {
        'install'   { $commandExitCode = Install-PycoreService }
        'uninstall' { $commandExitCode = Uninstall-PycoreService }
        'status'    { $commandExitCode = Show-PycoreServiceStatus }
        default     { $commandExitCode = Invoke-PycoreServiceControl -Action $ServiceCommand }
    }
    if ($ElevatedRelaunch) { Read-Host 'Press Enter to close this window' | Out-Null }
    return [int]$commandExitCode
}

# Interactive `run`: service absent -> offer the install (default Yes); installed ->
# ensure it is running and report instead of starting a second worker on the same
# port. Returns the process exit code when `run` was fully handled, -1 to continue
# with the foreground worker. Skipped for the service's own run, non-interactive
# sessions, -NoServicePrompt, -Only and relay mode.
function Invoke-PycoreServiceOffer {
    $runState = ''
    $offerExitCode = 0
    if ($NoServicePrompt -or $Only -or ($ServiceMode -ne '1')) { return -1 }
    if (-not (Test-PycoreInteractiveSession)) { return -1 }
    $runState = Get-ServiceRunState -ServiceName $pycoreServiceName
    if ($runState -ne 'absent') {
        if ($runState -eq 'running') {
            Write-Host '[OK] pycore service is already running (.\pyservice.ps1 status).' -ForegroundColor Green
            Show-PycoreServiceStatus | Out-Null
        } else {
            Write-Host '[..] pycore service is installed but not running; starting it ...' -ForegroundColor Yellow
            $offerExitCode = Invoke-PycoreServiceControl -Action 'start'
        }
        Write-Host '[i] Not starting a second foreground worker. Stop it first: .\pyservice.ps1 stop (or use -NoServicePrompt).' -ForegroundColor DarkYellow
        return [int]$offerExitCode
    }
    if (-not (Read-YesNoDefaultYes -Message '[?] Install pycore as a background service?')) {
        Write-Host '[i] Running in the foreground (service not installed).' -ForegroundColor DarkYellow
        return -1
    }
    return [int](Install-PycoreService)
}

# Honor a help token collected by the parameter-library walk above (Show-Usage
# only becomes callable now, after its function definition).
if ($helpRequested) {
    Show-Usage
    return
}

# --------------------------------------------------------------------------- #
# Subcommand dispatch (the optional leading positional $Command).             #
# install|uninstall|start|stop|restart|status manage the Windows service pycore. #
# --------------------------------------------------------------------------- #
switch ($Command.ToLowerInvariant()) {
    { $_ -in @('help', '-h', '--help') } {
        Show-Usage
        return
    }
    'config' {
        $py = Resolve-Python
        if (-not $py) {
            throw "Python 3 was not found; cannot run 'config'."
        }
        $fwd = @()
        if ($Rest) { $fwd = $Rest } elseif ($args) { $fwd = $args }
        Push-Location -LiteralPath $PSScriptRoot
        try {
            & $py.Path -m pycore.pyservice_cli config @fwd
        } finally {
            Pop-Location
        }
        return
    }
    'codesync' {
        # Frozen: Code Sync is retired; repositories sync with `gitsync`. Not updated by refactors unless explicitly requested.
        # Standalone Code Sync. Dispatched here, before any prereq logic: the
        # bootstrap file runs the unified CLI (pycore/pyservice_cli.py); `run`
        # starts the codesync-only RPC host serving the shared route table.
        $py = Resolve-Python
        if (-not $py) {
            throw "Python 3 was not found; cannot run 'codesync'."
        }
        $fwd = @()
        if ($Rest) { $fwd = $Rest } elseif ($args) { $fwd = $args }
        $csSub = ''
        if ($fwd.Count -ge 1) { $csSub = "$($fwd[0])".ToLowerInvariant() }
        # System-service install is systemd-only. On Windows, the bare command and
        # the service ops print a notice + how to run it in the foreground.
        $csServiceOps = @('', 'install', 'uninstall', 'start', 'stop', 'restart', 'status', 'service')
        if ($csServiceOps -contains $csSub) {
            Write-Host '[i] Code Sync system-service install is Linux-only (systemd).' -ForegroundColor Yellow
            Write-Host '    On Windows, run the standalone daemon in the foreground:' -ForegroundColor DarkYellow
            Write-Host '        .\pyservice.ps1 codesync run' -ForegroundColor DarkYellow
            Write-Host '    To auto-start at login, wrap that with Task Scheduler or nssm.' -ForegroundColor DarkYellow
            Write-Host "    View file-sync logs at: D:\programing\Users\$env:USERNAME\.core_node\data\code_sync_logs\" -ForegroundColor DarkYellow
            return
        }
        Push-Location -LiteralPath $PSScriptRoot
        try {
            & $py.Path (Join-Path $PSScriptRoot 'pycore/bootstrap/codesync_boot.py') @fwd
        } finally {
            Pop-Location
        }
        return
    }
    { $_ -in @('colab', 'kaggle') } {
        Write-Host ("[i] '{0}': hosted notebook platforms run on their Linux VM through pyservice.sh." -f $Command) -ForegroundColor Yellow
        Write-Host ("    In a notebook cell: %run <repo>/pycore/bootstrap/notebook_boot.py {0}" -f $Command) -ForegroundColor DarkYellow
        Write-Host ("    then: !bash <repo>/pyservice.sh {0} [--export-identity]" -f $Command) -ForegroundColor DarkYellow
        return
    }
    { $_ -in $pycoreServiceCommands } {
        # `install -Only` keeps the provisioning-only path below; every other form manages the service.
        if (-not (($_ -eq 'install') -and $Only)) {
            $pycoreServiceExitCode = Invoke-PycoreServiceCommand -ServiceCommand $_
            exit $pycoreServiceExitCode
        }
    }
    default {
        # 'run' (or any unrecognized leading token) falls through to the launch path.
    }
}

$pycoreServiceExitCode = Invoke-PycoreServiceOffer
if ($pycoreServiceExitCode -ge 0) { exit $pycoreServiceExitCode }

Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ' Pycore Service - entry point' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan
$uiMode = if ($ServiceMode -eq '2') { 'relay' } elseif ($NoUi) { 'legacy' } else { 'dashboard (pycore-manager)' }
$prerequisiteMode = if ($NoInstall) { 'skipped' } else { 'enabled' }
$ttsSelfcheckMode = if ($TtsSelfcheck -or $env:TTS_STARTUP_SELFCHECK -eq '1') { 'on' } else { 'off' }
Write-Host ("[i] pyservice run - run `".\pyservice.ps1 help`" for all commands (host={0} port={1} mode={2} ui={3} prerequisites={4} tts-selfcheck={5})" -f $BindHost, $Port, $ServiceMode, $uiMode, $prerequisiteMode, $ttsSelfcheckMode) -ForegroundColor DarkGray

$py = Resolve-Python
if (-not $py) {
    throw ("System Python 3.13 was not found at {0}; run Step8_InstallDefaultPython.ps1." -f $Global:PYTHON_EXE_PATH)
}
Ensure-CoreNodePythonPath -LogPrefix '[pyservice]'
Write-Host ("[OK] Python : {0}" -f $py.Version) -ForegroundColor Green
Write-Host ("       path : {0}" -f $py.Path)    -ForegroundColor DarkGray

# Absolute paths resolved from this script's folder (repo root).
$workerPath = Join-Path $PSScriptRoot 'pycore\pycore_module_caller.py'

$uiProc = $null   # React UI server process (stopped in finally)

Push-Location -LiteralPath $PSScriptRoot
try {
    # --- 0) shared client key (signs every Laravel machine call; idempotent) - #
    # Child scope: SecretManager's StrictMode must not leak into this script.
    try {
        & { . $secretManagerPath; Initialize-ClientKeyReady }
    } catch {
        Write-Host ("[SECRET_CLIENT_KEY] Client key check failed: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
    }

    # --- 1) idempotent prerequisites --------------------------------------- #
    $provisionOnly = [bool]$Only

    if ($NoInstall) {
        Write-Host '[i] Skipping all PowerShell prerequisite installers (-NoInstall).' -ForegroundColor DarkYellow
    } else {
        Invoke-PycorePrerequisites -PythonPath $py.Path
    }

    if ($provisionOnly) {
        Write-Host '[OK] Prerequisite step complete.' -ForegroundColor Green
        return
    }

    # --- 2) launch the unified dashboard UI (unless -NoUi) ---------------- #
    # The UI is the pure-Vite shell at poly_apps\pycore_laravel_wordnew_ui. It runs as its
    # own dev server (pnpm); PySide6 loads it via PYCORE_UI_URL, which we export
    # here (pointing at the pycore-manager end) so the worker child inherits it.
    if (-not $NoUi -and $ServiceMode -eq '1') {
        $uiDir = Join-Path $PSScriptRoot 'poly_apps\pycore_laravel_wordnew_ui'
        $uiStartPath = Join-Path (Join-Path $uiDir 'scripts') 'start.ps1'
        $env:PORT = "$UiPort"
        $env:PYCORE_UI_PORT = "$UiPort"
        $env:PYCORE_API_BASE = "http://localhost:$Port"
        $env:PYCORE_UI_URL = "http://localhost:$UiPort/pycore-manager"
        $powerShellPath = (Get-Process -Id $PID).Path
        $uiStartArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $uiStartPath, '-NoBackend', '-NonInteractive', '-Port', "$UiPort")
        if ($UiBuild) { $uiStartArguments = @($uiStartArguments; '-Dist') }
        Write-Host ("[..] Starting dashboard through {0} ..." -f $uiStartPath) -ForegroundColor Yellow
        $uiProc = Start-Process -FilePath $powerShellPath -ArgumentList $uiStartArguments -WorkingDirectory $uiDir -WindowStyle Hidden -PassThru
        Write-Host ("[i] Dashboard start dispatched asynchronously: {0}" -f $env:PYCORE_UI_URL) -ForegroundColor DarkGray
    } elseif ($ServiceMode -eq '2') {
        Write-Host '[i] Relay UI intermediary mode: local dashboard launch is disabled.' -ForegroundColor DarkYellow
    } else {
        Write-Host '[i] -NoUi: using legacy /web/subtitle UI.' -ForegroundColor DarkYellow
    }

    # --- 3) launch the worker -------------------------------------------- #
    $pyArgs = @('-u', $workerPath, '--host', $BindHost, '--port', $Port, '--service-mode', $ServiceMode)
    if ($DebugMode)    { $pyArgs += '--debug' }

    # TTS batch self-check: run the STANDALONE entry as its own process and wait
    # for it to exit BEFORE the worker starts, so the sweep owns the console (no
    # interleaved service logs) and the machine's RAM/VRAM. Failures never block startup.
    if ($TtsSelfcheck -or $env:TTS_STARTUP_SELFCHECK -eq '1') {
        $selfcheckPath = Join-Path $PSScriptRoot 'pycore\pyctl\tts\batch_selfcheck_main.py'
        Write-Host '[>] Running TTS batch self-check (standalone) before the worker...' -ForegroundColor Cyan
        & $py.Path '-u' $selfcheckPath
        if ($LASTEXITCODE -ne 0) {
            Write-Host '[!] TTS self-check reported failures; continuing startup' -ForegroundColor Yellow
        }
        Remove-Item Env:TTS_STARTUP_SELFCHECK -ErrorAction SilentlyContinue   # consumed by the standalone run; the worker must not re-run it
    }

    Write-Host ''
    Write-Host ("[>] Launching worker: {0}" -f $workerPath) -ForegroundColor Cyan
    Write-Host ''
    $env:PORT = "$Port"
    & $py.Path @pyArgs
    $workerExitCode = $LASTEXITCODE
}
finally {
    # Tear down the UI server (npm spawns a node child; /T kills the whole tree).
    if ($uiProc -and -not $uiProc.HasExited) {
        $rpcListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($workerExitCode -eq $workerHandoffExitCode -or $rpcListener) {
            Write-Host ("[i] Worker yielded to a newer instance; leaving UI server running (pid {0})." -f $uiProc.Id) -ForegroundColor DarkYellow
        } else {
            Write-Host ("[..] Stopping UI server (pid {0}) ..." -f $uiProc.Id) -ForegroundColor DarkGray
            & taskkill /PID $uiProc.Id /T /F 2>$null | Out-Null
        }
    }
    Pop-Location
}
