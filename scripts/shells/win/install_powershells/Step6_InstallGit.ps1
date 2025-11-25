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

$STEP_NUMBER = 6

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
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Git using winget..." -Type "Warning"

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
    if (-not (Test-Path $GIT_EXE_PATH)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git executable not found, skipping configuration..." -Type "Warning"
        return
    }

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
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping Git configuration and verification" -Type "Warning"
            Write-ColorMessage -Message "----------------------------------------------------------------" -Type "Info"
            return
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

        # Add Git cmd directory to PATH (WindowsPathFunction.ps1 will auto-detect if it's a file)
        & $windowsPathFunctionPath "add" $GIT_EXE_PATH

        # Add Git bin directory to PATH (contains other Git tools)
        $gitBinDir = Join-Path $GIT_INSTALL_DIR "bin"
        if (Test-Path $gitBinDir) {
            & $windowsPathFunctionPath "add" $gitBinDir
        }

        # Refresh environment variables in current session for immediate availability
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Refreshing environment variables in current session..." -Type "Info"
        & $windowsPathFunctionPath "refresh-bat"
        $refreshBatchPath = Join-Path $env:TEMP "refresh_env.cmd"
        if (Test-Path $refreshBatchPath) {
            & $refreshBatchPath
        }

        # Manually refresh PATH in current PowerShell session
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully added Git to environment variables" -Type "Success"
    }
    else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Warning: Git executable not found at $GIT_EXE_PATH" -Type "Warning"
    }
}

function PringInstallResult {
    if (-not (Test-Path $GIT_EXE_PATH)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git executable not found, skipping verification..." -Type "Warning"
        return
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Verifying Git installation and configuration..." -Type "Info"

    try {
        $gitVersion = & $GIT_EXE_PATH --version 2>&1
        if ($LASTEXITCODE -eq 0 -and $gitVersion) {
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
    catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error verifying Git: $($_.Exception.Message)" -Type "Error"
    }
}

# Function to ensure Git context menu entries exist
function Ensure-GitContextMenu {
    if (-not (Test-Path $GIT_EXE_PATH)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git not installed, skipping context menu setup..." -Type "Warning"
        return
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Setting up Git Bash context menu..." -Type "Info"

    # Get Git Bash executable path
    $gitBashExe = Join-Path $GIT_INSTALL_DIR "git-bash.exe"
    if (-not (Test-Path $gitBashExe)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git Bash not found at $gitBashExe" -Type "Warning"
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

# Function to clone core_node project
function Clone-CoreNodeProject {
    param(
        [string]$GitExePath = $Global:GIT_EXE_PATH
    )

    if (-not (Test-Path $GitExePath)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Git not installed, skipping project clone..." -Type "Warning"
        return $false
    }

    Write-ColorMessage -Message "[Step $STEP_NUMBER] Checking core_node project..." -Type "Info"

    # Define project directory
    $programingDir = "D:\programing"
    $projectDir = Join-Path $programingDir "core_node"

    # Check if project already exists at target location
    if (Test-Path $projectDir) {
        if (Test-Path (Join-Path $projectDir ".git")) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] core_node project already exists at correct location: $projectDir" -Type "Success"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Skipping clone" -Type "Info"
            return $true
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Directory exists but is not a git repository: $projectDir" -Type "Warning"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Please manually remove or rename this directory" -Type "Warning"
            return $false
        }
    }

    # Check if project exists at current location (BASE_DIR)
    if ($Global:BASE_DIR -and (Test-Path $Global:BASE_DIR)) {
        $currentGitDir = Join-Path $Global:BASE_DIR ".git"
        if (Test-Path $currentGitDir) {
            # Normalize paths for comparison
            $normalizedBase = $Global:BASE_DIR.TrimEnd('\')
            $normalizedTarget = $projectDir.TrimEnd('\')

            if ($normalizedBase -ne $normalizedTarget) {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Found core_node project at current location: $($Global:BASE_DIR)" -Type "Warning"
                Write-ColorMessage -Message "[Step $STEP_NUMBER] But the correct location should be: $projectDir" -Type "Warning"
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Do you want to move the project to the correct location? (y/N, timeout 15s, default: N)" -Type "Warning"

                $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
                $timeout = 15
                $shouldMove = $false

                while ($stopWatch.Elapsed.TotalSeconds -lt $timeout -and !$host.UI.RawUI.KeyAvailable) {
                    Start-Sleep -Milliseconds 200
                }

                if ($host.UI.RawUI.KeyAvailable) {
                    $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
                    if ($key -eq 'y' -or $key -eq 'Y') {
                        $shouldMove = $true
                    }
                }

                $stopWatch.Stop()

                if ($shouldMove) {
                    # Call Step7_FixCoreNodeProjectLocation.ps1
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Calling project location fix utility..." -Type "Info"
                    $fixScript = Join-Path $PSScriptRoot "Step7_FixCoreNodeProjectLocation.ps1"
                    if (Test-Path $fixScript) {
                        & $fixScript

                        # Check if move was successful
                        if (Test-Path $projectDir) {
                            Write-ColorMessage -Message "[Step $STEP_NUMBER] Project successfully moved to correct location" -Type "Success"
                            return $true
                        } else {
                            Write-ColorMessage -Message "[Step $STEP_NUMBER] Project move may have failed, continuing..." -Type "Warning"
                        }
                    } else {
                        Write-ColorMessage -Message "[Step $STEP_NUMBER] Fix utility not found, please manually move the project" -Type "Warning"
                    }
                } else {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] User chose not to move project" -Type "Info"
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] You can manually run Step7_FixCoreNodeProjectLocation.ps1 later to fix the location" -Type "Info"
                    return $true
                }
            }
        }
    }

    # Ensure D:\programing directory exists (but NOT D:\programing\core_node)
    if (-not (Test-Path $programingDir)) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Creating programing directory: $programingDir" -Type "Info"
        New-Item -ItemType Directory -Path $programingDir -Force | Out-Null
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Created: $programingDir" -Type "Success"
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Programing directory already exists: $programingDir" -Type "Success"
    }

    # Determine clone URL based on SSH availability and region
    $useSSH = $false
    $cloneUrl = ""

    # Check if SSH keys exist (from Step4_InstallGitSSH or Step5_InstallGitSSH)
    if (Test-Path $Global:SSH_DIR) {
        $pubKeys = Get-ChildItem -Path $Global:SSH_DIR -Filter "*.pub" -File -ErrorAction SilentlyContinue
        foreach ($pub in $pubKeys) {
            $priv = Join-Path $Global:SSH_DIR ([System.IO.Path]::GetFileNameWithoutExtension($pub.Name))
            if (Test-Path $priv) {
                $useSSH = $true
                Write-ColorMessage -Message "[Step $STEP_NUMBER] Found SSH key pair: $($pub.Name)" -Type "Success"
                break
            }
        }
    }

    # Get selected region
    $selectedRegion = Get-GlobalVar -Key "SELECTED_REGION"
    if (-not $selectedRegion) {
        $selectedRegion = "Global"
    }

    # Determine clone URL
    if ($selectedRegion -eq "China") {
        if ($useSSH) {
            $cloneUrl = "git@gitee.com:accountbelongstox/core_node.git"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Using Gitee SSH URL (China region)" -Type "Info"
        } else {
            $cloneUrl = "https://gitee.com/accountbelongstox/core_node.git"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Using Gitee HTTPS URL (China region)" -Type "Info"
        }
    } else {
        if ($useSSH) {
            $cloneUrl = "git@github.com:accountbelongstox/core_node.git"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Using GitHub SSH URL (Global region)" -Type "Info"
        } else {
            $cloneUrl = "https://github.com/accountbelongstox/core_node.git"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Using GitHub HTTPS URL (Global region)" -Type "Info"
        }
    }

    # Ask confirmation before cloning (default: Y)
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Ready to clone core_node project" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] URL: $cloneUrl" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Destination: $projectDir" -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Do you want to clone the project? (Y/n, timeout 10s, default: Y)" -Type "Warning"

    $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
    $timeout = 10
    $shouldClone = $true  # Default to YES

    while ($stopWatch.Elapsed.TotalSeconds -lt $timeout -and !$host.UI.RawUI.KeyAvailable) {
        Start-Sleep -Milliseconds 200
    }

    if ($host.UI.RawUI.KeyAvailable) {
        $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
        if ($key -eq 'n' -or $key -eq 'N') {
            $shouldClone = $false
        }
    }

    $stopWatch.Stop()

    if (-not $shouldClone) {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Clone cancelled by user" -Type "Warning"
        return $false
    }

    # Clone the project
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Cloning core_node project..." -Type "Warning"

    Push-Location $programingDir
    try {
        & $GitExePath clone $cloneUrl "core_node"

        if ($LASTEXITCODE -eq 0 -and (Test-Path $projectDir)) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully cloned core_node project" -Type "Success"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Project location: $projectDir" -Type "Success"

            # Ask if user wants to switch to project directory
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Project cloned successfully!" -Type "Success"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] You can now run dd.ps1 from: $projectDir\scripts\shells\win\dd.ps1" -Type "Info"

            return $true
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to clone project (exit code: $LASTEXITCODE)" -Type "Error"
            return $false
        }
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Error cloning project: $($_.Exception.Message)" -Type "Error"
        return $false
    } finally {
        Pop-Location
    }
}

# Execute all functions
Step21_InstallGit
Ensure-GitContextMenu

# Clone core_node project after Git installation
Write-ColorMessage -Message "[Step $STEP_NUMBER] =============================================" -Type "Info"
Clone-CoreNodeProject
Write-ColorMessage -Message "[Step $STEP_NUMBER] =============================================" -Type "Info"
