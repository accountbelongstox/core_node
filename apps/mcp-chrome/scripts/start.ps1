# ======================================
# Chrome MCP Server Startup Script
# ======================================
# Functions:
# 1. Check and install dependencies
# 2. Build all components (shared, native-server, chrome-extension)
# 3. Register Native Messaging Host
# 4. Provide extension loading guide
# ======================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Chrome MCP Server Startup Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Navigate to project root
Set-Location $ProjectRoot

# ======================================
# Step 1: Check Dependencies
# ======================================
Write-Host "[1/5] Checking dependencies..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  [OK] Node.js: $nodeVersion" -ForegroundColor Green

    # Check version >= 18.19.0
    $versionNumber = $nodeVersion -replace 'v', ''
    $major = [int]($versionNumber -split '\.')[0]
    if ($major -lt 18) {
        Write-Host "  [ERROR] Node.js version too low, requires >= 18.19.0" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  [ERROR] Node.js not installed, please install Node.js >= 18.19.0" -ForegroundColor Red
    exit 1
}

# Check pnpm
try {
    $pnpmVersion = pnpm --version
    Write-Host "  [OK] pnpm: v$pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] pnpm not installed, installing..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Host "  [OK] pnpm installed successfully" -ForegroundColor Green
}

# ======================================
# Step 2: Build Native Server First (to fix postinstall)
# ======================================
Write-Host "`n[2/5] Building native-server (to enable postinstall)..." -ForegroundColor Yellow

# Check if shared package dist exists
if (-Not (Test-Path "packages\shared\dist")) {
    Write-Host "  Building shared package first..." -ForegroundColor Cyan
    Set-Location "packages\shared"
    pnpm install --ignore-scripts
    pnpm run build
    Set-Location $ProjectRoot
    Write-Host "  [OK] Shared package built" -ForegroundColor Green
}

# Build native-server without running postinstall
Write-Host "  Building native-server..." -ForegroundColor Cyan
Set-Location "app\native-server"
pnpm install --ignore-scripts
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Native server build failed" -ForegroundColor Red
    Set-Location $ProjectRoot
    exit 1
}
Set-Location $ProjectRoot
Write-Host "  [OK] Native server built successfully" -ForegroundColor Green

# ======================================
# Step 3: Install Dependencies
# ======================================
Write-Host "`n[3/5] Installing project dependencies..." -ForegroundColor Yellow

Write-Host "  Installing dependencies (may take a few minutes)..." -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Dependency installation failed" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Dependencies installed successfully" -ForegroundColor Green

# ======================================
# Step 4: Build All Components
# ======================================
Write-Host "`n[4/5] Building all project components..." -ForegroundColor Yellow

# Build shared package
Write-Host "  [4.1] Building shared package (packages/shared)..." -ForegroundColor Cyan
pnpm run build:shared
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Shared package build failed" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Shared package built successfully" -ForegroundColor Green

# Build native-server (again to ensure latest)
Write-Host "`n  [4.2] Rebuilding Native Server (app/native-server)..." -ForegroundColor Cyan
pnpm run build:native
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Native Server build failed" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Native Server built successfully" -ForegroundColor Green

# Build chrome-extension
Write-Host "`n  [4.3] Building Chrome Extension (app/chrome-extension)..." -ForegroundColor Cyan
pnpm run build:extension
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Chrome Extension build failed" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Chrome Extension built successfully" -ForegroundColor Green

# ======================================
# Step 5: Register Native Messaging Host
# ======================================
Write-Host "`n[5/5] Registering Native Messaging Host..." -ForegroundColor Yellow

# Run registration script
Set-Location "$ProjectRoot\app\native-server"
node dist\scripts\register-dev.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Native Messaging Host registration failed" -ForegroundColor Red
    Write-Host "  Tip: You may need administrator privileges, try running this script as administrator" -ForegroundColor Yellow
    Set-Location $ProjectRoot
    exit 1
}
Set-Location $ProjectRoot
Write-Host "  [OK] Native Messaging Host registered successfully" -ForegroundColor Green

# ======================================
# Usage Guide
# ======================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  BUILD COMPLETE - IMPORTANT FILES" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

$extensionPath = Join-Path $ProjectRoot "app\chrome-extension\.output\chrome-mv3"
$nativeServerDist = Join-Path $ProjectRoot "app\native-server\dist"
$stdioServerPath = Join-Path $nativeServerDist "mcp\mcp-server-stdio.js"
$stdioConfigPath = Join-Path $nativeServerDist "mcp\stdio-config.json"

Write-Host "`n[IMPORTANT FILES]" -ForegroundColor Yellow
Write-Host "  Chrome Extension (built):" -ForegroundColor White
Write-Host "    $extensionPath" -ForegroundColor Cyan
Write-Host "`n  Native Messaging Host:" -ForegroundColor White
Write-Host "    $nativeServerDist" -ForegroundColor Cyan
Write-Host "`n  MCP STDIO Server (for Cursor/Claude Desktop):" -ForegroundColor White
Write-Host "    $stdioServerPath" -ForegroundColor Cyan
Write-Host "`n  MCP STDIO Config:" -ForegroundColor White
Write-Host "    $stdioConfigPath" -ForegroundColor Cyan

# Check where Native Messaging Host is registered
$nativeHostPath = Join-Path $env:APPDATA "Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json"
if (Test-Path $nativeHostPath) {
    Write-Host "`n  Native Messaging Host Manifest:" -ForegroundColor White
    Write-Host "    $nativeHostPath" -ForegroundColor Cyan
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SETUP STEPS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[STEP 1] Load Chrome Extension:" -ForegroundColor Yellow
Write-Host "  - Open Chrome: chrome://extensions/" -ForegroundColor White
Write-Host "  - Enable 'Developer mode'" -ForegroundColor White
Write-Host "  - Click 'Load unpacked'" -ForegroundColor White
Write-Host "  - Select: $extensionPath" -ForegroundColor Cyan

Write-Host "`n[STEP 2] Start MCP Service:" -ForegroundColor Yellow
Write-Host "  - Click Chrome extension icon" -ForegroundColor White
Write-Host "  - Click 'Connect' button" -ForegroundColor White
Write-Host "  - Service starts on: http://127.0.0.1:12306" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  MCP CLIENT CONFIGURATION" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[METHOD 1] Streamable HTTP (Recommended)" -ForegroundColor Yellow
Write-Host "  For: Claude Desktop, CherryStudio, etc." -ForegroundColor White
Write-Host "  Config:" -ForegroundColor White
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

Write-Host "`n[METHOD 2] STDIO (Alternative)" -ForegroundColor Yellow
Write-Host "  For: Cursor, older clients" -ForegroundColor White
Write-Host "  Config:" -ForegroundColor White
Write-Host @"
  {
    "mcpServers": {
      "chrome-mcp-server": {
        "command": "node",
        "args": ["$stdioServerPath"]
      }
    }
  }
"@ -ForegroundColor Cyan

Write-Host "`n  Note: STDIO server connects to HTTP server at:" -ForegroundColor DarkGray
Write-Host "        http://127.0.0.1:12306/mcp (via stdio-config.json)" -ForegroundColor DarkGray

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Development Mode Commands:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  pnpm run dev          # Start all components in dev mode" -ForegroundColor White
Write-Host "  pnpm run dev:native   # Start Native Server in dev mode only" -ForegroundColor White
Write-Host "  pnpm run dev:extension # Start Extension in dev mode only" -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Documentation Links:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  • README: $ProjectRoot\README.md" -ForegroundColor White
Write-Host "  • Architecture: $ProjectRoot\docs\ARCHITECTURE.md" -ForegroundColor White
Write-Host "  • Tools API: $ProjectRoot\docs\TOOLS.md" -ForegroundColor White
Write-Host "  • Troubleshooting: $ProjectRoot\docs\TROUBLESHOOTING.md" -ForegroundColor White

Write-Host "`n[SUCCESS] Startup script completed successfully!`n" -ForegroundColor Green
