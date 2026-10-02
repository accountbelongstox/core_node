# Installation "Confirm Configuration" screen (caller: dd.ps1 Show-InstallerSubMenu); mirrors Linux selector_common.sh.
$INSTALL_CONFIG_MENU_DIR = Split-Path -Parent $PSCommandPath
$INSTALL_CONFIG_AUTO_START_SECONDS = 10
$INSTALL_CONFIG_NOT_APPLICABLE = @(
    @{ Key = 'G'; Title = 'Install Gitea (Git Service)' },
    @{ Key = 'T'; Title = 'Mesh VPN After Installation' },
    @{ Key = '#'; Title = 'Setup Network Router' },
    @{ Key = 'C'; Title = 'Set Cloud Provider' }
)
$INSTALL_CONFIG_PROMPT = 'Enter=Start full installation, 1-N or item key (e.g. R)=run only that item, B=Go back to edit, Q=Quit without saving'
$INSTALL_CONFIG_NOT_APPLICABLE_TEXT = 'not applicable on Windows'

. (Join-Path $INSTALL_CONFIG_MENU_DIR 'InstallItemRunner.ps1')

function Read-InstallConfigChoice {
    param([int]$TimeoutSeconds)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $buffer = ''
    $canPoll = $true
    try { $null = [Console]::KeyAvailable } catch { $canPoll = $false }
    if (-not $canPoll) {
        return (Read-Host $INSTALL_CONFIG_PROMPT)
    }
    Write-Host ''
    Write-Host $INSTALL_CONFIG_PROMPT -ForegroundColor Cyan
    Write-Host ("Full installation will start automatically in {0} seconds..." -f $TimeoutSeconds)
    while ($true) {
        if ($buffer.Length -eq 0 -and (Get-Date) -ge $deadline) {
            Write-Host ''
            return ''
        }
        if ([Console]::KeyAvailable) {
            $keyInfo = [Console]::ReadKey($true)
            if ($keyInfo.Key -eq 'Enter') { Write-Host ''; return $buffer }
            if ($keyInfo.Key -eq 'Backspace') {
                if ($buffer.Length -gt 0) { $buffer = $buffer.Substring(0, $buffer.Length - 1); Write-Host "`b `b" -NoNewline }
                continue
            }
            $buffer += [string]$keyInfo.KeyChar
            Write-Host $keyInfo.KeyChar -NoNewline
            continue
        }
        Start-Sleep -Milliseconds 100
    }
}

function Get-InstallItemValue {
    param([hashtable]$Item)
    $value = Get-GlobalVar -key $Item.Var
    if ([string]::IsNullOrWhiteSpace($value)) { $value = @($Item.Values)[0] }
    return $value
}

function Invoke-InstallConfigEdit {
    param([array]$Items)
    $menuItems = @()
    foreach ($item in $Items) {
        $values = @($item.Values)
        $index = [array]::IndexOf($values, (Get-InstallItemValue -Item $item))
        if ($index -lt 0) { $index = 0 }
        $menuItems += @{ Text = $item.Title; Values = $values; CurrentValueIndex = $index; Key = $item.Var; Action = { } }
    }
    $menuItems += @{ Text = 'Done'; Values = @('default'); CurrentValueIndex = 0; Key = $null; Action = { } }
    do {
        $picked = Invoke-InteractiveMenu -Items $menuItems -Title 'Edit configuration (Left/Right to change value, Enter on Done to finish)' -EnableValueToggle $true
    } while ($picked -ge 0 -and $picked -lt ($menuItems.Count - 1))
}

# Returns $true to start the installation (DD_RUN_ITEM set for a single item, cleared for full), $false to cancel
function Show-InstallConfirmMenu {
    $items = @(Get-InstallItems)
    while ($true) {
        Clear-Host
        Write-Host 'Confirm Configuration' -ForegroundColor Cyan
        for ($i = 0; $i -lt $items.Count; $i++) {
            Write-Host ("{0}. [{1}] {2}: {3}" -f ($i + 1), $items[$i].Key, $items[$i].Title, (Get-InstallItemValue -Item $items[$i]))
        }
        foreach ($na in $INSTALL_CONFIG_NOT_APPLICABLE) {
            Write-Host ("      [{0}] {1,-36} {2}" -f $na.Key, $na.Title, $INSTALL_CONFIG_NOT_APPLICABLE_TEXT) -ForegroundColor DarkGray
        }

        $choice = (Read-InstallConfigChoice -TimeoutSeconds $INSTALL_CONFIG_AUTO_START_SECONDS).Trim()
        if ($choice -eq '') {
            Set-GlobalVar -key $INSTALL_ITEM_SELECTED_ITEM_VAR -value '' | Out-Null
            return $true
        }
        if ($choice -ieq 'Q') { return $false }
        if ($choice -ieq 'B') { Invoke-InstallConfigEdit -Items $items; continue }

        $picked = $null
        $number = 0
        if ([int]::TryParse($choice, [ref]$number) -and $number -ge 1 -and $number -le $items.Count) {
            $picked = $items[$number - 1]
        } else {
            foreach ($item in $items) { if ($item.Key -ieq $choice) { $picked = $item; break } }
        }
        if ($picked) {
            Set-GlobalVar -key $INSTALL_ITEM_SELECTED_ITEM_VAR -value $picked.Id | Out-Null
            return $true
        }
        Write-Host "Invalid choice: $choice" -ForegroundColor Red
        Start-Sleep -Seconds 1
    }
}
