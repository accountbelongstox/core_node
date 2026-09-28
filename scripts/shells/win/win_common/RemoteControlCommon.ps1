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
    powershell -File RemoteControlCommon.ps1 -Action Menu|Endpoints|Controller|Host|Connect|Status|Help
#>
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('', 'Menu', 'Endpoints', 'Controller', 'Host', 'Connect', 'Status', 'Help')]
    [string]$Action = ''
)

# Captured before dot-sourcing TailscaleCommon.ps1, whose own -Action param rebinds $Action here.
$script:RcRequestedAction = $Action
$script:REMOTE_CONTROL_DIR = $PSScriptRoot
$script:REMOTE_CONTROL_SCRIPT = $PSCommandPath
$script:TAILSCALE_COMMON_FOR_RC = Join-Path $script:REMOTE_CONTROL_DIR 'TailscaleCommon.ps1'
$script:INSTALL_POWERSHELLS_DIR_FOR_RC = Join-Path (Split-Path $script:REMOTE_CONTROL_DIR -Parent) 'install_powershells'
$script:SHARED_KEY_INSTALLER = Join-Path $script:INSTALL_POWERSHELLS_DIR_FOR_RC 'Step5_InstallGitSSH.ps1'
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

    Write-ColorMessage -Message '-- Remote Desktop (RDP) --' -Type 'Info'
    if (-not (Test-RemoteControlRdpHostSupported)) {
        Write-ColorMessage -Message 'Windows Home cannot host Remote Desktop. Use SSH (enabled below) or upgrade to Pro:' -Type 'Warning'
        Write-ColorMessage -Message '  Settings > System > Activation > Upgrade your edition of Windows.' -Type 'Info'
        return
    }
    Set-ItemProperty -Path $script:RcTerminalServerKey -Name 'fDenyTSConnections' -Value 0
    Get-NetFirewallRule -Name $script:RcRdpFirewallRules -ErrorAction SilentlyContinue | Enable-NetFirewallRule
    if (-not (Get-NetFirewallRule -Name $script:RcRdpTailscaleRule -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name $script:RcRdpTailscaleRule -DisplayName 'Remote Desktop (Tailscale)' -Enabled True -Direction Inbound `
            -Protocol TCP -LocalPort $script:RcRdpPort -RemoteAddress $script:RcTailscaleCidr -Action Allow -Profile Any | Out-Null
    }
    Start-Service -Name 'TermService' -ErrorAction SilentlyContinue
    # "Only allow Windows Hello sign-in" blocks password logon over RDP.
    if (Test-Path -LiteralPath $script:RcPasswordLessKey) {
        Set-ItemProperty -Path $script:RcPasswordLessKey -Name 'DevicePasswordLessBuildVersion' -Value 0 -Type DWord
    }
    Write-ColorMessage -Message "  Remote Desktop enabled (port $script:RcRdpPort, firewall open for $script:RcTailscaleCidr)." -Type 'Success'

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
    Write-ColorMessage -Message "== Allow remote control of this machine (user $env:USERNAME) ==" -Type 'Info'
    if (-not $Global:IS_RUN_ADMIN) { Invoke-RemoteControlElevated -ElevatedAction 'Host'; return }
    Enable-RemoteControlRdpHost
    Write-Host ''
    Enable-RemoteControlSshHost
    Write-Host ''
    Write-ColorMessage -Message "Connect from Linux: xfreerdp3 /v:$(Get-RemoteControlSelfIPv4) /u:$env:USERNAME /dynamic-resolution +clipboard /cert:tofu" -Type 'Info'
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
    Write-Host "  SSH server:     $(if ($null -ne $sshd) { $sshd.Status } else { 'not installed' })"
    Write-Host "  SSH client:     $(if (Get-Command -Name 'ssh.exe' -ErrorAction SilentlyContinue) { 'installed' } else { 'not installed' })"
    Write-Host "  Shared key:     $(if ($null -ne $sharedKey) { $sharedKey } else { 'not installed' })"
}

function Show-RemoteControlHelp {
    Write-ColorMessage -Message 'Remote control over Tailscale (Windows 10/11 <-> Debian 12/13, Ubuntu 24.04/26.04)' -Type 'Info'
    Write-Host ''
    Write-Host 'Automated here:'
    Write-Host '  Windows host:   Remote Desktop (fDenyTSConnections=0 + firewall), OpenSSH Server + shared key'
    Write-Host '  Windows client: OpenSSH Client, mstsc (built in), shared key'
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
    'Help'       { Show-RemoteControlHelp }
}
