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

$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"

. (Join-Path $winCommonDir "GlobalVars.ps1")
. (Join-Path $winCommonDir "CommonFunc.ps1")
. (Join-Path $winCommonDir "WindowsPathFunction.ps1")

$STEP_NUMBER = 9
$SCRIPT_INDEX = "[Step $STEP_NUMBER]"

# Python package definition
# Version is defined in GlobalVars.ps1 to prevent multiple definitions
$PythonVersion = $Global:PYTHON_VERSION
$PythonVersionCompact = $Global:PYTHON_VERSION_COMPACT
$PythonInstallDir = $Global:PYTHON_DIR
$PythonExePath = $Global:PYTHON_EXE_PATH
$PipExePath = $Global:PIP_EXE_PATH
$UvExePath = $Global:UV_EXE_PATH
$PipxExePath = $Global:PIPX_EXE_PATH
$PoetryExePath = $Global:POETRY_EXE_PATH

# Get WindowsPathFunction.ps1 path for PATH management
$windowsPathFunctionPath = Join-Path $winCommonDir "WindowsPathFunction.ps1"

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
        & $windowsPathFunctionPath "remove" $oldDir.FullName

        # Also remove Scripts directory from PATH
        $oldScriptsDir = Join-Path $oldDir.FullName "Scripts"
        if (Test-Path $oldScriptsDir) {
            & $windowsPathFunctionPath "remove" $oldScriptsDir
        }

        # Ask before deleting directory
        Write-ColorMessage -Message "$SCRIPT_INDEX   Delete old installation? (y/N, timeout 5s, default: N)" -Type "Warning"
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
    & $windowsPathFunctionPath "refresh-bat"
}

function Install-Python {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Python $PythonVersion..." -Type "Info"

    # Remove old versions first
    Remove-OldPythonVersions

    # Check if current version already installed
    if (Test-Path $PythonExePath) {
        $existingVersion = & $PythonExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX Python already installed: $existingVersion" -Type "Success"
            Write-ColorMessage -Message "$SCRIPT_INDEX Path: $PythonExePath" -Type "Info"

            # Ensure it's in PATH
            Write-ColorMessage -Message "$SCRIPT_INDEX Adding Python to PATH..." -Type "Info"
            & $windowsPathFunctionPath "add" $PythonInstallDir
            & $windowsPathFunctionPath "add" (Join-Path $PythonInstallDir "Scripts")

            return $true
        }
    }

    # Install Python using winget
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Python via winget..." -Type "Warning"
    Write-ColorMessage -Message "$SCRIPT_INDEX Package ID: $($Global:PYTHON_WINGET_ID)" -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX Install directory: $PythonInstallDir" -Type "Info"

    try {
        $wingetArgs = @(
            "install",
            "--id", $Global:PYTHON_WINGET_ID,
            "--location", $PythonInstallDir,
            "--force",
            "--accept-package-agreements",
            "--accept-source-agreements"
        )

        $process = Start-Process -FilePath "winget" -ArgumentList $wingetArgs -Wait -PassThru -NoNewWindow

        if ($process.ExitCode -ne 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: winget exit code $($process.ExitCode)" -Type "Warning"
        }

        # Verify installation
        if (Test-Path $PythonExePath) {
            $installedVersion = & $PythonExePath --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "$SCRIPT_INDEX Python installed successfully: $installedVersion" -Type "Success"
                Write-ColorMessage -Message "$SCRIPT_INDEX Path: $PythonExePath" -Type "Info"

                # Add to PATH
                Write-ColorMessage -Message "$SCRIPT_INDEX Adding Python to PATH..." -Type "Info"
                & $windowsPathFunctionPath "add" $PythonInstallDir
                & $windowsPathFunctionPath "add" (Join-Path $PythonInstallDir "Scripts")

                return $true
            } else {
                Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Python verification failed" -Type "Error"
                return $false
            }
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Python executable not found after installation" -Type "Error"
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

    try {
        # Configure pip
        & $PipExePath config set global.index-url $mirrorConfig.IndexUrl
        & $PipExePath config set install.trusted-host $mirrorConfig.TrustedHost

        Write-ColorMessage -Message "$SCRIPT_INDEX pip mirror configured successfully" -Type "Success"
        return $true
    } catch {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Failed to configure pip mirror: $($_.Exception.Message)" -Type "Warning"
        return $false
    }
}

function Install-PipTools {
    Write-ColorMessage -Message "$SCRIPT_INDEX Ensuring pip is up to date..." -Type "Info"

    try {
        $mirrorConfig = Get-PipMirrorConfig
        $pipArgs = @("install", "--upgrade", "pip")

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        & $PythonExePath -m pip @pipArgs | Out-Null

        if ($LASTEXITCODE -eq 0) {
            $pipVersion = & $PipExePath --version 2>&1
            Write-ColorMessage -Message "$SCRIPT_INDEX pip updated: $pipVersion" -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: pip upgrade had issues" -Type "Warning"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Failed to upgrade pip: $($_.Exception.Message)" -Type "Warning"
        return $false
    }
}

function Install-UV {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing/verifying uv..." -Type "Info"

    try {
        $mirrorConfig = Get-PipMirrorConfig
        $pipArgs = @("install", "--upgrade", "uv")

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        & $PipExePath @pipArgs | Out-Null

        if ($LASTEXITCODE -eq 0 -and (Test-Path $UvExePath)) {
            $uvVersion = & $UvExePath --version 2>&1
            Write-ColorMessage -Message "$SCRIPT_INDEX uv installed: $uvVersion" -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: uv installation had issues" -Type "Warning"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Failed to install uv: $($_.Exception.Message)" -Type "Warning"
        return $false
    }
}

function Install-Pipx {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing/verifying pipx..." -Type "Info"

    try {
        $mirrorConfig = Get-PipMirrorConfig
        $pipArgs = @("install", "--upgrade", "pipx")

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        & $PipExePath @pipArgs | Out-Null

        if ($LASTEXITCODE -eq 0 -and (Test-Path $PipxExePath)) {
            $pipxVersion = & $PipxExePath --version 2>&1
            Write-ColorMessage -Message "$SCRIPT_INDEX pipx installed: $pipxVersion" -Type "Success"

            # Ensure pipx path
            & $PipxExePath ensurepath | Out-Null

            return $true
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: pipx installation had issues" -Type "Warning"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Failed to install pipx: $($_.Exception.Message)" -Type "Warning"
        return $false
    }
}

function Install-Poetry {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing/verifying poetry..." -Type "Info"

    try {
        $mirrorConfig = Get-PipMirrorConfig
        $pipArgs = @("install", "--upgrade", "poetry")

        if ($mirrorConfig) {
            $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
        }

        & $PipExePath @pipArgs | Out-Null

        if ($LASTEXITCODE -eq 0 -and (Test-Path $PoetryExePath)) {
            $poetryVersion = & $PoetryExePath --version 2>&1
            Write-ColorMessage -Message "$SCRIPT_INDEX poetry installed: $poetryVersion" -Type "Success"
            return $true
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: poetry installation had issues" -Type "Warning"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: Failed to install poetry: $($_.Exception.Message)" -Type "Warning"
        return $false
    }
}

function Install-CommonPackages {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing common Python packages..." -Type "Info"

    $mirrorConfig = Get-PipMirrorConfig
    $successCount = 0

    foreach ($package in $CommonPythonPackages) {
        try {
            Write-ColorMessage -Message "$SCRIPT_INDEX   Installing: $package" -Type "Info"

            $pipArgs = @("install", "--upgrade", $package)

            if ($mirrorConfig) {
                $pipArgs += @("-i", $mirrorConfig.IndexUrl, "--trusted-host", $mirrorConfig.TrustedHost)
            }

            & $PipExePath @pipArgs | Out-Null

            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "$SCRIPT_INDEX   SUCCESS: $package" -Type "Success"
                $successCount++
            } else {
                Write-ColorMessage -Message "$SCRIPT_INDEX   WARNING: Failed to install $package" -Type "Warning"
            }
        } catch {
            Write-ColorMessage -Message "$SCRIPT_INDEX   WARNING: Exception installing $package - $($_.Exception.Message)" -Type "Warning"
        }
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Installed $successCount/$($CommonPythonPackages.Count) common packages" -Type "Info"
    return $successCount -gt 0
}

function Test-PythonInstallation {
    Write-ColorMessage -Message "$SCRIPT_INDEX Testing Python installation..." -Type "Info"

    $allSuccess = $true

    # Test Python
    if (Test-Path $PythonExePath) {
        $pythonVersion = & $PythonExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   Python: $pythonVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   Python: FAILED" -Type "Error"
            $allSuccess = $false
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   Python: NOT FOUND at $PythonExePath" -Type "Error"
        $allSuccess = $false
    }

    # Test pip
    if (Test-Path $PipExePath) {
        $pipVersion = & $PipExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   pip: $pipVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   pip: FAILED" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   pip: NOT FOUND" -Type "Warning"
    }

    # Test uv
    if (Test-Path $UvExePath) {
        $uvVersion = & $UvExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   uv: $uvVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   uv: FAILED" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   uv: NOT FOUND" -Type "Warning"
    }

    # Test pipx
    if (Test-Path $PipxExePath) {
        $pipxVersion = & $PipxExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   pipx: $pipxVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   pipx: FAILED" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   pipx: NOT FOUND" -Type "Warning"
    }

    # Test poetry
    if (Test-Path $PoetryExePath) {
        $poetryVersion = & $PoetryExePath --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "$SCRIPT_INDEX   poetry: $poetryVersion" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX   poetry: FAILED" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   poetry: NOT FOUND" -Type "Warning"
    }

    return $allSuccess
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
