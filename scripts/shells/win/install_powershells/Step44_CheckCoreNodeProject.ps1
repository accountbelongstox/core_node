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

# Step44_CheckCoreNodeProject.ps1 - Check and clone core_node project if needed
# This script checks if the core_node project exists and has content, prompts user to clone if needed

# Declare all variables at the beginning
$SCRIPT_INDEX = "[Step 44]"
$SCRIPT_DIR = $null
$PROJECT_DIR = $null
$PROJECT_PARENT_DIR = $null
$SELECTED_REGION = $null
$GITHUB_CLONE_URL = $null
$GITEE_CLONE_URL = $null
$CLONE_URL = $null
$USER_CHOICE = $null
$TIMEOUT_SECONDS = 60
$IS_DIRECTORY_EMPTY = $false
$NEEDS_CLONE = $false

# Import required modules using absolute paths
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$WIN_COMMON_DIR = Join-Path (Split-Path -Parent $SCRIPT_DIR) "win_common"
$GLOBAL_VARS_PATH = Join-Path $WIN_COMMON_DIR "GlobalVars.ps1"
$COMMON_FUNC_PATH = Join-Path $WIN_COMMON_DIR "CommonFunc.ps1"

. $GLOBAL_VARS_PATH
. $COMMON_FUNC_PATH

Write-Host "$SCRIPT_INDEX Starting core_node project check..." -ForegroundColor Cyan

# Get project directory from GlobalVars
$PROJECT_DIR = $Global:PROJECT_DIR
$PROJECT_PARENT_DIR = $Global:PROJECT_ROOT_DIR

Write-Host "$SCRIPT_INDEX Project directory: $PROJECT_DIR" -ForegroundColor Yellow
Write-Host "$SCRIPT_INDEX Project parent directory: $PROJECT_PARENT_DIR" -ForegroundColor Yellow

# Check if project directory exists
if (-not (Test-Path $PROJECT_DIR)) {
    Write-Host "$SCRIPT_INDEX Project directory does not exist" -ForegroundColor Yellow
    $NEEDS_CLONE = $true
} else {
    Write-Host "$SCRIPT_INDEX Project directory exists, checking content..." -ForegroundColor Cyan
    
    # Check if directory is empty (excluding hidden files and directories)
    $DIRECTORY_ITEMS = Get-ChildItem -Path $PROJECT_DIR -Force -ErrorAction SilentlyContinue
    if (-not $DIRECTORY_ITEMS -or $DIRECTORY_ITEMS.Count -eq 0) {
        Write-Host "$SCRIPT_INDEX Project directory is empty" -ForegroundColor Yellow
        $IS_DIRECTORY_EMPTY = $true
        $NEEDS_CLONE = $true
    } else {
        # Check if there are any non-hidden files (not just directories)
        $NON_HIDDEN_FILES = $DIRECTORY_ITEMS | Where-Object { -not $_.PSIsContainer -and -not $_.Name.StartsWith('.') }
        $NON_HIDDEN_DIRS = $DIRECTORY_ITEMS | Where-Object { $_.PSIsContainer -and -not $_.Name.StartsWith('.') }
        
        if ((-not $NON_HIDDEN_FILES -or $NON_HIDDEN_FILES.Count -eq 0) -and (-not $NON_HIDDEN_DIRS -or $NON_HIDDEN_DIRS.Count -eq 0)) {
            Write-Host "$SCRIPT_INDEX Project directory contains only hidden files/directories or is effectively empty" -ForegroundColor Yellow
            $IS_DIRECTORY_EMPTY = $true
            $NEEDS_CLONE = $true
        } else {
            Write-Host "$SCRIPT_INDEX Project directory contains files: $($NON_HIDDEN_FILES.Count) files, $($NON_HIDDEN_DIRS.Count) directories" -ForegroundColor Green
            $NEEDS_CLONE = $false
        }
    }
}

if (-not $NEEDS_CLONE) {
    Write-Host "$SCRIPT_INDEX Core_node project is already present and has content" -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX Step13 completed successfully" -ForegroundColor Green
    exit 0
}

# Get selected region and clone URL
$SELECTED_REGION = Get-GlobalVar -key "SELECTED_REGION" -defaultValue "China"
$CLONE_URL = Get-RegionCloneURL

Write-Host "$SCRIPT_INDEX Selected region: $SELECTED_REGION" -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX Using clone URL: $CLONE_URL" -ForegroundColor Cyan

# Prompt user for clone confirmation
Write-Host ""
Write-Host "$SCRIPT_INDEX CORE_NODE PROJECT SETUP REQUIRED" -ForegroundColor Yellow
Write-Host "$SCRIPT_INDEX The core_node project directory is missing or empty:" -ForegroundColor White
Write-Host "$SCRIPT_INDEX   Directory: $PROJECT_DIR" -ForegroundColor White
Write-Host "$SCRIPT_INDEX   Status: $(if ($IS_DIRECTORY_EMPTY) { 'Empty' } else { 'Missing' })" -ForegroundColor White
Write-Host ""
Write-Host "$SCRIPT_INDEX This project contains essential development tools and scripts." -ForegroundColor White
Write-Host "$SCRIPT_INDEX Would you like to clone it now?" -ForegroundColor White
Write-Host ""
Write-Host "$SCRIPT_INDEX Clone source: $CLONE_URL" -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX Target directory: $PROJECT_DIR" -ForegroundColor Cyan
Write-Host ""
Write-Host "$SCRIPT_INDEX [Y] Yes, clone the project now" -ForegroundColor Green
Write-Host "$SCRIPT_INDEX [N] No, skip cloning (default after 60 seconds)" -ForegroundColor Red
Write-Host ""

# Prompt with timeout
$USER_CHOICE = $null
$TIMEOUT_JOB = $null

try {
    # Create a background job for timeout
    $TIMEOUT_JOB = Start-Job -ScriptBlock {
        Start-Sleep -Seconds $using:TIMEOUT_SECONDS
        return "TIMEOUT"
    }
    
    # Prompt for user input
    Write-Host "$SCRIPT_INDEX Please enter your choice (Y/N): " -NoNewline -ForegroundColor Yellow
    
    $START_TIME = Get-Date
    while ($true) {
        if ([Console]::KeyAvailable) {
            $KEY = [Console]::ReadKey($true)
            $USER_CHOICE = $KEY.KeyChar.ToString().ToUpper()
            if ($USER_CHOICE -eq "Y" -or $USER_CHOICE -eq "N") {
                Write-Host $USER_CHOICE -ForegroundColor Green
                break
            }
        }
        
        # Check if timeout job completed
        if ($TIMEOUT_JOB.State -eq "Completed") {
            $USER_CHOICE = "N"
            Write-Host "N (timeout)" -ForegroundColor Red
            break
        }
        
        # Show countdown
        $ELAPSED = (Get-Date) - $START_TIME
        $REMAINING = $TIMEOUT_SECONDS - [int]$ELAPSED.TotalSeconds
        if ($REMAINING -le 0) {
            $USER_CHOICE = "N"
            Write-Host "N (timeout)" -ForegroundColor Red
            break
        }
        
        Start-Sleep -Milliseconds 100
    }
} finally {
    # Clean up timeout job
    if ($TIMEOUT_JOB) {
        Stop-Job -Job $TIMEOUT_JOB -ErrorAction SilentlyContinue
        Remove-Job -Job $TIMEOUT_JOB -ErrorAction SilentlyContinue
    }
}

if ($USER_CHOICE -ne "Y") {
    Write-Host ""
    Write-Host "$SCRIPT_INDEX Clone operation cancelled by user" -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX You can manually clone the project later using:" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX   git clone $CLONE_URL $PROJECT_DIR" -ForegroundColor White
    Write-Host "$SCRIPT_INDEX Step13 completed (skipped)" -ForegroundColor Yellow
    exit 0
}

# Proceed with cloning
Write-Host ""
Write-Host "$SCRIPT_INDEX Starting clone operation..." -ForegroundColor Cyan

# Ensure parent directory exists
if (-not (Test-Path $PROJECT_PARENT_DIR)) {
    Write-Host "$SCRIPT_INDEX Creating parent directory: $PROJECT_PARENT_DIR" -ForegroundColor Cyan
    try {
        New-Item -ItemType Directory -Path $PROJECT_PARENT_DIR -Force | Out-Null
        Write-Host "$SCRIPT_INDEX Parent directory created successfully" -ForegroundColor Green
    } catch {
        Write-Host "$SCRIPT_INDEX Error creating parent directory: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Change to parent directory for cloning
$ORIGINAL_LOCATION = Get-Location
try {
    Set-Location $PROJECT_PARENT_DIR
    Write-Host "$SCRIPT_INDEX Changed to directory: $PROJECT_PARENT_DIR" -ForegroundColor Cyan
    
    # Remove existing empty directory if it exists
    if ($IS_DIRECTORY_EMPTY -and (Test-Path $PROJECT_DIR)) {
        Write-Host "$SCRIPT_INDEX Removing empty project directory..." -ForegroundColor Yellow
        Remove-Item -Path $PROJECT_DIR -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Execute git clone
    Write-Host "$SCRIPT_INDEX Executing: git clone $CLONE_URL" -ForegroundColor Cyan
    $CLONE_PROCESS = Start-Process -FilePath "git" -ArgumentList "clone", $CLONE_URL -Wait -NoNewWindow -PassThru -RedirectStandardOutput "git_clone_output.log" -RedirectStandardError "git_clone_error.log"
    
    if ($CLONE_PROCESS.ExitCode -eq 0) {
        Write-Host "$SCRIPT_INDEX Git clone completed successfully" -ForegroundColor Green
        
        # Verify clone success
        if (Test-Path $PROJECT_DIR) {
            $CLONED_ITEMS = Get-ChildItem -Path $PROJECT_DIR -Force -ErrorAction SilentlyContinue
            if ($CLONED_ITEMS -and $CLONED_ITEMS.Count -gt 0) {
                Write-Host "$SCRIPT_INDEX Clone verification successful: $($CLONED_ITEMS.Count) items found" -ForegroundColor Green
                Write-Host "$SCRIPT_INDEX Core_node project setup completed" -ForegroundColor Green
            } else {
                Write-Host "$SCRIPT_INDEX Warning: Clone completed but directory appears empty" -ForegroundColor Yellow
            }
        } else {
            Write-Host "$SCRIPT_INDEX Error: Project directory not found after clone" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "$SCRIPT_INDEX Git clone failed with exit code: $($CLONE_PROCESS.ExitCode)" -ForegroundColor Red
        
        # Show error details if available
        if (Test-Path "git_clone_error.log") {
            $ERROR_CONTENT = Get-Content "git_clone_error.log" -Raw -ErrorAction SilentlyContinue
            if ($ERROR_CONTENT) {
                Write-Host "$SCRIPT_INDEX Error details: $ERROR_CONTENT" -ForegroundColor Red
            }
        }
        exit 1
    }
} catch {
    Write-Host "$SCRIPT_INDEX Exception during clone operation: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Restore original location
    Set-Location $ORIGINAL_LOCATION
    
    # Clean up log files
    $LOG_FILES = @("git_clone_output.log", "git_clone_error.log")
    foreach ($LOG_FILE in $LOG_FILES) {
        $LOG_PATH = Join-Path $PROJECT_PARENT_DIR $LOG_FILE
        if (Test-Path $LOG_PATH) {
            Remove-Item -Path $LOG_PATH -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "$SCRIPT_INDEX Step13 completed successfully" -ForegroundColor Green
