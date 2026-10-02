# Shared installer step runner and menu item registry (callers: DevInstaller.ps1, InstallConfigMenu.ps1, menu_items/Item_*.ps1).
$INSTALL_ITEM_RUNNER_DIR = Split-Path -Parent $PSCommandPath
$INSTALL_ITEM_SHELLS_WIN_DIR = Split-Path -Parent $INSTALL_ITEM_RUNNER_DIR
$INSTALL_ITEM_STEPS_DIR = Join-Path $INSTALL_ITEM_SHELLS_WIN_DIR 'install_powershells'
$INSTALL_ITEM_MENU_ITEMS_DIR = Join-Path $INSTALL_ITEM_SHELLS_WIN_DIR 'menu_items'
$INSTALL_ITEM_STEPS_SUBPATH = 'shells/win/install_powershells'
$INSTALL_ITEM_SELECTED_ITEM_VAR = 'DD_RUN_ITEM'

function Install-Script {
    param(
        [string]$scriptName,
        [bool]$shouldExecute = $false
    )

    $scriptExtension = [System.IO.Path]::GetExtension($scriptName)
    if ($scriptExtension -ne '.ps1' -and $scriptExtension -ne '.js') {
        Write-Host "Unsupported script type: $scriptExtension" -ForegroundColor Red
        return
    }

    $selectedRegion = Get-GlobalVar -key "SELECTED_REGION"
    if ([string]::IsNullOrWhiteSpace($selectedRegion)) { $selectedRegion = "Global" }

    Write-Host "Checking script: $scriptName" -ForegroundColor Cyan

    $scriptSubPath = Join-Path $INSTALL_ITEM_STEPS_SUBPATH $scriptName
    $actualScriptPath = Invoke-SmartLoadScript -SubPath $scriptSubPath
    if (-not $actualScriptPath) {
        Write-Host "Failed to load script: $scriptName" -ForegroundColor Red
        return
    }

    if ($shouldExecute) {
        Write-Host "Executing script: $actualScriptPath" -ForegroundColor Cyan
        $scriptLeaf = Split-Path -Leaf $actualScriptPath
        $pythonExe = $null
        if (Get-Command Resolve-InstallerStepPythonExe -ErrorAction SilentlyContinue) {
            $pythonExe = Resolve-InstallerStepPythonExe
        }
        if (Get-Command Invoke-InstallerStepScript -ErrorAction SilentlyContinue) {
            Invoke-InstallerStepScript -ScriptName $scriptLeaf -Region $selectedRegion -PythonExe $pythonExe | Out-Null
        } else {
            & $actualScriptPath $selectedRegion
        }
    }
}

function Invoke-InstallItemMain {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Item,
        [switch]$ListSteps,
        [switch]$Check,
        [string]$Step = '',
        [switch]$Describe
    )

    if ($Describe) { return $Item }
    $steps = if ($Item.StepsProvider) { @(& $Item.StepsProvider) } else { @($Item.Steps) }

    if ($Step) {
        $steps = @($steps | Where-Object { $_ -eq $Step -or $_ -like "$Step`_*" -or $_ -like "Step$Step`_*" })
        if ($steps.Count -eq 0) {
            Write-Host "Step not part of item $($Item.Key): $Step" -ForegroundColor Red
            return
        }
    }

    if ($ListSteps) {
        foreach ($stepName in $steps) { Write-Output $stepName }
        return
    }

    if ($Check) {
        $missing = 0
        foreach ($stepName in $steps) {
            $stepPath = Join-Path $INSTALL_ITEM_STEPS_DIR $stepName
            if (Test-Path -LiteralPath $stepPath -PathType Leaf) {
                Write-Host "OK      $stepName"
            } else {
                Write-Host "MISSING $stepName" -ForegroundColor Red
                $missing++
            }
        }
        Write-Output $missing
        return
    }

    Write-Host "Running item [$($Item.Key)] $($Item.Title)" -ForegroundColor Cyan
    foreach ($stepName in $steps) {
        Install-Script -scriptName $stepName -shouldExecute $true
    }
}

function Get-InstallItems {
    $items = @()
    if (-not (Test-Path -LiteralPath $INSTALL_ITEM_MENU_ITEMS_DIR)) { return $items }
    $files = Get-ChildItem -LiteralPath $INSTALL_ITEM_MENU_ITEMS_DIR -Filter 'Item_*.ps1' -File | Sort-Object Name
    foreach ($file in $files) {
        $item = & $file.FullName -Describe
        if ($item -is [hashtable]) {
            $item.File = $file.FullName
            $items += $item
        }
    }
    return @($items | Sort-Object { [int]$_.Order })
}

function Get-InstallItemByKey {
    param([Parameter(Mandatory = $true)][string]$Key)
    foreach ($item in (Get-InstallItems)) {
        if ($item.Key -ceq $Key -or $item.Key -eq $Key) { return $item }
    }
    return $null
}
