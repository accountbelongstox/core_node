# Shared encrypted global-variable storage functions.

function Invoke-GlobalVarEncryption {
    param([string]$Content, [string]$Password)
    
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Content)
    $passwordBytes = [System.Text.Encoding]::UTF8.GetBytes($Password)
    
    # Generate salt and IV
    $salt = New-Object byte[] 32
    $iv = New-Object byte[] 16
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($salt)
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($iv)
    
    # Derive key from password
    $pbkdf2 = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($passwordBytes, $salt, 10000)
    $key = $pbkdf2.GetBytes(32)
    
    # Encrypt content
    $aes = [System.Security.Cryptography.Aes]::Create()
    $aes.Key = $key
    $aes.IV = $iv
    $encryptor = $aes.CreateEncryptor()
    $encryptedBytes = $encryptor.TransformFinalBlock($bytes, 0, $bytes.Length)
    
    # Combine salt + IV + encrypted data
    $result = New-Object byte[] ($salt.Length + $iv.Length + $encryptedBytes.Length)
    [Array]::Copy($salt, 0, $result, 0, $salt.Length)
    [Array]::Copy($iv, 0, $result, $salt.Length, $iv.Length)
    [Array]::Copy($encryptedBytes, 0, $result, $salt.Length + $iv.Length, $encryptedBytes.Length)
    
    return [Convert]::ToBase64String($result)
}

function Invoke-GlobalVarDecryption {
    param([string]$EncryptedContent, [string]$Password)
    
    try {
        $encryptedBytes = [Convert]::FromBase64String($EncryptedContent)
        $passwordBytes = [System.Text.Encoding]::UTF8.GetBytes($Password)
        
        # Extract salt, IV, and encrypted data
        $salt = New-Object byte[] 32
        $iv = New-Object byte[] 16
        $encrypted = New-Object byte[] ($encryptedBytes.Length - 48)
        
        [Array]::Copy($encryptedBytes, 0, $salt, 0, 32)
        [Array]::Copy($encryptedBytes, 32, $iv, 0, 16)
        [Array]::Copy($encryptedBytes, 48, $encrypted, 0, $encrypted.Length)
        
        # Derive key from password
        $pbkdf2 = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($passwordBytes, $salt, 10000)
        $key = $pbkdf2.GetBytes(32)
        
        # Decrypt content
        $aes = [System.Security.Cryptography.Aes]::Create()
        $aes.Key = $key
        $aes.IV = $iv
        $decryptor = $aes.CreateDecryptor()
        $decryptedBytes = $decryptor.TransformFinalBlock($encrypted, 0, $encrypted.Length)
        
        return [System.Text.Encoding]::UTF8.GetString($decryptedBytes)
    } catch {
        return $null
    }
}

function Get-SecurePasswordForGlobalVar {
    param([string]$Prompt = "Enter password")
    
    $securePassword = Read-Host -Prompt $Prompt -AsSecureString
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}
function Get-GlobalVar {
    param (
        [string]$key,
        [object]$defaultValue = $null
    )

    # Use simplified secret keys directory structure
    $globalVarsDir = Join-Path $Global:CORE_NODE_DIR "ncore\global_vars"
    $secretKeysDir = Join-Path $globalVarsDir "secret_keys"
    $rawDir = Join-Path $secretKeysDir "raw"
    $encryptedDir = Join-Path $secretKeysDir "already_encrypted"

    # Try to get decrypted content using the new system
    $decryptedContent = Get-SecretContent -KeyName $key

    if ($null -ne $decryptedContent -and -not [string]::IsNullOrWhiteSpace($decryptedContent)) {
        return $decryptedContent.Trim()
    }

    # Fallback to regular global var file
    # Ensure directory exists
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
    }
    $filePath = Join-Path $Global:GLOBAL_VAR_DIR $key
    if (Test-Path $filePath) {
        $value = Get-Content $filePath -Raw
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    }
    return $defaultValue
}

<#
.SYNOPSIS
    Decrypts files using disguise.js system with batch processing capability

.DESCRIPTION
    This function handles decryption of .js encrypted files using the disguise.js system.
    It supports batch decryption of all encrypted files with a single password input.

.PARAMETER EncryptedFilePath
    Path to the encrypted .js file

.PARAMETER KeyName
    Name of the key being decrypted (for user prompts)

.EXAMPLE
    $content = Get-SecretContent -EncryptedFilePath "path/to/file.js" -KeyName "API_KEY"
#>
function Get-SecretContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$KeyName
    )

    # Variables declaration
    $scriptsDir = Join-Path $Global:CORE_NODE_DIR "scripts"
    $secretKeysDir = Join-Path $Global:CORE_NODE_DIR ".secret_keys"
    $rawDir = Join-Path $secretKeysDir ".secret_ignore"
    $encryptedDir = Join-Path $secretKeysDir "already_encrypted"
    $rawFile = Join-Path $rawDir $KeyName
    $encryptedFile = Join-Path $encryptedDir "$KeyName.js"

    # First check if raw file exists
    if (Test-Path $rawFile) {
        $content = Get-Content -Path $rawFile -Raw -Encoding UTF8
        if (-not [string]::IsNullOrWhiteSpace($content)) {
            return $content.Trim()
        }
    }

    # Check if encrypted file exists
    if (-not (Test-Path $encryptedFile)) {
        return $null
    }

    # Check if we need to perform batch decryption
    if (-not $script:BatchDecryptionCompleted) {
        Write-Host "[DECRYPT] Checking for encrypted files requiring batch decryption..." -ForegroundColor Cyan

        # Find all encrypted .js files that don't have corresponding raw files
        $encryptedFiles = @()
        if (Test-Path $encryptedDir) {
            $allEncryptedFiles = Get-ChildItem -Path $encryptedDir -Filter "*.js"

            foreach ($encFile in $allEncryptedFiles) {
                $rawFileName = [System.IO.Path]::GetFileNameWithoutExtension($encFile.Name)
                $rawFilePath = Join-Path $rawDir $rawFileName

                if (-not (Test-Path $rawFilePath)) {
                    $encryptedFiles += $encFile
                }
            }
        }

        if ($encryptedFiles.Count -gt 0) {
            Write-Host "[DECRYPT] Found $($encryptedFiles.Count) encrypted files requiring decryption" -ForegroundColor Yellow

            # Find disguise.js
            $disguiseJs = $null
            if (Test-Path $scriptsDir) {
                $disguiseJs = Get-ChildItem -Path $scriptsDir -Name "disguise.js" -Recurse | Select-Object -First 1
                if ($disguiseJs) {
                    $disguiseJs = Join-Path $scriptsDir $disguiseJs
                }
            }

            if ($disguiseJs) {
                Write-Host "[DECRYPT] Found decryption tool: $disguiseJs" -ForegroundColor Green

                # Get password for batch decryption
                Write-Host "[DECRYPT] Enter decryption password for all encrypted files: " -NoNewline -ForegroundColor Yellow
                $password = Read-Host -AsSecureString
                $plaintextPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

                if (-not [string]::IsNullOrWhiteSpace($plaintextPassword)) {
                    # Ensure raw directory exists
                    if (-not (Test-Path $rawDir)) {
                        New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
                    }

                    # Decrypt each file
                    $successCount = 0
                    foreach ($encryptedFile in $encryptedFiles) {
                        Write-Host "[DECRYPT] Decrypting: $($encryptedFile.Name)" -ForegroundColor Cyan

                        try {
                            # Use node to decrypt the .js file
                            $result = & node $encryptedFile.FullName pwd $plaintextPassword $rawDir 2>&1
                            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($encryptedFile.Name)
                            $decryptedPath = Join-Path $rawDir $baseName

                            if ((Test-Path $decryptedPath) -and ((Get-Item $decryptedPath).Length -gt 0)) {
                                Write-Host "[DECRYPT] SUCCESS: Decrypted $($encryptedFile.Name)" -ForegroundColor Green
                                $successCount++
                            } else {
                                Write-Host "[DECRYPT] WARNING: Failed to decrypt $($encryptedFile.Name)" -ForegroundColor Yellow
                                Write-Host "[DECRYPT] Error: $result" -ForegroundColor Yellow
                            }
                        } catch {
                            Write-Host "[DECRYPT] ERROR: Exception decrypting $($encryptedFile.Name) - $($_.Exception.Message)" -ForegroundColor Red
                        }
                    }

                    Write-Host "[DECRYPT] Batch decryption completed: $successCount/$($encryptedFiles.Count) files decrypted" -ForegroundColor Cyan
                } else {
                    Write-Host "[DECRYPT] WARNING: Empty password provided, skipping batch decryption" -ForegroundColor Yellow
                }

                # Clear password from memory
                $plaintextPassword = $null
            } else {
                Write-Host "[DECRYPT] WARNING: disguise.js not found in scripts directory" -ForegroundColor Yellow
            }
        }

        # Mark batch decryption as completed for this session
        $script:BatchDecryptionCompleted = $true
    }

    # Try to read the decrypted file again
    if (Test-Path $rawFile) {
        $content = Get-Content -Path $rawFile -Raw -Encoding UTF8
        if (-not [string]::IsNullOrWhiteSpace($content)) {
            return $content.Trim()
        }
    }

    return $null
}

<#
.SYNOPSIS
    Resolve an indexed secret: first non-empty of <BaseName>_1.._MaxIndex then bare <BaseName>.

.DESCRIPTION
    Windows twin of pyfoundations.secret_manager.get_secret_key_indexed. Defers to
    Get-SecretContent for each candidate so the same raw/decrypt rules apply.

.EXAMPLE
    $token = Get-SecretContentIndexed -BaseName "HF_TOKEN"
#>
function Get-SecretContentIndexed {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseName,
        [int]$MaxIndex = 5
    )

    # Variables declaration
    $value = $null
    $candidate = $null
    $i = 0

    for ($i = 1; $i -le $MaxIndex; $i++) {
        $candidate = Get-SecretContent -KeyName ("{0}_{1}" -f $BaseName, $i)
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return $candidate.Trim()
        }
    }

    $value = Get-SecretContent -KeyName $BaseName
    if (-not [string]::IsNullOrWhiteSpace($value)) {
        return $value.Trim()
    }
    return $null
}

# Initialize batch decryption flag
$script:BatchDecryptionCompleted = $false
function Set-GlobalVar {
    param (
        [string]$key,
        [string]$value
    )
    
    # Ensure directory exists
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
    }
    
    $filePath = Join-Path $Global:GLOBAL_VAR_DIR $key
    Set-Content -Path $filePath -Value $value -Force
}
function Get-AllGlobalVars {
    # Ensure directory exists
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
    }

    $vars = @{}
    $maxFileSizeMB = 10
    $maxFileSizeBytes = $maxFileSizeMB * 1MB

    # Removed verbose output - reading GlobalVars silently now

    Get-ChildItem $Global:GLOBAL_VAR_DIR -File -ErrorAction SilentlyContinue | ForEach-Object {
        $fileSizeMB = [math]::Round($_.Length / 1MB, 2)
        $fileSizeKB = [math]::Round($_.Length / 1KB, 2)

        # Silent mode - only show errors
        # if ($_.Length -gt 1MB) {
        #     Write-Host "  Reading file: $($_.Name) (Size: $fileSizeMB MB)" -ForegroundColor Yellow
        # } else {
        #     Write-Host "  Reading file: $($_.Name) (Size: $fileSizeKB KB)" -ForegroundColor Gray
        # }

        # Check if file exceeds size limit
        if ($_.Length -gt $maxFileSizeBytes) {
            Write-Host "    WARNING: File exceeds ${maxFileSizeMB}MB limit - DELETING: $($_.Name)" -ForegroundColor Red
            try {
                Remove-Item -Path $_.FullName -Force -ErrorAction Stop
                Write-Host "    DELETED: $($_.Name)" -ForegroundColor Red
            } catch {
                Write-Host "    ERROR: Failed to delete file - $($_.Exception.Message)" -ForegroundColor Red
            }
            $vars[$_.Name] = ""
            return
        }

        try {
            $vars[$_.Name] = Get-Content $_.FullName -Raw -ErrorAction Stop
            # Write-Host "    OK" -ForegroundColor Green  # Removed - silent mode
        } catch [System.OutOfMemoryException] {
            Write-Host "    ERROR: Out of memory reading file: $($_.Name)" -ForegroundColor Red
            Write-Host "    File size: $fileSizeMB MB - DELETING" -ForegroundColor Red
            try {
                Remove-Item -Path $_.FullName -Force -ErrorAction Stop
                Write-Host "    DELETED: $($_.Name)" -ForegroundColor Red
            } catch {
                Write-Host "    ERROR: Failed to delete file - $($_.Exception.Message)" -ForegroundColor Red
            }
            $vars[$_.Name] = ""
        } catch {
            Write-Host "    ERROR: $($_.Exception.Message)" -ForegroundColor Red
            $vars[$_.Name] = ""
        }
    }

    return $vars
}
