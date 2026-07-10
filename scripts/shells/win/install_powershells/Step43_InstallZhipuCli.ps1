# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using Split-Path, Join-Path, or Resolve-Path.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Zhipu AI (智谱AI / bigmodel.cn) official package installation - Windows.
# NOTE: Zhipu ships NO first-party CLI binary (verified via official sources: the
# github.com/zhipuai org has only a Java SDK and a Python SDK; the PyPI `zhipuai`
# package is a Python SDK with no console entry point -- there is no `zhipu`/`glm`
# command). This step therefore installs the official `zhipuai` Python SDK (idempotent)
# so `from zhipuai import ZhipuAI` works. For a coding-agent experience on Zhipu, use
# the existing claudezhipu launcher (Claude Code pointed at Zhipu's Anthropic-compatible
# /api/anthropic endpoint) -- that is the official integration surface.
# Official sources:
#   https://github.com/zhipuai   https://open.bigmodel.cn   (PyPI: zhipuai)

$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
$shellsWinRoot = Split-Path $scriptRoot -Parent
$winCommonDir = Join-Path $shellsWinRoot "win_common"

. (Join-Path $winCommonDir "GlobalVars.ps1")
. (Join-Path $winCommonDir "CommonFunc.ps1")

$SCRIPT_INDEX = "[Step 43]"
$ZhipuPackage = "zhipuai"
$PythonCmd = $null

# Resolve python: prefer the project python, then python on PATH (mirrors Step101).
function Resolve-PythonCmd {
    $cmd = $Global:PYTHON_EXE_PATH
    if ($cmd -and (Test-Path $cmd)) { return $cmd }
    $found = Get-Command python -ErrorAction SilentlyContinue
    if ($found) { return $found.Source }
    return $null
}

Write-Host "$SCRIPT_INDEX Zhipu AI official package ($ZhipuPackage SDK) via pip" -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX NOTE: Zhipu has no first-party CLI; installing the official Python SDK." -ForegroundColor White
Write-Host "$SCRIPT_INDEX       For a Zhipu coding agent, use the claudezhipu launcher." -ForegroundColor White

$PythonCmd = Resolve-PythonCmd
if (-not $PythonCmd) {
    Write-Host "$SCRIPT_INDEX [ERROR] python not found. Run Step8_InstallPython.ps1 first." -ForegroundColor Red
    exit 1
}
Write-Host "$SCRIPT_INDEX Using python: $PythonCmd" -ForegroundColor White

# Idempotent: skip if the zhipuai SDK is already importable.
$importCheck = & $PythonCmd -c "import zhipuai" 2>$null
if ($LASTEXITCODE -eq 0) {
    $ver = & $PythonCmd -c "import zhipuai; print(getattr(zhipuai, '__version__', 'unknown'))" 2>$null
    Write-Host "$SCRIPT_INDEX [SKIP] $ZhipuPackage SDK already installed ($ver)." -ForegroundColor Green
    exit 0
}

Write-Host "$SCRIPT_INDEX Installing $ZhipuPackage (pip, --upgrade)..." -ForegroundColor Yellow
& $PythonCmd -m pip install --upgrade $ZhipuPackage
if ($LASTEXITCODE -ne 0) {
    Write-Host "$SCRIPT_INDEX [ERROR] pip install failed for $ZhipuPackage." -ForegroundColor Red
    exit 1
}

# Verify: the SDK must now import.
$importCheck = & $PythonCmd -c "import zhipuai" 2>$null
if ($LASTEXITCODE -eq 0) {
    $ver = & $PythonCmd -c "import zhipuai; print(getattr(zhipuai, '__version__', 'unknown'))" 2>$null
    Write-Host "$SCRIPT_INDEX [OK] $ZhipuPackage SDK ready: $ver" -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [ERROR] $ZhipuPackage import failed after install." -ForegroundColor Red
    exit 1
}
exit 0
