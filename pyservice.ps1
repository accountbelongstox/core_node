<#
.SYNOPSIS
    Service entry point for the Pycore Module Caller (Windows / PowerShell).

.DESCRIPTION
    `pyservice.ps1` is ONLY an entry point. It does two things, in order:

        1. PREREQUISITES (idempotent): default `run` always runs
           PreparePycorePrerequisites (Step*.ps1 installers skip when already satisfied).
           Orchestration lives in scripts\shells\win\main_powershells\PreparePycorePrerequisites.ps1.
           Use `install` / `-Only` to provision without launching
           the worker. The main worker uses system Python 3.13; incompatible TTS
           subprocesses use pre-built, engine-specific isolated environments.

        2. LAUNCH: starts pycore\pycore_module_caller.py (the real worker, which
           now lives inside the pycore package, not at the repo root).

    Prerequisites and the worker are invoked through absolute paths resolved from
    this script's own folder, so the repo can live anywhere.

.PARAMETER BindHost
    Host the RPC v2 server binds to. Default: 0.0.0.0

.PARAMETER Port
    Port the RPC v2 server binds to. Default: 59000

.PARAMETER DebugMode
    Enable the worker's debug mode. (Named -DebugMode because -Debug is a reserved
    PowerShell common parameter.)

.PARAMETER NoReload
    Disable backend hot-reload. By default a watcher polls the pycore package's
    .py files and restarts the backend (via request_restart -> os.execv re-exec)
    on any change. Pairs with the Vite UI HMR so both layers reload on save.

.PARAMETER Only
    Run ONLY the idempotent prerequisite step and exit (do not launch the worker).

.EXAMPLE
    .\pyservice.ps1
    Idempotent prerequisites, then launch on 0.0.0.0:59000.

.PARAMETER NoUi
    Do not launch the unified dashboard UI; the PySide6 webview falls back to the
    legacy in-process /web/subtitle page.

.PARAMETER UiBuild
    Build the dashboard UI (vite build) and serve the production bundle (vite
    preview) instead of running the Vite dev server. No live-reload.

.PARAMETER UiPort
    Port the UI server listens on (PySide6 loads it). Default: 13054.

.PARAMETER NoInstall
    Skip all PowerShell prerequisite installers and launch the service directly.

.EXAMPLE
    .\pyservice.ps1 install
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
# Subcommands: run (default) | config | help. The systemd service subcommands   #
# (install/start/stop/restart/status/uninstall) are Linux-only; on Windows they #
# print a notice -> use the desktop UI's Settings -> Auto-start on boot toggle   #
# (a native .lnk in the common Startup folder) instead. `config` is cross-platform.
#
# Headless config CLI:  .\pyservice.ps1 config ...  -> python -m pycore.pyctl.pyservice_cli
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
    [string]$BindHost = '0.0.0.0',
    [int]   $Port     = 59000,
    [switch]$DebugMode,
    [switch]$NoReload,
    [switch]$Only,
    [switch]$NoUi,
    [switch]$UiBuild,
    [int]$UiPort = 13054,
    [switch]$NoInstall,
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
$uiResponse = $null
$powerShellPath = $null
$uiStartPath = $null
$uiStartArguments = @()
$prepareArgs = @{}

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
    Write-Host '  .\pyservice.ps1 [SUBCOMMAND] [-Param value ...]'
    Write-Host ''
    Write-Host 'Subcommands:'
    Write-Host '  run          Idempotent prerequisites, then launch (default)'
    Write-Host '  install      Run idempotent PreparePycorePrerequisites then exit'
    Write-Host '  config       Edit/show headless config via the cross-platform Python CLI'
    Write-Host '               (forwards args to: python -m pycore.pyctl.pyservice_cli config)'
    Write-Host '  install-svc  systemd service install is Linux-only (prints a notice on Windows)'
    Write-Host '  start        Linux-only (notice on Windows)'
    Write-Host '  stop         Linux-only (notice on Windows)'
    Write-Host '  restart      Linux-only (notice on Windows)'
    Write-Host '  status       Linux-only (notice on Windows)'
    Write-Host '  uninstall    Linux-only (notice on Windows)'
    Write-Host '  help         Show this help (also -h / --help)'
    Write-Host ''
    Write-Host 'Parameters (apply to run):'
    Write-Host '  -BindHost HOST    Host the RPC v2 server binds to (default: 0.0.0.0)'
    Write-Host '  -Port PORT        Port the RPC v2 server binds to (default: 59000)'
    Write-Host '  -DebugMode        Enable the worker''s debug mode'
    Write-Host '  -NoReload         Disable backend hot-reload (watch .py -> restart; ON by default)'
    Write-Host '  -Only             Provision only (idempotent install), then exit'
    Write-Host '  -NoUi             Do not launch the dashboard UI; use legacy /web/subtitle'
    Write-Host '  -UiBuild          Build the dashboard UI and serve it (vite preview)'
    Write-Host '  -UiPort PORT      Port the UI server listens on (default: 13054)'
    Write-Host '  -NoInstall        Skip all PowerShell prerequisite installers'
    Write-Host '  -InstallInclude   Run only named prerequisite entries'
    Write-Host '  -InstallWhisperModel       Select the openai-whisper model'
    Write-Host '  -InstallFasterWhisperModel Select the faster-whisper model'
    Write-Host '  -InstallVoskModel          Select auto, small, or large for Vosk'
    Write-Host '  -InstallFull      Pass Full to installers that support it'
    Write-Host '  -InstallForce     Pass Force to installers that support it'
    Write-Host ''
    Write-Host 'Examples:'
    Write-Host '  .\pyservice.ps1'
    Write-Host '  .\pyservice.ps1 install'
    Write-Host '  .\pyservice.ps1 run -NoUi -Port 8000'
    Write-Host '  .\pyservice.ps1 -NoInstall'
    Write-Host '  .\pyservice.ps1 config -show'
}

# --------------------------------------------------------------------------- #
# Subcommand dispatch (the optional leading positional $Command).             #
# Service subcommands are Linux-only; on Windows we print a notice.           #
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
            & $py.Path -m pycore.pyctl.pyservice_cli config @fwd
        } finally {
            Pop-Location
        }
        return
    }
    'codesync' {
        # Standalone, stdlib-only Code Sync. Dispatched here, before any prereq
        # logic, and WITHOUT importing the pycore package: the bootstrap is run as
        # a FILE so `codesync` loads as a top-level name (pycore/__init__.py is
        # never executed, no third_party). See pycore/pyutils/codesync/runtime.py.
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
            & $py.Path (Join-Path $PSScriptRoot 'pycore/pyutils/codesync_boot.py') @fwd
        } finally {
            Pop-Location
        }
        return
    }
    { $_ -in @('start', 'stop', 'restart', 'status', 'uninstall', 'service-install') } {
        Write-Host ("[i] '{0}': systemd service install/management is Linux-only." -f $Command) -ForegroundColor Yellow
        Write-Host '    On Windows, use the Settings -> Auto-start toggle to run pycore at login,' -ForegroundColor DarkYellow
        Write-Host '    and `.\pyservice.ps1 config` to manage headless configuration.' -ForegroundColor DarkYellow
        Write-Host '    To provision Python prerequisites on Windows: `.\pyservice.ps1 install`' -ForegroundColor DarkYellow
        return
    }
    default {
        # 'run' (or any unrecognized leading token) falls through to the launch path.
    }
}

Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ' Pycore Service - entry point' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan
$uiMode = if ($NoUi) { 'legacy' } else { 'dashboard (pycore-manager)' }
$prerequisiteMode = if ($NoInstall) { 'skipped' } else { 'enabled' }
Write-Host ("[i] pyservice run - run `".\pyservice.ps1 help`" for all commands (host={0} port={1} ui={2} prerequisites={3})" -f $BindHost, $Port, $uiMode, $prerequisiteMode) -ForegroundColor DarkGray

$py = Resolve-Python
if (-not $py) {
    throw ("System Python 3.13 was not found at {0}; run Step8_InstallPython.ps1." -f $Global:PYTHON_EXE_PATH)
}
Ensure-CoreNodePythonPath -LogPrefix '[pyservice]'
Write-Host ("[OK] Python : {0}" -f $py.Version) -ForegroundColor Green
Write-Host ("       path : {0}" -f $py.Path)    -ForegroundColor DarkGray

# Absolute paths resolved from this script's folder (repo root).
$preparePath = Join-Path $PSScriptRoot 'scripts\shells\win\main_powershells\PreparePycorePrerequisites.ps1'
$workerPath = Join-Path $PSScriptRoot 'pycore\pycore_module_caller.py'

$uiProc = $null   # React UI server process (stopped in finally)

Push-Location -LiteralPath $PSScriptRoot
try {
    # --- 1) idempotent prerequisites --------------------------------------- #
    $provisionOnly = ($Command.ToLowerInvariant() -eq 'install') -or $Only

    if ($NoInstall) {
        Write-Host '[i] Skipping all PowerShell prerequisite installers (-NoInstall).' -ForegroundColor DarkYellow
    } else {
        Write-Host '[i] Installation is idempotent and SELF-REPAIRING: re-running repairs missing artifacts' -ForegroundColor Cyan
        Write-Host '    (installed pip distributions are preserved; incomplete model' -ForegroundColor Cyan
        Write-Host '    weights resume). Safe to re-run any time. See TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md.' -ForegroundColor Cyan
        Write-Host '[..] Running idempotent prerequisite installers (PreparePycorePrerequisites -> Step*.ps1) ...' -ForegroundColor Yellow
        if (-not $env:NEURAL_TTS_INSTALL) { $env:NEURAL_TTS_INSTALL = '1' }
        $prepareArgs = @{ Python = $py.Path }
        if ($InstallInclude.Count -gt 0) { $prepareArgs['Include'] = $InstallInclude }
        if ($InstallWhisperModel) { $prepareArgs['WhisperModel'] = $InstallWhisperModel }
        if ($InstallFasterWhisperModel) { $prepareArgs['FasterWhisperModel'] = $InstallFasterWhisperModel }
        if ($InstallVoskModel) { $prepareArgs['VoskModel'] = $InstallVoskModel }
        if ($InstallFull) { $prepareArgs['Full'] = $true }
        if ($InstallForce) { $prepareArgs['Force'] = $true }
        & $preparePath @prepareArgs
    }

    if ($provisionOnly) {
        Write-Host '[OK] Prerequisite step complete.' -ForegroundColor Green
        return
    }

    # --- 2) launch the unified dashboard UI (unless -NoUi) ---------------- #
    # The UI is the pure-Vite shell at poly_apps\pycore_laravel_wordnew_ui. It runs as its
    # own dev server (pnpm); PySide6 loads it via PYCORE_UI_URL, which we export
    # here (pointing at the pycore-manager end) so the worker child inherits it.
    if (-not $NoUi) {
        $uiDir = Join-Path $PSScriptRoot 'poly_apps\pycore_laravel_wordnew_ui'
        $uiStartPath = Join-Path (Join-Path $uiDir 'scripts') 'start.ps1'
        if (-not (Test-Path -LiteralPath $uiStartPath)) {
            Write-Host '[i] dashboard start.ps1 not found; using legacy /web/subtitle UI.' -ForegroundColor DarkYellow
        } else {
            $env:PORT = "$UiPort"
            $env:PYCORE_UI_PORT = "$UiPort"
            $env:PYCORE_API_BASE = "http://localhost:$Port"
            $env:PYCORE_UI_URL = "http://localhost:$UiPort/pycore-manager"
            $powerShellPath = (Get-Process -Id $PID).Path
            $uiStartArguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $uiStartPath, '-NoBackend', '-NonInteractive', '-Port', "$UiPort")
            if ($UiBuild) { $uiStartArguments = @($uiStartArguments; '-Dist') }
            Write-Host ("[..] Starting dashboard through {0} ..." -f $uiStartPath) -ForegroundColor Yellow
            Start-Process -FilePath $powerShellPath -ArgumentList $uiStartArguments -WorkingDirectory $uiDir -WindowStyle Hidden | Out-Null
            Write-Host ("[i] Dashboard start dispatched asynchronously: {0}" -f $env:PYCORE_UI_URL) -ForegroundColor DarkGray
        }
    } else {
        Write-Host '[i] -NoUi: using legacy /web/subtitle UI.' -ForegroundColor DarkYellow
    }

    # --- 3) launch the worker -------------------------------------------- #
    $pyArgs = @('-u', $workerPath, '--host', $BindHost, '--port', $Port)
    if ($DebugMode) { $pyArgs += '--debug' }
    if ($NoReload)  { $pyArgs += '--no-reload' }   # hot-reload is the default; opt out for headless prod

    Write-Host ''
    Write-Host ("[>] Launching worker: {0}" -f $workerPath) -ForegroundColor Cyan
    Write-Host ''
    $env:PORT = "$Port"
    & $py.Path @pyArgs
}
finally {
    # Tear down the UI server (npm spawns a node child; /T kills the whole tree).
    if ($uiProc -and -not $uiProc.HasExited) {
        $rpcListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($rpcListener) {
            Write-Host ("[i] Worker yielded to a newer instance; leaving UI server running (pid {0})." -f $uiProc.Id) -ForegroundColor DarkYellow
        } else {
            Write-Host ("[..] Stopping UI server (pid {0}) ..." -f $uiProc.Id) -ForegroundColor DarkGray
            & taskkill /PID $uiProc.Id /T /F 2>$null | Out-Null
        }
    }
    Pop-Location
}
