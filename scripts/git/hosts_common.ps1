# Shared helpers for hosts file: path, remove marked block, flush DNS.
# Used by github_host_refresh.ps1 and gitee_host_refresh.ps1.

function Get-HostsFilePath {
    if ($env:OS -match "Windows") {
        return Join-Path $env:SystemRoot "System32\drivers\etc\hosts"
    }
    return "/etc/hosts"
}

function Remove-MarkedBlock {
    param(
        [string[]]$Lines,
        [string]$MarkerStart,
        [string]$MarkerEnd
    )
    $out = @()
    $inside = $false
    $removed = 0
    foreach ($line in $Lines) {
        if ($line -match "^\s*" + [regex]::Escape($MarkerStart)) {
            $inside = $true
            $removed++
            continue
        }
        if ($inside) {
            $removed++
            if ($line -match "^\s*" + [regex]::Escape($MarkerEnd)) {
                $inside = $false
            }
            continue
        }
        $out += $line
    }
    return @{ Lines = $out; RemovedCount = $removed }
}

function Invoke-HostsFlushDns {
    try {
        Start-Process -FilePath "ipconfig" -ArgumentList "/flushdns" -Wait -NoNewWindow
    } catch {
        Write-Warning "Flush DNS skipped: $_"
    }
}
