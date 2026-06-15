<#
.SYNOPSIS
    WebClaude Group - Unified Debug Launcher (Windows)
.DESCRIPTION
    Checks/installs all dependencies, then starts all 4 services in parallel
    using separate PowerShell windows for easy debugging.
.PARAMETER Services
    Optional override (comma-separated). When empty, uses cached role under .data/deploy_role.json (interactive setup on first run).
.PARAMETER SkipChecks
    Skip environment checks and dependency installation
.PARAMETER BuildOnly
    Only build, do not start services
.EXAMPLE
    .\start.ps1                      # Start all services
    .\start.ps1 -Services center,web # Start only center_server and website
    .\start.ps1 -SkipChecks          # Skip checks, start immediately
#>
param(
    [string]$Services = "",
    [switch]$SkipChecks,
    [switch]$BuildOnly
)

# Use Continue so one error doesn't kill the whole script
$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$GroupRoot = Split-Path -Parent $ScriptDir
$DeployWin = Join-Path $ScriptDir "deploy_win"
$CoreNode  = Split-Path -Parent $GroupRoot  # webclaude_group is inside core_node

# ── Deploy role (data dir + cache) ───────────────────────────
$DataDir = if ($env:WEBCLAUDE_DATA_DIR) { $env:WEBCLAUDE_DATA_DIR } else { Join-Path $GroupRoot ".data" }
$null = New-Item -ItemType Directory -Force -Path (Join-Path $DataDir "cache") 2>$null
$DeployPy = Join-Path $ScriptDir "pytools\deploy_role.py"
$DeployPyCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $w = (cmd /c "where $cmd 2>nul" | Select-Object -First 1)
        if ($w -and (Test-Path $w)) { $DeployPyCmd = $cmd; break }
    } catch {}
}

$SelectedServices = @("center", "gateway", "website", "host")
if ($DeployPyCmd -and (Test-Path $DeployPy)) {
    $deployArgs = @($DeployPy, "--data-dir", $DataDir)
    if ($Services) {
        $deployArgs += @("--cli-services", $Services)
    }
    try {
        $jsonText = & $DeployPyCmd @deployArgs
        if ($jsonText) {
            $role = $jsonText | ConvertFrom-Json
            if ($role.data_dir) {
                $env:WEBCLAUDE_DATA_DIR = [string]$role.data_dir
                $DataDir = $env:WEBCLAUDE_DATA_DIR
            }
            if ($role.services) {
                $svc = $role.services
                if ($svc -isnot [System.Array]) { $svc = @($svc) }
                $SelectedServices = [string[]]$svc
            }
        }
    } catch {
        Write-Warn "deploy_role.py failed, using full stack: $_"
    }
} else {
    Write-Warn "Python not found for deploy_role.py; using all services."
}

# ── Colors ──────────────────────────────────────────────────
function Write-Header($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg)     { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg)   { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg)   { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info($msg)   { Write-Host "  [INFO] $msg" -ForegroundColor Gray }

# ── Service Paths ───────────────────────────────────────────
$Paths = @{
    center  = Join-Path $GroupRoot "webclaude_center_server"
    gateway = Join-Path $GroupRoot "webclaude_go-gateway"
    website = Join-Path $GroupRoot "webclaude_website"
    host    = Split-Path -Parent $GroupRoot  # core_node (claude_host is at core_node/pyapps/claude_host)
}

Write-Host ""
Write-Host "  WebClaude Group - Unified Debug Launcher" -ForegroundColor Magenta
Write-Host "  Data: $DataDir" -ForegroundColor Magenta
Write-Host "  Services: $($SelectedServices -join ', ')" -ForegroundColor Magenta
Write-Host ""

# ══════════════════════════════════════════════════════════════
# PHASE 0: Auto-initialize environment (.env, configs, permissions)
# ══════════════════════════════════════════════════════════════

$initScript = Join-Path $ScriptDir "pytools\init_env.py"
if (Test-Path $initScript) {
    # Find python
    $initPy = $null
    foreach ($cmd in @("python", "python3", "py")) {
        $testExe = $null
        try { $testExe = (cmd /c "where $cmd 2>nul" | Select-Object -First 1) } catch {}
        if ($testExe) { $initPy = $cmd; break }
    }
    if ($initPy) {
        $null = cmd /c "$initPy `"$initScript`" 2>&1"
    }
}

# ══════════════════════════════════════════════════════════════
# PHASE 1: Environment Checks
# ══════════════════════════════════════════════════════════════

if (-not $SkipChecks) {
    Write-Header "Phase 1: Environment Checks"
    $phase1Errors = 0

    # ── Node.js ─────────────────────────────────────────────
    if ($SelectedServices -contains "center" -or $SelectedServices -contains "website") {
        $nodeExe = $null
        try { $nodeExe = (cmd /c "where node 2>nul" | Select-Object -First 1) } catch {}
        if ($nodeExe -and (Test-Path $nodeExe)) {
            $nodeVersion = cmd /c "node --version 2>nul"
            if ($nodeVersion -match 'v(\d+)') {
                $major = [int]$Matches[1]
                if ($major -ge 18) {
                    Write-Ok "Node.js $nodeVersion"
                } else {
                    Write-Fail "Node.js $nodeVersion is too old (need >= 18)"
                    Write-Info "Install from https://nodejs.org/"
                    $phase1Errors++
                }
            } else {
                Write-Fail "Node.js version could not be determined"
                $phase1Errors++
            }
        } else {
            Write-Fail "Node.js not found"
            Write-Info "Install from https://nodejs.org/"
            $phase1Errors++
        }
    }

    # ── npm ─────────────────────────────────────────────────
    if ($SelectedServices -contains "center") {
        $npmExe = $null
        try { $npmExe = (cmd /c "where npm 2>nul" | Select-Object -First 1) } catch {}
        if ($npmExe) {
            $npmV = cmd /c "npm --version 2>nul"
            Write-Ok "npm $npmV"
        } else {
            Write-Fail "npm not found"
            $phase1Errors++
        }
    }

    # ── pnpm ────────────────────────────────────────────────
    if ($SelectedServices -contains "website") {
        $pnpmExe = $null
        try { $pnpmExe = (cmd /c "where pnpm 2>nul" | Select-Object -First 1) } catch {}
        if ($pnpmExe) {
            $pnpmV = cmd /c "pnpm --version 2>nul"
            Write-Ok "pnpm $pnpmV"
        } else {
            Write-Warn "pnpm not found, installing..."
            $null = cmd /c "npm install -g pnpm 2>&1"
            # Check again
            $pnpmExe = $null
            try { $pnpmExe = (cmd /c "where pnpm 2>nul" | Select-Object -First 1) } catch {}
            if ($pnpmExe) {
                Write-Ok "pnpm installed"
            } else {
                Write-Fail "pnpm install failed"
                $phase1Errors++
            }
        }
    }

    # ── Go ──────────────────────────────────────────────────
    if ($SelectedServices -contains "gateway") {
        $goExe = $null
        try { $goExe = (cmd /c "where go 2>nul" | Select-Object -First 1) } catch {}
        if ($goExe -and (Test-Path $goExe)) {
            $goVersionStr = cmd /c "go version 2>nul"
            if ($goVersionStr -match 'go(\d+\.\d+)') {
                $goVer = [decimal]$Matches[1]
                if ($goVer -ge 1.24) {
                    Write-Ok "Go $($Matches[1])"
                } else {
                    Write-Fail "Go $($Matches[1]) is too old (need >= 1.24)"
                    $phase1Errors++
                }
            } else {
                Write-Warn "Go found but could not parse version"
            }
        } else {
            Write-Fail "Go not found"
            Write-Info "Install from https://go.dev/dl/"
            $phase1Errors++
        }

        # ── air (hot reload) ──────────────────────────────────
        $airExe = $null
        try { $airExe = (cmd /c "where air 2>nul" | Select-Object -First 1) } catch {}
        if ($airExe) {
            Write-Ok "air found (hot reload enabled for gateway)"
        } else {
            Write-Info "Install air for hot reload: go install github.com/air-verse/air@latest"
        }
    }

    # ── Python ──────────────────────────────────────────────
    if ($SelectedServices -contains "host") {
        $pyCmd = $null
        foreach ($cmd in @("python", "python3", "py")) {
            $pyExe = $null
            try { $pyExe = (cmd /c "where $cmd 2>nul" | Select-Object -First 1) } catch {}
            if ($pyExe -and (Test-Path $pyExe)) {
                $pyV = cmd /c "$cmd --version 2>nul"
                if ($pyV -match 'Python (\d+\.\d+)') {
                    $pyCmd = $cmd
                    Write-Ok "$cmd $($Matches[0])"
                    break
                }
            }
        }
        if (-not $pyCmd) {
            Write-Fail "Python not found"
            Write-Info "Install from https://python.org/"
            $phase1Errors++
        } else {
            # Check websockets module by testing import via cmd /c
            $null = cmd /c "$pyCmd -c `"import websockets`" 2>&1"
            # Check by trying to import - if it fails, the output contains "Error"
            $wsTest = cmd /c "$pyCmd -c `"import websockets; print('OK')`" 2>nul"
            if ($wsTest -eq "OK") {
                Write-Ok "Python websockets module"
            } else {
                Write-Warn "Python websockets not installed, installing..."
                $reqFile = Join-Path $Paths.host "pyapps\claude_host\requirements.txt"
                if (Test-Path $reqFile) {
                    $null = cmd /c "$pyCmd -m pip install -r `"$reqFile`" 2>&1"
                    # Verify
                    $wsTest2 = cmd /c "$pyCmd -c `"import websockets; print('OK')`" 2>nul"
                    if ($wsTest2 -eq "OK") {
                        Write-Ok "websockets installed"
                    } else {
                        Write-Fail "websockets install failed"
                        Write-Info "Run manually: $pyCmd -m pip install -r $reqFile"
                        $phase1Errors++
                    }
                } else {
                    Write-Fail "requirements.txt not found at $reqFile"
                    $phase1Errors++
                }
            }
        }
    }

    # ── Hot-Reload Tools (optional) ──────────────────────────
    if ($SelectedServices -contains "center") {
        $nodemonExe = $null
        try { $nodemonExe = (cmd /c "where nodemon 2>nul" | Select-Object -First 1) } catch {}
        if ($nodemonExe) {
            Write-Ok "nodemon found (center_server hot-reload)"
        } else {
            Write-Warn "nodemon not found (center_server will use npx nodemon, slower first start)"
            Write-Info "Install nodemon: npm i -g nodemon"
        }
    }

    if ($SelectedServices -contains "host" -and $pyCmd) {
        # watchdog is installed via requirements.txt in Python check above
        $wdTest = cmd /c "$pyCmd -c `"import watchdog; print('OK')`" 2>nul"
        if ($wdTest -eq "OK") {
            Write-Ok "Python watchdog module (claude_host hot-reload)"
        } else {
            Write-Warn "Python watchdog not found (claude_host will run without hot-reload)"
            Write-Info "Install: $pyCmd -m pip install watchdog"
        }
    }

    # ── MySQL ───────────────────────────────────────────────
    if ($SelectedServices -contains "center" -or $SelectedServices -contains "gateway") {
        # Load .env for DB config
        $envFile = Join-Path $Paths.center ".env"
        $dbHost = "127.0.0.1"; $dbPort = 3306
        if (Test-Path $envFile) {
            Get-Content $envFile | ForEach-Object {
                if ($_ -match '^\s*DB_HOST\s*=\s*(.+)') { $dbHost = $Matches[1].Trim() }
                if ($_ -match '^\s*DB_PORT\s*=\s*(\d+)') { $dbPort = [int]$Matches[1] }
            }
        }

        $dbType = "mysql"
        if (Test-Path $envFile) {
            Get-Content $envFile | ForEach-Object {
                if ($_ -match '^\s*DB_TYPE\s*=\s*(.+)') { $dbType = $Matches[1].Trim().ToLower() }
            }
        }

        if ($dbType -eq "sqlite") {
            Write-Ok "Database: SQLite mode (no MySQL needed)"
        } else {
            $tcpOk = $false
            try {
                $tcp = New-Object System.Net.Sockets.TcpClient
                $tcp.Connect($dbHost, $dbPort)
                $tcp.Close()
                $tcpOk = $true
            } catch {}

            if ($tcpOk) {
                Write-Ok "MySQL reachable at ${dbHost}:${dbPort}"
            } else {
                Write-Warn "MySQL not reachable at ${dbHost}:${dbPort}"
                $installer = Join-Path $DeployWin "install-mysql.ps1"
                if (Test-Path $installer) {
                    Write-Info "Running MySQL auto-installer..."
                    & $installer
                } else {
                    Write-Fail "MySQL installer not found at $installer"
                    $phase1Errors++
                }
            }
        }
    }

    # ── Redis ───────────────────────────────────────────────
    if ($SelectedServices -contains "center" -or $SelectedServices -contains "gateway") {
        $envFile = Join-Path $Paths.center ".env"
        $redisHost = "127.0.0.1"; $redisPort = 6379
        if (Test-Path $envFile) {
            Get-Content $envFile | ForEach-Object {
                if ($_ -match '^\s*REDIS_HOST\s*=\s*(.+)') { $redisHost = $Matches[1].Trim() }
                if ($_ -match '^\s*REDIS_PORT\s*=\s*(\d+)') { $redisPort = [int]$Matches[1] }
            }
        }

        $tcpOk = $false
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect($redisHost, $redisPort)
            $tcp.Close()
            $tcpOk = $true
        } catch {}

        if ($tcpOk) {
            Write-Ok "Redis reachable at ${redisHost}:${redisPort}"
        } else {
            Write-Warn "Redis not reachable at ${redisHost}:${redisPort} (optional, running in degraded mode)"
            Write-Info "Start Redis for full functionality"
        }
    }

    Write-Host ""
    if ($phase1Errors -gt 0) {
        Write-Fail "$phase1Errors environment check(s) failed"
        $answer = Read-Host "  Continue anyway? (y/N)"
        if ($answer -ne "y" -and $answer -ne "Y") {
            Write-Host "  Aborted." -ForegroundColor Red
            return
        }
    } else {
        Write-Ok "All environment checks passed!"
    }
}

# ══════════════════════════════════════════════════════════════
# PHASE 2: Build / Install Dependencies
# ══════════════════════════════════════════════════════════════

Write-Header "Phase 2: Build & Install"

# ── Center Server: npm install ──────────────────────────────
if ($SelectedServices -contains "center") {
    $centerDir = $Paths.center
    $nodeModules = Join-Path $centerDir "node_modules"

    # Ensure .env exists
    $envFile = Join-Path $centerDir ".env"
    if (-not (Test-Path $envFile)) {
        $example = Join-Path $centerDir ".env.example"
        if (Test-Path $example) {
            Copy-Item $example $envFile
            Write-Info "center_server: .env created from .env.example"
        }
    }

    # Ensure config/config.js exists
    $configJs = Join-Path $centerDir "config\config.js"
    if (-not (Test-Path $configJs)) {
        $configExample = Join-Path $centerDir "config\config.example.js"
        if (Test-Path $configExample) {
            Copy-Item $configExample $configJs
            Write-Info "center_server: config.js created from config.example.js"
        }
    }

    if (Test-Path $nodeModules) {
        Write-Ok "center_server: node_modules already exists"
    } else {
        Write-Info "center_server: npm install..."
        # Redirect stderr via cmd /c to avoid PowerShell NativeCommandError
        $null = cmd /c "cd /d `"$centerDir`" && npm install --no-audit --no-fund 2>&1"
        if (Test-Path $nodeModules) {
            Write-Ok "center_server: dependencies installed"
        } else {
            Write-Fail "center_server: npm install failed"
            Write-Info "Run manually: cd $centerDir && npm install"
        }
    }
}

# ── Gateway: go build ───────────────────────────────────────
if ($SelectedServices -contains "gateway") {
    $gatewayDir = $Paths.gateway
    $binary = Join-Path $gatewayDir "relay-api.exe"

    # Ensure .env exists
    $envFile = Join-Path $gatewayDir ".env"
    if (-not (Test-Path $envFile)) {
        $example = Join-Path $gatewayDir ".env.example"
        if (Test-Path $example) {
            Copy-Item $example $envFile
            Write-Info "go-gateway: .env created from .env.example"
        }
    }

    # Fix GOROOT if it points to bin/ instead of Go root
    $goRoot = cmd /c "go env GOROOT 2>nul"
    if ($goRoot -and (Test-Path (Join-Path $goRoot "bin\go.exe")) -and -not (Test-Path (Join-Path $goRoot "src\runtime"))) {
        $fixedRoot = Split-Path -Parent $goRoot
        if (Test-Path (Join-Path $fixedRoot "src\runtime")) {
            Write-Warn "GOROOT=$goRoot is incorrect, fixing to $fixedRoot"
            $env:GOROOT = $fixedRoot
        }
    }
    # Fix GOPROXY if empty
    $goProxy = cmd /c "go env GOPROXY 2>nul"
    if (-not $goProxy -or $goProxy -eq "off" -or $goProxy -eq ",") {
        $env:GOPROXY = "https://proxy.golang.org,direct"
    }
    $env:GONOSUMCHECK = "*"
    $env:GONOSUMDB = "*"

    # Check if air is available; if so, skip pre-build (air handles build + watch)
    $airExe = $null
    try { $airExe = (cmd /c "where air 2>nul" | Select-Object -First 1) } catch {}
    if ($airExe) {
        Write-Ok "go-gateway: air detected, skipping pre-build (air will build on start)"
    } else {
        # No air - always rebuild (source code may have changed)
        Write-Info "go-gateway: building..."
        $null = cmd /c "cd /d `"$gatewayDir`" && go build -trimpath -ldflags `"-s -w`" -o relay-api.exe ./cmd/relay-api 2>&1"
        if (Test-Path $binary) {
            Write-Ok "go-gateway: built relay-api.exe"
        } else {
            Write-Fail "go-gateway: build failed"
            Write-Info "Run manually: cd $gatewayDir && go build -o relay-api.exe ./cmd/relay-api"
        }
    }
}

# ── Website: pnpm install ───────────────────────────────────
if ($SelectedServices -contains "website") {
    $websiteDir = $Paths.website
    $nodeModules = Join-Path $websiteDir "node_modules"
    if (Test-Path $nodeModules) {
        Write-Ok "website: node_modules already exists"
    } else {
        Write-Info "website: pnpm install..."
        $null = cmd /c "cd /d `"$websiteDir`" && pnpm install --no-frozen-lockfile 2>&1"
        if (Test-Path $nodeModules) {
            Write-Ok "website: dependencies installed"
        } else {
            Write-Fail "website: pnpm install failed"
            Write-Info "Run manually: cd $websiteDir && pnpm install"
        }
    }
}

if ($BuildOnly) {
    Write-Host ""
    Write-Ok "Build complete. Use without -BuildOnly to start services."
    return
}

# ══════════════════════════════════════════════════════════════
# PHASE 3: Start All Services (Parallel Windows)
# ══════════════════════════════════════════════════════════════

Write-Header "Phase 3: Starting Services [via sub-scripts]"

$launched = @()

# Each project has its own start.ps1 script.
# This unified launcher just calls them in order via Start-Process (parallel windows).
# Start order: center (wait until ready) -> gateway -> website -> host

# ── 1. Center Server (FIRST - others depend on it) ──────────────
if ($SelectedServices -contains "center") {
    $centerScript = Join-Path $Paths.center "scripts\start.ps1"
    $title = "WebClaude Center Server"
    if (Test-Path $centerScript) {
        Start-Process powershell -ArgumentList @(
            "-NoExit", "-Command",
            "`$Host.UI.RawUI.WindowTitle = '$title'; & '$centerScript'"
        )
    } else {
        # Fallback: direct node
        Start-Process powershell -ArgumentList @(
            "-NoExit", "-Command",
            "Set-Location '$($Paths.center)'; `$Host.UI.RawUI.WindowTitle = '$title'; node src/control/app.js"
        )
    }
    $launched += $title
    Write-Ok "Started: $title"

    # Wait for center_server to be ready (TCP check on port 18100)
    Write-Info "Waiting for center_server to be ready..."
    $maxWait = 30
    $waited = 0
    $centerReady = $false
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waited += 2
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 18100)
            $tcp.Close()
            $centerReady = $true
        } catch {}
        if ($centerReady) { break }
        Write-Host "." -NoNewline
    }
    Write-Host ""
    if ($centerReady) {
        Write-Ok "center_server is ready (${waited}s)"
    } else {
        Write-Warn "center_server may not be ready yet (waited ${maxWait}s)"
    }
}

# ── 2. Go Gateway (after center is ready) ────────────────────────
if ($SelectedServices -contains "gateway") {
    $gwScript = Join-Path $Paths.gateway "scripts\start.ps1"
    $title = "WebClaude Go Gateway"
    if (Test-Path $gwScript) {
        Start-Process powershell -ArgumentList @(
            "-NoExit", "-Command",
            "`$Host.UI.RawUI.WindowTitle = '$title'; & '$gwScript'"
        )
    } else {
        Start-Process powershell -ArgumentList @(
            "-NoExit", "-Command",
            "Set-Location '$($Paths.gateway)'; `$Host.UI.RawUI.WindowTitle = '$title'; .\relay-api.exe"
        )
    }
    $launched += $title
    Write-Ok "Started: $title"
}

# ── 3. Website (parallel, no dependency) ─────────────────────────
if ($SelectedServices -contains "website") {
    $webScript = Join-Path $Paths.website "scripts\start.ps1"
    $title = "WebClaude Website"
    if (Test-Path $webScript) {
        Start-Process powershell -ArgumentList @(
            "-NoExit", "-Command",
            "`$Host.UI.RawUI.WindowTitle = '$title'; & '$webScript'"
        )
    } else {
        Start-Process powershell -ArgumentList @(
            "-NoExit", "-Command",
            "Set-Location '$($Paths.website)'; `$Host.UI.RawUI.WindowTitle = '$title'; pnpm run dev"
        )
    }
    $launched += $title
    Write-Ok "Started: $title"
}

# ── 4. Claude Host (after gateway) ──────────────────────────────
if ($SelectedServices -contains "host") {
    $hostScript = Join-Path $Paths.host "pyapps\claude_host\scripts\start.ps1"
    $title = "WebClaude Claude Host"
    if (Test-Path $hostScript) {
        Start-Process powershell -ArgumentList @(
            "-NoExit", "-Command",
            "`$Host.UI.RawUI.WindowTitle = '$title'; & '$hostScript' --dev"
        )
    } else {
        # Fallback: prefer the watchdog dev-reload wrapper for hot reload parity
        if (-not $pyCmd) { $pyCmd = "python" }
        $hostReload = Join-Path $Paths.host "pyapps\claude_host\scripts\dev_reload.py"
        if (Test-Path $hostReload) {
            Start-Process powershell -ArgumentList @(
                "-NoExit", "-Command",
                "Set-Location '$($Paths.host)'; `$Host.UI.RawUI.WindowTitle = '$title'; $pyCmd -u pyapps\claude_host\scripts\dev_reload.py"
            )
        } else {
            Start-Process powershell -ArgumentList @(
                "-NoExit", "-Command",
                "Set-Location '$($Paths.host)'; `$Host.UI.RawUI.WindowTitle = '$title'; $pyCmd -u pymain.py app=claude_host"
            )
        }
    }
    $launched += $title
    Write-Ok "Started: $title"
}

# ══════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════

Write-Host ""
Write-Header "All Services Launched"
Write-Host ""
$launched | ForEach-Object { Write-Host "  -> $_" -ForegroundColor Green }
Write-Host ""
Write-Host "  Ports:" -ForegroundColor Gray
Write-Host "    Center Server : http://localhost:18100 (nodemon hot-reload)" -ForegroundColor Gray
Write-Host "    Go Gateway    : http://localhost:18200 (air hot-reload if installed)" -ForegroundColor Gray
Write-Host "    Website       : http://localhost:18300 (Vite HMR)" -ForegroundColor Gray
Write-Host "    Claude Host   : WebSocket to gateway (watchdog hot-reload if available)" -ForegroundColor Gray
Write-Host ""
Write-Host "  All services run in hot-reload mode: edit code and changes apply automatically." -ForegroundColor Green
Write-Host "  Press Ctrl+C in each window to stop individual services." -ForegroundColor Yellow
Write-Host ""
