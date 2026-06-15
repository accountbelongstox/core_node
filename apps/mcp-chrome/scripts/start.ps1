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

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $PSScriptRoot
$ProjectRoot = $ScriptDir
$VarManagerPath = Join-Path $PSScriptRoot "VarManager.ps1"
$VarKeysPath = Join-Path $PSScriptRoot "VarKeys.ps1"
$PythonScript = Join-Path $PSScriptRoot "build_orchestrator.py"
$PythonExe = $null
$InitialDir = Get-Location

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

# Run Python script
try {
    & $PythonExe $PythonScript
    if ($LASTEXITCODE -ne 0) {
        $error = Get-Var -Key ([VarKeys]::ERROR) -Default "Unknown error"
        Write-Host ""
        Write-Host "ERROR: Python processing failed: $error" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Failed to run Python script: $_" -ForegroundColor Red
    exit 1
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
    Write-Host "  Installing dependencies..." -ForegroundColor Cyan
    Invoke-Expression $cmdInstall
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  OK Dependencies already installed" -ForegroundColor Green
}

# Check if extension already built, prompt to continue or skip
$extensionPath = Get-Var -Key ([VarKeys]::EXTENSION_PATH)
$manifestJson = Join-Path $extensionPath "manifest.json"
$skipBuild = $false
if (Test-Path $manifestJson) {
    $response = Read-Host "  Already built. Rebuild? [Y/n]"
    if ($response -eq 'n' -or $response -eq 'N') {
        $skipBuild = $true
    }
}

if (-not $skipBuild) {
    # Step 3: Build Shared package
    Write-Host ""
    $step3 = Get-Var -Key ([VarKeys]::UI_STEP_3) -Default "Building shared package..."
    Write-Host "[3/6] $step3"

    $cmdBuildShared = Get-Var -Key ([VarKeys]::CMD_BUILD_SHARED)
    Write-Host "  Building chrome-mcp-shared..." -ForegroundColor Cyan
    Invoke-Expression $cmdBuildShared
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to build shared package" -ForegroundColor Red
        exit 1
    }

    $sharedPath = Get-Var -Key ([VarKeys]::SHARED_PATH)
    if (Test-Path $sharedPath) {
        Write-Host "  OK Shared package built successfully" -ForegroundColor Green
    }

    # Step 4: Build Native Server
    Write-Host ""
    $step4 = Get-Var -Key ([VarKeys]::UI_STEP_4) -Default "Building Native Server..."
    Write-Host "[4/6] $step4"

    $cmdBuildNative = Get-Var -Key ([VarKeys]::CMD_BUILD_NATIVE)
    Write-Host "  Building mcp-chrome-bridge..." -ForegroundColor Cyan
    Invoke-Expression $cmdBuildNative
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to build Native Server" -ForegroundColor Red
        exit 1
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
Write-Host "[STEP 1] Load Extension in Chrome:"
Write-Host "  1. Open Chrome: chrome://extensions/"
Write-Host "  2. Enable Developer mode"
Write-Host "  3. Click Load unpacked"
Write-Host "  4. Select folder: $extensionPath"

Write-Host ""
Write-Host "[STEP 2] Start MCP Service:"
Write-Host "  1. Click the extension icon in Chrome"
Write-Host "  2. Click Connect button"
Write-Host "  3. Service will start on: http://127.0.0.1:12306" -ForegroundColor Green

Write-Host ""
Write-Host "========================================"
Write-Host "  Setup completed successfully!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Set-Location $InitialDir
