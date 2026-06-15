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
    Enhanced Secret Cache Management for Windows PowerShell

.DESCRIPTION
    This module provides advanced caching functionality for secret management:
    1. Decryption timestamp cache - prevents immediate re-encryption after decryption
    2. Encrypted content hash cache - detects encrypted file changes
    3. Cache cleanup - removes expired cache entries

    Cache Structure:
        %UserProfile%\.core_node\cache\secret_cache\
        ├── decryption_timestamps\    # Decryption timestamp cache
        │   ├── filename1.decrypt_time
        │   └── filename2.decrypt_time
        └── encrypted_content_hash\   # Encrypted file content hash cache
            ├── filename1.enc_hash
            └── filename2.enc_hash

.EXAMPLE
    # Import the module
    . .\SecretCache.ps1

    # Use caching functions
    Set-DecryptionTimestampCache -FileName "API_KEY_1"
    $isModified = Test-RawFileModifiedAfterDecryption -FileName "API_KEY_1" -RawFile "C:\path\API_KEY_1"
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Import GlobalVars.ps1 if not already loaded
if (-not (Get-Variable -Name "Global:CORE_NODE_DIR" -ErrorAction SilentlyContinue)) {
    $scriptDir = $PSScriptRoot
    $globalVarsPath = Join-Path $scriptDir "GlobalVars.ps1"

    if (Test-Path $globalVarsPath) {
        . $globalVarsPath
    } else {
        Write-Error "ERROR: GlobalVars.ps1 not found. Cannot determine cache directory."
        exit 1
    }
}

<#
.SYNOPSIS
    Get the secret cache base directory

.DESCRIPTION
    Returns the base directory for secret cache storage
#>
function Get-SecretCacheBaseDir {
    $cacheDir = if ($Global:USER_CACHE_DIR) {
        $Global:USER_CACHE_DIR
    } else {
        Join-Path $env:USERPROFILE ".core_node\cache"
    }

    return Join-Path $cacheDir "secret_cache"
}

<#
.SYNOPSIS
    Store decryption timestamp for a file

.PARAMETER FileName
    Name of the file (without extension)

.EXAMPLE
    Set-DecryptionTimestampCache -FileName "API_KEY_1"
#>
function Set-DecryptionTimestampCache {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName
    )

    $cacheDir = Join-Path (Get-SecretCacheBaseDir) "decryption_timestamps"
    $currentTime = [int64](Get-Date -UFormat %s)

    if (-not (Test-Path $cacheDir)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    }

    $cacheFile = Join-Path $cacheDir "$FileName.decrypt_time"
    Set-Content -Path $cacheFile -Value $currentTime -Force
}

<#
.SYNOPSIS
    Check if raw file was modified after decryption time

.PARAMETER FileName
    Name of the file (without extension)

.PARAMETER RawFile
    Path to the raw file

.RETURNS
    $true if file was modified after decryption (needs re-encryption)
    $false if file was not modified after decryption (skip re-encryption)

.EXAMPLE
    $needsReEncryption = Test-RawFileModifiedAfterDecryption -FileName "API_KEY_1" -RawFile "C:\path\API_KEY_1"
#>
function Test-RawFileModifiedAfterDecryption {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName,

        [Parameter(Mandatory = $true)]
        [string]$RawFile
    )

    $cacheDir = Join-Path (Get-SecretCacheBaseDir) "decryption_timestamps"
    $cacheFile = Join-Path $cacheDir "$FileName.decrypt_time"

    if (-not (Test-Path $cacheFile)) {
        return $true  # No decryption cache, consider as modified
    }

    $decryptionTime = Get-Content -Path $cacheFile -ErrorAction SilentlyContinue
    if (-not $decryptionTime -or -not ($decryptionTime -match '^\d+$')) {
        return $true  # Invalid cache, consider as modified
    }

    if (-not (Test-Path $RawFile)) {
        return $false  # Raw file not found
    }

    $rawFileTime = [int64]((Get-Item $RawFile).LastWriteTime.ToFileTime() / 10000000 - 11644473600)

    # If raw file is newer than decryption time, it was modified after decryption
    if ($rawFileTime -gt [int64]$decryptionTime) {
        return $true  # Modified after decryption - need re-encryption
    } else {
        return $false  # Not modified after decryption - skip re-encryption
    }
}

<#
.SYNOPSIS
    Store encrypted file content hash

.PARAMETER FileName
    Name of the file (without extension)

.PARAMETER EncryptedFile
    Path to the encrypted file

.EXAMPLE
    Set-EncryptedContentHashCache -FileName "API_KEY_1" -EncryptedFile "C:\path\API_KEY_1.js"
#>
function Set-EncryptedContentHashCache {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName,

        [Parameter(Mandatory = $true)]
        [string]$EncryptedFile
    )

    $cacheDir = Join-Path (Get-SecretCacheBaseDir) "encrypted_content_hash"

    if (-not (Test-Path $cacheDir)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    }

    $cacheFile = Join-Path $cacheDir "$FileName.enc_hash"

    if (Test-Path $EncryptedFile) {
        $fileHash = Get-FileHash -Path $EncryptedFile -Algorithm SHA256 -ErrorAction SilentlyContinue
        if ($fileHash) {
            Set-Content -Path $cacheFile -Value $fileHash.Hash -Force
        }
    }
}

<#
.SYNOPSIS
    Check if encrypted file content has changed

.PARAMETER FileName
    Name of the file (without extension)

.PARAMETER EncryptedFile
    Path to the encrypted file

.RETURNS
    $true if content changed (need re-decryption)
    $false if content unchanged

.EXAMPLE
    $hasChanged = Test-EncryptedContentChanged -FileName "API_KEY_1" -EncryptedFile "C:\path\API_KEY_1.js"
#>
function Test-EncryptedContentChanged {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName,

        [Parameter(Mandatory = $true)]
        [string]$EncryptedFile
    )

    $cacheDir = Join-Path (Get-SecretCacheBaseDir) "encrypted_content_hash"
    $cacheFile = Join-Path $cacheDir "$FileName.enc_hash"

    if (-not (Test-Path $cacheFile)) {
        return $true  # No hash cache, consider as changed
    }

    if (-not (Test-Path $EncryptedFile)) {
        return $false  # Encrypted file not found
    }

    $cachedHash = Get-Content -Path $cacheFile -ErrorAction SilentlyContinue
    $currentHash = (Get-FileHash -Path $EncryptedFile -Algorithm SHA256 -ErrorAction SilentlyContinue).Hash

    if (-not $cachedHash -or -not $currentHash) {
        return $true  # Invalid hash, consider as changed
    }

    if ($cachedHash -ne $currentHash) {
        return $true  # Content changed - need re-decryption
    } else {
        return $false  # Content unchanged
    }
}

<#
.SYNOPSIS
    Store raw (decrypted) file content hash as the encryption baseline

.DESCRIPTION
    Records the SHA256 hash of a raw secret file at the moment it is encrypted.
    The reverse-direction check (Get-FilesNeedingReEncryption) uses this baseline
    to tell a real content change apart from a mere timestamp bump caused by bulk
    file operations (copy / restore / sync), which would otherwise trigger a
    false "needs re-encryption" prompt.

.PARAMETER FileName
    Name of the file (without extension)

.PARAMETER RawFile
    Path to the raw (decrypted) file

.EXAMPLE
    Set-RawContentHashCache -FileName "API_KEY_1" -RawFile "C:\path\API_KEY_1"
#>
function Set-RawContentHashCache {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName,

        [Parameter(Mandatory = $true)]
        [string]$RawFile
    )

    $cacheDir = ""
    $cacheFile = ""
    $fileHash = $null

    $cacheDir = Join-Path (Get-SecretCacheBaseDir) "raw_content_hash"

    if (-not (Test-Path $cacheDir)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    }

    $cacheFile = Join-Path $cacheDir "$FileName.raw_hash"

    if (Test-Path $RawFile) {
        $fileHash = Get-FileHash -Path $RawFile -Algorithm SHA256 -ErrorAction SilentlyContinue
        if ($fileHash) {
            Set-Content -Path $cacheFile -Value $fileHash.Hash -Force
        }
    }
}

<#
.SYNOPSIS
    Get the cached raw-content baseline hash for a file

.PARAMETER FileName
    Name of the file (without extension)

.RETURNS
    The cached SHA256 hash string, or $null if no baseline is recorded

.EXAMPLE
    $baseline = Get-CachedRawContentHash -FileName "API_KEY_1"
#>
function Get-CachedRawContentHash {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName
    )

    $cacheDir = ""
    $cacheFile = ""
    $cachedHash = ""

    $cacheDir = Join-Path (Get-SecretCacheBaseDir) "raw_content_hash"
    $cacheFile = Join-Path $cacheDir "$FileName.raw_hash"

    if (-not (Test-Path $cacheFile)) {
        return $null
    }

    $cachedHash = Get-Content -Path $cacheFile -ErrorAction SilentlyContinue

    if ([string]::IsNullOrWhiteSpace($cachedHash)) {
        return $null
    }

    return $cachedHash.Trim()
}

<#
.SYNOPSIS
    Get list of encrypted files that need re-decryption due to content changes

.PARAMETER EncryptedDir
    Directory containing encrypted files

.PARAMETER RawDir
    Directory containing decrypted files

.RETURNS
    $true if some files need re-decryption and user chose to proceed
    $false if no re-decryption needed or user declined

.EXAMPLE
    $needsRedecryption = Get-EncryptedFilesNeedingRedecryption -EncryptedDir "C:\encrypted" -RawDir "C:\raw"
#>
function Test-EncryptedContentBaselineExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName
    )

    $cacheDir = ""
    $cacheFile = ""

    $cacheDir = Join-Path (Get-SecretCacheBaseDir) "encrypted_content_hash"
    $cacheFile = Join-Path $cacheDir "$FileName.enc_hash"

    return (Test-Path $cacheFile)
}

function Get-EncryptedFilesNeedingRedecryption {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EncryptedDir,

        [Parameter(Mandatory = $true)]
        [string]$RawDir
    )

    $changedFiles = @()

    if (-not (Test-Path $EncryptedDir)) {
        return $false
    }

    $encryptedFiles = Get-ChildItem -Path $EncryptedDir -Filter "*.js" -File -ErrorAction SilentlyContinue

    foreach ($encFile in $encryptedFiles) {
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($encFile.Name)
        $rawFile = Join-Path $RawDir $baseName

        # Only consider files we have already decrypted locally. First-time decryption
        # (raw file missing) is handled by the separate missing-files flow.
        if (-not (Test-Path $rawFile)) {
            continue
        }

        # A missing baseline is NOT evidence of a content change (e.g. fresh install or a
        # cleared cache dir). Seed it from the current encrypted file and treat it as up to
        # date, so we never raise a phantom "all files changed" prompt. Real changes are
        # detected only when a baseline EXISTS and its hash no longer matches.
        if (-not (Test-EncryptedContentBaselineExists -FileName $baseName)) {
            Set-EncryptedContentHashCache -FileName $baseName -EncryptedFile $encFile.FullName
            continue
        }

        # Baseline exists: a hash mismatch means the encrypted content actually changed.
        if (Test-EncryptedContentChanged -FileName $baseName -EncryptedFile $encFile.FullName) {
            $changedFiles += $baseName
        }
    }

    if ($changedFiles.Count -gt 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Encrypted Files Content Changed" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Found $($changedFiles.Count) encrypted file(s) with content changes:" -ForegroundColor White
        Write-Host ""

        foreach ($fileName in $changedFiles) {
            Write-Host "  - $fileName (encrypted content updated)" -ForegroundColor Yellow
        }
        Write-Host ""

        $redecryptChoice = Read-Host "These encrypted files have been updated. Re-decrypt them? (yes/no)"

        if ($redecryptChoice -match "^[Yy](es)?$") {
            # Remove outdated raw files
            foreach ($fileName in $changedFiles) {
                $rawFile = Join-Path $RawDir $fileName
                if (Test-Path $rawFile) {
                    Remove-Item -Path $rawFile -Force -ErrorAction SilentlyContinue
                    Write-Host "[CACHE INVALIDATED] Removed outdated decrypted file: $fileName" -ForegroundColor Cyan
                }
            }
            Write-Host ""
            return $true  # Need re-decryption
        } else {
            Write-Host "[WARNING] Keeping existing decrypted files (may be outdated)" -ForegroundColor Yellow
            Write-Host ""

            # Ask if user wants to update cache to stop future notifications
            $updateCacheChoice = Read-Host "Update cache to stop future notifications for these files? [Y/n]"

            if (-not ($updateCacheChoice -match "^[Nn]$")) {
                Write-Host "[CACHE UPDATE] Updating encrypted content hash cache..." -ForegroundColor Cyan

                # Update cache for each changed file to match current encrypted content
                foreach ($fileName in $changedFiles) {
                    $encFile = Join-Path $EncryptedDir "$fileName.js"

                    if (Test-Path $encFile) {
                        Set-EncryptedContentHashCache -FileName $fileName -EncryptedFile $encFile
                        Write-Host "[CACHE UPDATED] $fileName - will not prompt again" -ForegroundColor Green
                    }
                }

                Write-Host "[CACHE UPDATE] Cache updated. These files will not trigger re-decryption prompts until content changes again." -ForegroundColor Green
            } else {
                Write-Host "[CACHE UNCHANGED] Will continue to prompt for these files on next startup" -ForegroundColor Yellow
            }

            Write-Host ""
        }
    }

    return $false  # No re-decryption needed
}

<#
.SYNOPSIS
    Cleanup expired secret cache entries

.PARAMETER CacheExpiryDays
    Number of days after which cache entries are considered expired (default: 7)

.EXAMPLE
    Clear-ExpiredSecretCache
    Clear-ExpiredSecretCache -CacheExpiryDays 30
#>
function Clear-ExpiredSecretCache {
    param(
        [int]$CacheExpiryDays = 7
    )

    $cacheBaseDir = Get-SecretCacheBaseDir
    $cacheExpirySeconds = $CacheExpiryDays * 24 * 3600
    $currentTime = Get-Date
    $cleanedFiles = 0

    if (-not (Test-Path $cacheBaseDir)) {
        return
    }

    # Cleanup decryption timestamps cache
    $decryptCacheDir = Join-Path $cacheBaseDir "decryption_timestamps"
    if (Test-Path $decryptCacheDir) {
        $cacheFiles = Get-ChildItem -Path $decryptCacheDir -Filter "*.decrypt_time" -File -ErrorAction SilentlyContinue

        foreach ($cacheFile in $cacheFiles) {
            $fileAge = $currentTime - $cacheFile.LastWriteTime
            if ($fileAge.TotalSeconds -gt $cacheExpirySeconds) {
                Remove-Item -Path $cacheFile.FullName -Force -ErrorAction SilentlyContinue
                $cleanedFiles++
            }
        }
    }

    # NOTE: encrypted_content_hash\*.enc_hash files are deliberately NOT expired here.
    # They are persistent content-change baselines, not throwaway cache. Deleting them on
    # a timer makes Test-EncryptedContentChanged see no baseline and report EVERY encrypted
    # file as "changed", producing a phantom "Found N encrypted file(s) with content changes"
    # prompt on the first run after expiry. The baselines are refreshed on encrypt/decrypt
    # and stay valid until the encrypted content actually changes.

    if ($cleanedFiles -gt 0) {
        Write-Host "[SECRET CACHE CLEANUP] Removed $cleanedFiles expired secret cache entries" -ForegroundColor Yellow
    }
}

Write-Host "[SECRET_CACHE] Enhanced secret cache module loaded successfully" -ForegroundColor Green