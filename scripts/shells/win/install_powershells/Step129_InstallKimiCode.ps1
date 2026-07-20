# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTION RULES END ###

# Kimi Code CLI standalone install (idempotent).
# PATH refresh goes through win_common/WindowsPathFunction.ps1; binary detection goes through
# win_common/CommonFunc.ps1 Find-ExecutableByKeyword (recursive depth search over install dir,
# dev dirs, and system paths), never Get-Command.

$script:KimiInstallUrl = "https://code.kimi.com/kimi-code/install.ps1"

$SCRIPT_INDEX = "[Step 129]"
$winCommonDir = $null
$kimiExeBefore = $null
$kimiVerBefore = $null
$kimiBroken = $null
$kimiNeedInstall = $null
$kimiExe = $null
$kimiVer = $null

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'CommonFunc.ps1')
. (Join-Path $winCommonDir 'WindowsPathFunction.ps1')

function Update-ProcessPathFromRegistry {
    $env:Path = Build-CombinedNormalizedPath
}

function Find-KimiExecutable {
    # Binary detection: recursive library search for the kimi executable file on disk.
    Update-ProcessPathFromRegistry
    $found = Find-ExecutableByKeyword -Keywords 'kimi' -Recursive $true -ExecutableExtensions @('.exe', '.cmd', '.ps1')
    if ($found) { return [string]$found }
    return $null
}

function Get-KimiVersion {
    param([string]$KimiExePath)
    if (-not $KimiExePath) { return "" }
    try {
        $v = & $KimiExePath --version 2>&1
        if ($v) { return ($v | Out-String).Trim() }
    } catch { }
    return ""
}

Write-Host "$SCRIPT_INDEX Kimi Code CLI standalone (kimi binary, idempotent)" -ForegroundColor Cyan

# Always run binary detection first (PATH refreshed via WindowsPathFunction); install/repair only when missing or broken.
$kimiExeBefore = Find-KimiExecutable
$kimiVerBefore = Get-KimiVersion -KimiExePath $kimiExeBefore
$kimiBroken = $kimiExeBefore -and [string]::IsNullOrWhiteSpace($kimiVerBefore)
$kimiNeedInstall = (-not $kimiExeBefore) -or $kimiBroken
if ($kimiBroken) {
    Write-Host "$SCRIPT_INDEX kimi binary found at $kimiExeBefore but version check failed (broken); will attempt repair." -ForegroundColor Yellow
}
if ($kimiNeedInstall) {
    Write-Host "$SCRIPT_INDEX Installing Kimi Code CLI (kimi binary)..." -ForegroundColor Cyan
    try {
        Invoke-RestMethod -Uri $script:KimiInstallUrl -Method Get | Invoke-Expression
    } catch {
        $errMsg = $_.Exception.Message
        Write-Host "$SCRIPT_INDEX Kimi Code CLI install failed: $errMsg" -ForegroundColor Red
        Write-Host "$SCRIPT_INDEX Retry manually as Administrator: irm 'https://code.kimi.com/kimi-code/install.ps1' | iex" -ForegroundColor Yellow
    }
} else {
    Write-Host "$SCRIPT_INDEX kimi binary present at $kimiExeBefore and version OK; skipping install (idempotent)." -ForegroundColor Green
}

# Always run full binary detection after install/repair (never skip); PATH refresh is inside detection.
$kimiExe = Find-KimiExecutable
$kimiVer = Get-KimiVersion -KimiExePath $kimiExe
if ($kimiVer) { Write-Host "$SCRIPT_INDEX Kimi Code CLI version: $kimiVer" -ForegroundColor Cyan } else { Write-Host "$SCRIPT_INDEX Kimi Code CLI version: (could not get)" -ForegroundColor Yellow }
if ($kimiExe) { Write-Host "$SCRIPT_INDEX Kimi Code CLI detection: present at $kimiExe" -ForegroundColor Green } else { Write-Host "$SCRIPT_INDEX Kimi Code CLI detection: binary not found on PATH." -ForegroundColor Red }
