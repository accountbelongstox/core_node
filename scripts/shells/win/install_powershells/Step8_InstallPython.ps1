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

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"

. (Join-Path $winCommonDir "GlobalVars.ps1")
. (Join-Path $winCommonDir "CommonFunc.ps1")
. (Join-Path $winCommonDir "WindowsPathFunction.ps1")
. (Join-Path $winCommonDir "PythonRuntimeCommon.ps1")

$STEP_NUMBER = 8
$SCRIPT_INDEX = "[Step 8]"

# Python package definition - all paths from GlobalVars.ps1
# These absolute paths are critical for first-time installation when PATH is not set
$PythonVersion = $Global:PYTHON_VERSION
$PythonWingetId = $Global:PYTHON_WINGET_ID
$PythonInstallDir = $Global:PYTHON_DIR
$PythonScriptsDir = $Global:PYTHON_SCRIPTS_DIR
$PythonExePath = $Global:PYTHON_EXE_PATH
$PipExePath = $Global:PIP_EXE_PATH
$UvExePath = $Global:UV_EXE_PATH
$PipxExePath = $Global:PIPX_EXE_PATH
$PoetryExePath = $Global:POETRY_EXE_PATH
$PythonFlagFile = $Global:PYTHON_FLAG_FILE

# Common Python packages to install (basic only)
$CommonPythonPackages = @(
    "requests",
    "urllib3",
    # setuptools<81: v81 removed the bundled `pkg_resources`, which legacy packages still
    # import at load time (librosa 0.9.1 via MeloTTS: `from pkg_resources import
    # resource_filename`). <81 (resolves to 80.10.2) also satisfies torch (needs <82) and
    # faradaysec (needs <81). Do NOT drop the bound: an unbounded --upgrade walks it to 82.
    "setuptools<81",
    "wheel",
    "pip-tools"
)

# Required packages from pycore/pyfoundations/third_party.py DEPENDENCY_MAP (not installed in Step 9)
# Version constraints for dependency compatibility:
#   - Pillow<11: required by tkhtmlview 0.3.1 (needs Pillow<11,>=10)
#   - numpy<2.3.0: required by opencv-python (needs numpy<2.3.0,>=2)
$RequiredPythonPackages = @(
    "Pillow<11,>=10",
    "opencv-python",
    "pyautogui",
    "psutil",
    "mss",
    # torch / ultralytics / paddle: installed by Step10_InstallPythonPrereqPackages.ps1
    # (after pip + Step9 CUDA prereq) to avoid version/index conflicts.
    "numpy<2.3.0,>=2",
    "adb-shell",
    "av",
    "uvicorn[standard]",
    "websockets",
    "requests",
    "aiohttp",
    "fastapi",
    "netifaces",
    "pywebview",
    "tkinterweb",
    "tkhtmlview",
    "pystray",
    "loguru",
    "pyyaml",
    "cnocr[ort-cpu]",
    "pypdf",
    "pdfplumber",
    "python-docx",
    "openpyxl",
    "python-pptx",
    "beautifulsoup4",
    "scikit-learn",
    "selenium",
    "webdriver-manager",
    "sqlalchemy",
    "fastmcp",
    "azure-cognitiveservices-speech",
    "vosk",
    "pynput",
    "pyperclip",
    "googletrans",
    "httpx"
)

# Windows-only packages (from third_party.py WINDOWS_ONLY_PACKAGES)
$WindowsOnlyPackages = @(
    "pywin32",
    "pywinauto",
    "pygetwindow",
    "uiautomation",
    "pyaudiowpatch",
    "pyaudio"
)

# Optional packages (from third_party.py OPTIONAL_PACKAGES)
$OptionalPythonPackages = @(
    "edge-tts",
    "openai-whisper"
)

# Region-specific mirror configuration
function Get-PipMirrorConfig {
    $selectedRegion = Get-GlobalVar -Key "SELECTED_REGION"

    if ($selectedRegion -eq "China") {
        return @{
            IndexUrl = "https://pypi.tuna.tsinghua.edu.cn/simple"
            TrustedHost = "pypi.tuna.tsinghua.edu.cn"
        }
    } else {
        return $null
    }
}

function Prepare-PythonEnvironment {
    Write-ColorMessage -Message "$SCRIPT_INDEX Preparing Python $PythonVersion environment..." -Type "Info"

    $langCompilerDir = $Global:LANG_COMPILER_DIR
    if (Test-Path -LiteralPath $langCompilerDir) {
        $existingDirs = @(Get-ChildItem -Path $langCompilerDir -Directory -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -match '^python\d+$' -and $_.FullName -ne $PythonInstallDir
        })
        foreach ($oldDir in $existingDirs) {
            Write-ColorMessage -Message "$SCRIPT_INDEX Found older Python install (kept on disk): $($oldDir.FullName)" -Type "Info"
        }
    }

    Ensure-CoreNodePythonPath -LogPrefix $SCRIPT_INDEX
    Write-RefreshBatch
}

function Install-Python {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Python $PythonVersion..." -Type "Info"

    Prepare-PythonEnvironment

    if (Test-Path -LiteralPath $PythonExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Python already installed" -Type "Success"
        $installedVersion = Get-PythonVersionTextFromExe -PythonExe $PythonExePath
        if ($installedVersion) {
            Write-ColorMessage -Message "$SCRIPT_INDEX $installedVersion" -Type "Info"
        }
        Write-ColorMessage -Message "$SCRIPT_INDEX Path: $PythonExePath" -Type "Info"

        Write-ColorMessage -Message "$SCRIPT_INDEX Ensuring Python PATH priority..." -Type "Info"
        Ensure-CoreNodePythonPath -LogPrefix $SCRIPT_INDEX

        return
    }

    # Install Python using winget
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Python $PythonVersion via winget..." -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX Package ID: $PythonWingetId" -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX Install directory: $PythonInstallDir" -Type "Info"

    # Ensure install directory exists
    if (-not (Test-Path $PythonInstallDir)) {
        New-Item -ItemType Directory -Path $PythonInstallDir -Force | Out-Null
    }

    try {
        $wingetArgs = @(
            "install",
            "--id", $PythonWingetId,
            "--location", $PythonInstallDir,
            "--force",
            "--accept-package-agreements",
            "--accept-source-agreements"
        )

        Write-ColorMessage -Message "$SCRIPT_INDEX Command: winget $($wingetArgs -join ' ')" -Type "Info"
        & winget @wingetArgs

        # Verify installation using absolute path
        if (Test-Path -LiteralPath $PythonExePath) {
            Write-ColorMessage -Message "$SCRIPT_INDEX Python installed successfully" -Type "Success"
            $installedVersion = Get-PythonVersionTextFromExe -PythonExe $PythonExePath
            if ($installedVersion) {
                Write-ColorMessage -Message "$SCRIPT_INDEX $installedVersion" -Type "Info"
            }
            Write-ColorMessage -Message "$SCRIPT_INDEX Python path: $PythonExePath" -Type "Info"
            Write-ColorMessage -Message "$SCRIPT_INDEX Pip path: $PipExePath" -Type "Info"

            Write-ColorMessage -Message "$SCRIPT_INDEX Ensuring Python PATH priority..." -Type "Info"
            Ensure-CoreNodePythonPath -LogPrefix $SCRIPT_INDEX

            New-Item -ItemType File -Path $PythonFlagFile -Force | Out-Null
            return
        }

        Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Python executable not found at $PythonExePath" -Type "Error"

    } catch {
        Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Failed to install Python: $($_.Exception.Message)" -Type "Error"
    }
}

function Configure-PipMirror {
    $mirrorConfig = Get-PipMirrorConfig

    if ($null -eq $mirrorConfig) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Global region detected - using default PyPI (no mirror)" -Type "Info"
        return $true
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Configuring pip mirror for China region..." -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX Mirror: $($mirrorConfig.IndexUrl)" -Type "Info"

    # Configure pip using absolute path
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: $PipExePath config set global.index-url $($mirrorConfig.IndexUrl)" -Type "Info"
    & $PipExePath config set global.index-url $mirrorConfig.IndexUrl

    Write-ColorMessage -Message "$SCRIPT_INDEX Command: $PipExePath config set install.trusted-host $($mirrorConfig.TrustedHost)" -Type "Info"
    & $PipExePath config set install.trusted-host $mirrorConfig.TrustedHost

    Write-ColorMessage -Message "$SCRIPT_INDEX pip mirror configured" -Type "Info"
    return $true
}

function Install-PipTools {
    Write-ColorMessage -Message "$SCRIPT_INDEX Ensuring pip is up to date..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $pipArgs = @("install", "--upgrade", "pip")

    if ($mirrorConfig) {
        $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
    }

    $command = "$PipExePath $($pipArgs -join ' ')"
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: $command" -Type "Info"
    & $PipExePath @pipArgs
}

function Install-UV {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing/verifying uv..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $pipArgs = @("install", "--upgrade", "uv")

    if ($mirrorConfig) {
        $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
    }

    $command = "$PipExePath $($pipArgs -join ' ')"
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: $command" -Type "Info"
    & $PipExePath @pipArgs
}

function Install-Pipx {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing/verifying pipx..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $pipArgs = @("install", "--upgrade", "pipx")

    if ($mirrorConfig) {
        $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
    }

    $command = "$PipExePath $($pipArgs -join ' ')"
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: $command" -Type "Info"
    & $PipExePath @pipArgs

    if (Test-Path $PipxExePath) {
        & $PipxExePath ensurepath
    }
}

function Install-Poetry {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing/verifying poetry..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $pipArgs = @("install", "--upgrade", "poetry")

    if ($mirrorConfig) {
        $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
    }

    $command = "$PipExePath $($pipArgs -join ' ')"
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: $command" -Type "Info"
    & $PipExePath @pipArgs
}

function Install-CommonPackages {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing common Python packages..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig

    foreach ($package in $CommonPythonPackages) {
        Write-ColorMessage -Message "$SCRIPT_INDEX   Installing: $package" -Type "Info"

        $pipArgs = @("install", "--upgrade", $package)

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        $command = "$PipExePath $($pipArgs -join ' ')"
        Write-ColorMessage -Message "$SCRIPT_INDEX   Command: $command" -Type "Info"
        & $PipExePath @pipArgs
    }
}

function Install-RequiredPythonPackages {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing required Python packages from third_party.py..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $allPackages = @($RequiredPythonPackages)

    # Add Windows-only packages on Windows
    if ($env:OS -match "Windows") {
        $allPackages += $WindowsOnlyPackages
        Write-ColorMessage -Message "$SCRIPT_INDEX Including Windows-only packages" -Type "Info"
    }

    foreach ($package in $allPackages) {
        Write-ColorMessage -Message "$SCRIPT_INDEX   Installing: $package" -Type "Info"

        $pipArgs = @("install", "--upgrade", $package)

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        $command = "$PipExePath $($pipArgs -join ' ')"
        Write-ColorMessage -Message "$SCRIPT_INDEX   Command: $command" -Type "Info"
        & $PipExePath @pipArgs
    }
}

function Install-OptionalPythonPackages {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing optional Python packages..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig

    foreach ($package in $OptionalPythonPackages) {
        Write-ColorMessage -Message "$SCRIPT_INDEX   Installing: $package" -Type "Info"

        $pipArgs = @("install", "--upgrade", $package)

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        $command = "$PipExePath $($pipArgs -join ' ')"
        Write-ColorMessage -Message "$SCRIPT_INDEX   Command: $command" -Type "Info"
        & $PipExePath @pipArgs
    }
}

function Test-PythonInstallation {
    Write-ColorMessage -Message "$SCRIPT_INDEX Testing Python installation..." -Type "Info"

    if (Test-Path -LiteralPath $PythonExePath) {
        $versionText = Get-PythonVersionTextFromExe -PythonExe $PythonExePath
        if ($versionText) {
            Write-ColorMessage -Message "$SCRIPT_INDEX $versionText" -Type "Info"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: python.exe missing at $PythonExePath" -Type "Error"
        return $false
    }

    if (Test-Path -LiteralPath $PipExePath) {
        $pipText = ((& $PipExePath --version 2>&1) | Out-String).Trim()
        if ($pipText) {
            Write-ColorMessage -Message "$SCRIPT_INDEX $pipText" -Type "Info"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: pip.exe missing at $PipExePath" -Type "Warning"
    }

    foreach ($toolPath in @($UvExePath, $PipxExePath, $PoetryExePath)) {
        if (Test-Path -LiteralPath $toolPath) {
            $toolVersion = ((& $toolPath --version 2>&1) | Out-String).Trim()
            if ($toolVersion) {
                Write-ColorMessage -Message "$SCRIPT_INDEX $toolVersion" -Type "Info"
            }
        }
    }

    return (Test-Path -LiteralPath $PythonExePath)
}

# Main execution
Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
Write-ColorMessage -Message "$SCRIPT_INDEX   Python Installation (Step $STEP_NUMBER)" -Type "Info"
Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"

Install-Python

if (Test-Path -LiteralPath $PythonExePath) {
    Write-ColorMessage -Message "$SCRIPT_INDEX Python installation completed successfully" -Type "Success"

    Configure-PipMirror

    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Python package managers..." -Type "Info"
    Install-PipTools
    Install-UV
    Install-Pipx
    Install-Poetry

    Install-CommonPackages

    if (Test-PythonInstallation) {
        Write-ColorMessage -Message "$SCRIPT_INDEX All Python components verified successfully" -Type "Success"
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Some Python components failed verification" -Type "Warning"
    }
} else {
    Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Python installation failed" -Type "Error"
}

Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
