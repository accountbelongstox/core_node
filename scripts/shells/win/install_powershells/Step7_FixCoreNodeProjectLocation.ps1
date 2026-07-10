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

$parentDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common"

. (Join-Path $winCommonDir "GlobalVars.ps1")
. (Join-Path $winCommonDir "CommonFunc.ps1")

$SCRIPT_INDEX = "[Step 7]"

# Target project location
$TARGET_PROGRAMING_DIR = "D:\programing"
$TARGET_PROJECT_DIR = Join-Path $TARGET_PROGRAMING_DIR "core_node"

function Find-CoreNodeProjects {
    Write-ColorMessage -Message "$SCRIPT_INDEX Searching for core_node projects..." -Type "Info"

    $possibleLocations = @()

    # Check current BASE_DIR (where this script is running from)
    if ($Global:BASE_DIR -and (Test-Path $Global:BASE_DIR)) {
        $gitDir = Join-Path $Global:BASE_DIR ".git"
        if (Test-Path $gitDir) {
            $possibleLocations += @{
                Path = $Global:BASE_DIR
                IsGitRepo = $true
                IsCurrent = $true
            }
            Write-ColorMessage -Message "$SCRIPT_INDEX Found project at current location: $($Global:BASE_DIR)" -Type "Success"
        }
    }

    # Check target location
    if (Test-Path $TARGET_PROJECT_DIR) {
        $gitDir = Join-Path $TARGET_PROJECT_DIR ".git"
        if (Test-Path $gitDir) {
            $possibleLocations += @{
                Path = $TARGET_PROJECT_DIR
                IsGitRepo = $true
                IsCurrent = $false
            }
            Write-ColorMessage -Message "$SCRIPT_INDEX Found project at target location: $TARGET_PROJECT_DIR" -Type "Success"
        }
    }

    # Check common locations
    $commonLocations = @(
        "C:\Users\$env:USERNAME\Documents\core_node",
        "C:\Users\$env:USERNAME\Desktop\core_node",
        "$env:USERPROFILE\core_node",
        "D:\core_node",
        "C:\core_node"
    )

    foreach ($loc in $commonLocations) {
        if (Test-Path $loc) {
            $gitDir = Join-Path $loc ".git"
            if (Test-Path $gitDir) {
                # Check if not already in list
                $alreadyFound = @($possibleLocations | Where-Object { $_.Path -eq $loc })
                if (-not $alreadyFound -or $alreadyFound.Count -eq 0) {
                    $possibleLocations += @{
                        Path = $loc
                        IsGitRepo = $true
                        IsCurrent = $false
                    }
                    Write-ColorMessage -Message "$SCRIPT_INDEX Found project at: $loc" -Type "Info"
                }
            }
        }
    }

    return $possibleLocations
}

function Test-IsCorrectLocation {
    param([string]$Path)

    $normalizedPath = $Path.TrimEnd('\')
    $normalizedTarget = $TARGET_PROJECT_DIR.TrimEnd('\')

    return $normalizedPath -eq $normalizedTarget
}

function Move-CoreNodeProject {
    param(
        [string]$SourcePath,
        [string]$DestPath
    )

    Write-ColorMessage -Message "$SCRIPT_INDEX Moving project from:" -Type "Warning"
    Write-ColorMessage -Message "$SCRIPT_INDEX   Source: $SourcePath" -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX   Destination: $DestPath" -Type "Info"

    # Check if destination already exists
    if (Test-Path $DestPath) {
        # Get all items in the directory (files and subdirectories)
        $items = Get-ChildItem -Path $DestPath -Recurse -Force -ErrorAction SilentlyContinue

        if (-not $items -or $items.Count -eq 0) {
            # Directory is empty, remove it
            Write-ColorMessage -Message "$SCRIPT_INDEX Destination directory is empty, removing: $DestPath" -Type "Warning"
            Remove-Item -Path $DestPath -Force -Recurse -ErrorAction SilentlyContinue
        } else {
            # Directory contains files
            Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Destination already exists and contains files: $DestPath" -Type "Error"
            Write-ColorMessage -Message "$SCRIPT_INDEX Please manually remove or rename the destination directory first" -Type "Error"
            return $false
        }
    }

    # Ensure parent directory exists
    $destParent = Split-Path $DestPath -Parent
    if (-not (Test-Path $destParent)) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Creating parent directory: $destParent" -Type "Info"
        New-Item -ItemType Directory -Path $destParent -Force
    }

    # Ask for confirmation
    Write-ColorMessage -Message "$SCRIPT_INDEX This will move the entire project directory. Continue? (Y/n, timeout 10s, default: Y)" -Type "Warning"

    $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
    $timeout = 10
    $shouldMove = $true

    while ($stopWatch.Elapsed.TotalSeconds -lt $timeout -and !$host.UI.RawUI.KeyAvailable) {
        Start-Sleep -Milliseconds 200
    }

    if ($host.UI.RawUI.KeyAvailable) {
        $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
        if ($key -eq 'n' -or $key -eq 'N') {
            $shouldMove = $false
        }
    }

    $stopWatch.Stop()

    if (-not $shouldMove) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Move cancelled by user" -Type "Warning"
        return $false
    }

    # Perform the move
    try {
        Write-ColorMessage -Message "$SCRIPT_INDEX Moving project (this may take a while)..." -Type "Warning"

        Move-Item -Path $SourcePath -Destination $DestPath -Force -ErrorAction Stop

        Write-ColorMessage -Message "$SCRIPT_INDEX Successfully moved project to: $DestPath" -Type "Success"
        return $true

    } catch {
        Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Failed to move project: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Main-FixProjectLocation {
    Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX   Core Node Project Location Fix Utility" -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Info"

    Write-ColorMessage -Message "$SCRIPT_INDEX Target location: $TARGET_PROJECT_DIR" -Type "Info"

    # Find all core_node projects
    $projects = @(Find-CoreNodeProjects)

    if (-not $projects -or $projects.Count -eq 0) {
        Write-ColorMessage -Message "$SCRIPT_INDEX No core_node projects found" -Type "Warning"
        Write-ColorMessage -Message "$SCRIPT_INDEX Cloning project to target location..." -Type "Info"

        # Get clone URL (will use SSH if available, otherwise HTTPS)
        $hasSSHKey = Test-SSHKeyPairExists
        if ($hasSSHKey) {
            Write-ColorMessage -Message "$SCRIPT_INDEX SSH key found, will use SSH clone" -Type "Success"
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX No SSH key found, will use HTTPS clone" -Type "Info"
        }
        $cloneUrl = Get-RegionCloneURL

        # Ensure parent directory exists
        if (-not (Test-Path $TARGET_PROGRAMING_DIR)) {
            New-Item -ItemType Directory -Path $TARGET_PROGRAMING_DIR -Force
        }

        # Clone project
        Set-Location $TARGET_PROGRAMING_DIR

        $gitExePath = $Global:GIT_EXE_PATH
        if (-not (Test-Path $gitExePath)) {
            Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Git not found at $gitExePath" -Type "Error"
            Write-ColorMessage -Message "$SCRIPT_INDEX Please install Git first using Step6_InstallGit.ps1" -Type "Error"
            return
        }

        # Check if target directory already exists
        if (Test-Path $TARGET_PROJECT_DIR) {
            # Get all items in the directory (files and subdirectories)
            $items = Get-ChildItem -Path $TARGET_PROJECT_DIR -Recurse -Force -ErrorAction SilentlyContinue

            if (-not $items -or $items.Count -eq 0) {
                # Directory is empty, remove it
                Write-ColorMessage -Message "$SCRIPT_INDEX Target directory is empty, removing: $TARGET_PROJECT_DIR" -Type "Warning"
                Remove-Item -Path $TARGET_PROJECT_DIR -Force -Recurse -ErrorAction SilentlyContinue
            } else {
                # Directory contains files
                Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Target directory exists and contains files: $TARGET_PROJECT_DIR" -Type "Error"
                Write-ColorMessage -Message "$SCRIPT_INDEX Please manually remove this directory before cloning" -Type "Error"
                return
            }
        }

        # Execute git clone directly without capturing output or exit code
        Start-Process -FilePath $gitExePath -ArgumentList "clone", $cloneUrl -Wait -NoNewWindow

        # Verify clone by checking if directory contains files
        if (Test-Path $TARGET_PROJECT_DIR) {
            $items = Get-ChildItem -Path $TARGET_PROJECT_DIR -Recurse -Force -ErrorAction SilentlyContinue
            if ($items.Count -gt 0) {
                Write-ColorMessage -Message "$SCRIPT_INDEX Project cloned successfully to: $TARGET_PROJECT_DIR" -Type "Success"
                Write-ColorMessage -Message "$SCRIPT_INDEX Please run dd.cmd from the project directory to continue installation:" -Type "Warning"
                Write-ColorMessage -Message "$SCRIPT_INDEX   cd /d $TARGET_PROJECT_DIR" -Type "Info"
                Write-ColorMessage -Message "$SCRIPT_INDEX   dd.cmd" -Type "Info"
                Read-Host "Press Enter to exit"
                return
            } else {
                Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Failed to clone project" -Type "Error"
            }
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX ERROR: Failed to clone project" -Type "Error"
        }

        return
    }

    # Check if project is already at correct location
    $correctLocationProject = @($projects | Where-Object { Test-IsCorrectLocation -Path $_.Path })

    if ($correctLocationProject.Count -gt 0) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Project already at correct location: $($correctLocationProject[0].Path)" -Type "Success"

        # Check if current script is running from within the project directory
        $currentScriptPath = $PSScriptRoot
        $normalizedProjectPath = $TARGET_PROJECT_DIR.TrimEnd('\')
        $normalizedScriptPath = $currentScriptPath.TrimEnd('\')

        $isRunningFromProject = $normalizedScriptPath.StartsWith("$normalizedProjectPath\", [System.StringComparison]::OrdinalIgnoreCase) -or
                                ($normalizedScriptPath -eq $normalizedProjectPath)

        if ($isRunningFromProject) {
            Write-ColorMessage -Message "$SCRIPT_INDEX Already running from project directory, no need to switch" -Type "Success"
            return
        } else {
            Write-ColorMessage -Message "$SCRIPT_INDEX Not running from project directory, but project is at correct location" -Type "Info"
            Write-ColorMessage -Message "$SCRIPT_INDEX Installation will continue from current location" -Type "Info"
            return
        }
    }

    # Find projects at wrong locations
    $wrongLocationProjects = @($projects | Where-Object { -not (Test-IsCorrectLocation -Path $_.Path) })

    if (-not $wrongLocationProjects -or $wrongLocationProjects.Count -eq 0) {
        Write-ColorMessage -Message "$SCRIPT_INDEX No projects found at incorrect locations" -Type "Success"
        return
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Found $($wrongLocationProjects.Count) project(s) at incorrect location(s):" -Type "Warning"

    foreach ($proj in $wrongLocationProjects) {
        Write-ColorMessage -Message "$SCRIPT_INDEX   - $($proj.Path)" -Type "Warning"
    }

    # If multiple projects found, ask user to choose
    if ($wrongLocationProjects.Count -gt 1) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Multiple projects found. Which one to move?" -Type "Warning"

        for ($i = 0; $i -lt $wrongLocationProjects.Count; $i++) {
            $proj = $wrongLocationProjects[$i]
            $isCurrent = if ($proj.IsCurrent) { " (CURRENT LOCATION)" } else { "" }
            Write-ColorMessage -Message "$SCRIPT_INDEX   [$($i+1)] $($proj.Path)$isCurrent" -Type "Info"
        }

        Write-ColorMessage -Message "$SCRIPT_INDEX Enter number (1-$($wrongLocationProjects.Count)) or 'n' to cancel (timeout 30s, default: 1):" -Type "Warning"

        $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
        $timeout = 30
        $selectedIndex = 0  # Default to first project
        $userInput = ""

        while ($stopWatch.Elapsed.TotalSeconds -lt $timeout -and !$host.UI.RawUI.KeyAvailable) {
            Start-Sleep -Milliseconds 200
        }

        if ($host.UI.RawUI.KeyAvailable) {
            $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
            $userInput = $key

            if ($userInput -eq 'n' -or $userInput -eq 'N') {
                Write-ColorMessage -Message "$SCRIPT_INDEX Operation cancelled by user" -Type "Warning"
                return
            }

            if ($userInput -match '^\d$') {
                $num = [int]$userInput
                if ($num -ge 1 -and $num -le $wrongLocationProjects.Count) {
                    $selectedIndex = $num - 1
                }
            }
        }

        $stopWatch.Stop()
        $selectedProject = $wrongLocationProjects[$selectedIndex]

    } else {
        # Only one project found
        $selectedProject = $wrongLocationProjects[0]
    }

    Write-ColorMessage -Message "$SCRIPT_INDEX Selected project: $($selectedProject.Path)" -Type "Info"

    # Ask if user wants to move to correct location
    Write-ColorMessage -Message "$SCRIPT_INDEX Move this project to correct location?" -Type "Warning"
    Write-ColorMessage -Message "$SCRIPT_INDEX   From: $($selectedProject.Path)" -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX   To: $TARGET_PROJECT_DIR" -Type "Info"
    Write-ColorMessage -Message "$SCRIPT_INDEX Proceed? (Y/n, timeout 10s, default: Y)" -Type "Warning"

    $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()
    $timeout = 10
    $shouldProceed = $true

    while ($stopWatch.Elapsed.TotalSeconds -lt $timeout -and !$host.UI.RawUI.KeyAvailable) {
        Start-Sleep -Milliseconds 200
    }

    if ($host.UI.RawUI.KeyAvailable) {
        $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown").Character
        if ($key -eq 'n' -or $key -eq 'N') {
            $shouldProceed = $false
        }
    }

    $stopWatch.Stop()

    if (-not $shouldProceed) {
        Write-ColorMessage -Message "$SCRIPT_INDEX Operation cancelled by user" -Type "Warning"
        return
    }

    # Move the project
    $moveSuccess = Move-CoreNodeProject -SourcePath $selectedProject.Path -DestPath $TARGET_PROJECT_DIR

    if ($moveSuccess) {
        Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Success"
        Write-ColorMessage -Message "$SCRIPT_INDEX   Project location fixed successfully!" -Type "Success"
        Write-ColorMessage -Message "$SCRIPT_INDEX   New location: $TARGET_PROJECT_DIR" -Type "Success"
        Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Success"
        Write-ColorMessage -Message "$SCRIPT_INDEX Please run dd.cmd from the project directory to continue installation:" -Type "Warning"
        Write-ColorMessage -Message "$SCRIPT_INDEX   cd /d $TARGET_PROJECT_DIR" -Type "Info"
        Write-ColorMessage -Message "$SCRIPT_INDEX   dd.cmd" -Type "Info"
        Read-Host "Press Enter to exit"
        return
    } else {
        Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Error"
        Write-ColorMessage -Message "$SCRIPT_INDEX   Failed to fix project location" -Type "Error"
        Write-ColorMessage -Message "$SCRIPT_INDEX ===============================================" -Type "Error"
    }
}

# Main execution
Main-FixProjectLocation
