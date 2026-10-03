<#
.SYNOPSIS
    File Recovery Menu
.DESCRIPTION
    Recovers deleted files with Windows File Recovery (winfr /regular, /extensive) or DMDE (GUI).
    Recovered files always go to another volume so they cannot overwrite the deleted clusters.
    Non-interactive: -Action InstallDmde, or -Action Regular|Extensive -SourcePath <dir> [-FilePattern *.zip] [-DestinationRoot <dir>].
#>
param(
    [Parameter()][ValidateSet("Menu", "Regular", "Extensive", "Dmde", "InstallDmde")][string]$Action = "Menu",
    [Parameter()][string]$SourcePath = "",
    [Parameter()][string]$FilePattern = "",
    [Parameter()][string]$DestinationRoot = ""
)

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"

. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")

$script:WINFR_STORE_ID = "9N26S50LN705"
$script:WINFR_EXE = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\winfr.exe"
$script:DMDE_DOWNLOAD_PAGE = "https://dmde.com/download.html"
$script:DMDE_BASE_URL = "https://dmde.com"
$script:DMDE_PACKAGE_PATTERN = '/download/dmde-[\d-]+-win64-gui\.zip$'
$script:DMDE_DIR = $Global:DMDE_INSTALL_DIR
$script:DMDE_EXE_NAME = "dmde.exe"
$script:RECOVERY_DIR_NAME = "FileRecovery"
$script:DEFAULT_FILE_PATTERN = "*"
$script:RECOVERY_FILE_SYSTEMS = @("NTFS", "ReFS", "exFAT", "FAT32", "FAT")
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
#endregion

#region Helper Functions
function Install-Winfr {
    if (Test-Path $script:WINFR_EXE) { return $true }
    Write-ColorMessage -Message "Installing Windows File Recovery ($script:WINFR_STORE_ID) from Microsoft Store..." -Type "Info"
    & winget install --id $script:WINFR_STORE_ID --source msstore --accept-package-agreements --accept-source-agreements --silent
    return (Test-Path $script:WINFR_EXE)
}

function Install-Dmde {
    $dmdeExe = Get-ChildItem -Path $script:DMDE_DIR -Filter $script:DMDE_EXE_NAME -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    $packageLink = $null
    $packageUrl = ''
    $packageFile = ''

    if ($null -ne $dmdeExe) {
        Write-ColorMessage -Message "DMDE already installed: $($dmdeExe.FullName)" -Type "Success"
        return $dmdeExe.FullName
    }
    Write-ColorMessage -Message "Downloading DMDE from $script:DMDE_DOWNLOAD_PAGE ..." -Type "Info"
    $packageLink = (Invoke-WebRequest -Uri $script:DMDE_DOWNLOAD_PAGE -UseBasicParsing).Links |
        Where-Object { $_.href -match $script:DMDE_PACKAGE_PATTERN } | Select-Object -First 1
    if ($null -eq $packageLink) {
        Write-ColorMessage -Message "No DMDE win64 package found on $script:DMDE_DOWNLOAD_PAGE" -Type "Error"
        return $null
    }
    $packageUrl = $script:DMDE_BASE_URL + $packageLink.href
    $packageFile = Join-Path $env:TEMP (Split-Path $packageLink.href -Leaf)
    if (-not (Test-Path $packageFile) -or (Get-Item $packageFile).Length -eq 0) {
        Invoke-WebRequest -Uri $packageUrl -OutFile $packageFile -UseBasicParsing
    }
    New-Item -ItemType Directory -Path $script:DMDE_DIR -Force | Out-Null
    Expand-Archive -Path $packageFile -DestinationPath $script:DMDE_DIR -Force
    Remove-Item -Path $packageFile -Force
    $dmdeExe = Get-ChildItem -Path $script:DMDE_DIR -Filter $script:DMDE_EXE_NAME -Recurse | Select-Object -First 1
    if ($null -eq $dmdeExe) {
        Write-ColorMessage -Message "$script:DMDE_EXE_NAME not found after extracting to $script:DMDE_DIR" -Type "Error"
        return $null
    }
    Write-ColorMessage -Message "DMDE installed: $($dmdeExe.FullName)" -Type "Success"
    return $dmdeExe.FullName
}

function Get-RecoveryDestinationRoot {
    param([Parameter(Mandatory = $true)][string]$SourceDriveLetter)

    $targetVolume = Get-Volume | Where-Object {
        $_.DriveLetter -and $_.DriveType -eq 'Fixed' -and $_.FileSystem -in $script:RECOVERY_FILE_SYSTEMS -and [string]$_.DriveLetter -ne $SourceDriveLetter
    } | Sort-Object SizeRemaining -Descending | Select-Object -First 1

    if ($null -eq $targetVolume) { return $null }
    return (Join-Path ("{0}:\" -f $targetVolume.DriveLetter) $script:RECOVERY_DIR_NAME)
}

function Read-RecoveryRequest {
    $requestSource = $SourcePath
    $requestPattern = $FilePattern

    if ([string]::IsNullOrWhiteSpace($requestSource)) {
        $requestSource = ([string](Read-Host 'Folder or drive the files were deleted from (e.g. D:\applications\Games)')).Trim().Trim('"')
    }
    if ([string]::IsNullOrWhiteSpace($requestPattern)) {
        $requestPattern = ([string](Read-Host "File name pattern (e.g. *.zip, Enter = $script:DEFAULT_FILE_PATTERN)")).Trim()
        if ($requestPattern -eq '') { $requestPattern = $script:DEFAULT_FILE_PATTERN }
    }
    return @{ Source = $requestSource; Pattern = $requestPattern }
}

function Invoke-WinfrRecovery {
    param([Parameter(Mandatory = $true)][ValidateSet("regular", "extensive")][string]$Mode)

    $request = Read-RecoveryRequest
    $sourceQualifier = ''
    $sourceDriveLetter = ''
    $sourceRelative = ''
    $winfrFilter = ''
    $destinationDir = $DestinationRoot
    $recoveredFiles = @()

    if ($request.Source -notmatch '^[A-Za-z]:') {
        Write-ColorMessage -Message "Source must start with a drive letter: $($request.Source)" -Type "Error"
        return
    }
    $sourceQualifier = Split-Path $request.Source -Qualifier
    $sourceDriveLetter = $sourceQualifier.TrimEnd(':').ToUpper()
    $sourceRelative = (Split-Path $request.Source -NoQualifier).TrimEnd('\')
    $winfrFilter = Join-Path ("\" + $sourceRelative.TrimStart('\')) $request.Pattern

    if ([string]::IsNullOrWhiteSpace($destinationDir)) { $destinationDir = Get-RecoveryDestinationRoot -SourceDriveLetter $sourceDriveLetter }
    if ([string]::IsNullOrWhiteSpace($destinationDir)) {
        Write-ColorMessage -Message "No other local volume found; recovered files must not be written to $sourceQualifier" -Type "Error"
        return
    }
    if ((Split-Path $destinationDir -Qualifier).ToUpper() -eq $sourceQualifier.ToUpper()) {
        Write-ColorMessage -Message "Destination must be on a different volume than $sourceQualifier" -Type "Error"
        return
    }
    if (-not (Test-AdminPrivileges)) {
        Write-ColorMessage -Message "Administrator privileges are required to run winfr." -Type "Error"
        return
    }
    if (-not (Install-Winfr)) {
        Write-ColorMessage -Message "Windows File Recovery is not available: $script:WINFR_EXE" -Type "Error"
        return
    }

    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    Write-ColorMessage -Message "Do not write to $sourceQualifier until recovery finishes." -Type "Warning"
    Write-ColorMessage -Message "winfr $sourceQualifier $destinationDir /$Mode /n $winfrFilter /a" -Type "Info"
    & $script:WINFR_EXE $sourceQualifier $destinationDir "/$Mode" /n $winfrFilter /a

    $recoveredFiles = @(Get-ChildItem -Path $destinationDir -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like $request.Pattern })
    Write-ColorMessage -Message "Recovered $($recoveredFiles.Count) file(s) matching $($request.Pattern) under $destinationDir" -Type "Success"
    $recoveredFiles | Sort-Object FullName | ForEach-Object { Write-Host ("  {0,12:N0}  {1}" -f $_.Length, $_.FullName) }
}

function Start-DmdeRecovery {
    $dmdeExe = Install-Dmde

    if ([string]::IsNullOrWhiteSpace($dmdeExe)) { return }
    Write-ColorMessage -Message "DMDE: open the source volume, run a full scan, then recover to a different volume." -Type "Warning"
    Start-Process -FilePath $dmdeExe -Verb RunAs
}
#endregion

#region Menu System
function Show-FileRecoveryMenu {
    Show-NumberedMenu -Title "Management & Backup > System Tools > File Recovery" -Items @(
        @{ Text = "winfr /regular (NTFS, recently deleted)"; Action = { Invoke-WinfrRecovery -Mode "regular" } },
        @{ Text = "winfr /extensive (older deletes, formatted or non-NTFS)"; Action = { Invoke-WinfrRecovery -Mode "extensive" } },
        @{ Text = "DMDE (GUI, deep scan)"; Action = { Start-DmdeRecovery } },
        @{ Text = "Install DMDE ($script:DMDE_DIR)"; Action = { [void](Install-Dmde) } }
    )
}
#endregion

#region Main Execution
switch ($Action) {
    "Regular" { Invoke-WinfrRecovery -Mode "regular" }
    "Extensive" { Invoke-WinfrRecovery -Mode "extensive" }
    "Dmde" { Start-DmdeRecovery }
    "InstallDmde" { [void](Install-Dmde) }
    default { Show-FileRecoveryMenu }
}
#endregion
