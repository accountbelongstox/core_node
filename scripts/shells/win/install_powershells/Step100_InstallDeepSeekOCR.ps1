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

$SCRIPT_INDEX = "[Step96]"
$MODEL_NAME = "DeepSeek-OCR"
$REPO_URL = "https://github.com/deepseek-ai/DeepSeek-OCR.git"
$MODEL_PATH = "deepseek-ai/DeepSeek-OCR"
$REQUIRED_PYTHON_VERSION = "3.12"
$VLLM_VERSION = "0.8.5"

function Get-BaseDirectory {
    $baseDir = ""

    $possiblePaths = @(
        "D:\programing",
        "E:\programing",
        "C:\programing"
    )

    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $baseDir = $path
            break
        }
    }

    if (-not $baseDir) {
        $baseDir = Join-Path $env:USERPROFILE "programing"
    }

    return $baseDir
}

function Get-DeepSeekOCRStatus {
    $baseDir = Get-BaseDirectory
    $installDir = Join-Path $baseDir $MODEL_NAME

    $status = @{
        Platform = $env:OS
        BaseDirectory = $baseDir
        InstallDirectory = $installDir
        IsInstalled = $false
        IsValid = $false
        FileCount = 0
        ModelPath = $MODEL_PATH
    }

    if (Test-Path $installDir) {
        $status.IsInstalled = $true

        $gitDir = Join-Path $installDir ".git"

        if (Test-Path $gitDir) {
            $files = Get-ChildItem -Path $installDir -File -Recurse -ErrorAction SilentlyContinue
            $status.FileCount = $files.Count

            if ($status.FileCount -gt 10) {
                $status.IsValid = $true
            }
        }
    }

    return $status
}

function Test-GitAvailable {
    $gitExePath = $Global:GIT_EXE_PATH
    if (Test-Path $gitExePath) {
        & $gitExePath --version
        return $true
    } else {
        Write-Host "$SCRIPT_INDEX Git not found at $gitExePath" -ForegroundColor Red
        return $false
    }
}

function Test-PythonAvailable {
    $pythonCommand = ""

    $commands = @("python", "python3")
    foreach ($cmd in $commands) {
        try {
            $version = & $cmd --version 2>&1
            if ($version -match "Python (\d+)\.(\d+)") {
                $major = [int]$matches[1]
                $minor = [int]$matches[2]

                if ($major -eq 3 -and $minor -ge 12) {
                    $pythonCommand = $cmd
                    Write-Host "$SCRIPT_INDEX Python is available: $version" -ForegroundColor Green
                    Write-Host "$SCRIPT_INDEX Python version is sufficient (3.12+)" -ForegroundColor Green
                    break
                }
                elseif ($major -eq 3 -and $minor -ge 8) {
                    Write-Host "$SCRIPT_INDEX WARNING: Python $major.$minor found, but 3.12+ is recommended" -ForegroundColor Yellow
                    $pythonCommand = $cmd
                    break
                }
            }
        }
        catch {
            continue
        }
    }

    if (-not $pythonCommand) {
        Write-Host "$SCRIPT_INDEX Python 3.12+ is required but not found" -ForegroundColor Red
        Write-Host "$SCRIPT_INDEX Please install Python from: https://python.org/" -ForegroundColor Yellow
        return @{ Available = $false; Command = "" }
    }

    return @{ Available = $true; Command = $pythonCommand }
}

function Install-DeepSeekOCRRepository {
    param(
        [string]$TargetDirectory
    )

    Write-Host "$SCRIPT_INDEX Cloning DeepSeek-OCR repository..." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX Repository: $REPO_URL" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Target: $TargetDirectory" -ForegroundColor White

    $parentDir = Split-Path -Parent $TargetDirectory
    if (-not (Test-Path $parentDir)) {
        Write-Host "$SCRIPT_INDEX Creating parent directory: $parentDir" -ForegroundColor White
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    if (Test-Path $TargetDirectory) {
        Write-Host "$SCRIPT_INDEX WARNING: Directory already exists: $TargetDirectory" -ForegroundColor Yellow
        return $false
    }

    try {
        $gitExePath = $Global:GIT_EXE_PATH
        & $gitExePath clone $REPO_URL $TargetDirectory

        $gitDir = Join-Path $TargetDirectory ".git"
        if (Test-Path $gitDir) {
            Write-Host "$SCRIPT_INDEX Repository cloned successfully" -ForegroundColor Green
            Write-Host "$SCRIPT_INDEX Verification: .git directory found" -ForegroundColor Green

            $files = Get-ChildItem -Path $TargetDirectory -File -Recurse -ErrorAction SilentlyContinue
            Write-Host "$SCRIPT_INDEX Verification: $($files.Count) files found" -ForegroundColor Green

            if ($files.Count -gt 10) {
                return $true
            }
        }

        Write-Host "$SCRIPT_INDEX Git clone failed" -ForegroundColor Red
        return $false
    }
    catch {
        Write-Host "$SCRIPT_INDEX Error cloning repository: $_" -ForegroundColor Red
        return $false
    }
}

function Install-DeepSeekOCRDependencies {
    param(
        [string]$InstallDirectory,
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Installing Python dependencies..." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX Using Python command: $PythonCommand" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Note: DeepSeek-OCR requires cuda11.8+torch2.6.0" -ForegroundColor White

    try {
        Push-Location $InstallDirectory

        Write-Host "$SCRIPT_INDEX Step 1: Installing PyTorch 2.6.0 with CUDA 11.8..." -ForegroundColor Cyan
        Write-Host ""
        & $PythonCommand -m pip install torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu118
        Write-Host ""

        Write-Host "$SCRIPT_INDEX Step 2: Installing core dependencies..." -ForegroundColor Cyan
        Write-Host ""
        & $PythonCommand -m pip install transformers accelerate pillow einops timm sentencepiece protobuf
        Write-Host ""

        Write-Host "$SCRIPT_INDEX Step 3: Installing flash-attn 2.7.3..." -ForegroundColor Cyan
        Write-Host ""
        & $PythonCommand -m pip install flash-attn==2.7.3 --no-build-isolation
        Write-Host ""

        Pop-Location

        Write-Host "$SCRIPT_INDEX Verifying installation..." -ForegroundColor Yellow
        $verifyResult = & $PythonCommand -c "import torch; print('[OK] torch version:', torch.__version__)" 2>&1

        if ($verifyResult -match '\[OK\]') {
            Write-Host "$SCRIPT_INDEX Dependencies installed successfully" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "$SCRIPT_INDEX WARNING: Installation verification failed" -ForegroundColor Yellow
            Write-Host "$SCRIPT_INDEX You may need to install dependencies manually" -ForegroundColor Yellow
            return $true
        }
    }
    catch {
        Pop-Location
        Write-Host "$SCRIPT_INDEX Error installing dependencies: $_" -ForegroundColor Red
        return $false
    }
}

function Test-DeepSeekOCRModelLoad {
    param(
        [string]$InstallDirectory,
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Testing model load (first run may download model)..." -ForegroundColor Yellow

    $modelTestScript = @"
import os
os.environ['HF_HOME'] = os.path.join(os.path.dirname(__file__), '.cache')
os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = '3600'

print('[TEST] Loading DeepSeek-OCR model...')
from transformers import AutoModel, AutoTokenizer
import torch

model_name = '$MODEL_PATH'
print(f'[INFO] Model path: {model_name}')
print('[INFO] Note: First run will download model from HuggingFace')
print('[INFO] Download timeout: 3600s (1 hour)')

tokenizer = AutoTokenizer.from_pretrained(
    model_name,
    trust_remote_code=True,
    resume_download=True
)
print('[OK] Tokenizer loaded successfully')

print('[TEST] Loading model (this may take a while)...')
model = AutoModel.from_pretrained(
    model_name,
    _attn_implementation='flash_attention_2',
    trust_remote_code=True,
    use_safetensors=True,
    resume_download=True
)
print('[OK] Model loaded successfully')

print('[TEST] Moving model to GPU...')
model = model.eval().cuda().to(torch.bfloat16)
print('[OK] Model moved to GPU')

print('')
print('[SUCCESS] ========================================')
print('[SUCCESS]   DeepSeek-OCR is ready!')
print('[SUCCESS] ========================================')
"@

    $modelTestPath = Join-Path $InstallDirectory "test_model_load.py"
    $modelTestScript | Out-File -FilePath $modelTestPath -Encoding UTF8

    try {
        Push-Location $InstallDirectory

        Write-Host ""
        & $PythonCommand $modelTestPath
        Write-Host ""

        Pop-Location

        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX   Model Load Test Passed!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host ""

        return $true
    }
    catch {
        Pop-Location
        Write-Host "$SCRIPT_INDEX Error: $_" -ForegroundColor Red
        return $false
    }
    finally {
        if (Test-Path $modelTestPath) {
            Remove-Item $modelTestPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Test-DeepSeekOCRInstallation {
    param(
        [string]$InstallDirectory,
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Running model load test..." -ForegroundColor Yellow
    Test-DeepSeekOCRModelLoad -InstallDirectory $InstallDirectory -PythonCommand $PythonCommand

    Write-Host ""
    Write-Host "$SCRIPT_INDEX DeepSeek-OCR is ready to use!" -ForegroundColor Green
    Write-Host ""

    $cacheDir = Join-Path $env:USERPROFILE ".core_node\.cache"
    if (-not (Test-Path $cacheDir)) {
        New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
    }

    $batScriptPath = Join-Path $cacheDir "deepseek_ocr_usage.bat"
    $batScript = @"
@echo off
chcp 65001 >nul
echo ========================================
echo   DeepSeek-OCR Usage Guide
echo ========================================
echo.
echo This script shows you how to use DeepSeek-OCR
echo.
echo Press any key to see usage examples...
pause >nul
echo.
echo ========================================
echo   USAGE EXAMPLES
echo ========================================
echo.
echo 1. HuggingFace Transformers (Basic):
echo    cd /d "$InstallDirectory\DeepSeek-OCR-master\DeepSeek-OCR-hf"
echo    python run_dpsk_ocr.py
echo.
echo 2. vLLM (Better Performance):
echo    cd /d "$InstallDirectory\DeepSeek-OCR-master\DeepSeek-OCR-vllm"
echo    python run_dpsk_ocr_image.py
echo.
echo ========================================
echo   SUPPORTED MODES
echo ========================================
echo.
echo - Native resolution: 512x512, 640x640, 1024x1024, 1280x1280
echo - Dynamic resolution: Gundam mode
echo - OCR, Document to Markdown, Figure parsing
echo.
echo ========================================
echo.
echo For more information, check the README in:
echo $InstallDirectory
echo.
pause
"@

    $batScript | Out-File -FilePath $batScriptPath -Encoding ASCII

    Write-Host "$SCRIPT_INDEX Usage guide script generated at: $batScriptPath" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Opening usage guide..." -ForegroundColor Cyan
    Write-Host ""

    Start-Process -FilePath $batScriptPath

    Write-Host "$SCRIPT_INDEX Usage guide opened in new window" -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX You can refer to it for usage examples" -ForegroundColor Green
    Write-Host ""

    Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX   USAGE EXAMPLES" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "$SCRIPT_INDEX 1. HuggingFace Transformers (Basic):" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX    cd /d `"$InstallDirectory\DeepSeek-OCR-master\DeepSeek-OCR-hf`"" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX    python run_dpsk_ocr.py" -ForegroundColor White
    Write-Host ""
    Write-Host "$SCRIPT_INDEX 2. vLLM (Better Performance):" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX    cd /d `"$InstallDirectory\DeepSeek-OCR-master\DeepSeek-OCR-vllm`"" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX    python run_dpsk_ocr_image.py" -ForegroundColor White
    Write-Host ""
    Write-Host "$SCRIPT_INDEX For more information, check: $InstallDirectory" -ForegroundColor White
    Write-Host ""

    return $true
}

function Install-DeepSeekOCR {
    Write-Host "`n$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX   DeepSeek-OCR Installation" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX ========================================`n" -ForegroundColor Cyan

    $status = Get-DeepSeekOCRStatus

    Write-Host "$SCRIPT_INDEX Platform: $($status.Platform)" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Base Directory: $($status.BaseDirectory)" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Install Directory: $($status.InstallDirectory)" -ForegroundColor White

    Write-Host "`n$SCRIPT_INDEX Checking prerequisites..." -ForegroundColor Yellow

    if (-not (Test-GitAvailable)) {
        Write-Host "$SCRIPT_INDEX ERROR: Git is required but not found" -ForegroundColor Red
        Write-Host "$SCRIPT_INDEX Please install Git from: https://git-scm.com/" -ForegroundColor Yellow
        return $false
    }

    $pythonStatus = Test-PythonAvailable
    if (-not $pythonStatus.Available) {
        Write-Host "$SCRIPT_INDEX ERROR: Python 3.12+ is required but not found" -ForegroundColor Red
        Write-Host "$SCRIPT_INDEX Please install Python from: https://python.org/" -ForegroundColor Yellow
        return $false
    }

    if ($status.IsInstalled -and $status.IsValid) {
        Write-Host "`n$SCRIPT_INDEX DeepSeek-OCR repository already exists" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX Installation directory: $($status.InstallDirectory)" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX File count: $($status.FileCount)" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX Skipping repository clone, will reinstall dependencies..." -ForegroundColor Yellow
    }
    else {
        Write-Host "`n$SCRIPT_INDEX Step 1: Clone DeepSeek-OCR repository" -ForegroundColor Cyan
        $cloneSuccess = Install-DeepSeekOCRRepository -TargetDirectory $status.InstallDirectory

        if (-not $cloneSuccess) {
            Write-Host "$SCRIPT_INDEX ERROR: Failed to clone repository" -ForegroundColor Red
            return $false
        }
    }

    Write-Host "`n$SCRIPT_INDEX Step 2: Install Python dependencies" -ForegroundColor Cyan
    $depsSuccess = Install-DeepSeekOCRDependencies -InstallDirectory $status.InstallDirectory -PythonCommand $pythonStatus.Command

    if (-not $depsSuccess) {
        Write-Host "$SCRIPT_INDEX WARNING: Dependency installation may have failed" -ForegroundColor Yellow
        Write-Host "$SCRIPT_INDEX You can try installing dependencies manually later" -ForegroundColor Yellow
    }

    Write-Host "`n$SCRIPT_INDEX Step 3: Verify installation" -ForegroundColor Cyan
    $finalStatus = Get-DeepSeekOCRStatus

    if ($finalStatus.IsInstalled -and $finalStatus.IsValid) {
        Write-Host "`n$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX   Installation Successful!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "`n$SCRIPT_INDEX Model location: $($finalStatus.InstallDirectory)" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX File count: $($finalStatus.FileCount)" -ForegroundColor Green
        Write-Host "`n$SCRIPT_INDEX Next steps:" -ForegroundColor Yellow
        Write-Host "$SCRIPT_INDEX 1. Use in Node.js with environment variable:" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX    `$env:DEEPSEEK_OCR_DIR=`"$($finalStatus.InstallDirectory)`"" -ForegroundColor White
        Write-Host "`n$SCRIPT_INDEX 2. Usage examples:" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX    cd $($finalStatus.InstallDirectory)/DeepSeek-OCR-master/DeepSeek-OCR-hf" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX    python run_dpsk_ocr.py" -ForegroundColor White

        Write-Host "`n$SCRIPT_INDEX Step 4: Testing installation" -ForegroundColor Cyan
        Test-DeepSeekOCRInstallation -InstallDirectory $finalStatus.InstallDirectory -PythonCommand $pythonStatus.Command

        return $true
    }
    else {
        Write-Host "`n$SCRIPT_INDEX ERROR: Installation verification failed" -ForegroundColor Red
        return $false
    }
}

try {
    $result = Install-DeepSeekOCR
    if ($result) {
        Write-Host "`n$SCRIPT_INDEX Installation completed successfully!" -ForegroundColor Green
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
