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

$STEP_NUMBER = 13
$SCRIPT_INDEX = "[Step 13]"

# Isolated Python 3.10 runtime for CosyVoice / Fish Speech / VoxCPM2 / GPT-SoVITS / MeloTTS.
# This interpreter never replaces the default Python 3.13 and never touches PATH priority.
$Python310Version = $Global:PYTHON310_VERSION
$Python310WingetId = $Global:PYTHON310_WINGET_ID
$Python310InstallDir = $Global:PYTHON310_DIR
$Python310ScriptsDir = $Global:PYTHON310_SCRIPTS_DIR
$Python310ExePath = $Global:PYTHON310_EXE_PATH
$Python310PipPath = $Global:PYTHON310_PIP_PATH
$Python310FlagFile = $Global:PYTHON310_FLAG_FILE
$Python310WebInstallerUrl = "https://www.python.org/ftp/python/3.10.11/python-3.10.11-amd64.exe"
$Python310WebInstallerFile = Join-Path $Global:DOWNLOADS_DIR "python-3.10.11-amd64.exe"
$PygvarStoreDir = Join-Path (Join-Path $env:USERPROFILE ".core_node") ".global_vars"
$WindowsPathFunctionScript = Join-Path $winCommonDir "WindowsPathFunction.ps1"
$WinEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR

function Test-Python310Exe {
    param([Parameter(Mandatory = $true)][string]$PythonExe)

    if (-not (Test-Path -LiteralPath $PythonExe)) {
        return $false
    }
    $minorText = ((& $PythonExe -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>&1) | Out-String).Trim()
    return ($minorText -eq $Python310Version)
}

function Register-Python310Storage {
    param([Parameter(Mandatory = $true)][string]$InstallSource)

    Set-GlobalVar -Key "PYTHON310_EXE_PATH" -Value $Python310ExePath
    Set-GlobalVar -Key "PYTHON310_PIP_PATH" -Value $Python310PipPath
    Set-GlobalVar -Key "PYTHON310_VERSION" -Value $Python310Version
    Set-GlobalVar -Key "PYTHON310_INSTALL_SOURCE" -Value $InstallSource

    # Mirror into the pycore pygvar store so resolve_engine_base_python() can find it.
    if (-not (Test-Path -LiteralPath $PygvarStoreDir)) {
        New-Item -ItemType Directory -Path $PygvarStoreDir -Force | Out-Null
    }
    $pygvarKeyFile = Join-Path $PygvarStoreDir "PYTHON310_EXE_PATH"
    Set-Content -LiteralPath $pygvarKeyFile -Value $Python310ExePath -Encoding UTF8 -NoNewline
}

function Ensure-Python310Pip {
    Write-ColorMessage -Message "$SCRIPT_INDEX Ensuring pip for Python $Python310Version..." -Type "Info"

    $pipCheck = ((& $Python310ExePath -m pip --version 2>&1) | Out-String).Trim()
    if ($LASTEXITCODE -eq 0 -and $pipCheck) {
        Write-ColorMessage -Message "$SCRIPT_INDEX   $pipCheck" -Type "Info"
        return
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX pip missing; bootstrapping via ensurepip..." -Type "Info"
    & $Python310ExePath -m ensurepip --upgrade

    $pipCheckAfter = ((& $Python310ExePath -m pip --version 2>&1) | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        Write-ColorMessage -Message "$SCRIPT_INDEX WARNING: pip bootstrap did not succeed: $pipCheckAfter" -Type "Warning"
    }
}

function Ensure-Python310CommandWrappers {
    Write-ColorMessage -Message "$SCRIPT_INDEX Ensuring python310 / pip310 command entries..." -Type "Info"

    $wrapperSpecs = @(
        @{
            FileName = "python310.cmd"
            Content = "@echo off`r`nrem Isolated Python $Python310Version entry; forwards all arguments to the absolute interpreter.`r`n`"$Python310ExePath`" %*`r`nexit /b %ERRORLEVEL%`r`n"
        },
        @{
            FileName = "pip310.cmd"
            Content = "@echo off`r`nrem pip entry bound to the isolated Python $Python310Version interpreter.`r`n`"$Python310ExePath`" -m pip %*`r`nexit /b %ERRORLEVEL%`r`n"
        }
    )

    foreach ($wrapperSpec in $wrapperSpecs) {
        $wrapperPath = Join-Path $WinEnvsDir $wrapperSpec.FileName
        if (Test-Path -LiteralPath $wrapperPath) {
            $existingContent = (Get-Content -LiteralPath $wrapperPath -Raw -ErrorAction SilentlyContinue)
            if ($existingContent -and $existingContent.Contains($Python310ExePath)) {
                Write-ColorMessage -Message "$SCRIPT_INDEX   [SKIP] $($wrapperSpec.FileName) already linked to this interpreter" -Type "Info"
                continue
            }
            Write-ColorMessage -Message "$SCRIPT_INDEX   [CONFLICT] $($wrapperSpec.FileName) exists and is not managed by this project; leaving it untouched: $wrapperPath" -Type "Warning"
            continue
        }
        & $WindowsPathFunctionScript "addscript" $wrapperSpec.Content $wrapperSpec.FileName
        Write-ColorMessage -Message "$SCRIPT_INDEX   Linked: $(Join-Path $WinEnvsDir $wrapperSpec.FileName)" -Type "Info"
    }
}

function Install-Python310WithWinget {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing Python $Python310Version via winget ($Python310WingetId)..." -Type "Info"

    $wingetArgs = @(
        "install",
        "--id", $Python310WingetId,
        "--location", $Python310InstallDir,
        "--force",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--override", "/quiet InstallAllUsers=0 PrependPath=0 AssociateFiles=0 Include_launcher=0 InstallLauncherAllUsers=0"
    )

    Write-ColorMessage -Message "$SCRIPT_INDEX Command: winget $($wingetArgs -join ' ')" -Type "Info"
    & winget @wingetArgs

    return (Test-Python310Exe -PythonExe $Python310ExePath)
}

function Install-Python310WithWebInstaller {
    Write-ColorMessage -Message "$SCRIPT_INDEX Falling back to the official Python 3.10.11 web installer..." -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX Source: $Python310WebInstallerUrl" -Type "Info"

    if (-not (Test-Path -LiteralPath $Global:DOWNLOADS_DIR)) {
        New-Item -ItemType Directory -Path $Global:DOWNLOADS_DIR -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $Python310WebInstallerFile)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Downloading installer to $Python310WebInstallerFile ..." -Type "Info"
        Invoke-WebRequest -Uri $Python310WebInstallerUrl -OutFile $Python310WebInstallerFile -UseBasicParsing
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX   [SKIP] Installer already downloaded" -Type "Info"
    }

    $installerArgs = @(
        "/quiet",
        "InstallAllUsers=0",
        "TargetDir=$Python310InstallDir",
        "PrependPath=0",
        "AssociateFiles=0",
        "Include_launcher=0",
        "InstallLauncherAllUsers=0",
        "Shortcuts=0"
    )
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: $Python310WebInstallerFile $($installerArgs -join ' ')" -Type "Info"
    $installerProcess = Start-Process -FilePath $Python310WebInstallerFile -ArgumentList $installerArgs -Wait -PassThru -WindowStyle Hidden
    if ($installerProcess.ExitCode -ne 0) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Web installer reported exit code $($installerProcess.ExitCode)" -Type "Warning"
    }

    return (Test-Python310Exe -PythonExe $Python310ExePath)
}

function Install-Python310 {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing isolated Python $Python310Version (keeps default Python 3.13 untouched)..." -Type "Info"

    # 1) Repair path: interpreter already at the project location.
    if (Test-Python310Exe -PythonExe $Python310ExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Python $Python310Version already installed at $Python310ExePath" -Type "Success"
        Ensure-Python310Pip
        Ensure-Python310CommandWrappers
        Register-Python310Storage -InstallSource "existing"
        New-Item -ItemType File -Path $Python310FlagFile -Force | Out-Null
        return
    }

    # 2) Registered path from a previous run that moved outside the default directory.
    $registeredExe = Get-GlobalVar -Key "PYTHON310_EXE_PATH"
    if ($registeredExe -and (Test-Python310Exe -PythonExe $registeredExe)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Registered Python $Python310Version found at $registeredExe" -Type "Info"
        $script:Python310ExePath = $registeredExe
        $script:Python310PipPath = Join-Path (Split-Path $registeredExe -Parent) "Scripts\pip.exe"
        Ensure-Python310Pip
        Ensure-Python310CommandWrappers
        Register-Python310Storage -InstallSource "registered"
        New-Item -ItemType File -Path $Python310FlagFile -Force | Out-Null
        return
    }

    # 3) Fresh install into the dedicated directory (no PATH injection, no file associations).
    if (-not (Test-Path -LiteralPath $Python310InstallDir)) {
        New-Item -ItemType Directory -Path $Python310InstallDir -Force | Out-Null
    }

    $installed = Install-Python310WithWinget
    if (-not $installed) {
        $installed = Install-Python310WithWebInstaller
    }

    if (-not $installed) {
        Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Python $Python310Version executable not found at $Python310ExePath" -Type "Error"
        return
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Python $Python310Version installed successfully" -Type "Success"
    $installedVersion = Get-PythonVersionTextFromExe -PythonExe $Python310ExePath
    if ($installedVersion) {
        Write-ColorMessage -Message "$SCRIPT_INDEX $installedVersion" -Type "Info"
    }
    Write-ColorMessage -Message "$SCRIPT_INDEX Python path: $Python310ExePath" -Type "Info"

    Ensure-Python310Pip
    Ensure-Python310CommandWrappers
    Register-Python310Storage -InstallSource "winget_or_web"
    New-Item -ItemType File -Path $Python310FlagFile -Force | Out-Null
}

# Main execution
Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
Write-ColorMessage -Message "$SCRIPT_INDEX   Isolated Python $Python310Version Installation (Step $STEP_NUMBER)" -Type "Info"
Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"

Install-Python310

if (Test-Python310Exe -PythonExe $Python310ExePath) {
    Write-ColorMessage -Message "$SCRIPT_INDEX python310 / pip310 commands are available; default python remains unchanged" -Type "Success"
} else {
    Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Python $Python310Version installation failed" -Type "Error"
}

Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
