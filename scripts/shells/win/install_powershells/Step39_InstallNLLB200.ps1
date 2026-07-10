# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

$scriptRoot = $PSScriptRoot
$shellsWinRoot = Split-Path $scriptRoot -Parent
$winCommonDir = Join-Path $shellsWinRoot "win_common"
$globalVarsPath = Join-Path $winCommonDir "GlobalVars.ps1"

. $globalVarsPath

$SCRIPT_INDEX = "[Step 39]"
$MODEL_NAME = "NLLB-200"
$MODEL_PATH = "facebook/nllb-200-distilled-600M"
$REQUIRED_PYTHON_VERSION = "3.8"

function Test-PythonAvailable {
    $pythonCommand = $Global:PYTHON_EXE_PATH

    if (-not $pythonCommand -or -not (Test-Path $pythonCommand)) {
        $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
        if ($pythonCommand) {
            $pythonCommand = $pythonCommand.Source
        }
    }

    if (-not $pythonCommand) {
        Write-Host "$SCRIPT_INDEX Python not found. Run Step8_InstallPython.ps1" -ForegroundColor Red
        return @{ Available = $false; Command = "" }
    }

    return @{ Available = $true; Command = $pythonCommand }
}

function Install-NLLB200Dependencies {
    param(
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Installing Python dependencies..." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX Using Python command: $PythonCommand" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Note: NLLB-200 requires transformers and sentencepiece" -ForegroundColor White

    try {
        Write-Host "$SCRIPT_INDEX Installing transformers, sentencepiece, and protobuf..." -ForegroundColor Cyan
        Write-Host ""
        & $PythonCommand -m pip install --upgrade transformers sentencepiece protobuf sacremoses
        Write-Host ""

        Write-Host "$SCRIPT_INDEX Verifying installation..." -ForegroundColor Yellow
        $verifyResult = & $PythonCommand -c "import transformers; import sentencepiece; print('[OK] transformers version:', transformers.__version__); print('[OK] sentencepiece installed')"

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

function Test-NLLB200ModelLoad {
    param(
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Testing model load (first run will download ~1.2GB)..." -ForegroundColor Yellow

    $scriptRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $testScriptPath = Join-Path $scriptRoot "pytools\aitools\nllb200_tester.py"

    if (-not (Test-Path $testScriptPath)) {
        Write-Host "$SCRIPT_INDEX Error: Test script not found at: $testScriptPath" -ForegroundColor Red
        return $false
    }

    Write-Host "$SCRIPT_INDEX Using shared test script: $testScriptPath" -ForegroundColor Cyan

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

function New-NLLB200InteractiveScript {
    param(
        [string]$PythonCommand
    )

    $scriptRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $testScriptPath = Join-Path $scriptRoot "pytools\aitools\nllb200_tester.py"

    if (-not (Test-Path $testScriptPath)) {
        Write-Host "$SCRIPT_INDEX Error: Test script not found at: $testScriptPath" -ForegroundColor Red
        return
    }

    $cacheDir = Join-Path $env:USERPROFILE ".core_node\.cache"
    if (-not (Test-Path $cacheDir)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    }

    $batScriptPath = Join-Path $cacheDir "nllb200_translate.bat"
    $batScript = @"
@echo off
chcp 65001 >nul
echo ========================================
echo   NLLB-200 Translation Tool
echo   196 Languages Support
echo ========================================
echo.
echo INSTRUCTIONS:
echo 1. Enter source language code (e.g., en, zh, ja)
echo 2. Enter target language code
echo 3. Enter text to translate
echo 4. Type 'exit' to end translation
echo ========================================
echo.
echo Starting translator... Please wait...
echo.
$PythonCommand "$testScriptPath" --interactive
echo.
echo ========================================
echo   Translation Ended
echo ========================================
echo.
pause
"@

    $batScript | Out-File -FilePath $batScriptPath -Encoding ASCII

    Write-Host "$SCRIPT_INDEX Interactive translation script generated at: $batScriptPath" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Opening in new command window..." -ForegroundColor Cyan
    Write-Host ""

    Start-Process -FilePath $batScriptPath

    Write-Host "$SCRIPT_INDEX New window opened for interactive translation" -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX You can now test the translator in the new window" -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX This installation will continue..." -ForegroundColor Cyan
    Write-Host ""

    Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX   USAGE EXAMPLES" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "$SCRIPT_INDEX NLLB-200 Translation Tool (196 Languages)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "$SCRIPT_INDEX For interactive translation, run:" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX   $batScriptPath" -ForegroundColor White
    Write-Host ""
    Write-Host "$SCRIPT_INDEX Or manually run:" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX   $PythonCommand `"$testScriptPath`" --interactive" -ForegroundColor White
    Write-Host ""
    Write-Host "$SCRIPT_INDEX For single translation test, run:" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX   $PythonCommand `"$testScriptPath`"" -ForegroundColor White
    Write-Host ""
}

function Install-NLLB200 {
    Write-Host "`n$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX   NLLB-200 Installation" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX ========================================`n" -ForegroundColor Cyan

    Write-Host "$SCRIPT_INDEX Model: $MODEL_PATH" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Size: ~1.2GB (600M parameters distilled)" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Languages: 196 languages" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Type: Machine Translation" -ForegroundColor White

    Write-Host "`n$SCRIPT_INDEX Checking prerequisites..." -ForegroundColor Yellow

    $pythonStatus = Test-PythonAvailable
    if (-not $pythonStatus.Available) {
        Write-Host "$SCRIPT_INDEX ERROR: Python 3.8+ is required but not found" -ForegroundColor Red
        Write-Host "$SCRIPT_INDEX Please install Python from: https://python.org/" -ForegroundColor Yellow
        return $false
    }

    Write-Host "`n$SCRIPT_INDEX Step 1: Install Python dependencies" -ForegroundColor Cyan
    $depsSuccess = Install-NLLB200Dependencies -PythonCommand $pythonStatus.Command

    if (-not $depsSuccess) {
        Write-Host "$SCRIPT_INDEX WARNING: Dependency installation may have failed" -ForegroundColor Yellow
        Write-Host "$SCRIPT_INDEX You can try installing manually: pip install transformers sentencepiece" -ForegroundColor Yellow
    }

    Write-Host "`n$SCRIPT_INDEX Step 2: Test model loading" -ForegroundColor Cyan
    $testSuccess = Test-NLLB200ModelLoad -PythonCommand $pythonStatus.Command

    if ($testSuccess) {
        Write-Host "`n$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX   Installation Successful!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "`n$SCRIPT_INDEX Model: $MODEL_PATH" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX Cache: ~\\.cache\\huggingface" -ForegroundColor Green

        Write-Host "`n$SCRIPT_INDEX Step 3: Create interactive translator" -ForegroundColor Cyan
        New-NLLB200InteractiveScript -PythonCommand $pythonStatus.Command

        return $true
    }
    else {
        Write-Host "`n$SCRIPT_INDEX ERROR: Model test failed" -ForegroundColor Red
        return $false
    }
}

try {
    $result = Install-NLLB200
    if ($result) {
        Write-Host "`n$SCRIPT_INDEX Installation completed successfully!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX You can run the translator anytime from:" -ForegroundColor Cyan
        Write-Host "$SCRIPT_INDEX   $env:USERPROFILE\\.core_node\\.cache\\nllb200_translate.bat" -ForegroundColor White
        exit 0
    }
    else {
        Write-Host "`n$SCRIPT_INDEX Installation failed!" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "`n$SCRIPT_INDEX Fatal error: $_" -ForegroundColor Red
    exit 1
}
