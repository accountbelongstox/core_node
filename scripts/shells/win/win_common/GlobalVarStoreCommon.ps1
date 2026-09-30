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

<#
.SYNOPSIS
    Reads a secret password twice, shown in plain text so a typo is visible

.DESCRIPTION
    Retries on mismatch. Returns "" when the input is empty (skip), the entries never
    match, or the console is not interactive.
#>
function Read-SecretPassword {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    $maxAttempts = 3
    $attempt = 0
    $first = ""
    $second = ""

    if (-not [Environment]::UserInteractive -or [Console]::IsInputRedirected) {
        return ""
    }
    while ($attempt -lt $maxAttempts) {
        $attempt++
        $first = Read-Host -Prompt ("{0} password (shown as typed, empty skips)" -f $Label)
        if ([string]::IsNullOrEmpty($first)) {
            return ""
        }
        $second = Read-Host -Prompt ("{0} password again" -f $Label)
        if ($first -ceq $second) {
            return $first
        }
        Write-Host ("{0} passwords do not match ({1}/{2})" -f $Label, $attempt, $maxAttempts) -ForegroundColor Red
    }
    return ""
}
# OS tag helpers for per-OS var-center keys (identical implementation to
# CommonFunc.ps1; this file can be sourced standalone). A dual-boot machine
# SHARES the var center with Linux; keys whose value differs per OS are stored
# on disk as <TAG>_<KEY> so the two OSes never overwrite each other.
if (-not (Get-Command Get-OsVarTag -ErrorAction SilentlyContinue)) {
    function Get-OsVarTag {
        try {
            $build = [Environment]::OSVersion.Version.Build
            if ($build -ge 22000) { return 'WIN11' }
            return 'WIN10'
        } catch {
            return 'WIN10'
        }
    }
}
if ($null -eq (Get-Variable -Name 'SharedGlobalVarKeys' -Scope Script -ErrorAction SilentlyContinue) -or -not ((Get-Variable -Name 'SharedGlobalVarKeys' -Scope Script -ValueOnly -ErrorAction SilentlyContinue))) {
    $global:SharedGlobalVarKeys = @(
        'POSTGRES_PASSWORD',
        'MERCURE_PUBLISHER_JWT',
        'MERCURE_SUBSCRIBER_JWT',
        'DNSPOD_API_TOKEN',
        'DNSPOD_EMAIL',
        'TAILSCALE_DOMAIN_1',
        'DOMAIN_API_REGION_PREFIX',
        'DOMAIN_UI_BINDING',
        'START_WEB_SERVER',
        'WEB_SERVER_PLANE',
        'PHP_RUNTIME_PLANE',
        'SELECTED_REGION',
        'GIT_PUSH_BRANCH',
        'GIT_UPDATE_TYPE',
        'WINDOWS_RTC_UTC'
    )
}
if (-not (Get-Command Get-GlobalVarWriteName -ErrorAction SilentlyContinue)) {
    function Get-GlobalVarWriteName {
        param([string]$key)
        $normalized = ($key.ToUpper() -replace '[^A-Z0-9_]', '')
        if ($global:SharedGlobalVarKeys -contains $normalized) { return $normalized }
        return ('{0}_{1}' -f (Get-OsVarTag), $normalized)
    }
    function Get-GlobalVarReadNames {
        param([string]$key)
        $normalized = ($key.ToUpper() -replace '[^A-Z0-9_]', '')
        if ($global:SharedGlobalVarKeys -contains $normalized) { return @($normalized) }
        return @(('{0}_{1}' -f (Get-OsVarTag), $normalized), $normalized)
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
    foreach ($name in (Get-GlobalVarReadNames $key)) {
        $filePath = Join-Path $Global:GLOBAL_VAR_DIR $name
        if (Test-Path -LiteralPath $filePath -PathType Leaf) {
            $value = Get-Content -LiteralPath $filePath -Raw
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                return $value.Trim()
            }
        }
    }
    return $defaultValue
}

<#
.SYNOPSIS
    Absolute node.exe for the secret tools; installs Node.js once through the
    idempotent Step4_InstallNodeJS.ps1 when it is missing
#>
function Resolve-SecretNodeExe {
    $installScript = Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "install_powershells") "Step4_InstallNodeJS.ps1"
    $nodeCmd = $null

    if (Test-Path -LiteralPath $Global:NODE_EXE_PATH -PathType Leaf) {
        return $Global:NODE_EXE_PATH
    }
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        return $nodeCmd.Source
    }
    Write-Host "[SECRETS] Node.js not found; installing it with $installScript" -ForegroundColor Yellow
    & $installScript | Out-Host
    if (Test-Path -LiteralPath $Global:NODE_EXE_PATH -PathType Leaf) {
        return $Global:NODE_EXE_PATH
    }
    return "node"
}

<#
.SYNOPSIS
    First non-empty line of a decrypted secret ("" when missing; never decrypts)
#>
function Read-SecretValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $nodeExe = Resolve-SecretNodeExe
    $value = ""

    $value = (& $nodeExe $Global:SECRET_CRYPTO_JS read $Name 2>$null) | Select-Object -First 1
    if ($null -eq $value) {
        return ""
    }
    return [string]$value
}

<#
.SYNOPSIS
    Runs a node secret tool with its password on stdin

.DESCRIPTION
    The password never appears in a command line: secret_password_runner.js reads it
    from stdin and puts it where ArgumentList holds $Global:SECRET_PASSWORD_ARG.

.EXAMPLE
    Invoke-SecretPasswordTool -Password $pw -ToolPath $Global:SECRET_CRYPTO_JS -ArgumentList @("decrypt", $Global:SECRET_PASSWORD_ARG, $rawDir, $encFile)
#>
function Invoke-SecretPasswordTool {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Password,
        [Parameter(Mandatory = $true)]
        [string]$ToolPath,
        [string[]]$ArgumentList = @()
    )

    $nodeExe = Resolve-SecretNodeExe
    $OutputEncoding = New-Object System.Text.UTF8Encoding $false
    return ($Password | & $nodeExe $Global:SECRET_PASSWORD_RUNNER_JS $ToolPath @ArgumentList 2>&1)
}

<#
.SYNOPSIS
    Runs secret_crypto.js once for any number of files with one password

.DESCRIPTION
    Windows twin of linux/common/secret_tool_common.sh secret_crypto_batch. Parses the
    SECRET_CRYPTO<TAB>STATUS<TAB>NAME[<TAB>error] result lines into Done (decrypted /
    encrypted / verified), Skipped (already decrypted), Wrong (wrong password, nothing
    written) and Failed (unreadable file or I/O error).

.PARAMETER ArgumentList
    Everything after the password placeholder: OUT_DIR [--force] SRC... for decrypt/encrypt,
    or just SRC... for verify.

.EXAMPLE
    $result = Invoke-SecretCryptoBatch -Password $pw -Command decrypt -ArgumentList @($rawDir, "--force", $encFile)
#>
function Invoke-SecretCryptoBatch {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Password,
        [Parameter(Mandatory = $true)]
        [ValidateSet('decrypt', 'encrypt', 'verify')]
        [string]$Command,
        [string[]]$ArgumentList = @()
    )

    $output = @()
    $done = @()
    $skipped = @()
    $wrong = @()
    $failed = @()
    $line = ''
    $parts = $null

    $output = @(Invoke-SecretPasswordTool -Password $Password -ToolPath $Global:SECRET_CRYPTO_JS -ArgumentList (@($Command, $Global:SECRET_PASSWORD_ARG) + $ArgumentList))
    foreach ($line in $output) {
        $parts = $line -split "`t"
        if ($parts.Length -lt 3 -or $parts[0] -ne 'SECRET_CRYPTO') {
            continue
        }
        switch ($parts[1]) {
            'decrypted' { $done += $parts[2] }
            'encrypted' { $done += $parts[2] }
            'verified' { $done += $parts[2] }
            'skipped_exists' { $skipped += $parts[2] }
            'wrong_password' { $wrong += $parts[2] }
            default { $failed += $parts[2] }
        }
    }
    return [pscustomobject]@{ Done = $done; Skipped = $skipped; Wrong = $wrong; Failed = $failed }
}

# Tracked list of secrets encrypted with a password other than the main one (one
# name per line, '#' comments). Mirrors SECRET_MISMATCH_LIST in
# scripts/shells/linux/common/secret_tool_common.sh.
$Global:SECRET_MISMATCH_LIST_NAME = 'password_mismatch.list'
$Global:SECRET_MISMATCH_HEADER = '# Secrets encrypted with a different password; dd re-encrypts them with the main password'

function Get-SecretStorePaths {
    $secretKeysDir = Join-Path $Global:CORE_NODE_DIR '.secret_keys'
    return [pscustomobject]@{
        EncryptedDir = Join-Path $secretKeysDir 'already_encrypted'
        MismatchList = Join-Path $secretKeysDir $Global:SECRET_MISMATCH_LIST_NAME
    }
}

<#
.SYNOPSIS
    Listed second-password secrets whose encrypted copy still exists
#>
function Get-SecretMismatchNames {
    $paths = Get-SecretStorePaths
    $names = @()
    $line = ''

    if (-not (Test-Path -LiteralPath $paths.MismatchList)) {
        return @()
    }
    foreach ($line in [System.IO.File]::ReadAllLines($paths.MismatchList)) {
        $line = $line.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            continue
        }
        if (Test-Path -LiteralPath (Join-Path $paths.EncryptedDir "$line.js")) {
            $names += $line
        }
    }
    return @($names | Sort-Object -Unique)
}

function Set-SecretMismatchNames {
    param([string[]]$Names = @())

    $paths = Get-SecretStorePaths
    $unique = @($Names | Where-Object { $_ } | Sort-Object -Unique)
    if ($unique.Count -eq 0) {
        Remove-Item -LiteralPath $paths.MismatchList -Force -ErrorAction SilentlyContinue
        return
    }
    [System.IO.File]::WriteAllText($paths.MismatchList, ((@($Global:SECRET_MISMATCH_HEADER) + $unique) -join "`n") + "`n")
}

<#
.SYNOPSIS
    After a decrypt batch: when one password opened some secrets but not others,
    records the rejected ones (a second password) for dd to re-encrypt
#>
function Register-SecretPasswordSplit {
    param([Parameter(Mandatory = $true)]$BatchResult)

    $name = ''
    if (@($BatchResult.Done).Count -eq 0 -or @($BatchResult.Wrong).Count -eq 0) {
        return
    }
    Set-SecretMismatchNames -Names (@(Get-SecretMismatchNames) + @($BatchResult.Wrong))
    Write-Host ("[SECRETS] {0} secret(s) use a different password than the other {1}; recorded in {2}:" -f @($BatchResult.Wrong).Count, @($BatchResult.Done).Count, $Global:SECRET_MISMATCH_LIST_NAME) -ForegroundColor Yellow
    foreach ($name in $BatchResult.Wrong) {
        Write-Host "  - $name" -ForegroundColor Yellow
    }
    Write-Host '[SECRETS] On a host holding their plaintext, dd offers to re-encrypt them with the main password' -ForegroundColor Yellow
}

<#
.SYNOPSIS
    An encrypted secret carrying the main password (never a listed mismatched or
    an excluded one), used to check a password before encrypting with it
#>
function Get-SecretReferenceFile {
    param([string[]]$Excluded = @())

    $paths = Get-SecretStorePaths
    $skipped = @($Excluded) + @(Get-SecretMismatchNames)
    $candidate = $null

    if (-not (Test-Path -LiteralPath $paths.EncryptedDir)) {
        return ''
    }
    foreach ($candidate in (Get-ChildItem -LiteralPath $paths.EncryptedDir -Filter '*.js' -File | Sort-Object Name)) {
        if ($skipped -notcontains $candidate.BaseName) {
            return $candidate.FullName
        }
    }
    return ''
}

<#
.SYNOPSIS
    True when the password opens the reference secret (or none exists yet)
#>
function Test-SecretMainPassword {
    param(
        [Parameter(Mandatory = $true)][string]$Password,
        [string[]]$Excluded = @()
    )

    $reference = Get-SecretReferenceFile -Excluded $Excluded
    if (-not $reference) {
        return $true
    }
    return ((Invoke-SecretCryptoBatch -Password $Password -Command verify -ArgumentList @($reference)).Done.Count -gt 0)
}

<#
.SYNOPSIS
    Guard before encrypting: returns the password when it is the main one, or when
    the user explicitly accepts a different one (default No); otherwise ''
#>
function Confirm-SecretMainPassword {
    param(
        [string]$Password,
        [Parameter(Mandatory = $true)][string]$Label,
        [string[]]$Excluded = @()
    )

    $answer = ''
    if ([string]::IsNullOrEmpty($Password) -or (Test-SecretMainPassword -Password $Password -Excluded $Excluded)) {
        return $Password
    }
    Write-Host ("{0} This password does not decrypt {1}: encrypting with it would create a second secret password" -f $Label, [System.IO.Path]::GetFileName((Get-SecretReferenceFile -Excluded $Excluded))) -ForegroundColor Red
    $answer = Read-Host 'Encrypt with this different password anyway? [y/N]'
    if ($answer -match '^[Yy]') {
        return $Password
    }
    Write-Host "$Label Encryption cancelled; use the main secret password" -ForegroundColor Yellow
    return ''
}

<#
.SYNOPSIS
    Decrypts files using secret_crypto.js with batch processing capability

.DESCRIPTION
    This function handles decryption of .js encrypted files using secret_crypto.js. It
    supports batch decryption of all encrypted files with a single password input.

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
    $secretKeysDir = Join-Path $Global:CORE_NODE_DIR ".secret_keys"
    $rawDir = Join-Path $secretKeysDir ".secret_ignore"
    $encryptedDir = Join-Path $secretKeysDir "already_encrypted"
    $rawFile = Join-Path $rawDir $KeyName
    $encryptedFile = Join-Path $encryptedDir "$KeyName.js"

    # First check if raw file exists
    if (Test-Path -LiteralPath $rawFile -PathType Leaf) {
        $content = Get-Content -LiteralPath $rawFile -Raw -Encoding UTF8
        if (-not [string]::IsNullOrWhiteSpace($content)) {
            return $content.Trim()
        }
    }

    # Check if encrypted file exists
    if (-not (Test-Path -LiteralPath $encryptedFile -PathType Leaf)) {
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

            # Get password for batch decryption
            $plaintextPassword = Read-SecretPassword -Label "[DECRYPT] Decryption"

            if (-not [string]::IsNullOrWhiteSpace($plaintextPassword)) {
                # Ensure raw directory exists
                if (-not (Test-Path $rawDir)) {
                    New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
                }

                # Decrypt every pending file in one process with one password.
                $encryptedFilePaths = @($encryptedFiles | ForEach-Object { $_.FullName })
                Write-Host "[DECRYPT] Decrypting $($encryptedFiles.Count) file(s) in one batch..." -ForegroundColor Cyan
                $batchResult = Invoke-SecretCryptoBatch -Password $plaintextPassword -Command decrypt -ArgumentList (@($rawDir) + $encryptedFilePaths)

                foreach ($doneName in $batchResult.Done) {
                    Write-Host "[DECRYPT] SUCCESS: Decrypted $doneName" -ForegroundColor Green
                }
                foreach ($wrongName in $batchResult.Wrong) {
                    Write-Host "[DECRYPT] WARNING: Wrong password for $wrongName (nothing written)" -ForegroundColor Yellow
                }
                foreach ($failedName in $batchResult.Failed) {
                    Write-Host "[DECRYPT] ERROR: Failed to decrypt $failedName" -ForegroundColor Red
                }
                Write-Host "[DECRYPT] Batch decryption completed: $($batchResult.Done.Count)/$($encryptedFiles.Count) files decrypted" -ForegroundColor Cyan

                # Client-key regeneration lives in SecretManager.ps1, a higher layer that
                # not every caller of this file loads; call it only when present.
                if (Get-Command Invoke-ClientKeyAfterDecrypt -ErrorAction SilentlyContinue) {
                    Invoke-ClientKeyAfterDecrypt -Result $batchResult
                }
            } else {
                Write-Host "[DECRYPT] WARNING: Empty password provided, skipping batch decryption" -ForegroundColor Yellow
            }

            # Clear password from memory
            $plaintextPassword = $null
        }

        # Mark batch decryption as completed for this session
        $script:BatchDecryptionCompleted = $true
    }

    # Try to read the decrypted file again
    if (Test-Path -LiteralPath $rawFile -PathType Leaf) {
        $content = Get-Content -LiteralPath $rawFile -Raw -Encoding UTF8
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

    $filePath = Join-Path $Global:GLOBAL_VAR_DIR (Get-GlobalVarWriteName $key)
    if (Test-Path -LiteralPath $filePath -PathType Container) {
        Write-Warning "Global variable key collides with a directory and was not written: $key"
        return $false
    }
    Set-Content -LiteralPath $filePath -Value $value -Force
    return $true
}

function Import-LegacyGlobalVarDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LegacyDirectory
    )

    $currentTag = Get-OsVarTag
    $sourceFiles = @()
    $sourceFile = $null
    $sourceName = ''
    $targetName = ''
    $targetPath = ''

    if (-not (Test-Path -LiteralPath $LegacyDirectory -PathType Container)) {
        return
    }
    if (-not (Test-Path -LiteralPath $Global:GLOBAL_VAR_DIR -PathType Container)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
    }

    $sourceFiles = @(Get-ChildItem -LiteralPath $LegacyDirectory -File -ErrorAction SilentlyContinue)
    foreach ($sourceFile in $sourceFiles) {
        $sourceName = $sourceFile.Name
        if ($sourceName -match '^(WIN10|WIN11)_') {
            if (-not $sourceName.StartsWith("$currentTag`_", [System.StringComparison]::OrdinalIgnoreCase)) {
                continue
            }
            $targetName = $sourceName
        }
        elseif ($sourceName -match '^(DEBIAN|UBUNTU|KALI)_[0-9]+_') {
            continue
        }
        else {
            $targetName = Get-GlobalVarWriteName $sourceName
        }

        $targetPath = Join-Path $Global:GLOBAL_VAR_DIR $targetName
        if ((Test-Path -LiteralPath $targetPath -PathType Leaf) -or
            (Test-Path -LiteralPath $targetPath -PathType Container)) {
            continue
        }
        Copy-Item -LiteralPath $sourceFile.FullName -Destination $targetPath
    }
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
