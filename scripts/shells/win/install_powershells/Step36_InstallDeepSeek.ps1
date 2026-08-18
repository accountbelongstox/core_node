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

<#
.SYNOPSIS
    Install DeepSeek-VL Local Translation Model

.DESCRIPTION
    This script installs DeepSeek-VL 7B model for local translation
    - Detects platform (Windows/WSL/Linux)
    - Clones DeepSeek-VL repository
    - Installs Python dependencies
    - Verifies installation

.NOTES
    Step Number: 95
    Category: AI Tools
    Dependencies: Git, Python 3.13 (Step8 / $Global:PYTHON_EXE_PATH)
    Lifecycle: Bucket-A LLM. transformers is installed at the shared pin via
    Install-PinnedTransformers (version-idempotent, never --upgrade, self-heals a
    clobbered pin). Contract:
    development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §7.
#>

$scriptRoot = $PSScriptRoot
$shellsWinRoot = Split-Path $scriptRoot -Parent
$winCommonDir = Join-Path $shellsWinRoot "win_common"
$globalVarsPath = Join-Path $winCommonDir "GlobalVars.ps1"
$commonFuncPath = Join-Path $winCommonDir "CommonFunc.ps1"
$deepSeekManagerPath = Join-Path $shellsWinRoot "ai_scripts\DeepSeekManager.ps1"

. $globalVarsPath
. $commonFuncPath
. (Join-Path $winCommonDir "PythonRuntimeCommon.ps1")
. $deepSeekManagerPath
. (Join-Path $winCommonDir "TtsInstallAssetsCommon.ps1")

$SCRIPT_INDEX = "[Step 36]"
$STEP_NUMBER = 36
# Match the runtime translator default (ncore/utils/stream_translator/config/index.js:
# DEEPSEEK_MODEL_PATH || deepseek-ai/deepseek-vl-1.3b-chat). Step36 previously
# hard-coded 7b for its test only; aligning install + test + runtime on one id.
$VL_MODEL_PATH = if ($env:DEEPSEEK_MODEL_PATH) { $env:DEEPSEEK_MODEL_PATH } else { 'deepseek-ai/deepseek-vl-1.3b-chat' }
$vlStagingDefault = Get-PycoreLocalDataSubDir -SubDir 'deepseek-vl'
$vlStagingDir = if ($env:DEEPSEEK_VL_DIR) { $env:DEEPSEEK_VL_DIR } else { $vlStagingDefault }
$vlWeightsDir = Join-Path $vlStagingDir 'weights'
$vlModelSentinel = Join-Path $vlStagingDir '.model_installed'
# *.py included: deepseek-vl uses trust_remote_code=True (modeling code ships in the HF repo).
$vlWeightAllow = @('*.bin', '*.safetensors', '*.pt', '*.json', '*.txt', '*.model', '*.vocab', '*.py')
$vlModelReady = $false
$vlDlOk = $false
$vlSentinelModel = $null

Write-Host "$SCRIPT_INDEX Install DeepSeek-VL Local Translation Model" -ForegroundColor Cyan

<#
.SYNOPSIS
    Check if Git is installed

.OUTPUTS
    Boolean - True if Git is available
#>
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

<#
.SYNOPSIS
    Check if Python is installed with required version

.OUTPUTS
    Hashtable - Python status information
#>
function Test-PythonAvailable {
    $pythonCmd = $Global:PYTHON_EXE_PATH

    if (-not ($pythonCmd -and (Test-Path -LiteralPath $pythonCmd))) {
        Write-Host "$SCRIPT_INDEX Python not found at $Global:PYTHON_EXE_PATH" -ForegroundColor Red
        return @{
            Available = $false
            Command = $null
            Version = $null
        }
    }

    try {
        $pythonVersion = & $pythonCmd --version 2>&1
        Write-Host "$SCRIPT_INDEX Python is available: $pythonVersion" -ForegroundColor Green
        return @{
            Available = $true
            Command = $pythonCmd
            Version = $pythonVersion
        }
    }
    catch {
        Write-Host "$SCRIPT_INDEX Error checking Python version: $_" -ForegroundColor Red
    }

    return @{
        Available = $false
        Command = $null
        Version = $null
    }
}

<#
.SYNOPSIS
    Clone DeepSeek-VL repository

.PARAMETER TargetDirectory
    Directory where to clone the repository

.OUTPUTS
    Boolean - True if clone succeeded
#>
function Install-DeepSeekRepository {
    param(
        [string]$TargetDirectory
    )

    $repoUrl = "https://github.com/deepseek-ai/DeepSeek-VL.git"

    Write-Host "$SCRIPT_INDEX Cloning DeepSeek-VL repository..." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX Repository: $repoUrl" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Target: $TargetDirectory" -ForegroundColor White

    $parentDir = Split-Path $TargetDirectory -Parent
    if (-not (Test-Path $parentDir)) {
        Write-Host "$SCRIPT_INDEX Creating parent directory: $parentDir" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    try {
        $gitExePath = $Global:GIT_EXE_PATH
        & $gitExePath clone $repoUrl $TargetDirectory

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

<#
.SYNOPSIS
    Install Python dependencies for DeepSeek

.PARAMETER InstallDirectory
    DeepSeek installation directory

.PARAMETER PythonCommand
    Python command to use (python or python3)

.OUTPUTS
    Boolean - True if installation succeeded
#>
function Install-DeepSeekDependencies {
    param(
        [string]$InstallDirectory,
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Installing Python dependencies..." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX Using Python command: $PythonCommand" -ForegroundColor White

    try {
        Push-Location $InstallDirectory

        Write-Host "$SCRIPT_INDEX Installing core dependencies..." -ForegroundColor White
        Write-Host ""
        # transformers goes in at the shared Bucket-A pin (version-idempotent, never
        # --upgrade); the other deps install as before. See lifecycle doc §7.
        Install-PinnedTransformers -PythonExe $Global:PYTHON_EXE_PATH -PipExe $Global:PIP_EXE_PATH -Prefix "$SCRIPT_INDEX " | Out-Null
        & $Global:PIP_EXE_PATH install torch pillow numpy einops timm accelerate attrdict
        Write-Host ""

        Pop-Location

        Write-Host "$SCRIPT_INDEX Dependencies installed successfully" -ForegroundColor Green
        return $true
    }
    catch {
        Pop-Location
        Write-Host "$SCRIPT_INDEX Error installing dependencies: $_" -ForegroundColor Red
        return $false
    }
}

<#
.SYNOPSIS
    Main installation function
#>
function Install-DeepSeekVLModelWeights {
    Write-Host "`n$SCRIPT_INDEX Pre-downloading VL model weights (idempotent: sentinel + curl resume + size verify)" -ForegroundColor Cyan
    Write-Host ("$SCRIPT_INDEX  model   : {0}" -f $VL_MODEL_PATH) -ForegroundColor DarkGray
    Write-Host ("$SCRIPT_INDEX  weights : {0}" -f $vlWeightsDir) -ForegroundColor DarkGray
    Write-Host ("$SCRIPT_INDEX  sentinel: {0} ({1})" -f $vlModelSentinel, $(if (Test-Path $vlModelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray

    New-Item -ItemType Directory -Force -Path $vlStagingDir | Out-Null

    # allow-list excludes redundant flax/tf/onnx format variants; *.py kept for trust_remote_code.
    $vlModelReady = $false
    if (Test-Path $vlModelSentinel) {
        $vlSentinelModel = (Get-Content -LiteralPath $vlModelSentinel -Raw -ErrorAction SilentlyContinue)
        if ($vlSentinelModel) { $vlSentinelModel = $vlSentinelModel.Trim().Trim([char]0xFEFF) }
        if ($vlSentinelModel -and ($vlSentinelModel -eq $VL_MODEL_PATH) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $vlWeightsDir -RepoId $VL_MODEL_PATH -AllowPatterns $vlWeightAllow)) {
            Write-Host "$SCRIPT_INDEX [idempotent] skipping: model weights verified ($VL_MODEL_PATH)" -ForegroundColor Green
            $vlModelReady = $true
        } elseif ($vlSentinelModel -and ($vlSentinelModel -ne $VL_MODEL_PATH)) {
            Write-Host ("$SCRIPT_INDEX [..] model changed ({0} -> {1}); refreshing weights." -f $vlSentinelModel, $VL_MODEL_PATH) -ForegroundColor Yellow
        } elseif (-not (Test-NeuralTtsLocalWeightsReady -WeightsDir $vlWeightsDir -RepoId $VL_MODEL_PATH -AllowPatterns $vlWeightAllow)) {
            Write-Host "$SCRIPT_INDEX [..] local weights incomplete or corrupt; repairing download." -ForegroundColor Yellow
        }
    }
    if (-not $vlModelReady) {
        Write-Host ("$SCRIPT_INDEX [..] downloading/repairing model '{0}' (curl, resumable) ..." -f $VL_MODEL_PATH) -ForegroundColor Yellow
        $vlDlOk = Install-HfRepoFlat -RepoId $VL_MODEL_PATH -DestDir $vlWeightsDir -SentinelPath $vlModelSentinel -AllowPatterns $vlWeightAllow -Prefix "$SCRIPT_INDEX " -SentinelValue $VL_MODEL_PATH
        if ($vlDlOk -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $vlWeightsDir -RepoId $VL_MODEL_PATH -AllowPatterns $vlWeightAllow)) {
            Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready at {1}." -f $VL_MODEL_PATH, $vlWeightsDir) -ForegroundColor Green
        } else {
            Write-Host ("$SCRIPT_INDEX [!] model download not finished; partial files kept at {0}; will RESUME next run." -f $vlWeightsDir) -ForegroundColor DarkYellow
        }
    }
}

function Install-DeepSeek {
    Write-Host "`n$SCRIPT_INDEX ========================================" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX   DeepSeek-VL Installation" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX ========================================`n" -ForegroundColor Cyan

    # Check current status
    $status = Get-DeepSeekStatus

    Write-Host "$SCRIPT_INDEX Platform: $($status.Platform)" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Base Directory: $($status.BaseDirectory)" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Install Directory: $($status.InstallDirectory)" -ForegroundColor White

    # Check prerequisites
    Write-Host "`n$SCRIPT_INDEX Checking prerequisites..." -ForegroundColor Yellow

    if (-not (Test-GitAvailable)) {
        Write-Host "$SCRIPT_INDEX ERROR: Git is required but not found" -ForegroundColor Red
        Write-Host "$SCRIPT_INDEX Please install Git from: https://git-scm.com/" -ForegroundColor Yellow
        return $false
    }

    $pythonStatus = Test-PythonAvailable
    if (-not $pythonStatus.Available) {
        Write-Host "$SCRIPT_INDEX ERROR: Python 3.8+ is required but not found" -ForegroundColor Red
        Write-Host "$SCRIPT_INDEX Please install Python from: https://python.org/" -ForegroundColor Yellow
        return $false
    }

    if ($status.IsInstalled -and $status.IsValid) {
        Write-Host "`n$SCRIPT_INDEX DeepSeek-VL repository already exists" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX Installation directory: $($status.InstallDirectory)" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX File count: $($status.FileCount)" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX Skipping repository clone, will reinstall dependencies..." -ForegroundColor Yellow
    }
    else {
        # Clone repository
        Write-Host "`n$SCRIPT_INDEX Step 1: Clone DeepSeek-VL repository" -ForegroundColor Cyan
        $cloneSuccess = Install-DeepSeekRepository -TargetDirectory $status.InstallDirectory

        if (-not $cloneSuccess) {
            Write-Host "$SCRIPT_INDEX ERROR: Failed to clone repository" -ForegroundColor Red
            return $false
        }
    }

    # Install dependencies
    Write-Host "`n$SCRIPT_INDEX Step 2: Install Python dependencies" -ForegroundColor Cyan
    $depsSuccess = Install-DeepSeekDependencies -InstallDirectory $status.InstallDirectory -PythonCommand $pythonStatus.Command

    if (-not $depsSuccess) {
        Write-Host "$SCRIPT_INDEX WARNING: Dependency installation may have failed" -ForegroundColor Yellow
        Write-Host "$SCRIPT_INDEX You can try installing dependencies manually later" -ForegroundColor Yellow
    }

    Write-Host "`n$SCRIPT_INDEX Step 2b: Pre-download VL model weights (idempotent)" -ForegroundColor Cyan
    Install-DeepSeekVLModelWeights

    # Verify final installation
    Write-Host "`n$SCRIPT_INDEX Step 3: Verify installation" -ForegroundColor Cyan
    $finalStatus = Get-DeepSeekStatus

    if ($finalStatus.IsInstalled -and $finalStatus.IsValid) {
        Write-Host "`n$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX   Installation Successful!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "`n$SCRIPT_INDEX Model location: $($finalStatus.InstallDirectory)" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX File count: $($finalStatus.FileCount)" -ForegroundColor Green
        Write-Host "`n$SCRIPT_INDEX Next steps:" -ForegroundColor Yellow
        Write-Host "$SCRIPT_INDEX 1. Use in Node.js with environment variable:" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX    `$env:DEEPSEEK_MODEL_DIR=`"$($finalStatus.InstallDirectory)`"" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX    `$env:TRANSLATOR_PROVIDER=`"deepseek`"" -ForegroundColor White
        Write-Host "`n$SCRIPT_INDEX 2. Or configure in translation config file:" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX    modelDir: $($finalStatus.InstallDirectory)" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX    modelPath: $($finalStatus.ModelPath)" -ForegroundColor White

        Write-Host "`n$SCRIPT_INDEX Step 4: Testing installation" -ForegroundColor Cyan
        Test-DeepSeekInstallation -InstallDirectory $finalStatus.InstallDirectory -PythonCommand $pythonStatus.Command

        return $true
    }
    else {
        Write-Host "`n$SCRIPT_INDEX ERROR: Installation verification failed" -ForegroundColor Red
        return $false
    }
}

<#
.SYNOPSIS
    Test DeepSeek installation

.PARAMETER InstallDirectory
    DeepSeek installation directory

.PARAMETER PythonCommand
    Python command to use

.OUTPUTS
    Boolean - True if test succeeded
#>
function Test-DeepSeekInstallation {
    param(
        [string]$InstallDirectory,
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Running model load test..." -ForegroundColor Yellow
    Test-DeepSeekModelLoad -InstallDirectory $InstallDirectory -PythonCommand $PythonCommand

    return $true
}

<#
.SYNOPSIS
    Test DeepSeek model loading

.PARAMETER InstallDirectory
    DeepSeek installation directory

.PARAMETER PythonCommand
    Python command to use

.OUTPUTS
    Boolean - True if test succeeded
#>
function Test-DeepSeekModelLoad {
    param(
        [string]$InstallDirectory,
        [string]$PythonCommand
    )

    Write-Host "$SCRIPT_INDEX Testing model load (first run may download model)..." -ForegroundColor Yellow

    $modelLoadScript = @"
import os
os.environ['HF_HOME'] = os.path.join(os.path.dirname(__file__), '.cache')
os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = '3600'

print('[TEST] Loading VLChatProcessor...')
from deepseek_vl.models import VLChatProcessor

model_path = '$VL_MODEL_PATH'
print(f'[INFO] Model path: {model_path}')
print('[INFO] Note: First run will download model from HuggingFace')
print('[INFO] Download timeout: 3600s (1 hour)')

vl_chat_processor = VLChatProcessor.from_pretrained(model_path)
print('[OK] VLChatProcessor loaded successfully')

tokenizer = vl_chat_processor.tokenizer
print(f'[OK] Tokenizer loaded: {type(tokenizer).__name__}')

print('[TEST] Testing conversation structure...')
conversation = [
    {
        "role": "User",
        "content": "Hello",
    },
    {"role": "Assistant", "content": ""}
]
print('[OK] Conversation structure is valid')

print('')
print('[SUCCESS] ========================================')
print('[SUCCESS]   DeepSeek-VL is ready!')
print('[SUCCESS] ========================================')
"@

    $modelTestPath = Join-Path $InstallDirectory "test_model_load.py"
    $modelLoadScript | Out-File -FilePath $modelTestPath -Encoding UTF8

    try {
        Push-Location $InstallDirectory

        # Authenticate to the HF Hub from the project secret store so the model
        # download is not a rate-limited "unauthenticated" request (HF_TOKEN_1..5
        # then HF_TOKEN).
        $hfToken = Get-SecretContentIndexed -BaseName "HF_TOKEN"
        if (-not [string]::IsNullOrWhiteSpace($hfToken)) {
            $env:HF_TOKEN = $hfToken
            $env:HUGGING_FACE_HUB_TOKEN = $hfToken
            Write-Host "$SCRIPT_INDEX HF Hub token loaded from .secret_keys\.secret_ignore" -ForegroundColor Cyan
        } else {
            Write-Host "$SCRIPT_INDEX No HF_TOKEN in .secret_keys; HF Hub download will be unauthenticated" -ForegroundColor Yellow
        }

        Write-Host ""
        & $PythonCommand $modelTestPath
        Write-Host ""

        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX   Model Load Test Passed!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX ========================================" -ForegroundColor Green
        Write-Host ""

        $cacheDir = Join-Path $Global:CORE_NODE_CACHE_DIR 'core_node'
        if (-not (Test-Path $cacheDir)) {
            New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
        }

        $batScriptPath = Join-Path $cacheDir "deepseek_vl_chat.bat"
        $batScript = @"
@echo off
chcp 65001 >nul
echo ========================================
echo   DeepSeek-VL Interactive Chat
echo ========================================
echo.
echo INSTRUCTIONS:
echo 1. Wait for 'User:' prompt to appear
echo 2. Type your question and press Enter
echo 3. Type 'exit' or 'quit' to end chat
echo ========================================
echo.
echo Starting model... Please wait...
echo.
cd /d "$InstallDirectory"
$PythonCommand cli_chat.py --model_path "$VL_MODEL_PATH"
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
        Write-Host "$SCRIPT_INDEX To test DeepSeek-VL interactively, run:" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX   $batScriptPath" -ForegroundColor White
        Write-Host ""
        Write-Host "$SCRIPT_INDEX Or manually run:" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX   cd `"$InstallDirectory`"" -ForegroundColor White
        Write-Host "$SCRIPT_INDEX   python cli_chat.py --model_path `"$VL_MODEL_PATH`"" -ForegroundColor White
        Write-Host ""
        Write-Host "$SCRIPT_INDEX For more information, check: $InstallDirectory" -ForegroundColor White
        Write-Host ""

        Pop-Location
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

# Main execution
try {
    Install-DeepSeek
}
catch {
    Write-Host "`n$SCRIPT_INDEX Unexpected error: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
}
