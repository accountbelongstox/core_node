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

. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$STEP_NUMBER = 25

Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Apktool..." -Type "Info"

# Ensure installation directory exists
if (-not (Test-Path $APKTOOL_INSTALL_DIR)) {
    Write-ColorMessage -Message "Creating installation directory: $APKTOOL_INSTALL_DIR" -Type "Info"
    try {
        New-Item -ItemType Directory -Path $APKTOOL_INSTALL_DIR -Force | Out-Null
        Write-ColorMessage -Message "Installation directory created successfully." -Type "Success"
    } catch {
        Write-ColorMessage -Message "Failed to create installation directory: $_" -Type "Error"
        exit 1
    }
} else {
    Write-ColorMessage -Message "Installation directory already exists." -Type "Info"
}

$apkPs1Content = @'
<#
.SYNOPSIS
    PowerShell version of Apktool wrapper script
.DESCRIPTION
    Handles Apktool operations with UTF-8 support and Java detection
.NOTES
    Version: 1.0
#>

# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Java executable detection
$javaExe = "java.exe"
if ($env:JAVA_HOME) {
    $javaExe = Join-Path $env:JAVA_HOME "bin\java.exe"
}

# Find the highest version .jar available
$scriptDir = $PSScriptRoot
$baseName = "apktool_"
$maxVersion = 0

if (Test-Path (Join-Path $scriptDir "apktool.jar")) {
    $jarFile = "apktool.jar"
} else {
    Get-ChildItem -Path $scriptDir -Filter "${baseName}*.jar" | ForEach-Object {
        $version = [regex]::Match($_.Name, "${baseName}(\d+)\.jar").Groups[1].Value
        if ($version -and [int]$version -gt $maxVersion) {
            $maxVersion = [int]$version
            $jarFile = $_.Name
        }
    }
}

# Determine fast command mode
$fastCommand = $null
if ($args.Count -eq 1) {
    $item = Get-Item $args[0] -ErrorAction SilentlyContinue
    if ($item) {
        if ($item.PSIsContainer) {
            # Directory - rebuild
            $fastCommand = "b"
        } elseif ($item.Extension -eq ".apk") {
            # APK file - unpack
            $fastCommand = "d"
        }
    }
}

# Build Java command arguments
$javaArgs = @(
    "-Xmx1024M",
    "-Duser.language=en",
    "-Dfile.encoding=UTF8",
    "-Djdk.util.zip.disableZip64ExtraFieldValidation=true",
    "-Djdk.nio.zipfs.allowDotZipEntry=true",
    "-jar", (Join-Path $scriptDir $jarFile)
)

if ($fastCommand) {
    $javaArgs += $fastCommand
}
$javaArgs += $args

# Execute Apktool
try {
    & $javaExe $javaArgs
} catch {
    Write-Error "Failed to execute Apktool: $_"
}

# Pause if running non-interactively
if ([Environment]::GetCommandLineArgs() -contains "/c") {
    pause
}
'@

$apkPs1Path = Join-Path $APKTOOL_INSTALL_DIR "apktool.ps1"

# 1. Create apktool.ps1
Write-ColorMessage -Message "Creating apktool.ps1..." -Type "Info"
try {
    Set-Content -Path $apkPs1Path -Value $apkPs1Content -Force -Encoding UTF8
    Write-ColorMessage -Message "apktool.ps1 created successfully." -Type "Success"
} catch {
    Write-ColorMessage -Message "Failed to create apktool.ps1: $_" -Type "Error"
    exit 1
}

# Apktool.bat content: always call the ps1 in the same directory
$apktoolBatContent = @'
@echo off
setlocal
set script_dir=%~dp0
set ps1_path="%script_dir%apktool.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File %ps1_path% %*
'@

# 2. Create apktool.bat
Write-ColorMessage -Message "Creating apktool.bat..." -Type "Info"
try {
    Set-Content -Path $APKTOOL_BAT_PATH -Value $apktoolBatContent -Force -Encoding UTF8
    Write-ColorMessage -Message "apktool.bat created successfully." -Type "Success"
} catch {
    Write-ColorMessage -Message "Failed to create apktool.bat: $_" -Type "Error"
    exit 1
}

# 3. Download apktool.jar
if (-not (Test-Path $APKTOOL_JAR_PATH)) {
    Write-ColorMessage -Message "Downloading apktool.jar..." -Type "Info"
    try {
        Invoke-WebRequest -Uri $APKTOOL_JAR_URL -OutFile $APKTOOL_JAR_PATH -UseBasicParsing
        Write-ColorMessage -Message "apktool.jar downloaded successfully." -Type "Success"
    } catch {
        Write-ColorMessage -Message "Failed to download apktool.jar: $_" -Type "Error"
        exit 1
    }
} else {
    Write-ColorMessage -Message "apktool.jar already exists." -Type "Success"
}

# Verify installation
if ((Test-Path $APKTOOL_BAT_PATH) -and (Test-Path $APKTOOL_JAR_PATH) -and (Test-Path $apkPs1Path)) {
    Write-ColorMessage -Message "Apktool installation successful (bat, ps1, jar all exist)" -Type "Success"
} else {
    Write-ColorMessage -Message "Apktool installation incomplete (please check bat/ps1/jar)" -Type "Error"
    exit 1
}

# Update PATH environment variable if needed
if ($env:PATH -notmatch [regex]::Escape($APKTOOL_INSTALL_DIR)) {
    Write-ColorMessage -Message "Adding $APKTOOL_INSTALL_DIR to PATH using WindowsPathFunction.ps1"
    try {
        & $windowsPathFunctionPath "add" $APKTOOL_INSTALL_DIR
        Write-ColorMessage -Message "PATH updated successfully." -Type "Success"
    } catch {
        Write-ColorMessage -Message "Failed to update PATH: $_" -Type "Warning"
    }
} else {
    Write-ColorMessage -Message "$APKTOOL_INSTALL_DIR is already in PATH." -Type "Success"
}

