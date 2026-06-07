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
$disguiseJs = ""
$dirs = $null
$password = ""
$securePassword = $null
$securePasswordConfirm = $null
$passwordConfirm = ""
$BSTR = [IntPtr]::Zero
$BSTRConfirm = [IntPtr]::Zero
$encryptChoice = ""
$successCount = 0
$failCount = 0
$rawFilePath = ""
$encryptedFilePath = ""
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

# Nothing to encrypt if the raw directory does not exist
if (-not (Test-Path $rawDir)) {
    return
}

# Detect raw files needing encryption (missing .js counterpart, or modified after decryption)
# Force array so .Count is always available (an empty result collapses to $null,
# which throws under Set-StrictMode when .Count is accessed).
$filesNeedingEncryption = @(Get-FilesNeedingReEncryption -RawDir $rawDir -EncryptedDir $encryptedDir -Quiet)

if ($filesNeedingEncryption.Count -eq 0) {
    return
}

# Locate the encryption tool up front so we can warn and bail cleanly if missing
$dirs = Get-SecretDirectories
$disguiseJs = Find-DisguiseTool -ScriptsDir $dirs.SCRIPTS_DIR

if ([string]::IsNullOrWhiteSpace($disguiseJs) -or -not (Test-Path $disguiseJs)) {
    Write-Host "[SECRET_ENCRYPT_CHECK] WARNING: disguise.js not found, cannot encrypt new secrets" -ForegroundColor Yellow
    return
}

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
$securePassword = Read-Host -Prompt "[SECRET_ENCRYPT_CHECK] Enter encryption password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

$securePasswordConfirm = Read-Host -Prompt "[SECRET_ENCRYPT_CHECK] Confirm encryption password" -AsSecureString
$BSTRConfirm = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePasswordConfirm)
try {
    $passwordConfirm = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTRConfirm)
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTRConfirm)
}

if ($password -ne $passwordConfirm) {
    Write-Host "[SECRET_ENCRYPT_CHECK] ERROR: Passwords do not match. Aborting encryption." -ForegroundColor Red
    $password = $null
    $passwordConfirm = $null
    return
}

$passwordConfirm = $null

if ([string]::IsNullOrWhiteSpace($password)) {
    Write-Host "[SECRET_ENCRYPT_CHECK] ERROR: Password is required. Aborting encryption." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "[SECRET_ENCRYPT_CHECK] Encrypting $($filesNeedingEncryption.Count) secret(s)..." -ForegroundColor Cyan

foreach ($keyName in $filesNeedingEncryption) {
    $rawFilePath = Join-Path $rawDir $keyName
    $encryptedFilePath = Join-Path $encryptedDir "$keyName.js"

    if (-not (Test-Path $rawFilePath)) {
        Write-Host "[SECRET_ENCRYPT_CHECK]   SKIP: $keyName (raw file missing)" -ForegroundColor Yellow
        continue
    }

    try {
        # disguise.js interface: node disguise.js INPUT_FILE PASSWORD [OUTPUT_DIR]
        $encryptResult = & $Global:NODE_EXE_PATH $disguiseJs $rawFilePath $password $encryptedDir

        if (Test-Path $encryptedFilePath) {
            # Sync the raw file timestamp to the freshly written encrypted file so the
            # timestamp-based check treats this pair as up to date on the next run.
            try {
                (Get-Item $rawFilePath).LastWriteTime = (Get-Item $encryptedFilePath).LastWriteTime
            } catch {
            }
            # Refresh the encrypted-content hash cache so the decryption check does not
            # falsely prompt to re-decrypt this newly created encrypted file.
            Set-EncryptedContentHashCache -FileName $keyName -EncryptedFile $encryptedFilePath
            Write-Host "[SECRET_ENCRYPT_CHECK]   SUCCESS: $keyName -> $keyName.js" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "[SECRET_ENCRYPT_CHECK]   FAILED: $keyName" -ForegroundColor Red
            Write-Host "[SECRET_ENCRYPT_CHECK]     Error: $encryptResult" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "[SECRET_ENCRYPT_CHECK]   FAILED: $keyName" -ForegroundColor Red
        Write-Host "[SECRET_ENCRYPT_CHECK]     Error: $($_.Exception.Message)" -ForegroundColor Red
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
