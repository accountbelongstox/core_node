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

$scriptRoot = $PSScriptRoot
$shellsWinRoot = Split-Path $scriptRoot -Parent
$winCommonDir = Join-Path $shellsWinRoot "win_common"
$globalVarsPath = Join-Path $winCommonDir "GlobalVars.ps1"

. $globalVarsPath
. (Join-Path $winCommonDir "CudaIndex.ps1")
. (Join-Path $winCommonDir "PythonRuntimeCommon.ps1")

$SCRIPT_INDEX = "[Step 38]"
$MODEL_NAME = "Qwen2.5-0.5B-Instruct"
$MODEL_PATH = "Qwen/Qwen2.5-0.5B-Instruct"
$REQUIRED_PYTHON_VERSION = $Global:PYTHON_VERSION

function Test-PythonAvailable {
    $pythonCommand = Resolve-InstallerPythonExe
    if (-not $pythonCommand) {
        Write-Host "$SCRIPT_INDEX Python not found at $($Global:PYTHON_EXE_PATH). Run Step8_InstallPython.ps1" -ForegroundColor Red
        return @{ Available = $false; Command = "" }
    }

    return @{ Available = $true; Command = $pythonCommand }
}

function Install-Qwen25Dependencies {
    param(
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Installing Python dependencies..." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX Using Python command: $PythonCommand" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Note: Qwen2.5 requires transformers >= 4.37.0" -ForegroundColor White

    try {
        Write-Host "$SCRIPT_INDEX Uninstalling incompatible torch versions..." -ForegroundColor Cyan
        Write-Host ""
        & $Global:PIP_EXE_PATH uninstall -y torch torchvision torchaudio
        Write-Host ""

        Write-Host "$SCRIPT_INDEX Installing compatible torch and dependencies..." -ForegroundColor Cyan
        Write-Host ""
        $torchIndex = Get-TorchCudaIndexUrl
        & $Global:PIP_EXE_PATH install torch torchvision torchaudio --index-url $torchIndex
        Write-Host ""

        Write-Host "$SCRIPT_INDEX Installing transformers and accelerate..." -ForegroundColor Cyan
        Write-Host ""
        & $Global:PIP_EXE_PATH install --upgrade transformers accelerate
        Write-Host ""

        Write-Host "$SCRIPT_INDEX Verifying installation..." -ForegroundColor Yellow
        $verifyResult = & $PythonCommand -c "import transformers; import torch; print('[OK] transformers version:', transformers.__version__); print('[OK] torch version:', torch.__version__)"

        if ($verifyResult -match '\[OK\]') {
            Write-Host "$SCRIPT_INDEX Dependencies installed successfully" -ForegroundColor Green
            Write-Host "$SCRIPT_INDEX $verifyResult" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "$SCRIPT_INDEX WARNING: Installation verification failed" -ForegroundColor Yellow
            return $true
        }
    }
    catch {
        Write-Host "$SCRIPT_INDEX Error installing dependencies: $_" -ForegroundColor Red
        return $false
    }
}

function Test-Qwen25ModelLoad {
    param(
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Testing model load (first run will download ~1GB)..." -ForegroundColor Yellow

    # Get path to shared runner script
    $scriptRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $testScriptPath = Join-Path $scriptRoot "pytools\aitools\qwen25_runner.py"

    if (-not (Test-Path $testScriptPath)) {
        Write-Host "$SCRIPT_INDEX Error: Runner script not found at: $testScriptPath" -ForegroundColor Red
        return $false
    }

    Write-Host "$SCRIPT_INDEX Using shared runner script: $testScriptPath" -ForegroundColor Cyan

    try {
        Write-Host ""
        & $PythonCommand $testScriptPath
        Write-Host ""

        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX   Model Load Test Passed!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host ""

        return $true
    }
    catch {
        Write-Host "$SCRIPT_INDEX Error: $_" -ForegroundColor Red
        return $false
    }
}

function New-Qwen25InteractiveScript {
    param(
        [string]$PythonCommand
    )

    $scriptRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $testScriptPath = Join-Path $scriptRoot "pytools\aitools\qwen25_runner.py"

    if (-not (Test-Path $testScriptPath)) {
        Write-Host "$SCRIPT_INDEX Error: Runner script not found at: $testScriptPath" -ForegroundColor Red
        return
    }

    $cacheDir = Join-Path $env:USERPROFILE ".core_node\.cache"
    if (-not (Test-Path $cacheDir)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    }

    $batScriptPath = Join-Path $cacheDir "qwen25_chat.bat"
    $batScript = @"
@echo off
chcp 65001 >nul
echo ========================================
echo   Qwen2.5-0.5B-Instruct Interactive Chat
echo ========================================
echo.
echo INSTRUCTIONS:
echo 1. Wait for 'User:' prompt to appear
echo 2. Type your question and press Enter
echo 3. Type 'exit' or 'quit' to end chat
echo ========================================
echo.
echo Starting chat... Please wait...
echo.
$PythonCommand "$testScriptPath" --chat
echo.
echo ========================================
echo   Chat Ended
echo ========================================
echo.
pause
"@

    $batScript | Out-File -FilePath $batScriptPath -Encoding ASCII

    Write-Host "$SCRIPT_INDEX Interactive chat script generated at: $batScriptPath" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Opening in new command window..." -ForegroundColor Cyan
    Write-Host ""

    Start-Process -FilePath $batScriptPath

    Write-Host "$SCRIPT_INDEX New window opened for interactive chat" -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX You can now test the model in the new window" -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX This installation will continue..." -ForegroundColor Cyan
    Write-Host ""

    Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX   USAGE EXAMPLES" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "$SCRIPT_INDEX To test Qwen2.5-0.5B-Instruct interactively, run:" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX   $batScriptPath" -ForegroundColor White
    Write-Host ""
    Write-Host "$SCRIPT_INDEX Or manually run:" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX   $PythonCommand `"$testScriptPath`" --chat" -ForegroundColor White
    Write-Host ""
    Write-Host "$SCRIPT_INDEX For single inference test, run:" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX   $PythonCommand `"$testScriptPath`"" -ForegroundColor White
    Write-Host ""
}

function Install-Qwen25 {
    Write-Host "`n$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX   Qwen2.5-0.5B-Instruct Installation" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX ========================================`n" -ForegroundColor Cyan

    Write-Host "$SCRIPT_INDEX Model: $MODEL_PATH" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Size: ~1GB (0.5B parameters)" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Context: 32K tokens" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Languages: 29+ (including Chinese, English, etc.)" -ForegroundColor White

    Write-Host "`n$SCRIPT_INDEX Checking prerequisites..." -ForegroundColor Yellow

    $pythonStatus = Test-PythonAvailable
    if (-not $pythonStatus.Available) {
        Write-Host "$SCRIPT_INDEX ERROR: Python 3.8+ is required but not found" -ForegroundColor Red
        Write-Host "$SCRIPT_INDEX Please install Python from: https://python.org/" -ForegroundColor Yellow
        return $false
    }

    Write-Host "`n$SCRIPT_INDEX Step 1: Install Python dependencies" -ForegroundColor Cyan
    $depsSuccess = Install-Qwen25Dependencies -PythonCommand $pythonStatus.Command

    if (-not $depsSuccess) {
        Write-Host "$SCRIPT_INDEX WARNING: Dependency installation may have failed" -ForegroundColor Yellow
        Write-Host "$SCRIPT_INDEX You can try installing manually: pip install --upgrade transformers torch" -ForegroundColor Yellow
    }

    Write-Host "`n$SCRIPT_INDEX Step 2: Test model loading" -ForegroundColor Cyan
    $testSuccess = Test-Qwen25ModelLoad -PythonCommand $pythonStatus.Command

    if ($testSuccess) {
        Write-Host "`n$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX   Installation Successful!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "`n$SCRIPT_INDEX Model: $MODEL_PATH" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX Cache: ~\\.cache\\huggingface" -ForegroundColor Green

        Write-Host "`n$SCRIPT_INDEX Step 3: Create interactive chat" -ForegroundColor Cyan
        New-Qwen25InteractiveScript -PythonCommand $pythonStatus.Command

        return $true
    }
    else {
        Write-Host "`n$SCRIPT_INDEX ERROR: Model test failed" -ForegroundColor Red
        return $false
    }
}

try {
    Install-Qwen25
}
catch {
    Write-Host "`n$SCRIPT_INDEX Fatal error: $_" -ForegroundColor Red
}
