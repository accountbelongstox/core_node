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

$WinCommonDir = Join-Path (Split-Path -Parent $PSScriptRoot) "win_common"
. (Join-Path $WinCommonDir "GlobalVars.ps1")
. (Join-Path $WinCommonDir "CommonFunc.ps1")
. (Join-Path $WinCommonDir "PostInstallCallbackProcessor.ps1")
. (Join-Path $WinCommonDir "StringEscapeUtils.ps1")

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$STEP_NUMBER = 20

function Step20_InstallBaseTools {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing base tools..." -Type "Info"
    # Install 7-Zip
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting up 7-Zip..." -Type "Info"

    # Check if 7-Zip is already installed
    if (Test-Path $SEVENZIP_EXE_PATH) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] 7-Zip is already installed" -Type "Success"
        $version = & $SEVENZIP_EXE_PATH 2>&1 | Select-String "7-Zip"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] 7-Zip version: $version" -Type "Info"
    }
    else {
        # Ensure temp directory exists
        if (-not (Test-Path $SEVENZIP_TEMP_DIR)) {
            New-Item -ItemType Directory -Path $SEVENZIP_TEMP_DIR -Force | Out-Null
        }

        # Download 7-Zip installer
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Downloading 7-Zip installer..." -Type "Warning"
        Get-FileWithSizeCheck -localPath $SEVENZIP_TMP_PATH -remoteUrl $SEVENZIP_DOWNLOAD_URL -description "7-Zip installer"

        if (Test-Path $SEVENZIP_TMP_PATH) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing 7-Zip to $SEVENZIP_INSTALL_DIR..." -Type "Warning"
            # Create install directory if it doesn't exist
            if (-not (Test-Path $SEVENZIP_INSTALL_DIR)) {
                New-Item -ItemType Directory -Path $SEVENZIP_INSTALL_DIR -Force | Out-Null
            }
            
            # Install 7-Zip silently to specified directory
            Start-Process -FilePath $SEVENZIP_TMP_PATH -ArgumentList "/S", "/D=$SEVENZIP_INSTALL_DIR" -Wait

            if (Test-Path $SEVENZIP_EXE_PATH) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] 7-Zip installed successfully" -Type "Success"
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install 7-Zip" -Type "Error"
                throw "7-Zip installation failed"
            }
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to download 7-Zip installer" -Type "Error"
            throw "7-Zip download failed"
        }
    }

    # Always ensure 7-Zip is in PATH
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Ensuring 7-Zip is in system PATH..." -Type "Info"
    & $windowsPathFunctionPath "add" $SEVENZIP_INSTALL_DIR
    
    # Refresh environment variables in current session
    & $windowsPathFunctionPath "refresh-bat"
    $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
    if (Test-Path $refreshBatchPath) {
        & $refreshBatchPath
    }

    # Setup 7-Zip context menu
    if (Test-Path $SEVENZIP_EXE_PATH) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting up 7-Zip context menu..." -Type "Info"

        # Control how quotes are escaped in registry command strings: 'none' | 'inner' | 'all' | 'registry'
        # Use 'registry' mode for proper Windows registry format (escapes both backslashes and quotes)
        $QuoteEscapeMode = 'registry'

        $sevenZipPackageMeta = @{
            PostInstallCallbacks = @(
                @{
                    Type = "context_menu"
                    Operation = "add_7zip_context"
                    MenuText = "Extract Here"
                    Command = (Escape-Quotes -InputString "`"$SEVENZIP_EXE_PATH`" x `"%1`" -o`"%1`" -y" -Mode $QuoteEscapeMode)
                    Description = "Extract archive to current folder"
                }
                @{
                    Type = "context_menu"
                    Operation = "add_7zip_context"
                    MenuText = "Extract to Folder"
                    Command = (Escape-Quotes -InputString "`"$SEVENZIP_EXE_PATH`" x `"%1`" -o`"%1\`" -y" -Mode $QuoteEscapeMode)
                    Description = "Extract archive to new folder"
                }
                @{
                    Type = "context_menu"
                    Operation = "add_7zip_context"
                    MenuText = "Test Archive"
                    Command = (Escape-Quotes -InputString "`"$SEVENZIP_EXE_PATH`" t `"%1`"" -Mode $QuoteEscapeMode)
                    Description = "Test archive integrity"
                }
                @{
                    Type = "context_menu"
                    Operation = "add_7zip_context"
                    MenuText = "Compress to ZIP"
                    Command = (Escape-Quotes -InputString "`"$SEVENZIP_EXE_PATH`" a `"%1.zip`" `"%1`"" -Mode $QuoteEscapeMode)
                    Description = "Compress file/folder to ZIP"
                }
                @{
                    Type = "context_menu"
                    Operation = "add_7zip_context"
                    MenuText = "Compress to 7Z"
                    Command = (Escape-Quotes -InputString "`"$SEVENZIP_EXE_PATH`" a `"%1.7z`" `"%1`"" -Mode $QuoteEscapeMode)
                    Description = "Compress file/folder to 7Z"
                }
                @{
                    Type = "context_menu"
                    Operation = "add_7zip_folder_context"
                    MenuText = "Compress Folder to ZIP"
                    Command = (Escape-Quotes -InputString "`"$SEVENZIP_EXE_PATH`" a `"%1.zip`" `"%1\*`"" -Mode $QuoteEscapeMode)
                    Description = "Compress folder contents to ZIP"
                }
                @{
                    Type = "context_menu"
                    Operation = "add_7zip_folder_context"
                    MenuText = "Compress Folder to 7Z"
                    Command = (Escape-Quotes -InputString "`"$SEVENZIP_EXE_PATH`" a `"%1.7z`" `"%1\*`"" -Mode $QuoteEscapeMode)
                    Description = "Compress folder contents to 7Z"
                }
            )
        }
        
        Invoke-PostInstallCallbacks -PackageName "7-Zip" -PackageMeta $sevenZipPackageMeta -ExecutablePath $SEVENZIP_EXE_PATH -InstallDir $SEVENZIP_INSTALL_DIR -LogPrefix "[Step $STEP_NUMBER]"
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Base tools installation completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}
Step20_InstallBaseTools
