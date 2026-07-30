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

# Python prerequisite packages installer (Windows).
#
# Runs immediately AFTER Step8_InstallPython.ps1 (pip confirmed) and
# Step9_InstallCudaNvidiaPrereq.ps1 (CUDA/driver when GPU present).
# Installs everything pyservice's third_party.py and prepare.ps1 pip steps need:
#   - torch + torchvision + torchaudio + ultralytics (YOLO) — driver-matched index
#   - paddlepaddle (CPU or GPU) + paddleocr + paddlex
#   - shared backend deps (fastapi, opencv, numpy, …) + Windows-only pyautogui/mss
#   - pycore DEPENDENCY_MAP + WinRT OCR + document-parsing extras (absl, PyQt5, …)
# TTS/STT heavy stacks (faster-whisper, edge-tts, sherpa-onnx, MeloTTS opt-in) → Step11-13.
#
# GPU/CPU: TorchCpuGuard.ps1 and PaddleCpuGuard.ps1 auto-select the correct wheel
# index from nvidia-smi; CPU-only hosts never pull CUDA/nvidia-* stacks.
# Idempotent: each bundle skips when pip metadata already exists.
# Mirrors linux/debian/install_shells/14_install_python_prereq_packages.sh.

[CmdletBinding()]
param(
    [string]$Python = '',
    [switch]$Force
)

$stepErrorActionPreference = 'Continue'
$scriptRoot = $PSScriptRoot
$shellsWinRoot = $null
$winCommonDir = $null
$preferredPython = $null
$SCRIPT_INDEX = '[Step 10]'
if (-not $scriptRoot) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
$shellsWinRoot = Split-Path $scriptRoot -Parent
$winCommonDir = Join-Path $shellsWinRoot "win_common"

. (Join-Path $winCommonDir "GlobalVars.ps1")
Set-Variable -Name 'PycoreGlobalVarsLoaded' -Scope Script -Value $true
. (Join-Path $winCommonDir "CommonFunc.ps1")
. (Join-Path $winCommonDir "PythonPrereqInstallCommon.ps1")

$ErrorActionPreference = $stepErrorActionPreference

Write-Host "$SCRIPT_INDEX ============================================================" -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX Install python prerequisite packages (captcha/AI backends)" -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX ============================================================" -ForegroundColor Cyan

$preferredPython = if ($Python) { $Python } else { $Global:PYTHON_EXE_PATH }
if (-not ($preferredPython -and (Test-Path $preferredPython))) {
    $preferredPython = $null
}

Invoke-PythonPrereqInstall -PreferredPythonPath $preferredPython -LogPrefix $SCRIPT_INDEX
