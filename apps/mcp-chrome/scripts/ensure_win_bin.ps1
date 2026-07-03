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

# Idempotent: ensures pnpm .bin shims are Windows-compatible (.cmd files exist).
# Detects Unix-style .bin dirs (created by bash/WSL pnpm install) and fixes them
# by removing all node_modules and reinstalling from PowerShell so Windows .cmd
# shims are generated correctly. Safe to run multiple times — exits early when OK.

param(
    [Parameter(Mandatory = $true)]
    [string]$WorkspaceRoot
)

$ErrorActionPreference = "Stop"

$ProbeDir = Join-Path (Join-Path (Join-Path (Join-Path $WorkspaceRoot "app") "chrome-extension") "node_modules") ".bin"
$ProbeFile = Join-Path $ProbeDir "wxt.cmd"

if (Test-Path $ProbeFile) {
    Write-Host "  OK Windows .cmd shims present" -ForegroundColor Green
    return
}

Write-Host "  [FIX] Windows .cmd shims missing — pnpm was previously installed via bash/WSL." -ForegroundColor Yellow
Write-Host "  [FIX] Removing all node_modules and reinstalling from PowerShell..." -ForegroundColor Yellow

$NmRoot = Join-Path $WorkspaceRoot "node_modules"
$NmChromeExt = Join-Path (Join-Path (Join-Path $WorkspaceRoot "app") "chrome-extension") "node_modules"
$NmNative = Join-Path (Join-Path (Join-Path $WorkspaceRoot "app") "native-server") "node_modules"
$NmShared = Join-Path (Join-Path (Join-Path $WorkspaceRoot "packages") "shared") "node_modules"
$NmDirs = @($NmRoot, $NmChromeExt, $NmNative, $NmShared)

foreach ($Dir in $NmDirs) {
    if (Test-Path $Dir) {
        Write-Host ("  Removing: " + $Dir) -ForegroundColor DarkGray
        Remove-Item -LiteralPath $Dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "  Running pnpm install from PowerShell (generates Windows .cmd shims)..." -ForegroundColor Cyan
$SavedLocation = Get-Location
Set-Location -LiteralPath $WorkspaceRoot
& pnpm install --config.confirmModulesPurge=false
Set-Location -LiteralPath $SavedLocation.Path

if (Test-Path $ProbeFile) {
    Write-Host "  OK Windows .cmd shims now present" -ForegroundColor Green
} else {
    Write-Host "  ERROR: .cmd shims still missing after reinstall — pnpm install may have failed." -ForegroundColor Red
    exit 1
}
