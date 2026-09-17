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

if (-not (Get-Command Set-GlobalVar -ErrorAction SilentlyContinue)) {
    . (Join-Path $PSScriptRoot 'GlobalVarStoreCommon.ps1')
}

function script:Set-DockerBridgeVarIfChanged {
    param([string]$Key, [string]$Value)
    $current = Get-GlobalVar -key $Key -defaultValue ''
    if ("$current" -ceq $Value) { return }
    Set-GlobalVar -key $Key -value $Value
}

function script:Get-WslDistroList {
    $distros = @()
    $wslExe = Get-Command wsl.exe -ErrorAction SilentlyContinue
    if (-not $wslExe) { return $distros }
    # wsl.exe --list emits UTF-16 text with NUL padding on some builds; clean it.
    $raw = & wsl.exe --list --quiet 2>$null
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
    $resolved = (Resolve-Path -LiteralPath $WindowsPath).Path
    $wslPath = & wsl.exe --distribution $Distro -- wslpath -a "$resolved" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $wslPath) { return $null }
    return ("$wslPath" -replace "`0", '').Trim()
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
    if ($status.Distros -notcontains $distro) {
        Write-Host "$Prefix WSL distro '$distro' is not registered; dispatching Step30_InstallWSLDebian13.ps1 ..." -ForegroundColor Yellow
        $step30 = Join-Path (Join-Path $CoreNodeRoot 'scripts\shells\win\install_powershells') 'Step30_InstallWSLDebian13.ps1'
        & $step30
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
    & wsl.exe --distribution $distro --user root --exec bash "$ensureEntry" "$Engine"
    if ($LASTEXITCODE -ne 0) {
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_engine_ensure_failed'
        Write-Host "$Prefix [!] In-WSL docker ensure failed (exit $LASTEXITCODE); the failing phase reported its reason above. Fix it, then re-run this step." -ForegroundColor DarkYellow
        return $false
    }
    Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'ready'
    Write-Host "$Prefix [OK] Docker Engine inside WSL distro '$distro' is ready (START_DOCKER force-enabled there)." -ForegroundColor Green
    return $true
}
