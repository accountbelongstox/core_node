# Series index runner (callers: install_powershells/Step*_Install<Series>.ps1). An index step only lists
# its component scripts (install_powershells/<Series>_<Part>.ps1); this file runs them in that order
# through the shared Install-Script, skipping components switched off in the installation configuration
# and model components above the AI model level.
$INSTALL_SERIES_COMMON_DIR = Split-Path -Parent $PSCommandPath

if (-not (Get-Command -Name 'Get-GlobalVar' -ErrorAction SilentlyContinue)) { . (Join-Path $INSTALL_SERIES_COMMON_DIR 'GlobalVars.ps1') }
if (-not (Get-Command -Name 'Invoke-SmartLoadScript' -ErrorAction SilentlyContinue)) { . (Join-Path $INSTALL_SERIES_COMMON_DIR 'CommonFunc.ps1') }
if (-not (Get-Command -Name 'Invoke-InstallerStepScript' -ErrorAction SilentlyContinue)) { . (Join-Path $INSTALL_SERIES_COMMON_DIR 'InstallerScriptsList.ps1') }
if (-not (Get-Command -Name 'Install-Script' -ErrorAction SilentlyContinue)) { . (Join-Path $INSTALL_SERIES_COMMON_DIR 'InstallItemRunner.ps1') }

function Invoke-InstallSeries {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][string[]]$Components
    )
    $switchedOff = @(Get-InstallItemDisabledSteps)
    $component = ''

    Write-InstallPlan -Title $Title -Steps $Components -SwitchedOffSteps $switchedOff
    foreach ($component in $Components) {
        if ($switchedOff -contains $component) {
            Write-Host "[skip] $component (switched off in the installation configuration)" -ForegroundColor DarkGray
            continue
        }
        Install-Script -scriptName $component -shouldExecute $true
    }
    Write-Host "$Title completed" -ForegroundColor Green
}
