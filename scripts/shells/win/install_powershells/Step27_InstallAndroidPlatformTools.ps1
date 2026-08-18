# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"

# Get WindowsPathFunction.ps1 path
$windowsPathFunctionPath = Join-Path (Split-Path $PSScriptRoot -Parent) "win_common\WindowsPathFunction.ps1"
. "$PSScriptRoot\..\win_common\WindowsPathFunction.ps1"

$STEP_NUMBER = 27

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
        Write-ColorMessage -Message "[Step $script:STEP_NUMBER] Scanning for Android platform-tools..." -Type "Info"
        
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
                        Write-ColorMessage -Message "[Step $script:STEP_NUMBER] Found platform-tools: $($path.FullName)" -Type "Success"
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
        Write-ColorMessage -Message "[Step $script:STEP_NUMBER] Starting Android platform-tools scan on drive $($this.DriveLetter):\" -Type "Info"
        Write-ColorMessage -Message "[Step $script:STEP_NUMBER] Admin privileges: $($this.IsAdmin())" -Type "Info"
        
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        try {
            $this.ScanPlatformTools()
        } catch {
            Write-ColorMessage -Message "[Step $script:STEP_NUMBER] Error during scan: $_" -Type "Error"
        }
        
        $stopwatch.Stop()
        Write-ColorMessage -Message "[Step $script:STEP_NUMBER] Scan completed in $($stopwatch.Elapsed.TotalSeconds.ToString('F2')) seconds" -Type "Info"
        
        return $this.Results
    }
    
    [void] GenerateReport() {
        $this.ScanAll()
        
        Write-ColorMessage -Message "[Step $script:STEP_NUMBER] Android Platform Tools Scan Report" -Type "Info"
        
        # Platform Tools Report
        Write-ColorMessage -Message "[Step $script:STEP_NUMBER] Android Platform Tools ($($this.Results['platform_tools'].Count) found)" -Type "Info"
        
        if ($this.Results['platform_tools'].Count -gt 0) {
            for ($i = 0; $i -lt $this.Results['platform_tools'].Count; $i++) {
                $tool = $this.Results['platform_tools'][$i]
                Write-ColorMessage -Message "[Step $script:STEP_NUMBER] $($i + 1). $($tool.path)" -Type "Success"
                Write-ColorMessage -Message "[Step $script:STEP_NUMBER]    ADB Version: $($tool.adb_version)" -Type "Info"
                Write-ColorMessage -Message "[Step $script:STEP_NUMBER]    ADB Size: $([math]::Round($tool.adb_size / 1MB, 2)) MB" -Type "Info"
                Write-ColorMessage -Message "[Step $script:STEP_NUMBER]    Fastboot Size: $([math]::Round($tool.fastboot_size / 1MB, 2)) MB" -Type "Info"
            }
        } else {
            Write-ColorMessage -Message "[Step $script:STEP_NUMBER] No Android platform-tools found" -Type "Warning"
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
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Invalid platform-tools path: $PlatformToolsPath" -Type "Error"
        return $false
    }
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Adding Android platform-tools to system PATH..." -Type "Info"
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Path: $PlatformToolsPath" -Type "Info"
    
    # Check if Add-Path function is available
    if (Get-Command "Add-Path" -ErrorAction SilentlyContinue) {
        try {
            Add-Path -newPath $PlatformToolsPath
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully added platform-tools to PATH using Add-Path function" -Type "Success"
            return $true
        } catch {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to add path using Add-Path function: $_" -Type "Error"
        }
    }
    
    # Fallback to WindowsPathFunction
    try {
        & $windowsPathFunctionPath "add" $PlatformToolsPath
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Successfully added platform-tools to PATH using WindowsPathFunction" -Type "Success"
        return $true
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to add path using WindowsPathFunction: $_" -Type "Error"
        return $false
    }
}

function Test-AdbInstallation {
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Testing ADB installation..." -Type "Info"
    
    try {
        $adbVersion = & adb version 2>$null
        if ($adbVersion) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] ADB is working correctly" -Type "Success"
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Version: $($adbVersion[0])" -Type "Info"
            return $true
        }
    } catch {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] ADB is not accessible from command line" -Type "Warning"
        return $false
    }
    
    return $false
}

function Step27_InstallAndroidPlatformTools {
    param(
        [string]$DriveLetter = "C"
    )
    
    Write-ColorMessage -Message "[Step $STEP_NUMBER] Installing Android Platform Tools..." -Type "Info"
    
    # Create scanner instance
    $scanner = [AndroidPlatformToolsScanner]::new($DriveLetter)
    
    # Quick scan - stop at first valid platform-tools
    $results = $scanner.ScanAll()
    
    if ($results['platform_tools'].Count -gt 0) {
        $bestPath = $results['platform_tools'][0].path
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Found platform-tools: $bestPath" -Type "Success"
        
        # Add to PATH
        $success = Install-AndroidPlatformToolsToPath -PlatformToolsPath $bestPath
        
        if ($success) {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Platform-tools installation completed successfully!" -Type "Success"

            # Test installation
            Test-AdbInstallation

            # Add emulator directory to PATH
            $sdkRoot = Split-Path $bestPath -Parent
            $emulatorPath = Join-Path $sdkRoot "emulator"
            if (Test-Path $emulatorPath) {
                try {
                    & $windowsPathFunctionPath "add" $emulatorPath
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Added emulator to PATH: $emulatorPath" -Type "Success"
                } catch {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to add emulator path: $_" -Type "Error"
                }
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] emulator directory not found in: $sdkRoot" -Type "Warning"
            }

            # Add cmdline-tools directory to PATH
            $cmdlineToolsLatestBinPath = Join-Path $sdkRoot "cmdline-tools\latest\bin"
            $cmdlineToolsBinPath = Join-Path $sdkRoot "cmdline-tools\bin"
            if (Test-Path $cmdlineToolsLatestBinPath) {
                try {
                    & $windowsPathFunctionPath "add" $cmdlineToolsLatestBinPath
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Added cmdline-tools to PATH: $cmdlineToolsLatestBinPath" -Type "Success"
                } catch {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to add cmdline-tools path: $_" -Type "Error"
                }
            } elseif (Test-Path $cmdlineToolsBinPath) {
                try {
                    & $windowsPathFunctionPath "add" $cmdlineToolsBinPath
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Added cmdline-tools to PATH: $cmdlineToolsBinPath" -Type "Success"
                } catch {
                    Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to add cmdline-tools path: $_" -Type "Error"
                }
            } else {
                Write-ColorMessage -Message "[Step $STEP_NUMBER] cmdline-tools directory not found in: $sdkRoot" -Type "Warning"
            }
        } else {
            Write-ColorMessage -Message "[Step $STEP_NUMBER] Failed to install platform-tools to PATH" -Type "Error"
            return $false
        }
    } else {
        Write-ColorMessage -Message "[Step $STEP_NUMBER] No Android platform-tools found on the system" -Type "Warning"
        Write-ColorMessage -Message "[Step $STEP_NUMBER] Please install Android platform-tools through Android Studio" -Type "Info"
        return $false
    }
    
    return $true
}

Step27_InstallAndroidPlatformTools
