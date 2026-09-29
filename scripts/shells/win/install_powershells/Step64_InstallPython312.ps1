$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'CommonFunc.ps1')
. (Join-Path $winCommonDir 'WindowsPathFunction.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')
. (Join-Path $winCommonDir 'IsolatedPythonInstallCommon.ps1')

Invoke-IsolatedPythonInstall -RuntimeKey 'PYTHON312' -StepLabel '[Step 64]'
