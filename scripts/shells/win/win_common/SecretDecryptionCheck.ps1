# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of functions.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    Check for encrypted secrets and prompt for decryption

.DESCRIPTION
    This script checks if there are encrypted secret files that need decryption
    and prompts the user to decrypt them using SecretManager.ps1

.PARAMETER CoreNodeDir
    Core node directory path (optional, will use $Global:CORE_NODE_DIR if not provided)

.EXAMPLE
    .\SecretDecryptionCheck.ps1
    .\SecretDecryptionCheck.ps1 -CoreNodeDir "D:\programing\core_node"
#>

param(
    [string]$CoreNodeDir
)

# Import SecretManager.ps1 at the beginning
$scriptDir = $PSScriptRoot
$secretManagerPath = Join-Path $scriptDir "SecretManager.ps1"
. $secretManagerPath

# Variable declarations
$secretKeysDir = ""
$encryptedDir = ""
$rawDir = ""

# Determine paths
if ([string]::IsNullOrWhiteSpace($CoreNodeDir)) {
    if ($Global:CORE_NODE_DIR) {
        $CoreNodeDir = $Global:CORE_NODE_DIR
    } else {
        $parentDir = Split-Path (Split-Path $scriptDir -Parent) -Parent
        $CoreNodeDir = Split-Path $parentDir -Parent
    }
}

$secretKeysDir = Join-Path $CoreNodeDir ".secret_keys"
$encryptedDir = Join-Path $secretKeysDir "already_encrypted"
$rawDir = Join-Path $secretKeysDir ".secret_ignore"

# Check for encrypted files
if (-not (Test-Path $encryptedDir)) {
    return
}

$encryptedFiles = Get-ChildItem -Path $encryptedDir -Filter "*.js" -File -ErrorAction SilentlyContinue

if ($encryptedFiles.Count -eq 0) {
    return
}

# Check if decryption is needed
$needsDecryption = $false

if (-not (Test-Path $rawDir)) {
    $needsDecryption = $true
} else {
    $rawFiles = Get-ChildItem -Path $rawDir -File -ErrorAction SilentlyContinue
    if ($rawFiles.Count -eq 0) {
        $needsDecryption = $true
    }
}

if (-not $needsDecryption) {
    return
}

# Display prompt
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Encrypted Secret Files Detected" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Found $($encryptedFiles.Count) encrypted files in:" -ForegroundColor White
Write-Host "  $encryptedDir" -ForegroundColor Gray
Write-Host ""
Write-Host "No decrypted files found in:" -ForegroundColor Yellow
Write-Host "  $rawDir" -ForegroundColor Gray
Write-Host ""

$decryptChoice = Read-Host "Would you like to decrypt all secrets now? (yes/no)"

if ($decryptChoice -eq "yes" -or $decryptChoice -eq "y") {
    Write-Host ""
    Write-Host "Starting batch decryption..." -ForegroundColor Cyan

    $decryptResult = Invoke-SecretDecryptAll -OutputDir $rawDir

    if ($decryptResult) {
        Write-Host ""
        Write-Host "Secrets decrypted successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Some secrets failed to decrypt. You can retry later." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Press Enter to continue..."
    Read-Host
} else {
    Write-Host "Skipping decryption. You can decrypt secrets later via the menu." -ForegroundColor Yellow
}
