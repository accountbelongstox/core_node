# Shared prerequisite completion and health-probe helpers.

function Invoke-PrereqInstallProbe {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [string]$Prefix = '',
        [string[]]$ImportModules = @(),
        [string[]]$PipPackages = @(),
        [switch]$AbsentOk,
        [string]$AbsentNote = ''
    )
    $failed = $false
    $out = @()
    $previousErrorActionPreference = $ErrorActionPreference
    if ($ImportModules.Count -gt 0 -or $PipPackages.Count -gt 0) {
        Write-Host ("{0} [idempotent-probe] running post-install verification ..." -f $Prefix) -ForegroundColor Cyan
    }
    foreach ($mod in $ImportModules) {
        $ok = $false
        $ErrorActionPreference = 'Continue'
        $out = @(& $PythonExe -c "import importlib.util; print('__IMPORT_OK__' if importlib.util.find_spec('$mod') is not None else '__IMPORT_MISSING__')" 2>$null)
        $ErrorActionPreference = $previousErrorActionPreference
        $ok = (("$out") -match '__IMPORT_OK__')
        if ($ok) {
            Write-Host ("{0} [idempotent-probe] OK  import {1}" -f $Prefix, $mod) -ForegroundColor Green
        } elseif ($AbsentOk) {
            $note = if ($AbsentNote) { " ($AbsentNote)" } else { '' }
            Write-Host ("{0} [idempotent-probe] SKIP import {1}{2}" -f $Prefix, $mod, $note) -ForegroundColor DarkGray
        } else {
            Write-Host ("{0} [idempotent-probe] FAIL import {1}" -f $Prefix, $mod) -ForegroundColor DarkYellow
            $failed = $true
        }
    }
    if ($PipPackages.Count -gt 0) {
        $pipVariable = Get-Variable -Name 'PIP_EXE_PATH' -Scope Global -ErrorAction SilentlyContinue
        $pipExe = if ($pipVariable) { [string]$pipVariable.Value } else { '' }
        if ($pipExe) {
            foreach ($pkg in $PipPackages) {
                if (Test-PipPackageInstalled -PipExe $pipExe -PackageName $pkg) {
                    Write-Host ("{0} [idempotent-probe] OK  pip {1}" -f $Prefix, $pkg) -ForegroundColor Green
                } else {
                    Write-Host ("{0} [idempotent-probe] FAIL pip {1}" -f $Prefix, $pkg) -ForegroundColor DarkYellow
                    $failed = $true
                }
            }
        } else {
            $failed = $true
        }
    }
    if ($failed) {
        Write-Host ("{0} [idempotent-probe] incomplete; the installer will repair missing artifacts on the next run." -f $Prefix) -ForegroundColor DarkYellow
    }
}

function Resolve-PrereqCompletionPython {
    param([string]$Candidate = '')
    $globalPythonVariable = Get-Variable -Name 'PYTHON_EXE_PATH' -Scope Global -ErrorAction SilentlyContinue
    $scriptPythonVariable = Get-Variable -Name 'resolvedPython' -Scope Script -ErrorAction SilentlyContinue
    $globalPython = if ($globalPythonVariable) { [string]$globalPythonVariable.Value } else { '' }
    $scriptPython = if ($scriptPythonVariable) { [string]$scriptPythonVariable.Value } else { '' }
    $paths = @($Candidate, $globalPython, $scriptPython)
    foreach ($path in $paths) {
        if ($path -and (Test-Path -LiteralPath $path -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $path).Path
        }
    }
    return ''
}

function Complete-PrereqStep {
    param(
        [string]$PythonExe = '',
        [string]$Prefix = '',
        [string[]]$ImportModules = @(),
        [string[]]$PipPackages = @(),
        [switch]$AbsentOk,
        [string]$AbsentNote = ''
    )
    $py = Resolve-PrereqCompletionPython -Candidate $PythonExe
    if ($py) {
        Invoke-PrereqInstallProbe -PythonExe $py -Prefix $Prefix -ImportModules $ImportModules -PipPackages $PipPackages -AbsentOk:$AbsentOk -AbsentNote $AbsentNote
    } elseif ($AbsentOk) {
        Write-Host ("{0} [idempotent-probe] SKIP interpreter ({1})" -f $Prefix, $AbsentNote) -ForegroundColor DarkGray
    } else {
        Write-Host ("{0} [idempotent-probe] FAIL Python interpreter is unavailable" -f $Prefix) -ForegroundColor DarkYellow
    }
}
