# Official vendor ZIP payloads (callers: MysqlManager.ps1, NginxManager.ps1): download once into the
# Windows downloads dir (program drive, never the D: shared data), then extract the archive's single
# top-level folder into a versioned install dir.
$script:OfficialArchiveCacheDir = $Global:DOWNLOADS_DIR
$script:OfficialArchiveMinBytes = 1MB

function Test-OfficialArchiveValid {
    param([Parameter(Mandatory = $true)][string]$ZipPath)
    $zip = $null
    if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) { return $false }
    if ((Get-Item -LiteralPath $ZipPath).Length -lt $script:OfficialArchiveMinBytes) { return $false }
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
        return ($zip.Entries.Count -gt 0)
    } catch {
        return $false
    } finally {
        if ($zip) { $zip.Dispose() }
    }
}

# Returns $true when $InstallDir\$VerifyRelativePath exists afterwards. Idempotent: an installed
# payload is kept, and a valid cached archive is reused instead of downloaded again.
function Install-OfficialArchive {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$InstallDir,
        [Parameter(Mandatory = $true)][string]$VerifyRelativePath,
        [string]$Description = ''
    )
    $zipPath = Join-Path $script:OfficialArchiveCacheDir (Split-Path -Leaf $Url)
    $verifyPath = Join-Path $InstallDir $VerifyRelativePath
    $extractDir = Join-Path $Global:WORK_DIR ('official_extract_{0}' -f [System.IO.Path]::GetFileNameWithoutExtension($zipPath))
    $entries = @()
    $source = ''

    if (Test-Path -LiteralPath $verifyPath -PathType Leaf) { return $true }
    if (-not (Test-Path -LiteralPath $script:OfficialArchiveCacheDir)) { New-Item -ItemType Directory -Path $script:OfficialArchiveCacheDir -Force | Out-Null }
    if (-not (Test-OfficialArchiveValid -ZipPath $zipPath)) {
        Write-ColorMessage -Message "Downloading $Description from $Url" -Type 'Info'
        Get-FileWithSizeCheck -localPath $zipPath -remoteUrl $Url -description $Description | Out-Null
    }
    if (-not (Test-OfficialArchiveValid -ZipPath $zipPath)) {
        Write-ColorMessage -Message "Download failed or archive invalid: $Url" -Type 'Error'
        if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue }
        return $false
    }
    try {
        if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force }
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
        $entries = @(Get-ChildItem -LiteralPath $extractDir)
        $source = if ($entries.Count -eq 1 -and $entries[0].PSIsContainer) { $entries[0].FullName } else { $extractDir }
        if (-not (Test-Path -LiteralPath $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }
        Copy-Item -Path (Join-Path $source '*') -Destination $InstallDir -Recurse -Force
    } catch {
        Write-ColorMessage -Message "Extraction failed: $($_.Exception.Message)" -Type 'Error'
        return $false
    } finally {
        if (Test-Path -LiteralPath $extractDir) { Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
    }
    return (Test-Path -LiteralPath $verifyPath -PathType Leaf)
}
