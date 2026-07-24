# Central TTS compatibility, dependency-plan, and policy-stamp helpers.

$script:TtsPolicyRepoRoot = Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent
$script:TtsPolicyPythonFile = Join-Path $script:TtsPolicyRepoRoot 'pycore\pyfoundations\ai_runtime_policy.py'

function Get-TtsPolicyPythonVersion {
    param([Parameter(Mandatory = $true)][string]$PythonExe)
    $text = Get-PythonVersionTextFromExe -PythonExe $PythonExe
    $parts = @()
    if ($text -and $text.StartsWith('Python ', [System.StringComparison]::OrdinalIgnoreCase)) {
        $parts = $text.Substring(7).Split('.')
        if ($parts.Length -ge 2) { return "$($parts[0]).$($parts[1])" }
    }
    return ''
}

function Invoke-TtsPolicyCommand {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    if (-not (Test-Path -LiteralPath $PythonExe)) { return '' }
    if (-not (Test-Path -LiteralPath $script:TtsPolicyPythonFile)) { return '' }
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = (& $PythonExe $script:TtsPolicyPythonFile @Arguments 2>$null) -join ''
    $ErrorActionPreference = $previous
    return ([string]$output).Trim()
}

function Get-TtsEngineInstallPolicy {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Engine
    )
    $json = Invoke-TtsPolicyCommand -PythonExe $PythonExe -Arguments @('engine-spec', $Engine)
    if (-not $json) { return $null }
    try { return $json | ConvertFrom-Json } catch { return $null }
}

function Test-TtsEngineCompatible {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Engine,
        [string]$Prefix = ''
    )
    $version = Get-TtsPolicyPythonVersion -PythonExe $PythonExe
    if (-not $version) {
        Write-Host ("{0}[skip] {1}: Python version unavailable." -f $Prefix, $Engine) -ForegroundColor DarkYellow
        return $false
    }
    $json = Invoke-TtsPolicyCommand -PythonExe $PythonExe -Arguments @('compatibility', $Engine, '--python-version', $version)
    if (-not $json) { return $true }
    try { $result = $json | ConvertFrom-Json } catch { return $true }
    if ($result.compatible) { return $true }
    if ($result.isolated) {
        $overrideName = "{0}_PYTHON" -f $Engine.ToUpperInvariant()
        $overrideItem = Get-Item -LiteralPath "Env:$overrideName" -ErrorAction SilentlyContinue
        $overridePython = if ($overrideItem) { [string]$overrideItem.Value } else { '' }
        if ($overridePython -and (Test-Path -LiteralPath $overridePython)) {
            $overrideVersion = Get-TtsPolicyPythonVersion -PythonExe $overridePython
            $overrideJson = Invoke-TtsPolicyCommand -PythonExe $PythonExe -Arguments @('compatibility', $Engine, '--python-version', $overrideVersion)
            try { $overrideResult = $overrideJson | ConvertFrom-Json } catch { $overrideResult = $null }
            if ($overrideResult -and $overrideResult.compatible) { return $true }
        }
    }
    $hint = if ($result.isolated) { " Use $($Engine.ToUpperInvariant())_PYTHON with a compatible isolated interpreter." } else { ' No compatible shared-runtime install is attempted.' }
    Write-Host ("{0}[skip] {1}: {2}.{3}" -f $Prefix, $Engine, $result.reason, $hint) -ForegroundColor DarkYellow
    return $false
}

function Get-TtsDependencyFingerprint {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Engine
    )
    return Invoke-TtsPolicyCommand -PythonExe $PythonExe -Arguments @('fingerprint', $Engine)
}

function Test-TtsEngineHealth {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Engine
    )
    $output = ''
    $previous = $ErrorActionPreference
    if (-not (Test-Path -LiteralPath $PythonExe) -or -not (Test-Path -LiteralPath $script:TtsPolicyPythonFile)) {
        return $false
    }
    $ErrorActionPreference = 'Continue'
    $output = (& $PythonExe $script:TtsPolicyPythonFile health-probe $Engine 2>$null) -join ''
    $ErrorActionPreference = $previous
    return ($output -match '__HEALTH_READY__')
}

function Test-TtsDependencyStamp {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Engine,
        [Parameter(Mandatory = $true)][string]$Path
    )
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $expected = Get-TtsDependencyFingerprint -PythonExe $PythonExe -Engine $Engine
    if (-not $expected) { return $false }
    $actual = (Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue)
    return ([string]$actual).Trim().Trim([char]0xFEFF) -eq $expected
}

function Test-TtsDependenciesReady {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Engine,
        [Parameter(Mandatory = $true)][string]$Path
    )
    return (Test-TtsDependencyStamp -PythonExe $PythonExe -Engine $Engine -Path $Path) -and
        (Test-TtsEngineHealth -PythonExe $PythonExe -Engine $Engine)
}

function Set-TtsDependencyStamp {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Engine,
        [Parameter(Mandatory = $true)][string]$Path
    )
    $fingerprint = Get-TtsDependencyFingerprint -PythonExe $PythonExe -Engine $Engine
    if (-not $fingerprint) { return $false }
    $parent = Split-Path $Path -Parent
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Set-Content -LiteralPath $Path -Value $fingerprint -Encoding utf8
    return $true
}
