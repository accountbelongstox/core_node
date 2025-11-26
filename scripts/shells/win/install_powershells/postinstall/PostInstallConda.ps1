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

# Get WindowsPathFunction.ps1 path (do NOT dot-source, call with & instead)
$windowsPathFunctionPath = Join-Path $winCommonDir "WindowsPathFunction.ps1"

$STEP_NUMBER = 9

# Create complete Anaconda package object
$AnacondaPackage = @{
    Name                  = "Anaconda3"
    PackageId             = $Global:ANACONDA_WINGET_ID
    Exec                  = "conda.exe"
    Category              = "Development Environment"
    Description           = "Anaconda Python distribution with conda package manager"
    InstallType           = "winget"
    ForceToInstallDir     = $true
    IncludeSystemPaths    = $false
    AdditionalKeywords    = @("python.exe")
    AppCustomInstallDir   = $Global:ANACONDA_DIR
}

# Python package definition from GlobalVars
$PythonInstallDir = $Global:PYTHON_DIR
$PythonExePath = $Global:PYTHON_EXE_PATH
$CondaExePath = $Global:CONDA_EXE_PATH
$PipExePath = $Global:PIP_EXE_PATH
$UvExePath = $Global:UV_EXE_PATH
$PipxExePath = $Global:PIPX_EXE_PATH
$PoetryExePath = $Global:POETRY_EXE_PATH
$AnacondaFlagFile = $Global:ANACONDA_FLAG_FILE
$CondaEnvName = $Global:CONDA_ENV_NAME
$CondaEnvPythonVersion = $Global:CONDA_ENV_PYTHON_VERSION
$CondaEnvDir = $Global:CONDA_ENV_DIR
$BasePythonVersion = "3.12"

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

# Windows-only packages (skip on Linux)
$WindowsOnlyPackages = @(
    "pywin32",
    "pywinauto",
    "pygetwindow",
    "uiautomation",
    "pyaudiowpatch",
    "pyaudio"
)

# Optional packages (install but don't fail if unavailable)
$OptionalPythonPackages = @(
    "edge-tts",
    "openai-whisper"
)

function Invoke-ExternalCommand {
    param(
        [string]$Executable,
        [string[]]$Arguments
    )

    if ([string]::IsNullOrWhiteSpace($Executable)) {
        return
    }

    $escapedArgs = $Arguments | ForEach-Object {
        if ($_ -match '[\s"`]') {
            '"' + ($_ -replace '"', '\"') + '"'
        }
        else {
            $_
        }
    }

    $argumentString = ($escapedArgs -join ' ').Trim()
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Command: $Executable $argumentString" -Type "Info"

    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()

    try {
        Start-Process -FilePath $Executable -ArgumentList $argumentString -NoNewWindow -Wait -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile | Out-Null
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] ERROR: Failed to start process $Executable $argumentString - $($_.Exception.Message)" -Type "Error"
    }

    if (Test-Path $stdoutFile) {
        Get-Content $stdoutFile | ForEach-Object { Write-Host $_ }
        Remove-Item $stdoutFile -Force
    }

    if (Test-Path $stderrFile) {
        Get-Content $stderrFile | ForEach-Object { Write-Host $_ }
        Remove-Item $stderrFile -Force
    }
}

function Remove-PathEntry {
    param(
        [string]$PathToRemove
    )

    if ([string]::IsNullOrWhiteSpace($PathToRemove)) {
        return
    }

    $normalized = $PathToRemove.TrimEnd('\')
    & $windowsPathFunctionPath "remove" $normalized
    & $windowsPathFunctionPath "remove" ($normalized + "\")
}

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

# Function to clean up old Python installations from PATH
function Remove-OldPythonFromPath {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking for old Python installations in PATH..." -Type "Info"

    $langCompilerDir = $Global:LANG_COMPILER_DIR
    $cleanedCount = 0

    # Get all paths that might be old Python installations
    $currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $pathArray = $currentPath -split ";"

    foreach ($pathItem in $pathArray) {
        if ([string]::IsNullOrWhiteSpace($pathItem)) {
            continue
        }

        # Check if this is an old Python installation (pythonXXX pattern, not anaconda)
        $isOldPython = $false

        # Match patterns like D:\.lang_compiler\python313, D:\.lang_compiler\python312, etc.
        if ($pathItem -match "python\d{2,3}" -and $pathItem -notmatch "anaconda") {
            # Check if it's different from current Anaconda directory
            if ($pathItem -ne $Global:ANACONDA_DIR -and 
                $pathItem -ne (Join-Path $Global:ANACONDA_DIR "Scripts") -and
                $pathItem -ne (Join-Path $Global:ANACONDA_DIR "Library\bin")) {
                $isOldPython = $true
            }
        }

        # Also check for standard Python installation paths
        if ($pathItem -match "\\Python\d{2,3}\\" -or $pathItem -match "\\Python\d{2,3}$") {
            $isOldPython = $true
        }

        if ($isOldPython) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing old Python path: $pathItem" -Type "Warning"
            & $windowsPathFunctionPath "remove" $pathItem
            $cleanedCount++
        }
    }

    # Also clean up from Machine PATH
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $machinePathArray = $machinePath -split ";"

    foreach ($pathItem in $machinePathArray) {
        if ([string]::IsNullOrWhiteSpace($pathItem)) {
            continue
        }

        $isOldPython = $false

        if ($pathItem -match "python\d{2,3}" -and $pathItem -notmatch "anaconda") {
            if ($pathItem -ne $Global:ANACONDA_DIR -and 
                $pathItem -ne (Join-Path $Global:ANACONDA_DIR "Scripts") -and
                $pathItem -ne (Join-Path $Global:ANACONDA_DIR "Library\bin")) {
                $isOldPython = $true
            }
        }

        if ($pathItem -match "\\Python\d{2,3}\\" -or $pathItem -match "\\Python\d{2,3}$") {
            $isOldPython = $true
        }

        if ($isOldPython) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing old Python path (Machine): $pathItem" -Type "Warning"
            & $windowsPathFunctionPath "remove" $pathItem
            $cleanedCount++
        }
    }

    if ($cleanedCount -gt 0) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Removed $cleanedCount old Python path(s) from environment" -Type "Success"
        # Refresh PATH
        & $windowsPathFunctionPath "refresh-bat"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] No old Python paths found in environment" -Type "Info"
    }

    return $cleanedCount
}

# Function to uninstall old standalone Python via winget
function Remove-OldStandalonePython {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing old standalone Python installations via winget..." -Type "Info"

    # List of old Python winget IDs to check and remove
    $oldPythonIds = @(
        "Python.Python.3.13",
        "Python.Python.3.12",
        "Python.Python.3.11",
        "Python.Python.3.10",
        "Python.Python.3.9",
        "Python.Python.3.8"
    )

    foreach ($pythonId in $oldPythonIds) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER]   Attempting winget uninstall: $pythonId" -Type "Info"
        Invoke-ExternalCommand -Executable "winget" -Arguments @("uninstall", "--id", $pythonId, "--silent")
    }

    # Also check for old Python directories and remove from PATH
    $langCompilerDir = $Global:LANG_COMPILER_DIR
    if (Test-Path $langCompilerDir) {
        $oldPythonDirs = @(Get-ChildItem -Path $langCompilerDir -Directory -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -match '^python\d+$' -and $_.FullName -ne $Global:ANACONDA_DIR
        })

        foreach ($oldDir in $oldPythonDirs) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Found old Python directory: $($oldDir.FullName)" -Type "Warning"
            
            # Remove from PATH
            & $windowsPathFunctionPath "remove" $oldDir.FullName
            $scriptsDir = Join-Path $oldDir.FullName "Scripts"
            if (Test-Path $scriptsDir) {
                & $windowsPathFunctionPath "remove" $scriptsDir
            }

            Write-ColorMessage -Message "[Step $STEP_NUMBER] Removed old Python paths for: $($oldDir.Name)" -Type "Success"
        }
    }
}

# Function to install Anaconda3 using winget
function Install-Anaconda {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Anaconda3 using winget..." -Type "Warning"

    if (-not (Test-Path $Global:ANACONDA_DIR)) {
        New-Item -ItemType Directory -Path $Global:ANACONDA_DIR -Force | Out-Null
    }

    $result = Invoke-WingetCommand `
        -Id $AnacondaPackage.PackageId `
        -InstallDir $AnacondaPackage.AppCustomInstallDir `
        -Keyword $AnacondaPackage.Exec `
        -AdditionalKeywords $AnacondaPackage.AdditionalKeywords `
        -ForceToInstallDir $AnacondaPackage.ForceToInstallDir `
        -IncludeSystemPaths $AnacondaPackage.IncludeSystemPaths `
        -OnlyCheckFlag $false `
        -ForceInstall $false

    if ($result) {
        if (Test-Path $CondaExePath) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully installed Anaconda3" -Type "Success"
            New-Item -ItemType File -Path $AnacondaFlagFile -Force | Out-Null
            return $true
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Anaconda3 installation verification failed" -Type "Error"
            return $false
        }
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install Anaconda3 using winget" -Type "Error"
        return $false
    }
}

# Main step function
function Step9_InstallAnaconda {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing and configuring Anaconda3..." -Type "Info"

    # Step 1: Clean up old Python installations first
    Remove-OldPythonFromPath
    Remove-OldStandalonePython

    # Step 2: Install Anaconda3 using Invoke-WingetCommand
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Anaconda3 via Invoke-WingetCommand..." -Type "Info"
    
    $anacondaInstalled = Install-Anaconda
    if (-not $anacondaInstalled) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Failed to install Anaconda3" -Type "Error"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping configuration and verification" -Type "Warning"
        Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
        return $false
    }

    # Step 3: Ensure base Anaconda python version
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Ensuring base Anaconda python version..." -Type "Info"
    Ensure-CondaBasePython

    # Step 3: Always create conda virtual environment (never skip)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating conda virtual environment..." -Type "Info"
    Create-CondaEnvironment

    # Update executable paths to point to freshly created virtual environment
    $PythonExePath = Join-Path $CondaEnvDir "python.exe"
    $PipExePath = Join-Path $CondaEnvDir "Scripts\pip.exe"
    $UvExePath = Join-Path $CondaEnvDir "Scripts\uv.exe"
    $PipxExePath = Join-Path $CondaEnvDir "Scripts\pipx.exe"
    $PoetryExePath = Join-Path $CondaEnvDir "Scripts\poetry.exe"

    # Step 4: Always configure environment (never skip)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuring Anaconda3 environment..." -Type "Info"
    SetAnacondaEnv
    Configure-CondaMirror
    Configure-PipMirror

    # Step 5: Always install/upgrade pip tools in virtual environment (never skip)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing/upgrading pip tools in virtual environment..." -Type "Info"
    Install-PipTools
    Install-UV
    Install-Pipx
    Install-Poetry

    # Step 6: Always install common packages in virtual environment (never skip)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing common packages in virtual environment..." -Type "Info"
    Install-CommonPackages

    # Step 7: Always install required packages from third_party.py in virtual environment (never skip)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing required packages from third_party.py in virtual environment..." -Type "Info"
    Install-RequiredPythonPackages

    # Step 8: Always install optional packages in virtual environment (never skip)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing optional packages in virtual environment..." -Type "Info"
    Install-OptionalPythonPackages

    # Step 9: Always verify installation (never skip)
    PrintInstallResult

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Anaconda3 installation and configuration completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
    return $true
}

function Create-CondaEnvironment {
    if (-not (Test-Path $CondaExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Conda executable not found at $CondaExePath" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating conda virtual environment at $CondaEnvDir (Python $CondaEnvPythonVersion)..." -Type "Info"

    # Ensure target directory exists (parent)
    $targetParent = Split-Path $CondaEnvDir -Parent
    if (-not (Test-Path $targetParent)) {
        New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
    }

    # Remove existing environment (if any) using prefix path
    if (Test-Path $CondaEnvDir) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Conda environment already exists at $CondaEnvDir" -Type "Warning"
        $userInput = Read-Host "Recreate environment (this removes existing env)? (y/N)"
        if ($userInput -match '^(y|Y)$') {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing existing conda environment..." -Type "Warning"
            Invoke-ExternalCommand -Executable $CondaExePath -Arguments @("env", "remove", "-p", $CondaEnvDir, "-y")
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Keeping existing conda environment (skipping recreation)" -Type "Info"
            return $true
        }
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] No existing conda environment found at $CondaEnvDir (nothing to remove)" -Type "Info"
    }

    # Create new environment with explicit prefix
    Invoke-ExternalCommand -Executable $CondaExePath -Arguments @("create", "-p", $CondaEnvDir, "python=$CondaEnvPythonVersion", "-y")

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Conda virtual environment creation completed" -Type "Info"
    return $true
}

function Ensure-CondaBasePython {
    if (-not (Test-Path $CondaExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Conda executable not found at $CondaExePath" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Ensuring base Anaconda python version is $BasePythonVersion..." -Type "Info"
    Invoke-ExternalCommand -Executable $CondaExePath -Arguments @("install", "-n", "base", "python=$BasePythonVersion", "-y")

    $basePythonPath = Join-Path $Global:ANACONDA_DIR "python.exe"
    if (Test-Path $basePythonPath) {
        $targetPython = Join-Path $Global:ANACONDA_DIR ("python" + $BasePythonVersion + ".exe")
        Copy-Item -Path $basePythonPath -Destination $targetPython -Force
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Created $targetPython for base python" -Type "Info"
    }

    return $true
}

function SetAnacondaEnv {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting Anaconda3 environment variables..." -Type "Info"

    # Remove old Anaconda/virtual environment paths to avoid duplicates/conflicts
    $oldPaths = @(
        (Join-Path $Global:ANACONDA_DIR "envs\cv-env"),
        (Join-Path $Global:ANACONDA_DIR "envs\cv-env\Scripts"),
        $Global:ANACONDA_DIR,
        (Join-Path $Global:ANACONDA_DIR "Scripts"),
        (Join-Path $Global:ANACONDA_DIR "Library\bin"),
        $CondaEnvDir,
        (Join-Path $CondaEnvDir "Scripts"),
        (Join-Path $CondaEnvDir "Library\bin")
    )

    foreach ($oldPath in $oldPaths) {
        Remove-PathEntry -PathToRemove $oldPath
    }

    # Only add conda.exe directory to PATH (prevent conflicts with virtual environment)
    $condaScriptsDir = Join-Path $Global:ANACONDA_DIR "Scripts"
    Remove-PathEntry -PathToRemove $condaScriptsDir
    & $windowsPathFunctionPath "add" $condaScriptsDir

    # Add conda virtual environment to PATH
    Remove-PathEntry -PathToRemove $CondaEnvDir
    & $windowsPathFunctionPath "add" $CondaEnvDir
    $condaEnvScriptsDir = Join-Path $CondaEnvDir "Scripts"
    Remove-PathEntry -PathToRemove $condaEnvScriptsDir
    & $windowsPathFunctionPath "add" $condaEnvScriptsDir

    # Refresh environment variables in current session for immediate availability
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Refreshing environment variables in current session..." -Type "Info"
    & $windowsPathFunctionPath "refresh-bat"
    $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
    if (Test-Path $refreshBatchPath) {
        & $refreshBatchPath
    }

    # Manually refresh PATH in current PowerShell session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully configured Anaconda3 environment variables" -Type "Success"
}

function Configure-CondaMirror {
    $selectedRegion = Get-GlobalVar -Key "SELECTED_REGION"

    if ($selectedRegion -ne "China") {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Global region detected - using default conda channels" -Type "Info"
        return $true
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuring conda mirror for China region..." -Type "Info"

    if (-not (Test-Path $CondaExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Conda executable not found at $CondaExePath" -Type "Warning"
        return $false
    }

    # Configure conda to use Tsinghua mirror (always re-configure to ensure correctness)
    Invoke-ExternalCommand -Executable $CondaExePath -Arguments @("config", "--add", "channels", "https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main")
    Invoke-ExternalCommand -Executable $CondaExePath -Arguments @("config", "--add", "channels", "https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/r")
    Invoke-ExternalCommand -Executable $CondaExePath -Arguments @("config", "--add", "channels", "https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/conda-forge")
    Invoke-ExternalCommand -Executable $CondaExePath -Arguments @("config", "--set", "show_channel_urls", "yes")

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Conda mirror configured" -Type "Info"
    return $true
}

function Configure-PipMirror {
    $mirrorConfig = Get-PipMirrorConfig

    if ($null -eq $mirrorConfig) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Global region detected - using default PyPI (no mirror)" -Type "Info"
        return $true
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuring pip mirror for China region..." -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Mirror: $($mirrorConfig.IndexUrl)" -Type "Info"

    if (-not (Test-Path $PipExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Pip executable not found at $PipExePath" -Type "Warning"
        return $false
    }

    # Always re-configure to ensure correctness
    Invoke-ExternalCommand -Executable $PipExePath -Arguments @("config", "set", "global.index-url", $mirrorConfig.IndexUrl)
    Invoke-ExternalCommand -Executable $PipExePath -Arguments @("config", "set", "install.trusted-host", $mirrorConfig.TrustedHost)

    Write-ColorMessage -Message "[Step $STEP_NUMBER] pip mirror configured" -Type "Info"
    return $true
}

function Install-PipTools {
    if (-not (Test-Path $PythonExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Python executable not found, skipping pip upgrade" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Ensuring pip is up to date..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $pipArgs = @("install", "--upgrade", "pip")

    if ($mirrorConfig) {
        $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
    }

    $fullArgs = @("-m", "pip") + $pipArgs
    Invoke-ExternalCommand -Executable $PythonExePath -Arguments $fullArgs
}

function Install-UV {
    if (-not (Test-Path $PipExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Pip executable not found, skipping uv installation" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing/verifying uv..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $pipArgs = @("install", "--upgrade", "uv")

    if ($mirrorConfig) {
        $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
    }

    Invoke-ExternalCommand -Executable $PipExePath -Arguments $pipArgs
}

function Install-Pipx {
    if (-not (Test-Path $PipExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Pip executable not found, skipping pipx installation" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing/verifying pipx..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $pipArgs = @("install", "--upgrade", "pipx")

    if ($mirrorConfig) {
        $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
    }

    Invoke-ExternalCommand -Executable $PipExePath -Arguments $pipArgs

    if (Test-Path $PipxExePath) {
        & $PipxExePath ensurepath
    }
}

function Install-Poetry {
    if (-not (Test-Path $PipExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Pip executable not found, skipping poetry installation" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing/verifying poetry..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $pipArgs = @("install", "--upgrade", "poetry")

    if ($mirrorConfig) {
        $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
    }

    Invoke-ExternalCommand -Executable $PipExePath -Arguments $pipArgs
}

function Install-CommonPackages {
    if (-not (Test-Path $PipExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Pip executable not found, skipping common packages installation" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing common Python packages..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig

    foreach ($package in $CommonPythonPackages) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER]   Installing: $package" -Type "Info"

        $pipArgs = @("install", "--upgrade", $package)

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        Invoke-ExternalCommand -Executable $PipExePath -Arguments $pipArgs
    }
}

function Install-RequiredPythonPackages {
    if (-not (Test-Path $PipExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Pip executable not found, skipping required packages installation" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing required Python packages from third_party.py..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $allPackages = @($RequiredPythonPackages)

    # Add Windows-only packages on Windows
    if ($env:OS -match "Windows") {
        $allPackages += $WindowsOnlyPackages
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Including Windows-only packages" -Type "Info"
    }

    foreach ($package in $allPackages) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER]   Installing: $package" -Type "Info"

        $pipArgs = @("install", "--upgrade", $package)

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        Invoke-ExternalCommand -Executable $PipExePath -Arguments $pipArgs
    }
}

function Install-OptionalPythonPackages {
    if (-not (Test-Path $PipExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Pip executable not found, skipping optional packages installation" -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing optional Python packages..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig

    foreach ($package in $OptionalPythonPackages) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER]   Installing: $package" -Type "Info"

        $pipArgs = @("install", "--upgrade", $package)

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        Invoke-ExternalCommand -Executable $PipExePath -Arguments $pipArgs
    }
}

function PrintInstallResult {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Verifying installation..." -Type "Info"

    # Verify conda
    if (Test-Path $CondaExePath) {
        Invoke-ExternalCommand -Executable $CondaExePath -Arguments @("--version")
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Conda executable not found" -Type "Warning"
    }

    # Verify Python
    if (Test-Path $PythonExePath) {
        Invoke-ExternalCommand -Executable $PythonExePath -Arguments @("--version")
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Python executable not found" -Type "Warning"
    }

    # Verify pip
    if (Test-Path $PipExePath) {
        Invoke-ExternalCommand -Executable $PipExePath -Arguments @("--version")
    }

    # Verify uv
    if (Test-Path $UvExePath) {
        Invoke-ExternalCommand -Executable $UvExePath -Arguments @("--version")
    }

    # Verify pipx
    if (Test-Path $PipxExePath) {
        Invoke-ExternalCommand -Executable $PipxExePath -Arguments @("--version")
    }

    # Verify poetry
    if (Test-Path $PoetryExePath) {
        Invoke-ExternalCommand -Executable $PoetryExePath -Arguments @("--version")
    }
}

# Function to initialize conda for shell usage
function Initialize-CondaShell {
    if (-not (Test-Path $CondaExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Conda not installed, skipping shell initialization..." -Type "Warning"
        return
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Initializing conda for PowerShell..." -Type "Info"

    try {
        & $CondaExePath init powershell
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Conda shell initialization completed" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Note: Restart PowerShell to use 'conda activate'" -Type "Info"
    }
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] WARNING: Failed to initialize conda shell: $($_.Exception.Message)" -Type "Warning"
    }

    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}


# Main execution
Write-ColorMessage -Message "[Step $STEP_NUMBER] ===============================================" -Type "Info"
Write-ColorMessage -Message "[Step $STEP_NUMBER]   Anaconda3 Installation (Step $STEP_NUMBER)" -Type "Info"
Write-ColorMessage -Message "[Step $STEP_NUMBER] ===============================================" -Type "Info"

$installSuccess = Step9_InstallAnaconda

if ($installSuccess) {
    Initialize-CondaShell
    Write-ColorMessage -Message "[Step $STEP_NUMBER] All Anaconda3 components verified successfully" -Type "Success"
} else {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] WARNING: Anaconda3 installation encountered issues (continuing for inspection)" -Type "Warning"
}

Write-ColorMessage -Message "[Step $STEP_NUMBER] ===============================================" -Type "Info"
