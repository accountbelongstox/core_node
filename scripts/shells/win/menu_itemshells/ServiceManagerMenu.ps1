<#
.SYNOPSIS
    Service Manager (Windows), parity with the Linux dd.sh > Service Manager:
    view, start, stop, restart and toggle autostart of every service and
    scheduled task this project installs. Catalog: service_contract.json
    (service_manager.windows + dynamic_service_patterns). Control actions
    relaunch this script elevated when the console is not elevated.
#>
param(
    [Parameter()][ValidateSet('Menu', 'Start', 'Stop', 'Restart', 'Autostart')][string]$Action = 'Menu',
    [Parameter()][ValidateSet('service', 'task')][string]$Kind = 'service',
    [Parameter()][string]$Name = ''
)

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:SERVICE_MANAGER_SCRIPT = $PSCommandPath
$script:SERVICE_MANAGER_CATALOG_KEY = "service_manager.windows"
$script:SERVICE_MANAGER_PATTERNS_KEY = "service_manager.dynamic_service_patterns"
$script:SERVICE_KIND = "service"
$script:TASK_KIND = "task"
$script:STATE_NOT_INSTALLED = "NOT INSTALLED"
$script:AUTOSTART_SERVICE_ON = "Automatic"
$script:AUTOSTART_SERVICE_OFF = "Manual"
$script:ELEVATED_PAUSE_SECONDS = 3

. (Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1")
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
. (Join-Path $script:WIN_COMMON_DIR "ServiceContract.ps1")
#endregion

#region Catalog
function Get-ServiceManagerScheduledTask {
    param([Parameter(Mandatory = $true)][string]$TaskName)
    return (Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -eq $TaskName } | Select-Object -First 1)
}

# Resolved entries: Label, Kind, Name (first existing candidate, else the first
# candidate), Installed.
function Get-ServiceManagerEntries {
    $entries = @()
    $resolvedName = ''
    $installed = $false
    $knownNames = @{}

    foreach ($item in @(Get-ServiceContractValue -ContractPath $script:SERVICE_MANAGER_CATALOG_KEY)) {
        $resolvedName = [string]$item.names[0]
        $installed = $false
        foreach ($candidate in @($item.names)) {
            if ($item.kind -eq $script:TASK_KIND) {
                $installed = $null -ne (Get-ServiceManagerScheduledTask -TaskName $candidate)
            } else {
                $installed = $null -ne (Get-Service -Name $candidate -ErrorAction SilentlyContinue)
            }
            if ($installed) { $resolvedName = [string]$candidate; break }
        }
        $knownNames[$resolvedName] = $true
        $entries += [pscustomobject]@{ Label = [string]$item.label; Kind = [string]$item.kind; Name = $resolvedName; Installed = $installed }
    }

    foreach ($pattern in @(Get-ServiceContractValue -ContractPath $script:SERVICE_MANAGER_PATTERNS_KEY)) {
        foreach ($service in @(Get-Service -Name $pattern -ErrorAction SilentlyContinue)) {
            if ($knownNames.ContainsKey($service.Name)) { continue }
            $entries += [pscustomobject]@{ Label = $service.Name; Kind = $script:SERVICE_KIND; Name = $service.Name; Installed = $true }
        }
    }
    return $entries
}

function Get-ServiceManagerState {
    param([Parameter(Mandatory = $true)][object]$Entry)
    $service = $null
    $task = $null

    if (-not $Entry.Installed) { return $script:STATE_NOT_INSTALLED }
    if ($Entry.Kind -eq $script:TASK_KIND) {
        $task = Get-ServiceManagerScheduledTask -TaskName $Entry.Name
        if ($null -eq $task) { return $script:STATE_NOT_INSTALLED }
        return [string]$task.State
    }
    $service = Get-Service -Name $Entry.Name -ErrorAction SilentlyContinue
    if ($null -eq $service) { return $script:STATE_NOT_INSTALLED }
    return ("{0}, {1}" -f $service.Status, $service.StartType)
}
#endregion

#region Actions
function Invoke-ServiceManagerControl {
    param(
        [Parameter(Mandatory = $true)][string]$ControlAction,
        [Parameter(Mandatory = $true)][string]$ControlKind,
        [Parameter(Mandatory = $true)][string]$ControlName
    )
    $task = $null
    $service = $null

    if ($ControlKind -eq $script:TASK_KIND) {
        $task = Get-ServiceManagerScheduledTask -TaskName $ControlName
        if ($null -eq $task) { Write-Host "[-] Scheduled task not found: $ControlName" -ForegroundColor Red; return }
        switch ($ControlAction) {
            'Start' { Write-Host "> Start-ScheduledTask $ControlName"; $task | Start-ScheduledTask }
            'Stop' { Write-Host "> Stop-ScheduledTask $ControlName"; $task | Stop-ScheduledTask }
            'Restart' {
                Write-Host "> Stop-ScheduledTask / Start-ScheduledTask $ControlName"
                $task | Stop-ScheduledTask
                $task | Start-ScheduledTask
            }
            'Autostart' {
                if ($task.State -eq 'Disabled') {
                    Write-Host "> Enable-ScheduledTask $ControlName"; $task | Enable-ScheduledTask | Out-Null
                } else {
                    Write-Host "> Disable-ScheduledTask $ControlName"; $task | Disable-ScheduledTask | Out-Null
                }
            }
        }
        return
    }

    $service = Get-Service -Name $ControlName -ErrorAction SilentlyContinue
    if ($null -eq $service) { Write-Host "[-] Service not found: $ControlName" -ForegroundColor Red; return }
    switch ($ControlAction) {
        'Start' { Write-Host "> Start-Service $ControlName"; Start-Service -Name $ControlName }
        'Stop' { Write-Host "> Stop-Service $ControlName"; Stop-Service -Name $ControlName -Force }
        'Restart' { Write-Host "> Restart-Service $ControlName"; Restart-Service -Name $ControlName -Force }
        'Autostart' {
            if ($service.StartType -eq $script:AUTOSTART_SERVICE_ON) {
                Write-Host "> Set-Service $ControlName -StartupType $script:AUTOSTART_SERVICE_OFF"
                Set-Service -Name $ControlName -StartupType $script:AUTOSTART_SERVICE_OFF
            } else {
                Write-Host "> Set-Service $ControlName -StartupType $script:AUTOSTART_SERVICE_ON"
                Set-Service -Name $ControlName -StartupType $script:AUTOSTART_SERVICE_ON
            }
        }
    }
}

# Runs the control action here when elevated, otherwise in an elevated copy of
# this script (one UAC prompt per action).
function Invoke-ServiceManagerAction {
    param(
        [Parameter(Mandatory = $true)][string]$ControlAction,
        [Parameter(Mandatory = $true)][object]$Entry
    )

    if (Test-AdminPrivileges) {
        Invoke-ServiceManagerControl -ControlAction $ControlAction -ControlKind $Entry.Kind -ControlName $Entry.Name
        return
    }
    Write-Host "[!] Administrator rights are required; relaunching elevated..." -ForegroundColor Yellow
    try {
        Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $script:SERVICE_MANAGER_SCRIPT),
            '-Action', $ControlAction, '-Kind', $Entry.Kind, '-Name', ('"{0}"' -f $Entry.Name)
        ) | Out-Null
    } catch {
        Write-Host "[-] Elevation declined or failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-ServiceManagerDetails {
    param([Parameter(Mandatory = $true)][object]$Entry)
    $task = $null

    Write-Host ''
    Write-Host ("{0} ({1}: {2})" -f $Entry.Label, $Entry.Kind, $Entry.Name) -ForegroundColor Cyan
    if (-not $Entry.Installed) { Write-Host "  $script:STATE_NOT_INSTALLED" -ForegroundColor Red; return }
    if ($Entry.Kind -eq $script:TASK_KIND) {
        $task = Get-ServiceManagerScheduledTask -TaskName $Entry.Name
        $task | Select-Object TaskPath, TaskName, State, Description | Format-List | Out-Host
        $task | Get-ScheduledTaskInfo | Select-Object LastRunTime, LastTaskResult, NextRunTime | Format-List | Out-Host
        $task.Actions | Select-Object Execute, Arguments, WorkingDirectory | Format-List | Out-Host
        return
    }
    Get-CimInstance -ClassName Win32_Service -Filter ("Name='{0}'" -f $Entry.Name) |
        Select-Object Name, DisplayName, State, StartMode, StartName, ProcessId, PathName | Format-List | Out-Host
}

function Show-ServiceManagerEntryMenu {
    param([Parameter(Mandatory = $true)][object]$Entry)
    $title = "Service Manager > {0}" -f $Entry.Label

    if (-not $Entry.Installed) {
        Show-ServiceManagerDetails -Entry $Entry
        Write-Host "  Install it from dd.cmd > Install/Test environment scripts." -ForegroundColor DarkGray
        Wait-MenuContinue
        return
    }
    Show-NumberedMenu -Title $title -Header { Show-ServiceManagerDetails -Entry $Entry } -Items @(
        @{ Text = "Start"; Action = { Invoke-ServiceManagerAction -ControlAction 'Start' -Entry $Entry } },
        @{ Text = "Stop"; Action = { Invoke-ServiceManagerAction -ControlAction 'Stop' -Entry $Entry } },
        @{ Text = "Restart"; Action = { Invoke-ServiceManagerAction -ControlAction 'Restart' -Entry $Entry } },
        @{ Text = "Toggle autostart"; Action = { Invoke-ServiceManagerAction -ControlAction 'Autostart' -Entry $Entry } }
    )
}

function Invoke-ServiceManagerBulk {
    param([Parameter(Mandatory = $true)][string]$ControlAction)
    $confirm = Read-Host "$ControlAction all installed services and tasks? (y/N)"

    if ($confirm -notmatch '^(?i)y$') { Write-Host "Cancelled."; return }
    foreach ($entry in @(Get-ServiceManagerEntries | Where-Object { $_.Installed })) {
        Invoke-ServiceManagerAction -ControlAction $ControlAction -Entry $entry
    }
}

function Show-ServiceManagerStatusTable {
    Get-ServiceManagerEntries | ForEach-Object {
        [pscustomobject]@{ Service = $_.Label; Kind = $_.Kind; Name = $_.Name; State = (Get-ServiceManagerState -Entry $_) }
    } | Format-Table -AutoSize | Out-Host
}

# Show-NumberedMenu re-evaluates Label on every redraw ($item) and runs Action
# with $chosenItem in scope, so states stay live without rebuilding the list.
function Show-ServiceManagerMenu {
    $items = @(@{ Text = "-- Services --"; IsHeader = $true })

    foreach ($entry in @(Get-ServiceManagerEntries)) {
        $items += @{
            Entry   = $entry
            Label   = { "{0} [{1}]" -f $item.Entry.Label, (Get-ServiceManagerState -Entry $item.Entry) }
            Submenu = $true
            Action  = { Show-ServiceManagerEntryMenu -Entry $chosenItem.Entry }
        }
    }
    $items += @{ Text = "-- All --"; IsHeader = $true }
    $items += @{ Text = "Show all status"; Action = { Show-ServiceManagerStatusTable } }
    $items += @{ Text = "Start all installed"; Action = { Invoke-ServiceManagerBulk -ControlAction 'Start' } }
    $items += @{ Text = "Stop all installed"; Action = { Invoke-ServiceManagerBulk -ControlAction 'Stop' } }
    $items += @{ Text = "Restart all installed"; Action = { Invoke-ServiceManagerBulk -ControlAction 'Restart' } }
    Show-NumberedMenu -Title "Service Manager" -Items $items
}
#endregion

#region Main Execution
if ($Action -eq 'Menu') {
    Show-ServiceManagerMenu
} else {
    Invoke-ServiceManagerControl -ControlAction $Action -ControlKind $Kind -ControlName $Name
    Start-Sleep -Seconds $script:ELEVATED_PAUSE_SECONDS
}
#endregion
