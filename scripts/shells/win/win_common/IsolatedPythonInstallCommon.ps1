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

function Invoke-IsolatedPythonInstall {
    param([Parameter(Mandatory = $true)][string]$RuntimeKey, [Parameter(Mandatory = $true)][string]$StepLabel)

    $SCRIPT_INDEX = $StepLabel
    $IsolatedPythonVersion = (Get-Variable -Name "${RuntimeKey}_VERSION" -Scope Global).Value
    $IsolatedPythonInstallDir = (Get-Variable -Name "${RuntimeKey}_DIR" -Scope Global).Value
    $IsolatedPythonExePath = (Get-Variable -Name "${RuntimeKey}_EXE_PATH" -Scope Global).Value
    $IsolatedPythonPipPath = (Get-Variable -Name "${RuntimeKey}_PIP_PATH" -Scope Global).Value
    $IsolatedPythonFlagFile = (Get-Variable -Name "${RuntimeKey}_FLAG_FILE" -Scope Global).Value
    $IsolatedPythonArchiveUrl = (Get-Variable -Name "${RuntimeKey}_ARCHIVE_URL" -Scope Global).Value
    $IsolatedPythonArchiveFile = (Get-Variable -Name "${RuntimeKey}_ARCHIVE_FILE" -Scope Global).Value
    $IsolatedPythonGetPipUrl = $Global:PYTHON_GET_PIP_URL
    $RuntimeCommand = $RuntimeKey.ToLowerInvariant()
    $PipCommand = $RuntimeCommand.Replace('python', 'pip')
    $IsolatedPythonGetPipFile = Join-Path $Global:DOWNLOADS_DIR "${RuntimeCommand}-get-pip.py"
    $PygvarStoreDir = Join-Path (Join-Path $env:USERPROFILE '.core_node') '.global_vars'
    $WindowsPathFunctionScript = Join-Path $PSScriptRoot 'WindowsPathFunction.ps1'
    $WinEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
$pygvarKeyFile = $null
$pipCheck = $null
$wrapperSpecs = $null
$wrapperSpec = $null
$wrapperPath = $null
$existingContent = $null
$registeredExe = $null
$installed = $false
$installedVersion = $null
$archive = $null
$entry = $null
$entryPath = $null
$entryParent = $null
$runtimePathFile = $null
$runtimePathContent = $null
$sitePackagesDir = $null

function Test-IsolatedPythonExe {
    param([Parameter(Mandatory = $true)][string]$PythonExe)

    return (Test-Path -LiteralPath $PythonExe -PathType Leaf)
}

function Register-IsolatedPythonStorage {
    param([Parameter(Mandatory = $true)][string]$InstallSource)

    Set-GlobalVar -Key "${RuntimeKey}_EXE_PATH" -Value $IsolatedPythonExePath
    Set-GlobalVar -Key "${RuntimeKey}_PIP_PATH" -Value $IsolatedPythonPipPath
    Set-GlobalVar -Key "${RuntimeKey}_VERSION" -Value $IsolatedPythonVersion
    Set-GlobalVar -Key "${RuntimeKey}_INSTALL_SOURCE" -Value $InstallSource

    # Mirror into the pycore pygvar store so resolve_engine_base_python() can find it.
    if (-not (Test-Path -LiteralPath $PygvarStoreDir)) {
        New-Item -ItemType Directory -Path $PygvarStoreDir -Force | Out-Null
    }
    $pygvarKeyFile = Join-Path $PygvarStoreDir "${RuntimeKey}_EXE_PATH"
    [System.IO.File]::WriteAllText($pygvarKeyFile, $IsolatedPythonExePath, [System.Text.UTF8Encoding]::new($false))
    [Environment]::SetEnvironmentVariable("${RuntimeKey}_EXE_PATH", $IsolatedPythonExePath, "Process")
}

function Ensure-IsolatedPythonPip {
    $runtimePathFile = Join-Path (Split-Path $IsolatedPythonExePath -Parent) "${RuntimeCommand}._pth"
    $sitePackagesDir = Join-Path (Split-Path $IsolatedPythonExePath -Parent) "Lib\site-packages"
    if (Test-Path -LiteralPath $runtimePathFile -PathType Leaf) {
        if (-not (Test-Path -LiteralPath $sitePackagesDir -PathType Container)) {
            New-Item -ItemType Directory -Path $sitePackagesDir -Force | Out-Null
        }
        $runtimePathContent = @(Get-Content -LiteralPath $runtimePathFile)
        if ($runtimePathContent -contains "#import site") {
            $runtimePathContent = @($runtimePathContent | ForEach-Object { if ($_ -eq "#import site") { "import site" } else { $_ } })
        }
        if ($runtimePathContent -notcontains "import site") {
            $runtimePathContent = @($runtimePathContent; "import site")
        }
        if ($runtimePathContent -notcontains "Lib\site-packages") {
            $runtimePathContent = @($runtimePathContent; "Lib\site-packages")
        }
        Set-Content -LiteralPath $runtimePathFile -Value $runtimePathContent -Encoding ASCII
    }
    Write-ColorMessage -Message "$SCRIPT_INDEX Ensuring pip for Python $IsolatedPythonVersion..." -Type "Info"

    Write-ColorMessage -Message "$SCRIPT_INDEX Command: Test-PycorePythonModulePresent -PythonExe `"$IsolatedPythonExePath`" -ModuleName pip" -Type "Info"
    if (Test-PycorePythonModulePresent -PythonExe $IsolatedPythonExePath -ModuleName "pip") {
        Write-ColorMessage -Message "$SCRIPT_INDEX Command: & `"$IsolatedPythonExePath`" -m pip --version" -Type "Info"
        $pipCheck = ((& $IsolatedPythonExePath -m pip --version) | Out-String).Trim()
        Write-ColorMessage -Message "$SCRIPT_INDEX   $pipCheck" -Type "Info"
        Ensure-IsolatedPythonVenvCreator
        return
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX pip missing; bootstrapping via get-pip.py..." -Type "Info"
    if (-not (Test-Path -LiteralPath $Global:DOWNLOADS_DIR -PathType Container)) {
        New-Item -ItemType Directory -Path $Global:DOWNLOADS_DIR -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $IsolatedPythonGetPipFile -PathType Leaf)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Command: Invoke-WebRequest -Uri `"$IsolatedPythonGetPipUrl`" -OutFile `"$IsolatedPythonGetPipFile`" -UseBasicParsing -ErrorAction Stop" -Type "Info"
        Invoke-WebRequest -Uri $IsolatedPythonGetPipUrl -OutFile $IsolatedPythonGetPipFile -UseBasicParsing -ErrorAction Stop
    }
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: & `"$IsolatedPythonExePath`" `"$IsolatedPythonGetPipFile`" --no-warn-script-location" -Type "Info"
    & $IsolatedPythonExePath $IsolatedPythonGetPipFile --no-warn-script-location

    Write-ColorMessage -Message "$SCRIPT_INDEX Command: Test-PycorePythonModulePresent -PythonExe `"$IsolatedPythonExePath`" -ModuleName pip" -Type "Info"
    if (-not (Test-PycorePythonModulePresent -PythonExe $IsolatedPythonExePath -ModuleName "pip")) {
        throw "$SCRIPT_INDEX pip bootstrap did not succeed for $IsolatedPythonExePath"
    }
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: & `"$IsolatedPythonExePath`" -m pip --version" -Type "Info"
    $pipCheck = ((& $IsolatedPythonExePath -m pip --version) | Out-String).Trim()
    Write-ColorMessage -Message "$SCRIPT_INDEX   $pipCheck" -Type "Info"
    Ensure-IsolatedPythonVenvCreator
}

function Ensure-IsolatedPythonVenvCreator {
    $runtimePathFile = Join-Path (Split-Path $IsolatedPythonExePath -Parent) "${RuntimeCommand}._pth"
    if (-not (Test-Path -LiteralPath $runtimePathFile -PathType Leaf)) { return }
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: Test-PycorePythonModulePresent -PythonExe `"$IsolatedPythonExePath`" -ModuleName virtualenv" -Type "Info"
    if (Test-PycorePythonModulePresent -PythonExe $IsolatedPythonExePath -ModuleName "virtualenv") { return }
    Write-ColorMessage -Message "$SCRIPT_INDEX Command: & `"$IsolatedPythonExePath`" -m pip install --no-warn-script-location virtualenv" -Type "Info"
    & $IsolatedPythonExePath -m pip install --no-warn-script-location virtualenv
    if (-not (Test-PycorePythonModulePresent -PythonExe $IsolatedPythonExePath -ModuleName "virtualenv")) {
        throw "$SCRIPT_INDEX virtualenv installation did not succeed for $IsolatedPythonExePath"
    }
}

function Ensure-IsolatedPythonCommandWrappers {
    Write-ColorMessage -Message "$SCRIPT_INDEX Ensuring ${RuntimeCommand} / ${PipCommand} command entries..." -Type "Info"

    $wrapperSpecs = @(
        @{
            FileName = "${RuntimeCommand}.cmd"
            Content = "@echo off`r`nrem Isolated Python $IsolatedPythonVersion entry; forwards all arguments to the absolute interpreter.`r`n`"$IsolatedPythonExePath`" %*`r`nexit /b %ERRORLEVEL%`r`n"
        },
        @{
            FileName = "${PipCommand}.cmd"
            Content = "@echo off`r`nrem pip entry bound to the isolated Python $IsolatedPythonVersion interpreter.`r`n`"$IsolatedPythonExePath`" -m pip %*`r`nexit /b %ERRORLEVEL%`r`n"
        }
    )

    foreach ($wrapperSpec in $wrapperSpecs) {
        $wrapperPath = Join-Path $WinEnvsDir $wrapperSpec.FileName
        if (Test-Path -LiteralPath $wrapperPath) {
            $existingContent = (Get-Content -LiteralPath $wrapperPath -Raw -ErrorAction SilentlyContinue)
            if ($existingContent -and $existingContent.Contains($IsolatedPythonExePath)) {
                Write-ColorMessage -Message "$SCRIPT_INDEX   [SKIP] $($wrapperSpec.FileName) already linked to this interpreter" -Type "Info"
                continue
            }
            Write-ColorMessage -Message "$SCRIPT_INDEX   [CONFLICT] $($wrapperSpec.FileName) exists and is not managed by this project; leaving it untouched: $wrapperPath" -Type "Warning"
            continue
        }
        Write-ColorMessage -Message "$SCRIPT_INDEX Command: & `"$WindowsPathFunctionScript`" addscript @'`n$($wrapperSpec.Content)'@ `"$($wrapperSpec.FileName)`"" -Type "Info"
        & $WindowsPathFunctionScript "addscript" $wrapperSpec.Content $wrapperSpec.FileName
        Write-ColorMessage -Message "$SCRIPT_INDEX   Linked: $(Join-Path $WinEnvsDir $wrapperSpec.FileName)" -Type "Info"
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Command: & `"$WindowsPathFunctionScript`" add `"$WinEnvsDir`" -SkipInit" -Type "Info"
    & $WindowsPathFunctionScript "add" $WinEnvsDir -SkipInit
}

function Install-IsolatedPythonWithArchive {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing from the official Python ZIP: $IsolatedPythonArchiveUrl" -Type "Info"

    if (-not (Test-Path -LiteralPath $Global:DOWNLOADS_DIR -PathType Container)) {
        New-Item -ItemType Directory -Path $Global:DOWNLOADS_DIR -Force | Out-Null
    }
    if (-not (Test-Path -LiteralPath $IsolatedPythonArchiveFile -PathType Leaf)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Command: Invoke-WebRequest -Uri `"$IsolatedPythonArchiveUrl`" -OutFile `"$IsolatedPythonArchiveFile`" -UseBasicParsing -ErrorAction Stop" -Type "Info"
        Invoke-WebRequest -Uri $IsolatedPythonArchiveUrl -OutFile $IsolatedPythonArchiveFile -UseBasicParsing -ErrorAction Stop
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($IsolatedPythonArchiveFile)
    try {
        foreach ($entry in $archive.Entries) {
            $entryPath = Join-Path $IsolatedPythonInstallDir $entry.FullName
            if ([string]::IsNullOrEmpty($entry.Name)) {
                if (-not (Test-Path -LiteralPath $entryPath -PathType Container)) {
                    New-Item -ItemType Directory -Path $entryPath -Force | Out-Null
                }
                continue
            }
            if (Test-Path -LiteralPath $entryPath -PathType Leaf) {
                continue
            }
            $entryParent = Split-Path $entryPath -Parent
            if (-not (Test-Path -LiteralPath $entryParent -PathType Container)) {
                New-Item -ItemType Directory -Path $entryParent -Force | Out-Null
            }
            Write-ColorMessage -Message "$SCRIPT_INDEX Extract: $($entry.FullName) -> $entryPath" -Type "Info"
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $entryPath, $false)
        }
    } finally {
        $archive.Dispose()
    }

    return (Test-IsolatedPythonExe -PythonExe $IsolatedPythonExePath)
}
function Install-IsolatedPython {
    Write-ColorMessage -Message "$SCRIPT_INDEX Installing isolated Python $IsolatedPythonVersion (keeps default Python 3.13 untouched)..." -Type "Info"

    # 1) Repair path: interpreter already at the project location.
    if (Test-IsolatedPythonExe -PythonExe $IsolatedPythonExePath) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Python $IsolatedPythonVersion already installed at $IsolatedPythonExePath" -Type "Success"
        Ensure-IsolatedPythonPip
        Ensure-IsolatedPythonCommandWrappers
        Register-IsolatedPythonStorage -InstallSource "existing"
        New-Item -ItemType File -Path $IsolatedPythonFlagFile -Force | Out-Null
        return
    }

    # 2) Registered path from a previous run that moved outside the default directory.
    $registeredExe = Get-GlobalVar -Key "${RuntimeKey}_EXE_PATH"
    if ($registeredExe -and (Test-IsolatedPythonExe -PythonExe $registeredExe)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Registered Python $IsolatedPythonVersion found at $registeredExe" -Type "Info"
        $IsolatedPythonExePath = $registeredExe
        $IsolatedPythonPipPath = Join-Path (Split-Path $registeredExe -Parent) "Scripts\pip.exe"
        Ensure-IsolatedPythonPip
        Ensure-IsolatedPythonCommandWrappers
        Register-IsolatedPythonStorage -InstallSource "registered"
        New-Item -ItemType File -Path $IsolatedPythonFlagFile -Force | Out-Null
        return
    }

    # 3) Fresh install into the dedicated directory (no PATH injection, no file associations).
    if (-not (Test-Path -LiteralPath $IsolatedPythonInstallDir)) {
        New-Item -ItemType Directory -Path $IsolatedPythonInstallDir -Force | Out-Null
    }

    $installed = Install-IsolatedPythonWithArchive

    if (-not $installed) {
        Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Python $IsolatedPythonVersion executable not found at $IsolatedPythonExePath" -Type "Error"
        return
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Python $IsolatedPythonVersion installed successfully" -Type "Success"
    $installedVersion = Get-PythonVersionTextFromExe -PythonExe $IsolatedPythonExePath
    if ($installedVersion) {
        Write-ColorMessage -Message "$SCRIPT_INDEX $installedVersion" -Type "Info"
    }
    Write-ColorMessage -Message "$SCRIPT_INDEX Python path: $IsolatedPythonExePath" -Type "Info"

    Ensure-IsolatedPythonPip
    Ensure-IsolatedPythonCommandWrappers
    Register-IsolatedPythonStorage -InstallSource "official_zip"
    New-Item -ItemType File -Path $IsolatedPythonFlagFile -Force | Out-Null
}


    Install-IsolatedPython
}
