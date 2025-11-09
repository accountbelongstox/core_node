# Core Node Init - Deploy Script
# Deploys the Core Node Init application

$ErrorActionPreference = "Stop"

# Get directories
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "Deploying Core Node Init..." -ForegroundColor Cyan
Write-Host "Project Root: $PROJECT_ROOT" -ForegroundColor Gray

# Change to project root
Set-Location $PROJECT_ROOT

# Step 1: Install dependencies
Write-Host ""
Write-Host "Step 1: Installing dependencies..." -ForegroundColor Cyan
& "$SCRIPT_DIR\install.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Dependency installation failed" -ForegroundColor Red
    exit 1
}

# Step 2: Verify pycore is available
Write-Host ""
Write-Host "Step 2: Verifying pycore installation..." -ForegroundColor Cyan
try {
    python -c "import pycore; print('pycore version:', pycore.__version__ if hasattr(pycore, '__version__') else 'unknown')"
    Write-Host "pycore is available" -ForegroundColor Green
} catch {
    Write-Host "WARNING: pycore verification failed: $_" -ForegroundColor Yellow
    Write-Host "Make sure pycore is properly installed in the project" -ForegroundColor Yellow
}

# Step 3: Create required directories
Write-Host ""
Write-Host "Step 3: Creating required directories..." -ForegroundColor Cyan
$directories = @(
    ".cache",
    "public",
    "tmp"
)

foreach ($dir in $directories) {
    $fullPath = Join-Path $PROJECT_ROOT $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        Write-Host "Created directory: $dir" -ForegroundColor Green
    } else {
        Write-Host "Directory exists: $dir" -ForegroundColor Gray
    }
}

# Step 4: Deployment complete
Write-Host ""
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application, run:" -ForegroundColor Cyan
Write-Host "  .\pyapps\core_node_init\scripts\start.ps1" -ForegroundColor White
Write-Host ""
Write-Host "To stop the application, run:" -ForegroundColor Cyan
Write-Host "  .\pyapps\core_node_init\scripts\stop.ps1" -ForegroundColor White
