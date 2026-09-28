param([ValidateSet('310', '312', 'Both')][string]$Runtime = 'Both')

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'CommonFunc.ps1')
. (Join-Path $winCommonDir 'WindowsPathFunction.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')
. (Join-Path $winCommonDir 'IsolatedPythonInstallCommon.ps1')

if ($Runtime -in @('310', 'Both')) {
    Invoke-IsolatedPythonInstall -RuntimeKey 'PYTHON310' -StepLabel '[Step 13]'
}
if ($Runtime -in @('312', 'Both')) {
    Invoke-IsolatedPythonInstall -RuntimeKey 'PYTHON312' -StepLabel '[Step 13]'
}
