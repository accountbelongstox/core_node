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

# Variable Declarations
$PSScriptRoot = Split-Path -Parent $PSCommandPath
$SHELLS_WIN_PATH = "shells/win"
$WIN_COMMON_DIR_NAME = "win_common"
$INSTALL_POWERSHELLS_DIR_NAME = "install_powershells"

# Path combinations
$WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) $WIN_COMMON_DIR_NAME
$INSTALL_POWERSHELLS_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) $INSTALL_POWERSHELLS_DIR_NAME

# Load InstallerScriptsList.ps1 for script management
$installerScriptsListPath = Join-Path $INSTALL_POWERSHELLS_DIR "InstallerScriptsList.ps1"
if (Test-Path $installerScriptsListPath) {
    . $installerScriptsListPath
}

# =============================================================================
# INITIALIZATION DETECTION AND AUTO-SETUP
# =============================================================================
function Test-InitializationRequired {
    # Check if script is running from user profile directory (not initialized)
    $currentDir = Get-Location
    $userProfileDir = [Environment]::GetFolderPath("UserProfile")
    
    if ($currentDir.Path -like "$userProfileDir*") {
        return $true
    }
    return $false
}

function Show-InitializationMenu {
    Write-Host "`n" -NoNewline
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host "  CORE NODE INITIALIZATION REQUIRED" -ForegroundColor Yellow
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The script is running from user profile directory." -ForegroundColor White
    Write-Host "This indicates that the development environment is not yet initialized." -ForegroundColor White
    Write-Host ""
    Write-Host "Available options:" -ForegroundColor Green
    Write-Host "  1. Initialize development environment (Recommended)" -ForegroundColor White
    Write-Host "  2. Continue without initialization" -ForegroundColor White
    Write-Host "  3. Exit" -ForegroundColor White
    Write-Host ""
    
    do {
        $choice = Read-Host "Please select an option (1-3)"
        switch ($choice) {
            "1" { return "initialize" }
            "2" { return "continue" }
            "3" { return "exit" }
            default { Write-Host "Invalid choice. Please enter 1, 2, or 3." -ForegroundColor Red }
        }
    } while ($true)
}

function Show-RegionSelectionMenu {
    Write-Host "`n" -NoNewline
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host "  SELECT REGION FOR PROJECT CLONE" -ForegroundColor Yellow
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please select the region for cloning the project:" -ForegroundColor White
    Write-Host ""
    Write-Host "Available regions:" -ForegroundColor Green
    Write-Host "  1. China (Gitee) - Faster in China" -ForegroundColor White
    Write-Host "  2. Global (GitHub) - Global access" -ForegroundColor White
    Write-Host ""
    
    do {
        $choice = Read-Host "Please select region (1-2)"
        switch ($choice) {
            "1" { return "China" }
            "2" { return "Global" }
            default { Write-Host "Invalid choice. Please enter 1 or 2." -ForegroundColor Red }
        }
    } while ($true)
}

function Initialize-DevelopmentEnvironment {
    Write-Host "`n" -NoNewline
    Write-Host "=" * 60 -ForegroundColor Green
    Write-Host "  INITIALIZING DEVELOPMENT ENVIRONMENT" -ForegroundColor Green
    Write-Host "=" * 60 -ForegroundColor Green
    Write-Host ""
    
    # Show region selection menu
    $selectedRegion = Show-RegionSelectionMenu
    Write-Host "[*] Selected region: $selectedRegion" -ForegroundColor Cyan
    
    try {
        # Load GlobalVars.ps1 to get PROJECT_ROOT_DIR
        $globalVarsPath = Join-Path $WIN_COMMON_DIR "GlobalVars.ps1"
        if (Test-Path $globalVarsPath) {
            Write-Host "[*] Loading global variables..." -ForegroundColor Cyan
            . $globalVarsPath
            Write-Host "[OK] Global variables loaded" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] GlobalVars.ps1 not found: $globalVarsPath" -ForegroundColor Red
            return $false
        }
        
        # Save selected region to global variables
        $Global:SELECTED_REGION = $selectedRegion
        Write-Host "[*] Saved selected region: $selectedRegion" -ForegroundColor Cyan
        
        # Switch to PROJECT_ROOT_DIR
        if (Test-Path $Global:PROJECT_ROOT_DIR) {
            Write-Host "[*] Switching to project root directory: $($Global:PROJECT_ROOT_DIR)" -ForegroundColor Cyan
            Set-Location $Global:PROJECT_ROOT_DIR
            Write-Host "[OK] Switched to project root directory" -ForegroundColor Green
        } else {
            Write-Host "[*] Creating project root directory: $($Global:PROJECT_ROOT_DIR)" -ForegroundColor Cyan
            New-Item -ItemType Directory -Path $Global:PROJECT_ROOT_DIR -Force | Out-Null
            Set-Location $Global:PROJECT_ROOT_DIR
            Write-Host "[OK] Created and switched to project root directory" -ForegroundColor Green
        }
        
        # Execute installation steps using InstallerScriptsList.ps1
        $installSteps = Get-InitializationScripts
        
        foreach ($step in $installSteps) {
            $stepPath = Join-Path $INSTALL_POWERSHELLS_DIR $step
            if (Test-Path $stepPath) {
                Write-Host "[*] Executing $step..." -ForegroundColor Cyan
                try {
                    & $stepPath
                    Write-Host "[OK] $step completed successfully" -ForegroundColor Green
                } catch {
                    Write-Host "[ERROR] $step failed: $_" -ForegroundColor Red
                    return $false
                }
            } else {
                Write-Host "[WARNING] $step not found: $stepPath" -ForegroundColor Yellow
            }
        }
        
        # Verify Git installation
        Write-Host "[*] Verifying Git installation..." -ForegroundColor Cyan
        try {
            $gitVersion = git --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] Git installed successfully: $gitVersion" -ForegroundColor Green
            } else {
                Write-Host "[ERROR] Git installation verification failed" -ForegroundColor Red
                return $false
            }
        } catch {
            Write-Host "[ERROR] Git verification failed: $_" -ForegroundColor Red
            return $false
        }
        
        # Clone the project using GlobalVars.ps1 functions
        Write-Host "[*] Cloning core_node project..." -ForegroundColor Cyan
        try {
            $projectDir = Join-Path $Global:PROJECT_ROOT_DIR "core_node"
            if (-not (Test-Path $projectDir)) {
                # Use Get-RegionCloneURL function from GlobalVars.ps1
                $repoUrl = Get-RegionCloneURL
                Write-Host "[*] Using repository: $repoUrl" -ForegroundColor Cyan
                
                git clone $repoUrl $projectDir
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[OK] Project cloned successfully from $selectedRegion repository" -ForegroundColor Green
                } else {
                    Write-Host "[ERROR] Project clone failed" -ForegroundColor Red
                    return $false
                }
            } else {
                Write-Host "[INFO] Project directory already exists: $projectDir" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "[ERROR] Project clone failed: $_" -ForegroundColor Red
            return $false
        }
        
        # Switch to project directory and execute dd.cmd
        Write-Host "[*] Switching to project directory and executing dd.cmd..." -ForegroundColor Cyan
        try {
            Set-Location $projectDir
            if (Test-Path "dd.cmd") {
                Write-Host "[OK] Executing dd.cmd..." -ForegroundColor Green
                & ".\dd.cmd"
            } else {
                Write-Host "[ERROR] dd.cmd not found in project directory" -ForegroundColor Red
                return $false
            }
        } catch {
            Write-Host "[ERROR] Failed to execute dd.cmd: $_" -ForegroundColor Red
            return $false
        }
        
        Write-Host "`n" -NoNewline
        Write-Host "=" * 60 -ForegroundColor Green
        Write-Host "  INITIALIZATION COMPLETED SUCCESSFULLY" -ForegroundColor Green
        Write-Host "=" * 60 -ForegroundColor Green
        return $true
        
    } catch {
        Write-Host "[ERROR] Initialization failed: $_" -ForegroundColor Red
        return $false
    }
}

# =============================================================================
# PATH MANAGEMENT FOR INITIALIZED ENVIRONMENT
# =============================================================================
function Add-ProjectDirToPath {
    try {
        # Load GlobalVars.ps1 to get PROJECT_DIR
        $globalVarsPath = Join-Path $WIN_COMMON_DIR "GlobalVars.ps1"
        if (Test-Path $globalVarsPath) {
            . $globalVarsPath
            
            # Add PROJECT_DIR to PATH if not already present
            $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            $paths = $currentPath -split ';'
            
            if (-not ($paths -contains $Global:PROJECT_DIR)) {
                Write-Host "[*] Adding PROJECT_DIR to system PATH: $($Global:PROJECT_DIR)" -ForegroundColor Cyan
                $newPath = $currentPath + ";" + $Global:PROJECT_DIR
                [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
                Write-Host "[OK] Added PROJECT_DIR to system PATH" -ForegroundColor Green
            } else {
                Write-Host "[INFO] PROJECT_DIR already exists in PATH: $($Global:PROJECT_DIR)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[WARNING] GlobalVars.ps1 not found: $globalVarsPath" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[ERROR] Failed to add PROJECT_DIR to PATH: $_" -ForegroundColor Red
    }
}

# Main execution
if (Test-InitializationRequired) {
    $initChoice = Show-InitializationMenu
    switch ($initChoice) {
        "initialize" {
            if (Initialize-DevelopmentEnvironment) {
                Write-Host "Initialization completed successfully. Exiting..." -ForegroundColor Green
                exit 0
            } else {
                Write-Host "Initialization failed. Exiting..." -ForegroundColor Red
                exit 1
            }
        }
        "continue" {
            Write-Host "Continuing without initialization..." -ForegroundColor Yellow
        }
        "exit" {
            Write-Host "Exiting..." -ForegroundColor Yellow
            exit 0
        }
    }
} else {
    # Not in user directory - add PROJECT_DIR to PATH
    Add-ProjectDirToPath
}
