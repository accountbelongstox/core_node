# Headscale client branch for the Windows Tailscale client. The official Tailscale client is
# used for every provider; Headscale only adds --login-server (plus --authkey from the raw
# secret when present) and replaces the SaaS admin console with the server. Dispatched from
# TailscaleCommon.ps1 when Get-MeshVpnProvider is 'headscale'. Headscale has no Windows
# server; a Windows host may run it inside Debian WSL2 (Linux step 98_install_headscale_server.sh).
$script:HeadscaleCommonDirectory = Split-Path -Parent $PSCommandPath
$script:HeadscaleMeshCommonPath = Join-Path $script:HeadscaleCommonDirectory 'MeshCommon.ps1'

if (-not (Get-Command -Name 'Get-MeshVpnProvider' -ErrorAction SilentlyContinue)) {
    . $script:HeadscaleMeshCommonPath
}

function Get-HeadscaleAuthKey {
    $secretName = [string](Get-ServiceContractValue -ContractPath 'access.mesh.headscale.authkey_secret')

    if (-not (Get-Command -Name 'Read-SecretValue' -ErrorAction SilentlyContinue)) {
        return ''
    }
    return ([string](Read-SecretValue -Name $secretName)).Trim()
}

function Get-HeadscaleLoginArguments {
    param([switch]$IncludeAuthKey)
    $loginArguments = @('login', ('--login-server={0}' -f (Get-MeshLoginServerUrl)))
    $authKey = ''

    if ($IncludeAuthKey) {
        $authKey = Get-HeadscaleAuthKey
        if (-not [string]::IsNullOrWhiteSpace($authKey)) {
            $loginArguments += ('--authkey={0}' -f $authKey)
        }
    }
    return $loginArguments
}

function Test-HeadscaleNodeOnOtherControl {
    param([Parameter(Mandatory = $true)][string]$TailscaleExe)
    $summary = Get-TailscaleStatusSummary -TailscaleExe $TailscaleExe
    $currentUrl = ''
    $expectedUrl = (Get-MeshLoginServerUrl).TrimEnd('/')

    if ($summary.BackendState -eq 'NeedsLogin' -or $summary.BackendState -eq 'NoState' -or $summary.BackendState -eq 'Unknown') {
        return $false
    }
    $currentUrl = Get-MeshActualControlUrl -TailscaleExe $TailscaleExe
    return ($currentUrl -ne $expectedUrl)
}

function Invoke-HeadscaleLogin {
    param([Parameter(Mandatory = $true)][string]$TailscaleExe)
    $expectedUrl = Get-MeshLoginServerUrl
    $authKey = ''
    $loginArguments = @()

    if (Test-HeadscaleNodeOnOtherControl -TailscaleExe $TailscaleExe) {
        if (-not (Test-MeshControlServerReachable -Url $expectedUrl)) {
            Write-ColorMessage -Message "Desired control server unreachable ($expectedUrl); staying on $(Get-MeshActualControlUrl -TailscaleExe $TailscaleExe)." -Type 'Warning'
            return $false
        }
        Write-ColorMessage -Message "This node is logged in to another control server; switching it to $expectedUrl (tailscale logout first, the node IP will change)." -Type 'Warning'
        & $TailscaleExe 'logout'
    } elseif ((Get-TailscaleStatusSummary -TailscaleExe $TailscaleExe).BackendState -eq 'Running') {
        Write-ColorMessage -Message "Already logged in to $expectedUrl." -Type 'Success'
        return $true
    }

    $authKey = Get-HeadscaleAuthKey
    $loginArguments = @(Get-HeadscaleLoginArguments -IncludeAuthKey)
    if ([string]::IsNullOrWhiteSpace($authKey)) {
        Write-ColorMessage -Message "Starting Headscale login (tailscale login --login-server=$expectedUrl); approve the node on the server." -Type 'Info'
    } else {
        Write-ColorMessage -Message "Starting Headscale login (tailscale login --login-server=$expectedUrl --authkey <secret>)." -Type 'Info'
    }
    try {
        & $TailscaleExe @loginArguments
        return $true
    } catch {
        Write-ColorMessage -Message "tailscale login failed: $($_.Exception.Message)" -Type 'Error'
        return $false
    }
}

function Get-HeadscaleStatusLabel {
    param([string]$State = '')

    if ([string]::IsNullOrWhiteSpace($State)) {
        return 'headscale'
    }
    return ('headscale: {0}' -f $State)
}

function Show-HeadscaleAdminInfo {
    Write-ColorMessage -Message "Headscale control server: $(Get-MeshLoginServerUrl)" -Type 'Info'
    Write-ColorMessage -Message 'There is no SaaS admin console. Manage nodes, users, keys and routes on the server (headscale CLI / dd.sh headscale menu).' -Type 'Info'
    Write-ColorMessage -Message 'A Windows host can run the server inside Debian WSL2 (Linux step 98_install_headscale_server.sh).' -Type 'Info'
}

function Show-HeadscaleNotAuthenticatedHint {
    Write-ColorMessage -Message "Node is not authenticated. Connect with: tailscale login --login-server=$(Get-MeshLoginServerUrl) [--authkey <HEADSCALE_AUTHKEY_1>]" -Type 'Warning'
}

function Show-HeadscaleHelp {
    Write-ColorMessage -Message "Mesh VPN provider: headscale (control server $(Get-MeshLoginServerUrl), MagicDNS domain $(Get-MeshDomain))." -Type 'Info'
    Write-ColorMessage -Message '  Login      - tailscale login --login-server=<server> (+ --authkey from secret HEADSCALE_AUTHKEY_1 when present); a node on another control server is logged out first' -Type 'Info'
    Write-ColorMessage -Message '  Admin      - on the server (headscale CLI / dd.sh headscale menu); there is no SaaS admin console' -Type 'Info'
    Write-ColorMessage -Message '  Server     - Linux only (Debian WSL2 works on a Windows host); the Windows client is the official Tailscale client' -Type 'Info'
    Write-ColorMessage -Message '  Provider   - quick menu "Provider" cycles headscale / tailscale / none (gvar MESH_VPN_PROVIDER)' -Type 'Info'
}
