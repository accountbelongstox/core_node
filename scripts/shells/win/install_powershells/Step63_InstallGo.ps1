# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables; Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

$ErrorActionPreference = "Stop"

$STEP_NUMBER = 63
$stepPrefix = "[Step $STEP_NUMBER]"
$goPackageKey = "Go"
$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$winCommonDir = Join-Path $parentDir "win_common"

$goPackage = $null
$goPackageId = ""
$goExec = ""
$goInstallType = ""
$goInstallDirFromMetadata = ""
$goAdditionalKeywords = @()
$goDownloadArchive = ""
$goDownloadUrl = ""
$goArchitecture = ""
$goReleaseVersion = ""
$goReleaseVersionTag = ""
$targetGoVersion = $null
$goExecutablePath = ""
$goRelease = $null
$goVersionLines = @()
$script:ForceInstallParameter = $false

# Optional runtime behavior control
if ($PSBoundParameters.ContainsKey("Force")) {
    $script:ForceInstallParameter = $true
}

# Import configuration and helper functions
. (Join-Path $winCommonDir "GlobalVars.ps1")
. (Join-Path $winCommonDir "CommonFunc.ps1")
. (Join-Path $winCommonDir "ApplicationsList.ps1")
. (Join-Path $winCommonDir "PostInstallCallbackProcessor.ps1")

function Get-GoPackageDefinition {
    param([string]$PackageKey)

    if (-not $Global:BasePackages.ContainsKey($PackageKey)) {
        return $null
    }

    return $Global:BasePackages[$PackageKey]
}

function Resolve-GoInstallDirectory {
    param(
        [hashtable]$PackageMeta,
        [string]$PackageKey
    )

    if ($PackageMeta.ContainsKey("AppCustomInstallDir") -and -not [string]::IsNullOrWhiteSpace($PackageMeta.AppCustomInstallDir)) {
        return $PackageMeta.AppCustomInstallDir
    }

    $packageName = if ($PackageMeta.ContainsKey("Name")) { $PackageMeta.Name } else { $PackageKey }
    if ($packageName -eq "Go") {
        return $Global:GO_INSTALL_DIR
    }

    return Join-Path $Global:LANG_COMPILER_DIR $packageName
}

function Find-GoExecutable {
    param(
        [string]$InstallDir,
        [string]$Keyword,
        [array]$AdditionalKeywords = @()
    )

    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }

    $executablePath = Find-ExecutableByKeyword -IncludeSystemPaths $true -Keywords $searchKeywords -AdditionalScanPaths $InstallDir -Recursive $true -AdditionalKeywords $AdditionalKeywords
    if ($executablePath) {
        return $executablePath
    }
    return Get-Command $Keyword -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue
}

function Test-GoCommand {
    param([string]$ExecutablePath)

    if (-not $ExecutablePath -or -not (Test-Path -LiteralPath $ExecutablePath)) {
        return $false
    }

    try {
        $versionOutput = & $ExecutablePath version 2>&1
        return [string]$versionOutput -match "go version"
    }
    catch {
        return $false
    }
}

function Get-GoArchitecture {
    $processorArch = $env:PROCESSOR_ARCHITECTURE
    $processorArchWow = $env:PROCESSOR_ARCHITEW6432

    if (([string]::Equals($processorArch, "ARM64", [System.StringComparison]::OrdinalIgnoreCase)) -or ([string]::Equals($processorArchWow, "ARM64", [System.StringComparison]::OrdinalIgnoreCase))) {
        return "arm64"
    }

    if (([string]::Equals($processorArch, "AMD64", [System.StringComparison]::OrdinalIgnoreCase)) -or ([string]::Equals($processorArchWow, "AMD64", [System.StringComparison]::OrdinalIgnoreCase)) -or [Environment]::Is64BitOperatingSystem) {
        return "amd64"
    }

    return "386"
}

function Get-GoVersionFromExecutable {
    param([string]$ExecutablePath)

    if (-not (Test-Path -LiteralPath $ExecutablePath)) {
        return $null
    }

    try {
        $versionOutput = & $ExecutablePath version 2>&1
        if (-not $versionOutput) {
            return $null
        }

        $line = ($versionOutput | Select-Object -First 1).ToString()
        $versionParts = $line.Split(" ")
        if ($versionParts.Count -lt 2) {
            return $null
        }

        $versionText = $versionParts[1]
        if (-not $versionText.StartsWith("go", [System.StringComparison]::OrdinalIgnoreCase)) {
            return $null
        }

        return [version]$versionText.Substring(2)
    }
    catch {
        return $null
    }
}

function Get-LatestGoRelease {
    try {
        $response = Invoke-WebRequest -Uri $Global:GO_RELEASE_API_URL -UseBasicParsing -TimeoutSec 30
        if (-not $response -or [string]::IsNullOrWhiteSpace($response.Content)) {
            return $null
        }

        $releases = $response.Content | ConvertFrom-Json
        $selectedRelease = $releases | Where-Object { $_.stable -eq $true } | Select-Object -First 1
        if (-not $selectedRelease) {
            $selectedRelease = $releases | Select-Object -First 1
        }

        if (-not $selectedRelease -or -not $selectedRelease.files) {
            return $null
        }

        $architecture = Get-GoArchitecture
        $fileEntry = $selectedRelease.files |
            Where-Object {
                $_.os -eq "windows" -and
                $_.arch -eq $architecture -and
                $_.kind -eq "archive" -and
                $_.filename -like "*.zip"
            } |
            Select-Object -First 1

        if (-not $fileEntry) {
            $fileEntry = $selectedRelease.files |
                Where-Object {
                    $_.os -eq "windows" -and
                    $_.arch -eq $architecture -and
                    $_.filename -like "*.zip"
                } |
                Select-Object -First 1
        }

        if (-not $fileEntry) {
            return $null
        }

        return [PSCustomObject]@{
            VersionTag   = $selectedRelease.version
            Version      = ($selectedRelease.version -replace '^go', '')
            ArchiveFile  = $fileEntry.filename
            DownloadUrl  = "{0}/{1}" -f $Global:GO_DOWNLOAD_BASE_URL, $fileEntry.filename
            Architecture = $architecture
            Source       = "api"
        }
    }
    catch {
        return $null
    }
}

function Get-FallbackGoRelease {
    $fallbackVersion = $Global:GO_DEFAULT_VERSION
    $architecture = Get-GoArchitecture
    $fallbackArchive = [string]::Format($Global:GO_ARCHIVE_NAME_TEMPLATE, $fallbackVersion, $architecture)
    $fallbackUrl = "{0}/{1}" -f $Global:GO_DOWNLOAD_BASE_URL, $fallbackArchive

    return [PSCustomObject]@{
        VersionTag   = "go$fallbackVersion"
        Version      = $fallbackVersion
        ArchiveFile  = $fallbackArchive
        DownloadUrl  = $fallbackUrl
        Architecture = $architecture
        Source       = "fallback"
    }
}

function Get-TargetGoRelease {
    $release = Get-LatestGoRelease
    if ($release) {
        return $release
    }

    Write-ColorMessage -Message "$stepPrefix Falling back to default Go release $($Global:GO_DEFAULT_VERSION) (API unavailable)." -Type "Warning"
    return Get-FallbackGoRelease
}

function Install-GoFromArchive {
    param(
        [string]$ArchivePath,
        [string]$InstallDir
    )

    if (Test-Path $InstallDir) {
        Write-ColorMessage -Message "$stepPrefix Removing existing Go directory for clean install: $InstallDir" -Type "Warning"
        Remove-Item -Path $InstallDir -Recurse -Force
    }

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

    $tempExtractDir = Join-Path $Global:TEMP_DIR "go_extract"
    if (Test-Path $tempExtractDir) {
        Remove-Item -Path $tempExtractDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $tempExtractDir -Force | Out-Null

    try {
        Write-ColorMessage -Message "$stepPrefix Extracting Go archive to temp directory: $tempExtractDir" -Type "Info"
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($ArchivePath, $tempExtractDir)

        $extractedGoDir = Join-Path $tempExtractDir "go"
        if (-not (Test-Path $extractedGoDir)) {
            Write-ColorMessage -Message "$stepPrefix Unexpected archive structure: expected '$tempExtractDir\go'" -Type "Error"
            return $false
        }

        Get-ChildItem -Path (Join-Path $tempExtractDir "go") | ForEach-Object {
            $sourcePath = $_.FullName
            $destinationPath = Join-Path $InstallDir $_.Name

            if ($_.PSIsContainer) {
                Copy-Item -Path $sourcePath -Destination $destinationPath -Recurse -Force
            }
            else {
                Copy-Item -Path $sourcePath -Destination $destinationPath -Force
            }
        }

        return $true
    }
    catch {
        Write-ColorMessage -Message "$stepPrefix Failed to extract Go archive: $($_.Exception.Message)" -Type "Error"
        return $false
    }
    finally {
        if (Test-Path $tempExtractDir) {
            Remove-Item -Path $tempExtractDir -Recurse -Force
        }
    }
}

function Step63_InstallGo {
    Write-ColorMessage -Message "$stepPrefix Installing Go..." -Type "Info"

    $goPackage = Get-GoPackageDefinition -PackageKey $goPackageKey
    if (-not $goPackage) {
        Write-ColorMessage -Message "$stepPrefix Go base package metadata not found in ApplicationsList" -Type "Error"
        return
    }

    $goPackageId = $goPackage.PackageId
    if ($goPackage.ContainsKey("Exec") -and -not [string]::IsNullOrWhiteSpace($goPackage.Exec)) {
        $goExec = $goPackage.Exec
    }
    else {
        $goExec = $Global:GO_EXECUTABLE
    }
    $goInstallType = if ($goPackage.ContainsKey("InstallType")) { $goPackage.InstallType } else { "web" }
    $goInstallDirFromMetadata = Resolve-GoInstallDirectory -PackageMeta $goPackage -PackageKey $goPackageKey
    $goAdditionalKeywords = if ($goPackage.ContainsKey("AdditionalKeywords")) { $goPackage.AdditionalKeywords } else { @() }

    Write-ColorMessage -Message "$stepPrefix Target package: $goPackageId ($goExec) installType=$goInstallType" -Type "Info"

    $goRelease = Get-TargetGoRelease
    if (-not $goRelease) {
        Write-ColorMessage -Message "$stepPrefix Failed to resolve Go release metadata. Installation aborted." -Type "Error"
        return
    }

    $goReleaseVersionTag = $goRelease.VersionTag
    $goReleaseVersion = $goRelease.Version
    $goDownloadArchive = $goRelease.ArchiveFile
    $goDownloadUrl = $goRelease.DownloadUrl
    $goArchitecture = $goRelease.Architecture
    $targetGoVersion = [version]$goReleaseVersion

    Write-ColorMessage -Message "$stepPrefix Resolving latest Go release: $goReleaseVersionTag ($goArchitecture) from $($goRelease.Source)" -Type "Info"

    $goExecutablePath = Find-GoExecutable -InstallDir $goInstallDirFromMetadata -Keyword $goExec -AdditionalKeywords $goAdditionalKeywords
    $installedGoVersion = Get-GoVersionFromExecutable -ExecutablePath $goExecutablePath
    if (-not $script:ForceInstallParameter -and $installedGoVersion -and ($installedGoVersion -eq $targetGoVersion)) {
        Write-ColorMessage -Message "$stepPrefix Go is already up to date: go$installedGoVersion. Skipping installation." -Type "Success"

        if (-not (Test-GoCommand -ExecutablePath $goExecutablePath)) {
            Write-ColorMessage -Message "$stepPrefix Existing go binary responded incorrectly. Reinstalling." -Type "Warning"
        }
        else {
            if ($goPackage.ContainsKey("PostInstallCallbacks") -and $goPackage.PostInstallCallbacks) {
                Invoke-PostInstallCallbacks -PackageName $goPackageKey -PackageMeta $goPackage -ExecutablePath $goExecutablePath -InstallDir (Split-Path $goExecutablePath -Parent) -LogPrefix $stepPrefix
            }

            if ($goPackage.ContainsKey("EnvVars") -and $goPackage.EnvVars) {
                Set-MultipleEnvironmentVariablesForPackage -Id $goPackageKey -EnvVars $goPackage.EnvVars -ExecutablePath $goExecutablePath -DefaultExec $goExec
            }

            $goVersionLines = & $goExecutablePath version 2>&1
            if ($goVersionLines) {
                Write-ColorMessage -Message "$stepPrefix Verified go version: $($goVersionLines | Select-Object -First 1)" -Type "Success"
            }
            return
        }
    }

    if (Test-Path $goInstallDirFromMetadata) {
        Write-ColorMessage -Message "$stepPrefix Updating Go installation in: $goInstallDirFromMetadata" -Type "Warning"
    }

    if (-not (Test-Path $Global:TEMP_DIR)) {
        New-Item -ItemType Directory -Path $Global:TEMP_DIR -Force | Out-Null
    }
    if (-not (Test-Path $Global:DOWNLOADS_DIR)) {
        New-Item -ItemType Directory -Path $Global:DOWNLOADS_DIR -Force | Out-Null
    }

    $goArchivePath = Join-Path $Global:DOWNLOADS_DIR $goDownloadArchive
    $isDownloaded = Get-FileWithSizeCheck -localPath $goArchivePath -remoteUrl $goDownloadUrl -description "Go $goReleaseVersionTag ($goArchitecture)"
    if (-not $isDownloaded -or -not (Test-Path $goArchivePath)) {
        Write-ColorMessage -Message "$stepPrefix Failed to download Go archive from: $goDownloadUrl" -Type "Error"
        return
    }

    $isInstalled = Install-GoFromArchive -ArchivePath $goArchivePath -InstallDir $goInstallDirFromMetadata
    if (-not $isInstalled) {
        return
    }

    $goExecutablePath = Find-GoExecutable -InstallDir $goInstallDirFromMetadata -Keyword $goExec -AdditionalKeywords $goAdditionalKeywords
    if (-not (Test-GoCommand -ExecutablePath $goExecutablePath)) {
        Write-ColorMessage -Message "$stepPrefix Could not verify Go after extraction: $goExecutablePath" -Type "Error"
        return
    }

    if ($goPackage.ContainsKey("PostInstallCallbacks") -and $goPackage.PostInstallCallbacks) {
        Invoke-PostInstallCallbacks -PackageName $goPackageKey -PackageMeta $goPackage -ExecutablePath $goExecutablePath -InstallDir (Split-Path $goExecutablePath -Parent) -LogPrefix $stepPrefix
    }

    if ($goPackage.ContainsKey("EnvVars") -and $goPackage.EnvVars) {
        Set-MultipleEnvironmentVariablesForPackage -Id $goPackageKey -EnvVars $goPackage.EnvVars -ExecutablePath $goExecutablePath -DefaultExec $goExec
    }

    $goVersionLines = & $goExecutablePath version 2>&1
    if ($goVersionLines) {
        Write-ColorMessage -Message "$stepPrefix Verified go version: $($goVersionLines | Select-Object -First 1)" -Type "Success"
    }
    $installedGoVersion = Get-GoVersionFromExecutable -ExecutablePath $goExecutablePath
    if ($installedGoVersion -and $installedGoVersion -eq $targetGoVersion) {
        Write-ColorMessage -Message "$stepPrefix Go version check passed after install." -Type "Success"
    }
    else {
        Write-ColorMessage -Message "$stepPrefix Go version check did not match target. Installed: $installedGoVersion, Target: $targetGoVersion" -Type "Warning"
    }

    Write-ColorMessage -Message "$stepPrefix Go installation completed." -Type "Success"
}

Step63_InstallGo
