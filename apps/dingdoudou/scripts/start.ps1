$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$InitialDir = Get-Location
$PnpmVersion = '10.32.0'
$PnpmSpec = "pnpm@$PnpmVersion"
$PnpmCmd = $null
$NpmCmd = $null
$CorepackCmd = $null

function Resolve-Tool {
    param([string]$Name)

    return (Get-Command $Name -ErrorAction SilentlyContinue).Source
}

Write-Host ''
Write-Host '========================================'
Write-Host '  DingDuoDuo - Build'
Write-Host '========================================'
Write-Host "[INFO] App directory: $AppDir"

try {
    Set-Location -LiteralPath $AppDir

    $PnpmCmd = Resolve-Tool 'pnpm'
    if (-not $PnpmCmd) {
        $CorepackCmd = Resolve-Tool 'corepack'
        if ($CorepackCmd) {
            Write-Host "[INFO] Installing pnpm $PnpmVersion through Corepack."
            & $CorepackCmd enable pnpm
            & $CorepackCmd install --global $PnpmSpec
            $PnpmCmd = 'pnpm'
        }
    }

    if (-not $PnpmCmd) {
        $NpmCmd = Resolve-Tool 'npm'
        if (-not $NpmCmd) {
            throw 'Node.js and npm are required.'
        }
        Write-Host "[INFO] Installing pnpm $PnpmVersion through npm."
        & $NpmCmd install --global $PnpmSpec
        $PnpmCmd = 'pnpm'
    }

    if (-not $PnpmCmd) {
        throw 'pnpm is unavailable.'
    }

    Write-Host "[INFO] Using pnpm: $PnpmCmd"
    Write-Host '[INFO] Repairing dependency links from the lock file.'
    & $PnpmCmd install --frozen-lockfile

    Write-Host '[INFO] Building the extension.'
    & $PnpmCmd run build
    Write-Host '[SUCCESS] Build command completed.' -ForegroundColor Green
} finally {
    Set-Location -LiteralPath $InitialDir
}
