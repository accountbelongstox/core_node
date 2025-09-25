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
. "$PSScriptRoot\..\win_common\CommanFunc.ps1"

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$STEP_NUMBER = 66

function Step66_InstallFlutter {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Flutter..." -Type "Info"

    # Create installation directory if it doesn't exist
    if (-not (Test-Path $FLUTTER_DIR)) {
        New-Item -ItemType Directory -Path $FLUTTER_DIR -Force | Out-Null
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Created installation directory: $FLUTTER_DIR" -Type "Info"
    }

    $mirrorConfig = $FLUTTER_MIRRORS[$Global:SELECTED_REGION]
    $PUB_HOSTED_URL = $mirrorConfig["PUB_HOSTED_URL"]
    $FLUTTER_STORAGE_BASE_URL = $mirrorConfig["FLUTTER_STORAGE_BASE_URL"]
    $downloadUrl = $mirrorConfig["DOWNLOAD_URL_FORMAT"] -f $FLUTTER_VERSION

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Using mirror: $FLUTTER_STORAGE_BASE_URL" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Using PUB_HOSTED_URL: $PUB_HOSTED_URL" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Download URL: $downloadUrl" -Type "Info"

    $extractedPath = $FLUTTER_DIR
    $flutterBatPath = Join-Path $FLUTTER_DIR "bin\flutter.bat"
    # Check if Flutter is already installed and valid
    if (Test-Path $flutterBatPath) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Flutter is already installed" -Type "Success"
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading Flutter..." -Type "Warning"
        $flutterZip = Join-Path $DOWNLOADS_DIR "flutter.zip"
        Get-FileWithSizeCheck -localPath $flutterZip -remoteUrl $downloadUrl
        if (Test-Path $FLUTTER_DIR) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing existing Flutter installation..." -Type "Warning"
            Remove-Item -Path $FLUTTER_DIR -Recurse -Force
        }
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Waiting for file to be ready..." -Type "Warning"
        Start-Sleep -Seconds 3
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Extracting Flutter..." -Type "Warning"
        $extractedPath = ExtractArchiveWithKeyword -zipPath $flutterZip -outputDir $LANG_COMPILER_DIR -keyword "flutter"
    }

    if ($extractedPath) {
        $requiredPaths = @(
            (Join-Path $extractedPath "bin\flutter.bat"),
            (Join-Path $extractedPath "bin\dart.bat"),
            (Join-Path $extractedPath "packages"),
            (Join-Path $extractedPath "bin\cache"),
            (Join-Path $extractedPath "version")
        )

        $missingPaths = @($requiredPaths | Where-Object { -not (Test-Path $_) })
        if ($null -eq $missingPaths -or $missingPaths.Length -eq 0) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Flutter installation verified" -Type "Success"
            
            # Create installation flag
            New-Item -ItemType File -Path $FLUTTER_INSTALLED_FLAG -Force | Out-Null
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Created installation flag: $FLUTTER_INSTALLED_FLAG" -Type "Success"

            # Set permanent environment variables using WindowsPathFunction.ps1
            & $windowsPathFunctionPath "setvar" "PUB_HOSTED_URL" $PUB_HOSTED_URL
            & $windowsPathFunctionPath "setvar" "FLUTTER_STORAGE_BASE_URL" $FLUTTER_STORAGE_BASE_URL
            
            # Refresh environment variables in current session
            & $windowsPathFunctionPath "refresh-bat"
            $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
            if (Test-Path $refreshBatchPath) {
                & $refreshBatchPath
            }
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Flutter installation verification failed. Missing components:" -Type "Warning"
            $missingPaths | ForEach-Object { Write-ColorMessage -Message "[Step $STEP_NUMBER] - $_" -Type "Warning" }
        }
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error: Failed to extract Flutter" -Type "Error"
    }

    $flutterBinPath = Join-Path $FLUTTER_DIR "bin"
    if (Test-Path $flutterBinPath) {           
        & $windowsPathFunctionPath "add" $flutterBinPath
        
        # Refresh environment variables in current session
        & $windowsPathFunctionPath "refresh-bat"
        $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
        if (Test-Path $refreshBatchPath) {
            & $refreshBatchPath
        }
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Running: flutter doctor" -Type "Info"
        $doctorOutput = & $flutterBatPath doctor
        
        if ($doctorOutput -match "not accepted") {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Automatically accepting all Android licenses..." -Type "Info"
            $maxTries = 10
            $tryCount = 0
            do {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Attempt $($tryCount+1): Running flutter doctor --android-licenses with auto-accept..." -Type "Info"
                $licenseOutput = 1..10 | ForEach-Object { 'y' } | & $flutterBatPath doctor --android-licenses
                $licenseOutputText = $licenseOutput -join "`n"
                $tryCount++
            } while ($licenseOutputText -match "\(y/N\)" -and $tryCount -lt $maxTries)
        }

        Write-ColorMessage -Message "[Step $STEP_NUMBER] Flutter installation completed" -Type "Success"
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error: Flutter installation failed" -Type "Error"
    }
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}
Step66_InstallFlutter