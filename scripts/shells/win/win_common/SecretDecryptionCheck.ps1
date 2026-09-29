<#
.SYNOPSIS
    Check for encrypted secrets and prompt for decryption

.DESCRIPTION
    This script checks if there are encrypted secret files that need decryption
    and prompts the user to decrypt them using SecretManager.ps1

.EXAMPLE
    .\SecretDecryptionCheck.ps1
#>

# Variable declarations
$scriptDir = $PSScriptRoot
$secretManagerPath = Join-Path $scriptDir "SecretManager.ps1"
$secretCachePath = Join-Path $scriptDir "SecretCache.ps1"
$secretKeysDir = ""
$encryptedDir = ""
$rawDir = ""
$CoreNodeDir = ""
$winDir = ""
$shellsDir = ""
$scriptsDir = ""
$missingFiles = @()
$encryptedFiles = $null
$rawFilePath = ""
$keyName = ""

# Import SecretManager.ps1 and SecretCache.ps1
. $secretManagerPath
. $secretCachePath

# Determine paths (scripts\shells\win\win_common -> core_node = 4 levels up)
if ($Global:CORE_NODE_DIR) {
    $CoreNodeDir = $Global:CORE_NODE_DIR
} else {
    $winDir = Split-Path $scriptDir -Parent
    $shellsDir = Split-Path $winDir -Parent
    $scriptsDir = Split-Path $shellsDir -Parent
    $CoreNodeDir = Split-Path $scriptsDir -Parent
}

$secretKeysDir = Join-Path $CoreNodeDir ".secret_keys"
$encryptedDir = Join-Path $secretKeysDir "already_encrypted"
$rawDir = Join-Path $secretKeysDir ".secret_ignore"

# Check for encrypted files
if (-not (Test-Path $encryptedDir)) {
    return
}

# Clean up expired secret cache entries
Clear-ExpiredSecretCache

# Force array so .Count is always available (zero matches returns $null,
# which throws under Set-StrictMode when .Count is accessed).
$encryptedFiles = @(Get-ChildItem -Path $encryptedDir -Filter "*.js" -File -ErrorAction SilentlyContinue)

if ($encryptedFiles.Count -eq 0) {
    return
}

# Check for encrypted files with content changes (before checking missing files)
if (Get-EncryptedFilesNeedingRedecryption -EncryptedDir $encryptedDir -RawDir $rawDir) {
    # Some encrypted files were updated and user chose to re-decrypt
    # The function already removed outdated raw files
    Write-Host "[CACHE UPDATE] Starting re-decryption after content changes..." -ForegroundColor Cyan
    # Continue with normal decryption flow to decrypt the removed files
}

# Ensure raw directory exists
if (-not (Test-Path $rawDir)) {
    New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
}

# A decoy client key (wrong-password decrypt) is removed so it counts as missing.
Remove-InvalidClientKeySecret

# Check each encrypted file for corresponding decrypted file
foreach ($encFile in $encryptedFiles) {
    $keyName = [System.IO.Path]::GetFileNameWithoutExtension($encFile.Name)
    $rawFilePath = Join-Path $rawDir $keyName
    if (-not (Test-Path $rawFilePath)) {
        $missingFiles += $keyName
    }
}

if ($missingFiles.Count -eq 0) {
    return
}

# Display prompt
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Missing Decrypted Secret Files Detected" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Found $($encryptedFiles.Count) encrypted files, $($missingFiles.Count) missing decrypted:" -ForegroundColor White
Write-Host "  Encrypted dir: $encryptedDir" -ForegroundColor Gray
Write-Host "  Raw dir: $rawDir" -ForegroundColor Gray
Write-Host ""
Write-Host "Missing files:" -ForegroundColor Yellow
foreach ($missing in $missingFiles) {
    Write-Host "  - $missing" -ForegroundColor Red
}
Write-Host ""

$decryptChoice = (Read-Host "Decrypt the $($missingFiles.Count) missing secret(s) now? [Y/n]").Trim()

if ($decryptChoice -eq "" -or $decryptChoice -match '^(y|yes)$') {
    Write-Host ""
    Write-Host "Starting batch decryption of missing secrets..." -ForegroundColor Cyan

    $decryptResult = Invoke-SecretDecryptAll -OutputDir $rawDir -KeyNames $missingFiles
    Remove-InvalidClientKeySecret

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
