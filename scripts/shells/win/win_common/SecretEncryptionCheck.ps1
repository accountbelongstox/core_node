<#
.SYNOPSIS
    Check for unencrypted raw secrets and prompt for encryption

.DESCRIPTION
    This script checks the .secret_ignore directory for raw secret files that
    have no corresponding encrypted file in already_encrypted (newly added), or
    that were modified after their last decryption (changed). If any are found,
    it prompts the user to encrypt them with a single password into the
    already_encrypted directory, then updates the secret caches so the same
    files are not re-flagged on the next startup.

    This is the reverse-direction counterpart of SecretDecryptionCheck.ps1.

.EXAMPLE
    .\SecretEncryptionCheck.ps1
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
$filesNeedingEncryption = @()
$dirs = $null
$password = ""
$encryptChoice = ""
$successCount = 0
$failCount = 0
$rawFilePath = ""
$encryptedFilePath = ""
$missingRawKeys = @()
$presentKeys = @()
$rawFilePaths = @()
$encryptResult = $null

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

# The shared client key is generated here, after the decryption check restored any
# encrypted copy, so the prompt below encrypts a newly generated key.
Initialize-ClientKeySecret

# Nothing to encrypt if the raw directory does not exist
if (-not (Test-Path $rawDir)) {
    return
}

# Secrets recorded as encrypted with a second password are re-encrypted with the
# main one first, so the checks below compare against a single password.
Invoke-SecretMismatchReencrypt

# Detect raw files needing encryption (missing .js counterpart, or modified after decryption)
# Force array so .Count is always available (an empty result collapses to $null,
# which throws under Set-StrictMode when .Count is accessed).
$filesNeedingEncryption = @(Get-FilesNeedingReEncryption -RawDir $rawDir -EncryptedDir $encryptedDir -Quiet)

if ($filesNeedingEncryption.Count -eq 0) {
    return
}

$dirs = Get-SecretDirectories

# Display prompt
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Unencrypted Secret Files Detected" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Found $($filesNeedingEncryption.Count) raw secret(s) not yet encrypted:" -ForegroundColor White
Write-Host "  Raw dir: $rawDir" -ForegroundColor Gray
Write-Host "  Encrypted dir: $encryptedDir" -ForegroundColor Gray
Write-Host ""
Write-Host "Files to encrypt:" -ForegroundColor Yellow
foreach ($keyName in $filesNeedingEncryption) {
    Write-Host "  - $keyName" -ForegroundColor Red
}
Write-Host ""

$encryptChoice = Read-Host "Would you like to encrypt them into already_encrypted now? (yes/no)"

if ($encryptChoice -notmatch "^[Yy](es)?$") {
    Write-Host "Skipping encryption. You can encrypt secrets later via the menu." -ForegroundColor Yellow
    return
}

# Ensure encrypted directory exists
if (-not (Test-Path $encryptedDir)) {
    New-Item -ItemType Directory -Path $encryptedDir -Force | Out-Null
}

# Prompt for password (with confirmation)
$password = Read-SecretPassword -Label "[SECRET_ENCRYPT_CHECK] Encryption"
$password = Confirm-SecretMainPassword -Password $password -Label "[SECRET_ENCRYPT_CHECK]" -Excluded $filesNeedingEncryption

if ([string]::IsNullOrWhiteSpace($password)) {
    Write-Host "[SECRET_ENCRYPT_CHECK] ERROR: Password is required. Aborting encryption." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "[SECRET_ENCRYPT_CHECK] Encrypting $($filesNeedingEncryption.Count) secret(s) in one batch..." -ForegroundColor Cyan

$missingRawKeys = @($filesNeedingEncryption | Where-Object { -not (Test-Path (Join-Path $rawDir $_)) })
foreach ($keyName in $missingRawKeys) {
    Write-Host "[SECRET_ENCRYPT_CHECK]   SKIP: $keyName (raw file missing)" -ForegroundColor Yellow
}
$failCount += $missingRawKeys.Count

$presentKeys = @($filesNeedingEncryption | Where-Object { Test-Path (Join-Path $rawDir $_) })
if ($presentKeys.Count -gt 0) {
    $rawFilePaths = @($presentKeys | ForEach-Object { Join-Path $rawDir $_ })
    Write-ClientKeyEncryptNotice -Names $presentKeys
    $encryptResult = Invoke-SecretCryptoBatch -Password $password -Command encrypt -ArgumentList (@($encryptedDir) + $rawFilePaths)

    foreach ($keyName in $encryptResult.Done) {
        $rawFilePath = Join-Path $rawDir $keyName
        $encryptedFilePath = Join-Path $encryptedDir "$keyName.js"
        # Sync the raw file timestamp to the freshly written encrypted file so the
        # timestamp-based check treats this pair as up to date on the next run.
        try {
            (Get-Item $rawFilePath).LastWriteTime = (Get-Item $encryptedFilePath).LastWriteTime
        } catch {
        }
        # Refresh the encrypted-content hash cache so the decryption check does not
        # falsely prompt to re-decrypt this newly created encrypted file.
        Set-EncryptedContentHashCache -FileName $keyName -EncryptedFile $encryptedFilePath
        # Record the raw-content baseline so the encryption check can tell a real
        # content change from a mere timestamp bump on subsequent runs.
        if (Get-Command Set-RawContentHashCache -ErrorAction SilentlyContinue) {
            Set-RawContentHashCache -FileName $keyName -RawFile $rawFilePath
        }
        Write-Host "[SECRET_ENCRYPT_CHECK]   SUCCESS: $keyName -> $keyName.js" -ForegroundColor Green
        $successCount++
    }
    foreach ($keyName in $encryptResult.Failed) {
        Write-Host "[SECRET_ENCRYPT_CHECK]   FAILED: $keyName" -ForegroundColor Red
        $failCount++
    }
}

$password = $null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Encryption Summary:" -ForegroundColor Cyan
Write-Host "  Total:      $($filesNeedingEncryption.Count)" -ForegroundColor Cyan
Write-Host "  Encrypted:  $successCount" -ForegroundColor Green
Write-Host "  Failed:     $failCount" -ForegroundColor Red
Write-Host "  Output dir: $encryptedDir" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($successCount -gt 0) {
    Write-Host ""
    Write-Host "Secrets encrypted successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press Enter to continue..."
Read-Host
