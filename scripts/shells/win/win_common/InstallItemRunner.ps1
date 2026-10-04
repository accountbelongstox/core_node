# Shared installer step runner and menu item registry (callers: DevInstaller.ps1, InstallConfigMenu.ps1, menu_items/Item_*.ps1).
$INSTALL_ITEM_RUNNER_DIR = Split-Path -Parent $PSCommandPath
$INSTALL_ITEM_SHELLS_WIN_DIR = Split-Path -Parent $INSTALL_ITEM_RUNNER_DIR
$INSTALL_ITEM_STEPS_DIR = Join-Path $INSTALL_ITEM_SHELLS_WIN_DIR 'install_powershells'
$INSTALL_ITEM_MENU_ITEMS_DIR = Join-Path $INSTALL_ITEM_SHELLS_WIN_DIR 'menu_items'
$INSTALL_ITEM_STEPS_SUBPATH = 'shells/win/install_powershells'
$INSTALL_ITEM_SELECTED_ITEM_VAR = 'DD_RUN_ITEM'
$INSTALL_ITEM_MODE_VAR = 'INSTALL_TYPE'
$INSTALL_ITEM_SWITCH_VALUES = @('false', 'true')
$INSTALL_ITEM_SWITCH_OFF = 'false'

. (Join-Path $INSTALL_ITEM_RUNNER_DIR 'AiModelLevelCommon.ps1')

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

    if ($shouldExecute -and -not (Test-AiModelStepAllowed -ScriptName $scriptName)) {
        Write-AiModelStepSkipped -ScriptName $scriptName
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
            Invoke-InstallerStepScript -ScriptName $scriptLeaf -ScriptPath $actualScriptPath -Region $selectedRegion -PythonExe $pythonExe | Out-Null
        } else {
            & $actualScriptPath $selectedRegion
        }
        # Any step may install software that drops desktop icons: tidy once (skips when unchanged)
        if (Get-Command Invoke-DesktopIconTidyAfterInstall -ErrorAction SilentlyContinue) {
            Invoke-DesktopIconTidyAfterInstall -Reason $scriptLeaf
        }
    }
}

# Prints every script a run is about to execute, numbered in execution order,
# before the first one starts; steps the AI model level skips and step files
# missing locally are marked.
function Write-InstallPlan {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [AllowEmptyCollection()][string[]]$Steps = @(),
        [AllowEmptyCollection()][string[]]$SwitchedOffSteps = @()
    )
    $index = 0
    $note = ''

    Write-Host ''
    Write-Host ("{0}: {1} script(s) in order" -f $Title, $Steps.Count) -ForegroundColor Cyan
    foreach ($stepName in $Steps) {
        $index++
        $note = ''
        if ($SwitchedOffSteps -contains $stepName) {
            $note = ' [skip: switched off]'
        }
        elseif (-not (Test-AiModelStepAllowed -ScriptName $stepName)) {
            $note = ' [skip: AI model level]'
        }
        elseif (-not (Test-Path -LiteralPath (Join-Path $INSTALL_ITEM_STEPS_DIR $stepName) -PathType Leaf)) {
            $note = ' [not local: loaded on demand]'
        }
        Write-Host ("  {0,3}. {1}{2}" -f $index, $stepName, $note) -ForegroundColor $(if ($note) { 'DarkGray' } else { 'White' })
    }
    Write-Host ''
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
    $steps = if ($Item.ContainsKey('StepsProvider') -and $Item.StepsProvider) { @(& $Item.StepsProvider) } else { @($Item.Steps) }

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
    Write-InstallPlan -Title ("Item [{0}] {1}" -f $Item.Key, $Item.Title) -Steps $steps
    foreach ($stepName in $steps) {
        Install-Script -scriptName $stepName -shouldExecute $true
    }
    Write-Host "Item $($Item.Title) completed" -ForegroundColor Green
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

function Get-InstallConfigMode {
    param([array]$Items)
    $modeItem = $Items | Where-Object { $_.Var -eq $INSTALL_ITEM_MODE_VAR } | Select-Object -First 1
    $mode = Get-GlobalVar -key $INSTALL_ITEM_MODE_VAR
    if ($modeItem -and @($modeItem.Values) -notcontains $mode) { $mode = @($modeItem.Values)[0] }
    return $mode
}

function Get-InstallItemPreset {
    param([hashtable]$Item, [string]$Mode)
    if ($Item.ContainsKey('Presets') -and $Item.Presets.ContainsKey($Mode)) { return $Item.Presets[$Mode] }
    return @($Item.Values)[0]
}

# Stored value, else the current mode's preset (what the configuration menu shows)
function Get-InstallItemValue {
    param([hashtable]$Item, [array]$Items)
    $value = Get-GlobalVar -key $Item.Var
    if (@($Item.Values) -notcontains $value) {
        if ($Item.Var -eq $INSTALL_ITEM_MODE_VAR) { return (Get-InstallConfigMode -Items $Items) }
        $value = Get-InstallItemPreset -Item $Item -Mode (Get-InstallConfigMode -Items $Items)
    }
    return $value
}

# Steps of the on/off menu items switched off (e.g. [R] Redis = false): the full installation skips them.
function Get-InstallItemDisabledSteps {
    $items = @(Get-InstallItems)
    $disabled = @()
    $item = $null
    foreach ($item in $items) {
        if (-not $item.ContainsKey('Steps')) { continue }
        if ((@($item.Values) -join ',') -ne ($INSTALL_ITEM_SWITCH_VALUES -join ',')) { continue }
        if ((Get-InstallItemValue -Item $item -Items $items) -eq $INSTALL_ITEM_SWITCH_OFF) { $disabled += @($item.Steps) }
    }
    return $disabled
}

function Get-InstallItemByKey {
    param([Parameter(Mandatory = $true)][string]$Key)
    foreach ($item in (Get-InstallItems)) {
        if ($item.Id -eq $Key -or $item.Key -eq $Key) { return $item }
    }
    return $null
}
