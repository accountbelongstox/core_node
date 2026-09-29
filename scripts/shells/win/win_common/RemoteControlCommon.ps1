<#
.SYNOPSIS
    Cross-OS remote control over Tailscale (Windows 10/11 <-> Debian 12/13, Ubuntu 24.04/26.04).

.DESCRIPTION
    Windows counterpart of scripts/shells/linux/common/remote_control_common.sh.
    Two channels, reachable only through the tailnet (100.64.0.0/10):
      RDP (desktop): host = built-in Remote Desktop (Pro/Enterprise/Education); client = mstsc.
      SSH (shell):   host = OpenSSH Server + the shared decrypted key (Step5_InstallGitSSH.ps1);
                     client = OpenSSH Client.
    Password = Windows sign-in password (RDP/SSH authenticate against the local account).

    Official docs (checked 2026-09-29):
      https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse
      https://learn.microsoft.com/windows-server/administration/openssh/openssh_keymanagement
      https://learn.microsoft.com/windows-hardware/customize/desktop/unattend/microsoft-windows-terminalservices-localsessionmanager-fdenytsconnections
      https://support.microsoft.com/windows/how-to-use-remote-desktop-5fe128d5-8fb1-7a23-3b8a-41e636865e8c
      https://tailscale.com/kb/1095/secure-rdp-windows
      https://tailscale.com/kb/1193/tailscale-ssh   (Tailscale SSH server: Linux/macOS only)

.NOTES
    powershell -File RemoteControlCommon.ps1 -Action Menu|Endpoints|Controller|Host|Connect|Status|Diagnose|ClaudePeer|Help
#>
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('', 'Menu', 'Endpoints', 'Controller', 'Host', 'Connect', 'Status', 'Diagnose', 'ClaudePeer', 'Help')]
    [string]$Action = ''
)

# Captured before dot-sourcing TailscaleCommon.ps1, whose own -Action param rebinds $Action here.
$script:RcRequestedAction = $Action
$script:REMOTE_CONTROL_DIR = $PSScriptRoot
$script:REMOTE_CONTROL_SCRIPT = $PSCommandPath
$script:TAILSCALE_COMMON_FOR_RC = Join-Path $script:REMOTE_CONTROL_DIR 'TailscaleCommon.ps1'
$script:INSTALL_POWERSHELLS_DIR_FOR_RC = Join-Path (Split-Path $script:REMOTE_CONTROL_DIR -Parent) 'install_powershells'
$script:SHARED_KEY_INSTALLER = Join-Path $script:INSTALL_POWERSHELLS_DIR_FOR_RC 'Step5_InstallGitSSH.ps1'
# Claude Peer Link reuses the Claude team installer checks (account, Remote Control blockers).
$script:CLAUDE_TEAM_INSTALL_COMMON_FOR_RC = Join-Path $script:REMOTE_CONTROL_DIR 'ClaudeTeamInstallCommon.ps1'
. $script:TAILSCALE_COMMON_FOR_RC

$script:RcRdpPort = 3389
$script:RcSshPort = 22
$script:RcTailscaleCidr = '100.64.0.0/10'
$script:RcSharedKeyName = 'id_ed25519'
$script:RcTerminalServerKey = 'HKLM:\System\CurrentControlSet\Control\Terminal Server'
$script:RcPasswordLessKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\PasswordLess\Device'
$script:RcCurrentVersionKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$script:RcMsaIdentityKey = 'HKCU:\Software\Microsoft\IdentityCRL\UserExtendedProperties'
$script:RcRdpFirewallRules = @('RemoteDesktop-UserMode-In-TCP', 'RemoteDesktop-UserMode-In-UDP')
$script:RcRdpTailscaleRule = 'CoreNode-RemoteControl-RDP-Tailscale'
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
        Write-Host "    From Windows: mstsc /v:$($peer.IPv4)   |   ssh <user>@$($peer.IPv4)"
        Write-Host "    From Linux:   xfreerdp3 /v:$($peer.IPv4) /u:<user> /dynamic-resolution +clipboard /cert:tofu   |   ssh <user>@$($peer.IPv4)"
    }
    Write-Host ''
    Write-ColorMessage -Message "This machine accepts: RDP $script:RcRdpPort (Windows sign-in password), SSH $script:RcSshPort (shared key or password)." -Type 'Info'
}

# ---------------------------------------------------------------------------
# 2) Controller: this machine can control remote hosts
# ---------------------------------------------------------------------------

function Enable-RemoteControlClient {
    $mstsc = Join-Path $env:WINDIR 'System32\mstsc.exe'
    $sshCommand = $null

    Write-ColorMessage -Message '== Enable remote-control client (this machine -> Linux/Windows) ==' -Type 'Info'
    if (-not $Global:IS_RUN_ADMIN) { Invoke-RemoteControlElevated -ElevatedAction 'Controller'; return }
    Install-RemoteControlCapability -Name $script:RcSshClientCapability
    [void](Confirm-RemoteControlSharedKey)
    $sshCommand = Get-Command -Name 'ssh.exe' -ErrorAction SilentlyContinue
    Write-ColorMessage -Message "  RDP client: $(if (Test-Path -LiteralPath $mstsc) { $mstsc } else { 'not found' })" -Type 'Info'
    Write-ColorMessage -Message "  SSH client: $(if ($null -ne $sshCommand) { $sshCommand.Source } else { 'not found (reopen the console after install)' })" -Type 'Info'
    Write-ColorMessage -Message "  Shared key: $(if ($null -ne (Find-RemoteControlSharedKey)) { Find-RemoteControlSharedKey } else { 'not installed (password login only)' })" -Type 'Info'
    if ((Get-TailscaleQuickStateLabel) -ne $script:TailscaleRunningState) {
        Write-ColorMessage -Message 'Tailscale is not connected; use Login in the Tailscale menu.' -Type 'Warning'
    }
    Write-ColorMessage -Message 'Remote Linux must allow control: dd.sh > Linux System Tools > [T] Tailscale > Remote Control > Allow remote control of this machine.' -Type 'Info'
}

# ---------------------------------------------------------------------------
# 3) Host: allow remote control of this machine
# ---------------------------------------------------------------------------

function Enable-RemoteControlRdpHost {
    $msAccount = ''
    $termService = $null

    Write-ColorMessage -Message '-- Remote Desktop (RDP) --' -Type 'Info'
    if (-not (Test-RemoteControlRdpHostSupported)) {
        Write-ColorMessage -Message 'Windows Home cannot host Remote Desktop; SSH (below) and RustDesk still work.' -Type 'Warning'
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
    $rdpListening = $false
    $sshListening = $false

    Write-ColorMessage -Message "== Allow remote control of this machine (user $env:USERNAME) ==" -Type 'Info'
    if (-not $Global:IS_RUN_ADMIN) { Invoke-RemoteControlElevated -ElevatedAction 'Host'; return }
    Enable-RemoteControlRdpHost
    Write-Host ''
    Enable-RemoteControlSshHost
    Write-Host ''
    $rdpListening = Test-RemoteControlPortListening -Port $script:RcRdpPort
    $sshListening = Test-RemoteControlPortListening -Port $script:RcSshPort
    Write-ColorMessage -Message '== Verification (safe to re-run; every step above is idempotent) ==' -Type 'Info'
    Write-Host "  RDP $script:RcRdpPort listening: $(if ($rdpListening) { 'yes' } else { 'no' })"
    Write-Host "  SSH $script:RcSshPort listening:  $(if ($sshListening) { 'yes' } else { 'no' })"
    Write-Host "  Tailscale IPv4:   $(Get-RemoteControlSelfIPv4)"
    if (-not $rdpListening -and -not $sshListening) {
        Write-ColorMessage -Message 'Neither channel is up; see the messages above and Help for manual steps.' -Type 'Error'
        return
    }
    Write-Host ''
    Write-ColorMessage -Message "Connect from Linux: dd.sh > [T] Tailscale > Remote Control > Connect to a peer (or: xfreerdp3 /v:$(Get-RemoteControlSelfIPv4) /u:$env:USERNAME /dynamic-resolution +clipboard /cert:tofu)" -Type 'Info'
    Write-ColorMessage -Message 'If a step could not be automated, see Help for the manual UI steps.' -Type 'Info'
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

function Connect-RemoteControlPeer {
    $peers = @(Get-RemoteControlPeers)
    $choice = ''
    $address = ''
    $userName = ''
    $mode = ''

    Show-RemoteControlPeerTable -Peers $peers
    if ($peers.Count -eq 0) { return }
    $choice = Read-Host 'Peer number (or a Tailscale IP)'
    if ($choice -match '^\d+$' -and [int]$choice -lt $peers.Count) {
        $address = $peers[[int]$choice].IPv4
    } elseif ($choice.StartsWith('100.')) {
        $address = $choice.Trim()
    } else {
        Write-ColorMessage -Message 'Invalid selection.' -Type 'Error'
        return
    }
    $userName = Read-Host "Remote username [$env:USERNAME]"
    if ([string]::IsNullOrWhiteSpace($userName)) { $userName = $env:USERNAME }
    $mode = Read-Host 'Mode: [1] RDP desktop  [2] SSH shell  [1]'
    if ($mode -eq '2') {
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

    Write-ColorMessage -Message '== Remote control status ==' -Type 'Info'
    Write-Host "  Tailscale:      $(Get-TailscaleQuickStateLabel)  IPv4 $(Get-RemoteControlSelfIPv4)"
    Write-Host "  Login user:     $env:USERNAME"
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

# Per-item readiness audit of everything a Linux client (xfreerdp/remmina/ssh
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

    Write-ColorMessage -Message '== Remote control diagnostics (what the Linux side needs from this host) ==' -Type 'Info'
    Write-Host ''

    Write-ColorMessage -Message '-- Tailscale --' -Type 'Info'
    $tsState = Get-TailscaleQuickStateLabel
    $selfIp = Get-RemoteControlSelfIPv4
    $ok = ($tsState -eq $script:TailscaleRunningState)
    if (Write-RemoteControlCheck -Name 'Tailscale backend' -Ok $ok -Detail "state=$tsState, IPv4=$selfIp") { $passed++ } else { $failed++ }

    Write-ColorMessage -Message '-- RDP host --' -Type 'Info'
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
    Write-ColorMessage -Message "Linux side: dd.sh > [T] Tailscale > Remote Control > Connect to a peer (this host: $selfIp)" -Type 'Info'
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

        Write-RemoteControlSection -Title '5. Readiness audit (Tailscale / RDP / SSH)'
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
    Write-Host '  Windows host:   Remote Desktop (fDenyTSConnections=0 + firewall), OpenSSH Server + shared key'
    Write-Host '  Windows client: OpenSSH Client, mstsc (built in), shared key'
    Write-Host '  Diagnostics:    per-item readiness checks with details (menu item / -Action Diagnose)'
    Write-Host '  Linux side:     dd.sh > Linux System Tools > [T] Tailscale > Remote Control'
    Write-Host ''
    Write-Host 'Manual UI steps when automation is not possible:'
    Write-Host '  Windows 10/11 Pro: Settings > System > Remote Desktop > On (+ keep "Require NLA").'
    Write-Host '  Windows Home: cannot host RDP -- use SSH or RustDesk; controlling Linux from Home works.'
    Write-Host '  Microsoft account: RDP user = account e-mail, password = account password (not PIN);'
    Write-Host '    Settings > Accounts > Sign-in options > turn off "Only allow Windows Hello sign-in".'
    Write-Host '  GNOME (Debian/Ubuntu): Settings > System > Remote Desktop (GNOME 46+) or Settings > Sharing >'
    Write-Host '    Remote Desktop (GNOME 43): enable Remote Desktop + Remote Control, credentials = login user/password.'
    Write-Host "  Tailscale ACL: default policy allows all devices; custom ACLs must allow tcp:$script:RcRdpPort and tcp:$script:RcSshPort."
    Write-Host '  Tailscale SSH (tailscale set --ssh) works only on Linux/macOS hosts, not on Windows.'
    Write-Host ''
    Write-Host "Shared key: $($Global:SSH_DIR)\$script:RcSharedKeyName (decrypted by Step5_InstallGitSSH.ps1 / 27_install_git_ssh.sh)."
    Write-Host ''
    Write-Host 'Docs:'
    Write-Host '  https://tailscale.com/kb/1095/secure-rdp-windows'
    Write-Host '  https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse'
    Write-Host '  https://learn.microsoft.com/windows-server/administration/openssh/openssh_keymanagement'
    Write-Host '  https://gitlab.gnome.org/GNOME/gnome-remote-desktop/-/blob/master/README.md'
}

# Every Tailscale IP is printed above the items; each item calls a function above.
function Show-RemoteControlMenu {
    $menuItems = @(
        @{ Text = 'Enable this machine to control remote (RDP/SSH client + shared key)'; Action = { Enable-RemoteControlClient } },
        @{ Text = 'Allow remote control of this machine (RDP + SSH, sign-in password)';  Action = { Enable-RemoteControlHost } },
        @{ Text = 'Connect to a peer (RDP or SSH)';                                       Action = { Connect-RemoteControlPeer } },
        @{ Text = 'Endpoints (all Tailscale IPs + connect commands)';                     Action = { Show-RemoteControlEndpoints } },
        @{ Text = 'Status';                                                               Action = { Show-RemoteControlStatus } },
        @{ Text = 'Diagnostics (per-item RDP/SSH/Tailscale readiness checks)';            Action = { Show-RemoteControlDiagnostics } },
        @{ Text = 'Claude Peer Link (SSH host + Claude Remote Control checks, full log)'; Action = { Invoke-RemoteControlClaudePeerLink } },
        @{ Text = 'Help (manual UI steps + official docs)';                               Action = { Show-RemoteControlHelp } },
        @{ Text = 'Back';                                                                 Action = { return } }
    )
    $selected = 0
    $peers = @(Get-RemoteControlPeers)
    $key = $null
    $chosenItem = $null

    while ($true) {
        Clear-Host
        Write-ColorMessage -Message 'Remote Control (Windows <-> Linux) - Up/Down, Enter, Q/Escape to go back' -Type 'Info'
        Show-RemoteControlPeerTable -Peers $peers
        Write-Host ''
        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selected) {
                Write-Host -NoNewline '>'
                Write-Host -NoNewline -ForegroundColor Black -BackgroundColor White (" {0,-72}" -f $menuItems[$i].Text)
                Write-Host ''
            } else {
                Write-Host ("  {0,-72}" -f $menuItems[$i].Text)
            }
        }

        try {
            $key = [Console]::ReadKey($true).Key
        } catch {
            $key = Read-Host 'Selection number (q = back)'
            if ($key -eq 'q') { return }
            if ($key -match '^\d+$' -and [int]$key -ge 1 -and [int]$key -le $menuItems.Count) { $selected = [int]$key - 1; $key = 'Enter' } else { continue }
        }
        switch ($key) {
            'UpArrow'   { if ($selected -gt 0) { $selected-- } else { $selected = $menuItems.Count - 1 } }
            'DownArrow' { if ($selected -lt $menuItems.Count - 1) { $selected++ } else { $selected = 0 } }
            'Enter' {
                $chosenItem = $menuItems[$selected]
                if ($chosenItem.Text -eq 'Back') { return }
                Clear-Host
                & $chosenItem.Action
                Wait-MenuContinue
                $peers = @(Get-RemoteControlPeers)
            }
            'Q' { return }
            'Escape' { return }
        }
    }
}

switch ($script:RcRequestedAction) {
    ''           { if ($MyInvocation.InvocationName -ne '.') { Show-RemoteControlHelp } }
    'Menu'       { Show-RemoteControlMenu }
    'Endpoints'  { Show-RemoteControlEndpoints }
    'Controller' { Enable-RemoteControlClient; Wait-MenuContinue }
    'Host'       { Enable-RemoteControlHost; Wait-MenuContinue }
    'Connect'    { Connect-RemoteControlPeer }
    'Status'     { Show-RemoteControlStatus }
    'ClaudePeer' { Invoke-RemoteControlClaudePeerLink; Wait-MenuContinue }
    'Diagnose'   { Show-RemoteControlDiagnostics; Wait-MenuContinue }
    'Help'       { Show-RemoteControlHelp }
}
