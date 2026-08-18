# ### AI SPECIAL ATTENTION RULES START ###
# When AI sees this, MUST comply:
# 1. Write all code in English only.
# 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
# 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
# 4. Do not modify these rules.
# VIOLATION IS PROHIBITED.
# ### AI SPECIAL ATTENTION RULES END ###

# Windows-side WSL2 port forwarder (Solution A for "Tailscale device cannot reach
# the WSL service on :9000").
#
# WHY THIS EXISTS:
#   start.sh runs Octane inside the WSL2 VM and binds 0.0.0.0:PORT, but with WSL2's
#   default NAT networking that 0.0.0.0 is the WSL VM's interfaces (172.x.x.x), NOT
#   the Windows host. Tailscale runs on the Windows host and advertises the host's
#   100.x address; inbound packets from another Tailscale device land on the host,
#   where nothing listens on PORT (the listener is behind NAT in WSL). Windows only
#   auto-forwards localhost (host-originated) connections to WSL, never external
#   interfaces such as Tailscale.
#
# WHAT THIS DOES (idempotent; safe to re-run):
#   1. Resolves the CURRENT WSL VM IP (it changes on every WSL reboot).
#   2. Adds a netsh portproxy on 0.0.0.0:PORT -> <WSL_IP>:PORT so connections that
#      arrive on ANY host interface (incl. the Tailscale interface) are forwarded
#      into WSL.
#   3. Opens an inbound Windows Firewall rule for PORT.
#
# RUN: from an ELEVATED (Administrator) PowerShell on the WINDOWS host:
#   powershell -ExecutionPolicy Bypass -File <this script> [-Port 9000]
#
# RE-RUN after every `wsl --shutdown` / Windows reboot (the WSL IP changes). Remove
# the forwarding at any time with:  <this script> -Remove
# Mirrored networking (Windows 11 22H2+) makes this script unnecessary; it targets
# the Windows 10 / default-NAT case.

param(
    [int]$Port = 9000,
    [switch]$Remove
)

$ErrorActionPreference = "Stop"
$ListenAddress = "0.0.0.0"
$FirewallRuleName = "WSL Laravel Forward $Port"
$WslIpRaw = $null
$WslIp = $null
$IsAdmin = $false
$CurrentIdentity = $null
$CurrentPrincipal = $null
$ExistingRule = $null

# --- Require Administrator (netsh portproxy + firewall changes need elevation) ---
$CurrentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$CurrentPrincipal = New-Object Security.Principal.WindowsPrincipal($CurrentIdentity)
$IsAdmin = $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "ERROR: This script must run in an ELEVATED (Administrator) PowerShell." -ForegroundColor Red
    Write-Host "       Right-click PowerShell -> 'Run as administrator', then re-run:" -ForegroundColor Yellow
    Write-Host "         powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port $Port" -ForegroundColor Yellow
    exit 1
}

# --- Removal path: delete the portproxy + firewall rule, then exit ---
if ($Remove) {
    Write-Host "Removing port forwarding for port $Port ..."
    netsh interface portproxy delete v4tov4 listenaddress=$ListenAddress listenport=$Port | Out-Null
    $ExistingRule = Get-NetFirewallRule -DisplayName $FirewallRuleName -ErrorAction SilentlyContinue
    if ($ExistingRule) {
        Remove-NetFirewallRule -DisplayName $FirewallRuleName
        Write-Host "  Removed firewall rule '$FirewallRuleName'."
    }
    Write-Host "  Done. Current portproxy table:"
    netsh interface portproxy show v4tov4
    exit 0
}

# --- Resolve the CURRENT WSL VM IP (first IPv4 from `wsl hostname -I`) ---
$WslIpRaw = (wsl hostname -I)
if (-not $WslIpRaw) {
    Write-Host "ERROR: Could not query the WSL IP (`wsl hostname -I` returned nothing)." -ForegroundColor Red
    Write-Host "       Is WSL installed and a distro running? Try: wsl -l -v" -ForegroundColor Yellow
    exit 1
}
$WslIp = ($WslIpRaw.Trim() -split '\s+')[0]
if (-not ($WslIp -match '^\d+\.\d+\.\d+\.\d+$')) {
    Write-Host "ERROR: Resolved WSL IP '$WslIp' is not a valid IPv4 address." -ForegroundColor Red
    exit 1
}
Write-Host "WSL VM IP (current): $WslIp"

# --- (Re)create the portproxy 0.0.0.0:PORT -> WSL_IP:PORT (idempotent) ---
# Delete any stale entry first (a previous WSL IP), then add the fresh mapping.
netsh interface portproxy delete v4tov4 listenaddress=$ListenAddress listenport=$Port | Out-Null
netsh interface portproxy add v4tov4 listenaddress=$ListenAddress listenport=$Port connectaddress=$WslIp connectport=$Port
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: netsh failed to add the portproxy rule (exit $LASTEXITCODE)." -ForegroundColor Red
    exit 1
}
Write-Host "Port forwarding set: ${ListenAddress}:$Port -> ${WslIp}:$Port"

# --- Open the inbound firewall port (idempotent: create only if missing) ---
$ExistingRule = Get-NetFirewallRule -DisplayName $FirewallRuleName -ErrorAction SilentlyContinue
if (-not $ExistingRule) {
    New-NetFirewallRule -DisplayName $FirewallRuleName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $Port -Profile Any | Out-Null
    Write-Host "Firewall: inbound rule '$FirewallRuleName' created (TCP $Port)."
} else {
    Write-Host "Firewall: inbound rule '$FirewallRuleName' already present."
}

Write-Host ""
Write-Host "Done. Other Tailscale devices can now reach this host on port $Port" -ForegroundColor Green
Write-Host "  (use this host's Tailscale IP, e.g. http://<host-tailscale-ip>:$Port)."
Write-Host ""
Write-Host "NOTE: the WSL IP changes after 'wsl --shutdown' or a reboot -- re-run this"
Write-Host "      script then. To remove the forwarding:  $($MyInvocation.MyCommand.Name) -Remove"
Write-Host ""
Write-Host "Current portproxy table:"
netsh interface portproxy show v4tov4
