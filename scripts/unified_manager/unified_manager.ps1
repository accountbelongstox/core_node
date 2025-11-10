# Unified Manager for Core Node Applications
# Manages applications in Core Node project

# Define script self path
$scriptPath = $PSScriptRoot
$rootDir = (Get-Item $scriptPath).Parent.Parent.FullName
$NcoreApps = Join-Path $rootDir "apps"

# Source GlobalVars.ps1 to get $Global:USER_DIR
. (Join-Path $rootDir "scripts\shells\win\win_common\GlobalVars.ps1")

# Debug output for paths
Write-Host "Script Path: $scriptPath" -ForegroundColor Cyan
Write-Host "Root Dir: $rootDir" -ForegroundColor Cyan
Write-Host "Apps Dir: $NcoreApps" -ForegroundColor Cyan
Write-Host "Apps Dir Exists: $(Test-Path $NcoreApps)" -ForegroundColor Cyan
Write-Host "User Dir: $Global:USER_DIR" -ForegroundColor Cyan
Write-Host ""

# Cache directory
$cacheDir = Join-Path $Global:USER_DIR "unified_manager"
$cacheFile = Join-Path $cacheDir "app_cache.json"
$tempScriptDir = Join-Path $cacheDir "temp_scripts"

# Ensure cache directory exists
if (-not (Test-Path $cacheDir)) {
    New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
}

# Ensure temp script directory exists
if (-not (Test-Path $tempScriptDir)) {
    New-Item -ItemType Directory -Path $tempScriptDir -Force | Out-Null
}

# Application information class
class AppInfo {
    [string]$Name
    [string]$Path
    [bool]$HasInstallPs1
    [bool]$HasStartPs1
    [bool]$HasStartBat
    [bool]$HasMainPy
    [bool]$HasMainJs
    [bool]$HasPubspecYaml
    [bool]$HasComposerJson
    [bool]$HasNuxtConfig
    [bool]$HasIndexPhp
    [bool]$IsSelected
    [string[]]$AvailableScripts
    [string]$CurrentScript
    [int]$ScriptIndex
    [string]$AppType
    
    AppInfo([string]$name, [string]$path, [string]$appType) {
        $this.Name = $name
        $this.Path = $path
        $this.AppType = $appType
        $this.IsSelected = $false
        $this.AvailableScripts = @()
        $this.CurrentScript = ""
        $this.ScriptIndex = 0
        $this.CheckScripts()
    }
    
    [void] CheckScripts() {
        # Check for native startup files and project indicators
        $this.HasMainPy = Test-Path (Join-Path $this.Path "main.py")
        $this.HasMainJs = Test-Path (Join-Path $this.Path "main.js")
        $this.HasPubspecYaml = Test-Path (Join-Path $this.Path "pubspec.yaml")
        $this.HasComposerJson = Test-Path (Join-Path $this.Path "composer.json")
        $this.HasNuxtConfig = Test-Path (Join-Path $this.Path "nuxt.config.ts")
        $this.HasIndexPhp = Test-Path (Join-Path $this.Path "index.php")
    }
}

# Global variables
$global:Apps = @()
$global:SelectedApps = @()
$global:CurrentIndex = 0
$global:MaxAppNameWidth = 0

# Script files to scan for
$global:ScriptFiles = @("start.ps1", "start.bat", "install.ps1", "deploy.ps1", "deploy.bat")

# Poly apps directory
$PolyApps = Join-Path $rootDir "poly_apps"

# Py apps directory
$PyApps = Join-Path $rootDir "pyapps"

# Generate pyStart command (for general Python apps with main.py)
function Get-PyStartCommand {
    param([string]$AppPath)

    $mainPyPath = Join-Path $AppPath "main.py"
    if (Test-Path $mainPyPath) {
        $absolutePath = (Resolve-Path $mainPyPath).Path
        return "python `"$absolutePath`""
    }
    return $null
}

# Generate pycoreStart command (for pycore apps using pymain.py launcher)
function Get-PycoreStartCommand {
    param([string]$AppPath)

    $appName = Split-Path $AppPath -Leaf
    $rootDirPath = (Get-Item $PSScriptRoot).Parent.Parent.FullName
    $pymainPath = Join-Path $rootDirPath "pymain.py"

    # Check if app has main.py or {appname}_main.py
    $mainPyPath = Join-Path $AppPath "main.py"
    $appMainPyPath = Join-Path $AppPath "$($appName)_main.py"

    if ((Test-Path $mainPyPath) -or (Test-Path $appMainPyPath)) {
        if (Test-Path $pymainPath) {
            return "python `"$pymainPath`" app=$appName"
        }
    }
    return $null
}

# Generate ncoreStart command
function Get-NcoreStartCommand {
    param([string]$AppPath)

    $mainJsPath = Join-Path $AppPath "main.js"
    if (Test-Path $mainJsPath) {
        $appName = Split-Path $AppPath -Leaf
        $rootDirPath = (Get-Item $PSScriptRoot).Parent.Parent.FullName
        $mainJsAbsolutePath = (Resolve-Path (Join-Path $rootDirPath "main.js")).Path
        return "node `"$mainJsAbsolutePath`" app=$appName"
    }
    return $null
}

# Generate flutterStart command
function Get-FlutterStartCommand {
    param([string]$AppPath)
    
    $pubspecPath = Join-Path $AppPath "pubspec.yaml"
    if (Test-Path $pubspecPath) {
        Push-Location $AppPath
        $absolutePath = (Resolve-Path $AppPath).Path
        Pop-Location
        return "cd `"$absolutePath`" && flutter run"
    }
    return $null
}

# Generate laravelStart command
function Get-LaravelStartCommand {
    param([string]$AppPath)
    
    $composerPath = Join-Path $AppPath "composer.json"
    $publicIndexPath = Join-Path $AppPath "public\index.php"
    
    if ((Test-Path $composerPath) -and (Test-Path $publicIndexPath)) {
        $absolutePath = (Resolve-Path $AppPath).Path
        return "cd `"$absolutePath`" && php artisan serve"
    }
    return $null
}

# Generate nuxtStart command
function Get-NuxtStartCommand {
    param([string]$AppPath)
    
    $nuxtConfigPath = Join-Path $AppPath "nuxt.config.ts"
    if (Test-Path $nuxtConfigPath) {
        $absolutePath = (Resolve-Path $AppPath).Path
        return "cd `"$absolutePath`" && npm run dev"
    }
    return $null
}

# Generate phpStart command
function Get-PhpStartCommand {
    param([string]$AppPath)

    $indexPhpPath = Join-Path $AppPath "index.php"
    if (Test-Path $indexPhpPath) {
        $absolutePath = (Resolve-Path $indexPhpPath).Path
        return "php -S localhost:8000 -t `"$(Split-Path $absolutePath)`""
    }
    return $null
}

# Generate Ncore/Pycore/Installer command (unified installer for both ncore and pycore)
function Get-TInstallerCommand {
    param([string]$AppPath, [string]$AppType)

    if ($AppType -eq "ncoreApp") {
        $startCommand = Get-NcoreStartCommand -AppPath $AppPath
        if ($startCommand) {
            return $startCommand
        }
    } elseif ($AppType -eq "pycoreApp") {
        $startCommand = Get-PycoreStartCommand -AppPath $AppPath
        if ($startCommand) {
            return $startCommand
        }
    }
    return $null
}

# Step 1: Scan $rootDir/apps and get ncoreApp list with appType
function Step1-ScanNcoreApps {
    Write-Host "Step 1: Scanning $rootDir/apps directory..." -ForegroundColor Cyan
    
    $ncoreAppsPath = Join-Path $rootDir "apps"
    $ncoreApps = @()
    
    if (Test-Path $ncoreAppsPath) {
        $appDirectories = Get-ChildItem -Path $ncoreAppsPath -Directory
        foreach ($dir in $appDirectories) {
            $app = [AppInfo]::new($dir.Name, $dir.FullName, "ncoreApp")
            $ncoreApps += $app
            Write-Host "  Found: $($app.Name) [ncoreApp]" -ForegroundColor Gray
        }
        Write-Host "  Total ncoreApps: $($ncoreApps.Count)" -ForegroundColor Green
    } else {
        Write-Host "  Directory not found: $ncoreAppsPath" -ForegroundColor Red
    }
    
    return $ncoreApps
}

# Step 2: Scan $rootDir/poly_apps and get poly_apps list with appType
function Step2-ScanPolyApps {
    Write-Host "Step 2: Scanning $rootDir/poly_apps directory..." -ForegroundColor Cyan

    $polyAppsPath = Join-Path $rootDir "poly_apps"
    $polyApps = @()

    if (Test-Path $polyAppsPath) {
        $appDirectories = Get-ChildItem -Path $polyAppsPath -Directory
        foreach ($dir in $appDirectories) {
            $app = [AppInfo]::new($dir.Name, $dir.FullName, "poly_apps")
            $polyApps += $app
            Write-Host "  Found: $($app.Name) [poly_apps]" -ForegroundColor Gray
        }
        Write-Host "  Total poly_apps: $($polyApps.Count)" -ForegroundColor Green
    } else {
        Write-Host "  Directory not found: $polyAppsPath" -ForegroundColor Red
    }

    return $polyApps
}

# Step 2.5: Scan $rootDir/pyapps and get pycoreApp list with appType
function Step2_5-ScanPyApps {
    Write-Host "Step 2.5: Scanning $rootDir/pyapps directory..." -ForegroundColor Cyan

    $pyAppsPath = Join-Path $rootDir "pyapps"
    $pyApps = @()

    if (Test-Path $pyAppsPath) {
        $appDirectories = Get-ChildItem -Path $pyAppsPath -Directory
        foreach ($dir in $appDirectories) {
            # Skip hidden and system directories
            if ($dir.Name.StartsWith('.') -or $dir.Name.StartsWith('__')) {
                continue
            }

            # Check if it has a valid entry point (main.py or {appname}_main.py)
            $mainPyPath = Join-Path $dir.FullName "main.py"
            $appMainPyPath = Join-Path $dir.FullName "$($dir.Name)_main.py"

            if ((Test-Path $mainPyPath) -or (Test-Path $appMainPyPath)) {
                $app = [AppInfo]::new($dir.Name, $dir.FullName, "pycoreApp")
                $pyApps += $app
                Write-Host "  Found: $($app.Name) [pycoreApp]" -ForegroundColor Gray
            } else {
                Write-Host "  Skipped: $($dir.Name) (no valid entry point)" -ForegroundColor DarkGray
            }
        }
        Write-Host "  Total pycoreApps: $($pyApps.Count)" -ForegroundColor Green
    } else {
        Write-Host "  Directory not found: $pyAppsPath" -ForegroundColor Red
    }

    return $pyApps
}

# Step 3: Generate native startup commands and set first toggle item for each list
function Step3-GenerateNativeStartup {
    param([array]$AppList)

    Write-Host "Step 3: Generating native startup commands..." -ForegroundColor Cyan

    foreach ($app in $AppList) {
        $app.AvailableScripts = @()
        $foundNative = $false

        # Priority 1: ncoreStart for ncoreApp with main.js
        if ($app.AppType -eq "ncoreApp" -and $app.HasMainJs) {
            $startCommand = Get-NcoreStartCommand -AppPath $app.Path
            if ($startCommand) {
                $app.AvailableScripts += "ncoreStart&Installer"
                $app.CurrentScript = "ncoreStart&Installer"
                $app.ScriptIndex = 0
                $foundNative = $true
                Write-Host "  $($app.Name): ncoreStart&Installer - $startCommand" -ForegroundColor Magenta
            }
        }

        # Priority 1.5: pycoreStart for pycoreApp
        if ($app.AppType -eq "pycoreApp") {
            $startCommand = Get-PycoreStartCommand -AppPath $app.Path
            if ($startCommand) {
                $app.AvailableScripts += "pycoreStart&Installer"
                $app.CurrentScript = "pycoreStart&Installer"
                $app.ScriptIndex = 0
                $foundNative = $true
                Write-Host "  $($app.Name): pycoreStart&Installer - $startCommand" -ForegroundColor Magenta
            }
        }

        # Priority 1.9: Add Ncore/Pycore/Installer for both ncoreApp and pycoreApp
        if ($app.AppType -eq "ncoreApp" -or $app.AppType -eq "pycoreApp") {
            $tCommand = Get-TInstallerCommand -AppPath $app.Path -AppType $app.AppType
            if ($tCommand) {
                $app.AvailableScripts += "Ncore/Pycore/Installer"
                Write-Host "  $($app.Name): Ncore/Pycore/Installer (unified) - $tCommand" -ForegroundColor Magenta
            }
        }
        
        # Priority 2: Framework-specific starts for poly_apps
        if ($app.AppType -eq "poly_apps") {
            # Flutter
            if ($app.HasPubspecYaml) {
                $startCommand = Get-FlutterStartCommand -AppPath $app.Path
                if ($startCommand) {
                    if (-not $foundNative) {
                        $app.AvailableScripts += "flutterStart"
                        $app.CurrentScript = "flutterStart"
                        $app.ScriptIndex = 0
                        $foundNative = $true
                    } else {
                        $app.AvailableScripts += "flutterStart"
                    }
                    Write-Host "  $($app.Name): flutterStart - $startCommand" -ForegroundColor Magenta
                }
            }
            
            # Laravel
            if ($app.HasComposerJson) {
                $publicIndexPath = Join-Path $app.Path "public\index.php"
                if (Test-Path $publicIndexPath) {
                    $startCommand = Get-LaravelStartCommand -AppPath $app.Path
                    if ($startCommand) {
                        if (-not $foundNative) {
                            $app.AvailableScripts += "laravelStart"
                            $app.CurrentScript = "laravelStart"
                            $app.ScriptIndex = 0
                            $foundNative = $true
                        } else {
                            $app.AvailableScripts += "laravelStart"
                        }
                        Write-Host "  $($app.Name): laravelStart - $startCommand" -ForegroundColor Magenta
                    }
                }
            }
            
            # Nuxt
            if ($app.HasNuxtConfig) {
                $startCommand = Get-NuxtStartCommand -AppPath $app.Path
                if ($startCommand) {
                    if (-not $foundNative) {
                        $app.AvailableScripts += "nuxtStart"
                        $app.CurrentScript = "nuxtStart"
                        $app.ScriptIndex = 0
                        $foundNative = $true
                    } else {
                        $app.AvailableScripts += "nuxtStart"
                    }
                    Write-Host "  $($app.Name): nuxtStart - $startCommand" -ForegroundColor Magenta
                }
            }
            
            # PHP (plain)
            if ($app.HasIndexPhp -and -not $app.HasComposerJson) {
                $startCommand = Get-PhpStartCommand -AppPath $app.Path
                if ($startCommand) {
                    if (-not $foundNative) {
                        $app.AvailableScripts += "phpStart"
                        $app.CurrentScript = "phpStart"
                        $app.ScriptIndex = 0
                        $foundNative = $true
                    } else {
                        $app.AvailableScripts += "phpStart"
                    }
                    Write-Host "  $($app.Name): phpStart - $startCommand" -ForegroundColor Magenta
                }
            }
        }
        
        # Priority 3: pyStart for main.py
        if ($app.HasMainPy) {
            $startCommand = Get-PyStartCommand -AppPath $app.Path
            if ($startCommand) {
                if (-not $foundNative) {
                    $app.AvailableScripts += "pyStart"
                    $app.CurrentScript = "pyStart"
                    $app.ScriptIndex = 0
                    $foundNative = $true
                } else {
                    $app.AvailableScripts += "pyStart"
                }
                Write-Host "  $($app.Name): pyStart - $startCommand" -ForegroundColor Magenta
            }
        }
    }
}

# Step 4: Integrate three lists into one data
function Step4-IntegrateData {
    param([array]$NcoreApps, [array]$PolyApps, [array]$PyApps)

    Write-Host "Step 4: Integrating data..." -ForegroundColor Cyan

    $allApps = @()
    $allApps += $NcoreApps
    $allApps += $PolyApps
    $allApps += $PyApps

    Write-Host "  Total apps: $($allApps.Count)" -ForegroundColor Green

    return $allApps
}

# Step 5: Scan scripts directory for each app
function Step5-ScanScriptsDirectory {
    param([array]$AllApps)
    
    Write-Host "Step 5: Scanning scripts directories..." -ForegroundColor Cyan
    
    foreach ($app in $AllApps) {
        $scriptsPath = Join-Path $app.Path "scripts"
        if (Test-Path $scriptsPath) {
            $foundScripts = @()
            foreach ($scriptFile in $global:ScriptFiles) {
                $scriptPath = Join-Path $scriptsPath $scriptFile
                if (Test-Path $scriptPath) {
                    $foundScripts += $scriptFile
                }
            }
            
            if ($foundScripts.Count -gt 0) {
                $app.AvailableScripts += $foundScripts
                Write-Host "  $($app.Name): $($foundScripts -join ', ')" -ForegroundColor Gray
            }
        }
        
        # Set default if no scripts found
        if ($app.AvailableScripts.Count -eq 0) {
            $app.CurrentScript = "None"
        } elseif (-not $app.CurrentScript) {
            $app.CurrentScript = $app.AvailableScripts[0]
            $app.ScriptIndex = 0
        }
    }
}

# Step 6: Load cache and restore app states
function Step6-LoadCache {
    Write-Host "Step 6: Loading cache and restoring states..." -ForegroundColor Cyan
    
    $loaded = Load-Cache
    if ($loaded) {
        Write-Host "  Cache restored: app states and toggle indices" -ForegroundColor Green
    } else {
        Write-Host "  No cache found, using default states" -ForegroundColor Yellow
    }
}

# Step 7: Calculate max app name width
function Step7-CalculateMaxWidth {
    param([array]$AllApps)
    
    Write-Host "Step 7: Calculating max app name width..." -ForegroundColor Cyan
    
    $maxWidth = 0
    foreach ($app in $AllApps) {
        if ($app.Name.Length -gt $maxWidth) {
            $maxWidth = $app.Name.Length
        }
    }
    
    Write-Host "  Max app name width: $maxWidth" -ForegroundColor Green
    
    return $maxWidth
}

# Main scan function
function Scan-Apps {
    Write-Host ""
    Write-Host "=== Starting Application Scan ===" -ForegroundColor Yellow
    Write-Host ""

    # Step 1: Scan ncoreApps
    $ncoreApps = Step1-ScanNcoreApps
    Write-Host ""

    # Step 2: Scan poly_apps
    $polyApps = Step2-ScanPolyApps
    Write-Host ""

    # Step 2.5: Scan pyapps
    $pyApps = Step2_5-ScanPyApps
    Write-Host ""

    # Step 3: Generate native startup for ncoreApps
    Step3-GenerateNativeStartup -AppList $ncoreApps
    Write-Host ""

    # Step 3: Generate native startup for poly_apps
    Step3-GenerateNativeStartup -AppList $polyApps
    Write-Host ""

    # Step 3: Generate native startup for pyapps
    Step3-GenerateNativeStartup -AppList $pyApps
    Write-Host ""

    # Step 4: Integrate data
    $allApps = Step4-IntegrateData -NcoreApps $ncoreApps -PolyApps $polyApps -PyApps $pyApps
    Write-Host ""

    # Step 5: Scan scripts directories
    Step5-ScanScriptsDirectory -AllApps $allApps
    Write-Host ""
    
    # Set global apps
    $global:Apps = $allApps
    
    # Step 6: Load cache (will override if exists)
    Step6-LoadCache
    Write-Host ""
    
    # Step 7: Calculate max width for menu
    $global:MaxAppNameWidth = Step7-CalculateMaxWidth -AllApps $global:Apps
    Write-Host ""
    
    Write-Host "=== Scan Complete ===" -ForegroundColor Green
    Write-Host ""
}


# Save cache - only save app index and toggle index
function Save-Cache {
    $cacheData = @{
        AppStates = $global:Apps | ForEach-Object {
            @{
                Name = $_.Name
                AppType = $_.AppType
                IsSelected = $_.IsSelected
                CurrentScript = $_.CurrentScript
                ScriptIndex = $_.ScriptIndex
            }
        }
        CurrentIndex = $global:CurrentIndex
    }
    
    $cacheData | ConvertTo-Json -Depth 3 | Out-File -FilePath $cacheFile -Encoding UTF8
    Write-Host "Cache saved to: $cacheFile" -ForegroundColor Green
}

# Load cache - only load app index and toggle index, restore states
function Load-Cache {
    if (Test-Path $cacheFile) {
        try {
            $cacheData = Get-Content -Path $cacheFile -Encoding UTF8 | ConvertFrom-Json
            
            if ($cacheData.AppStates) {
                # Restore states for each app based on name and type
                foreach ($appState in $cacheData.AppStates) {
                    $matchingApp = $global:Apps | Where-Object { $_.Name -eq $appState.Name -and $_.AppType -eq $appState.AppType }
                    if ($matchingApp) {
                        $matchingApp.IsSelected = $appState.IsSelected
                        
                        # Restore toggle index if the script exists in available scripts
                        if ($appState.CurrentScript -and $matchingApp.AvailableScripts -contains $appState.CurrentScript) {
                            $matchingApp.CurrentScript = $appState.CurrentScript
                            $matchingApp.ScriptIndex = [array]::IndexOf($matchingApp.AvailableScripts, $appState.CurrentScript)
                        }
                    }
                }
            }
            
            if ($cacheData.CurrentIndex -ne $null) {
                $global:CurrentIndex = $cacheData.CurrentIndex
                # Ensure index is within bounds
                if ($global:CurrentIndex -ge $global:Apps.Count) {
                    $global:CurrentIndex = 0
                }
            }
            
            Write-Host "Cache data loaded from: $cacheFile" -ForegroundColor Green
            return $true
        }
        catch {
            Write-Host "Failed to load cache: $($_.Exception.Message)" -ForegroundColor Yellow
            return $false
        }
    }
    return $false
}

# Show menu
function Show-Menu {
    Clear-Host
    Write-Host "=== Core Node Unified Manager ===" -ForegroundColor Cyan
    Write-Host "Current directory: $rootDir" -ForegroundColor Gray
    Write-Host ""
    
    if ($global:Apps.Count -eq 0) {
        Write-Host "No applications found" -ForegroundColor Red
        return
    }
    
    # Calculate column widths
    $nameWidth = if ($global:MaxAppNameWidth -gt 8) { $global:MaxAppNameWidth } else { 8 }
    $typeWidth = 9
    $scriptWidth = 14
    
    Write-Host "Application List:" -ForegroundColor Yellow
    
    # Header
    $header = "No. | {0} | Type      | Current Script | Sel" -f "App Name".PadRight($nameWidth)
    Write-Host $header -ForegroundColor White
    
    # Separator
    $separator = "----|{0}|-----------|----------------|----" -f ("-" * ($nameWidth + 2))
    Write-Host $separator -ForegroundColor Gray
    # App list
    for ($i = 0; $i -lt $global:Apps.Count; $i++) {
        $app = $global:Apps[$i]
        $currentScript = if ($app.CurrentScript) { $app.CurrentScript } else { "None" }
        $selectedStatus = if ($app.IsSelected) { "Y" } else { "N" }
        $appType = if ($app.AppType) { $app.AppType } else { "unknown" }
        
        # Highlight current selection
        $color = if ($i -eq $global:CurrentIndex) { "Yellow" } else { "White" }
        $indicator = if ($i -eq $global:CurrentIndex) { ">" } else { " " }
        
        # Format line with proper alignment
        $appNamePadded = $app.Name.PadRight($nameWidth)
        $typePadded = $appType.PadRight($typeWidth)
        $scriptPadded = $currentScript.PadRight($scriptWidth)
        
        $line = "{0}{1,2} | {2} | {3} | {4} | {5}" -f $indicator, ($i + 1), $appNamePadded, $typePadded, $scriptPadded, $selectedStatus
        Write-Host $line -ForegroundColor $color
    }
    
    Write-Host ""
    Write-Host "Controls:" -ForegroundColor Yellow
    Write-Host "Up/Down: Navigate | Left/Right: Toggle script | Enter: Launch | Space: Select | E: Execute | S: Save | Q: Quit" -ForegroundColor White
    Write-Host ""
}

# Navigate up
function Navigate-Up {
    if ($global:CurrentIndex -gt 0) {
        $global:CurrentIndex--
    }
}

# Navigate down
function Navigate-Down {
    if ($global:CurrentIndex -lt ($global:Apps.Count - 1)) {
        $global:CurrentIndex++
    }
}

# Toggle script for current app
function Toggle-Script {
    $app = $global:Apps[$global:CurrentIndex]
    if ($app.AvailableScripts.Count -gt 1) {
        $app.ScriptIndex = ($app.ScriptIndex + 1) % $app.AvailableScripts.Count
        $app.CurrentScript = $app.AvailableScripts[$app.ScriptIndex]
        Write-Host "Switched to $($app.CurrentScript) for $($app.Name)" -ForegroundColor Green
        Save-Cache
    } else {
        Write-Host "No alternative scripts available for $($app.Name)" -ForegroundColor Yellow
    }
}

# Toggle app selection
function Toggle-AppSelection {
    $app = $global:Apps[$global:CurrentIndex]
    $app.IsSelected = -not $app.IsSelected
    $status = if ($app.IsSelected) { "selected" } else { "deselected" }
    Write-Host "$($app.Name) $status" -ForegroundColor Green
    Save-Cache
}

# Launch current app
function Launch-CurrentApp {
    $app = $global:Apps[$global:CurrentIndex]
    
    if (-not $app.CurrentScript -or $app.CurrentScript -eq "None") {
        Write-Host "No startup script configured for $($app.Name)" -ForegroundColor Red
        Read-Host "Press any key to continue"
        return
    }
    
    # Show launch details
    Write-Host ""
    Write-Host "=== Launch Details ===" -ForegroundColor Yellow
    Write-Host "App Name: $($app.Name)" -ForegroundColor White
    Write-Host "App Type: $($app.AppType)" -ForegroundColor White
    Write-Host "Startup Mode: $($app.CurrentScript)" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if it's a native startup
    $nativeStartups = @("ncoreStart", "ncoreStart&Installer", "pycoreStart", "pycoreStart&Installer", "Ncore/Pycore/Installer", "pyStart", "flutterStart", "laravelStart", "nuxtStart", "phpStart")
    $isNativeStartup = $nativeStartups -contains $app.CurrentScript

    if ($isNativeStartup) {
        # Generate command based on startup type
        $command = $null
        $workingDir = $null
        $needsInstall = $false

        # Check if this is an &Installer variant
        if ($app.CurrentScript -like "*&Installer") {
            $needsInstall = $true
        }

        switch -Wildcard ($app.CurrentScript) {
            "Ncore/Pycore/Installer" {
                $command = Get-TInstallerCommand -AppPath $app.Path -AppType $app.AppType
                $workingDir = $rootDir
                $needsInstall = $true
            }
            "ncoreStart*" {
                $command = Get-NcoreStartCommand -AppPath $app.Path
                $workingDir = $rootDir
            }
            "pycoreStart*" {
                $command = Get-PycoreStartCommand -AppPath $app.Path
                $workingDir = $rootDir
            }
            "pyStart" {
                $command = Get-PyStartCommand -AppPath $app.Path
                $workingDir = $app.Path
            }
            "flutterStart" {
                $command = Get-FlutterStartCommand -AppPath $app.Path
                $workingDir = $app.Path
            }
            "laravelStart" {
                $command = Get-LaravelStartCommand -AppPath $app.Path
                $workingDir = $app.Path
            }
            "nuxtStart" {
                $command = Get-NuxtStartCommand -AppPath $app.Path
                $workingDir = $app.Path
            }
            "phpStart" {
                $command = Get-PhpStartCommand -AppPath $app.Path
                $workingDir = $app.Path
            }
        }
        
        if ($command) {
            Write-Host "Working Directory: $workingDir" -ForegroundColor Gray
            Write-Host "Command: $command" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Press any key to continue, or 'n' to cancel..." -ForegroundColor Yellow
            
            $response = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            if ($response.Character -eq 'n' -or $response.Character -eq 'N') {
                Write-Host "Launch cancelled" -ForegroundColor Yellow
                Start-Sleep -Seconds 1
                return
            }
            
            # Create temporary batch file
            $tempBatFile = Join-Path $tempScriptDir "$($app.Name)_$($app.CurrentScript).bat"

            # Generate batch file content
            if ($needsInstall) {
                # Check if this is Ncore/Pycore/Installer for enhanced installation
                $isFullInstaller = ($app.CurrentScript -eq "Ncore/Pycore/Installer")

                if ($isFullInstaller) {
                    # Ncore/Pycore/Installer: Call the standalone installer script
                    $installerScript = Join-Path $scriptPath "ncore_pycore_installer.ps1"
                    $batContent = @"
@echo off
echo Launching unified installer...
powershell -ExecutionPolicy Bypass -File "$installerScript" -AppName "$($app.Name)" -AppType "$($app.AppType)" -StartCommand "$command" -WorkingDir "$workingDir" -RootDir "$rootDir"
pause
"@
                } else {
                    # Standard &Installer: Basic pnpm install only
                    $batContent = @"
@echo off
echo ========================================
echo Installing dependencies...
echo ========================================
cd /d "$rootDir"
echo Running: pnpm install
pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Installation failed! Check the error messages above.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Dependencies installed successfully
echo ========================================
echo.

echo ========================================
echo Starting $($app.Name) with $($app.CurrentScript)...
echo ========================================
cd /d "$workingDir"
echo Working Directory: %CD%
echo.
$command
pause
"@
                }
            } else {
                # No installation needed
                $batContent = @"
@echo off
cd /d "$workingDir"
echo Starting $($app.Name) with $($app.CurrentScript)...
echo Working Directory: %CD%
echo.
$command
pause
"@
            }

            # Write batch file
            $batContent | Out-File -FilePath $tempBatFile -Encoding ASCII -Force
            
            Write-Host "Launching $($app.Name)..." -ForegroundColor Green
            
            # Launch using explorer (only accepts one parameter)
            Start-Process "explorer.exe" -ArgumentList $tempBatFile
            
            Start-Sleep -Seconds 1
        } else {
            Write-Host "Failed to generate startup command" -ForegroundColor Red
            Read-Host "Press any key to continue"
        }
    } else {
        # Script-based startup
        $scriptPath = Join-Path (Join-Path $app.Path "scripts") $app.CurrentScript
        
        if (Test-Path $scriptPath) {
            Write-Host "Script Path: $scriptPath" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Press any key to continue, or 'n' to cancel..." -ForegroundColor Yellow
            
            $response = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            if ($response.Character -eq 'n' -or $response.Character -eq 'N') {
                Write-Host "Launch cancelled" -ForegroundColor Yellow
                Start-Sleep -Seconds 1
                return
            }
            
            Write-Host "Launching $($app.Name) with $($app.CurrentScript)..." -ForegroundColor Green
            
            # Launch script directly using explorer
            Start-Process "explorer.exe" -ArgumentList $scriptPath
            
            Start-Sleep -Seconds 1
        } else {
            Write-Host "Script not found: $scriptPath" -ForegroundColor Red
            Read-Host "Press any key to continue"
        }
    }
}

# Execute selected app scripts
function Execute-SelectedApps {
    $selectedApps = $global:Apps | Where-Object { $_.IsSelected }
    
    if ($selectedApps.Count -eq 0) {
        Write-Host "No applications selected" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Executing selected applications with their current scripts:" -ForegroundColor Yellow
    foreach ($app in $selectedApps) {
        if ($app.CurrentScript) {
            Write-Host "Executing $($app.CurrentScript) for $($app.Name)..." -ForegroundColor White
            Execute-Scripts -ScriptType $app.CurrentScript -Apps @($app)
        } else {
            Write-Host "No script selected for $($app.Name)" -ForegroundColor Red
        }
    }
}

# Execute scripts
function Execute-Scripts {
    param(
        [string]$ScriptType,
        [array]$Apps
    )
    
    $hasScript = $false
    foreach ($app in $Apps) {
        $scriptPath = $null
        $command = $null
        
        # Determine script path and command based on script type
        switch ($ScriptType) {
            "pyStart" {
                $scriptPath = Join-Path $app.Path "main.py"
                $command = Get-PyStartCommand -AppPath $app.Path
            }
            "ncoreStart" {
                $scriptPath = Join-Path $app.Path "main.js"
                $command = Get-NcoreStartCommand -AppPath $app.Path
            }
            "flutterStart" {
                $scriptPath = Join-Path $app.Path "pubspec.yaml"
                $command = Get-FlutterStartCommand -AppPath $app.Path
            }
            "laravelStart" {
                $scriptPath = Join-Path $app.Path "composer.json"
                $command = Get-LaravelStartCommand -AppPath $app.Path
            }
            "nuxtStart" {
                $scriptPath = Join-Path $app.Path "nuxt.config.ts"
                $command = Get-NuxtStartCommand -AppPath $app.Path
            }
            "phpStart" {
                $scriptPath = Join-Path $app.Path "index.php"
                $command = Get-PhpStartCommand -AppPath $app.Path
            }
            default {
                $scriptPath = Join-Path (Join-Path $app.Path "scripts") $ScriptType
            }
        }
        
        if (Test-Path $scriptPath) {
            $hasScript = $true
            Write-Host "Executing $ScriptType for $($app.Name)..." -ForegroundColor Yellow
            
            try {
                if ($command) {
                    # Native startup commands
                    Invoke-Expression $command
                } elseif ($ScriptType -eq "start.bat" -or $ScriptType -eq "deploy.bat") {
                    # Batch files
                    & $scriptPath
                } else {
                    # PowerShell scripts: start.ps1, install.ps1, deploy.ps1
                    & powershell -ExecutionPolicy Bypass -File $scriptPath
                }
                Write-Host "$ScriptType for $($app.Name) completed" -ForegroundColor Green
            }
            catch {
                Write-Host "$ScriptType for $($app.Name) failed: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    if (-not $hasScript) {
        Write-Host "No applications contain $ScriptType script" -ForegroundColor Yellow
    }
}

# Main loop
function Main {
    # Always scan apps first
    Scan-Apps
    
    do {
        Show-Menu
        
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        
        switch ($key.VirtualKeyCode) {
            38 { # Up arrow
                Navigate-Up
                Save-Cache
            }
            40 { # Down arrow
                Navigate-Down
                Save-Cache
            }
            37 { # Left arrow
                Toggle-Script
            }
            39 { # Right arrow
                Toggle-Script
            }
            13 { # Enter
                Launch-CurrentApp
            }
            32 { # Space key - Toggle selection
                Toggle-AppSelection
            }
            81 { # Q key
                Write-Host "Exiting program" -ForegroundColor Yellow
                Save-Cache
                break
            }
            82 { # R key
                Scan-Apps
                Write-Host "Application list updated" -ForegroundColor Green
                Start-Sleep -Seconds 1
            }
            83 { # S key
                Save-Cache
                Write-Host "State saved" -ForegroundColor Green
                Start-Sleep -Seconds 1
            }
            69 { # E key
                Execute-SelectedApps
                Read-Host "Press any key to continue"
            }
            68 { # D key
                Show-Cache-Debug
                Read-Host "Press any key to continue"
            }
            default {
                # Ignore other keys
            }
        }
    } while ($key.VirtualKeyCode -ne 81)
}

# Debug function to show cache content
function Show-Cache-Debug {
    if (Test-Path $cacheFile) {
        Write-Host "Cache file content:" -ForegroundColor Cyan
        $cacheContent = Get-Content -Path $cacheFile -Encoding UTF8
        Write-Host $cacheContent -ForegroundColor White
    } else {
        Write-Host "No cache file found" -ForegroundColor Yellow
    }
}

# Start program
Main
