# MCP Server Deployment Script
# Deploy mcpserver to production environment

Write-Host "Deploying MCP Server..." -ForegroundColor Green

# Get script directory and navigate to project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))

# Change to project root
Set-Location $ProjectRoot

# Step 1: Run installation
Write-Host ""
Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
& "$ScriptDir\install.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    exit 1
}

# Step 2: Validate configuration
Write-Host ""
Write-Host "Step 2: Validating configuration..." -ForegroundColor Yellow

if (Test-Path "pyapps\mcpserver\config\__init__.py") {
    Write-Host "✓ Configuration found" -ForegroundColor Green
} else {
    Write-Host "WARNING: Configuration not found" -ForegroundColor Yellow
}

# Step 3: Check pycore dependencies
Write-Host ""
Write-Host "Step 3: Checking pycore dependencies..." -ForegroundColor Yellow

$pycoreModules = @(
    "pycore\pyfoundations",
    "pycore\pyutils",
    "pycore\pygvar"
)

$allModulesExist = $true
foreach ($module in $pycoreModules) {
    if (Test-Path $module) {
        Write-Host "✓ $module exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $module missing" -ForegroundColor Red
        $allModulesExist = $false
    }
}

if (-not $allModulesExist) {
    Write-Host "ERROR: Missing pycore modules" -ForegroundColor Red
    exit 1
}

# Step 4: Create necessary directories
Write-Host ""
Write-Host "Step 4: Creating necessary directories..." -ForegroundColor Yellow

$directories = @(
    ".cache",
    ".cache\mcpserver",
    "logs",
    "logs\mcpserver"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "✓ Created $dir" -ForegroundColor Green
    } else {
        Write-Host "✓ $dir exists" -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "Run './start.ps1' to start the MCP Server" -ForegroundColor Cyan
