<#
.SYNOPSIS
    Cross-OS remote control over Tailscale (Windows 10/11 <-> Debian 12/13, Ubuntu 24.04/26.04).

.DESCRIPTION
    Windows counterpart of scripts/shells/linux/common/remote_control_common.sh.
    Three channels, reachable only through the tailnet (100.64.0.0/10):
      VNC (shared desktop, DEFAULT): host = TightVNC in service mode (shares the real console, so the
                     local and the remote user work at the same time; Windows Home too);
                     client = TightVNC viewer (tvnviewer.exe), Remmina on Linux.
      RDP (desktop): host = built-in Remote Desktop (Pro/Enterprise/Education); client = mstsc.
                     RDP takes over the console and locks the local screen.
      SSH (shell):   host = OpenSSH Server + the shared decrypted key (Step5_InstallGitSSH.ps1);
                     client = OpenSSH Client.
    Password = Windows sign-in password (RDP/SSH authenticate against the local account).

    Official docs (checked 2026-09-29):
      https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse
      https://learn.microsoft.com/windows-server/administration/openssh/openssh_keymanagement
      https://learn.microsoft.com/windows-hardware/customize/desktop/unattend/microsoft-windows-terminalservices-localsessionmanager-fdenytsconnections
      https://support.microsoft.com/windows/how-to-use-remote-desktop-5fe128d5-8fb1-7a23-3b8a-41e636865e8c
      https://tailscale.com/kb/1095/secure-rdp-windows
      https://www.tightvnc.com/doc/win/TightVNC_2.8_for_Windows_Installing_from_MSI.pdf
      https://tailscale.com/kb/1193/tailscale-ssh   (Tailscale SSH server: Linux/macOS only)

.NOTES
    powershell -File RemoteControlCommon.ps1 -Action Menu|Endpoints|Controller|OneClickHost|Host|Vnc|VncReset|Connect|Status|Diagnose|ClaudePeer|Help
#>
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('', 'Menu', 'Endpoints', 'Controller', 'OneClickHost', 'Host', 'Vnc', 'VncReset', 'Connect', 'Status', 'Diagnose', 'ClaudePeer', 'Help')]
    [string]$Action = ''
)

# Captured before dot-sourcing TailscaleCommon.ps1, whose own -Action param rebinds $Action here.
$script:RcRequestedAction = $Action
$script:REMOTE_CONTROL_DIR = $PSScriptRoot
$script:REMOTE_CONTROL_SCRIPT = $PSCommandPath
$script:TAILSCALE_COMMON_FOR_RC = Join-Path $script:REMOTE_CONTROL_DIR 'TailscaleCommon.ps1'
$script:INSTALL_POWERSHELLS_DIR_FOR_RC = Join-Path (Split-Path $script:REMOTE_CONTROL_DIR -Parent) 'install_powershells'
$script:SHARED_KEY_INSTALLER = Join-Path $script:INSTALL_POWERSHELLS_DIR_FOR_RC 'Step5_InstallGitSSH.ps1'
$script:RC_HOST_PREINSTALL_SCRIPT = Join-Path $script:INSTALL_POWERSHELLS_DIR_FOR_RC 'Step72_InstallRemoteControlHost.ps1'
# Claude Peer Link reuses the Claude team installer checks (account, Remote Control blockers).
$script:CLAUDE_TEAM_INSTALL_COMMON_FOR_RC = Join-Path $script:REMOTE_CONTROL_DIR 'ClaudeTeamInstallCommon.ps1'
. $script:TAILSCALE_COMMON_FOR_RC
. (Join-Path $script:REMOTE_CONTROL_DIR 'NssmServiceManager.ps1')

$script:RcRdpPort = 3389
$script:RcSshPort = 22
$script:RcVncPort = 5900
$script:RcTailscaleCidr = '100.64.0.0/10'
$script:RcSharedKeyName = 'id_ed25519'
$script:RcTerminalServerKey = 'HKLM:\System\CurrentControlSet\Control\Terminal Server'
$script:RcPasswordLessKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\PasswordLess\Device'
$script:RcCurrentVersionKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$script:RcMsaIdentityKey = 'HKCU:\Software\Microsoft\IdentityCRL\UserExtendedProperties'
$script:RcRdpFirewallRules = @('RemoteDesktop-UserMode-In-TCP', 'RemoteDesktop-UserMode-In-UDP')
$script:RcRdpTailscaleRule = 'CoreNode-RemoteControl-RDP-Tailscale'
$script:RcVncTailscaleRule = 'CoreNode-RemoteControl-VNC-Tailscale'
$script:RcSshFirewallRule = 'OpenSSH-Server-In-TCP'
$script:RcSshServerCapability = 'OpenSSH.Server~~~~0.0.1.0'
$script:RcSshClientCapability = 'OpenSSH.Client~~~~0.0.1.0'
$script:RcAdminKeysFile = Join-Path (Join-Path $env:ProgramData 'ssh') 'administrators_authorized_keys'
$script:RcAdministratorsSid = '*S-1-5-32-544'
$script:RcSystemSid = '*S-1-5-18'
$script:RcRdpFileDir = Join-Path $env:TEMP 'core_node_rdp'
$script:RcConnectOsNames = @('linux', 'windows')
$script:RcSshdConfigFile = Join-Path (Join-Path $env:ProgramData 'ssh') 'sshd_config'
$script:RcOpenSshRegistryKey = 'HKLM:\SOFTWARE\OpenSSH'
$script:RcClaudePeerLogPrefix = 'claude_peer_link'
$script:RcClaudePeerLatestLog = Join-Path $Global:LOGS_DIR ('{0}_latest.log' -f $script:RcClaudePeerLogPrefix)
$script:RcClaudePeerSessionName = 'win-desktop'
$script:RcVncServiceName = 'tvnserver'
$script:RcVncWingetId = 'GlavSoft.TightVNC'
$script:RcVncServerExeName = 'tvnserver.exe'
$script:RcVncViewerExeName = 'tvnviewer.exe'
$script:RcVncInstallDirs = @(@($env:ProgramFiles, ${env:ProgramFiles(x86)}) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { Join-Path $_ 'TightVNC' })
$script:RcVncRegistryKey64 = 'HKLM:\SOFTWARE\TightVNC\Server'
$script:RcVncRegistryKey32 = 'HKLM:\SOFTWARE\WOW6432Node\TightVNC\Server'
$script:RcVncServerMsiProperties = @('ADDLOCAL=Server,Viewer', 'SERVER_REGISTER_AS_SERVICE=1', 'SERVER_ALLOW_SAS=1', 'SERVER_ADD_FIREWALL_EXCEPTION=0', 'SET_USEVNCAUTHENTICATION=1', 'VALUE_OF_USEVNCAUTHENTICATION=1')
$script:RcVncViewerMsiProperties = @('ADDLOCAL=Viewer')
$script:RcVncPasswordLength = 8
$script:RcVncPasswordChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
$script:RcVncDesKey = [byte[]](0xE8, 0x4A, 0xD6, 0x60, 0xC4, 0x72, 0x1A, 0xE0)
$script:RcVncWaitSeconds = 15
$script:RcAppCompatLayersKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers'
$script:RcDpiAwareFlag = 'HIGHDPIAWARE'
$script:RcVncViewerScale = 'auto'
$script:RcPortProbeTimeoutMs = 3000
$script:RcModeVnc = 'vnc'
$script:RcModeRdp = 'rdp'
$script:RcModeSsh = 'ssh'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Self + peers with an IPv4 (Self first), from the shared Tailscale device table.
function Get-RemoteControlPeers {
    $installInfo = $null

    $installInfo = Get-TailscaleInstallInfo
    if (-not $installInfo.Installed) { return @() }
    return @(Get-TailscaleDeviceTable -TailscaleExe $installInfo.ExePath |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_.IPv4) } |
        Sort-Object -Property @{ Expression = 'Self'; Descending = $true }, 'HostName')
}

function Show-RemoteControlPeerTable {
    param([object[]]$Peers = @())
    $index = 0
    $name = ''

    Write-ColorMessage -Message '== Tailscale IPs ==' -Type 'Info'
    if ($Peers.Count -eq 0) {
        Write-ColorMessage -Message "  (no Tailscale IPs: install/login Tailscale first -- state: $(Get-TailscaleQuickStateLabel))" -Type 'Warning'
        return
    }
    Write-Host ('  {0,-3} {1,-22} {2,-8} {3,-7} {4,-16} {5}' -f '#', 'HOSTNAME', 'OS', 'ONLINE', 'TAILSCALE IPV4', 'MAGICDNS')
    foreach ($peer in $Peers) {
        $name = if ($peer.Self) { "$($peer.HostName) (this)" } else { $peer.HostName }
        Write-Host ('  {0,-3} {1,-22} {2,-8} {3,-7} {4,-16} {5}' -f $index, $name, $peer.OS.ToLower(), $(if ($peer.Online) { 'yes' } else { 'no' }), $peer.IPv4, $peer.DNSName)
        $index++
    }
}

# Shared key pair decrypted by Step5_InstallGitSSH.ps1: id_ed25519 first, else
# any *.pub with a matching private key (same rule as Test-SSHKeyPairExists).
function Find-RemoteControlSharedKey {
    $preferred = Join-Path $Global:SSH_DIR $script:RcSharedKeyName
    $private = ''

    if ((Test-Path -LiteralPath $preferred) -and (Test-Path -LiteralPath "$preferred.pub")) { return $preferred }
    if (-not (Test-Path -LiteralPath $Global:SSH_DIR)) { return $null }
    foreach ($pub in @(Get-ChildItem -Path $Global:SSH_DIR -Filter '*.pub' -File -ErrorAction SilentlyContinue)) {
        $private = Join-Path $Global:SSH_DIR ([System.IO.Path]::GetFileNameWithoutExtension($pub.Name))
        if (Test-Path -LiteralPath $private) { return $private }
    }
    return $null
}

function Confirm-RemoteControlSharedKey {
    $answer = ''

    if ($null -ne (Find-RemoteControlSharedKey)) { return $true }
    Write-ColorMessage -Message "Shared SSH key not found in $($Global:SSH_DIR); it is decrypted by Step5_InstallGitSSH.ps1." -Type 'Warning'
    $answer = Read-Host 'Run Step5_InstallGitSSH.ps1 now? [y/N]'
    if ($answer -match '^(?i)y') {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $script:SHARED_KEY_INSTALLER
    } else {
        Write-ColorMessage -Message 'Skipped; SSH will fall back to the Windows password.' -Type 'Info'
    }
    return ($null -ne (Find-RemoteControlSharedKey))
}

function Install-RemoteControlCapability {
    param([Parameter(Mandatory = $true)][string]$Name)
    $capability = $null

    $capability = Get-WindowsCapability -Online -Name $Name -ErrorAction SilentlyContinue
    if ($null -ne $capability -and $capability.State -eq 'Installed') { return }
    Write-ColorMessage -Message "Installing Windows capability $Name ..." -Type 'Info'
    Add-WindowsCapability -Online -Name $Name | Out-Null
}

# Home editions (EditionID Core*) have no Remote Desktop host.
function Test-RemoteControlRdpHostSupported {
    $editionId = [string](Get-ItemProperty -Path $script:RcCurrentVersionKey -Name 'EditionID' -ErrorAction SilentlyContinue).EditionID
    return (-not ($editionId -like 'Core*'))
}

# True when something listens on the TCP port (post-enable verification).
function Test-RemoteControlPortListening {
    param([Parameter(Mandatory = $true)][int]$Port)
    return ($null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1))
}

# Microsoft account e-mail when this user signs in with one (RDP user name), else ''.
function Get-RemoteControlMicrosoftAccount {
    $entry = Get-ChildItem -Path $script:RcMsaIdentityKey -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $entry) { return '' }
    return [string]$entry.PSChildName
}

function Get-RemoteControlSelfIPv4 {
    $self = @(Get-RemoteControlPeers | Where-Object { $_.Self }) | Select-Object -First 1
    if ($null -eq $self) { return '<tailscale-ip>' }
    return $self.IPv4
}

function Invoke-RemoteControlElevated {
    param([Parameter(Mandatory = $true)][string]$ElevatedAction)
    Write-ColorMessage -Message 'Administrator rights are required; relaunching elevated...' -Type 'Warning'
    try {
        Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $script:REMOTE_CONTROL_SCRIPT), '-Action', $ElevatedAction
        ) | Out-Null
    } catch {
        Write-ColorMessage -Message "Elevation declined or failed: $($_.Exception.Message)" -Type 'Error'
    }
}

# ---------------------------------------------------------------------------
# VNC helpers (TightVNC; shared console desktop, default channel)
# ---------------------------------------------------------------------------

function Find-RemoteControlVncExe {
    param([Parameter(Mandatory = $true)][string]$ExeName)
    $candidate = ''

    foreach ($dir in $script:RcVncInstallDirs) {
        $candidate = Join-Path $dir $ExeName
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

# 32-bit TightVNC (Program Files (x86)) keeps its settings under WOW6432Node.
function Get-RemoteControlVncRegistryKey {
    $serverExe = Find-RemoteControlVncExe -ExeName $script:RcVncServerExeName
    $programFilesX86 = ${env:ProgramFiles(x86)}

    if ($null -ne $serverExe -and -not [string]::IsNullOrWhiteSpace($programFilesX86) -and
        $env:ProgramFiles -ne $programFilesX86 -and $serverExe.StartsWith($programFilesX86, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $script:RcVncRegistryKey32
    }
    return $script:RcVncRegistryKey64
}

# Installs TightVNC through winget with the given MSI properties (passed with --custom, so the
# installer defaults stay). No secret is ever put on this command line (winget logs it).
function Install-RemoteControlVncPackage {
    param(
        [Parameter(Mandatory = $true)][string[]]$MsiProperties,
        [switch]$Force
    )
    $wingetArgs = @('install', '--id', $script:RcVncWingetId, '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--custom', ($MsiProperties -join ' '))

    if (-not (Ensure-Winget -RepoRootDir $Global:PROJECT_DIR)) {
        Write-ColorMessage -Message '  winget is unavailable; cannot install TightVNC automatically.' -Type 'Error'
        return
    }
    if ($Force) { $wingetArgs += '--force' }
    Write-ColorMessage -Message "  Installing TightVNC via winget ($script:RcVncWingetId) ..." -Type 'Info'
    & winget.exe @wingetArgs | Out-Host
    Update-SessionPathFromRegistry
}

# Viewer for the client side; reuses an existing install (Server+Viewer or Viewer only).
function Install-RemoteControlVncViewer {
    if ($null -ne (Find-RemoteControlVncExe -ExeName $script:RcVncViewerExeName)) { return }
    Install-RemoteControlVncPackage -MsiProperties $script:RcVncViewerMsiProperties
}

# Server for the host side; a viewer-only install is upgraded in place (--force) to Server+Viewer.
function Install-RemoteControlVncServer {
    $viewerOnly = $null -ne (Find-RemoteControlVncExe -ExeName $script:RcVncViewerExeName)

    if ($null -ne (Find-RemoteControlVncExe -ExeName $script:RcVncServerExeName)) { return }
    Install-RemoteControlVncPackage -MsiProperties $script:RcVncServerMsiProperties -Force:$viewerOnly
}

# Random default shown once on the console; unbiased pick from the unambiguous character set.
function New-RemoteControlVncRandomPassword {
    $chars = $script:RcVncPasswordChars
    $limit = 256 - (256 % $chars.Length)
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buffer = New-Object byte[] 1
    $result = ''

    try {
        while ($result.Length -lt $script:RcVncPasswordLength) {
            $rng.GetBytes($buffer)
            if ($buffer[0] -lt $limit) { $result += $chars[$buffer[0] % $chars.Length] }
        }
    } finally {
        $rng.Dispose()
    }
    return $result
}

# VNC authentication uses at most 8 printable ASCII characters; typed in plain text (VNC passwords are low-entropy shared secrets).
function Read-RemoteControlVncPassword {
    $generated = New-RemoteControlVncRandomPassword
    $plain = ''

    Write-ColorMessage -Message "  Suggested VNC password: $generated" -Type 'Warning'
    while ($true) {
        $plain = [string](Read-Host -Prompt "  VNC password (max $script:RcVncPasswordLength printable ASCII chars; Enter = use $generated)")
        if ($plain.Length -eq 0) { return $generated }
        if ($plain -notmatch '^[ -~]+$') {
            Write-ColorMessage -Message '  Use printable ASCII characters only.' -Type 'Error'
            continue
        }
        if ($plain.Length -gt $script:RcVncPasswordLength) {
            Write-ColorMessage -Message "  VNC authentication ignores characters past $script:RcVncPasswordLength; the password was truncated." -Type 'Warning'
            $plain = $plain.Substring(0, $script:RcVncPasswordLength)
        }
        return $plain
    }
}

# TightVNC stores the password as 8 bytes: DES-ECB of the zero-padded password with the fixed VNC key.
function Invoke-RemoteControlVncDes {
    param([Parameter(Mandatory = $true)][byte[]]$Block, [switch]$Decrypt)
    $des = New-Object System.Security.Cryptography.DESCryptoServiceProvider
    $transform = $null

    $des.Mode = [System.Security.Cryptography.CipherMode]::ECB
    $des.Padding = [System.Security.Cryptography.PaddingMode]::None
    $des.Key = $script:RcVncDesKey
    $des.IV = New-Object byte[] 8
    $transform = if ($Decrypt) { $des.CreateDecryptor() } else { $des.CreateEncryptor() }
    try {
        return ,$transform.TransformFinalBlock($Block, 0, 8)
    } finally {
        $transform.Dispose()
        $des.Dispose()
    }
}

function ConvertTo-RemoteControlVncPasswordBytes {
    param([Parameter(Mandatory = $true)][string]$Password)
    $plainBytes = New-Object byte[] 8

    [System.Text.Encoding]::ASCII.GetBytes($Password.Substring(0, [Math]::Min($Password.Length, 8))).CopyTo($plainBytes, 0)
    return ,(Invoke-RemoteControlVncDes -Block $plainBytes)
}

# Current VNC password from the TightVNC registry value ('' when not configured).
function Get-RemoteControlVncPassword {
    $settings = Get-ItemProperty -Path (Get-RemoteControlVncRegistryKey) -ErrorAction SilentlyContinue
    $plainBytes = $null

    if ($null -eq $settings -or $null -eq $settings.PSObject.Properties['Password'] -or @($settings.Password).Count -ne 8) { return '' }
    $plainBytes = Invoke-RemoteControlVncDes -Block ([byte[]]$settings.Password) -Decrypt
    return ([System.Text.Encoding]::ASCII.GetString($plainBytes)).TrimEnd([char]0)
}

# Display scaling > 100% makes a DPI-unaware tvnserver capture a virtualized (partial) screen;
# the compatibility layer makes it capture the full physical framebuffer. True when changed.
function Set-RemoteControlVncDpiAware {
    $changed = $false
    $current = ''
    $exePath = ''

    if (-not (Test-Path -LiteralPath $script:RcAppCompatLayersKey)) { New-Item -Path $script:RcAppCompatLayersKey -Force | Out-Null }
    foreach ($exeName in @($script:RcVncServerExeName, $script:RcVncViewerExeName)) {
        $exePath = Find-RemoteControlVncExe -ExeName $exeName
        if ($null -eq $exePath) { continue }
        $current = Get-RemoteControlAppCompatLayer -ExePath $exePath
        if ($current -match $script:RcDpiAwareFlag) { continue }
        Set-ItemProperty -Path $script:RcAppCompatLayersKey -Name $exePath -Value ($(if ([string]::IsNullOrWhiteSpace($current)) { "~ $script:RcDpiAwareFlag" } else { "$current $script:RcDpiAwareFlag" })) -Type String
        $changed = $true
    }
    return $changed
}

# Compatibility layers of one executable ('' when none).
function Get-RemoteControlAppCompatLayer {
    param([Parameter(Mandatory = $true)][string]$ExePath)
    $layers = Get-ItemProperty -Path $script:RcAppCompatLayersKey -ErrorAction SilentlyContinue

    if ($null -eq $layers -or $null -eq $layers.PSObject.Properties[$ExePath]) { return '' }
    return [string]$layers.PSObject.Properties[$ExePath].Value
}

function Test-RemoteControlVncDpiAware {
    $exePath = Find-RemoteControlVncExe -ExeName $script:RcVncServerExeName

    if ($null -eq $exePath) { return $false }
    return ((Get-RemoteControlAppCompatLayer -ExePath $exePath) -match $script:RcDpiAwareFlag)
}

function Test-RemoteControlVncConfigured {
    $settings = Get-ItemProperty -Path (Get-RemoteControlVncRegistryKey) -ErrorAction SilentlyContinue

    if ($null -eq $settings) { return $false }
    if ($null -eq $settings.PSObject.Properties['Password'] -or $null -eq $settings.PSObject.Properties['UseVncAuthentication']) { return $false }
    return ($settings.UseVncAuthentication -eq 1 -and @($settings.Password).Count -gt 0)
}

# Writes the VNC authentication settings; the service must be stopped by the caller.
function Set-RemoteControlVncConfig {
    param([Parameter(Mandatory = $true)][string]$Password)
    $key = Get-RemoteControlVncRegistryKey
    $passwordBytes = ConvertTo-RemoteControlVncPasswordBytes -Password $Password

    if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null }
    Set-ItemProperty -Path $key -Name 'UseVncAuthentication' -Value 1 -Type DWord
    Set-ItemProperty -Path $key -Name 'UseControlAuthentication' -Value 1 -Type DWord
    Set-ItemProperty -Path $key -Name 'AcceptRfbConnections' -Value 1 -Type DWord
    Set-ItemProperty -Path $key -Name 'AcceptHttpConnections' -Value 0 -Type DWord
    Set-ItemProperty -Path $key -Name 'Password' -Value $passwordBytes -Type Binary
    Set-ItemProperty -Path $key -Name 'ControlPassword' -Value $passwordBytes -Type Binary
}

# True when the TCP connect to the peer succeeds within the probe timeout.
function Test-RemoteControlPeerPort {
    param(
        [Parameter(Mandatory = $true)][string]$Address,
        [Parameter(Mandatory = $true)][int]$Port
    )
    $client = New-Object System.Net.Sockets.TcpClient
    $pending = $null

    try {
        $pending = $client.BeginConnect($Address, $Port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne($script:RcPortProbeTimeoutMs, $false)) { return $false }
        $client.EndConnect($pending)
        return $client.Connected
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Show-RemoteControlVncConnectHint {
    $selfIp = Get-RemoteControlSelfIPv4
    $password = Get-RemoteControlVncPassword

    Write-Host ''
    Write-ColorMessage -Message '== Connect to this PC ==' -Type 'Info'
    Write-Host "  Address:      ${selfIp}:$script:RcVncPort  (VNC, shared desktop: the local user keeps working)"
    Write-Host "  VNC password: $(if ([string]::IsNullOrWhiteSpace($password)) { 'not set' } else { $password })"
    Write-Host ''
    Write-ColorMessage -Message '== Linux setup (Debian/Ubuntu, once) ==' -Type 'Info'
    Write-Host '  1. Join the same tailnet:   dd.sh > Linux System Tools > [T] Tailscale > Install / Repair, then Login'
    if ((Get-MeshVpnProvider) -eq 'headscale') {
        Write-Host "                              (manual: curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up --login-server=$(Get-MeshLoginServerUrl))"
    } else {
        Write-Host '                              (manual: curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up)'
    }
    Write-Host '  2. Install the VNC client:  dd.sh > Linux System Tools > Management & Backup > Remote control > Install clients'
    Write-Host '                              (manual: sudo apt install remmina remmina-plugin-vnc)'
    Write-Host "  3. Connect:                 dd.sh > ... > Remote Control > Connect to a peer   (manual: remmina -c vnc://${selfIp}:$script:RcVncPort)"
    Write-Host '  4. Enter the VNC password above when Remmina asks.'
    Write-Host ''
    Write-Host "  From Windows: tvnviewer.exe -host=${selfIp}::$script:RcVncPort -scale=$script:RcVncViewerScale"
    Write-Host ''
    Write-ColorMessage -Message '== Full screen / scaling ==' -Type 'Info'
    Write-Host "  This PC sends its own desktop ($(Get-RemoteControlScreenSize)); TightVNC cannot resize it to the viewer."
    Write-Host '  Remmina: profiles from dd.sh open full screen + scaled to fit (scale=1, viewmode=4);'
    Write-Host '           toggle in a session: Right Ctrl+S = scaled mode, Right Ctrl+F = full screen.'
    Write-Host '           repair saved profiles: dd.sh > ... > Remote control > Fix VNC full screen + scaling.'
    Write-Host '  Text too small: lower this PC''s Settings > System > Display > Scale or resolution; the VNC image follows.'
}

# Physical size of the primary screen (what VNC sends).
function Get-RemoteControlScreenSize {
    $mode = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.CurrentHorizontalResolution } | Select-Object -First 1

    if ($null -eq $mode) { return 'unknown size' }
    return ('{0}x{1}' -f $mode.CurrentHorizontalResolution, $mode.CurrentVerticalResolution)
}

# ---------------------------------------------------------------------------
# 1) Endpoints
# ---------------------------------------------------------------------------

function Show-RemoteControlEndpoints {
    $peers = @(Get-RemoteControlPeers)

    Show-RemoteControlPeerTable -Peers $peers
    Write-Host ''
    Write-ColorMessage -Message '== Connect commands ==' -Type 'Info'
    foreach ($peer in $peers) {
        if ($peer.Self -or ($script:RcConnectOsNames -notcontains $peer.OS.ToLower())) { continue }
        Write-Host "  $($peer.HostName) [$($peer.OS.ToLower())]"
        if ($peer.OS.ToLower() -eq 'windows') {
            Write-Host "    From Windows: tvnviewer.exe -host=$($peer.IPv4)::$script:RcVncPort (VNC shared desktop, default)   |   mstsc /v:$($peer.IPv4) (RDP, locks the local screen)   |   ssh <user>@$($peer.IPv4)"
            Write-Host "    From Linux:   remmina -c vnc://$($peer.IPv4):$script:RcVncPort (VNC shared desktop, default)   |   xfreerdp3 /v:$($peer.IPv4) /u:<user> /dynamic-resolution +clipboard /cert:tofu (RDP)   |   ssh <user>@$($peer.IPv4)"
        } else {
            Write-Host "    From Windows: mstsc /v:$($peer.IPv4)   |   ssh <user>@$($peer.IPv4)"
            Write-Host "    From Linux:   xfreerdp3 /v:$($peer.IPv4) /u:<user> /dynamic-resolution +clipboard /cert:tofu   |   ssh <user>@$($peer.IPv4)"
        }
    }
    Write-Host ''
    Write-ColorMessage -Message "Connect from Linux to a Windows peer: remmina -c vnc://<ip>:$script:RcVncPort  (menu: dd.sh > Linux System Tools > Management & Backup > Remote Control > Connect to a peer)" -Type 'Info'
    Write-ColorMessage -Message "This machine accepts: VNC $script:RcVncPort (VNC password, shared desktop, default), RDP $script:RcRdpPort (Windows sign-in password, locks the local screen), SSH $script:RcSshPort (shared key or password)." -Type 'Info'
    Show-RemoteControlViewerScalingHint
}

# ---------------------------------------------------------------------------
# 2) Controller: this machine can control remote hosts
# ---------------------------------------------------------------------------

function Enable-RemoteControlClient {
    $mstsc = Join-Path $env:WINDIR 'System32\mstsc.exe'
    $sshCommand = $null
    $vncViewer = $null

    Write-ColorMessage -Message '== Enable remote-control client (this machine -> Linux/Windows) ==' -Type 'Info'
    if (-not $Global:IS_RUN_ADMIN) { Invoke-RemoteControlElevated -ElevatedAction 'Controller'; return }
    Install-RemoteControlVncViewer
    $vncViewer = Find-RemoteControlVncExe -ExeName $script:RcVncViewerExeName
    if ($null -ne $vncViewer -and (Set-RemoteControlVncDpiAware)) {
        Write-ColorMessage -Message '  TightVNC viewer marked DPI-aware (sharp scaling with display scaling > 100%).' -Type 'Success'
    }
    Install-RemoteControlCapability -Name $script:RcSshClientCapability
    [void](Confirm-RemoteControlSharedKey)
    $sshCommand = Get-Command -Name 'ssh.exe' -ErrorAction SilentlyContinue
    Write-ColorMessage -Message "  VNC viewer (default for Windows peers): $(if ($null -ne $vncViewer) { $vncViewer } else { 'not found (TightVNC install failed; see the messages above)' })" -Type 'Info'
    Write-ColorMessage -Message "  RDP client: $(if (Test-Path -LiteralPath $mstsc) { $mstsc } else { 'not found' })" -Type 'Info'
    Write-ColorMessage -Message "  SSH client: $(if ($null -ne $sshCommand) { $sshCommand.Source } else { 'not found (reopen the console after install)' })" -Type 'Info'
    Write-ColorMessage -Message "  Shared key: $(if ($null -ne (Find-RemoteControlSharedKey)) { Find-RemoteControlSharedKey } else { 'not installed (password login only)' })" -Type 'Info'
    if ((Get-TailscaleQuickStateLabel) -ne $script:TailscaleRunningState) {
        Write-ColorMessage -Message 'Tailscale is not connected; use Login in the Tailscale menu.' -Type 'Warning'
    }
    Write-ColorMessage -Message 'Remote Linux must allow control: dd.sh > Linux System Tools > Management & Backup > One-click: allow remote control of this machine.' -Type 'Info'
    Show-RemoteControlViewerScalingHint
}

# Viewer-side display hint shared by client setup, connect and endpoints.
function Show-RemoteControlViewerScalingHint {
    Write-ColorMessage -Message "  VNC display: the viewer opens scaled to fit (-scale=$script:RcVncViewerScale); Ctrl+Alt+Shift+F toggles full screen; the remote resolution cannot follow the window (TightVNC)." -Type 'Info'
    Write-ColorMessage -Message '  Only part of the remote screen visible (no scroll bars): run the one-click on that PC (marks TightVNC DPI-aware).' -Type 'Info'
}

# ---------------------------------------------------------------------------
# 3) Host: allow remote control of this machine
# ---------------------------------------------------------------------------

# TightVNC in service mode shares the real console desktop, so the local and the remote user work
# at the same time (RDP locks the local screen). Idempotent: an installed server is never reinstalled;
# the password is (re)applied only on first setup or when the user asks for a reset.
function Enable-RemoteControlVncHost {
    param([switch]$ResetPassword, [switch]$KeepPassword, [switch]$NoConnectHint)
    $serverExe = $null
    $service = $null
    $answer = ''
    $password = ''
    $applyPassword = $false
    $waited = 0

    Write-ColorMessage -Message '-- VNC shared desktop (TightVNC service; default, simultaneous local + remote) --' -Type 'Info'
    Install-RemoteControlVncServer
    $serverExe = Find-RemoteControlVncExe -ExeName $script:RcVncServerExeName
    if ($null -eq $serverExe) {
        Write-ColorMessage -Message "  $script:RcVncServerExeName not found after install; run: winget install --id $script:RcVncWingetId -e" -Type 'Error'
        return
    }
    $service = Get-Service -Name $script:RcVncServiceName -ErrorAction SilentlyContinue
    if ($null -eq $service) {
        & $serverExe -install -silent | Out-Null
        $service = Get-Service -Name $script:RcVncServiceName -ErrorAction SilentlyContinue
    }
    if ($null -eq $service) {
        Write-ColorMessage -Message "  Service $script:RcVncServiceName could not be registered; run: `"$serverExe`" -install -silent" -Type 'Error'
        return
    }

    $applyPassword = $ResetPassword.IsPresent -or -not (Test-RemoteControlVncConfigured)
    if ($KeepPassword -and -not $applyPassword) {
        Write-ColorMessage -Message '  VNC password already configured; kept (change it: Remote Control > Reset VNC password).' -Type 'Info'
    } elseif (-not $applyPassword) {
        $answer = Read-Host '  VNC password is already configured; reset it? [y/N]'
        $applyPassword = ($answer -match '^(?i)y')
    }
    if ($applyPassword) {
        $password = Read-RemoteControlVncPassword
        Stop-Service -Name $script:RcVncServiceName -Force -ErrorAction SilentlyContinue
        Set-RemoteControlVncConfig -Password $password
        Write-ColorMessage -Message "  VNC password applied: $password" -Type 'Success'
    }

    if (Set-RemoteControlVncDpiAware) {
        Write-ColorMessage -Message '  TightVNC marked DPI-aware (full-screen capture with display scaling > 100%).' -Type 'Success'
        if ((Get-Service -Name $script:RcVncServiceName).Status -eq 'Running') { Restart-Service -Name $script:RcVncServiceName -Force -ErrorAction SilentlyContinue }
    }
    if ($service.StartType -ne 'Automatic') { Set-Service -Name $script:RcVncServiceName -StartupType 'Automatic' }
    if ((Get-Service -Name $script:RcVncServiceName).Status -ne 'Running') { Start-Service -Name $script:RcVncServiceName -ErrorAction SilentlyContinue }

    if (-not (Get-NetFirewallRule -Name $script:RcVncTailscaleRule -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name $script:RcVncTailscaleRule -DisplayName 'VNC shared desktop (Tailscale)' -Enabled True -Direction Inbound `
            -Protocol TCP -LocalPort $script:RcVncPort -RemoteAddress $script:RcTailscaleCidr -Action Allow -Profile Any | Out-Null
    } else {
        Get-NetFirewallRule -Name $script:RcVncTailscaleRule | Enable-NetFirewallRule
    }

    while (-not (Test-RemoteControlPortListening -Port $script:RcVncPort) -and $waited -lt $script:RcVncWaitSeconds) {
        Start-Sleep -Seconds 1
        $waited++
    }
    if ((Get-Service -Name $script:RcVncServiceName).Status -eq 'Running' -and (Test-RemoteControlPortListening -Port $script:RcVncPort)) {
        Write-ColorMessage -Message "  TightVNC service running (Automatic) and listening on $script:RcVncPort (firewall open for $script:RcTailscaleCidr only)." -Type 'Success'
        if (-not $NoConnectHint) { Show-RemoteControlVncConnectHint }
    } else {
        Write-ColorMessage -Message "  Service $script:RcVncServiceName is not running or port $script:RcVncPort is NOT listening; check services.msc > TightVNC Server." -Type 'Error'
    }
}

function Enable-RemoteControlVncChannel {
    Write-ColorMessage -Message "== Allow VNC shared-desktop access (user $env:USERNAME) ==" -Type 'Info'
    if (-not $Global:IS_RUN_ADMIN) { Invoke-RemoteControlElevated -ElevatedAction 'Vnc'; return }
    Enable-RemoteControlVncHost
}

function Reset-RemoteControlVncPassword {
    Write-ColorMessage -Message '== Reset VNC password ==' -Type 'Info'
    if (-not $Global:IS_RUN_ADMIN) { Invoke-RemoteControlElevated -ElevatedAction 'VncReset'; return }
    Enable-RemoteControlVncHost -ResetPassword
}

function Enable-RemoteControlRdpHost {
    $msAccount = ''
    $termService = $null

    Write-ColorMessage -Message '-- Remote Desktop (RDP; secondary channel, locks the local screen) --' -Type 'Info'
    if (-not (Test-RemoteControlRdpHostSupported)) {
        Write-ColorMessage -Message 'Windows Home cannot host Remote Desktop; VNC (above) and SSH (below) still work.' -Type 'Warning'
        Write-ColorMessage -Message '  To get RDP: Settings > System > Activation > Upgrade your edition of Windows.' -Type 'Info'
        return
    }
    Set-ItemProperty -Path $script:RcTerminalServerKey -Name 'fDenyTSConnections' -Value 0
    Get-NetFirewallRule -Name $script:RcRdpFirewallRules -ErrorAction SilentlyContinue | Enable-NetFirewallRule
    if (-not (Get-NetFirewallRule -Name $script:RcRdpTailscaleRule -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name $script:RcRdpTailscaleRule -DisplayName 'Remote Desktop (Tailscale)' -Enabled True -Direction Inbound `
            -Protocol TCP -LocalPort $script:RcRdpPort -RemoteAddress $script:RcTailscaleCidr -Action Allow -Profile Any | Out-Null
    }
    $termService = Get-Service -Name 'TermService' -ErrorAction SilentlyContinue
    if ($null -ne $termService -and $termService.StartType -eq 'Disabled') {
        Set-Service -Name 'TermService' -StartupType 'Manual'
        Write-ColorMessage -Message '  TermService was Disabled; startup type restored to Manual.' -Type 'Warning'
    }
    Start-Service -Name 'TermService' -ErrorAction SilentlyContinue
    # "Only allow Windows Hello sign-in" blocks password logon over RDP.
    if (Test-Path -LiteralPath $script:RcPasswordLessKey) {
        Set-ItemProperty -Path $script:RcPasswordLessKey -Name 'DevicePasswordLessBuildVersion' -Value 0 -Type DWord
    }

    if (Test-RemoteControlPortListening -Port $script:RcRdpPort) {
        Write-ColorMessage -Message "  Remote Desktop enabled and listening on $script:RcRdpPort (firewall open for $script:RcTailscaleCidr)." -Type 'Success'
    } else {
        Write-ColorMessage -Message "  Port $script:RcRdpPort is NOT listening after enable; check: services.msc > Remote Desktop Services (TermService) must be Running." -Type 'Error'
        Write-ColorMessage -Message '  Group Policy "Allow users to connect remotely" must not be Disabled: gpedit.msc > Computer Configuration > Administrative Templates > Windows Components > Remote Desktop Services > Remote Desktop Session Host > Connections.' -Type 'Info'
    }

    $msAccount = Get-RemoteControlMicrosoftAccount
    if (-not [string]::IsNullOrWhiteSpace($msAccount)) {
        Write-ColorMessage -Message "  Microsoft account: RDP user = $msAccount, password = the account password (not the PIN)." -Type 'Warning'
        Write-ColorMessage -Message '  If you only ever used a PIN, sign in once with the password (lock screen > Sign-in options > key icon).' -Type 'Info'
    } else {
        Write-ColorMessage -Message "  RDP user = $env:USERNAME, password = Windows sign-in password (a blank password is refused)." -Type 'Info'
    }
}

function Enable-RemoteControlSshHost {
    $sharedKey = $null
    $pubLine = ''

    Write-ColorMessage -Message '-- OpenSSH Server --' -Type 'Info'
    Install-RemoteControlCapability -Name $script:RcSshServerCapability
    Set-Service -Name 'sshd' -StartupType 'Automatic'
    Start-Service -Name 'sshd'
    if (-not (Get-NetFirewallRule -Name $script:RcSshFirewallRule -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name $script:RcSshFirewallRule -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound `
            -Protocol TCP -Action Allow -LocalPort $script:RcSshPort | Out-Null
    }
    Write-ColorMessage -Message "  sshd: $((Get-Service -Name 'sshd').Status)" -Type 'Success'
    if (-not (Test-RemoteControlPortListening -Port $script:RcSshPort)) {
        Write-ColorMessage -Message "  Port $script:RcSshPort is NOT listening; check sshd logs: Get-EventLog -LogName Application -Source sshd -Newest 5" -Type 'Error'
    }

    if (-not (Confirm-RemoteControlSharedKey)) { return }
    $sharedKey = Find-RemoteControlSharedKey
    $pubLine = (Get-Content -LiteralPath "$sharedKey.pub" -TotalCount 1).Trim()
    if (-not (Test-Path -LiteralPath $script:RcAdminKeysFile) -or
        -not (Select-String -LiteralPath $script:RcAdminKeysFile -SimpleMatch -Pattern $pubLine -Quiet)) {
        Add-Content -LiteralPath $script:RcAdminKeysFile -Value $pubLine -Encoding ascii
    }
    & icacls.exe $script:RcAdminKeysFile /inheritance:r /grant "$($script:RcAdministratorsSid):F" /grant "$($script:RcSystemSid):F" | Out-Null
    Write-ColorMessage -Message "  Shared key authorized for administrators ($script:RcAdminKeysFile)." -Type 'Success'
}

function Enable-RemoteControlHost {
    $vncListening = $false
    $rdpListening = $false
    $sshListening = $false

    Write-ColorMessage -Message "== Allow remote control of this machine (user $env:USERNAME) ==" -Type 'Info'
    if (-not $Global:IS_RUN_ADMIN) { Invoke-RemoteControlElevated -ElevatedAction 'Host'; return }
    Enable-RemoteControlVncHost
    Write-Host ''
    Enable-RemoteControlRdpHost
    Write-Host ''
    Enable-RemoteControlSshHost
    Write-Host ''
    $vncListening = Test-RemoteControlPortListening -Port $script:RcVncPort
    $rdpListening = Test-RemoteControlPortListening -Port $script:RcRdpPort
    $sshListening = Test-RemoteControlPortListening -Port $script:RcSshPort
    Write-ColorMessage -Message '== Verification (safe to re-run; every step above is idempotent) ==' -Type 'Info'
    Write-Host "  VNC $script:RcVncPort listening (default, shared desktop): $(if ($vncListening) { 'yes' } else { 'no' })"
    Write-Host "  RDP $script:RcRdpPort listening: $(if ($rdpListening) { 'yes' } else { 'no' })"
    Write-Host "  SSH $script:RcSshPort listening:  $(if ($sshListening) { 'yes' } else { 'no' })"
    Write-Host "  Tailscale IPv4:   $(Get-RemoteControlSelfIPv4)"
    if (-not $vncListening -and -not $rdpListening -and -not $sshListening) {
        Write-ColorMessage -Message 'No channel is up; see the messages above and Help for manual steps.' -Type 'Error'
        return
    }
    Write-Host ''
    Write-ColorMessage -Message "Connect from Linux: dd.sh > Linux System Tools > Management & Backup > Remote Control > Connect to a peer (or: remmina -c vnc://$(Get-RemoteControlSelfIPv4):$script:RcVncPort ; RDP alternative: xfreerdp3 /v:$(Get-RemoteControlSelfIPv4) /u:$env:USERNAME /dynamic-resolution +clipboard /cert:tofu)" -Type 'Info'
    Write-ColorMessage -Message 'RDP takes over the console and locks the local screen; use VNC when the local and the remote user must work at the same time.' -Type 'Info'
    Write-ColorMessage -Message 'If a step could not be automated, see Help for the manual UI steps.' -Type 'Info'
}

# One-click host body (run elevated by the pre-install Step72_InstallRemoteControlHost.ps1):
# Tailscale + VNC shared desktop + SSH. RDP is left as it is, so Linux viewers share the console.
function Install-RemoteControlSharedDesktopHost {
    $installInfo = $null
    $summary = $null
    $vncListening = $false
    $sshListening = $false
    $selfIp = ''

    Write-ColorMessage -Message "== One-click: allow remote control of this machine (VNC shared desktop, user $env:USERNAME) ==" -Type 'Info'
    Write-ColorMessage -Message '-- Tailscale --' -Type 'Info'
    if (Install-TailscaleWinget) {
        [void](Invoke-MeshProviderConverge)
    }
    Write-Host ''
    Enable-RemoteControlVncHost -KeepPassword -NoConnectHint
    Write-Host ''
    Enable-RemoteControlSshHost
    Write-Host ''
    $vncListening = Test-RemoteControlPortListening -Port $script:RcVncPort
    $sshListening = Test-RemoteControlPortListening -Port $script:RcSshPort
    $selfIp = Get-RemoteControlSelfIPv4
    Write-ColorMessage -Message '== Verification (safe to re-run; every step above is idempotent) ==' -Type 'Info'
    Write-Host "  VNC $script:RcVncPort listening (shared desktop): $(if ($vncListening) { 'yes' } else { 'no' })"
    Write-Host "  SSH $script:RcSshPort listening:                  $(if ($sshListening) { 'yes' } else { 'no' })"
    Write-Host "  Tailscale IPv4:                   $selfIp"
    if (-not $vncListening) {
        Write-ColorMessage -Message 'VNC is not up; see the messages above, then Remote Control > Diagnostics.' -Type 'Error'
        return
    }
    Show-RemoteControlVncConnectHint
}

# Menu entry: delegates to the pre-install script, which elevates itself when needed.
function Enable-RemoteControlOneClickHost {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $script:RC_HOST_PREINSTALL_SCRIPT
}

# ---------------------------------------------------------------------------
# 4) Connect to a peer
# ---------------------------------------------------------------------------

function Connect-RemoteControlRdp {
    param([string]$Address, [string]$UserName)
    $rdpFile = Join-Path $script:RcRdpFileDir ("{0}.rdp" -f $Address)

    New-Item -ItemType Directory -Path $script:RcRdpFileDir -Force | Out-Null
    Set-Content -LiteralPath $rdpFile -Encoding ascii -Value @(
        "full address:s:$Address",
        "username:s:$UserName",
        'prompt for credentials:i:1',
        'redirectclipboard:i:1',
        'dynamic resolution:i:1'
    )
    Write-ColorMessage -Message "mstsc $rdpFile" -Type 'Info'
    Start-Process -FilePath 'mstsc.exe' -ArgumentList ('"{0}"' -f $rdpFile) | Out-Null
}

function Connect-RemoteControlSsh {
    param([string]$Address, [string]$UserName)
    $sharedKey = Find-RemoteControlSharedKey
    $sshArgs = @('-o', 'StrictHostKeyChecking=accept-new')

    if ($null -ne $sharedKey) { $sshArgs += @('-i', $sharedKey) }
    $sshArgs += "$UserName@$Address"
    Write-ColorMessage -Message "ssh $($sshArgs -join ' ')" -Type 'Info'
    & ssh.exe @sshArgs
}

function Connect-RemoteControlVnc {
    param([string]$Address)
    $viewer = Find-RemoteControlVncExe -ExeName $script:RcVncViewerExeName

    Write-ColorMessage -Message "$script:RcVncViewerExeName -host=${Address}::$script:RcVncPort -scale=$script:RcVncViewerScale" -Type 'Info'
    Start-Process -FilePath $viewer -ArgumentList @("-host=${Address}::$script:RcVncPort", "-scale=$script:RcVncViewerScale") | Out-Null
    Show-RemoteControlViewerScalingHint
}

function Connect-RemoteControlPeer {
    $peers = @(Get-RemoteControlPeers)
    $choice = ''
    $address = ''
    $userName = ''
    $modeAnswer = ''
    $mode = ''
    $peerOs = ''
    $modeOrder = @()
    $modePorts = @{ $script:RcModeVnc = $script:RcVncPort; $script:RcModeRdp = $script:RcRdpPort; $script:RcModeSsh = $script:RcSshPort }
    $modeLabels = @{ $script:RcModeVnc = 'VNC shared desktop'; $script:RcModeRdp = 'RDP desktop'; $script:RcModeSsh = 'SSH shell' }
    $resolved = ''
    $matchedPeer = $null

    Show-RemoteControlPeerTable -Peers $peers
    if ($peers.Count -eq 0) { return }
    $choice = Read-Host 'Peer number (or a Tailscale IP)'
    if ($choice -match '^\d+$' -and [int]$choice -lt $peers.Count) {
        $address = $peers[[int]$choice].IPv4
        $peerOs = $peers[[int]$choice].OS.ToLower()
    } elseif ($choice.StartsWith('100.')) {
        $address = $choice.Trim()
        $matchedPeer = @($peers | Where-Object { $_.IPv4 -eq $address }) | Select-Object -First 1
        if ($null -ne $matchedPeer) { $peerOs = $matchedPeer.OS.ToLower() }
    } else {
        Write-ColorMessage -Message 'Invalid selection.' -Type 'Error'
        return
    }

    if ($peerOs -eq 'linux') {
        $modeOrder = @($script:RcModeRdp, $script:RcModeSsh)
        $modeAnswer = Read-Host 'Mode: [1] RDP desktop  [2] SSH shell  [1]'
    } else {
        $modeOrder = @($script:RcModeVnc, $script:RcModeRdp, $script:RcModeSsh)
        $modeAnswer = Read-Host 'Mode: [1] VNC shared desktop (local + remote at once)  [2] RDP desktop (locks the local screen)  [3] SSH shell  [1]'
    }
    $mode = $modeOrder[0]
    if ($modeAnswer -match '^\d+$' -and [int]$modeAnswer -ge 1 -and [int]$modeAnswer -le $modeOrder.Count) { $mode = $modeOrder[[int]$modeAnswer - 1] }

    foreach ($candidate in (@($mode) + @($modeOrder | Where-Object { $_ -ne $mode }))) {
        if ($candidate -eq $script:RcModeVnc -and $null -eq (Find-RemoteControlVncExe -ExeName $script:RcVncViewerExeName)) {
            Write-ColorMessage -Message "  $($modeLabels[$candidate]): TightVNC viewer not installed here; run 'Enable this machine to control remote' first." -Type 'Warning'
            continue
        }
        if (-not (Test-RemoteControlPeerPort -Address $address -Port $modePorts[$candidate])) {
            Write-ColorMessage -Message "  $($modeLabels[$candidate]): $address port $($modePorts[$candidate]) is not reachable (peer offline, service not enabled, or firewall); on the peer run 'Allow remote control of this machine'." -Type 'Warning'
            continue
        }
        $resolved = $candidate
        break
    }
    if ($resolved -eq '') {
        Write-ColorMessage -Message "No channel of $address is reachable; check Tailscale, then enable remote control on that machine." -Type 'Error'
        return
    }
    if ($resolved -ne $mode) { Write-ColorMessage -Message "  Falling back to $($modeLabels[$resolved]) (requested: $($modeLabels[$mode]))." -Type 'Warning' }

    if ($resolved -eq $script:RcModeVnc) {
        Connect-RemoteControlVnc -Address $address
        return
    }
    $userName = Read-Host "Remote username [$env:USERNAME]"
    if ([string]::IsNullOrWhiteSpace($userName)) { $userName = $env:USERNAME }
    if ($resolved -eq $script:RcModeSsh) {
        Connect-RemoteControlSsh -Address $address -UserName $userName
    } else {
        Connect-RemoteControlRdp -Address $address -UserName $userName
    }
}

# ---------------------------------------------------------------------------
# Status / Help / Menu
# ---------------------------------------------------------------------------

function Show-RemoteControlStatus {
    $rdpDenied = (Get-ItemProperty -Path $script:RcTerminalServerKey -Name 'fDenyTSConnections' -ErrorAction SilentlyContinue).fDenyTSConnections
    $sshd = Get-Service -Name 'sshd' -ErrorAction SilentlyContinue
    $sharedKey = Find-RemoteControlSharedKey
    $vncService = $null
    $vncRule = $null

    Write-ColorMessage -Message '== Remote control status ==' -Type 'Info'
    Write-Host "  Tailscale:      $(Get-TailscaleQuickStateLabel)  IPv4 $(Get-RemoteControlSelfIPv4)"
    Write-Host "  Login user:     $env:USERNAME"
    $vncService = Get-Service -Name $script:RcVncServiceName -ErrorAction SilentlyContinue
    $vncRule = Get-NetFirewallRule -Name $script:RcVncTailscaleRule -ErrorAction SilentlyContinue
    Write-Host "  VNC host:       $(if ($null -ne $vncService) { "TightVNC $($vncService.Status), $($vncService.StartType)" } else { 'not installed' }) (default, shared desktop)"
    Write-Host "  VNC listening:  $(if (Test-RemoteControlPortListening -Port $script:RcVncPort) { "yes ($script:RcVncPort)" } else { 'no' })"
    Write-Host "  VNC firewall:   $(if ($null -ne $vncRule -and "$($vncRule.Enabled)" -eq 'True') { "$script:RcVncTailscaleRule ($script:RcTailscaleCidr)" } else { 'rule missing' })"
    Write-Host "  VNC viewer:     $(if ($null -ne (Find-RemoteControlVncExe -ExeName $script:RcVncViewerExeName)) { 'installed' } else { 'not installed' })"
    Write-Host "  VNC password:   $(if (Test-RemoteControlVncConfigured) { Get-RemoteControlVncPassword } else { 'not set' })"
    Write-Host "  VNC DPI-aware:  $(if (Test-RemoteControlVncDpiAware) { 'yes' } else { 'no (run one-click / Allow VNC)' }) (screen $(Get-RemoteControlScreenSize))"
    Write-Host "  RDP host:       $(if (-not (Test-RemoteControlRdpHostSupported)) { 'unsupported (Windows Home)' } elseif ($rdpDenied -eq 0) { 'enabled' } else { 'disabled' })"
    Write-Host "  RDP listening:  $(if (Test-RemoteControlPortListening -Port $script:RcRdpPort) { "yes ($script:RcRdpPort)" } else { 'no' })"
    Write-Host "  SSH server:     $(if ($null -ne $sshd) { $sshd.Status } else { 'not installed' })"
    Write-Host "  SSH listening:  $(if (Test-RemoteControlPortListening -Port $script:RcSshPort) { "yes ($script:RcSshPort)" } else { 'no' })"
    Write-Host "  SSH client:     $(if (Get-Command -Name 'ssh.exe' -ErrorAction SilentlyContinue) { 'installed' } else { 'not installed' })"
    Write-Host "  Shared key:     $(if ($null -ne $sharedKey) { $sharedKey } else { 'not installed' })"
}

# One line per check: [OK]/[WARN]/[FAIL] + name + detail. Returns $Ok for counting.
function Write-RemoteControlCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][bool]$Ok,
        [string]$Detail = '',
        [switch]$WarnOnly
    )
    $tag = '[OK]  '
    $type = 'Success'
    if (-not $Ok) {
        if ($WarnOnly) { $tag = '[WARN]'; $type = 'Warning' } else { $tag = '[FAIL]'; $type = 'Error' }
    }
    $line = "  $tag $Name"
    if (-not [string]::IsNullOrWhiteSpace($Detail)) { $line = "$line -- $Detail" }
    Write-ColorMessage -Message $line -Type $type
    return $Ok
}

# Per-item readiness audit of everything a Linux client (remmina VNC/xfreerdp/ssh
# over Tailscale) needs from this Windows host. Read-only; safe to re-run.
function Show-RemoteControlDiagnostics {
    $passed = 0
    $failed = 0
    $ok = $false
    $editionId = ''
    $rdpDenied = $null
    $termService = $null
    $termDetail = 'not found'
    $nla = $null
    $passwordLess = $null
    $rule = $null
    $ruleDetail = ''
    $sshdCap = $null
    $sshd = $null
    $sshdDetail = 'not found'
    $selfIp = ''
    $msAccount = ''
    $sharedKey = $null
    $pubLine = ''
    $tsState = ''
    $summaryType = 'Success'
    $vncService = $null
    $vncDetail = 'not installed'

    Write-ColorMessage -Message '== Remote control diagnostics (what the Linux side needs from this host) ==' -Type 'Info'
    Write-Host ''

    Write-ColorMessage -Message '-- Tailscale --' -Type 'Info'
    $tsState = Get-TailscaleQuickStateLabel
    $selfIp = Get-RemoteControlSelfIPv4
    $ok = ($tsState -eq $script:TailscaleRunningState)
    if (Write-RemoteControlCheck -Name 'Tailscale backend' -Ok $ok -Detail "state=$tsState, IPv4=$selfIp") { $passed++ } else { $failed++ }

    Write-ColorMessage -Message '-- VNC host (default; shared desktop) --' -Type 'Info'
    $ok = ($null -ne (Find-RemoteControlVncExe -ExeName $script:RcVncServerExeName))
    if (Write-RemoteControlCheck -Name 'TightVNC server installed' -Ok $ok -Detail "$(if ($ok) { Find-RemoteControlVncExe -ExeName $script:RcVncServerExeName } else { "winget install --id $script:RcVncWingetId" })") { $passed++ } else { $failed++ }

    $vncService = Get-Service -Name $script:RcVncServiceName -ErrorAction SilentlyContinue
    if ($null -ne $vncService) { $vncDetail = "Status=$($vncService.Status), StartType=$($vncService.StartType)" }
    $ok = ($null -ne $vncService -and $vncService.Status -eq 'Running' -and $vncService.StartType -eq 'Automatic')
    if (Write-RemoteControlCheck -Name "Service $script:RcVncServiceName" -Ok $ok -Detail $vncDetail) { $passed++ } else { $failed++ }

    $ok = Test-RemoteControlPortListening -Port $script:RcVncPort
    if (Write-RemoteControlCheck -Name "TCP $script:RcVncPort listening" -Ok $ok -Detail "$(if ($ok) { 'VNC reachable over the tailnet' } else { 'no listener; Remmina/TightVNC viewer get connection refused' })") { $passed++ } else { $failed++ }

    $rule = Get-NetFirewallRule -Name $script:RcVncTailscaleRule -ErrorAction SilentlyContinue
    $ruleDetail = 'rule missing'
    if ($null -ne $rule) { $ruleDetail = "Enabled=$($rule.Enabled), RemoteAddress=$script:RcTailscaleCidr" }
    $ok = ($null -ne $rule -and "$($rule.Enabled)" -eq 'True')
    if (Write-RemoteControlCheck -Name "Firewall: $script:RcVncTailscaleRule" -Ok $ok -Detail $ruleDetail) { $passed++ } else { $failed++ }

    $ok = Test-RemoteControlVncDpiAware
    if (Write-RemoteControlCheck -Name 'TightVNC DPI-aware (full-screen capture)' -Ok $ok -Detail "$(if ($ok) { "screen $(Get-RemoteControlScreenSize) captured in full" } else { 'with display scaling > 100% the viewer may show only part of the screen; run the one-click (idempotent)' })") { $passed++ } else { $failed++ }

    $ok = ($null -ne $vncService -and (Test-RemoteControlVncConfigured))
    if (Write-RemoteControlCheck -Name 'VNC password configured' -Ok $ok -Detail 'shown by Status / Connection info; change it with Reset VNC password') { $passed++ } else { $failed++ }

    Write-ColorMessage -Message '-- RDP host (secondary; locks the local screen) --' -Type 'Info'
    $editionId = [string](Get-ItemProperty -Path $script:RcCurrentVersionKey -Name 'EditionID' -ErrorAction SilentlyContinue).EditionID
    $ok = Test-RemoteControlRdpHostSupported
    if (Write-RemoteControlCheck -Name 'Edition supports RDP host' -Ok $ok -Detail "EditionID=$editionId (Core* = Home, no RDP host)") { $passed++ } else { $failed++ }

    $rdpDenied = (Get-ItemProperty -Path $script:RcTerminalServerKey -Name 'fDenyTSConnections' -ErrorAction SilentlyContinue).fDenyTSConnections
    $ok = ($rdpDenied -eq 0)
    if (Write-RemoteControlCheck -Name 'fDenyTSConnections' -Ok $ok -Detail "value=$rdpDenied (0 = remote connections allowed)") { $passed++ } else { $failed++ }

    $termService = Get-Service -Name 'TermService' -ErrorAction SilentlyContinue
    if ($null -ne $termService) { $termDetail = "Status=$($termService.Status), StartType=$($termService.StartType)" }
    $ok = ($null -ne $termService -and $termService.Status -eq 'Running' -and $termService.StartType -ne 'Disabled')
    if (Write-RemoteControlCheck -Name 'TermService (Remote Desktop Services)' -Ok $ok -Detail $termDetail) { $passed++ } else { $failed++ }

    $ok = Test-RemoteControlPortListening -Port $script:RcRdpPort
    if (Write-RemoteControlCheck -Name "TCP $script:RcRdpPort listening" -Ok $ok -Detail "$(if ($ok) { 'RDP reachable over the tailnet' } else { 'no listener; Linux clients get connection refused' })") { $passed++ } else { $failed++ }

    $rule = Get-NetFirewallRule -Name 'RemoteDesktop-UserMode-In-TCP' -ErrorAction SilentlyContinue
    $ruleDetail = 'rule missing'
    if ($null -ne $rule) { $ruleDetail = "Enabled=$($rule.Enabled), Profile=$($rule.Profile)" }
    $ok = ($null -ne $rule -and "$($rule.Enabled)" -eq 'True')
    if (Write-RemoteControlCheck -Name 'Firewall: RemoteDesktop-UserMode-In-TCP' -Ok $ok -Detail $ruleDetail) { $passed++ } else { $failed++ }

    $rule = Get-NetFirewallRule -Name $script:RcRdpTailscaleRule -ErrorAction SilentlyContinue
    $ruleDetail = 'rule missing (built-in RDP rules already cover the tailnet)'
    if ($null -ne $rule) { $ruleDetail = "Enabled=$($rule.Enabled), RemoteAddress=$script:RcTailscaleCidr" }
    $ok = ($null -ne $rule -and "$($rule.Enabled)" -eq 'True')
    if (Write-RemoteControlCheck -Name "Firewall: $script:RcRdpTailscaleRule" -Ok $ok -Detail $ruleDetail -WarnOnly) { $passed++ }

    $nla = (Get-ItemProperty -Path "$($script:RcTerminalServerKey)\WinStations\RDP-Tcp" -Name 'UserAuthentication' -ErrorAction SilentlyContinue).UserAuthentication
    [void](Write-RemoteControlCheck -Name 'NLA (UserAuthentication)' -Ok $true -Detail "value=$nla (1 = required; xfreerdp/remmina support NLA)")

    if (Test-Path -LiteralPath $script:RcPasswordLessKey) {
        $passwordLess = (Get-ItemProperty -Path $script:RcPasswordLessKey -Name 'DevicePasswordLessBuildVersion' -ErrorAction SilentlyContinue).DevicePasswordLessBuildVersion
        $ok = ($passwordLess -eq 0)
        if (Write-RemoteControlCheck -Name 'Password logon over RDP allowed' -Ok $ok -Detail "DevicePasswordLessBuildVersion=$passwordLess (0 = allowed; 2 blocks password RDP logon)") { $passed++ } else { $failed++ }
    }

    $msAccount = Get-RemoteControlMicrosoftAccount
    if (-not [string]::IsNullOrWhiteSpace($msAccount)) {
        [void](Write-RemoteControlCheck -Name 'Sign-in account' -Ok $true -Detail "Microsoft account; Linux side username = $msAccount (account password, not PIN)")
    } else {
        [void](Write-RemoteControlCheck -Name 'Sign-in account' -Ok $true -Detail "local account; Linux side username = $env:USERNAME (Windows sign-in password)")
    }

    Write-ColorMessage -Message '-- SSH host (fallback channel) --' -Type 'Info'
    $sshdCap = Get-WindowsCapability -Online -Name $script:RcSshServerCapability -ErrorAction SilentlyContinue
    $ok = ($null -ne $sshdCap -and $sshdCap.State -eq 'Installed')
    if (Write-RemoteControlCheck -Name 'OpenSSH.Server capability' -Ok $ok -Detail "State=$(if ($null -ne $sshdCap) { $sshdCap.State } else { 'unknown' })") { $passed++ } else { $failed++ }

    $sshd = Get-Service -Name 'sshd' -ErrorAction SilentlyContinue
    if ($null -ne $sshd) { $sshdDetail = "Status=$($sshd.Status), StartType=$($sshd.StartType)" }
    $ok = ($null -ne $sshd -and $sshd.Status -eq 'Running')
    if (Write-RemoteControlCheck -Name 'sshd service' -Ok $ok -Detail $sshdDetail) { $passed++ } else { $failed++ }

    $ok = Test-RemoteControlPortListening -Port $script:RcSshPort
    if (Write-RemoteControlCheck -Name "TCP $script:RcSshPort listening" -Ok $ok -Detail "$(if ($ok) { 'SSH reachable over the tailnet' } else { 'no listener; Linux ssh gets connection refused' })") { $passed++ } else { $failed++ }

    $rule = Get-NetFirewallRule -Name $script:RcSshFirewallRule -ErrorAction SilentlyContinue
    $ruleDetail = 'rule missing'
    if ($null -ne $rule) { $ruleDetail = "Enabled=$($rule.Enabled)" }
    $ok = ($null -ne $rule -and "$($rule.Enabled)" -eq 'True')
    if (Write-RemoteControlCheck -Name "Firewall: $script:RcSshFirewallRule" -Ok $ok -Detail $ruleDetail) { $passed++ } else { $failed++ }

    $sharedKey = Find-RemoteControlSharedKey
    if ($null -eq $sharedKey) {
        [void](Write-RemoteControlCheck -Name 'Shared key authorized' -Ok $false -WarnOnly -Detail 'no shared key; password login still works (Step5_InstallGitSSH.ps1 installs it)')
    } else {
        $pubLine = (Get-Content -LiteralPath "$sharedKey.pub" -TotalCount 1).Trim()
        $ok = (Test-Path -LiteralPath $script:RcAdminKeysFile) -and (Select-String -LiteralPath $script:RcAdminKeysFile -SimpleMatch -Pattern $pubLine -Quiet)
        if (Write-RemoteControlCheck -Name 'Shared key authorized' -Ok ([bool]$ok) -Detail "$script:RcAdminKeysFile") { $passed++ } else { $failed++ }
    }

    Write-Host ''
    if ($failed -gt 0) { $summaryType = 'Warning' }
    Write-ColorMessage -Message "== Result: $passed passed, $failed failed ==" -Type $summaryType
    if ($failed -gt 0) {
        Write-ColorMessage -Message "Fix: run 'Allow remote control of this machine' (idempotent) from this menu, then re-run Diagnostics." -Type 'Info'
    }
    Write-ColorMessage -Message "Linux side: dd.sh > Linux System Tools > Management & Backup > Remote Control > Connect to a peer (this host: $selfIp; remmina -c vnc://${selfIp}:$script:RcVncPort)" -Type 'Info'
}

# Section header for the Claude Peer Link log (numbered, easy to quote back).
function Write-RemoteControlSection {
    param([Parameter(Mandatory = $true)][string]$Title)
    Write-Host ''
    Write-ColorMessage -Message ('==== {0} ====' -f $Title) -Type 'Info'
}

# Run a native command and echo its full output through Write-Host, so the
# Windows PowerShell 5.1 transcript records it (direct native output is not).
function Write-RemoteControlNativeOutput {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )
    $text = ''
    Write-Host ('  $ {0}' -f $Label)
    try {
        $text = (& $Command 2>&1 | Out-String).TrimEnd()
    } catch {
        $text = "error: $($_.Exception.Message)"
    }
    if ([string]::IsNullOrWhiteSpace($text)) { $text = '(no output)' }
    foreach ($line in ($text -split "`r?`n")) { Write-Host ('    {0}' -f $line) }
}

# OpenSSH-style fingerprint of one authorized_keys line: SHA256 over the
# base64-decoded key blob, unpadded base64 (Windows ssh-keygen cannot read
# a key from stdin).
function Get-RemoteControlKeyFingerprint {
    param([Parameter(Mandatory = $true)][string]$PublicKeyLine)
    $fields = @()
    $blob = $null
    $sha = $null
    $comment = ''

    $fields = @($PublicKeyLine.Trim() -split '\s+')
    if ($fields.Count -lt 2) { return "unparsable key line: $PublicKeyLine" }
    try {
        $blob = [Convert]::FromBase64String($fields[1])
    } catch {
        return "unparsable key blob ($($fields[0]))"
    }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    if ($fields.Count -ge 3) { $comment = ($fields[2..($fields.Count - 1)] -join ' ') }
    return ('SHA256:{0} {1} ({2})' -f ([Convert]::ToBase64String($sha.ComputeHash($blob)).TrimEnd('=')), $comment, $fields[0])
}

# One-shot, idempotent link of this Windows host into the cross-machine Claude
# agent team over Tailscale: SSH host (control from Linux) + readiness audit +
# Claude Code Remote Control prerequisites (communication). Everything is
# written to a transcript under LOGS_DIR, plus a stable *_latest.log copy.
# Tailscale SSH has no Windows server, so control uses Windows OpenSSH Server.
function Invoke-RemoteControlClaudePeerLink {
    $logFile = ''
    $selfIp = ''
    $selfDns = ''
    $status = $null
    $selfNode = $null
    $installInfo = $null
    $osInfo = $null
    $claudeCommand = $null
    $claudeInstall = $null
    $gitCommand = $null
    $sharedKey = $null
    $defaultShell = ''
    $openSshSettings = $null
    $keyLine = ''
    $keyFile = ''

    if (-not $Global:IS_RUN_ADMIN) {
        Invoke-RemoteControlElevated -ElevatedAction 'ClaudePeer'
        Write-ColorMessage -Message "Full log (copy this file): $script:RcClaudePeerLatestLog" -Type 'Info'
        return
    }
    if (-not (Test-Path -LiteralPath $Global:LOGS_DIR)) { New-Item -ItemType Directory -Path $Global:LOGS_DIR -Force | Out-Null }
    $logFile = Join-Path $Global:LOGS_DIR ('{0}_{1}.log' -f $script:RcClaudePeerLogPrefix, (Get-Date -Format 'yyyyMMdd_HHmmss'))
    Start-Transcript -LiteralPath $logFile -Force | Out-Null
    try {
        Write-ColorMessage -Message '== Claude Peer Link over Tailscale (idempotent; safe to re-run) ==' -Type 'Info'

        Write-RemoteControlSection -Title '1. System'
        $osInfo = Get-CimInstance Win32_OperatingSystem
        Write-Host "  Time:          $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
        Write-Host "  Computer:      $env:COMPUTERNAME"
        Write-Host "  User:          $env:USERDOMAIN\$env:USERNAME (admin: $Global:IS_RUN_ADMIN)"
        Write-Host "  OS:            $($osInfo.Caption) $($osInfo.Version) (build $($osInfo.BuildNumber))"
        Write-Host "  PowerShell:    $($PSVersionTable.PSVersion)"
        Write-Host "  Script:        $script:REMOTE_CONTROL_SCRIPT"

        Write-RemoteControlSection -Title '2. Tailscale'
        $installInfo = Get-TailscaleInstallInfo
        Write-Host "  Installed:     $($installInfo.Installed) ($($installInfo.ExePath))"
        if ($installInfo.Installed) {
            $status = Get-TailscaleStatusJson -TailscaleExe $installInfo.ExePath
            $selfNode = Get-TailscaleJsonProperty -Object $status -Name 'Self' -Default $null
            $selfDns = ([string](Get-TailscaleJsonProperty -Object $selfNode -Name 'DNSName' -Default '')).TrimEnd('.')
            Write-Host "  Backend:       $(Get-TailscaleJsonProperty -Object $status -Name 'BackendState' -Default 'unknown')"
            Write-Host "  MagicDNS:      $selfDns"
        }
        $selfIp = Get-RemoteControlSelfIPv4
        Write-Host "  IPv4:          $selfIp"
        Show-RemoteControlPeerTable -Peers @(Get-RemoteControlPeers)

        Write-RemoteControlSection -Title '3. SSH host (control from Linux; installs/repairs only what is missing)'
        Enable-RemoteControlSshHost

        Write-RemoteControlSection -Title '4. SSH details'
        $sharedKey = Find-RemoteControlSharedKey
        Write-Host "  Shared key:    $(if ($null -ne $sharedKey) { $sharedKey } else { 'not found' })"
        if ($null -ne $sharedKey) {
            $keyFile = "$sharedKey.pub"
            Write-RemoteControlNativeOutput -Label "ssh-keygen -lf $keyFile" -Command { ssh-keygen.exe -lf $keyFile }
        }
        if (Test-Path -LiteralPath $script:RcAdminKeysFile) {
            Write-Host "  Authorized keys ($script:RcAdminKeysFile):"
            foreach ($keyLine in @(Get-Content -LiteralPath $script:RcAdminKeysFile | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })) {
                Write-Host "    $(Get-RemoteControlKeyFingerprint -PublicKeyLine $keyLine)"
            }
            Write-RemoteControlNativeOutput -Label "icacls $script:RcAdminKeysFile" -Command { icacls.exe $script:RcAdminKeysFile }
        } else {
            Write-ColorMessage -Message "  $script:RcAdminKeysFile does not exist" -Type 'Warning'
        }
        if (Test-Path -LiteralPath $script:RcSshdConfigFile) {
            Write-RemoteControlNativeOutput -Label "active lines of $script:RcSshdConfigFile" -Command {
                Get-Content -LiteralPath $script:RcSshdConfigFile | Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*#' }
            }
        }
        $openSshSettings = Get-ItemProperty -Path $script:RcOpenSshRegistryKey -ErrorAction SilentlyContinue
        if ($null -ne $openSshSettings -and $null -ne $openSshSettings.PSObject.Properties['DefaultShell']) {
            $defaultShell = [string]$openSshSettings.DefaultShell
        }
        Write-Host "  DefaultShell:  $(if ([string]::IsNullOrWhiteSpace($defaultShell)) { 'cmd.exe (OpenSSH default)' } else { $defaultShell })"
        Write-RemoteControlNativeOutput -Label 'sshd events (newest 5)' -Command {
            Get-WinEvent -LogName 'OpenSSH/Operational' -MaxEvents 5 -ErrorAction SilentlyContinue | Format-List TimeCreated, LevelDisplayName, Message
        }

        Write-RemoteControlSection -Title '5. Readiness audit (Tailscale / VNC / RDP / SSH)'
        Show-RemoteControlDiagnostics

        Write-RemoteControlSection -Title '6. Claude Code (cross-machine messaging = Remote Control)'
        $claudeCommand = Get-Command 'claude' -ErrorAction SilentlyContinue
        $gitCommand = Get-Command 'git' -ErrorAction SilentlyContinue
        Write-Host "  claude:        $(if ($null -ne $claudeCommand) { $claudeCommand.Source } else { 'not found' }) (first on PATH = what 'claude' starts)"
        foreach ($claudeInstall in @(Get-Command 'claude' -All -CommandType Application -ErrorAction SilentlyContinue | Where-Object { $_.Source -match '\.(exe|cmd)$' })) {
            Write-RemoteControlNativeOutput -Label "$($claudeInstall.Source) --version (native Windows messaging needs 2.1.234+)" -Command { & $claudeInstall.Source --version }
        }
        Write-Host "  git:           $(if ($null -ne $gitCommand) { $gitCommand.Source } else { 'not found (Remote Control on native Windows needs Git for Windows)' })"
        if ($null -ne $gitCommand) { Write-RemoteControlNativeOutput -Label 'git --version' -Command { git --version } }
        if (Test-Path -LiteralPath $script:CLAUDE_TEAM_INSTALL_COMMON_FOR_RC) {
            . $script:CLAUDE_TEAM_INSTALL_COMMON_FOR_RC
            Test-ClaudeTeamRemoteControlEnvironment
            Test-ClaudeTeamAccount
        } else {
            Write-ColorMessage -Message "  $script:CLAUDE_TEAM_INSTALL_COMMON_FOR_RC not found; Claude checks skipped" -Type 'Warning'
        }

        Write-RemoteControlSection -Title '7. Next steps'
        Write-Host "  Control from Linux:   ssh $env:USERNAME@$selfIp$(if (-not [string]::IsNullOrWhiteSpace($selfDns)) { "   (or ssh $env:USERNAME@$selfDns)" })"
        Write-Host '  Messaging (manual, once): in the project folder run  claude  ->  /login (same claude.ai account as the Linux side)'
        Write-Host ('                          then  /remote-control {0}   (the Linux session also runs /remote-control)' -f $script:RcClaudePeerSessionName)
        Write-Host '  Verify from Linux:    ListAgents shows the session; SendMessage to it'
    } finally {
        Stop-Transcript | Out-Null
        Copy-Item -LiteralPath $logFile -Destination $script:RcClaudePeerLatestLog -Force
        Write-ColorMessage -Message "Full log: $logFile" -Type 'Success'
        Write-ColorMessage -Message "Latest copy: $script:RcClaudePeerLatestLog" -Type 'Success'
    }
}

function Show-RemoteControlHelp {
    Write-ColorMessage -Message 'Remote control over Tailscale (Windows 10/11 <-> Debian 12/13, Ubuntu 24.04/26.04)' -Type 'Info'
    Write-Host ''
    Write-Host 'Automated here:'
    Write-Host "  Windows host:   VNC shared desktop FIRST (default: TightVNC service, tcp $script:RcVncPort, tailnet-only firewall rule),"
    Write-Host '                  then Remote Desktop (fDenyTSConnections=0 + firewall), OpenSSH Server + shared key'
    Write-Host '  Windows client: TightVNC viewer (tvnviewer.exe, default for Windows peers), OpenSSH Client, mstsc (built in), shared key'
    Write-Host ''
    Write-Host 'Why VNC is the default: a VNC server in service mode shares the real console desktop, so the local and the'
    Write-Host '  remote user can work at the same time (Windows Home too). RDP takes over the console and LOCKS the local'
    Write-Host '  screen, so it is the secondary channel. VNC password: max 8 characters, typed in plain text (Enter = the'
    Write-Host '  suggested random one); shown again by Status / one-click; change it with Reset VNC password.'
    Write-Host "  From Linux: remmina -c vnc://<ip>:$script:RcVncPort   |   from Windows: tvnviewer.exe -host=<ip>::$script:RcVncPort -scale=$script:RcVncViewerScale"
    Write-Host '  Full screen / scaling: VNC sends the Windows screen at its own size (TightVNC cannot resize it);'
    Write-Host '    the viewer scales it: Remmina profiles from dd.sh use scale=1 + viewmode=4 (Right Ctrl+S / Right Ctrl+F),'
    Write-Host '    TightVNC viewer -scale=auto (Ctrl+Alt+Shift+F). The host is marked DPI-aware so scaling > 100% is captured'
    Write-Host '    in full. Text too small: lower Windows Settings > System > Display > Scale or resolution.'
    Write-Host '  Diagnostics:    per-item readiness checks with details (menu item / -Action Diagnose)'
    Write-Host '  Linux side:     dd.sh > Linux System Tools > Management & Backup > Remote Control'
    Write-Host ''
    Write-Host 'Manual UI steps when automation is not possible:'
    Write-Host '  Windows 10/11 Pro: Settings > System > Remote Desktop > On (+ keep "Require NLA").'
    Write-Host '  Windows Home: cannot host RDP -- use VNC (default) or SSH; controlling Linux from Home works.'
    Write-Host '  Microsoft account: RDP user = account e-mail, password = account password (not PIN);'
    Write-Host '    Settings > Accounts > Sign-in options > turn off "Only allow Windows Hello sign-in".'
    Write-Host '  GNOME (Debian/Ubuntu): Settings > System > Remote Desktop (GNOME 46+) or Settings > Sharing >'
    Write-Host '    Remote Desktop (GNOME 43): enable Remote Desktop + Remote Control, credentials = login user/password.'
    if ((Get-MeshVpnProvider) -eq 'headscale') {
        Write-Host "  Headscale ACL: default policy allows all nodes; a custom policy on the server must allow tcp:$script:RcVncPort, tcp:$script:RcRdpPort and tcp:$script:RcSshPort."
    } else {
        Write-Host "  Tailscale ACL: default policy allows all devices; custom ACLs must allow tcp:$script:RcVncPort, tcp:$script:RcRdpPort and tcp:$script:RcSshPort."
    }
    Write-Host '  Tailscale SSH (tailscale set --ssh) works only on Linux/macOS hosts, not on Windows.'
    Write-Host ''
    Write-Host "Shared key: $($Global:SSH_DIR)\$script:RcSharedKeyName (decrypted by Step5_InstallGitSSH.ps1 / 27_install_git_ssh.sh)."
    Write-Host ''
    Write-Host 'Docs:'
    Write-Host '  https://tailscale.com/kb/1095/secure-rdp-windows'
    Write-Host '  https://www.tightvnc.com/doc/win/TightVNC_2.8_for_Windows_Installing_from_MSI.pdf'
    Write-Host '  https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse'
    Write-Host '  https://learn.microsoft.com/windows-server/administration/openssh/openssh_keymanagement'
    Write-Host '  https://gitlab.gnome.org/GNOME/gnome-remote-desktop/-/blob/master/README.md'
}

# Every Tailscale IP is printed above the items; each item calls a function above.
function Show-RemoteControlMenu {
    Show-NumberedMenu -Title 'Remote Control (Windows <-> Linux over Tailscale)' -Header { Show-RemoteControlPeerTable -Peers @(Get-RemoteControlPeers) } -Items @(
        @{ Text = '-- Let others control this PC --'; IsHeader = $true },
        @{ Text = 'One-click: allow Linux to control this PC (VNC shared desktop)'; Action = { Enable-RemoteControlOneClickHost } },
        @{ Text = 'Reset VNC password';                                            Action = { Reset-RemoteControlVncPassword } },
        @{ Text = 'Allow all channels (VNC + RDP + SSH; RDP locks the local screen)'; Action = { Enable-RemoteControlHost } },
        @{ Text = '-- Control another machine --'; IsHeader = $true },
        @{ Text = 'Connect to a peer (VNC default, RDP or SSH)';                   Action = { Connect-RemoteControlPeer } },
        @{ Text = 'Install clients (TightVNC viewer, SSH, shared key)';            Action = { Enable-RemoteControlClient } },
        @{ Text = '-- Info --'; IsHeader = $true },
        @{ Text = 'Connection info + Linux setup steps';                           Action = { Show-RemoteControlVncConnectHint } },
        @{ Text = 'Endpoints (all Tailscale IPs + connect commands)';              Action = { Show-RemoteControlEndpoints } },
        @{ Text = 'Status';                                                        Action = { Show-RemoteControlStatus } },
        @{ Text = 'Diagnostics (per-item readiness checks)';                       Action = { Show-RemoteControlDiagnostics } },
        @{ Text = 'Claude peer link (SSH host + Claude Remote Control checks)';    Action = { Invoke-RemoteControlClaudePeerLink } },
        @{ Text = 'Help (manual steps + official docs)';                           Action = { Show-RemoteControlHelp } }
    )
}

switch ($script:RcRequestedAction) {
    ''           { if ($MyInvocation.InvocationName -ne '.') { Show-RemoteControlHelp } }
    'Menu'       { Show-RemoteControlMenu }
    'Endpoints'  { Show-RemoteControlEndpoints }
    'Controller' { Enable-RemoteControlClient; Wait-MenuContinue }
    'OneClickHost' { Enable-RemoteControlOneClickHost; Wait-MenuContinue }
    'Host'       { Enable-RemoteControlHost; Wait-MenuContinue }
    'Vnc'        { Enable-RemoteControlVncChannel; Wait-MenuContinue }
    'VncReset'   { Reset-RemoteControlVncPassword; Wait-MenuContinue }
    'Connect'    { Connect-RemoteControlPeer }
    'Status'     { Show-RemoteControlStatus }
    'ClaudePeer' { Invoke-RemoteControlClaudePeerLink; Wait-MenuContinue }
    'Diagnose'   { Show-RemoteControlDiagnostics; Wait-MenuContinue }
    'Help'       { Show-RemoteControlHelp }
}
