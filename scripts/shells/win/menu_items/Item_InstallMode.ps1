param(
    [switch]$ListSteps,
    [switch]$Check,
    [string]$Step = '',
    [switch]$Describe
)

$winCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'win_common'
. (Join-Path $winCommonDir 'InstallItemRunner.ps1')

$item = @{
    Id    = 'INSTALL_MODE'
    Key   = '*'
    Order = 10
    Title = 'Switch Installation Mode'
    Var   = 'INSTALL_TYPE'
    Values = @('desktop', 'server')
    StepsProvider = {
        . (Join-Path $winCommonDir 'InstallerScriptsList.ps1')
        $switchedOff = @(Get-InstallItemDisabledSteps)
        return @($InstallerScripts | Where-Object { $switchedOff -notcontains $_ })
    }
}

Invoke-InstallItemMain -Item $item -ListSteps:$ListSteps -Check:$Check -Step $Step -Describe:$Describe
