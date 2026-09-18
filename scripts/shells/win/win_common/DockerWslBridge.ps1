<#
.SYNOPSIS
    Docker provider bridge for Windows TTS installers (docker backend).

.DESCRIPTION
    Contract (plan step 20): the model-facing interface on Windows is
    Invoke-TtsDockerEnsure; model steps never touch WSL/Docker internals.

    Providers (per-machine, persisted in the global var store):
      * desktop_wsl2 - Docker Desktop on Windows (docker info responds).
      * wsl_engine   - Docker Engine inside the managed WSL Debian distro.
                       The SAME Linux numbered chain converges it: this bridge
                       runs scripts/shells/linux/debian/install_shells/
                       ensure_docker_for_tts.sh inside the distro, which
                       force-enables START_DOCKER=true (the [^] Start Docker
                       After Installation toggle) and ensures docker-ce +
                       compose plugin per component.

    Persisted keys:
      TTS_DOCKER_PROVIDER      desktop_wsl2|wsl_engine
      TTS_DOCKER_WSL_DISTRO    WSL distro name hosting the engine (default: Debian)

    All wsl.exe calls use argument arrays; no bash -c string concatenation.
#>

$script:DOCKER_BRIDGE_DEFAULT_DISTRO = 'Debian'
$script:DockerBridgeWslSucceeded = $false
$vmComputeService = $null
$vmComputeConfig = $null

if (-not (Get-Command Set-GlobalVar -ErrorAction SilentlyContinue)) {
    . (Join-Path $PSScriptRoot 'GlobalVarStoreCommon.ps1')
}

function script:Set-DockerBridgeVarIfChanged {
    param([string]$Key, [string]$Value)
    if ($Key -eq 'TTS_DOCKER_PROVIDER_STATE') {
        Set-GlobalVar -key 'PYCORE_PREREQUISITE_STEP_STATE' -value $(if ($Value -eq 'ready') { 'ready' } else { 'pending' }) | Out-Null
    }
    $current = Get-GlobalVar -key $Key -defaultValue ''
    if ("$current" -ceq $Value) { return }
    Set-GlobalVar -key $Key -value $Value
}

function script:Invoke-DockerBridgeWsl {
    param([string[]]$Arguments, [switch]$QuietErrors)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $script:DockerBridgeWslSucceeded = $false
    try {
        if ($QuietErrors) {
            & wsl.exe @Arguments 2>$null
        } else {
            & wsl.exe @Arguments 2>&1 | ForEach-Object {
                if ($_ -is [System.Management.Automation.ErrorRecord]) {
                    Write-Host $_ -ForegroundColor DarkYellow
                } else {
                    $_
                }
            }
        }
        $script:DockerBridgeWslSucceeded = ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}

function script:Get-WslDistroList {
    $distros = @()
    $wslExe = Get-Command wsl.exe -ErrorAction SilentlyContinue
    if (-not $wslExe) { return $distros }
    # wsl.exe --list emits UTF-16 text with NUL padding on some builds; clean it.
    $raw = script:Invoke-DockerBridgeWsl -Arguments @('--list', '--quiet') -QuietErrors
    foreach ($line in @($raw)) {
        $name = ("$line" -replace "`0", '').Trim()
        if ($name) { $distros += $name }
    }
    return $distros
}

function Test-DockerDesktopFunctional {
    $dockerExe = Get-Command docker.exe -ErrorAction SilentlyContinue
    if (-not $dockerExe) { return $false }
    & docker.exe info --format '{{.ServerVersion}}' 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Get-TtsDockerProviderStatus {
    $distros = @(script:Get-WslDistroList)
    $savedProvider = Get-GlobalVar -key 'TTS_DOCKER_PROVIDER' -defaultValue ''
    $savedDistro = Get-GlobalVar -key 'TTS_DOCKER_WSL_DISTRO' -defaultValue $script:DOCKER_BRIDGE_DEFAULT_DISTRO
    return @{
        DesktopFunctional = (Test-DockerDesktopFunctional)
        WslAvailable      = [bool](Get-Command wsl.exe -ErrorAction SilentlyContinue)
        Distros           = $distros
        SavedProvider     = "$savedProvider"
        SavedDistro       = "$savedDistro"
    }
}

function script:Resolve-WslRepoPath {
    param([string]$Distro, [string]$WindowsPath)
    $resolved = $null
    $wslPath = $null
    if (-not (Test-Path -LiteralPath $WindowsPath)) { return $null }
    $resolved = (Resolve-Path -LiteralPath $WindowsPath).Path
    $wslPath = script:Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--', 'wslpath', '-a', $resolved) -QuietErrors
    if (-not $script:DockerBridgeWslSucceeded -or -not $wslPath) { return $null }
    return ("$wslPath" -replace "`0", '').Trim()
}

function Initialize-WslHostCompute {
    param([string]$Prefix = '[wsl]')

    $vmComputeService = Get-Service -Name 'vmcompute' -ErrorAction SilentlyContinue
    if (-not $vmComputeService) {
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_vm_platform_missing'
        Write-Host "$Prefix [!] WSL2 Host Compute Service is unavailable. Run 'wsl --install --no-distribution' in an administrator terminal, restart Windows, then re-run this step. If it persists, enable firmware virtualization." -ForegroundColor DarkYellow
        return $false
    }
    if ($vmComputeService.Status -eq 'Running') { return $true }
    try {
        if ($null -eq $vmComputeService.StartType) {
            $vmComputeConfig = Get-CimInstance -ClassName Win32_Service -Filter "Name='vmcompute'" -ErrorAction Stop
        }
        if ($vmComputeService.StartType -eq 'Disabled' -or $vmComputeConfig.StartMode -eq 'Disabled') {
            Write-Host "$Prefix Command: Set-Service -Name vmcompute -StartupType Manual -ErrorAction Stop"
            Set-Service -Name 'vmcompute' -StartupType Manual -ErrorAction Stop
        }
        Write-Host "$Prefix Command: Start-Service -Name vmcompute -ErrorAction Stop"
        Start-Service -Name 'vmcompute' -ErrorAction Stop
    } catch {
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_host_compute_not_running'
        Write-Host "$Prefix [!] Host Compute Service could not start: $_. Confirm VirtualMachinePlatform is enabled, restart Windows, then re-run this step." -ForegroundColor DarkYellow
        return $false
    }
    return $true
}

function Invoke-TtsDockerEnsure {
    <#
    .SYNOPSIS
        Ensure the docker platform for <Engine> on Windows. Returns $true when a
        usable docker provider is ready; $false otherwise (the concrete pending
        state is written to TTS_DOCKER_PROVIDER_STATE and printed in English).
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Engine,
        [string]$CoreNodeRoot = $Global:CORE_NODE_DIR,
        [string]$Prefix = '[docker-bridge]'
    )
    $status = Get-TtsDockerProviderStatus

    # Provider resolution: a saved valid provider wins; otherwise prefer a
    # functional Docker Desktop, else fall back to the in-WSL engine.
    $provider = $status.SavedProvider
    if ($provider -eq 'desktop_wsl2' -and -not $status.DesktopFunctional) {
        Write-Host "$Prefix saved provider desktop_wsl2 is not functional; re-resolving." -ForegroundColor DarkYellow
        $provider = ''
    }
    if (-not $provider) {
        if ($status.DesktopFunctional) { $provider = 'desktop_wsl2' } else { $provider = 'wsl_engine' }
    }
    Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER' -Value $provider
    Write-Host "$Prefix docker provider for '$Engine': $provider"

    if ($provider -eq 'desktop_wsl2') {
        # Docker Desktop is installed and licensed by the user; we only probe it.
        if (Test-DockerDesktopFunctional) {
            Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'ready'
            Write-Host "$Prefix Docker Desktop (WSL2 backend) is responding." -ForegroundColor Green
            return $true
        }
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'desktop_not_running'
        Write-Host "$Prefix [!] Docker Desktop is installed but not responding; start it, then re-run this step." -ForegroundColor DarkYellow
        return $false
    }

    # --- wsl_engine provider ---
    if (-not $status.WslAvailable) {
        # Enabling the WSL Windows feature requires a reboot; never trigger that
        # unattended from a model step. Report the exact pending step instead.
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_missing_run_Step29'
        Write-Host "$Prefix [!] wsl.exe is not available; run Step29_InstallWSL.ps1 first (requires a reboot), then re-run this step." -ForegroundColor DarkYellow
        return $false
    }
    $distro = $status.SavedDistro
    if (-not $distro) { $distro = $script:DOCKER_BRIDGE_DEFAULT_DISTRO }
    if (-not (Initialize-WslHostCompute -Prefix $Prefix)) { return $false }
    if ($status.Distros -notcontains $distro) {
        Write-Host "$Prefix WSL distro '$distro' is not registered; dispatching Step30_InstallWSLDebian13.ps1 ..." -ForegroundColor Yellow
        $step30 = Join-Path (Join-Path $CoreNodeRoot 'scripts\shells\win\install_powershells') 'Step30_InstallWSLDebian13.ps1'
        & $step30 | Where-Object { $_ -isnot [bool] } | Out-Host
        $status = Get-TtsDockerProviderStatus
        if ($status.Distros -notcontains $distro) {
            Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_distro_missing_run_Step30'
            Write-Host "$Prefix [!] WSL distro '$distro' is still missing after Step30; resolve it, then re-run this step." -ForegroundColor DarkYellow
            return $false
        }
    }
    Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_WSL_DISTRO' -Value $distro

    $wslRepo = script:Resolve-WslRepoPath -Distro $distro -WindowsPath $CoreNodeRoot
    if (-not $wslRepo) {
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_repo_path_unresolved'
        Write-Host "$Prefix [!] Could not translate '$CoreNodeRoot' into the WSL filesystem for distro '$distro'." -ForegroundColor DarkYellow
        return $false
    }

    # The SAME Linux numbered chain converges Docker inside WSL: the entry
    # force-enables START_DOCKER and runs 79_install_docker.sh per component.
    $ensureEntry = "$wslRepo/scripts/shells/linux/debian/install_shells/ensure_docker_for_tts.sh"
    Write-Host "$Prefix dispatching in-WSL docker ensure: bash $ensureEntry $Engine (distro: $distro)"
    script:Invoke-DockerBridgeWsl -Arguments @('--distribution', $distro, '--user', 'root', '--exec', 'bash', $ensureEntry, $Engine) | Out-Host
    if (-not $script:DockerBridgeWslSucceeded) {
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_engine_ensure_failed'
        Write-Host "$Prefix [!] In-WSL docker ensure failed; the failing phase reported its reason above. Fix it, then re-run this step." -ForegroundColor DarkYellow
        return $false
    }
    Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'ready'
    Write-Host "$Prefix [OK] Docker Engine inside WSL distro '$distro' is ready (START_DOCKER force-enabled there)." -ForegroundColor Green
    return $true
}

# Engine -> container port map (loopback-published; mirrors
# linux/common/tts_docker_compose_common.sh).
$script:TTS_DOCKER_PORT_MAP = @{
    melotts    = 57212
    voxcpm2    = 57214
    cosyvoice  = 50000
    fishspeech = 8080
    gptsovits  = 9880
}

function script:Copy-TtsDockerAssetIfChanged {
    param([string]$Source, [string]$Destination)
    if ((Test-Path -LiteralPath $Destination) -and
        ((Get-FileHash -LiteralPath $Source).Hash -eq (Get-FileHash -LiteralPath $Destination).Hash)) {
        return
    }
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    Write-Host "[docker-bridge] synced $(Split-Path -Leaf $Destination)"
}

function Invoke-TtsDockerApply {
    <#
    .SYNOPSIS
        Converge one engine's compose service (project pycore-tts-<Engine>).
        wsl_engine: dispatch the SAME linux apply entry inside the distro with
        translated paths. desktop_wsl2: run docker compose from Windows (Docker
        Desktop translates Windows volume paths). Idempotent: a running
        container with the same compose fingerprint is left untouched.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Engine,
        [Parameter(Mandatory = $true)][string]$StagingDir,
        [string]$CoreNodeRoot = $Global:CORE_NODE_DIR,
        [string]$Prefix = '[docker-bridge]'
    )
    New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null
    $provider = Get-GlobalVar -key 'TTS_DOCKER_PROVIDER' -defaultValue ''
    if ($provider -eq 'wsl_engine') {
        $distro = Get-GlobalVar -key 'TTS_DOCKER_WSL_DISTRO' -defaultValue $script:DOCKER_BRIDGE_DEFAULT_DISTRO
        $wslRepo = script:Resolve-WslRepoPath -Distro $distro -WindowsPath $CoreNodeRoot
        $wslStaging = script:Resolve-WslRepoPath -Distro $distro -WindowsPath $StagingDir
        if (-not $wslRepo -or -not $wslStaging) {
            Write-Host "$Prefix [!] could not translate repo/staging paths into distro '$distro'." -ForegroundColor DarkYellow
            return $false
        }
        $entry = "$wslRepo/scripts/shells/linux/debian/install_shells/apply_tts_docker_for_engine.sh"
        Write-Host "$Prefix dispatching in-WSL compose apply: bash $entry $Engine $wslStaging (distro: $distro)"
        script:Invoke-DockerBridgeWsl -Arguments @('--distribution', $distro, '--user', 'root', '--exec', 'bash', $entry, $Engine, $wslStaging) | Out-Host
        return $script:DockerBridgeWslSucceeded
    }

    # desktop_wsl2: docker compose from Windows; Docker Desktop translates paths.
    $assetDir = Join-Path $CoreNodeRoot (Join-Path 'scripts\shells\docker_compose\tts' $Engine)
    if (-not (Test-Path -LiteralPath (Join-Path $assetDir 'compose.yml'))) {
        Write-Host "$Prefix [!] no compose assets for $Engine ($assetDir)." -ForegroundColor DarkYellow
        return $false
    }
    $dockerDir = Join-Path $StagingDir 'docker'
    New-Item -ItemType Directory -Force -Path $dockerDir | Out-Null
    foreach ($file in @('Dockerfile', 'compose.yml', 'compose.gpu.yml')) {
        script:Copy-TtsDockerAssetIfChanged -Source (Join-Path $assetDir $file) -Destination (Join-Path $dockerDir $file)
    }
    $assetNames = @()
    if ($Engine -eq 'melotts') { $assetNames = @('melotts_api_server.py', 'tts_text_chunking.py') }
    if ($Engine -eq 'voxcpm2') { $assetNames = @('voxcpm2_api_server.py', 'tts_text_chunking.py', 'tts_audio_assembly.py') }
    if ($Engine -eq 'gptsovits') { $assetNames = @('gptsovits_build_constraints.txt') }
    $assetRoot = Join-Path $CoreNodeRoot 'pycore\tts_install_assets'
    foreach ($assetName in $assetNames) {
        script:Copy-TtsDockerAssetIfChanged -Source (Join-Path $assetRoot $assetName) -Destination (Join-Path $dockerDir $assetName)
    }

    $device = 'cpu'
    $deviceWant = [string](Get-Item -LiteralPath "Env:$($Engine.ToUpperInvariant())_DEVICE" -ErrorAction SilentlyContinue).Value
    if ($deviceWant -match '^cuda') { $device = 'cuda' }
    elseif (-not $deviceWant -and (Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue)) { $device = 'cuda' }
    $torchIndex = 'https://download.pytorch.org/whl/cpu'
    if ($device -eq 'cuda') {
        $torchIndex = if ($Engine -eq 'fishspeech') { 'https://download.pytorch.org/whl/cu128' } else { 'https://download.pytorch.org/whl/cu130' }
    }
    $port = $script:TTS_DOCKER_PORT_MAP[$Engine]

    $fingerprintSource = (@('Dockerfile', 'compose.yml', 'compose.gpu.yml') + $assetNames) |
        ForEach-Object { (Get-FileHash -LiteralPath (Join-Path $dockerDir $_)).Hash }
    $fingerprint = (($fingerprintSource -join ':') + ":$device")
    $fingerprintFile = Join-Path $dockerDir '.compose_fingerprint'
    $containerId = (& docker ps -aq -f "name=^pycore-tts-$Engine$" 2>$null | Select-Object -First 1)
    if ($containerId -and (Test-Path -LiteralPath $fingerprintFile) -and
        ((Get-Content -LiteralPath $fingerprintFile -Raw).Trim() -eq $fingerprint)) {
        Write-Host "$Prefix $Engine compose service unchanged; container $containerId left as-is."
        return $true
    }

    $composeArgs = @('compose', '-p', "pycore-tts-$Engine", '-f', (Join-Path $dockerDir 'compose.yml'))
    if ($device -eq 'cuda') { $composeArgs += @('-f', (Join-Path $dockerDir 'compose.gpu.yml')) }
    $composeArgs += @('up', '-d', '--build')
    Write-Host "$Prefix converging compose project pycore-tts-$Engine (device=$device, first build takes minutes) ..."
    $prevStaging = $env:TTS_STAGING; $prevPort = $env:TTS_PORT; $prevDevice = $env:TTS_DEVICE; $prevTorchIndex = $env:TORCH_INDEX
    $env:TTS_STAGING = $StagingDir; $env:TTS_PORT = "$port"; $env:TTS_DEVICE = $device; $env:TORCH_INDEX = $torchIndex
    try {
        & docker @composeArgs | Out-Host
    } finally {
        $env:TTS_STAGING = $prevStaging; $env:TTS_PORT = $prevPort; $env:TTS_DEVICE = $prevDevice; $env:TORCH_INDEX = $prevTorchIndex
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "$Prefix [!] docker compose up failed for $Engine (exit $LASTEXITCODE)." -ForegroundColor DarkYellow
        return $false
    }
    Set-Content -LiteralPath $fingerprintFile -Value $fingerprint -Encoding ASCII -NoNewline
    Write-Host "$Prefix [OK] pycore-tts-$Engine is up (loopback port $port)." -ForegroundColor Green
    return $true
}
