. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "CommonFunc.ps1")

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"

$COMPONENT_ID = 'Git_Install'

# Create complete Git package object
$GitPackage = @{
    Name                  = "Git"
    PackageId             = "Git.Git"
    Exec                  = "git.exe"
    Category              = "Developer Tools"
    Description           = "Git distributed version control system"
    InstallType           = "winget"
    ForceToInstallDir     = $true
    IncludeSystemPaths    = $false
    AdditionalKeywords    = @()
    AppCustomInstallDir   = $GIT_INSTALL_DIR
}

# Function to install Git
function Install-Git {
    Write-ColorMessage -Message "[$COMPONENT_ID] Installing Git using winget..." -Type "Warning"

    if (-not (Test-Path $GIT_INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $GIT_INSTALL_DIR -Force | Out-Null
    }

    $result = Invoke-WingetCommand `
        -Id $GitPackage.PackageId `
        -InstallDir $GitPackage.AppCustomInstallDir `
        -Keyword $GitPackage.Exec `
        -AdditionalKeywords $GitPackage.AdditionalKeywords `
        -ForceToInstallDir $GitPackage.ForceToInstallDir `
        -IncludeSystemPaths $GitPackage.IncludeSystemPaths `
        -OnlyCheckFlag $false `
        -ForceInstall $false

    if ($result) {
        if (Test-Path $GIT_EXE_PATH) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Successfully installed Git" -Type "Success"
            New-Item -ItemType File -Path $GIT_FLAG_FILE -Force | Out-Null
            return $true
        }
        else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Git installation verification failed" -Type "Error"
            return $false
        }
    }
    else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Failed to install Git using winget" -Type "Error"
        return $false
    }
}

# Function to configure Git
function Configure-Git {
    if (-not (Test-Path $GIT_EXE_PATH)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Git executable not found, skipping configuration..." -Type "Warning"
        return
    }

    if (-not (Test-Path $GIT_FLAG_FILE)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Git configuration not found, skipping..." -Type "Info"
        return
    }

    Write-ColorMessage -Message "[$COMPONENT_ID] Checking Git configuration..." -Type "Info"

    # Check user name
    $currentUser = & $GIT_EXE_PATH config --global user.name
    if (-not $currentUser) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Setting Git user name to: $GIT_DEFAULT_USER" -Type "Warning"
        & $GIT_EXE_PATH config --global user.name $GIT_DEFAULT_USER
    }
    else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Git user name already set to: $currentUser" -Type "Success"
    }

    # Check email
    $currentEmail = & $GIT_EXE_PATH config --global user.email
    if (-not $currentEmail) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Setting Git email to: $GIT_DEFAULT_EMAIL" -Type "Warning"
        & $GIT_EXE_PATH config --global user.email $GIT_DEFAULT_EMAIL
    }
    else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Git email already set to: $currentEmail" -Type "Success"
    }

    # Configure Git defaults if not already set
    Write-ColorMessage -Message "[$COMPONENT_ID] Configuring Git defaults..." -Type "Info"

    # Configure core.autocrlf
    $autocrlf = & $GIT_EXE_PATH config --global core.autocrlf
    if (-not $autocrlf) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Setting core.autocrlf to true" -Type "Warning"
        & $GIT_EXE_PATH config --global core.autocrlf true
    }
    else {
        Write-ColorMessage -Message "[$COMPONENT_ID] core.autocrlf already set to: $autocrlf" -Type "Success"
    }

    # Configure core.safecrlf
    $safecrlf = & $GIT_EXE_PATH config --global core.safecrlf
    if (-not $safecrlf) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Setting core.safecrlf to false" -Type "Warning"
        & $GIT_EXE_PATH config --global core.safecrlf false
    }
    else {
        Write-ColorMessage -Message "[$COMPONENT_ID] core.safecrlf already set to: $safecrlf" -Type "Success"
    }

    # Configure default branch
    $defaultBranch = & $GIT_EXE_PATH config --global init.defaultBranch
    if (-not $defaultBranch) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Setting init.defaultBranch to main" -Type "Warning"
        & $GIT_EXE_PATH config --global init.defaultBranch main
    }
    else {
        Write-ColorMessage -Message "[$COMPONENT_ID] init.defaultBranch already set to: $defaultBranch" -Type "Success"
    }
}

function Git_Install {
    Write-ColorMessage -Message "[$COMPONENT_ID] Installing and configuring Git..." -Type "Info"

    # Check Git installation by flag file and executable
    Write-ColorMessage -Message "[$COMPONENT_ID] Checking Git installation..." -Type "Info"
    $gitInstalled = $false
    $isReusingExistingGit = $false
    
    # First check if Git executable exists
    if (Test-Path $GIT_EXE_PATH) {
        $gitInstalled = $true
        # Check if this is a reused installation
        if (-not (Test-Path $GIT_FLAG_FILE)) {
            $isReusingExistingGit = $true
            Write-ColorMessage -Message "[$COMPONENT_ID] Found existing Git installation at $GIT_EXE_PATH" -Type "Success"
            # Create flag file for future reference
            New-Item -ItemType File -Path $GIT_FLAG_FILE -Force | Out-Null
        }
        else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Using previously installed Git at $GIT_EXE_PATH" -Type "Success"
        }
    }
    else {
        # Git executable not found
        Write-ColorMessage -Message "[$COMPONENT_ID] Git executable not found" -Type "Warning"
        # Remove flag file if it exists but executable doesn't
        if (Test-Path $GIT_FLAG_FILE) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Removing invalid Git flag file" -Type "Warning"
            Remove-Item -Path $GIT_FLAG_FILE -Force
        }
    }

    # Install Git if not installed
    if (-not $gitInstalled) {
        $gitInstalled = Install-Git
        if (-not $gitInstalled) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Warning: Failed to install Git" -Type "Error"
            Write-ColorMessage -Message "[$COMPONENT_ID] Skipping Git configuration and verification" -Type "Warning"
            Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
            return
        }
    }

    Configure-Git
    SetGetEnvGit
    PringInstallResult

    Write-ColorMessage -Message "[$COMPONENT_ID] Git installation and configuration completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}

function SetGetEnvGit {
    if (Test-Path $GIT_EXE_PATH) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Adding Git to environment variables..." -Type "Info"

        # Add Git cmd directory to PATH (WindowsPathFunction.ps1 will auto-detect if it's a file)
        & $windowsPathFunctionPath "add" $GIT_EXE_PATH

        # Add Git bin directory to PATH (contains other Git tools)
        $gitBinDir = Join-Path $GIT_INSTALL_DIR "bin"
        if (Test-Path $gitBinDir) {
            & $windowsPathFunctionPath "add" $gitBinDir
        }

        # Refresh environment variables in current session for immediate availability
        Write-ColorMessage -Message "[$COMPONENT_ID] Refreshing environment variables in current session..." -Type "Info"
        & $windowsPathFunctionPath "refresh-bat"
        $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
        if (Test-Path $refreshBatchPath) {
            & $refreshBatchPath
        }

        # Manually refresh PATH in current PowerShell session
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        Write-ColorMessage -Message "[$COMPONENT_ID] Successfully added Git to environment variables" -Type "Success"
    }
    else {
        Write-ColorMessage -Message "[$COMPONENT_ID] Warning: Git executable not found at $GIT_EXE_PATH" -Type "Warning"
    }
}

function PringInstallResult {
    if (-not (Test-Path $GIT_EXE_PATH)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Git executable not found, skipping verification..." -Type "Warning"
        return
    }

    Write-ColorMessage -Message "[$COMPONENT_ID] Verifying Git installation and configuration..." -Type "Info"

    try {
        $gitVersion = & $GIT_EXE_PATH --version 2>&1
        if (("$gitVersion").Contains('git version')) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Git version: $gitVersion" -Type "Success"
            Write-ColorMessage -Message "[$COMPONENT_ID] Git installation path: $GIT_EXE_PATH" -Type "Success"
            Write-ColorMessage -Message "[$COMPONENT_ID] Current Git configuration:" -Type "Info"
            Write-ColorMessage -Message "[$COMPONENT_ID] - User name: $(& $GIT_EXE_PATH config --global user.name)" -Type "Success"
            Write-ColorMessage -Message "[$COMPONENT_ID] - Email: $(& $GIT_EXE_PATH config --global user.email)" -Type "Success"
            Write-ColorMessage -Message "[$COMPONENT_ID] - Default branch: $(& $GIT_EXE_PATH config --global init.defaultBranch)" -Type "Success"
            Write-ColorMessage -Message "[$COMPONENT_ID] - AutoCRLF: $(& $GIT_EXE_PATH config --global core.autocrlf)" -Type "Success"
            Write-ColorMessage -Message "[$COMPONENT_ID] - SafeCRLF: $(& $GIT_EXE_PATH config --global core.safecrlf)" -Type "Success"
        }
        else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Warning: Failed to verify Git installation" -Type "Error"
        }
    }
    catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Error verifying Git: $($_.Exception.Message)" -Type "Error"
    }
}

# Function to ensure Git context menu entries exist
function Ensure-GitContextMenu {
    if (-not (Test-Path $GIT_EXE_PATH)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Git not installed, skipping context menu setup..." -Type "Warning"
        return
    }

    Write-ColorMessage -Message "[$COMPONENT_ID] Setting up Git Bash context menu..." -Type "Info"

    # Get Git Bash executable path
    $gitBashExe = Join-Path $GIT_INSTALL_DIR "git-bash.exe"
    if (-not (Test-Path $gitBashExe)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Git Bash not found at $gitBashExe" -Type "Warning"
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
        $commandPath = Join-Path $regPath "command"
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

                Write-ColorMessage -Message "[$COMPONENT_ID] Added Git Bash context menu for $contextType" -Type "Success"
            }
            catch {
                Write-ColorMessage -Message "[$COMPONENT_ID] Failed to create context menu for $contextType : $_" -Type "Error"
            }
        }
        else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Git Bash context menu for $contextType already exists" -Type "Info"
        }
    }

    Write-ColorMessage -Message "[$COMPONENT_ID] Git Bash context menu setup completed" -Type "Success"
    Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
}


# Execute all functions
Git_Install
Ensure-GitContextMenu
