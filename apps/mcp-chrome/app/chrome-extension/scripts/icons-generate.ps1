# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Runs scripts/pytools/chrome_extension_icons.py with a resolvable Python (PATH, PYTHON_EXE, common dev paths).

$ErrorActionPreference = "Stop"

$ScriptDir = $null
$ExtensionRoot = $null
$CoreNodeDir = $null
$PyTool = $null
$PythonExe = $null
$Cmd = $null

$ScriptDir = $PSScriptRoot
$ExtensionRoot = Split-Path -Parent $ScriptDir
$CoreNodeDir = $ExtensionRoot
for ($i = 0; $i -lt 4; $i++) {
    $CoreNodeDir = Split-Path -Parent $CoreNodeDir
}
$PyTool = Join-Path $CoreNodeDir (Join-Path "scripts" (Join-Path "pytools" "chrome_extension_icons.py"))
$PyTool = Resolve-Path -LiteralPath $PyTool

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
    $Candidate = "D:\.dev_win10\python311\python.exe"
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
