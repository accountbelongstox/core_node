# Check if Node.js is allowed in Windows Firewall
$nodePath = (Get-Command node).Source
Write-Host "Node.js path: $nodePath"

$firewallRules = Get-NetFirewallApplicationFilter | Where-Object { $_.Program -like "*node.exe*" }

if ($firewallRules) {
    Write-Host "Found firewall rules for Node.js:"
    $firewallRules | ForEach-Object {
        Write-Host "  - $($_.Program)"
    }
} else {
    Write-Host "No firewall rules found for Node.js"
    Write-Host "You may need to add a firewall rule for Node.js"
}
