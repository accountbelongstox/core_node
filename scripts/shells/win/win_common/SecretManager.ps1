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
    Secret Manager Library for PowerShell

.DESCRIPTION
    This library provides centralized encryption/decryption management for
    secret keys stored in the core_node project.

    Directory Structure:
        .secret_keys/
            already_encrypted/  - Encrypted files (*.js)
            .secret_ignore/     - Decrypted raw files (gitignored)

    Dependencies:
        - Node.js (for running disguise.js encryption/decryption tool)
        - GlobalVars.ps1 (for Get-CoreNodeDir function)

    Main Functions:
        1. Invoke-SecretDecryptAll    - Decrypt all encrypted files to specified directory
        2. Invoke-SecretEncryptAll    - Encrypt all files from source to already_encrypted
        3. Get-SecretKey              - Get single key value (auto-decrypt if needed)
        4. Get-AllSecretKeys          - Get all keys as hashtable
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Session state variable to track if batch decryption has been attempted
$script:BatchDecryptionCompleted = $false

# Source GlobalVars.ps1 if not already loaded
if (-not (Get-Command Get-CoreNodeDir -ErrorAction SilentlyContinue)) {
    $scriptDir = $PSScriptRoot
    $globalVarsPath = Join-Path $scriptDir "GlobalVars.ps1"

    if (Test-Path $globalVarsPath) {
        . $globalVarsPath
    } else {
        Write-Error "ERROR: GlobalVars.ps1 not found. Cannot determine core_node directory."
        exit 1
    }
}

<#
.SYNOPSIS
    Helper function to get core_node directory

.DESCRIPTION
    Dynamically determines the core_node root directory based on script location
#>
function Get-CoreNodeDir {
    $scriptPath = $PSScriptRoot

    if ([string]::IsNullOrWhiteSpace($scriptPath)) {
        $scriptPath = Get-Location
    }

    $currentDir = $scriptPath
    $maxDepth = 10
    $depth = 0

    while ($currentDir -and $depth -lt $maxDepth) {
        $secretKeysPath = Join-Path $currentDir ".secret_keys"
        $packageJsonPath = Join-Path $currentDir "package.json"

        if ((Test-Path $secretKeysPath) -or (Test-Path $packageJsonPath)) {
            return $currentDir
        }

        $parentDir = Split-Path $currentDir -Parent
        if ($parentDir -eq $currentDir) {
            break
        }
        $currentDir = $parentDir
        $depth++
    }

    if (Get-Variable -Name "Global:CORE_NODE_DIR" -ErrorAction SilentlyContinue) {
        return $Global:CORE_NODE_DIR
    }

    if (Get-Variable -Name "Global:BASE_DIR" -ErrorAction SilentlyContinue) {
        return $Global:BASE_DIR
    }

    if (Test-Path "D:\programing\core_node") {
        return "D:\programing\core_node"
    }

    throw "ERROR: Cannot determine core_node directory"
}

<#
.SYNOPSIS
    Helper function to get secret directories

.DESCRIPTION
    Returns hashtable with all secret-related directory paths
#>
function Get-SecretDirectories {
    $coreNodeDir = Get-CoreNodeDir
    $scriptsDir = Join-Path $coreNodeDir "scripts"
    $secretKeysDir = Join-Path $coreNodeDir ".secret_keys"
    $encryptedDir = Join-Path $secretKeysDir "already_encrypted"
    $rawDir = Join-Path $secretKeysDir ".secret_ignore"

    return @{
        CORE_NODE_DIR   = $coreNodeDir
        SCRIPTS_DIR     = $scriptsDir
        SECRET_KEYS_DIR = $secretKeysDir
        ENCRYPTED_DIR   = $encryptedDir
        RAW_DIR         = $rawDir
    }
}

<#
.SYNOPSIS
    Helper function to find disguise.js tool

.DESCRIPTION
    Searches for disguise.js in the scripts directory
#>
function Find-DisguiseTool {
    param(
        [string]$ScriptsDir
    )

    if (Test-Path $ScriptsDir) {
        $disguiseJs = Get-ChildItem -Path $ScriptsDir -Filter "disguise.js" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

        if ($disguiseJs) {
            return $disguiseJs.FullName
        }
    }

    return $null
}

<#
.SYNOPSIS
    Decrypt all encrypted files

.DESCRIPTION
    Decrypts all encrypted .js files from already_encrypted directory to output directory

.PARAMETER OutputDir
    Target directory for decrypted files (default: .secret_ignore)

.PARAMETER Password
    Decryption password (if not provided, will prompt)

.EXAMPLE
    Invoke-SecretDecryptAll
    Invoke-SecretDecryptAll -OutputDir "C:\temp\secrets" -Password "mypassword"
#>
function Invoke-SecretDecryptAll {
    param(
        [string]$OutputDir,
        [string]$Password
    )

    $dirs = Get-SecretDirectories

    if ([string]::IsNullOrWhiteSpace($OutputDir)) {
        $OutputDir = $dirs.RAW_DIR
    }

    if (-not (Test-Path $OutputDir)) {
        try {
            New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
        } catch {
            Write-Error "[SECRET_DECRYPT_ALL] ERROR: Failed to create output directory: $OutputDir"
            return $false
        }
    }

    if (-not (Test-Path $dirs.ENCRYPTED_DIR)) {
        Write-Error "[SECRET_DECRYPT_ALL] ERROR: Encrypted directory not found: $($dirs.ENCRYPTED_DIR)"
        return $false
    }

    $encryptedFiles = Get-ChildItem -Path $dirs.ENCRYPTED_DIR -Filter "*.js" -File -ErrorAction SilentlyContinue

    if ($encryptedFiles.Count -eq 0) {
        Write-Host "[SECRET_DECRYPT_ALL] No encrypted files found in: $($dirs.ENCRYPTED_DIR)" -ForegroundColor Yellow
        return $true
    }

    Write-Host "[SECRET_DECRYPT_ALL] Found $($encryptedFiles.Count) encrypted files" -ForegroundColor Cyan

    $batchDecryptJs = Join-Path $dirs.SCRIPTS_DIR "batch_decrypt.js"

    if ([string]::IsNullOrWhiteSpace($batchDecryptJs) -or -not (Test-Path $batchDecryptJs)) {
        Write-Error "[SECRET_DECRYPT_ALL] ERROR: batch_decrypt.js not found in: $($dirs.SCRIPTS_DIR)"
        return $false
    }

    Write-Host "[SECRET_DECRYPT_ALL] Using batch decryption tool: $batchDecryptJs" -ForegroundColor Green

    if ([string]::IsNullOrWhiteSpace($Password)) {
        $securePassword = Read-Host -Prompt "[SECRET_DECRYPT_ALL] Enter decryption password" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try {
            $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
        }

        $securePasswordConfirm = Read-Host -Prompt "[SECRET_DECRYPT_ALL] Confirm decryption password" -AsSecureString
        $BSTRConfirm = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePasswordConfirm)
        try {
            $passwordConfirm = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTRConfirm)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTRConfirm)
        }

        if ($Password -ne $passwordConfirm) {
            Write-Error "[SECRET_DECRYPT_ALL] ERROR: Passwords do not match"
            $Password = $null
            $passwordConfirm = $null
            return $false
        }

        $passwordConfirm = $null
    }

    if ([string]::IsNullOrWhiteSpace($Password)) {
        Write-Error "[SECRET_DECRYPT_ALL] ERROR: Password is required"
        return $false
    }

    Write-Host "[SECRET_DECRYPT_ALL] Starting batch decryption..." -ForegroundColor Cyan

    $filePaths = @()
    foreach ($encryptedFile in $encryptedFiles) {
        $filePaths += $encryptedFile.FullName
    }

    $allArgs = @($Password, $OutputDir) + $filePaths

    try {
        $result = & $Global:NODE_EXE_PATH $batchDecryptJs $allArgs 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host $result

            # Keep each decrypted raw file's timestamp in sync with its encrypted
            # source. The encryption check is timestamp-based (raw newer than the
            # ".js" means "needs re-encryption"), so without this a freshly
            # decrypted file would look newer than its source and be falsely flagged.
            if (Test-Path $OutputDir) {
                $syncedFiles = Get-ChildItem -Path $OutputDir -File -ErrorAction SilentlyContinue
                foreach ($syncedFile in $syncedFiles) {
                    $sourceEncFile = Join-Path $dirs.ENCRYPTED_DIR "$($syncedFile.Name).js"
                    if (Test-Path $sourceEncFile) {
                        try {
                            (Get-Item $syncedFile.FullName).LastWriteTime = (Get-Item $sourceEncFile).LastWriteTime
                        } catch {
                        }
                    }
                }
            }

            # Set decryption timestamp cache and encrypted content hash cache for all decrypted files
            if (Get-Command Set-DecryptionTimestampCache -ErrorAction SilentlyContinue) {
                if (Test-Path $OutputDir) {
                    $decryptedFiles = Get-ChildItem -Path $OutputDir -File -ErrorAction SilentlyContinue
                    foreach ($decryptedFile in $decryptedFiles) {
                        $baseName = $decryptedFile.Name
                        Set-DecryptionTimestampCache -FileName $baseName
                    }
                }

                # Cache encrypted file hashes
                foreach ($encryptedFile in $encryptedFiles) {
                    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($encryptedFile.Name)
                    if (Get-Command Set-EncryptedContentHashCache -ErrorAction SilentlyContinue) {
                        Set-EncryptedContentHashCache -FileName $baseName -EncryptedFile $encryptedFile.FullName
                    }
                }
            }

            $Password = $null
            return $true
        } else {
            Write-Host $result
            $Password = $null
            return $false
        }
    } catch {
        Write-Host "[SECRET_DECRYPT_ALL] ERROR: Batch decryption failed" -ForegroundColor Red
        Write-Host "[SECRET_DECRYPT_ALL]   Error: $($_.Exception.Message)" -ForegroundColor Red
        $Password = $null
        return $false
    }
}

<#
.SYNOPSIS
    Encrypt all files to already_encrypted

.DESCRIPTION
    Encrypts all non-hidden files from source directory to already_encrypted

.PARAMETER SourceDir
    Directory containing files to encrypt (required)

.PARAMETER Password
    Encryption password (if not provided, will prompt)

.EXAMPLE
    Invoke-SecretEncryptAll -SourceDir "C:\temp\raw_secrets"
    Invoke-SecretEncryptAll -SourceDir "C:\temp\raw_secrets" -Password "mypassword"
#>
function Invoke-SecretEncryptAll {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceDir,
        [string]$Password
    )

    if ([string]::IsNullOrWhiteSpace($SourceDir)) {
        Write-Error "[SECRET_ENCRYPT_ALL] ERROR: Source directory parameter is required"
        Write-Host "[SECRET_ENCRYPT_ALL] Usage: Invoke-SecretEncryptAll -SourceDir <path> [-Password <password>]" -ForegroundColor Yellow
        return $false
    }

    if (-not (Test-Path $SourceDir)) {
        Write-Error "[SECRET_ENCRYPT_ALL] ERROR: Source directory not found: $SourceDir"
        return $false
    }

    $dirs = Get-SecretDirectories

    if (-not (Test-Path $dirs.ENCRYPTED_DIR)) {
        try {
            New-Item -ItemType Directory -Path $dirs.ENCRYPTED_DIR -Force | Out-Null
        } catch {
            Write-Error "[SECRET_ENCRYPT_ALL] ERROR: Failed to create encrypted directory: $($dirs.ENCRYPTED_DIR)"
            return $false
        }
    }

    $disguiseJs = Find-DisguiseTool -ScriptsDir $dirs.SCRIPTS_DIR

    if ([string]::IsNullOrWhiteSpace($disguiseJs) -or -not (Test-Path $disguiseJs)) {
        Write-Error "[SECRET_ENCRYPT_ALL] ERROR: disguise.js not found in: $($dirs.SCRIPTS_DIR)"
        return $false
    }

    Write-Host "[SECRET_ENCRYPT_ALL] Using encryption tool: $disguiseJs" -ForegroundColor Green

    $sourceFiles = Get-ChildItem -Path $SourceDir -File -ErrorAction SilentlyContinue | Where-Object { -not $_.Name.StartsWith('.') }

    if ($sourceFiles.Count -eq 0) {
        Write-Host "[SECRET_ENCRYPT_ALL] No files found in: $SourceDir" -ForegroundColor Yellow
        return $true
    }

    Write-Host "[SECRET_ENCRYPT_ALL] Found $($sourceFiles.Count) files to encrypt" -ForegroundColor Cyan

    if ([string]::IsNullOrWhiteSpace($Password)) {
        $securePassword = Read-Host -Prompt "[SECRET_ENCRYPT_ALL] Enter encryption password" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try {
            $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
        }

        $securePasswordConfirm = Read-Host -Prompt "[SECRET_ENCRYPT_ALL] Confirm password" -AsSecureString
        $BSTRConfirm = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePasswordConfirm)
        try {
            $passwordConfirm = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTRConfirm)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTRConfirm)
        }

        if ($Password -ne $passwordConfirm) {
            Write-Error "[SECRET_ENCRYPT_ALL] ERROR: Passwords do not match"
            return $false
        }

        $passwordConfirm = $null
    }

    if ([string]::IsNullOrWhiteSpace($Password)) {
        Write-Error "[SECRET_ENCRYPT_ALL] ERROR: Password is required"
        return $false
    }

    $successCount = 0
    $failCount = 0

    foreach ($sourceFile in $sourceFiles) {
        $keyName = $sourceFile.Name
        $outputFile = Join-Path $dirs.ENCRYPTED_DIR "$keyName.js"

        Write-Host "[SECRET_ENCRYPT_ALL] Encrypting: $keyName -> $keyName.js" -ForegroundColor Cyan

        try {
            $content = Get-Content -Path $sourceFile.FullName -Raw -ErrorAction Stop

            if ([string]::IsNullOrWhiteSpace($content)) {
                Write-Host "[SECRET_ENCRYPT_ALL]    FAILED: Cannot read $keyName" -ForegroundColor Red
                $failCount++
                continue
            }

            $result = & $Global:NODE_EXE_PATH $disguiseJs $sourceFile.FullName $Password $dirs.ENCRYPTED_DIR

            if (Test-Path $outputFile) {
                Write-Host "[SECRET_ENCRYPT_ALL]    SUCCESS: $keyName.js" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "[SECRET_ENCRYPT_ALL]    FAILED: $keyName" -ForegroundColor Red
                Write-Host "[SECRET_ENCRYPT_ALL]   Error: $result" -ForegroundColor Red
                $failCount++
            }
        } catch {
            Write-Host "[SECRET_ENCRYPT_ALL]    FAILED: $keyName" -ForegroundColor Red
            Write-Host "[SECRET_ENCRYPT_ALL]   Error: $($_.Exception.Message)" -ForegroundColor Red
            $failCount++
        }
    }

    Write-Host ""
    Write-Host "[SECRET_ENCRYPT_ALL] ========================================" -ForegroundColor Cyan
    Write-Host "[SECRET_ENCRYPT_ALL] Encryption Summary:" -ForegroundColor Cyan
    Write-Host "[SECRET_ENCRYPT_ALL]   Total files: $($sourceFiles.Count)" -ForegroundColor Cyan
    Write-Host "[SECRET_ENCRYPT_ALL]   Successful:  $successCount" -ForegroundColor Green
    Write-Host "[SECRET_ENCRYPT_ALL]   Failed:      $failCount" -ForegroundColor Red
    Write-Host "[SECRET_ENCRYPT_ALL]   Output dir:  $($dirs.ENCRYPTED_DIR)" -ForegroundColor Cyan
    Write-Host "[SECRET_ENCRYPT_ALL] ========================================" -ForegroundColor Cyan

    $Password = $null

    if ($failCount -gt 0) {
        return $false
    }

    return $true
}

<#
.SYNOPSIS
    Get single secret key value

.DESCRIPTION
    Returns raw value if already decrypted, or auto-triggers batch decryption if needed

.PARAMETER KeyName
    Name of the secret key (required)

.EXAMPLE
    $apiKey = Get-SecretKey -KeyName "github_token"
#>
function Get-SecretKey {
    param(
        [Parameter(Mandatory = $true)]
        [string]$KeyName
    )

    if ([string]::IsNullOrWhiteSpace($KeyName)) {
        Write-Error "[SECRET_GET_KEY] ERROR: KeyName parameter is required"
        return $null
    }

    $dirs = Get-SecretDirectories
    $rawFile = Join-Path $dirs.RAW_DIR $KeyName
    $encryptedFile = Join-Path $dirs.ENCRYPTED_DIR "$KeyName.js"

    if (Test-Path $rawFile) {
        $content = Get-Content -Path $rawFile -Raw -ErrorAction SilentlyContinue
        if (-not [string]::IsNullOrWhiteSpace($content)) {
            return $content.Trim()
        }
    }

    if (-not (Test-Path $encryptedFile)) {
        Write-Error "[SECRET_GET_KEY] ERROR: Key not found: $KeyName"
        Write-Error "[SECRET_GET_KEY] Encrypted file missing: $encryptedFile"
        return $null
    }

    if (-not $script:BatchDecryptionCompleted) {
        Write-Host "[SECRET_GET_KEY] Raw file not found, triggering batch decryption..." -ForegroundColor Yellow

        if (Invoke-SecretDecryptAll -OutputDir $dirs.RAW_DIR) {
            $script:BatchDecryptionCompleted = $true
        } else {
            Write-Host "[SECRET_GET_KEY] WARNING: Batch decryption failed or incomplete" -ForegroundColor Yellow
        }
    }

    if (Test-Path $rawFile) {
        $content = Get-Content -Path $rawFile -Raw -ErrorAction SilentlyContinue
        if (-not [string]::IsNullOrWhiteSpace($content)) {
            return $content.Trim()
        }
    }

    Write-Error "[SECRET_GET_KEY] ERROR: Failed to retrieve key: $KeyName"
    return $null
}

<#
.SYNOPSIS
    Get all secret keys as hashtable

.DESCRIPTION
    Auto-decrypts if needed and returns all keys in a hashtable

.EXAMPLE
    $secrets = Get-AllSecretKeys
    Write-Host "Github token: $($secrets['github_token'])"
#>
function Get-AllSecretKeys {
    $dirs = Get-SecretDirectories

    if (-not (Test-Path $dirs.RAW_DIR)) {
        New-Item -ItemType Directory -Path $dirs.RAW_DIR -Force | Out-Null
    }

    $rawFiles = Get-ChildItem -Path $dirs.RAW_DIR -File -ErrorAction SilentlyContinue

    if ($rawFiles.Count -eq 0 -and -not $script:BatchDecryptionCompleted) {
        Write-Host "[SECRET_GET_ALL_KEYS] No decrypted files found, triggering batch decryption..." -ForegroundColor Yellow

        if (Invoke-SecretDecryptAll -OutputDir $dirs.RAW_DIR) {
            $script:BatchDecryptionCompleted = $true
        } else {
            Write-Host "[SECRET_GET_ALL_KEYS] WARNING: Batch decryption failed or incomplete" -ForegroundColor Yellow
        }
    }

    $secrets = @{}
    $keyCount = 0

    $rawFiles = Get-ChildItem -Path $dirs.RAW_DIR -File -ErrorAction SilentlyContinue

    foreach ($rawFile in $rawFiles) {
        $keyName = $rawFile.Name
        $content = Get-Content -Path $rawFile.FullName -Raw -ErrorAction SilentlyContinue

        if (-not [string]::IsNullOrWhiteSpace($content)) {
            $secrets[$keyName] = $content.Trim()
            $keyCount++
        }
    }

    Write-Host "[SECRET_GET_ALL_KEYS] Loaded $keyCount secret keys into hashtable" -ForegroundColor Cyan

    return $secrets
}

<#
.SYNOPSIS
    Set a single secret key with encryption

.DESCRIPTION
    Saves a secret key value to both raw and encrypted storage
    - Saves raw value to .secret_ignore directory (for quick access)
    - Encrypts and saves to already_encrypted directory (for secure storage)

.PARAMETER KeyName
    Name of the secret key (required)

.PARAMETER Value
    Value to save (required)

.PARAMETER Password
    Encryption password (if not provided, will prompt)

.PARAMETER SkipEncryption
    Skip encryption and only save raw file (default: false)

.EXAMPLE
    Set-SecretKey -KeyName "github_token" -Value "ghp_xxxxxxxxxxxx"
    Set-SecretKey -KeyName "api_key" -Value "sk-xxxx" -Password "mypassword"
    Set-SecretKey -KeyName "temp_value" -Value "test" -SkipEncryption
#>
function Set-SecretKey {
    param(
        [Parameter(Mandatory = $true)]
        [string]$KeyName,

        [Parameter(Mandatory = $true)]
        [string]$Value,

        [string]$Password,

        [switch]$SkipEncryption
    )

    if ([string]::IsNullOrWhiteSpace($KeyName)) {
        Write-Error "[SECRET_SET_KEY] ERROR: KeyName parameter is required"
        return $false
    }

    if ([string]::IsNullOrWhiteSpace($Value)) {
        Write-Error "[SECRET_SET_KEY] ERROR: Value parameter is required"
        return $false
    }

    $dirs = Get-SecretDirectories

    if (-not (Test-Path $dirs.RAW_DIR)) {
        New-Item -ItemType Directory -Path $dirs.RAW_DIR -Force | Out-Null
    }

    if (-not (Test-Path $dirs.ENCRYPTED_DIR)) {
        New-Item -ItemType Directory -Path $dirs.ENCRYPTED_DIR -Force | Out-Null
    }

    $rawFile = Join-Path $dirs.RAW_DIR $KeyName

    try {
        Set-Content -Path $rawFile -Value $Value -Encoding UTF8 -Force -NoNewline
        Write-Host "[SECRET_SET_KEY] Saved raw secret: $KeyName" -ForegroundColor Green
    } catch {
        Write-Error "[SECRET_SET_KEY] ERROR: Failed to save raw secret: $KeyName - $($_.Exception.Message)"
        return $false
    }

    if ($SkipEncryption) {
        Write-Host "[SECRET_SET_KEY] Skipped encryption for: $KeyName" -ForegroundColor Yellow
        return $true
    }

    $disguiseJs = Find-DisguiseTool -ScriptsDir $dirs.SCRIPTS_DIR

    if ([string]::IsNullOrWhiteSpace($disguiseJs) -or -not (Test-Path $disguiseJs)) {
        Write-Host "[SECRET_SET_KEY] WARNING: disguise.js not found, saved without encryption" -ForegroundColor Yellow
        return $true
    }

    if ([string]::IsNullOrWhiteSpace($Password)) {
        $securePassword = Read-Host -Prompt "[SECRET_SET_KEY] Enter encryption password" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try {
            $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
        }
    }

    if ([string]::IsNullOrWhiteSpace($Password)) {
        Write-Host "[SECRET_SET_KEY] WARNING: No password provided, saved without encryption" -ForegroundColor Yellow
        return $true
    }

    try {
        $result = & $Global:NODE_EXE_PATH $disguiseJs $rawFile $Password $dirs.ENCRYPTED_DIR

        $encryptedFile = Join-Path $dirs.ENCRYPTED_DIR "$KeyName.js"
        if (Test-Path $encryptedFile) {
            Write-Host "[SECRET_SET_KEY] Encrypted and saved: $KeyName" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[SECRET_SET_KEY] WARNING: Encryption failed, saved without encryption" -ForegroundColor Yellow
            Write-Host "[SECRET_SET_KEY]   Error: $result" -ForegroundColor Red
            return $true
        }
    } catch {
        Write-Host "[SECRET_SET_KEY] WARNING: Encryption error, saved without encryption" -ForegroundColor Yellow
        Write-Host "[SECRET_SET_KEY]   Error: $($_.Exception.Message)" -ForegroundColor Red
        return $true
    }

    $Password = $null
}

<#
.SYNOPSIS
    Batch save multiple secret keys with single password encryption

.DESCRIPTION
    Saves multiple secret key-value pairs to both raw and encrypted storage
    Only prompts for password once for all keys

.PARAMETER Secrets
    Hashtable of key-value pairs to save

.PARAMETER Password
    Encryption password (if not provided, will prompt once)

.PARAMETER SkipEncryption
    Skip encryption for all keys (default: false)

.EXAMPLE
    $secrets = @{
        "API_KEY_1" = "value1"
        "API_KEY_2" = "value2"
        "TOKEN_1" = "token_value"
    }
    Set-SecretKeyBatch -Secrets $secrets
#>
function Set-SecretKeyBatch {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Secrets,

        [string]$Password,

        [switch]$SkipEncryption
    )

    if ($Secrets.Count -eq 0) {
        Write-Host "[SECRET_SET_KEY_BATCH] WARNING: No secrets to save" -ForegroundColor Yellow
        return $true
    }

    $dirs = Get-SecretDirectories

    if (-not (Test-Path $dirs.RAW_DIR)) {
        New-Item -ItemType Directory -Path $dirs.RAW_DIR -Force | Out-Null
    }

    if (-not (Test-Path $dirs.ENCRYPTED_DIR)) {
        New-Item -ItemType Directory -Path $dirs.ENCRYPTED_DIR -Force | Out-Null
    }

    Write-Host "[SECRET_SET_KEY_BATCH] Saving $($Secrets.Count) secrets..." -ForegroundColor Cyan

    $savedCount = 0
    $rawFiles = @()

    foreach ($keyName in $Secrets.Keys) {
        $value = $Secrets[$keyName]

        if ([string]::IsNullOrWhiteSpace($keyName) -or [string]::IsNullOrWhiteSpace($value)) {
            Write-Host "[SECRET_SET_KEY_BATCH] Skipping empty key or value" -ForegroundColor Yellow
            continue
        }

        $rawFile = Join-Path $dirs.RAW_DIR $keyName

        try {
            Set-Content -Path $rawFile -Value $value -Encoding UTF8 -Force -NoNewline
            Write-Host "[SECRET_SET_KEY_BATCH] Saved raw secret: $keyName" -ForegroundColor Green
            $savedCount++
            $rawFiles += $rawFile
        } catch {
            Write-Host "[SECRET_SET_KEY_BATCH] ERROR: Failed to save $keyName - $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    Write-Host "[SECRET_SET_KEY_BATCH] Saved $savedCount raw secrets" -ForegroundColor Green

    if ($SkipEncryption) {
        Write-Host "[SECRET_SET_KEY_BATCH] Skipped encryption (as requested)" -ForegroundColor Yellow
        return $true
    }

    $disguiseJs = Find-DisguiseTool -ScriptsDir $dirs.SCRIPTS_DIR

    if ([string]::IsNullOrWhiteSpace($disguiseJs) -or -not (Test-Path $disguiseJs)) {
        Write-Host "[SECRET_SET_KEY_BATCH] WARNING: disguise.js not found, saved without encryption" -ForegroundColor Yellow
        return $true
    }

    if ([string]::IsNullOrWhiteSpace($Password)) {
        Write-Host ""
        Write-Host "[SECRET_SET_KEY_BATCH] ========================================" -ForegroundColor Cyan
        Write-Host "[SECRET_SET_KEY_BATCH] Encryption Setup" -ForegroundColor Cyan
        Write-Host "[SECRET_SET_KEY_BATCH] ========================================" -ForegroundColor Cyan
        Write-Host "[SECRET_SET_KEY_BATCH] You need to provide a password to encrypt all $savedCount secrets" -ForegroundColor Yellow
        Write-Host ""

        $securePassword = Read-Host -Prompt "[SECRET_SET_KEY_BATCH] Enter encryption password" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try {
            $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
        }

        $securePasswordConfirm = Read-Host -Prompt "[SECRET_SET_KEY_BATCH] Confirm encryption password" -AsSecureString
        $BSTRConfirm = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePasswordConfirm)
        try {
            $passwordConfirm = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTRConfirm)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTRConfirm)
        }

        if ($Password -ne $passwordConfirm) {
            Write-Host "[SECRET_SET_KEY_BATCH] WARNING: Passwords do not match, saved without encryption" -ForegroundColor Yellow
            $Password = $null
            $passwordConfirm = $null
            return $true
        }

        $passwordConfirm = $null
    }

    if ([string]::IsNullOrWhiteSpace($Password)) {
        Write-Host "[SECRET_SET_KEY_BATCH] WARNING: No password provided, saved without encryption" -ForegroundColor Yellow
        return $true
    }

    Write-Host ""
    Write-Host "[SECRET_SET_KEY_BATCH] ========================================" -ForegroundColor Cyan
    Write-Host "[SECRET_SET_KEY_BATCH] Encrypting $savedCount secrets..." -ForegroundColor Cyan
    Write-Host "[SECRET_SET_KEY_BATCH] ========================================" -ForegroundColor Cyan

    $encryptedCount = 0
    $failedCount = 0

    foreach ($rawFile in $rawFiles) {
        $keyName = [System.IO.Path]::GetFileName($rawFile)

        try {
            $result = & $Global:NODE_EXE_PATH $disguiseJs $rawFile $Password $dirs.ENCRYPTED_DIR

            $encryptedFile = Join-Path $dirs.ENCRYPTED_DIR "$keyName.js"
            if (Test-Path $encryptedFile) {
                Write-Host "[SECRET_SET_KEY_BATCH]   SUCCESS: $keyName" -ForegroundColor Green
                $encryptedCount++
            } else {
                Write-Host "[SECRET_SET_KEY_BATCH]   FAILED: $keyName" -ForegroundColor Red
                Write-Host "[SECRET_SET_KEY_BATCH]     Error: $result" -ForegroundColor Red
                $failedCount++
            }
        } catch {
            Write-Host "[SECRET_SET_KEY_BATCH]   FAILED: $keyName" -ForegroundColor Red
            Write-Host "[SECRET_SET_KEY_BATCH]     Error: $($_.Exception.Message)" -ForegroundColor Red
            $failedCount++
        }
    }

    Write-Host ""
    Write-Host "[SECRET_SET_KEY_BATCH] ========================================" -ForegroundColor Cyan
    Write-Host "[SECRET_SET_KEY_BATCH] Encryption Summary:" -ForegroundColor Cyan
    Write-Host "[SECRET_SET_KEY_BATCH]   Total:      $savedCount" -ForegroundColor Cyan
    Write-Host "[SECRET_SET_KEY_BATCH]   Encrypted:  $encryptedCount" -ForegroundColor Green
    Write-Host "[SECRET_SET_KEY_BATCH]   Failed:     $failedCount" -ForegroundColor Red
    Write-Host "[SECRET_SET_KEY_BATCH] ========================================" -ForegroundColor Cyan

    $Password = $null

    if ($failedCount -gt 0) {
        Write-Host "[SECRET_SET_KEY_BATCH] WARNING: Some secrets failed to encrypt but raw files are saved" -ForegroundColor Yellow
    }

    return $true
}

<#
.SYNOPSIS
    Clear all decrypted secrets and re-decrypt them

.DESCRIPTION
    Clears all decrypted files from .secret_ignore directory and triggers batch decryption again
    Useful for refreshing decrypted files or re-entering password

.EXAMPLE
    Clear-AndRedecryptSecrets
#>
function Clear-AndRedecryptSecrets {
    $dirs = Get-SecretDirectories
    $fileCount = 0

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Clear and Re-decrypt Secret Keys" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    if (-not (Test-Path $dirs.ENCRYPTED_DIR)) {
        Write-Host "[INFO] No encrypted directory found at: $($dirs.ENCRYPTED_DIR)" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to continue"
        return $true
    }

    if (-not (Test-Path $dirs.RAW_DIR)) {
        Write-Host "[INFO] No decrypted directory found. Nothing to clear." -ForegroundColor Yellow
        Write-Host "[INFO] Proceeding to decrypt..." -ForegroundColor Cyan
        Write-Host ""
    } else {
        $decryptedFiles = Get-ChildItem -Path $dirs.RAW_DIR -File -ErrorAction SilentlyContinue
        $fileCount = $decryptedFiles.Count

        if ($fileCount -eq 0) {
            Write-Host "[INFO] No decrypted files found in: $($dirs.RAW_DIR)" -ForegroundColor Yellow
            Write-Host "[INFO] Proceeding to decrypt..." -ForegroundColor Cyan
            Write-Host ""
        } else {
            Write-Host "Decrypted files location: $($dirs.RAW_DIR)" -ForegroundColor White
            Write-Host "Found $fileCount decrypted file(s)" -ForegroundColor White
            Write-Host ""
            Write-Host "[WARNING] This will permanently delete all decrypted secret files!" -ForegroundColor Yellow
            Write-Host "[WARNING] You will need to re-enter the password to decrypt them again." -ForegroundColor Yellow
            Write-Host ""

            $confirmChoice = Read-Host "Are you sure you want to clear all decrypted files? (yes/no)"

            if ($confirmChoice -notmatch "^[Yy](es)?$") {
                Write-Host "[CANCELLED] Operation cancelled. No files were deleted." -ForegroundColor Green
                Write-Host ""
                Read-Host "Press Enter to continue"
                return $true
            }

            Write-Host ""
            Write-Host "[CLEARING] Removing all decrypted files..." -ForegroundColor Cyan

            try {
                Remove-Item -Path "$($dirs.RAW_DIR)\*" -Force -ErrorAction Stop
                Write-Host "[SUCCESS] All decrypted files have been cleared" -ForegroundColor Green
            } catch {
                Write-Host "[ERROR] Failed to clear some files: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host ""
                Read-Host "Press Enter to continue"
                return $false
            }
        }
    }

    Write-Host ""
    Write-Host "[RE-DECRYPT] Starting re-decryption process..." -ForegroundColor Cyan
    Write-Host ""

    $script:BatchDecryptionCompleted = $false

    $result = Invoke-SecretDecryptAll -OutputDir $dirs.RAW_DIR

    Write-Host ""
    Read-Host "Press Enter to continue"

    return $result
}

<#
.SYNOPSIS
    Check which files need (re-)encryption using file timestamp comparison

.DESCRIPTION
    A raw file in RawDir needs encryption when either:
      - it has no corresponding "<name>.js" file in EncryptedDir, or
      - its LastWriteTime is newer than that of its "<name>.js" counterpart.
    Files whose encrypted counterpart is up to date are skipped. This is a
    deterministic timestamp rule and does not depend on the secret cache.

.PARAMETER RawDir
    Directory containing decrypted files

.PARAMETER EncryptedDir
    Directory containing encrypted files

.PARAMETER Quiet
    Suppress per-file status output (used during startup checks)

.RETURNS
    Array of file names that need re-encryption

.EXAMPLE
    $filesToReEncrypt = Get-FilesNeedingReEncryption -RawDir "C:\raw" -EncryptedDir "C:\encrypted"
#>
function Get-FilesNeedingReEncryption {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RawDir,

        [Parameter(Mandatory = $true)]
        [string]$EncryptedDir,

        [switch]$Quiet
    )

    $filesNeedReEncrypt = @()

    if (-not (Test-Path $RawDir) -or -not (Test-Path $EncryptedDir)) {
        return $filesNeedReEncrypt
    }

    $rawFiles = Get-ChildItem -Path $RawDir -File -ErrorAction SilentlyContinue

    foreach ($rawFile in $rawFiles) {
        $baseName = $rawFile.Name
        $encFile = Join-Path $EncryptedDir "$baseName.js"

        if (-not (Test-Path $encFile)) {
            # No encrypted file exists - needs encryption
            $filesNeedReEncrypt += $baseName
            if (-not $Quiet) {
                Write-Host "[ENCRYPT CHECK] $baseName has no encrypted file - needs encryption" -ForegroundColor Yellow
            }
        } elseif ((Get-Item $rawFile.FullName).LastWriteTime -gt (Get-Item $encFile).LastWriteTime) {
            # Raw file is newer than its encrypted counterpart - needs re-encryption
            $filesNeedReEncrypt += $baseName
            if (-not $Quiet) {
                Write-Host "[ENCRYPT CHECK] $baseName is newer than its encrypted file - needs re-encryption" -ForegroundColor Yellow
            }
        } else {
            # Encrypted file is up to date - skip
            if (-not $Quiet) {
                Write-Host "[ENCRYPT SKIP] $baseName unchanged since encryption - skipping" -ForegroundColor Green
            }
        }
    }

    return $filesNeedReEncrypt
}

Write-Host "[SECRET_MANAGER] Library loaded successfully" -ForegroundColor Green

# Note: This is a script file (.ps1), not a module (.psm1)
# When dot-sourced (using . $script:SECRET_MANAGER_PATH), all functions are automatically loaded into the current scope
# Export-ModuleMember is only for module files and should not be used here
