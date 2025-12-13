# Chrome MCP Server Startup Script (Windows)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host ""
Write-Host "========================================"
Write-Host "  Chrome MCP Server - Windows Setup"
Write-Host "========================================"
Write-Host ""

# Step 1: Check Dependencies
Write-Host "[1/6] Checking dependencies..."

$nodeVersion = node --version
if ($nodeVersion) {
    Write-Host "  OK Node.js: $nodeVersion"
}

$pnpmVersion = pnpm --version
if ($pnpmVersion) {
    Write-Host "  OK pnpm: v$pnpmVersion"
}

# Step 2: Install Dependencies
Write-Host ""
Write-Host "[2/6] Installing project dependencies..."

if (Test-Path "node_modules") {
    Write-Host "  OK Dependencies already installed"
} else {
    Write-Host "  Installing dependencies..."
    pnpm install
    Write-Host "  OK Dependencies installed"
}

# Step 3: Build Shared Package
Write-Host ""
Write-Host "[3/6] Building shared package..."
Write-Host "  Building chrome-mcp-shared..."

pnpm run build:shared

if (Test-Path "packages\shared\dist") {
    Write-Host "  OK Shared package built successfully"
}

# Step 4: Build Native Server
Write-Host ""
Write-Host "[4/6] Building Native Server..."
Write-Host "  Building mcp-chrome-bridge..."

pnpm run build:native

if (Test-Path "app\native-server\dist\run_host.bat") {
    Write-Host "  OK Native Server built successfully"
}

# Step 5: Build Chrome Extension
Write-Host ""
Write-Host "[5/6] Building Chrome Extension..."
Write-Host "  Building chrome-mcp-server..."

$attempt = 1
$maxAttempts = 3

while ($attempt -le $maxAttempts) {
    if ($attempt -gt 1) {
        Write-Host "  Retrying build (attempt $attempt/$maxAttempts)..."
        Start-Sleep -Seconds 2
    }

    pnpm run build:extension

    if (Test-Path "app\chrome-extension\.output\chrome-mv3\manifest.json") {
        Write-Host "  OK Chrome Extension built successfully"
        break
    }

    $attempt = $attempt + 1
}

# Step 6: Register Native Messaging Host
Write-Host ""
Write-Host "[6/6] Registering Native Messaging Host..."
Write-Host "  Using local development registration..."

node scripts\register-local-dev.cjs

$chromeManifest = Join-Path $env:APPDATA "Google\Chrome\NativeMessagingHosts\com.chromemcp.nativehost.json"

Write-Host ""
Write-Host "  Registration Verification:"

if (Test-Path $chromeManifest) {
    Write-Host "  OK Chrome manifest registered"
    Write-Host "    Location: $chromeManifest"
}

# Success Summary
$extensionPath = Join-Path $ProjectRoot "app\chrome-extension\.output\chrome-mv3"

Write-Host ""
Write-Host "========================================"
Write-Host "  BUILD & REGISTRATION COMPLETE"
Write-Host "========================================"

Write-Host ""
Write-Host "[IMPORTANT PATHS]"
Write-Host "  Chrome Extension:"
Write-Host "    $extensionPath"
Write-Host ""
Write-Host "  Native Server:"
Write-Host "    $ProjectRoot\app\native-server\dist"

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
Write-Host "[STEP 2] Verify Extension ID:"
Write-Host "  1. Find your extension in chrome://extensions"
Write-Host "  2. Copy the Extension ID"
Write-Host "  3. Compare with registered ID in manifest file"

Write-Host ""
Write-Host "[STEP 3] Start MCP Service:"
Write-Host "  1. Click the extension icon in Chrome"
Write-Host "  2. Click Connect button"
Write-Host "  3. Service will start on: http://127.0.0.1:12306"

Write-Host ""
Write-Host "========================================"
Write-Host "  MCP CLIENT CONFIGURATION"
Write-Host "========================================"

Write-Host ""
Write-Host "Streamable HTTP Method (Recommended):"
Write-Host '  {'
Write-Host '    "mcpServers": {'
Write-Host '      "chrome-mcp-server": {'
Write-Host '        "type": "streamableHttp",'
Write-Host '        "url": "http://127.0.0.1:12306/mcp"'
Write-Host '      }'
Write-Host '    }'
Write-Host '  }'

Write-Host ""
Write-Host "========================================"
Write-Host "  Setup completed successfully!"
Write-Host "========================================"
Write-Host ""
