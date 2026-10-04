. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "GlobalVars.ps1")
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "CommonFunc.ps1")

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"
. (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "win_common") "WindowsPathFunction.ps1")

$COMPONENT_ID = 'Android_PlatformTools'

class AndroidPlatformToolsScanner {
    [string]$DriveLetter
    [hashtable]$Results
    [string[]]$TargetTools
    
    AndroidPlatformToolsScanner([string]$drive = "C") {
        $this.DriveLetter = $drive
        $this.Results = @{
            platform_tools = @()
            adb_locations = @()
            fastboot_locations = @()
        }
        $this.TargetTools = @('adb.exe', 'fastboot.exe')
    }
    
    [bool] IsAdmin() {
        try {
            $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
            $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
            return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        } catch {
            return $false
        }
    }
    
    [System.IO.DirectoryInfo[]] SafeScanDirectory([string]$path) {
        try {
            return Get-ChildItem -Path $path -Directory -ErrorAction SilentlyContinue
        } catch {
            return @()
        }
    }
    
    [System.IO.FileInfo[]] SafeScanFiles([string]$path) {
        try {
            return Get-ChildItem -Path $path -File -ErrorAction SilentlyContinue
        } catch {
            return @()
        }
    }
    
    [void] ScanPlatformTools() {
        Write-ColorMessage -Message "[$script:COMPONENT_ID] Scanning for Android platform-tools..." -Type "Info"
        
        $searchPatterns = @(
            "Program Files\Android\*",
            "Program Files (x86)\Android\*", 
            "Android\*",
            "Users\*\AppData\Local\Android\*",
            "dev\Android\*",
            "tools\Android\*"
        )
        
        foreach ($pattern in $searchPatterns) {
            $fullPattern = Join-Path "$($this.DriveLetter):\" $pattern
            try {
                $paths = Get-ChildItem -Path $fullPattern -Directory -Recurse -Depth 3 -ErrorAction SilentlyContinue | 
                         Where-Object { $_.Name -eq "platform-tools" }
                
                foreach ($path in $paths) {
                    if ($this.IsPlatformToolsDirectory($path.FullName)) {
                        $toolInfo = $this.AnalyzePlatformToolsDirectory($path.FullName)
                        $this.Results['platform_tools'] = $this.Results['platform_tools'] + @($toolInfo)
                        Write-ColorMessage -Message "[$script:COMPONENT_ID] Found platform-tools: $($path.FullName)" -Type "Success"
                        return # Exit immediately after finding first valid platform-tools
                    }
                }
            } catch {
                # Silently continue on access errors
            }
        }
    }
    
    [bool] IsPlatformToolsDirectory([string]$path) {
        $adbPath = Join-Path $path "adb.exe"
        $fastbootPath = Join-Path $path "fastboot.exe"
        return (Test-Path $adbPath) -and (Test-Path $fastbootPath)
    }
    
    [hashtable] AnalyzePlatformToolsDirectory([string]$path) {
        $adbPath = Join-Path $path "adb.exe"
        $fastbootPath = Join-Path $path "fastboot.exe"
        
        $adbVersion = $this.GetAdbVersion($adbPath)
        
        return @{
            path = $path
            adb_path = $adbPath
            fastboot_path = $fastbootPath
            adb_version = $adbVersion
            adb_size = (Get-Item $adbPath -ErrorAction SilentlyContinue).Length
            fastboot_size = (Get-Item $fastbootPath -ErrorAction SilentlyContinue).Length
        }
    }
    
    [string] GetAdbVersion([string]$adbPath) {
        try {
            $result = & $adbPath version 2>$null
            if ($result) {
                return $result[0].Trim()
            }
        } catch {
            # Ignore errors
        }
        return "Unknown"
    }
    
    [hashtable] ScanAll() {
        Write-ColorMessage -Message "[$script:COMPONENT_ID] Starting Android platform-tools scan on drive $($this.DriveLetter):\" -Type "Info"
        Write-ColorMessage -Message "[$script:COMPONENT_ID] Admin privileges: $($this.IsAdmin())" -Type "Info"
        
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        try {
            $this.ScanPlatformTools()
        } catch {
            Write-ColorMessage -Message "[$script:COMPONENT_ID] Error during scan: $_" -Type "Error"
        }
        
        $stopwatch.Stop()
        Write-ColorMessage -Message "[$script:COMPONENT_ID] Scan completed in $($stopwatch.Elapsed.TotalSeconds.ToString('F2')) seconds" -Type "Info"
        
        return $this.Results
    }
    
    [void] GenerateReport() {
        $this.ScanAll()
        
        Write-ColorMessage -Message "[$script:COMPONENT_ID] Android Platform Tools Scan Report" -Type "Info"
        
        # Platform Tools Report
        Write-ColorMessage -Message "[$script:COMPONENT_ID] Android Platform Tools ($($this.Results['platform_tools'].Count) found)" -Type "Info"
        
        if ($this.Results['platform_tools'].Count -gt 0) {
            for ($i = 0; $i -lt $this.Results['platform_tools'].Count; $i++) {
                $tool = $this.Results['platform_tools'][$i]
                Write-ColorMessage -Message "[$script:COMPONENT_ID] $($i + 1). $($tool.path)" -Type "Success"
                Write-ColorMessage -Message "[$script:COMPONENT_ID]    ADB Version: $($tool.adb_version)" -Type "Info"
                Write-ColorMessage -Message "[$script:COMPONENT_ID]    ADB Size: $([math]::Round($tool.adb_size / 1MB, 2)) MB" -Type "Info"
                Write-ColorMessage -Message "[$script:COMPONENT_ID]    Fastboot Size: $([math]::Round($tool.fastboot_size / 1MB, 2)) MB" -Type "Info"
            }
        } else {
            Write-ColorMessage -Message "[$script:COMPONENT_ID] No Android platform-tools found" -Type "Warning"
        }
    }
    
    [string] GetBestPlatformToolsPath() {
        if ($this.Results['platform_tools'].Count -eq 0) {
            return $null
        }
        
        # Return the first (most likely best) platform-tools path
        return $this.Results['platform_tools'][0].path
    }
}

function Install-AndroidPlatformToolsToPath {
    param(
        [string]$PlatformToolsPath
    )
    
    if (-not $PlatformToolsPath -or -not (Test-Path $PlatformToolsPath)) {
        Write-ColorMessage -Message "[$COMPONENT_ID] Invalid platform-tools path: $PlatformToolsPath" -Type "Error"
        return $false
    }
    
    Write-ColorMessage -Message "[$COMPONENT_ID] Adding Android platform-tools to system PATH..." -Type "Info"
    Write-ColorMessage -Message "[$COMPONENT_ID] Path: $PlatformToolsPath" -Type "Info"
    
    # Check if Add-Path function is available
    if (Get-Command "Add-Path" -ErrorAction SilentlyContinue) {
        try {
            Add-Path -newPath $PlatformToolsPath
            Write-ColorMessage -Message "[$COMPONENT_ID] Successfully added platform-tools to PATH using Add-Path function" -Type "Success"
            return $true
        } catch {
            Write-ColorMessage -Message "[$COMPONENT_ID] Failed to add path using Add-Path function: $_" -Type "Error"
        }
    }
    
    # Fallback to WindowsPathFunction
    try {
        & $windowsPathFunctionPath "add" $PlatformToolsPath
        Write-ColorMessage -Message "[$COMPONENT_ID] Successfully added platform-tools to PATH using WindowsPathFunction" -Type "Success"
        return $true
    } catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] Failed to add path using WindowsPathFunction: $_" -Type "Error"
        return $false
    }
}

function Test-AdbInstallation {
    Write-ColorMessage -Message "[$COMPONENT_ID] Testing ADB installation..." -Type "Info"
    
    try {
        $adbVersion = & adb version 2>$null
        if ($adbVersion) {
            Write-ColorMessage -Message "[$COMPONENT_ID] ADB is working correctly" -Type "Success"
            Write-ColorMessage -Message "[$COMPONENT_ID] Version: $($adbVersion[0])" -Type "Info"
            return $true
        }
    } catch {
        Write-ColorMessage -Message "[$COMPONENT_ID] ADB is not accessible from command line" -Type "Warning"
        return $false
    }
    
    return $false
}

function Android_PlatformTools {
    param(
        [string]$DriveLetter = "C"
    )
    
    Write-ColorMessage -Message "[$COMPONENT_ID] Installing Android Platform Tools..." -Type "Info"
    
    # Create scanner instance
    $scanner = [AndroidPlatformToolsScanner]::new($DriveLetter)
    
    # Quick scan - stop at first valid platform-tools
    $results = $scanner.ScanAll()
    
    if ($results['platform_tools'].Count -gt 0) {
        $bestPath = $results['platform_tools'][0].path
        Write-ColorMessage -Message "[$COMPONENT_ID] Found platform-tools: $bestPath" -Type "Success"
        
        # Add to PATH
        $success = Install-AndroidPlatformToolsToPath -PlatformToolsPath $bestPath
        
        if ($success) {
            Write-ColorMessage -Message "[$COMPONENT_ID] Platform-tools installation completed successfully!" -Type "Success"

            # Test installation
            Test-AdbInstallation

            # Add emulator directory to PATH
            $sdkRoot = Split-Path $bestPath -Parent
            $emulatorPath = Join-Path $sdkRoot "emulator"
            if (Test-Path $emulatorPath) {
                try {
                    & $windowsPathFunctionPath "add" $emulatorPath
                    Write-ColorMessage -Message "[$COMPONENT_ID] Added emulator to PATH: $emulatorPath" -Type "Success"
                } catch {
                    Write-ColorMessage -Message "[$COMPONENT_ID] Failed to add emulator path: $_" -Type "Error"
                }
            } else {
                Write-ColorMessage -Message "[$COMPONENT_ID] emulator directory not found in: $sdkRoot" -Type "Warning"
            }

            # Add cmdline-tools directory to PATH
            $cmdlineToolsLatestBinPath = Join-Path $sdkRoot "cmdline-tools\latest\bin"
            $cmdlineToolsBinPath = Join-Path $sdkRoot "cmdline-tools\bin"
            if (Test-Path $cmdlineToolsLatestBinPath) {
                try {
                    & $windowsPathFunctionPath "add" $cmdlineToolsLatestBinPath
                    Write-ColorMessage -Message "[$COMPONENT_ID] Added cmdline-tools to PATH: $cmdlineToolsLatestBinPath" -Type "Success"
                } catch {
                    Write-ColorMessage -Message "[$COMPONENT_ID] Failed to add cmdline-tools path: $_" -Type "Error"
                }
            } elseif (Test-Path $cmdlineToolsBinPath) {
                try {
                    & $windowsPathFunctionPath "add" $cmdlineToolsBinPath
                    Write-ColorMessage -Message "[$COMPONENT_ID] Added cmdline-tools to PATH: $cmdlineToolsBinPath" -Type "Success"
                } catch {
                    Write-ColorMessage -Message "[$COMPONENT_ID] Failed to add cmdline-tools path: $_" -Type "Error"
                }
            } else {
                Write-ColorMessage -Message "[$COMPONENT_ID] cmdline-tools directory not found in: $sdkRoot" -Type "Warning"
            }
        } else {
            Write-ColorMessage -Message "[$COMPONENT_ID] Failed to install platform-tools to PATH" -Type "Error"
            return $false
        }
    } else {
        Write-ColorMessage -Message "[$COMPONENT_ID] No Android platform-tools found on the system" -Type "Warning"
        Write-ColorMessage -Message "[$COMPONENT_ID] Please install Android platform-tools through Android Studio" -Type "Info"
        return $false
    }
    
    return $true
}

Android_PlatformTools
