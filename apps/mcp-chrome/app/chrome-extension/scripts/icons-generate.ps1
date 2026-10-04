# Runs scripts/pytools/chrome_extension_icons.py with a resolvable Python (PATH, PYTHON_EXE, common dev paths).

$ErrorActionPreference = "Stop"

$ScriptDir = $null
$ExtensionRoot = $null
$CoreNodeDir = $null
$PyTool = $null
$PythonExe = $null
$Cmd = $null
$GlobalVarsPath = $null

$ScriptDir = $PSScriptRoot
$ExtensionRoot = Split-Path -Parent $ScriptDir
$CoreNodeDir = $ExtensionRoot
for ($i = 0; $i -lt 4; $i++) {
    $CoreNodeDir = Split-Path -Parent $CoreNodeDir
}
$PyTool = Join-Path $CoreNodeDir (Join-Path "scripts" (Join-Path "pytools" "chrome_extension_icons.py"))
$PyTool = Resolve-Path -LiteralPath $PyTool
$GlobalVarsPath = Join-Path $CoreNodeDir (Join-Path "scripts" (Join-Path "shells" (Join-Path "win" (Join-Path "win_common" "GlobalVars.ps1"))))
. $GlobalVarsPath
Set-StrictMode -Off

function Test-UsablePythonPath {
    param([string]$Path)
    if (-not $Path) { return $false }
    if ($Path -match "WindowsApps") { return $false }
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    return $true
}

if ($env:PYTHON_EXE -and (Test-UsablePythonPath $env:PYTHON_EXE)) {
    $PythonExe = $env:PYTHON_EXE
}

if (-not $PythonExe) {
    $Candidate = Join-Path $Global:LANG_COMPILER_DIR (Join-Path "python311" "python.exe")
    if (Test-UsablePythonPath $Candidate) {
        $PythonExe = $Candidate
    }
}

if (-not $PythonExe) {
    $Cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($Cmd -and (Test-UsablePythonPath $Cmd.Source)) {
        $PythonExe = $Cmd.Source
    }
}

if (-not $PythonExe) {
    $Cmd = Get-Command python3 -ErrorAction SilentlyContinue
    if ($Cmd -and (Test-UsablePythonPath $Cmd.Source)) {
        $PythonExe = $Cmd.Source
    }
}

if (-not $PythonExe) {
    Write-Host "[icons] ERROR: No Python found. Set PYTHON_EXE or add python to PATH." -ForegroundColor Red
    exit 1
}

Write-Host "[icons] Using Python: $PythonExe"
Write-Host "[icons] Script: $PyTool"

& $PythonExe $PyTool @args
