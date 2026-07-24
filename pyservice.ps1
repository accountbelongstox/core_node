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

.PARAMETER SkipVoxcpm2
    Skip VoxCPM2, Bark, and Parler prerequisite installs (sets VOXCPM2_SKIP=1 / BARK_SKIP=1 / PARLER_SKIP=1 for Step58/59/60). Default: install when NEURAL_TTS_INSTALL runs.

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
    .\pyservice.ps1 -SkipVoxcpm2
    Skip VoxCPM2, Bark, and Parler prerequisite installs (Step58/59/60); other neural TTS engines unchanged.

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
# Headless config CLI:  .\pyservice.ps1 config ...  -> python -m pycore.pyutils.pyservice_cli
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
#     - Code-sync role/peers : pycore/pyutils/device_sync/code_sync_peers.json  (committed)
#
# UI vs headless:
#   `run` serves the unified shell poly_apps\pycore_laravel_wordflow_ui (its pycore-manager
#   end) at http://localhost:<UiPort>/pycore-manager, loaded by PySide6 via
#   PYCORE_UI_URL. Backend is rpc_v2 on :59000 with a /pyapi reverse proxy and a
#   direct ws://host:59000/rpc/ws log stream (a global floating collapsible log
#   panel is on every pycore page). The old standalone React app
#   pycore\pyctl\desktop\desktop-manager (dev server :15654) was superseded by the
#   unified shell (poly_apps\pycore_laravel_wordflow_ui) and has been removed.
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
    [switch]$SkipVoxcpm2,
    # Trailing args forwarded to subcommands (e.g. `config ...`, `codesync ...`).
    # Required because [CmdletBinding()] otherwise rejects extra positional args.
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Rest = @()
)

$ErrorActionPreference = 'Stop'

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
    Write-Host '               (forwards args to: python -m pycore.pyutils.pyservice_cli config)'
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
    Write-Host '  -SkipVoxcpm2      Skip VoxCPM2 + Bark + Parler prerequisite installs (Step58/59/60)'
    Write-Host ''
    Write-Host 'Examples:'
    Write-Host '  .\pyservice.ps1'
    Write-Host '  .\pyservice.ps1 install'
    Write-Host '  .\pyservice.ps1 run -NoUi -Port 8000'
    Write-Host '  .\pyservice.ps1 -SkipVoxcpm2'
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
            & $py.Path -m pycore.pyutils.pyservice_cli config @fwd
        } finally {
            Pop-Location
        }
        return
    }
    'codesync' {
        # Standalone, stdlib-only Code Sync. Dispatched here, before any prereq
        # logic, and WITHOUT importing the pycore package: the bootstrap is run as
        # a FILE so `codesync` loads as a top-level name (pycore/__init__.py is
        # never executed, no third_party). See device_sync/CODESYNC_LITE_DESIGN.md.
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
$skipTtsMode = if ($SkipVoxcpm2) { 'voxcpm2+bark+parler skipped' } else { 'default' }
Write-Host ("[i] pyservice run - run `".\pyservice.ps1 help`" for all commands (host={0} port={1} ui={2} skip_tts={3})" -f $BindHost, $Port, $uiMode, $skipTtsMode) -ForegroundColor DarkGray

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
    # --- 1) idempotent prerequisites (always run; each Step*.ps1 is a no-op when satisfied) --- #
    $provisionOnly = ($Command.ToLowerInvariant() -eq 'install') -or $Only

    Write-Host '[i] Installation is idempotent and SELF-REPAIRING: re-running repairs missing artifacts' -ForegroundColor Cyan
    Write-Host '    (installed pip distributions are preserved; incomplete model' -ForegroundColor Cyan
    Write-Host '    weights resume). Safe to re-run any time. See TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md.' -ForegroundColor Cyan
    Write-Host '[..] Running idempotent prerequisite installers (PreparePycorePrerequisites -> Step*.ps1) ...' -ForegroundColor Yellow
    if (-not $env:NEURAL_TTS_INSTALL) { $env:NEURAL_TTS_INSTALL = '1' }
    if ($SkipVoxcpm2) {
        $env:VOXCPM2_SKIP = '1'
        $env:BARK_SKIP = '1'
        $env:PARLER_SKIP = '1'
    }
    & $preparePath

    if ($provisionOnly) {
        Write-Host '[OK] Prerequisite provisioning complete.' -ForegroundColor Green
        return
    }

    # --- 2) launch the unified dashboard UI (unless -NoUi) ---------------- #
    # The UI is the pure-Vite shell at poly_apps\pycore_laravel_wordflow_ui. It runs as its
    # own dev server (pnpm); PySide6 loads it via PYCORE_UI_URL, which we export
    # here (pointing at the pycore-manager end) so the worker child inherits it.
    if (-not $NoUi) {
        $uiDir = Join-Path $PSScriptRoot 'poly_apps\pycore_laravel_wordflow_ui'
        # Prefer pnpm.cmd: Start-Process cannot launch the extensionless pnpm shim.
        $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
        if (-not $pnpm) { $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue }
        if (-not (Test-Path (Join-Path $uiDir 'package.json'))) {
            Write-Host '[i] dashboard UI not found; using legacy /web/subtitle UI.' -ForegroundColor DarkYellow
        } elseif (-not $pnpm) {
            Write-Host '[i] pnpm not on PATH; using legacy /web/subtitle UI.' -ForegroundColor DarkYellow
        } else {
            # Vite reads PORT for its dev-server port; the /pyapi proxy + WS target
            # the running pycore backend via PYCORE_API_BASE.
            $env:PORT            = "$UiPort"
            $env:PYCORE_UI_PORT  = "$UiPort"
            $env:PYCORE_API_BASE = "http://localhost:$Port"
            # Install deps only if missing.
            if (-not (Test-Path (Join-Path $uiDir 'node_modules'))) {
                Write-Host '[..] Installing dashboard deps (pnpm install) ...' -ForegroundColor Yellow
                Push-Location -LiteralPath $uiDir
                try { & $pnpm.Source install } finally { Pop-Location }
            }
            # REUSE a healthy dashboard already serving this port (dev mode only):
            # concurrent starts (boot autostart + manual run) must NOT kill each
            # other's dev server — the loser of the worker singleton would leave
            # the winner's webview with ERR_CONNECTION_REFUSED. Require both the
            # shell HTML and compiled Tailwind CSS (/themes/index.css) so a stale
            # v3/PostCSS Vite process (HTML OK, CSS 500) is never reused.
            $uiReuse = $false
            if (-not $UiBuild) {
                try {
                    $probe = Invoke-WebRequest "http://localhost:$UiPort/pycore-manager" -UseBasicParsing -TimeoutSec 2
                    $cssOk = $false
                    if ($probe.StatusCode -eq 200 -and $probe.Content -match 'Nexus Dash') {
                        try {
                            $cssProbe = Invoke-WebRequest "http://localhost:$UiPort/themes/index.css" -UseBasicParsing -TimeoutSec 5
                            $cssOk = ($cssProbe.StatusCode -eq 200 -and $cssProbe.Content.Length -ge 10000 -and $cssProbe.Content -notmatch '@tailwind\s+(base|components|utilities)')
                        } catch { }
                    }
                    if ($cssOk) { $uiReuse = $true }
                    elseif ($probe.StatusCode -eq 200 -and $probe.Content -match 'Nexus Dash') {
                        Write-Host ("[!] Dashboard on port {0} serves HTML but CSS is broken (stale Vite/PostCSS). Will restart it." -f $UiPort) -ForegroundColor DarkYellow
                    }
                } catch { }
            }
            if ($uiReuse) {
                Write-Host ("[OK] Reusing dashboard dev server already on http://localhost:{0} (not restarting it)" -f $UiPort) -ForegroundColor Green
                # $uiProc stays $null: we don't own this server, so the finally
                # block must not tear it down.
                $env:PYCORE_UI_URL = "http://localhost:$UiPort/pycore-manager"
            } else {
            # Free the UI port FIRST: kill any stale UI server (an old desktop-manager
            # or a prior dashboard) still bound to it — otherwise the webview loads the
            # stale server shadowing this port and the UI "doesn't change".
            Get-NetTCPConnection -LocalPort $UiPort -State Listen -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty OwningProcess -Unique |
                ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
            Start-Sleep -Milliseconds 500
            $uiPortBlocked = Get-NetTCPConnection -LocalPort $UiPort -State Listen -ErrorAction SilentlyContinue
            if ($uiPortBlocked) {
                $blockerPid = ($uiPortBlocked | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -ne 0 } | Select-Object -First 1)
                Write-Host ("[!] Port {0} is still held by pid {1}. End that node.exe (Task Manager) or restart pyservice as the same user that started the old dashboard." -f $UiPort, $blockerPid) -ForegroundColor Red
                $env:PYCORE_UI_URL = "http://localhost:$UiPort/pycore-manager"
            } else {
            if ($UiBuild) {
                Write-Host '[..] Building dashboard UI (pnpm build) ...' -ForegroundColor Yellow
                Push-Location -LiteralPath $uiDir
                try { & $pnpm.Source build } finally { Pop-Location }
                $env:NODE_ENV = 'production'
                $uiProc = Start-Process -FilePath $pnpm.Source -ArgumentList 'exec','vite','preview','--port',"$UiPort",'--strictPort','--host','0.0.0.0' -WorkingDirectory $uiDir -PassThru -WindowStyle Hidden
            } else {
                Write-Host ("[..] Starting dashboard dev server on http://localhost:{0} ..." -f $UiPort) -ForegroundColor Yellow
                # Explicit --port + --strictPort: bind THIS port deterministically rather
                # than silently falling back to a different Vite default, so the webview's
                # PYCORE_UI_URL host always matches the server we just started. (The
                # dashboard's vite.config.ts also defaults to 13054, so a standalone
                # start_dashboard.ps1 / `pnpm dev` lands on the same port.)
                $uiProc = Start-Process -FilePath $pnpm.Source -ArgumentList 'exec','vite','--port',"$UiPort",'--strictPort','--host','0.0.0.0' -WorkingDirectory $uiDir -PassThru -WindowStyle Hidden
            }
            # Default the PySide6 webview to the pycore-manager end of the shell.
            $env:PYCORE_UI_URL = "http://localhost:$UiPort/pycore-manager"
            # Wait (up to ~15s) for the UI to answer before the webview loads it.
            $uiReady = $false
            for ($i = 0; $i -lt 30; $i++) {
                Start-Sleep -Milliseconds 500
                $uiResponse = Invoke-WebRequest "http://localhost:$UiPort/pycore-manager" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($uiResponse -and $uiResponse.StatusCode -eq 200) { $uiReady = $true; break }
            }
            if ($uiReady) { Write-Host ("[OK] UI ready at {0} (pid {1})" -f $env:PYCORE_UI_URL, $uiProc.Id) -ForegroundColor Green }
            else          { Write-Host ("[!] UI not responding yet at {0}; webview may show a connecting page." -f $env:PYCORE_UI_URL) -ForegroundColor DarkYellow }
            }
            }
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
