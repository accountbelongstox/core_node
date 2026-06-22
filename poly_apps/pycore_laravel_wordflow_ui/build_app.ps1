<#
.SYNOPSIS
  Build ONE sub-app of pycore_laravel_wordflow_ui as a standalone homepage app
  (Flutter-flavors style), with Capacitor packaging support.

.DESCRIPTION
  Each buildable variant is a folder under flavors/<id>/ with a flavor.json
  (id/name/appId/rootRoute/colors) + icon.svg/png (+ optional splash.png). This
  script:
    1. validates the flavor,
    2. runs scripts/flavor/flavor_build.py to write capacitor.config.json and
       prepare resources/icon.png + resources/splash.png,
    3. runs `vite build` with VITE_APP_FLAVOR set, so the chosen app is mounted
       standalone as the homepage (see shell/flavor.ts + StandaloneApp.tsx),
    4. (optional) syncs the web build into a Capacitor native project.

  The default `npm run build` (no flavor) still produces the full multi-app shell.

.PARAMETER App
  Flavor id to build (a folder under flavors/). e.g. wordnew, vortex, shell.

.PARAMETER List
  List available flavors and exit.

.PARAMETER Native
  Bundle the REAL @capacitor plugins (VITE_BUILD_TARGET=native) instead of the
  browser shims — use for an actual mobile app (requires @capacitor/* installed).

.PARAMETER Sync
  After the web build, run `npx cap sync` (and `@capacitor/assets generate` when
  available) to update the native project. Implies a Capacitor project exists.

.PARAMETER Platform
  Native platform for -Sync: android (default) or ios.

.EXAMPLE
  ./build_app.ps1 -App wordnew
  ./build_app.ps1 -App vortex -Native -Sync -Platform android
  ./build_app.ps1 -List
#>
[CmdletBinding()]
param(
  [string]$App,
  [switch]$List,
  [switch]$Native,
  [switch]$Sync,
  [ValidateSet('android', 'ios')]
  [string]$Platform = 'android'
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$flavorsDir = Join-Path $root 'flavors'

function Get-Flavors {
  if (-not (Test-Path $flavorsDir)) { return @() }
  Get-ChildItem $flavorsDir -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName 'flavor.json') } |
    Select-Object -ExpandProperty Name
}

$available = Get-Flavors

if ($List -or -not $App) {
  Write-Host "Available flavors:" -ForegroundColor Cyan
  foreach ($f in $available) {
    $meta = Get-Content (Join-Path $flavorsDir "$f/flavor.json") -Raw | ConvertFrom-Json
    Write-Host ("  {0,-16} {1}  ({2})" -f $meta.id, $meta.name, $meta.appId)
  }
  if (-not $App) { Write-Host "`nUsage: ./build_app.ps1 -App <id> [-Native] [-Sync]" -ForegroundColor DarkGray }
  return
}

if ($available -notcontains $App) {
  Write-Error "Unknown flavor '$App'. Available: $($available -join ', ')"
}

# Resolve a python interpreter.
$py = (Get-Command python -ErrorAction SilentlyContinue) ?? (Get-Command python3 -ErrorAction SilentlyContinue)
if (-not $py) { Write-Error "python not found on PATH (needed for asset/config prep)." }

Write-Host "==> Preparing flavor '$App' (capacitor config + resources)" -ForegroundColor Green
& $py.Source (Join-Path $root 'scripts/flavor/flavor_build.py') --app $App --root $root
if ($LASTEXITCODE -ne 0) { Write-Error "flavor_build.py failed (exit $LASTEXITCODE)." }

# Build the web assets with the flavor selected.
$env:VITE_APP_FLAVOR = $App
if ($Native) { $env:VITE_BUILD_TARGET = 'native' } else { Remove-Item Env:VITE_BUILD_TARGET -ErrorAction SilentlyContinue }

Write-Host "==> vite build (VITE_APP_FLAVOR=$App, native=$($Native.IsPresent))" -ForegroundColor Green
& npx vite build
if ($LASTEXITCODE -ne 0) { Write-Error "vite build failed (exit $LASTEXITCODE)." }

if ($Sync) {
  if (-not (Test-Path (Join-Path $root 'capacitor.config.json'))) {
    Write-Error "capacitor.config.json missing — run flavor prep first."
  }
  # Generate platform icons/splashes from resources/ when @capacitor/assets is present.
  Write-Host "==> @capacitor/assets generate (icons + splash)" -ForegroundColor Green
  & npx @capacitor/assets generate --$Platform 2>$null
  Write-Host "==> npx cap sync $Platform" -ForegroundColor Green
  & npx cap sync $Platform
  if ($LASTEXITCODE -ne 0) { Write-Warning "cap sync returned $LASTEXITCODE (is the $Platform project added? `npx cap add $Platform`)." }
}

Write-Host "`n✅ Built flavor '$App' → dist/" -ForegroundColor Green
if (-not $Sync) {
  Write-Host "   Next (native): npx cap add $Platform ; ./build_app.ps1 -App $App -Native -Sync" -ForegroundColor DarkGray
}
