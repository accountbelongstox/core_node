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

# Unified Manager - Build Applications
# Builds one or multiple applications in the project

param(
    [string[]]$Apps = @(),           # Specific apps to build (app:subapp format)
    [string]$Type = "",              # Build apps of specific type (frontend, backend, mobile)
    [switch]$All = $false,           # Build all buildable apps
    [switch]$Production = $false,    # Production build
    [switch]$Clean = $false,         # Clean before build
    [switch]$Parallel = $false,      # Build in parallel
    [switch]$List = $false,          # List buildable apps
    [switch]$Verbose = $false        # Verbose output
)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UTILS_PATH = Join-Path $SCRIPT_DIR "common\utils.ps1"
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)

# Import utilities
. $UTILS_PATH

# Function to list buildable applications
function Show-BuildableApps {
    Write-Info "Buildable Applications:"
    
    $registry = Get-AppRegistry
    if (-not $registry) {
        return
    }
    
    $buildableApps = @()
    
    foreach ($appName in $registry.apps.PSObject.Properties.Name) {
        $appConfig = $registry.apps.$appName
        
        if ($appConfig.build_cmd) {
            $buildableApps += @{
                Name = $appName
                Type = $appConfig.type
                Category = $appConfig.category
                BuildCmd = $appConfig.build_cmd
                Description = $appConfig.description
            }
        }
        
        if ($appConfig.sub_apps) {
            foreach ($subAppName in $appConfig.sub_apps.PSObject.Properties.Name) {
                $subAppConfig = $appConfig.sub_apps.$subAppName
                if ($subAppConfig.build_cmd) {
                    $buildableApps += @{
                        Name = "$appName`:$subAppName"
                        Type = $appConfig.type
                        Category = $appConfig.category
                        BuildCmd = $subAppConfig.build_cmd
                        Description = $subAppConfig.description
                    }
                }
            }
        }
    }
    
    if ($buildableApps.Count -eq 0) {
        Write-Warning "No buildable applications found"
        return
    }
    
    # Group by category
    $categories = $buildableApps | Group-Object Category
    
    foreach ($category in $categories) {
        Write-Host "  $($category.Name.ToUpper()):" -ForegroundColor Cyan
        foreach ($app in $category.Group) {
            Write-Host "    $($app.Name)" -ForegroundColor White
            Write-Host "      Type: $($app.Type)" -ForegroundColor Gray
            Write-Host "      Build: $($app.BuildCmd)" -ForegroundColor Gray
            Write-Host "      Description: $($app.Description)" -ForegroundColor Gray
            Write-Host ""
        }
    }
}

# Function to clean application build artifacts
function Clear-AppBuildArtifacts {
    param([string]$AppName, [string]$SubApp = $null)
    
    $appPath = Get-AppPath -AppName $AppName
    if (-not $appPath) {
        return $false
    }
    
    Write-Info "Cleaning build artifacts for $AppName$(if($SubApp){":$SubApp"})"
    
    # Common build directories to clean
    $buildDirs = @("dist", "build", ".output", "public/build", "target", "__pycache__")
    $buildFiles = @("*.pyc", "*.pyo", "*.egg-info")
    
    foreach ($dir in $buildDirs) {
        $fullPath = Join-Path $appPath $dir
        if (Test-Path $fullPath) {
            try {
                Remove-Item $fullPath -Recurse -Force
                Write-Info "  Removed: $dir"
            }
            catch {
                Write-Warning "  Failed to remove: $dir - $_"
            }
        }
    }
    
    foreach ($pattern in $buildFiles) {
        try {
            Get-ChildItem -Path $appPath -Filter $pattern -Recurse | Remove-Item -Force
        }
        catch {
            # Ignore errors for file patterns
        }
    }
    
    return $true
}

# Function to build a single application
function Build-SingleApp {
    param([string]$AppSpec)

    Write-Info "Building application: $AppSpec"

    # Get app configuration
    $appConfig = Get-AppConfig -AppIdentifier $AppSpec
    if (-not $appConfig) {
        Write-Error "Failed to get configuration for $AppSpec"
        return $false
    }

    # Check if app exists
    if (-not (Test-AppExists -AppIdentifier $appConfig)) {
        Write-Error "Application not found: $AppSpec"
        return $false
    }
    
    # Get build command
    $buildCmd = $appConfig.build_cmd
    if (-not $buildCmd -or $buildCmd -eq "null") {
        Write-Warning "No build command specified for $AppSpec, skipping"
        return $true
    }
    
    # Get app path
    $appPath = Get-AppPath -AppIdentifier $appConfig
    if (-not $appPath) {
        Write-Error "Failed to get path for $($appConfig.name)"
        return $false
    }
    
    # Check dependencies
    $requiredCommands = @()
    switch ($appConfig.type) {
        "node" { $requiredCommands = @("node", "npm") }
        "python" { $requiredCommands = @("python") }
        "poly" {
            $packageManager = $buildCmd.Split()[0]
            switch ($packageManager) {
                "npm" { $requiredCommands = @("node", "npm") }
                "yarn" { $requiredCommands = @("node", "yarn") }
                "pnpm" { $requiredCommands = @("node", "pnpm") }
                "php" { $requiredCommands = @("php") }
                "flutter" { $requiredCommands = @("flutter") }
                "composer" { $requiredCommands = @("php", "composer") }
            }
        }
    }
    
    if (-not (Test-Dependencies -RequiredCommands $requiredCommands)) {
        Write-Error "Missing dependencies for $AppSpec"
        return $false
    }
    
    # Clean if requested
    if ($Clean) {
        Clear-AppBuildArtifacts -AppName $appName -SubApp $subApp
    }
    
    # Display build information
    Write-Info "  Type: $($appConfig.type)"
    Write-Info "  Category: $($appConfig.category)"
    Write-Info "  Path: $appPath"
    Write-Info "  Build Command: $buildCmd"
    
    # Modify build command for production if needed
    $finalBuildCmd = $buildCmd
    if ($Production) {
        # Add production flags for common build tools
        if ($buildCmd -match "npm run build") {
            $finalBuildCmd = $buildCmd -replace "npm run build", "npm run build --production"
        }
        elseif ($buildCmd -match "yarn build") {
            $finalBuildCmd = $buildCmd -replace "yarn build", "yarn build --mode production"
        }
        elseif ($buildCmd -match "flutter build") {
            $finalBuildCmd = $buildCmd -replace "flutter build", "flutter build --release"
        }
        
        # Set NODE_ENV for Node.js applications
        if ($appConfig.type -eq "poly" -and ($buildCmd -match "npm|yarn|pnpm")) {
            $env:NODE_ENV = "production"
        }
    }
    
    if ($Verbose) {
        Write-Info "  Final Command: $finalBuildCmd"
    }
    
    try {
        $buildStartTime = Get-Date
        
        Invoke-InDirectory -Path $appPath -ScriptBlock {
            if ($Verbose) {
                Invoke-Expression $finalBuildCmd
            } else {
                Invoke-Expression $finalBuildCmd | Out-Null
            }
            
            if ($LASTEXITCODE -ne 0) {
                throw "Build command failed with exit code $LASTEXITCODE"
            }
        }
        
        $buildEndTime = Get-Date
        $buildDuration = $buildEndTime - $buildStartTime
        
        Write-Success "Built $AppSpec successfully (took $($buildDuration.TotalSeconds.ToString('F1'))s)"
        return $true
    }
    catch {
        Write-Error "Failed to build $AppSpec`: $_"
        return $false
    }
    finally {
        # Reset environment variables
        if ($Production -and $env:NODE_ENV -eq "production") {
            Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
        }
    }
}

# Function to get apps to build based on filters
function Get-AppsToBuild {
    $registry = Get-AppRegistry
    if (-not $registry) {
        return @()
    }
    
    $appsToBuild = @()
    
    if ($Apps.Count -gt 0) {
        # Build specific apps
        $appsToBuild = $Apps
    }
    elseif ($All) {
        # Build all buildable apps
        foreach ($appName in $registry.apps.PSObject.Properties.Name) {
            $appConfig = $registry.apps.$appName
            
            if ($appConfig.build_cmd) {
                $appsToBuild += $appName
            }
            
            if ($appConfig.sub_apps) {
                foreach ($subAppName in $appConfig.sub_apps.PSObject.Properties.Name) {
                    $subAppConfig = $appConfig.sub_apps.$subAppName
                    if ($subAppConfig.build_cmd) {
                        $appsToBuild += "$appName`:$subAppName"
                    }
                }
            }
        }
    }
    elseif ($Type) {
        # Build apps by category
        foreach ($appName in $registry.apps.PSObject.Properties.Name) {
            $appConfig = $registry.apps.$appName
            
            if ($appConfig.category -eq $Type -and $appConfig.build_cmd) {
                $appsToBuild += $appName
            }
            
            if ($appConfig.sub_apps) {
                foreach ($subAppName in $appConfig.sub_apps.PSObject.Properties.Name) {
                    $subAppConfig = $appConfig.sub_apps.$subAppName
                    if ($appConfig.category -eq $Type -and $subAppConfig.build_cmd) {
                        $appsToBuild += "$appName`:$subAppName"
                    }
                }
            }
        }
    }
    
    return $appsToBuild
}

# Function to build multiple applications
function Build-MultipleApps {
    param([string[]]$AppSpecs)
    
    Write-Info "Building $($AppSpecs.Count) applications..."
    
    $successfulBuilds = @()
    $failedBuilds = @()
    $totalStartTime = Get-Date
    
    if ($Parallel) {
        # Parallel building
        Write-Info "Building applications in parallel..."
        $jobs = @()
        
        foreach ($appSpec in $AppSpecs) {
            $job = Start-Job -ScriptBlock {
                param($AppSpec, $UtilsPath, $Production, $Clean, $Verbose)
                . $UtilsPath
                Build-SingleApp -AppSpec $AppSpec
            } -ArgumentList $appSpec, $UTILS_PATH, $Production, $Clean, $Verbose
            
            $jobs += @{Job = $job; AppSpec = $appSpec}
        }
        
        # Wait for all jobs to complete
        foreach ($jobInfo in $jobs) {
            $result = Receive-Job -Job $jobInfo.Job -Wait
            Remove-Job -Job $jobInfo.Job
            
            if ($result) {
                $successfulBuilds += $jobInfo.AppSpec
            } else {
                $failedBuilds += $jobInfo.AppSpec
            }
        }
    } else {
        # Sequential building
        foreach ($appSpec in $AppSpecs) {
            if (Build-SingleApp -AppSpec $appSpec) {
                $successfulBuilds += $appSpec
            } else {
                $failedBuilds += $appSpec
            }
        }
    }
    
    $totalEndTime = Get-Date
    $totalDuration = $totalEndTime - $totalStartTime
    
    # Report results
    Write-Info "Build completed in $($totalDuration.TotalSeconds.ToString('F1'))s"
    Write-Success "Successfully built: $($successfulBuilds.Count) apps"
    if ($successfulBuilds.Count -gt 0) {
        Write-Info "  - $($successfulBuilds -join ', ')"
    }
    
    if ($failedBuilds.Count -gt 0) {
        Write-Error "Failed to build: $($failedBuilds.Count) apps"
        Write-Error "  - $($failedBuilds -join ', ')"
        return $false
    }
    
    return $true
}

# Main execution function
function Start-Building {
    if ($List) {
        Show-BuildableApps
        return $true
    }
    
    Write-Info "Starting build process..."
    Write-Info "Production mode: $Production"
    Write-Info "Clean before build: $Clean"
    Write-Info "Parallel execution: $Parallel"
    
    # Get apps to build
    $appsToBuild = Get-AppsToBuild
    if ($appsToBuild.Count -eq 0) {
        Write-Warning "No applications found to build"
        return $true
    }
    
    Write-Info "Building $($appsToBuild.Count) applications: $($appsToBuild -join ', ')"
    
    return Build-MultipleApps -AppSpecs $appsToBuild
}

# Main execution
if (-not (Test-Path $UTILS_PATH)) {
    Write-Error "Utilities not found: $UTILS_PATH"
    exit 1
}

$success = Start-Building
if (-not $success) {
    exit 1
}

Write-Success "All builds completed successfully!"
exit 0
