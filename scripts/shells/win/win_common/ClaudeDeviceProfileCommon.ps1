# Cross-device claudeteam profile (Windows mirror of claude_device_profile_common.sh):
# device name (Tailscale), profile (gpu | desktop), slot role, session name and
# Remote Control support. Profiles live in config/claude_team_roles.json device_profiles.

$script:ClaudeDeviceRootDir = Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent
$script:ClaudeDeviceCatalogPath = Join-Path (Join-Path $script:ClaudeDeviceRootDir "config") "claude_team_roles.json"
$script:ClaudeDeviceOs = "windows"
$script:ClaudeDeviceNvidiaVendor = "VEN_10DE"
$script:ClaudeDeviceStatus = $null

. (Join-Path $PSScriptRoot "TailscaleCommon.ps1")

function Get-ClaudeDeviceTailscaleSelf {
    $tailscaleExe = $null
    if ($null -eq $script:ClaudeDeviceStatus) {
        $tailscaleExe = Find-TailscaleExecutable
        $script:ClaudeDeviceStatus = Get-TailscaleStatusJson -TailscaleExe ([string]$tailscaleExe)
    }
    return (Get-TailscaleJsonProperty -Object $script:ClaudeDeviceStatus -Name "Self")
}

# Tailscale MagicDNS host label, else the computer name; lowercase, [a-z0-9-] only.
function Get-ClaudeDeviceName {
    $name = [string](Get-TailscaleJsonProperty -Object (Get-ClaudeDeviceTailscaleSelf) -Name "DNSName" -Default "")
    $name = $name.Split(".")[0]
    if ([string]::IsNullOrWhiteSpace($name)) {
        $name = $env:COMPUTERNAME
    }
    return (($name.ToLowerInvariant() -replace "[^a-z0-9-]", "-").Trim("-"))
}

function Get-ClaudeDeviceIpv4 {
    $ips = @(Get-TailscaleJsonProperty -Object (Get-ClaudeDeviceTailscaleSelf) -Name "TailscaleIPs" -Default @())
    return ([string](@($ips | Where-Object { [string]$_ -notmatch ":" }) | Select-Object -First 1))
}

# gpu: NVIDIA display adapter (PCI vendor 10DE, driver not required); desktop otherwise.
function Get-ClaudeDeviceProfile {
    $adapters = @()
    try {
        $adapters = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop)
    } catch {
        $adapters = @()
    }
    if (@($adapters | Where-Object { [string]$_.PNPDeviceID -match $script:ClaudeDeviceNvidiaVendor }).Count -gt 0) {
        return "gpu"
    }
    return "desktop"
}

# Role for 1-based slot <Slot> of <DeviceProfile>; empty = plain Claude Code.
function Get-ClaudeDeviceSlotRole {
    param([string]$DeviceProfile, [int]$Slot)
    $catalog = Get-Content -LiteralPath $script:ClaudeDeviceCatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $profiles = Get-TailscaleJsonProperty -Object $catalog -Name "device_profiles"
    $roles = @(Get-TailscaleJsonProperty -Object $profiles -Name $DeviceProfile -Default @())
    if (($Slot -lt 1) -or ($Slot -gt $roles.Count)) {
        return ""
    }
    return ([string]$roles[$Slot - 1]).Replace("{os}", $script:ClaudeDeviceOs)
}

# Role abbreviation: the initial of each hyphen-separated word.
function Get-ClaudeDeviceRoleAbbreviation {
    param([string]$Role)
    return (-join @($Role.Split("-") | Where-Object { $_ } | ForEach-Object { $_.Substring(0, 1) }))
}

function Get-ClaudeDeviceSessionName {
    param([string]$Role)
    return ("{0}-{1}-{2}" -f (Get-ClaudeDeviceName), $Role, (Get-ClaudeDeviceRoleAbbreviation -Role $Role))
}

# --remote-control at launch needs a CLI that has the flag and a claude.ai
# login (no API key / custom base URL).
function Test-ClaudeDeviceRemoteControlSupported {
    $helpText = ""
    $ErrorActionPreference = "Continue"
    if ($env:ANTHROPIC_API_KEY -or $env:ANTHROPIC_BASE_URL) {
        return $false
    }
    try {
        $helpText = [string](& claude --help 2>$null | Out-String)
    } catch {
        return $false
    }
    return ($helpText -match "--remote-control")
}
