# ======================================
# Chrome MCP Server Startup Script (Windows)
# ======================================
# Functions:
# 1. Check and install dependencies
# 2. Build all components (shared, native-server, chrome-extension)
# 3. Register Native Messaging Host (Local Development Version)
# 4. Provide extension loading guide
# ======================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Chrome MCP Server - Windows Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Navigate to project root
Set-Location $ProjectRoot

# ======================================
# Helper Functions
# ======================================

function Invoke-BuildWithRetry {
    param(
        [string]$Command,
        [string]$ComponentName,
        [int]$MaxRetries = 2
    )

    $attempt = 1
    $success = $false

    while (($attempt -le $MaxRetries) -and (!$success)) {
        Write-Host "  Building $ComponentName (attempt $attempt/$MaxRetries)..." -ForegroundColor Cyan

        # Execute command and capture result
        Invoke-Expression $Command

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ $ComponentName built successfully" -ForegroundColor Green
            $success = $true
            return $true
        }
        else {
            Write-Host "  ⚠ Build attempt $attempt failed with exit code $LASTEXITCODE" -ForegroundColor Yellow
        }

        if ($attempt -lt $MaxRetries) {
            Write-Host "  ⚠ Retrying in 2 seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }

        $attempt++
    }

    if (!$success) {
        Write-Host "  ✗ ERROR: $ComponentName build failed after $MaxRetries attempts" -ForegroundColor Red
        return $false
    }
}

# ======================================
# Step 1: Check Dependencies
# ======================================
Write-Host "[1/6] Checking dependencies..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green

    # Check version >= 18.19.0
    $versionNumber = $nodeVersion -replace 'v', ''
    $major = [int]($versionNumber -split '\.')[0]
    if ($major -lt 18) {
        Write-Host "  ✗ ERROR: Node.js version too low, requires >= 18.19.0" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "  ✗ ERROR: Node.js not installed" -ForegroundColor Red
    Write-Host "  Please install Node.js >= 18.19.0 from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check pnpm
try {
    $pnpmVersion = pnpm --version
    Write-Host "  ✓ pnpm: v$pnpmVersion" -ForegroundColor Green
}
catch {
    Write-Host "  ⚠ pnpm not installed, installing..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Host "  ✓ pnpm installed successfully" -ForegroundColor Green
}

# Check Chrome/Chromium
$chromeInstalled = Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
$chromiumInstalled = Test-Path "C:\Program Files\Chromium\Application\chrome.exe"

if ($chromeInstalled) {
    Write-Host "  ✓ Chrome detected" -ForegroundColor Green
} elseif ($chromiumInstalled) {
    Write-Host "  ✓ Chromium detected" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Chrome/Chromium not detected in default location" -ForegroundColor Yellow
}

# ======================================
# Step 2: Install Dependencies
# ======================================
Write-Host "`n[2/6] Installing project dependencies..." -ForegroundColor Yellow

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "  Installing dependencies (may take a few minutes)..." -ForegroundColor Cyan
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ ERROR: Dependency installation failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "  ✓ Dependencies already installed (node_modules exists)" -ForegroundColor Green
}

# ======================================
# Step 3: Build Shared Package
# ======================================
Write-Host "`n[3/6] Building shared package..." -ForegroundColor Yellow

$success = Invoke-BuildWithRetry -Command "pnpm run build:shared" -ComponentName "Shared package"
if (!$success) { exit 1 }

# ======================================
# Step 4: Build Native Server
# ======================================
Write-Host "`n[4/6] Building Native Server..." -ForegroundColor Yellow

$success = Invoke-BuildWithRetry -Command "pnpm run build:native" -ComponentName "Native Server"
if (!$success) { exit 1 }

# Verify run_host.bat exists
$runHostPath = Join-Path $ProjectRoot "app\native-server\dist\run_host.bat"
if (Test-Path $runHostPath) {
    Write-Host "  ✓ Windows startup script: run_host.bat" -ForegroundColor Green
} else {
    Write-Host "  ✗ ERROR: run_host.bat not found" -ForegroundColor Red
    exit 1
}

# ======================================
# Step 5: Build Chrome Extension
# ======================================
Write-Host "`n[5/6] Building Chrome Extension..." -ForegroundColor Yellow

$success = Invoke-BuildWithRetry -Command "pnpm run build:extension" -ComponentName "Chrome Extension" -MaxRetries 3
if (!$success) { exit 1 }

# Verify extension output
$extensionPath = Join-Path $ProjectRoot "app\chrome-extension\.output\chrome-mv3"
if (Test-Path $extensionPath) {
    Write-Host "  ✓ Extension output: .output\chrome-mv3" -ForegroundColor Green
} else {
    Write-Host "  ✗ ERROR: Extension output not found" -ForegroundColor Red
    exit 1
}

# ======================================
# Step 6: Register Native Messaging Host
# ======================================
Write-Host "`n[6/6] Registering Native Messaging Host (Local Development)..." -ForegroundColor Yellow

# Run local registration script
Write-Host "  Using local development registration..." -ForegroundColor Cyan
node scripts\register-local-dev.cjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ ERROR: Native Messaging Host registration failed" -ForegroundColor Red
    Write-Host "  Tip: Check if Chrome is running and try restarting it" -ForegroundColor Yellow
    exit 1
}

# ======================================
# Verify Registration
# ======================================
$chromeManifest = Join-Path $env:APPDATA "Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json"
$chromiumManifest = Join-Path $env:APPDATA "Chromium\NativeMessagingHosts\com.chromemcp.nativehost.json"

Write-Host "`n  Registration Verification:" -ForegroundColor Cyan
if (Test-Path $chromeManifest) {
    Write-Host "  ✓ Chrome manifest registered" -ForegroundColor Green
    Write-Host "    Location: $chromeManifest" -ForegroundColor DarkGray
}
if (Test-Path $chromiumManifest) {
    Write-Host "  ✓ Chromium manifest registered" -ForegroundColor Green
    Write-Host "    Location: $chromiumManifest" -ForegroundColor DarkGray
}

# ======================================
# Success Summary
# ======================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✅ BUILD & REGISTRATION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[IMPORTANT PATHS]" -ForegroundColor Yellow
Write-Host "  Chrome Extension:" -ForegroundColor White
Write-Host "    $extensionPath" -ForegroundColor Cyan
Write-Host "`n  Native Server:" -ForegroundColor White
Write-Host "    $(Join-Path $ProjectRoot 'app\native-server\dist')" -ForegroundColor Cyan
Write-Host "`n  MCP STDIO Server:" -ForegroundColor White
Write-Host "    $(Join-Path $ProjectRoot 'app\native-server\dist\mcp\mcp-server-stdio.js')" -ForegroundColor Cyan

# ======================================
# Setup Instructions
# ======================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  📋 NEXT STEPS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[STEP 1] Load Extension in Chrome:" -ForegroundColor Yellow
Write-Host "  1. Open Chrome and go to: chrome://extensions/" -ForegroundColor White
Write-Host "  2. Enable 'Developer mode' (toggle in top right)" -ForegroundColor White
Write-Host "  3. Click 'Load unpacked' button" -ForegroundColor White
Write-Host "  4. Select folder: $extensionPath" -ForegroundColor Cyan
Write-Host "`n  ⚠ Important: Copy the Extension ID after loading" -ForegroundColor Yellow

Write-Host "`n[STEP 2] Verify Extension ID:" -ForegroundColor Yellow
Write-Host "  1. In chrome://extensions, find your extension" -ForegroundColor White
Write-Host "  2. Copy the Extension ID" -ForegroundColor White
Write-Host "     Example: hbdgbgagpkpjffpklnamcljpakneikee" -ForegroundColor DarkGray
Write-Host "  3. Compare with registered ID in manifest file" -ForegroundColor White
Write-Host "`n  If IDs don't match, run: pnpm run unregister:local" -ForegroundColor Yellow
Write-Host "  Then update EXTENSION_ID in these files:" -ForegroundColor Yellow
Write-Host "    - app\native-server\src\scripts\constant.ts" -ForegroundColor Cyan
Write-Host "    - scripts\register-local-dev.cjs" -ForegroundColor Cyan
Write-Host "  Finally run: pnpm run build:native && pnpm run register:local" -ForegroundColor Yellow

Write-Host "`n[STEP 3] Start MCP Service:" -ForegroundColor Yellow
Write-Host "  1. Click the extension icon in Chrome toolbar" -ForegroundColor White
Write-Host "  2. Click 'Connect' button in popup" -ForegroundColor White
Write-Host "  3. Service will start on: http://127.0.0.1:12306" -ForegroundColor Green

# ======================================
# MCP Client Configuration
# ======================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  🔧 MCP CLIENT CONFIGURATION" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[Recommended] Streamable HTTP Method:" -ForegroundColor Yellow
Write-Host "  For: Claude Desktop, CherryStudio, etc." -ForegroundColor White
Write-Host @"

  {
    "mcpServers": {
      "chrome-mcp-server": {
        "type": "streamableHttp",
        "url": "http://127.0.0.1:12306/mcp"
      }
    }
  }
"@ -ForegroundColor Cyan

Write-Host "`n[Alternative] STDIO Method:" -ForegroundColor Yellow
Write-Host "  For: Cursor, older MCP clients" -ForegroundColor White
$stdioPath = Join-Path $ProjectRoot "app\native-server\dist\mcp\mcp-server-stdio.js"
$stdioPathEscaped = $stdioPath -replace '\\', '\\'
Write-Host @"

  {
    "mcpServers": {
      "chrome-mcp-server": {
        "command": "node",
        "args": ["$stdioPathEscaped"]
      }
    }
  }
"@ -ForegroundColor Cyan

# ======================================
# Development Commands
# ======================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  🛠️ DEVELOPMENT COMMANDS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  pnpm run dev:native      - Watch mode for Native Server" -ForegroundColor White
Write-Host "  pnpm run dev:extension   - Watch mode for Extension" -ForegroundColor White
Write-Host "  pnpm run build:all       - Rebuild all components" -ForegroundColor White
Write-Host "  pnpm run register:local  - Re-register local version" -ForegroundColor White
Write-Host "  pnpm run unregister:local - Unregister local version" -ForegroundColor White

# ======================================
# Platform-Specific Notes
# ======================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  💡 WINDOWS-SPECIFIC NOTES" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  • Registry entries created in HKCU\Software\Google\Chrome" -ForegroundColor White
Write-Host "  • Manifest location: %APPDATA%\Google\Chrome\NativeMessagingHosts" -ForegroundColor White
Write-Host "  • Startup script: run_host.bat" -ForegroundColor White
Write-Host "  • If firewall prompts appear, allow Node.js access" -ForegroundColor White

# ======================================
# Troubleshooting
# ======================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  🔍 TROUBLESHOOTING" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Connection Issues:" -ForegroundColor White
Write-Host "    1. Verify Extension ID matches registration" -ForegroundColor White
Write-Host "    2. Restart Chrome completely" -ForegroundColor White
Write-Host "    3. Check manifest file exists:" -ForegroundColor White
Write-Host "       type `"%APPDATA%\Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json`"" -ForegroundColor Cyan
Write-Host "`n  Port Conflicts:" -ForegroundColor White
Write-Host "    • Check if port 12306 is in use:" -ForegroundColor White
Write-Host "      netstat -ano | findstr :12306" -ForegroundColor Cyan
Write-Host "`n  Build Issues:" -ForegroundColor White
Write-Host "    • If EPERM errors occur, close all Node.js processes:" -ForegroundColor White
Write-Host "      taskkill /F /IM node.exe" -ForegroundColor Cyan
Write-Host "    • Then re-run this script" -ForegroundColor White
Write-Host "`n  Documentation:" -ForegroundColor White
Write-Host "    • Local Development Guide: LOCAL_DEVELOPMENT_GUIDE.md" -ForegroundColor Cyan
Write-Host "    • Configuration Checklist: CONFIGURATION_CHECKLIST.md" -ForegroundColor Cyan

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✅ Setup completed successfully!" -ForegroundColor Green
Write-Host "  Follow the steps above to complete the installation." -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Cyan
