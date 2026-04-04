#Requires -Version 5.1
# Launch claude_host via core_node's pyapp launcher.
# Installs websockets if missing.
#
# Usage:
#   .\start.ps1          # Normal start
#   .\start.ps1 --dev    # Hot-reload mode (auto-restarts on *.py changes)

param(
    [switch]$dev
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$AppRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$CoreNodeRoot = (Resolve-Path (Join-Path $ScriptDir "..\..\..")).Path
$WcGroup = Join-Path $CoreNodeRoot "webclaude_group"
if (Test-Path -LiteralPath $WcGroup) {
    $dd = if ($env:WEBCLAUDE_DATA_DIR) { $env:WEBCLAUDE_DATA_DIR } else { Join-Path $WcGroup ".data" }
    $null = New-Item -ItemType Directory -Force -Path (Join-Path $dd "cache") -ErrorAction SilentlyContinue
    $env:WEBCLAUDE_DATA_DIR = $dd
}
$OriginalDir = (Get-Location).Path

try {
    Set-Location -LiteralPath $CoreNodeRoot

    $py = $null
    foreach ($name in @("python", "python3")) {
        if (Get-Command $name -ErrorAction SilentlyContinue) {
            $py = $name
            break
        }
    }
    if (-not $py) {
        Write-Host "[ERROR] Python was not found (tried: python, python3)."
        exit 1
    }

    & $py -c "import websockets" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[INFO] Installing dependencies (pip)..."
        & $py -m pip install -q -r (Join-Path $AppRoot "requirements.txt")
    }

    # Show configuration hints
    if (-not $env:CENTRAL_SERVER_URL -and -not $env:GATEWAY_URL) {
        Write-Host "[WARN] CENTRAL_SERVER_URL (or GATEWAY_URL) is not set."
    }
    if (-not $env:HOST_TOKEN) {
        Write-Host "[WARN] HOST_TOKEN is not set. Authentication with gateway may fail."
    }
    if ($env:CENTER_SERVER_URL) {
        Write-Host "[INFO] Center server registration enabled: $env:CENTER_SERVER_URL"
    }

    if ($dev) {
        Write-Host "[INFO] Starting in dev mode with hot-reload..."
        & $py -u (Join-Path $AppRoot "scripts\dev_reload.py")
    } else {
        & $py -u (Join-Path $CoreNodeRoot "pymain.py") "app=claude_host"
    }
} finally {
    Set-Location -LiteralPath $OriginalDir
}
