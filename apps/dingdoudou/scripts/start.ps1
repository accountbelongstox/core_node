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

$ErrorActionPreference = 'Continue'
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
