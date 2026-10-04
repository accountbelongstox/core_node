<#
.SYNOPSIS
    Windows delegation into the Docker Engine of a Debian 13 WSL2 distro.

.DESCRIPTION
    Invoke-DockerModelRunner is the model-facing entry: it ensures WSL2 and a
    Debian 13 distro, then runs shell-linux's docker_model_runner.sh inside it.
    Every action prints one line: [docker-model] RESULT <action> <model> PASS|FAIL|SKIP <reason>.
    Docker Desktop is not used.

    Persisted keys:
      TTS_DOCKER_PROVIDER        wsl_engine
      TTS_DOCKER_PROVIDER_STATE  ready, or the pending reason
      TTS_DOCKER_WSL_DISTRO      distro hosting the engine (default: Debian)
#>

$script:DOCKER_BRIDGE_DEFAULT_DISTRO = 'Debian'
$script:DOCKER_BRIDGE_SIDE_DISTRO = 'Debian13'
$script:DOCKER_BRIDGE_SIDE_DISK_SUBDIR = 'debian13'
$script:DOCKER_BRIDGE_REQUIRED_VERSION_ID = '13'
$script:DOCKER_BRIDGE_VERSION_ID_KEY = 'VERSION_ID='
$script:DOCKER_BRIDGE_VHD_HEADROOM_GB = 20
$script:DOCKER_BRIDGE_TERMINATE_SETTLE_SEC = 3
$script:DOCKER_BRIDGE_LXSS_KEY = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'
$script:DOCKER_BRIDGE_LONG_PATH_PREFIX = '\\?\'
$script:DOCKER_BRIDGE_WSL_DEBIAN_DIR = 'scripts\shells\win\install_powershells'
$script:DOCKER_BRIDGE_WSL_DEBIAN_FILE = 'Wsl_Debian13.ps1'
$script:DOCKER_MODEL_RUNNER_SUBPATH = @('scripts', 'shells', 'linux', 'debian', 'install_shells', 'docker_model_runner.sh')
$script:DOCKER_MODEL_DEFINITION_DIR = 'scripts\shells\docker_compose\tts'
$script:DOCKER_MODEL_DEFINITION_FILE = 'model.sh'
$script:DOCKER_MODEL_DEFINITION_KEY_PREFIX = 'MODEL_'
$script:DOCKER_MODEL_RESULT_TAG = '[docker-model] RESULT'
$script:DOCKER_MODEL_RESTART_REASON = 'restart-required'
$script:DOCKER_MODEL_PROVIDER = 'wsl_engine'
$script:DOCKER_MODEL_DEVICE_VAR_SUFFIX = '_DEVICE'
$script:DOCKER_MODEL_CLOUD_PROVIDER_VAR = 'CLOUD_PROVIDER'
$script:DockerBridgeWslSucceeded = $false
$script:DockerBridgeResultLines = @()
$script:DockerBridgeRestartRequired = $false
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
    Set-GlobalVar -key $Key -value $Value | Out-Null
}

function script:ConvertFrom-DockerBridgeWslText {
    param($Line)
    return "$Line".Replace("`0", '').TrimEnd("`r")
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
                    Write-Host (ConvertFrom-DockerBridgeWslText $_) -ForegroundColor DarkYellow
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

function script:Invoke-DockerBridgeRunnerProcess {
    param([string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $script:DockerBridgeWslSucceeded = $false
    $script:DockerBridgeResultLines = @()
    try {
        & wsl.exe @Arguments 2>&1 | ForEach-Object {
            $text = ConvertFrom-DockerBridgeWslText $_
            if (-not $text.Trim()) { return }
            if ($text.Contains($script:DOCKER_MODEL_RESULT_TAG)) { $script:DockerBridgeResultLines += $text }
            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                Write-Host $text -ForegroundColor DarkYellow
            } else {
                Write-Host $text
            }
        }
        $script:DockerBridgeWslSucceeded = ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}

function script:Get-WslDistroList {
    param([switch]$Running)
    $distros = @()
    $listArgs = @('--list', '--quiet')
    if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { return $distros }
    if ($Running) { $listArgs = @('--list', '--running', '--quiet') }
    $raw = Invoke-DockerBridgeWsl -Arguments $listArgs -QuietErrors
    foreach ($line in @($raw)) {
        $name = (ConvertFrom-DockerBridgeWslText $line).Trim()
        if ($name) { $distros += $name }
    }
    return $distros
}

function script:Resolve-WslRepoPath {
    param([string]$Distro, [string]$WindowsPath)
    $resolved = $null
    $wslPath = $null
    $linuxInput = ''
    if (-not (Test-Path -LiteralPath $WindowsPath)) { return $null }
    $resolved = (Resolve-Path -LiteralPath $WindowsPath).Path
    $linuxInput = $resolved.Replace('\', '/')
    $wslPath = Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--exec', 'wslpath', '-a', '-u', $linuxInput) -QuietErrors
    if (-not $script:DockerBridgeWslSucceeded -or -not $wslPath) { return $null }
    return (ConvertFrom-DockerBridgeWslText (@($wslPath)[0])).Trim()
}

function script:Get-WslDistroVersionId {
    param([string]$Distro)
    $lines = Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--user', 'root', '--exec', 'cat', '/etc/os-release') -QuietErrors
    foreach ($line in @($lines)) {
        $text = (ConvertFrom-DockerBridgeWslText $line).Trim()
        if ($text.StartsWith($script:DOCKER_BRIDGE_VERSION_ID_KEY)) {
            return $text.Substring($script:DOCKER_BRIDGE_VERSION_ID_KEY.Length).Trim().Trim('"').Trim("'")
        }
    }
    return ''
}

function script:Get-WslDistroBasePath {
    param([string]$Distro)
    $basePath = ''
    foreach ($item in @(Get-ChildItem -LiteralPath $script:DOCKER_BRIDGE_LXSS_KEY -ErrorAction SilentlyContinue)) {
        $props = Get-ItemProperty -LiteralPath $item.PSPath -ErrorAction SilentlyContinue
        if (-not $props -or "$($props.DistributionName)" -ne $Distro) { continue }
        $basePath = "$($props.BasePath)"
        if ($basePath.StartsWith($script:DOCKER_BRIDGE_LONG_PATH_PREFIX)) {
            $basePath = $basePath.Substring($script:DOCKER_BRIDGE_LONG_PATH_PREFIX.Length)
        }
        return $basePath
    }
    return $basePath
}

function script:Get-DockerBridgeDriveFreeGb {
    param([string]$Path)
    $root = ''
    if ($Path) { $root = [System.IO.Path]::GetPathRoot($Path) }
    if (-not $root) { return -1.0 }
    return [math]::Round((New-Object System.IO.DriveInfo($root)).AvailableFreeSpace / 1GB, 1)
}

function script:Get-DockerBridgeHostFreeRamGb {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
    if (-not $os) { return -1.0 }
    return [math]::Round($os.FreePhysicalMemory / 1MB, 2)
}

function script:ConvertTo-DockerBridgeNumber {
    param([string]$Text)
    $number = 0.0
    if ([double]::TryParse($Text, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
        return $number
    }
    return -1.0
}

function script:Write-DockerModelResult {
    param([string]$Action, [string]$Model, [string]$Status, [string]$Reason)
    $color = 'Red'
    if ($Status -eq 'PASS') { $color = 'Green' }
    if ($Status -eq 'SKIP') { $color = 'DarkYellow' }
    Write-Host ('{0} {1} {2} {3} {4}' -f $script:DOCKER_MODEL_RESULT_TAG, $Action, $Model, $Status, $Reason) -ForegroundColor $color
}

function script:Stop-DockerModelWslDistro {
    param([string]$Distro, [string]$Prefix)
    $freeBefore = Get-DockerBridgeHostFreeRamGb
    Invoke-DockerBridgeWsl -Arguments @('--terminate', $Distro) -QuietErrors | Out-Null
    Start-Sleep -Seconds $script:DOCKER_BRIDGE_TERMINATE_SETTLE_SEC
    $freeAfter = Get-DockerBridgeHostFreeRamGb
    Write-Host ("{0} terminated WSL distro '{1}'; host free RAM {2:N2} GB -> {3:N2} GB (freed {4:N2} GB)." -f $Prefix, $Distro, $freeBefore, $freeAfter, ($freeAfter - $freeBefore))
}

function script:Invoke-DockerBridgeWslDebian {
    param([string]$CoreNodeRoot, [string]$Distro, [string]$InstallDir, [string]$Prefix)
    $wslDebianScript = Join-Path (Join-Path $CoreNodeRoot $script:DOCKER_BRIDGE_WSL_DEBIAN_DIR) $script:DOCKER_BRIDGE_WSL_DEBIAN_FILE
    $wslDebianArgs = @{ Action = 'install'; DistroName = $Distro }
    if ($InstallDir) { $wslDebianArgs['InstallDir'] = $InstallDir }
    Write-Host "$Prefix dispatching $($script:DOCKER_BRIDGE_WSL_DEBIAN_FILE) for WSL distro '$Distro' ..." -ForegroundColor Yellow
    & $wslDebianScript @wslDebianArgs | Where-Object { $_ -isnot [bool] } | Out-Host
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

function Set-WslConfKey {
    <#
    .SYNOPSIS
        Merge one key into /etc/wsl.conf of a distro, keeping every other
        section and key. Returns 'unchanged', 'changed' or 'failed'.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Distro,
        [Parameter(Mandatory = $true)][string]$Section,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value,
        [string]$Prefix = '[wsl-conf]'
    )
    $tempRoot = $Global:TEMP_DIR
    $tempFile = $null
    $wslTemp = $null
    $lines = New-Object System.Collections.Generic.List[string]
    $currentSection = ''
    $sectionFound = $false
    $sectionEnd = -1
    $keyIndex = -1
    $existingValue = $null
    $trimmed = ''
    $separator = -1
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    if (-not $tempRoot) { $tempRoot = $env:TEMP }
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    $tempFile = Join-Path $tempRoot ('wsl_conf_{0}.tmp' -f $Distro)
    [System.IO.File]::WriteAllText($tempFile, '', $utf8NoBom)
    try {
        $wslTemp = Resolve-WslRepoPath -Distro $Distro -WindowsPath $tempFile
        if (-not $wslTemp) {
            Write-Host "$Prefix [!] could not translate '$tempFile' into WSL distro '$Distro'." -ForegroundColor DarkYellow
            return 'failed'
        }
        Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--user', 'root', '--exec', 'test', '-e', '/etc/wsl.conf') -QuietErrors | Out-Null
        if ($script:DockerBridgeWslSucceeded) {
            Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--user', 'root', '--exec', 'cp', '/etc/wsl.conf', $wslTemp) -QuietErrors | Out-Null
            if (-not $script:DockerBridgeWslSucceeded) {
                Write-Host "$Prefix [!] could not read /etc/wsl.conf in WSL distro '$Distro'; left unchanged." -ForegroundColor DarkYellow
                return 'failed'
            }
        }
        foreach ($line in [System.IO.File]::ReadAllText($tempFile).Replace("`r`n", "`n").Split("`n")) { $lines.Add($line) }
        while ($lines.Count -gt 0 -and -not $lines[$lines.Count - 1].Trim()) { $lines.RemoveAt($lines.Count - 1) }

        for ($i = 0; $i -lt $lines.Count; $i++) {
            $trimmed = $lines[$i].Trim()
            if ($trimmed.StartsWith('[') -and $trimmed.EndsWith(']')) {
                $currentSection = $trimmed.Substring(1, $trimmed.Length - 2).Trim()
                if ($currentSection -eq $Section) { $sectionFound = $true; $sectionEnd = $i + 1 }
                continue
            }
            if ($currentSection -ne $Section) { continue }
            if ($trimmed -and -not $trimmed.StartsWith('#')) { $sectionEnd = $i + 1 }
            $separator = $trimmed.IndexOf('=')
            if ($separator -gt 0 -and $trimmed.Substring(0, $separator).Trim() -eq $Key) {
                $keyIndex = $i
                $existingValue = $trimmed.Substring($separator + 1).Trim()
            }
        }

        if ($keyIndex -ge 0 -and $existingValue -eq $Value) { return 'unchanged' }
        if ($keyIndex -ge 0) {
            $lines[$keyIndex] = ('{0}={1}' -f $Key, $Value)
        } elseif ($sectionFound) {
            $lines.Insert($sectionEnd, ('{0}={1}' -f $Key, $Value))
        } else {
            if ($lines.Count -gt 0) { $lines.Add('') }
            $lines.Add(('[{0}]' -f $Section))
            $lines.Add(('{0}={1}' -f $Key, $Value))
        }
        $lines.Add('')
        [System.IO.File]::WriteAllText($tempFile, ($lines -join "`n"), $utf8NoBom)
        Invoke-DockerBridgeWsl -Arguments @('--distribution', $Distro, '--user', 'root', '--exec', 'cp', $wslTemp, '/etc/wsl.conf') -QuietErrors | Out-Null
        if (-not $script:DockerBridgeWslSucceeded) {
            Write-Host "$Prefix [!] could not write /etc/wsl.conf in WSL distro '$Distro'." -ForegroundColor DarkYellow
            return 'failed'
        }
        Write-Host "$Prefix merged [$Section] $Key=$Value into /etc/wsl.conf of '$Distro' (other sections kept)."
        return 'changed'
    } finally {
        Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
    }
}

function Get-DockerModelDefinition {
    <#
    .SYNOPSIS
        Read the KEY=value lines of scripts/shells/docker_compose/tts/<model>/model.sh
        (shared with the Linux runner). Returns an empty table when it is absent.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Model,
        [string]$CoreNodeRoot = $Global:CORE_NODE_DIR
    )
    $definition = @{}
    $definitionPath = Join-Path (Join-Path (Join-Path $CoreNodeRoot $script:DOCKER_MODEL_DEFINITION_DIR) $Model) $script:DOCKER_MODEL_DEFINITION_FILE
    $separator = -1
    $commentIndex = -1
    $key = ''
    $value = ''
    if (-not (Test-Path -LiteralPath $definitionPath)) { return $definition }
    foreach ($line in [System.IO.File]::ReadAllLines($definitionPath)) {
        if (-not $line.StartsWith($script:DOCKER_MODEL_DEFINITION_KEY_PREFIX)) { continue }
        $separator = $line.IndexOf('=')
        if ($separator -lt 1) { continue }
        $key = $line.Substring(0, $separator)
        if ($key.Contains(' ')) { continue }
        $value = $line.Substring($separator + 1).Trim()
        $commentIndex = $value.IndexOf(' #')
        if ($commentIndex -ge 0) { $value = $value.Substring(0, $commentIndex).Trim() }
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $definition[$key] = $value
    }
    return $definition
}

function Initialize-DockerModelWslDistro {
    <#
    .SYNOPSIS
        Ensure WSL2 and a Debian 13 distro for the Docker Engine. Returns the
        distro name, or $null with the pending reason in TTS_DOCKER_PROVIDER_STATE.
        Never unregisters a distro, never changes the default distro, never
        touches .wslconfig.
    #>
    param(
        [string]$Distro = '',
        [string]$CoreNodeRoot = $Global:CORE_NODE_DIR,
        [string]$Prefix = '[docker-bridge]',
        [switch]$NoInstall
    )
    $versionId = ''
    $sideDiskDir = $null

    if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_missing_run_Step29'
        Write-Host "$Prefix [!] wsl.exe is not available; run Wsl_Install.ps1 (it needs a reboot), then re-run this step." -ForegroundColor DarkYellow
        return $null
    }
    if (-not (Initialize-WslHostCompute -Prefix $Prefix)) { return $null }
    Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER' -Value $script:DOCKER_MODEL_PROVIDER
    if (-not $Distro) { $Distro = "$(Get-GlobalVar -key 'TTS_DOCKER_WSL_DISTRO' -defaultValue $script:DOCKER_BRIDGE_DEFAULT_DISTRO)".Trim() }
    if (-not $Distro) { $Distro = $script:DOCKER_BRIDGE_DEFAULT_DISTRO }

    if (@(Get-WslDistroList) -notcontains $Distro) {
        if ($NoInstall) {
            Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_distro_missing_run_Step30'
            Write-Host "$Prefix [!] WSL distro '$Distro' is not registered; run an ensure first." -ForegroundColor DarkYellow
            return $null
        }
        Invoke-DockerBridgeWslDebian -CoreNodeRoot $CoreNodeRoot -Distro $Distro -Prefix $Prefix
        if (@(Get-WslDistroList) -notcontains $Distro) {
            Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_distro_missing_run_Step30'
            Write-Host "$Prefix [!] WSL distro '$Distro' is still missing after Step30; resolve it, then re-run this step." -ForegroundColor DarkYellow
            return $null
        }
    }

    $versionId = Get-WslDistroVersionId -Distro $Distro
    if (-not $versionId) {
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_distro_unreadable'
        Write-Host "$Prefix [!] could not read /etc/os-release in WSL distro '$Distro' (did it start?)." -ForegroundColor DarkYellow
        return $null
    }
    if ($versionId -ne $script:DOCKER_BRIDGE_REQUIRED_VERSION_ID) {
        Write-Host "$Prefix WSL distro '$Distro' reports VERSION_ID=$versionId, not $($script:DOCKER_BRIDGE_REQUIRED_VERSION_ID); using the side-by-side distro '$($script:DOCKER_BRIDGE_SIDE_DISTRO)' (the existing distro and the default are kept)." -ForegroundColor Yellow
        $Distro = $script:DOCKER_BRIDGE_SIDE_DISTRO
        if (@(Get-WslDistroList) -notcontains $Distro) {
            if ($NoInstall) {
                Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_distro_missing_run_Step30'
                Write-Host "$Prefix [!] WSL distro '$Distro' is not registered; run an ensure first." -ForegroundColor DarkYellow
                return $null
            }
            $sideDiskDir = Join-Path $Global:WSL_DISK_DIR $script:DOCKER_BRIDGE_SIDE_DISK_SUBDIR
            Invoke-DockerBridgeWslDebian -CoreNodeRoot $CoreNodeRoot -Distro $Distro -InstallDir $sideDiskDir -Prefix $Prefix
        }
        $versionId = Get-WslDistroVersionId -Distro $Distro
        if ($versionId -ne $script:DOCKER_BRIDGE_REQUIRED_VERSION_ID) {
            Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_debian13_unavailable'
            Write-Host "$Prefix [!] WSL distro '$Distro' is not Debian $($script:DOCKER_BRIDGE_REQUIRED_VERSION_ID) (VERSION_ID='$versionId'); check Step30's package, then re-run this step." -ForegroundColor DarkYellow
            return $null
        }
    }
    Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_WSL_DISTRO' -Value $Distro
    Write-Host "$Prefix [OK] WSL2 distro '$Distro' is Debian $versionId." -ForegroundColor Green
    return $Distro
}

function script:Test-DockerModelHostCapacity {
    param([string]$Model, [string]$Action, [string]$Distro, [string]$CoreNodeRoot, [string]$Prefix)
    $definition = Get-DockerModelDefinition -Model $Model -CoreNodeRoot $CoreNodeRoot
    $needRamGb = ConvertTo-DockerBridgeNumber "$($definition['MODEL_HOST_FREE_RAM_GB'])"
    $needDiskGb = ConvertTo-DockerBridgeNumber "$($definition['MODEL_EST_DISK_GB'])"
    $freeRamGb = -1.0
    $vhdPath = ''
    $freeDiskGb = -1.0
    $needVhdDriveGb = 0.0

    if ($needRamGb -lt 0 -or $needDiskGb -lt 0) {
        Write-DockerModelResult -Action $Action -Model $Model -Status 'FAIL' -Reason 'model_definition_missing(MODEL_HOST_FREE_RAM_GB,MODEL_EST_DISK_GB)'
        return $false
    }
    $freeRamGb = Get-DockerBridgeHostFreeRamGb
    $vhdPath = Get-WslDistroBasePath -Distro $Distro
    $freeDiskGb = Get-DockerBridgeDriveFreeGb -Path $vhdPath
    $needVhdDriveGb = $script:DOCKER_BRIDGE_VHD_HEADROOM_GB + $needDiskGb
    if ($freeRamGb -lt $needRamGb) {
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'skipped_low_host_ram'
        Write-DockerModelResult -Action $Action -Model $Model -Status 'SKIP' -Reason ('host_free_ram_gb={0} need={1}' -f $freeRamGb, $needRamGb)
        return $false
    }
    if ($freeDiskGb -lt $needVhdDriveGb) {
        Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'skipped_low_vhd_disk'
        Write-DockerModelResult -Action $Action -Model $Model -Status 'SKIP' -Reason ('vhd_drive_free_gb={0} need={1} vhd={2}' -f $freeDiskGb, $needVhdDriveGb, $vhdPath)
        return $false
    }
    Write-Host ('{0} pre-flight OK: host free RAM {1} GB >= {2} GB; VHD drive free {3} GB >= {4} GB ({5}).' -f $Prefix, $freeRamGb, $needRamGb, $freeDiskGb, $needVhdDriveGb, $vhdPath)
    return $true
}

function script:Invoke-DockerModelRunnerAction {
    param([string]$Distro, [string]$RunnerPath, [string]$Action, [string]$Model, [string]$WslStaging, [string]$Prefix)
    $status = ''
    $reason = ''
    $rest = ''
    $parts = @()
    $tagIndex = -1
    $deviceVar = ('{0}{1}' -f $Model.ToUpperInvariant(), $script:DOCKER_MODEL_DEVICE_VAR_SUFFIX)
    $previousWslEnv = $env:WSLENV
    $previousCloudProvider = [Environment]::GetEnvironmentVariable($script:DOCKER_MODEL_CLOUD_PROVIDER_VAR, 'Process')
    $cloudProvider = [string](Get-GlobalVar -key $script:DOCKER_MODEL_CLOUD_PROVIDER_VAR -defaultValue '')
    $forwardedVars = @($previousWslEnv)

    $script:DockerBridgeRestartRequired = $false
    if (Get-Item -LiteralPath ('Env:{0}' -f $deviceVar) -ErrorAction SilentlyContinue) {
        $forwardedVars += $deviceVar
    }
    if ($cloudProvider) {
        [Environment]::SetEnvironmentVariable($script:DOCKER_MODEL_CLOUD_PROVIDER_VAR, $cloudProvider, 'Process')
        $forwardedVars += $script:DOCKER_MODEL_CLOUD_PROVIDER_VAR
    }
    $env:WSLENV = ($forwardedVars | Where-Object { $_ }) -join ':'
    Write-Host "$Prefix dispatching: wsl.exe --distribution $Distro --user root --exec bash $RunnerPath $Action $Model $WslStaging"
    try {
        Invoke-DockerBridgeRunnerProcess -Arguments @('--distribution', $Distro, '--user', 'root', '--exec', 'bash', $RunnerPath, $Action, $Model, $WslStaging)
    } finally {
        $env:WSLENV = $previousWslEnv
        [Environment]::SetEnvironmentVariable($script:DOCKER_MODEL_CLOUD_PROVIDER_VAR, $previousCloudProvider, 'Process')
    }
    foreach ($line in $script:DockerBridgeResultLines) {
        $tagIndex = $line.IndexOf($script:DOCKER_MODEL_RESULT_TAG)
        $rest = $line.Substring($tagIndex + $script:DOCKER_MODEL_RESULT_TAG.Length).Trim()
        $parts = $rest.Split([char[]]@(' '), 4, [System.StringSplitOptions]::RemoveEmptyEntries)
        if ($parts.Count -lt 3 -or $parts[0] -ne $Action -or $parts[1] -ne $Model) { continue }
        $status = $parts[2]
        $reason = if ($parts.Count -ge 4) { $parts[3] } else { '' }
        if ($reason.Contains($script:DOCKER_MODEL_RESTART_REASON)) { $script:DockerBridgeRestartRequired = $true }
    }
    if (-not $status) {
        Write-DockerModelResult -Action $Action -Model $Model -Status 'FAIL' -Reason 'runner_printed_no_result_line'
        return $false
    }
    return ($status -eq 'PASS' -and $script:DockerBridgeWslSucceeded)
}

function Invoke-DockerModelRunner {
    <#
    .SYNOPSIS
        Ensure WSL2 + Debian 13, then run docker_model_runner.sh <Action> <Model>
        <staging> inside the distro. Returns $true only on RESULT PASS.
        test (and up -Release) always run the runner's down; every action
        terminates the distro only when this call started it (a distro that
        was already running before this call is left running, and logged).
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Model,
        [Parameter(Mandatory = $true)][ValidateSet('ensure', 'up', 'test', 'down', 'status')][string]$Action,
        [string]$StagingDir = '',
        [string]$Distro = '',
        [string]$CoreNodeRoot = $Global:CORE_NODE_DIR,
        [string]$Prefix = '[docker-bridge]',
        [switch]$Release
    )
    $runningBefore = @()
    $distroName = $null
    $wslRepo = $null
    $wslStaging = $null
    $runnerPath = ''
    $passed = $false
    $actionStarted = $false
    $releaseAfter = ($Action -eq 'test' -or ($Action -eq 'up' -and $Release))
    $terminateAfter = $false

    $runningBefore = @(Get-WslDistroList -Running)
    $distroName = Initialize-DockerModelWslDistro -Distro $Distro -CoreNodeRoot $CoreNodeRoot -Prefix $Prefix -NoInstall:($Action -eq 'down' -or $Action -eq 'status')
    if (-not $distroName) {
        Write-DockerModelResult -Action $Action -Model $Model -Status 'FAIL' -Reason ('platform_{0}' -f (Get-GlobalVar -key 'TTS_DOCKER_PROVIDER_STATE' -defaultValue 'unknown'))
        return $false
    }
    $terminateAfter = ($runningBefore -notcontains $distroName) -and ($releaseAfter -or $Action -ne 'up')

    try {
        if (-not $StagingDir) { $StagingDir = Get-PycoreLocalDataSubDir -SubDir $Model }
        New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null
        $wslRepo = Resolve-WslRepoPath -Distro $distroName -WindowsPath $CoreNodeRoot
        $wslStaging = Resolve-WslRepoPath -Distro $distroName -WindowsPath $StagingDir
        if (-not $wslRepo -or -not $wslStaging) {
            Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value 'wsl_repo_path_unresolved'
            Write-DockerModelResult -Action $Action -Model $Model -Status 'FAIL' -Reason ('wslpath_unresolved repo={0} staging={1}' -f $CoreNodeRoot, $StagingDir)
            return $false
        }
        $runnerPath = (@($wslRepo) + $script:DOCKER_MODEL_RUNNER_SUBPATH) -join '/'

        if ($Action -eq 'up' -or $Action -eq 'test') {
            if (-not (Test-DockerModelHostCapacity -Model $Model -Action $Action -Distro $distroName -CoreNodeRoot $CoreNodeRoot -Prefix $Prefix)) {
                return $false
            }
        }

        $actionStarted = $true
        $passed = Invoke-DockerModelRunnerAction -Distro $distroName -RunnerPath $runnerPath -Action $Action -Model $Model -WslStaging $wslStaging -Prefix $Prefix
        if ($Action -eq 'ensure' -and $script:DockerBridgeRestartRequired) {
            if ($runningBefore -contains $distroName) {
                Write-Host "$Prefix [!] SKIP restart-required: WSL distro '$distroName' was already running before this call, so it was not terminated. Run 'wsl --terminate $distroName' yourself, then re-run this step." -ForegroundColor DarkYellow
            } else {
                Write-Host "$Prefix systemd was just enabled in '$distroName'; terminating it once and re-running ensure." -ForegroundColor Yellow
                Stop-DockerModelWslDistro -Distro $distroName -Prefix $Prefix
                $passed = Invoke-DockerModelRunnerAction -Distro $distroName -RunnerPath $runnerPath -Action $Action -Model $Model -WslStaging $wslStaging -Prefix $Prefix
            }
        }
        if ($Action -eq 'ensure' -or $Action -eq 'up' -or $Action -eq 'test') {
            Set-DockerBridgeVarIfChanged -Key 'TTS_DOCKER_PROVIDER_STATE' -Value $(if ($passed) { 'ready' } else { ('wsl_engine_{0}_failed' -f $Action) })
        }
        return $passed
    } finally {
        if ($releaseAfter -and $actionStarted) {
            Invoke-DockerModelRunnerAction -Distro $distroName -RunnerPath $runnerPath -Action 'down' -Model $Model -WslStaging $wslStaging -Prefix $Prefix | Out-Null
        }
        if ($terminateAfter) {
            Stop-DockerModelWslDistro -Distro $distroName -Prefix $Prefix
        } elseif ($releaseAfter -and $actionStarted) {
            Write-Host "$Prefix WSL distro '$distroName' was already running before this call; leaving it running." -ForegroundColor DarkGray
        }
    }
}

function Invoke-TtsDockerEnsure {
    param(
        [Parameter(Mandatory = $true)][string]$Engine,
        [string]$StagingDir = '',
        [string]$CoreNodeRoot = $Global:CORE_NODE_DIR,
        [string]$Prefix = '[docker-bridge]'
    )
    return (Invoke-DockerModelRunner -Model $Engine -Action ensure -StagingDir $StagingDir -CoreNodeRoot $CoreNodeRoot -Prefix $Prefix)
}

function Invoke-TtsDockerApply {
    param(
        [Parameter(Mandatory = $true)][string]$Engine,
        [Parameter(Mandatory = $true)][string]$StagingDir,
        [string]$CoreNodeRoot = $Global:CORE_NODE_DIR,
        [string]$Prefix = '[docker-bridge]'
    )
    return (Invoke-DockerModelRunner -Model $Engine -Action up -StagingDir $StagingDir -CoreNodeRoot $CoreNodeRoot -Prefix $Prefix)
}
