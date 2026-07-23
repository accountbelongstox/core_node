# Shared prerequisite completion and health-probe helpers.

function Test-InstallScriptSwitch {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][string]$SwitchName
    )
    if (-not (Test-Path -LiteralPath $ScriptPath)) { return $false }
    $raw = Get-Content -LiteralPath $ScriptPath -Raw -ErrorAction SilentlyContinue
    if (-not $raw) { return $false }
    return $raw -match "\[switch\]\`$$SwitchName\b"
}

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
    $previousErrorActionPreference = $ErrorActionPreference
    Write-Host ("{0} [idempotent-probe] running post-install verification ..." -f $Prefix) -ForegroundColor Cyan
    foreach ($mod in $ImportModules) {
        $ok = $false
        try {
            $ErrorActionPreference = 'Continue'
            $out = (& $PythonExe -c "import importlib; importlib.import_module('$mod'); print('__IMPORT_OK__')" 2>$null) -join ''
            $ok = ($LASTEXITCODE -eq 0 -and $out -match '__IMPORT_OK__')
        } catch {
            $ok = $false
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
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
        $pipExe = $Global:PIP_EXE_PATH
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
    return (-not $failed)
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
    $py = $PythonExe
    $probeOk = $true
    if (-not $py) { $py = $script:resolvedPython }
    if ($py) {
        $probeOk = Invoke-PrereqInstallProbe -PythonExe $py -Prefix $Prefix -ImportModules $ImportModules -PipPackages $PipPackages -AbsentOk:$AbsentOk -AbsentNote $AbsentNote
    } elseif ($AbsentOk) {
        Write-Host ("{0} [idempotent-probe] SKIP interpreter ({1})" -f $Prefix, $AbsentNote) -ForegroundColor DarkGray
    } else {
        Write-Host ("{0} [idempotent-probe] FAIL Python interpreter is unavailable" -f $Prefix) -ForegroundColor DarkYellow
        $probeOk = $false
    }
    if (-not $probeOk) {
        throw ("{0} prerequisite health verification failed." -f $Prefix)
    }
    exit 0
}
