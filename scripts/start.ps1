# Matrix UI bootstrap: auto-install with pnpm, dev/build/debug menu, and adb deploy of the latest APK.
# All feedback is based on command output; no exit-code checks are used.

Set-StrictMode -Version Latest
$originalDir = Get-Location

function Show-BinaryHint {
  param(
    [Parameter(Mandatory = $true)][string] $Name,
    [Parameter(Mandatory = $true)][string] $InstallHint
  )
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    Write-Host "$Name is available at $($cmd.Source)" -ForegroundColor Green
  } else {
    Write-Host "$Name is missing. Install hint: $InstallHint" -ForegroundColor Yellow
  }
}

function Ensure-Pnpm {
  Write-Host "`nChecking pnpm availability (output-based check)..." -ForegroundColor Cyan
  Show-BinaryHint -Name "node" -InstallHint "Install Node.js 18+ from https://nodejs.org"
  Show-BinaryHint -Name "pnpm" -InstallHint "Use corepack enable pnpm or npm install -g pnpm"
  try {
    Write-Host "pnpm version output:" -ForegroundColor DarkGray
    pnpm --version
  } catch {
    Write-Host "pnpm command failed to print a version. Enable pnpm via corepack and re-run." -ForegroundColor Red
  }
}

function Auto-InstallDependencies {
  param([Parameter(Mandatory = $true)][string] $ProjectPath)
  $nodeModulesPath = Join-Path $ProjectPath "node_modules"
  if (Test-Path $nodeModulesPath) {
    Write-Host "`nDependencies already present at $nodeModulesPath. Use the menu to reinstall if needed." -ForegroundColor DarkGray
    return
  }

  Write-Host "`nAuto-installing dependencies with pnpm install ..." -ForegroundColor Cyan
  Set-Location $ProjectPath
  pnpm install
}

function Run-DevServer {
  param([string] $ProjectPath)
  Set-Location $ProjectPath
  Write-Host "`nStarting dev server (Ctrl+C to stop). Watch the Vite output for host/port." -ForegroundColor Cyan
  pnpm dev
}

function Run-BuildAll {
  param([string] $ProjectPath)
  Set-Location $ProjectPath
  Write-Host "`nBuilding production bundle (multi-platform static assets)." -ForegroundColor Cyan
  pnpm build
}

function Run-DebugPreview {
  param([string] $ProjectPath)
  Set-Location $ProjectPath
  Write-Host "`nPreviewing production build locally with source maps where available." -ForegroundColor Cyan
  pnpm preview -- --host
}

function Reinstall-Dependencies {
  param([string] $ProjectPath)
  Set-Location $ProjectPath
  Write-Host "`nForcing fresh install with pnpm install..." -ForegroundColor Cyan
  pnpm install
}

function Deploy-LatestApkViaAdb {
  param([string] $ProjectPath)
  Write-Host "`nSearching for the freshest APK under $ProjectPath ..." -ForegroundColor Cyan
  $apk = Get-ChildItem -Path $ProjectPath -Recurse -Filter *.apk -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

  if (-not $apk) {
    Write-Host "No APK found. Build a debug/production APK first, then rerun this option." -ForegroundColor Yellow
    return
  }

  Write-Host "Latest APK detected: $($apk.FullName)" -ForegroundColor Green
  Show-BinaryHint -Name "adb" -InstallHint "Install Android platform-tools and ensure adb is on PATH"
  Write-Host "Listing connected devices (authorize phone when prompted)..." -ForegroundColor Cyan
  adb devices
  Write-Host "Installing via adb install -r $($apk.FullName)" -ForegroundColor Cyan
  adb install -r $apk.FullName
}

function Show-Menu {
  Write-Host "`n=== Matrix UI Menu (output-driven) ===" -ForegroundColor Magenta
  Write-Host "1) Start dev server (pnpm dev)"
  Write-Host "2) Build production assets (pnpm build)"
  Write-Host "3) Preview build locally (pnpm preview --host)"
  Write-Host "4) Force reinstall dependencies (pnpm install)"
  Write-Host "5) Deploy latest APK to device via adb"
  Write-Host "q) Quit"
}

try {
  $root = Split-Path -Parent $PSScriptRoot
  $projectPath = Join-Path $root "poly_apps"
  $packageFile = Join-Path $projectPath "package.json"

  if (!(Test-Path $packageFile)) {
    Write-Host "package.json not found at $packageFile. Place the Matrix UI project under poly_apps and rerun." -ForegroundColor Red
    return
  }

  Write-Host "Project path resolved to $projectPath" -ForegroundColor Green
  Ensure-Pnpm
  Auto-InstallDependencies -ProjectPath $projectPath

  while ($true) {
    Show-Menu
    $choice = Read-Host "Select an option"
    switch ($choice.ToLower()) {
      "1" { Run-DevServer -ProjectPath $projectPath }
      "2" { Run-BuildAll -ProjectPath $projectPath }
      "3" { Run-DebugPreview -ProjectPath $projectPath }
      "4" { Reinstall-Dependencies -ProjectPath $projectPath }
      "5" { Deploy-LatestApkViaAdb -ProjectPath $projectPath }
      "q" { break }
      default { Write-Host "Unknown option. Please choose again." -ForegroundColor Yellow }
    }
  }
}
finally {
  Set-Location $originalDir
  Write-Host "Returned to original directory: $originalDir" -ForegroundColor DarkGray
}
