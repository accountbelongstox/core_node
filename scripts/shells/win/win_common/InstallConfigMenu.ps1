# Installation configuration editor + "Confirm Configuration" screen (caller: dd.ps1 Show-InstallerSubMenu); mirrors Linux selector_common.sh.
$INSTALL_CONFIG_MENU_DIR = Split-Path -Parent $PSCommandPath
$INSTALL_CONFIG_AUTO_START_SECONDS = 10
$INSTALL_CONFIG_NOT_APPLICABLE = @(
    @{ Key = 'G'; Title = 'Install Gitea (Git Service)' }
)
$INSTALL_CONFIG_PROMPT = 'Enter=Start full installation, 1-{0} or item key (e.g. R)=run only that item, B=Go back to edit, Q=Quit without saving'
$INSTALL_CONFIG_NOT_APPLICABLE_TEXT = 'not applicable on Windows'
$INSTALL_CONFIG_EDITOR_TITLE = 'Install the Windows Configuration'
$INSTALL_CONFIG_EDITOR_CONTROLS = 'Up/Down=Navigate, Left/Right=Change value, Enter=Confirm, B=Back, Q=Quit'
$INSTALL_CONFIG_SEPARATOR = '--------------------------------------'
$INSTALL_CONFIG_RESULT_CONFIRM = 'confirm'
$INSTALL_CONFIG_RESULT_CANCEL = 'cancel'

. (Join-Path $INSTALL_CONFIG_MENU_DIR 'InstallItemRunner.ps1')

function Read-InstallConfigChoice {
    param([int]$TimeoutSeconds, [int]$ItemCount)

    $prompt = $INSTALL_CONFIG_PROMPT -f $ItemCount
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $buffer = ''
    $canPoll = $true
    try { $null = [Console]::KeyAvailable } catch { $canPoll = $false }
    if (-not $canPoll) {
        return (Read-Host $prompt)
    }
    Write-Host ''
    Write-Host $prompt -ForegroundColor Cyan
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

# An item Setter (e.g. Set-DatabaseEngine) also writes the value's mirror keys (Linux sync_database_engine)
function Save-InstallItemValue {
    param([hashtable]$Item, [string]$Value)
    if ($Item.ContainsKey('Setter')) {
        & $Item.Setter $Value | Out-Null
        return
    }
    Set-GlobalVar -key $Item.Var -value $Value | Out-Null
}

# Switching the mode resets every item that has presets to that mode's preset (Linux reset_to_mode_defaults)
function Set-InstallConfigValue {
    param([hashtable]$Item, [string]$Value, [array]$Items)
    Save-InstallItemValue -Item $Item -Value $Value
    if ($Item.Var -ne $INSTALL_ITEM_MODE_VAR) { return }
    foreach ($other in $Items) {
        if ($other.ContainsKey('Presets') -and $other.Presets.ContainsKey($Value)) {
            Save-InstallItemValue -Item $other -Value $other.Presets[$Value]
        }
    }
}

function Step-InstallConfigValue {
    param([hashtable]$Item, [int]$Direction, [array]$Items)
    $values = @($Item.Values)
    if ($values.Count -lt 2) { return }
    $index = [array]::IndexOf($values, (Get-InstallItemValue -Item $Item -Items $Items))
    if ($index -lt 0) { $index = 0 }
    $index = ($index + $Direction + $values.Count) % $values.Count
    Set-InstallConfigValue -Item $Item -Value $values[$index] -Items $Items
}

function Write-InstallConfigEditor {
    param([array]$Items, [int]$Selected)
    Clear-Host
    Write-Host $INSTALL_CONFIG_EDITOR_TITLE -ForegroundColor Cyan
    Write-Host ("Current Mode: {0}" -f (Get-InstallConfigMode -Items $Items))
    Write-Host $INSTALL_CONFIG_SEPARATOR
    Write-Host $INSTALL_CONFIG_EDITOR_CONTROLS
    Write-Host $INSTALL_CONFIG_SEPARATOR
    for ($i = 0; $i -lt $Items.Count; $i++) {
        $line = "[{0}] {1,-36} [{2}]" -f $Items[$i].Key, $Items[$i].Title, (Get-InstallItemValue -Item $Items[$i] -Items $Items)
        if ($i -eq $Selected) {
            Write-Host ("> {0}" -f $line) -ForegroundColor Black -BackgroundColor White
        } else {
            Write-Host ("  {0}" -f $line)
        }
    }
    foreach ($na in $INSTALL_CONFIG_NOT_APPLICABLE) {
        Write-Host ("  [{0}] {1,-36} {2}" -f $na.Key, $na.Title, $INSTALL_CONFIG_NOT_APPLICABLE_TEXT) -ForegroundColor DarkGray
    }
}

# Persist every shown value before installing so the steps read what the menu showed (Linux save_configuration)
function Save-InstallConfiguration {
    param([array]$Items)
    foreach ($item in $Items) {
        Save-InstallItemValue -Item $item -Value (Get-InstallItemValue -Item $item -Items $Items)
    }
}

# Arrow-key editor (Linux selector_common.sh main loop); returns confirm or cancel
function Invoke-InstallConfigEditor {
    param([array]$Items)
    $selected = 0
    while ($true) {
        Write-InstallConfigEditor -Items $Items -Selected $selected
        try {
            $keyInfo = [Console]::ReadKey($true)
        } catch {
            return $INSTALL_CONFIG_RESULT_CONFIRM
        }
        switch ($keyInfo.Key) {
            'UpArrow'    { $selected = ($selected - 1 + $Items.Count) % $Items.Count }
            'DownArrow'  { $selected = ($selected + 1) % $Items.Count }
            'LeftArrow'  { Step-InstallConfigValue -Item $Items[$selected] -Direction -1 -Items $Items }
            'RightArrow' { Step-InstallConfigValue -Item $Items[$selected] -Direction 1 -Items $Items }
            'Enter'      { return $INSTALL_CONFIG_RESULT_CONFIRM }
        }
        $char = [string]$keyInfo.KeyChar
        if ($char -ieq 'B' -or $char -ieq 'Q') { return $INSTALL_CONFIG_RESULT_CANCEL }
    }
}

# Returns $true to start the installation (DD_RUN_ITEM set for a single item, cleared for full), $false to cancel
function Show-InstallConfirmMenu {
    $items = @(Get-InstallItems)
    if ((Invoke-InstallConfigEditor -Items $items) -ne $INSTALL_CONFIG_RESULT_CONFIRM) { return $false }
    while ($true) {
        Clear-Host
        Write-Host 'Confirm Configuration' -ForegroundColor Cyan
        for ($i = 0; $i -lt $items.Count; $i++) {
            Write-Host ("{0}. [{1}] {2}: {3}" -f ($i + 1), $items[$i].Key, $items[$i].Title, (Get-InstallItemValue -Item $items[$i] -Items $items))
        }
        foreach ($na in $INSTALL_CONFIG_NOT_APPLICABLE) {
            Write-Host ("      [{0}] {1,-36} {2}" -f $na.Key, $na.Title, $INSTALL_CONFIG_NOT_APPLICABLE_TEXT) -ForegroundColor DarkGray
        }
        if (Get-Command Get-CnProgramDriveStatus -ErrorAction SilentlyContinue) {
            $programDriveStatus = Get-CnProgramDriveStatus
            Write-Host ("      {0}" -f $programDriveStatus.Text) -ForegroundColor $programDriveStatus.Color
        }

        $choice = (Read-InstallConfigChoice -TimeoutSeconds $INSTALL_CONFIG_AUTO_START_SECONDS -ItemCount $items.Count).Trim()
        if ($choice -eq '') {
            Save-InstallConfiguration -Items $items
            Set-GlobalVar -key $INSTALL_ITEM_SELECTED_ITEM_VAR -value '' | Out-Null
            return $true
        }
        if ($choice -ieq 'Q') { return $false }
        if ($choice -ieq 'B') {
            if ((Invoke-InstallConfigEditor -Items $items) -ne $INSTALL_CONFIG_RESULT_CONFIRM) { return $false }
            continue
        }

        $picked = $null
        $number = 0
        if ([int]::TryParse($choice, [ref]$number) -and $number -ge 1 -and $number -le $items.Count) {
            $picked = $items[$number - 1]
        } else {
            foreach ($item in $items) { if ($item.Key -ieq $choice) { $picked = $item; break } }
        }
        if ($picked) {
            Save-InstallConfiguration -Items $items
            Set-GlobalVar -key $INSTALL_ITEM_SELECTED_ITEM_VAR -value $picked.Id | Out-Null
            return $true
        }
        Write-Host "Invalid choice: $choice" -ForegroundColor Red
        Start-Sleep -Seconds 1
    }
}
