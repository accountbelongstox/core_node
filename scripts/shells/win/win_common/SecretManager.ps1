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

    $disguiseJs = Find-DisguiseTool -ScriptsDir $dirs.SCRIPTS_DIR

    if ([string]::IsNullOrWhiteSpace($disguiseJs) -or -not (Test-Path $disguiseJs)) {
        Write-Error "[SECRET_DECRYPT_ALL] ERROR: disguise.js not found in: $($dirs.SCRIPTS_DIR)"
        return $false
    }

    Write-Host "[SECRET_DECRYPT_ALL] Using decryption tool: $disguiseJs" -ForegroundColor Green

    if ([string]::IsNullOrWhiteSpace($Password)) {
        $securePassword = Read-Host -Prompt "[SECRET_DECRYPT_ALL] Enter decryption password" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try {
            $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
        }
    }

    if ([string]::IsNullOrWhiteSpace($Password)) {
        Write-Error "[SECRET_DECRYPT_ALL] ERROR: Password is required"
        return $false
    }

    $successCount = 0
    $failCount = 0

    foreach ($encryptedFile in $encryptedFiles) {
        $fileName = $encryptedFile.Name
        $keyName = [System.IO.Path]::GetFileNameWithoutExtension($fileName)

        Write-Host "[SECRET_DECRYPT_ALL] Decrypting: $fileName -> $keyName" -ForegroundColor Cyan

        try {
            $result = & node $encryptedFile.FullName pwd $Password $OutputDir 2>&1

            if ($LASTEXITCODE -eq 0) {
                Write-Host "[SECRET_DECRYPT_ALL]    SUCCESS: $keyName" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "[SECRET_DECRYPT_ALL]    FAILED: $keyName" -ForegroundColor Red
                Write-Host "[SECRET_DECRYPT_ALL]   Error: $result" -ForegroundColor Red
                $failCount++
            }
        } catch {
            Write-Host "[SECRET_DECRYPT_ALL]    FAILED: $keyName" -ForegroundColor Red
            Write-Host "[SECRET_DECRYPT_ALL]   Error: $($_.Exception.Message)" -ForegroundColor Red
            $failCount++
        }
    }

    Write-Host ""
    Write-Host "[SECRET_DECRYPT_ALL] ========================================" -ForegroundColor Cyan
    Write-Host "[SECRET_DECRYPT_ALL] Decryption Summary:" -ForegroundColor Cyan
    Write-Host "[SECRET_DECRYPT_ALL]   Total files: $($encryptedFiles.Count)" -ForegroundColor Cyan
    Write-Host "[SECRET_DECRYPT_ALL]   Successful:  $successCount" -ForegroundColor Green
    Write-Host "[SECRET_DECRYPT_ALL]   Failed:      $failCount" -ForegroundColor Red
    Write-Host "[SECRET_DECRYPT_ALL]   Output dir:  $OutputDir" -ForegroundColor Cyan
    Write-Host "[SECRET_DECRYPT_ALL] ========================================" -ForegroundColor Cyan

    $Password = $null

    if ($failCount -gt 0) {
        return $false
    }

    return $true
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

            $result = & node $disguiseJs $keyName $Password $content $dirs.ENCRYPTED_DIR 2>&1

            if ($LASTEXITCODE -eq 0 -and (Test-Path $outputFile)) {
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

Write-Host "[SECRET_MANAGER] Library loaded successfully" -ForegroundColor Green

Export-ModuleMember -Function @(
    'Invoke-SecretDecryptAll',
    'Invoke-SecretEncryptAll',
    'Get-SecretKey',
    'Get-AllSecretKeys',
    'Get-SecretDirectories',
    'Find-DisguiseTool',
    'Get-CoreNodeDir'
)
