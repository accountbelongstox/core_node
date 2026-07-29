# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using Split-Path, Join-Path, or Resolve-Path.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Chrome MCP Server Startup Script (Windows). Entry script - only responsible for calling Python and executing commands.
# Builds all packages, registers the native host, then launches WXT watch mode for live debugging.

param(
    [switch]$DevOnly,
    [switch]$InstallShortcut
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $PSScriptRoot
$ProjectRoot = $ScriptDir
$VarManagerPath = Join-Path $PSScriptRoot "VarManager.ps1"
$VarKeysPath = Join-Path $PSScriptRoot "VarKeys.ps1"
$PythonScript = Join-Path $PSScriptRoot "build_orchestrator.py"
$PythonExe = $null
$InitialDir = Get-Location

# WXT imports config/queue_center_contract.json from the repository root
# directly. Do not copy the task contract here; wxt.config.ts explicitly allows
# that root so Laravel, Pycore, both UIs, and mcp-chrome read one source.
Set-Location $ProjectRoot
. $VarKeysPath
Import-Module $VarManagerPath -Force

Write-Host ""
Write-Host "========================================"
Write-Host "  Chrome MCP Server - Windows"
Write-Host "========================================"
Write-Host ""

Write-Host "[Python] Processing build configuration..."
Write-Host ""

if ($env:PYTHON_EXE -and (Test-Path -LiteralPath $env:PYTHON_EXE)) {
    $PythonExe = $env:PYTHON_EXE
} else {
    try {
        $cmd = Get-Command python -ErrorAction Stop
        if ($cmd.Source) { $PythonExe = $cmd.Source }
    } catch { }
    if (-not $PythonExe) {
        try {
            $cmd = Get-Command python3 -ErrorAction Stop
            if ($cmd.Source) { $PythonExe = $cmd.Source }
        } catch { }
    }
}
if (-not $PythonExe) {
    Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Run DD.CMD and use Install to install Python, or set PYTHON_EXE to your python.exe path." -ForegroundColor Yellow
    exit 1
}

# Run Python script. Output streams live; we do NOT gate on the exit code.
# Success is judged by whether the build configuration was produced (probed
# right after) and by the build artifacts verified in each step below.
try {
    & $PythonExe $PythonScript
} catch {
    Write-Host "WARNING: Python script raised an error (continuing): $_" -ForegroundColor Yellow
}

$cmdConfigProbe = Get-Var -Key ([VarKeys]::CMD_BUILD_SHARED) -Default ""
if (-not $cmdConfigProbe) {
    Write-Host ""
    Write-Host "WARNING: Build configuration looks incomplete; continuing with defaults." -ForegroundColor Yellow
}

Write-Host ""

# ======================================
# Step 2: Read variables and execute build commands
# ======================================

# Read UI title
$uiTitle = Get-Var -Key ([VarKeys]::UI_TITLE) -Default "Chrome MCP Server Setup"
Write-Host "========================================"
Write-Host "  $uiTitle"
Write-Host "========================================"
Write-Host ""

# Step 1: Check dependencies
$step1 = Get-Var -Key ([VarKeys]::UI_STEP_1) -Default "Checking dependencies..."
Write-Host "[1/6] $step1"

$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "  OK Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Node.js not found" -ForegroundColor Red
    exit 1
}

$pnpmVersion = pnpm --version 2>$null
if ($pnpmVersion) {
    Write-Host "  OK pnpm: v$pnpmVersion" -ForegroundColor Green
} else {
    Write-Host "  ERROR: pnpm not found" -ForegroundColor Red
    exit 1
}

# Step 2: Install dependencies
Write-Host ""
$step2 = Get-Var -Key ([VarKeys]::UI_STEP_2) -Default "Installing dependencies..."
Write-Host "[2/6] $step2"

$shouldInstall = Get-Var -Key ([VarKeys]::SHOULD_INSTALL) -Default "false"
if ($shouldInstall -eq "true") {
    $cmdInstall = Get-Var -Key ([VarKeys]::CMD_INSTALL)
    Write-Host "  Installing dependencies (live output)..." -ForegroundColor Cyan
    Invoke-Expression $cmdInstall
    Write-Host "  OK Dependency install step finished" -ForegroundColor Green
} else {
    Write-Host "  OK Dependencies already installed" -ForegroundColor Green
}

# Ensure Windows .cmd shims exist (pnpm previously run via bash/WSL loses them).
$EnsureWinBinScript = Join-Path $PSScriptRoot "ensure_win_bin.ps1"
Write-Host "  Checking Windows .cmd shims..." -ForegroundColor Cyan
& $EnsureWinBinScript -WorkspaceRoot $ProjectRoot

# Quick compile+install: never block on an interactive prompt so the flow runs
# unattended with continuous live output. Rebuild by default; set
# MCP_SKIP_BUILD=1 to reuse the existing output instead.
$extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)
$manifestJson = Join-Path $extensionPath "manifest.json"
$skipBuild = $false
if ($env:MCP_SKIP_BUILD -eq "1") {
    $skipBuild = $true
    Write-Host "  MCP_SKIP_BUILD=1 set; skipping rebuild, reusing existing output." -ForegroundColor Yellow
} else {
    Write-Host "  Rebuilding (set MCP_SKIP_BUILD=1 to reuse existing output)." -ForegroundColor Cyan
}

if (-not $skipBuild) {
    # Step 3: Build Shared package
    Write-Host ""
    $step3 = Get-Var -Key ([VarKeys]::UI_STEP_3) -Default "Building shared package..."
    Write-Host "[3/6] $step3"

    $cmdBuildShared = Get-Var -Key ([VarKeys]::CMD_BUILD_SHARED)
    Write-Host "  Building chrome-mcp-shared (live output)..." -ForegroundColor Cyan
    Invoke-Expression $cmdBuildShared

    # Verify by artifact, not exit code (a noisy-but-successful build can return
    # nonzero; a real failure leaves the artifact missing).
    $sharedPath = Get-Var -Key ([VarKeys]::SHARED_PATH)
    if ($sharedPath -and (Test-Path $sharedPath)) {
        Write-Host "  OK Shared package built (artifact present)" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Shared build artifact not found at $sharedPath" -ForegroundColor Yellow
    }

    # Step 4: Build Native Server
    Write-Host ""
    $step4 = Get-Var -Key ([VarKeys]::UI_STEP_4) -Default "Building Native Server..."
    Write-Host "[4/6] $step4"

    $cmdBuildNative = Get-Var -Key ([VarKeys]::CMD_BUILD_NATIVE)
    Write-Host "  Building mcp-chrome-bridge (live output)..." -ForegroundColor Cyan
    Invoke-Expression $cmdBuildNative

    # Verify by artifact, not exit code.
    $nativePathProbe = Get-Var -Key ([VarKeys]::NATIVE_PATH) -Default ""
    if ($nativePathProbe -and (Test-Path $nativePathProbe)) {
        Write-Host "  OK Native Server built (artifact present)" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Native Server artifact not found at $nativePathProbe" -ForegroundColor Yellow
    }

    # Step 5: Build Chrome Extension
    Write-Host ""
    $step5 = Get-Var -Key ([VarKeys]::UI_STEP_5) -Default "Building Chrome Extension..."
    Write-Host "[5/6] $step5"

    $cmdBuildExtension = Get-Var -Key ([VarKeys]::CMD_BUILD_EXTENSION)
    $retryMax = [int](Get-Var -Key ([VarKeys]::BUILD_RETRY_MAX) -Default "3")

    $attempt = 1
    while ($attempt -le $retryMax) {
        if ($attempt -gt 1) {
            Write-Host "  Retrying build (attempt $attempt/$retryMax)..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }

        Invoke-Expression $cmdBuildExtension

        $extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)
        $manifestJson = Join-Path $extensionPath "manifest.json"

        if (Test-Path $manifestJson) {
            Write-Host "  OK Chrome Extension built successfully" -ForegroundColor Green
            
            # Verify manifest.json has key field for extension ID calculation
            try {
                $manifestContent = Get-Content $manifestJson -Raw | ConvertFrom-Json
                if (-not $manifestContent.key) {
                    Write-Host "  WARNING: manifest.json does not contain 'key' field" -ForegroundColor Yellow
                    Write-Host "  Extension ID cannot be automatically calculated" -ForegroundColor Yellow
                    Write-Host "  Native host registration may require manual extension ID update" -ForegroundColor Yellow
                } else {
                    Write-Host "  OK manifest.json contains 'key' field for extension ID" -ForegroundColor Green
                }
            } catch {
                Write-Host "  WARNING: Could not verify manifest.json structure" -ForegroundColor Yellow
            }
            break
        }

        $attempt = $attempt + 1
    }

    if ($attempt -gt $retryMax) {
        Write-Host "  ERROR: Failed to build Chrome Extension after $retryMax attempts" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "  Skipped build, using existing output." -ForegroundColor Yellow
}

$nativePath = Get-Var -Key ([VarKeys]::NATIVE_PATH)
if (-not $extensionPath) {
    $extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)
}

# Step 6: Register Native Messaging Host
Write-Host ""
$step6 = Get-Var -Key ([VarKeys]::UI_STEP_6) -Default "Registering Native Messaging Host..."
Write-Host "[6/6] $step6"

# Verify extension manifest exists before registration
$extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)
$manifestJson = Join-Path $extensionPath "manifest.json"

if (-not (Test-Path $manifestJson)) {
    Write-Host "  ERROR: manifest.json not found at $manifestJson" -ForegroundColor Red
    Write-Host "  Cannot register native host without extension ID" -ForegroundColor Red
    exit 1
}

# Verify manifest has key field
try {
    $manifestContent = Get-Content $manifestJson -Raw | ConvertFrom-Json
    if (-not $manifestContent.key) {
        Write-Host "  WARNING: manifest.json does not contain 'key' field" -ForegroundColor Yellow
        Write-Host "  Extension ID cannot be automatically calculated" -ForegroundColor Yellow
        Write-Host "  Native host registration will proceed but may require manual ID update" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  WARNING: Could not verify manifest.json structure" -ForegroundColor Yellow
}

$cmdRegister = Get-Var -Key ([VarKeys]::CMD_REGISTER)
Write-Host "  Registering native messaging host..." -ForegroundColor Cyan
Invoke-Expression $cmdRegister

$manifestPath = Get-Var -Key ([VarKeys]::MANIFEST_PATH)
Write-Host ""
Write-Host "  Registration Verification:"
if (Test-Path $manifestPath) {
    Write-Host "  OK Chrome manifest registered" -ForegroundColor Green
    Write-Host "    Location: $manifestPath" -ForegroundColor DarkGray
    $manifestContent = Get-Content $manifestPath -Raw
    Write-Host "  Manifest content:" -ForegroundColor DarkGray
    Write-Host "  $manifestContent" -ForegroundColor DarkGray
} else {
    Write-Host "  WARNING: Manifest file not found at: $manifestPath" -ForegroundColor Yellow
    Write-Host "  Native messaging host may not work correctly" -ForegroundColor Yellow
}

# Verify Windows registry key
$regKeyPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost"
if (Test-Path $regKeyPath) {
    Write-Host "  OK Windows registry key exists" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Windows registry key not found at: $regKeyPath" -ForegroundColor Yellow
    Write-Host "  Chrome may not be able to discover the native messaging host" -ForegroundColor Yellow
}

# ======================================
# Success Summary
# ======================================
$extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)

Write-Host ""
Write-Host "========================================"
Write-Host "  BUILD & REGISTRATION COMPLETE" -ForegroundColor Green
Write-Host "========================================"

Write-Host ""
Write-Host "[IMPORTANT PATHS]"
Write-Host ""
Write-Host "  1) Chrome Extension (Frontend):"
Write-Host "     $extensionPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2) Native Server (Backend):"
Write-Host "     $nativePath" -ForegroundColor Cyan

# Open .output folder in Windows Explorer (parent of chrome-mv3)
$outputDir = Split-Path -Parent $extensionPath
if (Test-Path $outputDir) {
    Start-Process explorer -ArgumentList ("`"$outputDir`"")
}

Write-Host ""
Write-Host "========================================"
Write-Host "  NEXT STEPS"
Write-Host "========================================"

Write-Host ""
Write-Host "[STEP 1] Load Extension in Chrome (one-time):"
Write-Host "  1. Open Chrome: chrome://extensions/"
Write-Host "  2. Enable Developer mode (top-right toggle)"
Write-Host "  3. Click 'Load unpacked'"
Write-Host "  4. Select folder: $extensionPath" -ForegroundColor Cyan
Write-Host "  Note: keep this folder loaded — WXT dev server writes to the same path"

Write-Host ""
Write-Host "[STEP 2] Connect the MCP Service:"
Write-Host "  1. Click the extension icon in Chrome"
Write-Host "  2. Click Connect button"
Write-Host "  3. Service will start on: http://127.0.0.1:12306" -ForegroundColor Green

Write-Host ""
Write-Host "[STEP 3] Dynamic Debugging (per component):"
Write-Host ""
Write-Host "  POPUP  (apps/chrome-extension/entrypoints/popup/):"
Write-Host "    - Right-click the popup -> Inspect -> DevTools opens"
Write-Host "    - After saving a file: reopen the popup (WXT HMR auto-reloads)"
Write-Host "    - Or press Ctrl+R inside DevTools to force refresh"
Write-Host ""
Write-Host "  BACKGROUND SERVICE WORKER  (entrypoints/background.ts):"
Write-Host "    - Go to chrome://extensions/ -> find the extension -> click 'Service Worker'"
Write-Host "    - After saving a file: click the circular refresh icon on the extension card"
Write-Host "    - WXT triggers an automatic extension reload on rebuild"
Write-Host ""
Write-Host "  CONTENT SCRIPTS  (entrypoints/content.ts / inject-scripts/):"
Write-Host "    - Open the target page -> F12 -> Sources -> Content Scripts tab"
Write-Host "    - After saving a file: refresh the target page (Ctrl+R)"
Write-Host "    - WXT dynamically re-registers content scripts in dev mode"
Write-Host ""
Write-Host "  INSPECT ALL EXTENSION PAGES:"
Write-Host "    - Open: chrome://inspect/#extensions"
Write-Host ""
Write-Host "========================================"
Write-Host "  Launching WXT dev server (watch mode)..." -ForegroundColor Yellow
Write-Host "  File changes trigger automatic rebuilds."
Write-Host "  Press Ctrl+C to stop."
Write-Host "========================================"
Write-Host ""

# Launch WXT dev server — this blocks until the user presses Ctrl+C.
# WXT watches source files and rebuilds to the same output folder,
# so Chrome picks up changes without reloading the extension from a new path.
# try/finally guarantees we return to $InitialDir even when Ctrl+C aborts the pipeline.
$ExtensionSrcDir = Join-Path (Join-Path $ProjectRoot "app") "chrome-extension"
Set-Location $ExtensionSrcDir
try {
    & pnpm run dev
} finally {
    Set-Location $InitialDir
}
