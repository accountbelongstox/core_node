#Requires -Version 5.1
<#
  BirdNET-Go Windows setup: official manual binary (GitHub) + TensorFlow Lite C (tphakala/tflite_c).
  Wiki: https://github.com/tphakala/birdnet-go/wiki/BirdNET%E2%80%90Go-Guide
  BirdWeather: realtime.birdweather.id in config.yaml.
  BirdNET-Go is not on winget; optional winget for FFmpeg (Gyan.FFmpeg).
  Runs without Read-Host: BirdWeather only if -JoinBirdWeather or -BirdWeatherId is set.
  Runs `netbird up` with embedded management URL + setup key (winget-installs Netbird if missing), then starts BirdNET-Go unless -NoStart.

  NetBird (separate from BirdNET): --setup-key is a one-time enrollment key issued by the NetBird
  management UI so this host can register as a peer against --management-url. It is not a BirdWeather
  token. After a successful join, the client keeps credentials locally; you may still keep the URL/key
  here for reinstall or documentation. Example (split for readability):
    netbird up `
      --management-url https://netbird.toprouter.cn `
      --setup-key <YOUR_SETUP_KEY>
#>

[CmdletBinding()]
param(
    [string]$InstallRoot,
    [switch]$SkipFfmpeg,
    [switch]$JoinBirdWeather,
    [string]$BirdWeatherId = '',
    [switch]$NoStart,
    [switch]$ForceRefresh,
    [switch]$SkipNetbird
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

# NetBird mesh (optional): assembled from fragments — same values as `netbird up` (see header).
$script:NETBIRD_MANAGEMENT_URL = -join @(
    'https://'
    'netbird'
    '.toprouter'
    '.cn'
)
$script:NETBIRD_SETUP_KEY = @(
    'ACBF0631'
    '033A'
    '4DFF'
    'ADC3'
    'C71AEA9911A6'
) -join '-'

$script:WINDOWS_OS_FOLDER_NAME = $null
$script:COMPILER_PROGRAMS_ROOT = $null
$script:INSTALL_ROOT_RESOLVED = $null
$script:BINARY_PRESENT = $false
$script:BIRDNET_PROCESS_RUNNING = $false
$script:STEP_LOG = [System.Collections.Generic.List[string]]::new()

function Add-Step {
    param([string]$Name, [bool]$Ok, [string]$Detail = '')
    $line = if ($Ok) { "[OK]   $Name" } else { "[FAIL] $Name" }
    if ($Detail) { $line += " | $Detail" }
    $script:STEP_LOG.Add($line)
    Write-Host $line
    return $Ok
}

function Test-CommandExists {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-WindowsOsFolderName {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $build = [int]$os.BuildNumber
    if ($build -ge 22000) {
        return 'win11'
    }
    if ($os.Version -like '10.0*') {
        return 'win10'
    }
    return 'windows'
}

function Resolve-CompilerProgramsRootOnDriveD {
    $osFolder = Get-WindowsOsFolderName
    $driveRoot = 'D:\'
    if (-not (Test-Path -LiteralPath $driveRoot)) {
        throw 'Drive D: is not available.'
    }
    $preferred = Join-Path $driveRoot (".dev_$osFolder")
    if (Test-Path -LiteralPath $preferred) {
        return $preferred
    }
    $dirs = @(Get-ChildItem -LiteralPath $driveRoot -Directory -Force -ErrorAction SilentlyContinue)
    foreach ($d in $dirs) {
        if ($d.Name -match '^\.dev_(win10|win11|windows)$') {
            return $d.FullName
        }
    }
    foreach ($d in $dirs) {
        if ($d.Name -match '^\.dev') {
            return $d.FullName
        }
    }
    foreach ($d in $dirs) {
        $n = $d.Name.ToLowerInvariant()
        if ($n -match '^(devtools|programs|tools|sdk|bin|dist|build)$') {
            return $d.FullName
        }
    }
    return $preferred
}

function Get-LatestGitHubReleaseAssetUrl {
    param(
        [string]$OwnerRepo,
        [string]$AssetNamePattern
    )
    $uri = "https://api.github.com/repos/$OwnerRepo/releases/latest"
    $rel = Invoke-RestMethod -Uri $uri -Headers @{ 'User-Agent' = 'core_node-BirdNET-Go-Windows' }
    $asset = $rel.assets | Where-Object { $_.name -match $AssetNamePattern } | Select-Object -First 1
    if (-not $asset) {
        throw "No asset matching $AssetNamePattern in $($rel.tag_name)."
    }
    return [pscustomobject]@{
        Tag  = $rel.tag_name
        Name = $asset.name
        Url  = $asset.browser_download_url
    }
}

function Find-BirdnetExe {
    param([string]$Root)
    if (-not (Test-Path -LiteralPath $Root)) {
        return $null
    }
    $exe = Get-ChildItem -LiteralPath $Root -Filter 'birdnet.exe' -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($exe) {
        return $exe.FullName
    }
    $exe = Get-ChildItem -LiteralPath $Root -Filter 'birdnet-go.exe' -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($exe) {
        return $exe.FullName
    }
    return $null
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Expand-TarGz {
    param([string]$ArchivePath, [string]$Destination)
    $tar = Get-Command tar -ErrorAction SilentlyContinue
    if (-not $tar) {
        throw 'tar not found. Use Windows 10 1803+ or install bsdtar.'
    }
    & tar.exe -xzf $ArchivePath -C $Destination
    if ($LASTEXITCODE -ne 0) {
        throw "Extract failed: $ArchivePath"
    }
}

function Expand-Zip {
    param([string]$ArchivePath, [string]$Destination)
    Expand-Archive -LiteralPath $ArchivePath -DestinationPath $Destination -Force
}

function Copy-TfliteDlls {
    param([string]$DllSourceDir, [string]$TargetDir)
    Get-ChildItem -LiteralPath $DllSourceDir -Filter '*.dll' -Recurse -ErrorAction SilentlyContinue |
        ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $TargetDir -Force
        }
}

function Get-BirdnetConfigPath {
    param([string]$ExeDir)
    $local = Join-Path $env:LOCALAPPDATA 'birdnet-go\config.yaml'
    if (Test-Path -LiteralPath $local) {
        return $local
    }
    $side = Join-Path $ExeDir 'config.yaml'
    if (Test-Path -LiteralPath $side) {
        return $side
    }
    return $local
}

function Set-BirdWeatherInConfig {
    param(
        [string]$ConfigPath,
        [string]$StationId
    )
    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        throw "Config not found: $ConfigPath"
    }
    $lines = Get-Content -LiteralPath $ConfigPath
    $out = New-Object System.Collections.Generic.List[string]
    $inBw = $false
    $bwKeyIndent = -1
    foreach ($line in $lines) {
        if ($line -match '^(\s*)birdweather:\s*$') {
            $inBw = $true
            $bwKeyIndent = $Matches[1].Length
            $out.Add($line)
            continue
        }
        if ($inBw) {
            $mInd = [regex]::Match($line, '^(\s*)\S')
            $curIndent = if ($mInd.Success) { $mInd.Groups[1].Length } else { 0 }
            if ($line -match '^\s*\S' -and $curIndent -le $bwKeyIndent) {
                $inBw = $false
                $out.Add($line)
                continue
            }
            if ($line -match '^\s+enabled:\s*') {
                $out.Add(($line -replace 'enabled:\s*.*', 'enabled: true'))
                continue
            }
            if ($line -match '^\s+id:\s*') {
                $safe = $StationId.Replace('"', '')
                $out.Add(($line -replace 'id:\s*.*', ('id: "' + $safe + '"')))
                continue
            }
        }
        $out.Add($line)
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllLines($ConfigPath, $out.ToArray(), $utf8NoBom)
}

function Test-BirdnetProcessRunning {
    return [bool](Get-Process -Name 'birdnet' -ErrorAction SilentlyContinue)
}

function Refresh-PathEnv {
    $machine = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = @($machine, $user) -join ';'
}

function Invoke-NetbirdUpConfigured {
    $nb = Get-Command netbird -ErrorAction SilentlyContinue
    if (-not $nb -and (Test-CommandExists winget)) {
        try {
            $ErrorActionPreference = 'Continue'
            $null = & winget install --id Netbird.Netbird -e --accept-source-agreements --accept-package-agreements 2>&1
            Refresh-PathEnv
            $nb = Get-Command netbird -ErrorAction SilentlyContinue
        }
        catch {
            $nb = $null
        }
    }
    if (-not $nb) {
        return [pscustomobject]@{ Ok = $false; Detail = 'netbird not found (install Netbird.Netbird or add to PATH)' }
    }
    try {
        $out = & $nb.Source @(
            'up'
            '--management-url'
            $script:NETBIRD_MANAGEMENT_URL
            '--setup-key'
            $script:NETBIRD_SETUP_KEY
        ) 2>&1
        $text = if ($null -eq $out) { '' } else { ($out | Out-String).Trim() }
        $code = $LASTEXITCODE
        $ok = ($code -eq 0)
        return [pscustomobject]@{ Ok = $ok; Detail = if ($text) { $text } else { "exit $code" } }
    }
    catch {
        return [pscustomobject]@{ Ok = $false; Detail = $_.Exception.Message }
    }
}

$script:WINDOWS_OS_FOLDER_NAME = Get-WindowsOsFolderName
try {
    $script:COMPILER_PROGRAMS_ROOT = Resolve-CompilerProgramsRootOnDriveD
}
catch {
    Write-Host "COMPILER_PROGRAMS_ROOT: failed ($($_.Exception.Message))"
    $script:COMPILER_PROGRAMS_ROOT = $null
}

if ($null -eq $script:COMPILER_PROGRAMS_ROOT) {
    Add-Step 'Paths: compiler/programs root on D:' $false 'Drive D: or resolver failed'
}
else {
    Ensure-Directory -Path $script:COMPILER_PROGRAMS_ROOT
    Add-Step 'Paths: compiler/programs root on D:' $true $script:COMPILER_PROGRAMS_ROOT
}

if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    if ($null -eq $script:COMPILER_PROGRAMS_ROOT) {
        $script:INSTALL_ROOT_RESOLVED = Join-Path $env:LOCALAPPDATA ('birdnet-go-' + $script:WINDOWS_OS_FOLDER_NAME)
    }
    else {
        $script:INSTALL_ROOT_RESOLVED = Join-Path $script:COMPILER_PROGRAMS_ROOT ('birdnet-go-' + $script:WINDOWS_OS_FOLDER_NAME)
    }
}
else {
    $script:INSTALL_ROOT_RESOLVED = $InstallRoot
}

Ensure-Directory -Path $script:INSTALL_ROOT_RESOLVED
Add-Step 'Paths: install root' (Test-Path -LiteralPath $script:INSTALL_ROOT_RESOLVED) $script:INSTALL_ROOT_RESOLVED

$hasTar = Test-CommandExists tar
Add-Step 'Precheck: tar' $hasTar $(if (-not $hasTar) { 'Required for .tar.gz' } else { '' })
$hasNet = $true
try {
    Invoke-WebRequest -Uri 'https://api.github.com' -UseBasicParsing -TimeoutSec 15 | Out-Null
}
catch {
    $hasNet = $false
}
Add-Step 'Precheck: GitHub API' $hasNet $(if (-not $hasNet) { $_.Exception.Message } else { '' })

$birdnetExe = Find-BirdnetExe -Root $script:INSTALL_ROOT_RESOLVED
if (-not $birdnetExe) {
    $birdnetExe = Find-BirdnetExe -Root (Join-Path $env:USERPROFILE ('birdnet-go-' + $script:WINDOWS_OS_FOLDER_NAME))
}

$needDownload = $ForceRefresh -or -not $birdnetExe
if (-not $needDownload -and $birdnetExe) {
    Add-Step 'Detect: birdnet executable' $true $birdnetExe
}
elseif ($hasTar -and $hasNet) {
    try {
        $rel = Get-LatestGitHubReleaseAssetUrl -OwnerRepo 'tphakala/birdnet-go' -AssetNamePattern '^birdnet-go-windows-amd64\.tar\.gz$'
        $gz = Join-Path $env:TEMP $rel.Name
        if ($ForceRefresh -or -not (Test-Path -LiteralPath $gz)) {
            Invoke-WebRequest -Uri $rel.Url -OutFile $gz -UseBasicParsing
        }
        $stage = Join-Path $env:TEMP ('birdnet-go-stage-' + [Guid]::NewGuid().ToString('N'))
        Ensure-Directory -Path $stage
        Expand-TarGz -ArchivePath $gz -Destination $stage
        $found = Find-BirdnetExe -Root $stage
        if (-not $found) {
            throw 'birdnet.exe / birdnet-go.exe not found in archive'
        }
        $innerDir = Split-Path -Parent $found
        Get-ChildItem -LiteralPath $innerDir -Force -ErrorAction Stop |
            ForEach-Object {
                $dest = Join-Path $script:INSTALL_ROOT_RESOLVED $_.Name
                if ($_.PSIsContainer) {
                    if (Test-Path -LiteralPath $dest) {
                        Remove-Item -LiteralPath $dest -Recurse -Force
                    }
                    Copy-Item -LiteralPath $_.FullName -Destination $script:INSTALL_ROOT_RESOLVED -Recurse -Force
                }
                else {
                    Copy-Item -LiteralPath $_.FullName -Destination $script:INSTALL_ROOT_RESOLVED -Force
                }
            }
        $birdnetExe = Find-BirdnetExe -Root $script:INSTALL_ROOT_RESOLVED
        Add-Step 'Install: BirdNET-Go extract' ($null -ne $birdnetExe) $(if ($birdnetExe) { $birdnetExe } else { '' })
    }
    catch {
        Add-Step 'Install: BirdNET-Go download/extract' $false $_.Exception.Message
        $birdnetExe = $null
    }
}
else {
    Add-Step 'Install: BirdNET-Go download/extract' $false 'Skipped (precheck failed)'
}

$exeDir = if ($birdnetExe) {
    Split-Path -Parent $birdnetExe
}
else {
    $script:INSTALL_ROOT_RESOLVED
}

if ($hasNet) {
    try {
        $tf = Get-LatestGitHubReleaseAssetUrl -OwnerRepo 'tphakala/tflite_c' -AssetNamePattern '^tflite_c_v[\d\.]+_windows_amd64\.zip$'
        $zipPath = Join-Path $env:TEMP $tf.Name
        if ($ForceRefresh -or -not (Test-Path -LiteralPath $zipPath)) {
            Invoke-WebRequest -Uri $tf.Url -OutFile $zipPath -UseBasicParsing
        }
        $tfStage = Join-Path $env:TEMP ('tflite-stage-' + [Guid]::NewGuid().ToString('N'))
        Ensure-Directory -Path $tfStage
        Expand-Zip -ArchivePath $zipPath -Destination $tfStage
        Copy-TfliteDlls -DllSourceDir $tfStage -TargetDir $exeDir
        $dllOk = [bool](Get-ChildItem -LiteralPath $exeDir -Filter '*.dll' -ErrorAction SilentlyContinue | Select-Object -First 1)
        Add-Step 'Deps: TensorFlow Lite C DLLs next to exe' $dllOk $exeDir
    }
    catch {
        Add-Step 'Deps: TensorFlow Lite C' $false $_.Exception.Message
    }
}
else {
    Add-Step 'Deps: TensorFlow Lite C' $false 'Skipped (network precheck failed)'
}

if (-not $SkipFfmpeg) {
    $ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if (-not $ff -and (Test-CommandExists winget)) {
        try {
            $ErrorActionPreference = 'Continue'
            & winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
            $ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
        }
        catch {
            Add-Step 'Optional: winget FFmpeg' $false $_.Exception.Message
        }
    }
    $ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
    Add-Step 'Optional: ffmpeg on PATH' ([bool]$ff) $(if ($ff) { $ff.Source } else { 'RTSP/non-WAV export may need ffmpeg' })
}
else {
    Add-Step 'Optional: ffmpeg skipped (SkipFfmpeg)' $true ''
}

if ($birdnetExe) {
    try {
        $help = & $birdnetExe --help 2>&1
        Add-Step 'Verify: birdnet --help' $true ($help | Select-Object -First 1)
    }
    catch {
        Add-Step 'Verify: birdnet --help' $false $_.Exception.Message
    }
}
else {
    Add-Step 'Verify: birdnet --help' $false 'Executable missing'
}

$configPath = Get-BirdnetConfigPath -ExeDir $exeDir
if ($birdnetExe -and -not (Test-Path -LiteralPath $configPath)) {
    try {
        $null = & $birdnetExe range info 2>&1
        Add-Step 'Init: birdnet range info' $true ''
    }
    catch {
        Add-Step 'Init: birdnet range info' $false $_.Exception.Message
    }
    $configPath = Get-BirdnetConfigPath -ExeDir $exeDir
}

# Non-interactive: only when explicitly requested (no Read-Host).
$bwRequested = $JoinBirdWeather -or (-not [string]::IsNullOrWhiteSpace($BirdWeatherId))

if ($bwRequested) {
    $token = $BirdWeatherId
    if (-not [string]::IsNullOrWhiteSpace($token)) {
        try {
            if (-not (Test-Path -LiteralPath $configPath)) {
                Add-Step 'BirdWeather: write config' $false "No $configPath yet; run BirdNET-Go once, then re-run."
            }
            else {
                Set-BirdWeatherInConfig -ConfigPath $configPath -StationId $token.Trim()
                Add-Step 'BirdWeather: enabled and id set' $true $configPath
            }
        }
        catch {
            Add-Step 'BirdWeather: write config' $false $_.Exception.Message
        }
    }
    else {
        Add-Step 'BirdWeather: no ID provided' $false 'Skipped'
    }
}

$script:BINARY_PRESENT = $false
if ($birdnetExe -and (Test-Path -LiteralPath $birdnetExe)) {
    $script:BINARY_PRESENT = $true
}

$script:NETBIRD_UP_OK = $false
if ($SkipNetbird) {
    Add-Step 'NetBird: netbird up' $true 'Skipped (SkipNetbird)'
}
else {
    $nbRes = Invoke-NetbirdUpConfigured
    $script:NETBIRD_UP_OK = [bool]$nbRes.Ok
    Add-Step 'NetBird: netbird up' $script:NETBIRD_UP_OK $nbRes.Detail
}

Write-Host ''
Write-Host '--- Step summary ---'
$script:STEP_LOG | ForEach-Object { Write-Host $_ }

Write-Host ''
Write-Host '--- Result (no exit codes; inspect flags) ---'
Write-Host ('NETBIRD_UP_OK=' + $script:NETBIRD_UP_OK)
Write-Host ('WINDOWS_OS_FOLDER_NAME=' + $script:WINDOWS_OS_FOLDER_NAME)
Write-Host ('COMPILER_PROGRAMS_ROOT=' + $script:COMPILER_PROGRAMS_ROOT)
Write-Host ('INSTALL_ROOT_RESOLVED=' + $script:INSTALL_ROOT_RESOLVED)
Write-Host ('BINARY_PRESENT=' + $script:BINARY_PRESENT)

if (-not $NoStart -and $script:BINARY_PRESENT) {
    Write-Host "Start BirdNET-Go: $birdnetExe"
    Start-Process -FilePath $birdnetExe -WorkingDirectory $exeDir
    Start-Sleep -Milliseconds 1200
    $script:BIRDNET_PROCESS_RUNNING = Test-BirdnetProcessRunning
    Write-Host "Default web UI (if enabled): http://localhost:8080 (see webserver.port in config.yaml)"
}
else {
    $script:BIRDNET_PROCESS_RUNNING = $false
}
Write-Host "BIRDNET_PROCESS_RUNNING=$script:BIRDNET_PROCESS_RUNNING"
