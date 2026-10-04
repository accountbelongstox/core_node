# AiKeyHealthWarning.ps1 - shared startup helper (pyservice.ps1, dd.ps1): warns about AI provider
# keys the last pycore probe rejected (401/403). Never blocks or fails the caller.
# Linux counterpart: scripts/shells/linux/common/ai_key_health_warning.sh

$Script:AiKeyHealthModule = 'pycore.pyctl.ai.key_health'
$Script:AiKeyHealthCommand = 'key-status'
$Script:AiKeyHealthTimeoutMs = 8000
$Script:AiKeyHealthRawKeyDir = '.secret_keys\.secret_ignore'
$Script:AiKeyHealthRepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))

function Get-AiKeyHealthRows {
    param(
        [string]$RepoRoot,
        [string]$PythonExe
    )

    $startInfo = $null
    $process = $null
    $outputTask = $null
    $errorTask = $null
    $rows = @()

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $PythonExe
    $startInfo.Arguments = ('-m {0} {1}' -f $Script:AiKeyHealthModule, $Script:AiKeyHealthCommand)
    $startInfo.WorkingDirectory = $RepoRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.EnvironmentVariables['PYCORE_SKIP_DEP_CHECK'] = '1'

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $outputTask = $process.StandardOutput.ReadToEndAsync()
    $errorTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($Script:AiKeyHealthTimeoutMs)) {
        try { $process.Kill() } catch { return @() }
        return @()
    }
    if ($process.ExitCode -ne 0) { return @() }

    foreach ($line in ($outputTask.Result -split "`r?`n")) {
        $fields = @($line -split "`t")
        if ($fields.Count -ge 4) {
            $rows += [PSCustomObject]@{
                Provider  = $fields[0]
                Secret    = $fields[1]
                Status    = $fields[2]
                CheckedAt = $fields[3]
            }
        }
    }
    return $rows
}

function Write-AiKeyHealthWarning {
    param(
        [string]$RepoRoot = $Script:AiKeyHealthRepoRoot,
        [string]$PythonExe = ''
    )

    $rows = @()
    $rawKeyDir = ''
    $pythonVariable = $null

    try {
        if (-not $PythonExe) {
            $pythonVariable = Get-Variable -Name 'PYTHON_EXE_PATH' -Scope Global -ErrorAction SilentlyContinue
            if ($pythonVariable) { $PythonExe = [string]$pythonVariable.Value }
        }
        if (-not $PythonExe -or -not (Test-Path -LiteralPath $PythonExe)) { return }

        $rows = @(Get-AiKeyHealthRows -RepoRoot $RepoRoot -PythonExe $PythonExe)
        if ($rows.Count -eq 0) { return }

        $rawKeyDir = Join-Path $RepoRoot $Script:AiKeyHealthRawKeyDir
        Write-Host ''
        Write-Host '[AI KEYS] WARNING: the last probe rejected these AI provider keys (expired or invalid):' -ForegroundColor Yellow
        foreach ($row in $rows) {
            Write-Host ('  - {0}: secret {1} -> {2} (checked {3})' -f $row.Provider, $row.Secret, $row.Status, $row.CheckedAt) -ForegroundColor Yellow
        }
        Write-Host ('[AI KEYS] To fix: put the new key in {0}\<SECRET_NAME> (pycore UI Settings > AI keys, or Set-SecretKey), then restart pycore.' -f $rawKeyDir) -ForegroundColor Yellow
        Write-Host '[AI KEYS] The warning stops as soon as that key value changes.' -ForegroundColor Yellow
        Write-Host ''
    } catch {
        return
    }
}
