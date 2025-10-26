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

$STEP_NUMBER = 21

# Function to install Git
function Install-Git {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Git using winget..." -Type "Warning"
    # Create install directory if it doesn't exist
    if (-not (Test-Path $GIT_INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $GIT_INSTALL_DIR -Force | Out-Null
    }

    # Install Git using winget
    if (Invoke-WingetCommand -Id $GIT_WINGET_ID -InstallDir $GIT_INSTALL_DIR) {
        # Verify installation
        if (Test-Path $GIT_EXE_PATH) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully installed Git" -Type "Success"
            New-Item -ItemType File -Path $GIT_FLAG_FILE -Force | Out-Null
            return $true
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Git installation verification failed" -Type "Error"
            return $false
        }
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install Git using winget" -Type "Error"
        return $false
    }
}

# Function to configure Git
function Configure-Git {
    if (-not (Test-Path $GIT_FLAG_FILE)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git configuration not found, skipping..." -Type "Info"
        return
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Git configuration..." -Type "Info"
    
    # Check user name
    $currentUser = & $GIT_EXE_PATH config --global user.name
    if (-not $currentUser) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting Git user name to: $GIT_DEFAULT_USER" -Type "Warning"
        & $GIT_EXE_PATH config --global user.name $GIT_DEFAULT_USER
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git user name already set to: $currentUser" -Type "Success"
    }

    # Check email
    $currentEmail = & $GIT_EXE_PATH config --global user.email
    if (-not $currentEmail) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting Git email to: $GIT_DEFAULT_EMAIL" -Type "Warning"
        & $GIT_EXE_PATH config --global user.email $GIT_DEFAULT_EMAIL
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git email already set to: $currentEmail" -Type "Success"
    }

    # Configure Git defaults if not already set
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Configuring Git defaults..." -Type "Info"

    # Configure core.autocrlf
    $autocrlf = & $GIT_EXE_PATH config --global core.autocrlf
    if (-not $autocrlf) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting core.autocrlf to true" -Type "Warning"
        & $GIT_EXE_PATH config --global core.autocrlf true
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] core.autocrlf already set to: $autocrlf" -Type "Success"
    }

    # Configure core.safecrlf
    $safecrlf = & $GIT_EXE_PATH config --global core.safecrlf
    if (-not $safecrlf) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting core.safecrlf to false" -Type "Warning"
        & $GIT_EXE_PATH config --global core.safecrlf false
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] core.safecrlf already set to: $safecrlf" -Type "Success"
    }

    # Configure default branch
    $defaultBranch = & $GIT_EXE_PATH config --global init.defaultBranch
    if (-not $defaultBranch) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting init.defaultBranch to main" -Type "Warning"
        & $GIT_EXE_PATH config --global init.defaultBranch main
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] init.defaultBranch already set to: $defaultBranch" -Type "Success"
    }
}

function Step21_InstallGit {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing and configuring Git..." -Type "Info"

    # Check Git installation by flag file and executable
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking Git installation..." -Type "Info"
    $gitInstalled = $false
    $isReusingExistingGit = $false
    
    # First check if Git executable exists
    if (Test-Path $GIT_EXE_PATH) {
        $gitInstalled = $true
        # Check if this is a reused installation
        if (-not (Test-Path $GIT_FLAG_FILE)) {
            $isReusingExistingGit = $true
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Found existing Git installation at $GIT_EXE_PATH" -Type "Success"
            # Create flag file for future reference
            New-Item -ItemType File -Path $GIT_FLAG_FILE -Force | Out-Null
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Using previously installed Git at $GIT_EXE_PATH" -Type "Success"
        }
    }
    else {
        # Git executable not found
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git executable not found" -Type "Warning"
        # Remove flag file if it exists but executable doesn't
        if (Test-Path $GIT_FLAG_FILE) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Removing invalid Git flag file" -Type "Warning"
            Remove-Item -Path $GIT_FLAG_FILE -Force
        }
    }

    # Install Git if not installed
    if (-not $gitInstalled) {
        $gitInstalled = Install-Git
        if (-not $gitInstalled) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Failed to install Git" -Type "Error"
        }
    }

    Configure-Git
    SetGetEnvGit
    PringInstallResult

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Git installation and configuration completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

function SetGetEnvGit {
    if (Test-Path $GIT_EXE_PATH) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Adding Git to environment variables..." -Type "Info"
        & $windowsPathFunctionPath "add" $GIT_EXE_PATH
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully added Git to environment variables" -Type "Success"
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Git executable not found at $GIT_EXE_PATH" -Type "Warning"
    }
}

function PringInstallResult {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Verifying Git installation and configuration..." -Type "Info"
    $gitVersion = & $GIT_EXE_PATH --version
    if ($gitVersion) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git version: $gitVersion" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git installation path: $GIT_EXE_PATH" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Current Git configuration:" -Type "Info"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] - User name: $(& $GIT_EXE_PATH config --global user.name)" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] - Email: $(& $GIT_EXE_PATH config --global user.email)" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] - Default branch: $(& $GIT_EXE_PATH config --global init.defaultBranch)" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] - AutoCRLF: $(& $GIT_EXE_PATH config --global core.autocrlf)" -Type "Success"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] - SafeCRLF: $(& $GIT_EXE_PATH config --global core.safecrlf)" -Type "Success"
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Failed to verify Git installation" -Type "Error"
    }
}

# Function to ensure Git context menu entries exist
function Ensure-GitContextMenu {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting up Git Bash context menu..." -Type "Info"

    # Get Git Bash executable path
    $gitBashExe = Join-Path $GIT_INSTALL_DIR "git-bash.exe"
    if (-not (Test-Path $gitBashExe)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git Bash not found at $gitBashExe" -Type "Error"
        return
    }

    # Registry paths for context menu
    $contextPaths = @{
        "Background" = @{
            "Path" = "HKCU:\Software\Classes\Directory\Background\shell\Git Bash Here"
            "Command" = "--cd=`"%V`""
            "Type" = "background"
        }
        "Folder" = @{
            "Path" = "HKCU:\Software\Classes\Directory\shell\Git Bash Here"
            "Command" = "--cd=`"%1`""
            "Type" = "folder"
        }
    }

    foreach ($context in $contextPaths.GetEnumerator()) {
        $regPath = $context.Value.Path
        $commandPath = "$regPath\command"
        $contextType = $context.Value.Type
        $commandArg = $context.Value.Command

        if (-not (Test-Path $regPath)) {
            try {
                # Create main registry key
                New-Item -Path $regPath -Force | Out-Null
                Set-ItemProperty -Path $regPath -Name "(Default)" -Value "Git Bash Here"
                Set-ItemProperty -Path $regPath -Name "Icon" -Value "`"$gitBashExe`""

                # Create command subkey
                New-Item -Path $commandPath -Force | Out-Null
                $command = "`"$gitBashExe`" $commandArg"
                Set-ItemProperty -Path $commandPath -Name "(Default)" -Value $command

                Write-ColorMessage -Message "[Step $STEP_NUMBER] Added Git Bash context menu for $contextType" -Type "Success"
            }
            catch {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to create context menu for $contextType : $_" -Type "Error"
            }
        }
        else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Git Bash context menu for $contextType already exists" -Type "Info"
        }
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Git Bash context menu setup completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

# Execute both functions
Step21_InstallGit
Ensure-GitContextMenu
