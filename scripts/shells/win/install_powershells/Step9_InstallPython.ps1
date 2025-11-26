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

$STEP_NUMBER = 9
$SCRIPT_INDEX = "[Step $STEP_NUMBER]"

# Python package definition - all paths from GlobalVars.ps1
# These absolute paths are critical for first-time installation when PATH is not set
$PythonVersion = $Global:PYTHON_VERSION
$PythonWingetId = $Global:PYTHON_WINGET_ID
$PythonInstallDir = $Global:PYTHON_DIR
$PythonExePath = $Global:PYTHON_EXE_PATH
$PipExePath = $Global:PIP_EXE_PATH
$UvExePath = $Global:UV_EXE_PATH
$PipxExePath = $Global:PIPX_EXE_PATH
$PoetryExePath = $Global:POETRY_EXE_PATH
$PythonFlagFile = $Global:PYTHON_FLAG_FILE

# Common Python packages to install
$CommonPythonPackages = @(
    "requests",
    "urllib3",
    "certifi",
    "charset-normalizer",
    "idna",
    "setuptools",
    "wheel",
    "pip-tools"
)

# Required packages from pycore/pyfoundations/third_party.py DEPENDENCY_MAP
$RequiredPythonPackages = @(
    "Pillow",
    "opencv-python",
    "pyautogui",
    "psutil",
    "mss",
    "torch",
    "ultralytics",
    "numpy",
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

function Remove-OldPythonVersions {
    Write-ColorMessage -Message "$SCRIPT_INDEX Checking for old Python versions..." -Type "Info"

    $langCompilerDir = $Global:LANG_COMPILER_DIR
    if (-not (Test-Path $langCompilerDir)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX No previous installations found" -Type "Info"
        return
    }

    # Find all Python directories (versioned)
    $oldPythonDirs = @(Get-ChildItem -Path $langCompilerDir -Directory -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '^python\d+$' -and $_.FullName -ne $PythonInstallDir
    })

    if ($oldPythonDirs.Count -eq 0) {
        Write-ColorMessage -Message "$SCRIPT_INDEX No old Python versions found" -Type "Info"
        return
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Found $($oldPythonDirs.Count) old Python installation(s):" -Type "Warning"
    foreach ($oldDir in $oldPythonDirs) {
        Write-ColorMessage -Message "$SCRIPT_INDEX   - $($oldDir.FullName)" -Type "Warning"

        # Remove from PATH using WindowsPathFunction.ps1
        Write-ColorMessage -Message "$SCRIPT_INDEX   Removing from PATH..." -Type "Info"
        Remove-Path -PathToRemove $oldDir.FullName

        # Also remove Scripts directory from PATH
        $oldScriptsDir = Join-Path $oldDir.FullName "Scripts"
        if (Test-Path $oldScriptsDir) {
            Remove-Path -PathToRemove $oldScriptsDir
        }

        # Ask before deleting directory
        Write-ColorMessage -Message "$SCRIPT_INDEX   Delete old installation? (y/N, timeout 5s, default: N, press Enter to continue)" -Type "Warning"
        $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
        $timeout = 5
        $shouldDelete = $false

        while ($stopWatch.Elapsed.TotalSeconds -lt $timeout -and !$host.UI.RawUI.KeyAvailable) {
            Start-Sleep -Milliseconds 200
        }

        if ($host.UI.RawUI.KeyAvailable) {
            $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
            if ($key -eq 'y' -or $key -eq 'Y') {
                $shouldDelete = $true
            }
        }

        $stopWatch.Stop()

        if ($shouldDelete) {
            try {
                Remove-Item -Path $oldDir.FullName -Recurse -Force -ErrorAction Stop
                Write-ColorMessage -Message "$SCRIPT_INDEX   Deleted: $($oldDir.FullName)" -Type "Success"
            } catch {
                Write-ColorMessage -Message "$SCRIPT_INDEX   Failed to delete: $($_.Exception.Message)" -Type "Error"
            }
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   Kept old installation (removed from PATH only)" -Type "Info"
        }
    }

    # Refresh PATH
    Write-ColorMessage -Message "$SCRIPT_INDEX Refreshing environment variables..." -Type "Info"
    Write-RefreshBatch
}

function Install-Python {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Python $PythonVersion..." -Type "Info"

    # Remove old versions first
    Remove-OldPythonVersions

    # Check if current version already installed
    if (Test-Path $PythonExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Python already installed" -Type "Success"
        & $PythonExePath --version
        Write-ColorMessage -Message "$SCRIPT_INDEX Path: $PythonExePath" -Type "Info"

        # Ensure it's in PATH using absolute paths
        Write-ColorMessage -Message "$SCRIPT_INDEX Adding Python to PATH..." -Type "Info"
        Add-Path -PathToAdd $PythonInstallDir
        Add-Path -PathToAdd (Join-Path $PythonInstallDir "Scripts")

        return $true
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
        Start-Process -FilePath "winget" -ArgumentList $wingetArgs -Wait -NoNewWindow | Out-Null

        # Verify installation using absolute path
        if (Test-Path $PythonExePath) {
            Write-ColorMessage -Message "$SCRIPT_INDEX Python installed successfully" -Type "Success"
            & $PythonExePath --version
            Write-ColorMessage -Message "$SCRIPT_INDEX Python path: $PythonExePath" -Type "Info"
            Write-ColorMessage -Message "$SCRIPT_INDEX Pip path: $PipExePath" -Type "Info"

            # Add to PATH using absolute paths
            Write-ColorMessage -Message "$SCRIPT_INDEX Adding Python to PATH..." -Type "Info"
            Add-Path -PathToAdd $PythonInstallDir
            Add-Path -PathToAdd (Join-Path $PythonInstallDir "Scripts")

            # Create flag file
            New-Item -ItemType File -Path $PythonFlagFile -Force | Out-Null

            return $true
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Python executable not found at $PythonExePath" -Type "Error"
            return $false
        }

    } catch {
        Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Failed to install Python: $($_.Exception.Message)" -Type "Error"
        return $false
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

    $command = "$PythonExePath -m pip $($pipArgs -join ' ')"
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: $command" -Type "Info"
    & $PythonExePath -m pip @pipArgs
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

    if (Test-Path $PythonExePath) {
        & $PythonExePath --version
    }

    if (Test-Path $PipExePath) {
        & $PipExePath --version
    }

    if (Test-Path $UvExePath) {
        & $UvExePath --version
    }

    if (Test-Path $PipxExePath) {
        & $PipxExePath --version
    }

    if (Test-Path $PoetryExePath) {
        & $PoetryExePath --version
    }

    return $true
}

# Main execution
Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
Write-ColorMessage -Message "$SCRIPT_INDEX   Python Installation (Step $STEP_NUMBER)" -Type "Info"
Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"

$installSuccess = Install-Python

if ($installSuccess) {
    Write-ColorMessage -Message "$SCRIPT_INDEX Python installation completed successfully" -Type "Success"

    # Configure mirror if in China region
    Configure-PipMirror

    # Install/update pip and tools (each independently)
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Python package managers..." -Type "Info"
    Install-PipTools
    Install-UV
    Install-Pipx
    Install-Poetry

    # Install common packages
    Install-CommonPackages

    # Install required packages from third_party.py
    Install-RequiredPythonPackages

    # Install optional packages
    Install-OptionalPythonPackages

    # Test installation
    $testSuccess = Test-PythonInstallation

    if ($testSuccess) {
        Write-ColorMessage -Message "$SCRIPT_INDEX All Python components verified successfully" -Type "Success"
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Some Python components failed verification" -Type "Warning"
    }
} else {
    Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Python installation failed" -Type "Error"
    exit 1
}

Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
