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

# Set UTF-8 encoding for proper Chinese character handling
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$globalVarsPath = Join-Path $PSScriptRoot 'GlobalVars.ps1'
$globalVarsLoaded = Get-Variable -Name 'PycoreGlobalVarsLoaded' -Scope Script -ErrorAction SilentlyContinue

# Import variable management functions and global variables
if ($null -eq $globalVarsLoaded -or -not [bool]$globalVarsLoaded.Value) {
    . $globalVarsPath
    Set-Variable -Name 'PycoreGlobalVarsLoaded' -Scope Script -Value $true
}

# Define WindowsPathFunction.ps1 path for centralized management
$script:WindowsPathFunctionPath = Join-Path $PSScriptRoot "WindowsPathFunction.ps1"

# Add color constants
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"

# Desktop icon processing debug control
$script:DEBUG_DESKTOP_ICONS = $false

# Winget log file paths
$script:WINGET_OUTPUT_LOG = "winget_install_output.log"
$script:WINGET_ERROR_LOG = "winget_install_error.log"
$script:WINGET_OUTPUT_LOG_TEMP = Join-Path $Global:TEMP_DIR "winget_install_output.log"
$script:WINGET_ERROR_LOG_TEMP = Join-Path $Global:TEMP_DIR "winget_install_error.log"

# Unified Debug Print Function
# AI_DEBUG_FUNCTION: Use this function for all debug output in PowerShell scripts
function Write-DebugLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [Parameter(Mandatory = $false)]
        [string]$Category = "GENERAL",
        [Parameter(Mandatory = $false)]
        [string]$Color = "Magenta",
        [Parameter(Mandatory = $false)]
        [bool]$Force = $false,
        [Parameter(Mandatory = $false)]
        $LocalDebug = $true
    )
    
    # Check if debug mode is enabled (global, local, or forced)
    $shouldDebug = $Force
    
    # Convert LocalDebug to boolean and use it (defaults to true when not explicitly set)
    if ($LocalDebug -is [string]) {
        $localDebugBool = $LocalDebug -eq "true" -or $LocalDebug -eq "1" -or $LocalDebug -eq "True"
    }
    else {
        $localDebugBool = [bool]$LocalDebug
    }
    
    $shouldDebug = $shouldDebug -or $localDebugBool
    
    if (-not $shouldDebug) {
        return
    }
    
    $timestamp = Get-Date -Format "HH:mm:ss.fff"
    $debugMessage = "$($Global:DEBUG_PREFIX) [$Category] $Message"
    Write-Host $debugMessage -ForegroundColor $Color
}

# Helper function to find uninstall processes
function Get-UninstallProcesses {
    try {
        $processes = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { 
                $_.ProcessName -like "*uninstall*" -or 
                $_.MainWindowTitle -like "*uninstall*" -or
                $_.ProcessName -like "*uninst*"
            })
        return $processes
    }
    catch {
        # If Get-Process fails, return empty array
        return @()
    }
}

# Helper function for consistent logging with category prefix
function Write-CategoryLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [Parameter(Mandatory = $true)]
        [string]$Category,
        [Parameter(Mandatory = $false)]
        [string]$Color = "White"
    )
    Write-Host "       [$Category] $Message" -ForegroundColor $Color
}

# Helper function for path validation
function Test-PathExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $false)]
        [string]$PathType = "Any"
    )
    return Test-Path -Path $Path -PathType $PathType
}

# Helper function for safe directory creation
function New-DirectoryIfNotExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $false)]
        [string]$Category = "GENERAL"
    )
    if (-not (Test-PathExists -Path $Path -PathType "Container")) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-CategoryLog -Message "Created directory: $Path" -Category $Category -Color "Green"
        return $true
    }
    return $false
}

# Function to wait for uninstall processes to complete
function Wait-ForUninstallProcesses {
    param(
        [int]$MaxWaitSeconds = 30
    )
    
    Write-CategoryLog -Message "Checking for hanging uninstall processes..." -Category "UNINSTALL_WAIT" -Color "Yellow"
    
    # Find all processes with "uninstall" in their name (force array for single-object return)
    $uninstallProcesses = @(Get-UninstallProcesses)
    
    # Ensure we have an array and safe count access
    if (-not $uninstallProcesses -or $uninstallProcesses.Count -eq 0) {
        Write-CategoryLog -Message "No uninstall processes found, proceeding..." -Category "UNINSTALL_WAIT" -Color "Green"
        return
    }
    
    Write-CategoryLog -Message "Found $($uninstallProcesses.Count) uninstall processes, waiting up to $MaxWaitSeconds seconds..." -Category "UNINSTALL_WAIT" -Color "Yellow"
    foreach ($proc in $uninstallProcesses) {
        Write-CategoryLog -Message "Process: $($proc.ProcessName) (PID: $($proc.Id))" -Category "UNINSTALL_WAIT" -Color "Gray"
    }
    
    $initialCount = $uninstallProcesses.Count
    $waitTime = 0
    $checkInterval = 2
    
    while ($waitTime -lt $MaxWaitSeconds) {
        Start-Sleep -Seconds $checkInterval
        $waitTime += $checkInterval
        
        # Check current uninstall processes (force array for single-object return)
        $currentProcesses = @(Get-UninstallProcesses)
        
        # Safe count access
        $currentCount = if ($currentProcesses) { $currentProcesses.Count } else { 0 }
        
        if ($currentCount -lt $initialCount) {
            Write-CategoryLog -Message "Process count reduced from $initialCount to $currentCount, UI may have closed, proceeding..." -Category "UNINSTALL_WAIT" -Color "Green"
            return
        }
        
        Write-CategoryLog -Message "Still waiting... ($waitTime/$MaxWaitSeconds seconds) - $currentCount processes remaining" -Category "UNINSTALL_WAIT" -Color "Yellow"
    }
    
    # If we reach here, processes are still hanging
    Write-CategoryLog -Message "Timeout reached, attempting to kill hanging uninstall processes..." -Category "UNINSTALL_WAIT" -Color "Red"
    
    $remainingProcesses = @(Get-UninstallProcesses)
    
    foreach ($proc in $remainingProcesses) {
        try {
            Write-CategoryLog -Message "Killing process: $($proc.ProcessName) (PID: $($proc.Id))" -Category "UNINSTALL_WAIT" -Color "Red"
            $proc.Kill()
            $proc.WaitForExit(5000) # Wait up to 5 seconds for graceful termination
        }
        catch {
            Write-CategoryLog -Message "Failed to kill process $($proc.ProcessName): $($_.Exception.Message)" -Category "UNINSTALL_WAIT" -Color "Yellow"
        }
    }
    
    Write-CategoryLog -Message "Uninstall process handling completed, proceeding with installation..." -Category "UNINSTALL_WAIT" -Color "Green"
}

# Function to handle Chinese character encoding issues
function Convert-ToUTF8 {
    param(
        [string]$InputString
    )
    
    if ([string]::IsNullOrEmpty($InputString)) {
        return $InputString
    }
    
    try {
        # Try multiple encoding conversion methods
        $encodings = @(
            [System.Text.Encoding]::UTF8,
            [System.Text.Encoding]::Default,
            [System.Text.Encoding]::Unicode,
            [System.Text.Encoding]::GetEncoding("GB2312"),
            [System.Text.Encoding]::GetEncoding("GBK"),
            [System.Text.Encoding]::GetEncoding("GB18030")
        )
        
        foreach ($encoding in $encodings) {
            try {
                # Convert using current encoding
                $bytes = $encoding.GetBytes($InputString)
                $utf8String = [System.Text.Encoding]::UTF8.GetString($bytes)
                
                # Check if the result looks reasonable (not all question marks or boxes)
                if ($utf8String -notmatch '^[?\s]*$' -and $utf8String.Length -gt 0) {
                    return $utf8String
                }
            }
            catch {
                continue
            }
        }
        
        # If all methods fail, try a different approach
        try {
            # Use PowerShell's built-in string handling
            $bytes = [System.Text.Encoding]::Default.GetBytes($InputString)
            $utf8String = [System.Text.Encoding]::UTF8.GetString($bytes)
            return $utf8String
        }
        catch {
            # Last resort: return original string
            return $InputString
        }
    }
    catch {
        # If conversion fails, return original string
        return $InputString
    }
}

function Find-FileWithDepth {
    param (
        [Parameter(Mandatory = $true)]
        [string]$BasePath,

        [Parameter(Mandatory = $true)]
        [string]$FileName,

        [Parameter(Mandatory = $true)]
        [int]$MaxDepth = 3
    )

    if (-not (Test-Path -Path $BasePath -PathType Container)) {
        return $null
    }

    $target = Get-ChildItem -Path $BasePath -Recurse -File -Depth $MaxDepth -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ieq $FileName } |
    Select-Object -First 1

    if ($target) {
        return $target.FullName
    }
    else {
        return $null
    }
}

function Ensure-ExecutableExtension {
    param (
        [Parameter(Mandatory = $true)]
        [string]$FileName
    )
    
    if ($FileName -match '\.exe$') {
        return $FileName
    }
    
    return "$FileName.exe"
}

# Function to properly handle keyword encoding for desktop shortcut scanning
function Convert-KeywordsToUTF8 {
    param(
        [array]$Keywords
    )
    
    Write-Host "       [ENCODING] Convert-KeywordsToUTF8 function called" -ForegroundColor Magenta
    Write-Host "       [ENCODING] Input Keywords count: $($Keywords.Count)" -ForegroundColor Magenta
    
    if (-not $Keywords -or $Keywords.Count -eq 0) {
        Write-Host "       [ENCODING] Keywords array is empty or null, returning empty array" -ForegroundColor Yellow
        return @()
    }
    
    Write-Host "       [ENCODING] Processing $($Keywords.Count) keywords..." -ForegroundColor Cyan
    Write-Host "       [ENCODING] Keywords: $($Keywords -join ', ')" -ForegroundColor Green
    Write-Host "       [ENCODING] Convert-KeywordsToUTF8 function completed" -ForegroundColor Magenta
    
    return $Keywords
}

function Write-ColorMessage {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Message,
        
        [Parameter(Mandatory = $false)]
        [ValidateSet("Success", "Warning", "Error", "Info")]
        [string]$Type = "Info"
    )
    
    # Handle empty or whitespace messages - convert to newline + spaces
    if ([string]::IsNullOrWhiteSpace($Message)) {
        Write-Host "`n    " -NoNewline
        return
    }
    
    $color = switch ($Type) {
        "Success" { $script:COLOR_SUCCESS }
        "Warning" { $script:COLOR_WARNING }
        "Error" { $script:COLOR_ERROR }
        "Info" { $script:COLOR_INFO }
        default { $script:COLOR_INFO }
    }
    
    $prefix = switch ($Type) {
        "Success" { "[OK] " }
        "Warning" { "[!] " }
        "Error" { "[X] " }
        "Info" { "[*] " }
        default { "[*] " }
    }
    
    Write-Host -ForegroundColor $color "$prefix$Message"
}

function Wait-MenuContinue {
    param(
        [Parameter()]
        [string]$Message = "Press Enter to continue"
    )

    Write-Host ""
    Write-Host "$Message..." -ForegroundColor Yellow

    Start-Sleep -Milliseconds 30
    while ([Console]::KeyAvailable) {
        [void][Console]::ReadKey($true)
    }

    do {
        $key = [Console]::ReadKey($true)
    } while ($key.Key -ne 'Enter')
}

# Function to prompt user with timeout
function Invoke-TimeoutPrompt {
    param (
        [string]$Message,
        [string]$DefaultValue = "N",
        [int]$TimeoutSeconds = 20
    )
    
    Write-ColorMessage "$Message (Default: $DefaultValue, Timeout: $TimeoutSeconds seconds)" -Type "Info"
    
    $startTime = Get-Date
    $endTime = $startTime.AddSeconds($TimeoutSeconds)
    $input = $null
    
    while ((Get-Date) -lt $endTime) {
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            $input = $key.KeyChar
            break
        }
        Start-Sleep -Milliseconds 100
    }
    
    if ($input -eq $null) {
        return $DefaultValue
    }
    
    return $input
}

# Function to extract archive and find target directory
function ExtractArchiveWithKeyword {
    param(
        [string]$zipPath,
        [string]$outputDir,
        [string]$keyword
    )
    
    if (Test-Path $SEVENZIP_EXE_PATH) {
        Write-Host "       Using 7z to extract archive..." -ForegroundColor Cyan
        $arguments = "x `"$zipPath`" -o`"$outputDir`" -y"
        Write-Host "       Command: $SEVENZIP_EXE_PATH $arguments" -ForegroundColor Yellow
        $process = Start-Process -FilePath $SEVENZIP_EXE_PATH -ArgumentList $arguments -Wait -NoNewWindow -PassThru
        if ($process.ExitCode -ne 0) {
            Write-Host "       Warning: 7z extraction failed, falling back to Expand-Archive" -ForegroundColor Yellow
            Expand-Archive -Path $zipPath -DestinationPath $outputDir -Force
        }
    }
    else {
        Write-Host "       Using Expand-Archive to extract..." -ForegroundColor Cyan
        Expand-Archive -Path $zipPath -DestinationPath $outputDir -Force
    }
    
    $extractedDir = Get-ChildItem -Path $outputDir -Directory -Filter "$keyword*" | Select-Object -First 1
    if ($extractedDir) {
        Write-Host "       Found directory: $($extractedDir.FullName)" -ForegroundColor Green
        return $extractedDir.FullName
    }
    else {
        Write-Host "       Warning: Could not find directory with keyword '$keyword'" -ForegroundColor Yellow
        return $outputDir
    }
}


function Set-FileExtension {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FileName,
        [Parameter(Mandatory = $true)]
        [string]$Extension,
        [Parameter(Mandatory = $false)]
        [bool]$ForceReplace = $false
    )
    
    # Check if the file already has the exact extension
    if ($FileName.EndsWith($Extension, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $FileName
    }
    
    # Check if the file already has any extension
    $hasExtension = [System.IO.Path]::HasExtension($FileName)
    
    # If file has extension and force replace is not enabled, return original filename
    if ($hasExtension -and -not $ForceReplace) {
        return $FileName
    }
    
    # Remove existing extension if present
    $nameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
    
    # Add the specified extension
    return $nameWithoutExt + $Extension
}

function Remove-DuplicateKeywords {
    param(
        [Parameter(Mandatory = $true)]
        [array]$Keywords,
        [Parameter(Mandatory = $false)]
        [bool]$RemoveExtensionForComparison = $true
    )
    
    if (-not $Keywords -or $Keywords.Count -eq 0) {
        return @()
    }
    
    $uniqueKeywords = @{}
    
    foreach ($keyword in $Keywords) {
        if ([string]::IsNullOrEmpty($keyword)) {
            continue
        }
        
        if ($RemoveExtensionForComparison) {
            # Remove extension for comparison
            $nameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($keyword)
            $comparisonKey = $nameWithoutExt.ToLower()
        }
        else {
            # Use full name for comparison
            $comparisonKey = $keyword.ToLower()
        }
        
        # Check if we already have this keyword
        if ($uniqueKeywords.ContainsKey($comparisonKey)) {
            $existingKeyword = $uniqueKeywords[$comparisonKey]
            
            # Priority: keyword with extension > keyword without extension
            $existingHasExt = [System.IO.Path]::HasExtension($existingKeyword)
            $currentHasExt = [System.IO.Path]::HasExtension($keyword)
            
            if ($currentHasExt -and -not $existingHasExt) {
                # Current keyword has extension, existing doesn't - replace
                $uniqueKeywords[$comparisonKey] = $keyword
                Write-DebugLog -Message "Replaced '$existingKeyword' with '$keyword' (has extension)" -Category "KEYWORD" -Color "Yellow"
            }
            elseif ($currentHasExt -and $existingHasExt) {
                # Both have extensions - keep the one with more specific extension (longer)
                $existingExt = [System.IO.Path]::GetExtension($existingKeyword)
                $currentExt = [System.IO.Path]::GetExtension($keyword)
                
                if ($currentExt.Length -gt $existingExt.Length) {
                    $uniqueKeywords[$comparisonKey] = $keyword
                    Write-DebugLog -Message "Replaced '$existingKeyword' with '$keyword' (more specific extension)" -Category "KEYWORD" -Color "Yellow"
                }
            }
            # If existing has extension and current doesn't, keep existing
        }
        else {
            # New keyword, add it
            $uniqueKeywords[$comparisonKey] = $keyword
            Write-DebugLog -Message "Added keyword: '$keyword'" -Category "KEYWORD" -Color "Green"
        }
    }
    
    $result = $uniqueKeywords.Values
    Write-DebugLog -Message "Deduplicated keywords: $($result -join ', ')" -Category "KEYWORD" -Color "Cyan"
    
    return $result
}

function Find-ExecutableByKeyword {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Keywords,
        [array]$AdditionalScanPaths = @(),
        [array]$AdditionalInstallDirName = @(),
        [array]$AdditionalScanDevDirName = @(),
        [bool]$Recursive = $true,
        [array]$AdditionalKeywords = @(),
        [bool]$IncludeSystemPaths = $true,
        [array]$ExecutableExtensions = @(".exe"),
        [array]$OnlyScanDirs = @()
    )
    
    # Ensure Keywords is always an array for compatibility
    if ($Keywords -is [string]) {
        $Keywords = @($Keywords)
    }
    elseif ($Keywords -is [array]) {
    }
    else {
        $Keywords = @()
    }
    
    $searchPaths = @()
    $maxDepth = if ($Recursive) { 3 } else { 0 }
    # Process ExecutableExtensions parameter - extract extensions from path if needed
    if ($ExecutableExtensions) {
        if ($ExecutableExtensions -is [string]) {
            # If it's a path, extract the extension
            if (Test-Path $ExecutableExtensions) {
                $extension = [System.IO.Path]::GetExtension($ExecutableExtensions)
                if ($extension) {
                    $ExecutableExtensions = @($extension)
                    Write-DebugLog -Message "Extracted extension '$extension' from path '$ExecutableExtensions' and converted to array" -Category "EXEC" -Color "Yellow"
                }
                else {
                    $ExecutableExtensions = @(".exe")  # Default fallback
                    Write-DebugLog -Message "No extension found in path, using default: .exe" -Category "EXEC" -Color "Yellow"
                }
            }
            else {
                # If it's not a valid path, treat as extension
                $ExecutableExtensions = @($ExecutableExtensions)
                Write-DebugLog -Message "Converted string extension to array: $($ExecutableExtensions -join ', ')" -Category "EXEC" -Color "Yellow"
            }
        }
    }
    else {
        $ExecutableExtensions = @()
    }
    $searchPaths += $AdditionalScanPaths
    if ($OnlyScanDirs -and $OnlyScanDirs.Count -gt 0) { 
        # Add install directory paths
        if (-not [string]::IsNullOrEmpty($AdditionalInstallDirName)) {
            $installPath = Join-Path $Global:APP_INSTALL_DIR $AdditionalInstallDirName
            if (Test-Path $installPath) {
                $searchPaths += $installPath
            }
        }
        else {
            if (Test-Path $Global:APP_INSTALL_DIR) {
                $searchPaths += $Global:APP_INSTALL_DIR
            }
        }
        
        # Add dev directory paths (only if ScanDevDir is provided)
        if (-not [string]::IsNullOrEmpty($AdditionalScanDevDirName)) {
            $devPath = Join-Path $Global:LANG_COMPILER_DIR $AdditionalScanDevDirName
            if (Test-Path $devPath) {
                $searchPaths += $devPath
            }
        }
        else {
            if (Test-Path $Global:LANG_COMPILER_DIR) {
                # Add all subdirectories of LANG_COMPILER_DIR except .winenvs
                $subDirs = Get-ChildItem -Path $Global:LANG_COMPILER_DIR -Directory | Where-Object { $_.Name -ne $Global:WINENVS_DIR }
                foreach ($subDir in $subDirs) {
                    $searchPaths += $subDir.FullName
                }
                Write-DebugLog -Message "Added subdirectories from $Global:LANG_COMPILER_DIR (excluding $Global:WINENVS_DIR): $($subDirs.Name -join ', ')" -Category "EXEC" -Color "Cyan"
            }
        }
    }
    
    # Last resort: Deep search in system directories (up to 4 levels)
    Write-DebugLog -Message "Performing deep search in system directories..." -Category "EXEC" -Color "Cyan"
    $systemPaths = @(
        ${env:LOCALAPPDATA},
        ${env:APPDATA},
        "C:\Program Files",
        "C:\Program Files (x86)",
        "$env:USERPROFILE",
        "$env:USERPROFILE\bin"
    )
    if ($IncludeSystemPaths) {
        $searchPaths += $systemPaths
    }
    # Build search keywords array and remove duplicates
    $allKeywords = @($Keywords)
    if ($AdditionalKeywords -and $AdditionalKeywords.Count -gt 0) {
        $allKeywords += $AdditionalKeywords
    }
    
    # Remove duplicate keywords, prioritizing those with extensions
    $allKeywords = Remove-DuplicateKeywords -Keywords $allKeywords -RemoveExtensionForComparison $true
    
    # Track searched paths to avoid duplicate output
    $searchedPaths = @()
    
    # Search in specified paths first
    foreach ($searchPath in $searchPaths) {
        if (Test-Path $searchPath) {
            # Add to searched paths list if not already present
            if ($searchPath -notin $searchedPaths) {
                $searchedPaths += $searchPath
            }
            
            # Write-DebugLog -Message "Searching in: $searchPath" -Category "EXEC" -Color "Cyan"
            
            try {
                foreach ($searchKeyword in $allKeywords) {
                    # Determine search depth based on Recursive flag
                    foreach ($extension in $ExecutableExtensions) {
                        $exeFileName = Set-FileExtension -FileName $searchKeyword -Extension $extension
                        # Write-DebugLog -Message "Searching for file: '$exeFileName' in path: '$searchPath' (MaxDepth: $maxDepth)" -Category "EXEC" -Color "Cyan"
                        $exePath = Find-FileWithDepth -BasePath $searchPath -FileName $exeFileName -MaxDepth $maxDepth
                        # Write-DebugLog -Message "Find-FileWithDepth result for '$exeFileName': '$exePath'" -Category "EXEC" -Color "Yellow"
                        if ($exePath) {
                            Write-DebugLog -Message "Found executable with keyword '$searchKeyword' and extension '$extension': $exePath" -Category "EXEC" -Color "Green"
                            return $exePath
                        }
                    }
                }
            }
            catch {
                Write-DebugLog -Message "Error searching in $searchPath : $_" -Category "EXEC" -Color "Yellow"
            }
        }
    }
    
    # If no executable found and debug is enabled, print all searched paths
    Write-DebugLog -Message "No executable found matching keyword: $Keywords,IncludeSystemPaths: $IncludeSystemPaths" -Category "EXEC" -Color "Yellow"
    if ($searchedPaths.Count -gt 0) {
        Write-DebugLog -Message "Searched paths summary (total: $($searchedPaths.Count)):" -Category "EXEC" -Color "Yellow"
        foreach ($path in $searchedPaths) {
            Write-DebugLog -Message "  - $path" -Category "EXEC" -Color "Gray"
        }
    }
    else {
        Write-DebugLog -Message "No searched paths found" -Category "EXEC" -Color "Yellow"
    }
    
    return $null
}



<#
.SYNOPSIS
    Sets multiple environment variables for installed applications and packages using WindowsPathFunction.ps1

.DESCRIPTION
    This function is a wrapper around WindowsPathFunction.ps1 that automatically configures
    environment variables for installed applications and packages. It supports both PATH
    additions and custom environment variables (like JAVA_HOME, ANDROID_HOME, etc.).
    
    The function can handle multiple environment variable types per package and supports
    custom keywords for finding executables. If no keyword is specified, it uses the
    default executable name from the package configuration.
    
    After setting all environment variables, it automatically refreshes the environment
    to ensure changes are immediately available in the current session.

.PARAMETER Id
    The package identifier (e.g., "Pandoc", "Java", "Git")

.PARAMETER EnvVars
    Array of environment variable configurations. Each item should contain:
    - Type: Array of environment variable types ("Path", "JAVA_HOME", etc.)
    - Keyword: (Optional) Custom keyword for finding the executable

.PARAMETER ExecutablePath
    The path to the main executable that was found during installation

.PARAMETER DefaultExec
    The default executable name to use if no custom keyword is specified

.EXAMPLE
    Set-MultipleEnvironmentVariablesForPackage -Id "Java" -EnvVars $packageMeta.EnvVars -ExecutablePath "C:\Program Files\Java\bin\java.exe" -DefaultExec "java.exe"

.NOTES
    This function is specifically designed for use during application and package installation
    processes. It integrates with the WindowsPathFunction.ps1 system for consistent
    environment variable management across the installation framework.
#>
function Set-MultipleEnvironmentVariablesForPackage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Id,
        [Parameter(Mandatory = $true)]
        [array]$EnvVars,
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        [Parameter(Mandatory = $false)]
        [string]$DefaultExec = ""
    )
    
    # Debug information for parameter validation
    Write-DebugLog -Message "Id: '$Id'" -Category "ENV" -Color "Magenta"
    Write-DebugLog -Message "Id type: $($Id.GetType().Name)" -Category "ENV" -Color "Magenta"
    Write-DebugLog -Message "EnvVars: $($EnvVars | ConvertTo-Json -Depth 2)" -Category "ENV" -Color "Magenta"
    Write-DebugLog -Message "EnvVars type: $($EnvVars.GetType().Name)" -Category "ENV" -Color "Magenta"
    Write-DebugLog -Message "ExecutablePath: '$ExecutablePath'" -Category "ENV" -Color "Magenta"
    Write-DebugLog -Message "ExecutablePath type: $($ExecutablePath.GetType().Name)" -Category "ENV" -Color "Magenta"
    Write-DebugLog -Message "ExecutablePath value: $($ExecutablePath | ConvertTo-Json -Depth 3)" -Category "ENV" -Color "Magenta"
    Write-DebugLog -Message "DefaultExec: '$DefaultExec'" -Category "ENV" -Color "Magenta"
    Write-DebugLog -Message "DefaultExec type: $($DefaultExec.GetType().Name)" -Category "ENV" -Color "Magenta"
    
    Write-DebugLog -Message "Setting environment variables for $Id" -Category "ENV" -Color "Cyan"
    
    # Use the provided executable path to get base directory
    Write-DebugLog -Message "Processing ExecutablePath: '$ExecutablePath'" -Category "ENV" -Color "Magenta"
    
    # Check if ExecutablePath is null or empty
    if ([string]::IsNullOrEmpty($ExecutablePath)) {
        Write-DebugLog -Message "ExecutablePath is null or empty" -Category "ENV" -Color "Red"
        throw "ExecutablePath cannot be null or empty"
    }
    
    # Check if ExecutablePath is an array
    if ($ExecutablePath -is [array]) {
        Write-DebugLog -Message "ExecutablePath is an array with $($ExecutablePath.Count) items" -Category "ENV" -Color "Red"
        Write-DebugLog -Message "Array contents: $($ExecutablePath -join ', ')" -Category "ENV" -Color "Red"
        # Take the first item if it's an array
        $ExecutablePath = $ExecutablePath[0]
        Write-DebugLog -Message "Using first item: '$ExecutablePath'" -Category "ENV" -Color "Yellow"
    }
    
    # Additional type checking and conversion
    Write-DebugLog -Message "After array check - ExecutablePath: '$ExecutablePath'" -Category "ENV" -Color "Magenta"
    Write-DebugLog -Message "After array check - ExecutablePath type: $($ExecutablePath.GetType().Name)" -Category "ENV" -Color "Magenta"
    
    # Force convert to string if needed
    if ($ExecutablePath -ne $null) {
        try {
            $ExecutablePath = [string]$ExecutablePath
            Write-DebugLog -Message "Converted to string: '$ExecutablePath'" -Category "ENV" -Color "Green"
        }
        catch {
            Write-DebugLog -Message "Failed to convert to string: $($_.Exception.Message)" -Category "ENV" -Color "Red"
            throw "ExecutablePath cannot be converted to string: $($_.Exception.Message)"
        }
    }
    
    $baseDir = Split-Path -Parent $ExecutablePath
    Write-DebugLog -Message "Base directory: '$baseDir'" -Category "ENV" -Color "Magenta"
    
    # Extract executable directory and add to PATH environment variables list
    $exeDir = Split-Path -Parent $ExecutablePath
    $pathEnvironmentVariablesList = @($exeDir)
    $addExecBinaryAbsolutePathsList = @()

    # Cache for keyword searches to avoid duplicates
    $keywordSearchCache = @{}

    try {
        Write-DebugLog -Message "Processing $($EnvVars.Count) environment variables" -Category "ENV" -Color "Magenta"

        foreach ($envVar in $EnvVars) {
            Write-DebugLog -Message "Processing envVar: $($envVar | ConvertTo-Json)" -Category "ENV" -Color "Cyan"

            $types = $envVar.Type
            Write-DebugLog -Message "Types: $($types -join ', ')" -Category "ENV" -Color "Cyan"
            
            # Check if ExecutableFiles exists and process it (new feature for multiple specific files)
            if ($envVar.ContainsKey("ExecutableFiles")) {
                $executableFiles = $envVar.ExecutableFiles
                Write-DebugLog -Message "Found ExecutableFiles: $($executableFiles | ConvertTo-Json)" -Category "ENV" -Color "Cyan"
                
                # Convert string to array if needed
                if ($executableFiles -is [string]) {
                    $executableFiles = @($executableFiles)
                    Write-DebugLog -Message "Converted string ExecutableFiles to array: $($executableFiles -join ', ')" -Category "ENV" -Color "Yellow"
                }
                
                # Process each executable file
                foreach ($execFile in $executableFiles) {
                    Write-DebugLog -Message "Searching for executable file: '$execFile'" -Category "ENV" -Color "Cyan"
                    $fullPath = Join-Path $exeDir $execFile
                    
                    if (Test-Path $fullPath) {
                        $baseDir = Split-Path -Parent $fullPath
                        if ($baseDir -notin $pathEnvironmentVariablesList) {
                            $pathEnvironmentVariablesList += $baseDir
                            Write-DebugLog -Message "Added base directory to PATH list: $baseDir" -Category "ENV" -Color "Green"
                        }
                        $addExecBinaryAbsolutePathsList += $fullPath
                        Write-DebugLog -Message "Added binary path to AddExec list: $fullPath" -Category "ENV" -Color "Green"
                    }
                    else {
                        Write-DebugLog -Message "Warning: Executable file not found: $fullPath" -Category "ENV" -Color "Yellow"
                    }
                }
            }
            # Check if Keyword exists and process it (legacy feature)
            elseif ($envVar.ContainsKey("Keyword")) {
                $keyword = $envVar.Keyword
                Write-DebugLog -Message "Found Keyword: $($keyword | ConvertTo-Json)" -Category "ENV" -Color "Cyan"
                
                # Convert string to array if needed
                if ($keyword -is [string]) {
                    $keyword = @($keyword)
                    Write-DebugLog -Message "Converted string keyword to array: $($keyword -join ', ')" -Category "ENV" -Color "Yellow"
                }
                
                # Process each keyword to find executables
                foreach ($kw in $keyword) {
                    Write-DebugLog -Message "Searching for executable with keyword: '$kw'" -Category "ENV" -Color "Cyan"
                    $foundPaths = Find-ExecutableByKeyword -Keywords $kw -AdditionalScanPaths $exeDir -OnlyScanDirs @($exeDir) -Recursive $true
                    
                    if ($foundPaths) {
                        foreach ($path in $foundPaths) {
                            $baseDir = Split-Path -Parent $path
                            if ($baseDir -notin $pathEnvironmentVariablesList) {
                                $pathEnvironmentVariablesList += $baseDir
                                Write-DebugLog -Message "Added base directory to PATH list: $baseDir" -Category "ENV" -Color "Green"
                            }
                            $addExecBinaryAbsolutePathsList += $path
                            Write-DebugLog -Message "Added binary path to AddExec list: $path" -Category "ENV" -Color "Green"
                        }
                    }
                    else {
                        Write-DebugLog -Message "Warning: Could not find executable for keyword '$kw'" -Category "ENV" -Color "Yellow"
                    }
                }
            }
            else {
                Write-DebugLog -Message "No ExecutableFiles or Keyword found, using provided ExecutablePath" -Category "ENV" -Color "Cyan"
            }
            
            Write-DebugLog -Message "Processing $($types.Count) environment variable types" -Category "ENV" -Color "Magenta"
            foreach ($type in $types) {
                Write-DebugLog -Message "Processing type: '$type'" -Category "ENV" -Color "Cyan"
                switch ($type) {
                    "Path" {
                        # Process all collected PATH environment variables
                        foreach ($pathDir in $pathEnvironmentVariablesList) {
                            Write-DebugLog -Message "Adding $pathDir to Windows PATH" -Category "ENV" -Color "Green"
                            & $script:WindowsPathFunctionPath "add" $pathDir
                        }
                    }
                    "AddExec" {
                        # Process all collected AddExec binary absolute paths
                        foreach ($binaryPath in $addExecBinaryAbsolutePathsList) {
                            Write-DebugLog -Message "Adding $binaryPath to PATH using symbolic links" -Category "ENV" -Color "Green"
                            & $script:WindowsPathFunctionPath "addexec" $binaryPath
                        }
                    }
                    "Var" {
                        # Handle Var type environment variables with proper keyword search and SubPath
                        $varName = $envVar.Name
                        $subPath = if ($envVar.ContainsKey("SubPath")) { $envVar.SubPath } else { "" }

                        Write-DebugLog -Message "Processing Var type: $varName with SubPath: '$subPath'" -Category "ENV" -Color "Cyan"

                        # Determine the base directory for this variable
                        $varBaseDir = $exeDir

                        # If there's a keyword, search for the specific executable
                        if ($envVar.ContainsKey("Keyword")) {
                            $keyword = $envVar.Keyword
                            if ($keyword -is [string]) {
                                $keyword = @($keyword)
                            }

                            # Use the first keyword to find the executable
                            $firstKeyword = $keyword[0]

                            # Check cache first
                            if ($keywordSearchCache.ContainsKey($firstKeyword)) {
                                $foundPath = $keywordSearchCache[$firstKeyword]
                                Write-DebugLog -Message "Using cached path for keyword '$firstKeyword': $foundPath" -Category "ENV" -Color "Yellow"
                            } else {
                                Write-DebugLog -Message "Searching for executable with keyword: '$firstKeyword'" -Category "ENV" -Color "Cyan"
                                $foundPaths = Find-ExecutableByKeyword -Keywords $firstKeyword -AdditionalScanPaths $exeDir -OnlyScanDirs @($exeDir) -Recursive $true

                                # Handle both single result and array results
                                if ($foundPaths) {
                                    if ($foundPaths -is [array] -and $foundPaths.Count -gt 0) {
                                        $foundPath = $foundPaths[0]
                                    } elseif ($foundPaths -is [string]) {
                                        $foundPath = $foundPaths
                                    } else {
                                        $foundPath = $foundPaths
                                    }
                                    $keywordSearchCache[$firstKeyword] = $foundPath
                                    Write-DebugLog -Message "Found and cached path for keyword '$firstKeyword': $foundPath" -Category "ENV" -Color "Green"
                                } else {
                                    $foundPath = $null
                                    Write-DebugLog -Message "Could not find executable for keyword '$firstKeyword', using default base directory" -Category "ENV" -Color "Yellow"
                                }
                            }

                            if ($foundPath) {
                                $varBaseDir = Split-Path -Parent $foundPath
                            }
                        }

                        # Apply SubPath if specified
                        if (-not [string]::IsNullOrEmpty($subPath)) {
                            if ($subPath -eq "..") {
                                $varValue = Split-Path -Parent $varBaseDir
                            } elseif ($subPath.StartsWith("..")) {
                                # Handle relative paths like "../.."
                                $varValue = $varBaseDir
                                $pathParts = $subPath -split "/"
                                foreach ($part in $pathParts) {
                                    if ($part -eq "..") {
                                        $varValue = Split-Path -Parent $varValue
                                    } elseif (-not [string]::IsNullOrEmpty($part)) {
                                        $varValue = Join-Path $varValue $part
                                    }
                                }
                            } else {
                                $varValue = Join-Path $varBaseDir $subPath
                            }
                        } else {
                            $varValue = $varBaseDir
                        }

                        Write-DebugLog -Message "Setting $varName = $varValue" -Category "ENV" -Color "Green"
                        & $script:WindowsPathFunctionPath "setvar" $varName $varValue
                    }
                    default {
                        # Handle other custom environment variable types (legacy support)
                        Write-DebugLog -Message "Setting $type = $exeDir (legacy mode)" -Category "ENV" -Color "Green"
                        & $script:WindowsPathFunctionPath "setvar" $type $exeDir
                    }
                }
            }
        }
        
        # Refresh environment variables after setting all variables
        Write-DebugLog -Message "Refreshing environment variables..." -Category "ENV" -Color "Cyan"
        & $script:WindowsPathFunctionPath "refresh-bat"
        
        Write-DebugLog -Message "Environment variables set and refreshed successfully" -Category "ENV" -Color "Green"
    }
    catch {
        Write-DebugLog -Message "Error setting environment variables: $($_.Exception.Message)" -Category "ENV" -Color "Red"
        throw
    }
}

function Repair-WingetInstallation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Id,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedInstallDir,
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [string]$FoundExecutablePath = $null
    )
    
    Write-Host "       [REPAIR] Checking for installation mismatch for $Id" -ForegroundColor Yellow
    Write-Host "       [REPAIR] Expected location: $ExpectedInstallDir" -ForegroundColor Yellow
    
    Write-Host "       [REPAIR] DEBUG: FoundExecutablePath parameter: $FoundExecutablePath" -ForegroundColor Magenta
    Write-Host "       [REPAIR] DEBUG: Keyword parameter: $Keyword" -ForegroundColor Magenta
    
    # Use provided path or find executable
    if (-not $FoundExecutablePath) {
        Write-Host "       [REPAIR] No executable path provided, searching in expected directory: $ExpectedInstallDir" -ForegroundColor Yellow
        $foundExecutablePath = Find-ExecutableByKeyword -Keywords $Keyword -AdditionalScanPaths $ExpectedInstallDir -Recursive $true -AdditionalKeywords $AdditionalKeywords
        if (-not $foundExecutablePath) {
            Write-Host "       [REPAIR] No executable found in expected directory, searching system directories" -ForegroundColor Yellow
            $foundExecutablePath = Find-ExecutableByKeyword -Keywords $Keyword -Recursive $true -AdditionalKeywords $AdditionalKeywords
            if (-not $foundExecutablePath) {
                Write-Host "       [REPAIR] No executable found in system directories" -ForegroundColor Yellow
                return $null
            }
        }
    }
    
    Write-Host "       [REPAIR] Found location: $foundExecutablePath" -ForegroundColor Yellow
    
    # Check if already in expected location
    if ($foundExecutablePath.StartsWith($ExpectedInstallDir)) {
        Write-Host "       [REPAIR] Executable already in expected location" -ForegroundColor Green
        return $foundExecutablePath
    }
    
    # Need repair - copy to expected location
    Write-Host "       [REPAIR] Starting installation repair process..." -ForegroundColor Cyan
    
    # Get the directory containing the executable
    $foundInstallDir = Split-Path -Parent $foundExecutablePath
    
    try {
        # Create expected directory if it doesn't exist
        New-DirectoryIfNotExists -Path $ExpectedInstallDir -Category "REPAIR"
        
        # Copy the entire installation directory
        Write-Host "       [REPAIR] Copying from $foundInstallDir to $ExpectedInstallDir..." -ForegroundColor Cyan

        # For Postman and similar apps, we need to copy the parent directory structure
        # Check if the found directory is a versioned subdirectory (like Postman\app-x.x.x)
        $foundDirName = Split-Path -Leaf $foundInstallDir
        $foundParentDir = Split-Path -Parent $foundInstallDir
        $foundParentDirName = Split-Path -Leaf $foundParentDir

        # If the executable is in a subdirectory structure like Postman\app-x.x.x\Postman.exe
        # We want to copy the entire Postman directory, not just the app-x.x.x subdirectory
        if ($foundDirName -match "^app-" -and $foundParentDirName -eq "Postman") {
            Write-Host "       [REPAIR] Detected Postman-style directory structure, copying parent directory" -ForegroundColor Cyan
            Copy-Item -Path $foundParentDir -Destination (Split-Path -Parent $ExpectedInstallDir) -Recurse -Force
            # Rename to expected directory name if different
            $copiedDir = Join-Path (Split-Path -Parent $ExpectedInstallDir) $foundParentDirName
            if ($copiedDir -ne $ExpectedInstallDir -and (Test-Path $copiedDir)) {
                if (Test-Path $ExpectedInstallDir) {
                    Remove-Item -Path $ExpectedInstallDir -Recurse -Force
                }
                Move-Item -Path $copiedDir -Destination $ExpectedInstallDir -Force
            }
        }
        else {
            # Standard copy for other applications
            # Use -ErrorAction SilentlyContinue to handle broken symlinks gracefully
            Copy-Item -Path "$foundInstallDir\*" -Destination $ExpectedInstallDir -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        # Verify the copy was successful - search for executable in the copied directory
        Write-Host "       [REPAIR] Verifying copy operation..." -ForegroundColor Cyan

        # First try the simple case - executable directly in expected directory
        $expectedExecutable = Join-Path $ExpectedInstallDir (Split-Path -Leaf $foundExecutablePath)

        # If not found, search recursively in the expected directory
        if (-not (Test-Path $expectedExecutable)) {
            Write-Host "       [REPAIR] Executable not found at direct path, searching recursively..." -ForegroundColor Yellow
            $executableName = Split-Path -Leaf $foundExecutablePath
            $foundFiles = Get-ChildItem -Path $ExpectedInstallDir -Name $executableName -Recurse -ErrorAction SilentlyContinue
            if ($foundFiles -and $foundFiles.Count -gt 0) {
                $expectedExecutable = Join-Path $ExpectedInstallDir $foundFiles[0]
                Write-Host "       [REPAIR] Found executable at: $expectedExecutable" -ForegroundColor Green
            }
        }

        if (Test-Path $expectedExecutable) {
            Write-Host "       [REPAIR] Successfully copied installation to expected location" -ForegroundColor Green
            Write-Host "       [REPAIR] New executable path: $expectedExecutable" -ForegroundColor Green
            return $expectedExecutable
        }
        else {
            Write-Host "       [REPAIR] Error: Copy operation failed - executable not found at expected location" -ForegroundColor Red
            Write-Host "       [REPAIR] Expected path: $expectedExecutable" -ForegroundColor Red
            return $null
        }
    }
    catch {
        Write-Host "       [REPAIR] Error during repair process: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

<#
.SYNOPSIS
    Installs packages using Windows Package Manager (winget) with custom installation directory support

.DESCRIPTION
    This function handles winget package installation with advanced features to address winget's
    unpredictable installation behavior. Unlike other package managers (pip, npm, etc.), winget
    supports custom installation directories, making it suitable for controlled deployment.
    
    Key Features:
    - Custom installation directory support (unlike pip/npm which use global/user directories)
    - Binary file scanning for installation verification (faster than package list checking)
    - Automatic repair of mislocated installations
    - Fallback to Chocolatey if winget fails
    - Returns executable path for environment variable configuration
    
    Due to winget's unpredictable installation behavior, this function uses binary file scanning
    instead of package list verification for faster and more reliable detection.

.PARAMETER Id
    The winget package identifier (e.g., "JohnMacFarlane.Pandoc")

.PARAMETER InstallDir
    Custom installation directory. If not specified, uses default location.
    This is a key advantage over other package managers like pip/npm.

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed without performing installation

.PARAMETER AllowTryInstall
    If true, allows retry installation if first attempt fails

.PARAMETER Keyword
    Primary keyword for executable file detection (e.g., "pandoc.exe")

.PARAMETER ForceInstall
    If true, forces installation even if package appears to be installed

.PARAMETER AdditionalKeywords
    Additional keywords for more comprehensive executable detection

.RETURNS
    Returns the full path to the main executable file, or $null if not found/installed

.EXAMPLE
    $exePath = Invoke-WingetCommand -Id "JohnMacFarlane.Pandoc" -InstallDir "D:\apps\pandoc" -Keyword "pandoc.exe"

.NOTES
    - Uses binary file scanning for faster installation verification
    - Automatically repairs installations that are in wrong locations
    - Supports custom installation directories (unlike pip/npm)
    - Returns executable path for environment variable configuration
    - Recommended for Windows applications that need controlled deployment
#>
function Invoke-WingetCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Id, # Package ID
        [string]$InstallDir = "", # Installation directory
        [bool]$OnlyCheckFlag = $false,
        [bool]$AllowTryInstall = $false,
        [string]$Keyword = "", # Keyword for executable search
        [bool]$ForceInstall = $false, # Force installation regardless of existing installation
        [array]$AdditionalKeywords = @(), # Additional keywords for search
        [bool]$ForceToInstallDir = $true, # Force to install directory
        [string]$RegistrySearchKeyword = "", # Registry search keyword for cleanup
        [bool]$IncludeSystemPaths = $false # Include system paths
    )
    
    # Initialize result variables
    $installationResult = $false
    $isInExpectedDir = $false
    $exePath = $null
    $finalExePath = $null

    
    # Print parameter information for debugging
    Write-Host "=== Invoke-WingetCommand Parameters ===" -ForegroundColor Magenta
    Write-Host "       Id: $Id" -ForegroundColor Yellow
    Write-Host "       InstallDir: $InstallDir" -ForegroundColor Yellow
    Write-Host "       OnlyCheckFlag: $OnlyCheckFlag" -ForegroundColor Yellow
    Write-Host "       AllowTryInstall: $AllowTryInstall" -ForegroundColor Yellow
    Write-Host "       Keyword: $Keyword" -ForegroundColor Yellow
    Write-Host "       AdditionalKeywords: $($AdditionalKeywords -join ', ')" -ForegroundColor Yellow
    Write-Host "       ForceInstall: $ForceInstall" -ForegroundColor Yellow
    Write-Host "       RegistrySearchKeyword: $RegistrySearchKeyword" -ForegroundColor Yellow
    
    $installSuccessFlag = Join-Path $Global:USER_CACHE_DIR "$Id.install_success.flag"
    $tryInstallFlag = Join-Path $Global:USER_CACHE_DIR "$Id.try_install_flag"
    
    # Set default installation directory if not provided
    if ([string]::IsNullOrEmpty($InstallDir)) {
        $InstallDir = Join-Path $Global:APP_INSTALL_DIR $Id
        Write-Host "       Using default InstallDir: $InstallDir" -ForegroundColor Cyan
    }       
    # Check if already installed (only if OnlyCheckFlag is true or ForceInstall is false)
    if (-not $ForceInstall) {
        $isInstalled = $false 
        
        # 1. Check for executable using Find-ExecutableByKeyword (highest priority)
        if (-not [string]::IsNullOrEmpty($Keyword)) {
            Write-Host "       Checking for existing installation..." -ForegroundColor Cyan
            
            $exePath = Find-ExecutableByKeyword -IncludeSystemPaths $IncludeSystemPaths -Keywords $Keyword -AdditionalScanPaths $InstallDir -Recursive $true -AdditionalKeywords $AdditionalKeywords
            if ($exePath -and (Test-Path $exePath)) {
                $isInstalled = $true
                $installationResult = $true
                $finalExePath = $exePath
                Write-Host "       ${Id}: Found executable at $exePath, already installed" -ForegroundColor Green
                
                # Check if executable is in expected install directory
                $isInExpectedDir = $exePath.StartsWith($InstallDir)
            }
        }
        else {
            Write-Host "       Checking for installation success flag..." -ForegroundColor Cyan
        }
        
        # If not forcing install and already installed, skip installation
        if (-not $ForceInstall -and $isInstalled) {
            Write-Host "       ${Id}: Already installed, skipping installation" -ForegroundColor Yellow
            $installationResult = $true
        }
    }

    if (-not $installationResult) {
    
        Write-Host "       Installing $Id..." -ForegroundColor Cyan

        # Build install command with Windows version compatibility
        $params = "--silent --accept-source-agreements"
        # Note: --accept-package-agreements is only supported in Windows 11 winget
        if ($Global:isWin11) {
            $params += " --accept-package-agreements"
        }
        if ($InstallDir) {
            $params += " --location `"$InstallDir`""
        }
        $fullCommand = "winget install --id $Id $params"
        
        # Build uninstall command with Windows version compatibility
        $uninstallArgs = "uninstall $Id --silent --accept-source-agreements"
        # Note: --accept-package-agreements is only supported in Windows 11 winget
        # Windows 10 winget will fail with "Argument name was not recognized"
        if ($Global:isWin11) {
            $uninstallArgs += " --accept-package-agreements"
        }

        $firstCleanOldInstallCommand = "winget $uninstallArgs"
        Write-Host "       Running: $firstCleanOldInstallCommand" -ForegroundColor Cyan

        # Start timing the uninstall process
        $uninstallStartTime = Get-Date

        # Run uninstall with real-time output (no job for immediate feedback)
        try {
            $uninstallProcess = Start-Process -FilePath "winget" -ArgumentList $uninstallArgs -Wait -NoNewWindow -PassThru
            $uninstallExitCode = $uninstallProcess.ExitCode
            $uninstallCompleted = $true

            if ($uninstallExitCode -eq 0) {
                Write-Host "       Successfully cleaned old installation of $Id" -ForegroundColor Green
            }
            else {
                Write-Host "       Failed to clean old installation of $Id (exit code: $uninstallExitCode), attempting precise registry cleanup..." -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "       Uninstall operation failed with error: $($_.Exception.Message)" -ForegroundColor Yellow
            $uninstallCompleted = $false
            $uninstallExitCode = -1
        }
        
        if (-not $uninstallCompleted -or $uninstallExitCode -ne 0) {
            Write-Host "       Proceeding with registry cleanup..." -ForegroundColor Yellow

            # Call precise registry cleanup function
            if (-not [string]::IsNullOrEmpty($RegistrySearchKeyword)) {
                $keywordArray = if ($RegistrySearchKeyword.Contains(";")) {
                    $RegistrySearchKeyword -split ";" | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() }
                }
                else {
                    @($RegistrySearchKeyword)
                }

                $cleanupResult = Remove-PreciseRegistryEntries -SearchKeywords $keywordArray
                if ($cleanupResult.EntriesRemoved -gt 0) {
                    Write-Host "       Precise registry cleanup completed - Removed $($cleanupResult.EntriesRemoved) entries" -ForegroundColor Green
                }
                else {
                    Write-Host "       No matching registry entries found for cleanup" -ForegroundColor Yellow
                }
            }
            
            # Method 1: Force remove registry uninstall entries
            try {
                # Find uninstall entries containing the package ID or registry search keyword
                $uninstallEntries = @()
                $searchPatterns = @("*$Id*")
                
                # Add registry search keyword if provided
                if (-not [string]::IsNullOrEmpty($RegistrySearchKeyword)) {
                    $searchPatterns += "*$RegistrySearchKeyword*"
                }
                
                Write-Host "       Searching for registry entries with patterns: $($searchPatterns -join ', ')" -ForegroundColor Cyan
                
                # Check 64-bit registry
                $uninstallEntries += Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
                Where-Object { 
                    $matchFound = $false
                    # Check if DisplayName property exists before using it
                    if ($_.PSObject.Properties.Name -contains "DisplayName" -and $_.DisplayName) {
                        foreach ($pattern in $searchPatterns) {
                            if ($_.DisplayName -like $pattern) {
                                $matchFound = $true
                                break
                            }
                        }
                    }
                    $matchFound
                } |
                Select-Object DisplayName, UninstallString, PSChildName
                
                # Check 32-bit registry (Wow6432Node)
                $uninstallEntries += Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
                Where-Object { 
                    $matchFound = $false
                    # Check if DisplayName property exists before using it
                    if ($_.PSObject.Properties.Name -contains "DisplayName" -and $_.DisplayName) {
                        foreach ($pattern in $searchPatterns) {
                            if ($_.DisplayName -like $pattern) {
                                $matchFound = $true
                                break
                            }
                        }
                    }
                    $matchFound
                } |
                Select-Object DisplayName, UninstallString, PSChildName
                
                if ($uninstallEntries.Count -gt 0) {
                    Write-Host "       Found $($uninstallEntries.Count) uninstall entries to remove" -ForegroundColor Cyan
                    
                    foreach ($entry in $uninstallEntries) {
                        $registryPath = ""
                        if ($entry.PSChildName -like "*{*}*") {
                            # GUID format
                            $registryPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$($entry.PSChildName)"
                        }
                        else {
                            # String format
                            $registryPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$($entry.PSChildName)"
                        }
                        
                        $displayName = if ($entry.PSObject.Properties.Name -contains "DisplayName" -and $entry.DisplayName) { $entry.DisplayName } else { "Unknown" }
                        Write-Host "       Removing registry entry: $displayName" -ForegroundColor Yellow
                        Remove-Item $registryPath -Recurse -Force -ErrorAction SilentlyContinue
                        
                        # Also try Wow6432Node path
                        $wow6432Path = $registryPath -replace "SOFTWARE\\", "SOFTWARE\WOW6432Node\"
                        Remove-Item $wow6432Path -Recurse -Force -ErrorAction SilentlyContinue
                    }
                    
                    Write-Host "       Registry cleanup completed for $Id" -ForegroundColor Green
                }
                else {
                    Write-Host "       No uninstall entries found for $Id" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "       Registry cleanup failed: $($_.Exception.Message)" -ForegroundColor Red
            }



            Write-Host "       Proceeding with installation despite uninstall failure" -ForegroundColor Yellow
        }
    
        # Check if uninstall took less than 4 seconds and call helper function if needed
        $uninstallDuration = (Get-Date) - $uninstallStartTime
        if ($uninstallDuration.TotalSeconds -lt 4) {
            Wait-ForUninstallProcesses
        }
        
        # Display timing information between uninstall and install
        $uninstallEndTime = Get-Date
        $timeBetweenCommands = $uninstallEndTime - $uninstallStartTime
        Write-Host "       Uninstall completed in $([math]::Round($timeBetweenCommands.TotalSeconds, 2)) seconds" -ForegroundColor Gray
    
        Write-Host "       Running: $fullCommand" -ForegroundColor Cyan
        
        # Enhanced installation with retry mechanism for network issues
        $maxRetries = 3
        $retryDelay = 2
        $installationSuccess = $false
        
        for ($retryAttempt = 1; $retryAttempt -le $maxRetries; $retryAttempt++) {
            if ($retryAttempt -gt 1) {
                Write-Host "       Retry attempt $retryAttempt of $maxRetries for $Id..." -ForegroundColor Yellow
                Write-Host "       Retrying in " -NoNewline -ForegroundColor Cyan
                
                # Countdown display
                for ($i = $retryDelay; $i -gt 0; $i--) {
                    Write-Host "$i " -NoNewline -ForegroundColor Cyan
                    Start-Sleep -Seconds 1
                }
                Write-Host "" # New line after countdown
            }

            # Run installation with real-time output
            $process = Start-Process -FilePath "winget" -ArgumentList "install --id $Id $params" -Wait -NoNewWindow -PassThru

            if ($process.ExitCode -eq 0) {
                Write-Host "       Successfully installed $Id" -ForegroundColor Green
                $installationResult = $true
                $installationSuccess = $true
                New-Item -ItemType File -Path $installSuccessFlag -Force | Out-Null
                break
            }
            else {
                Write-Host "       Installation attempt $retryAttempt failed with exit code: $($process.ExitCode)" -ForegroundColor Yellow
                Write-Host "       Please check the output above for error details" -ForegroundColor Cyan

                # Detect common error codes and apply fixes
                $isInstallerError = ($process.ExitCode -eq 1722 -or $process.ExitCode -eq 1603)

                if ($isInstallerError -and $retryAttempt -eq 1) {
                    Write-Host "       Windows Installer error detected (exit code: $($process.ExitCode))" -ForegroundColor Yellow
                    Write-Host "       Attempting installer permission repair..." -ForegroundColor Cyan

                    # Call permission repair function
                    $repairResult = Repair-InstallerPermissions -PackageId $Id -ForceRepair $false

                    if ($repairResult.Success) {
                        Write-Host "       Permission repair completed, retrying installation..." -ForegroundColor Green
                        continue
                    }
                    else {
                        Write-Host "       Permission repair failed, trying force repair..." -ForegroundColor Yellow
                        $forceRepairResult = Repair-InstallerPermissions -PackageId $Id -ForceRepair $true
                        if ($forceRepairResult.Success) {
                            Write-Host "       Force repair completed, retrying installation..." -ForegroundColor Green
                            continue
                        }
                    }
                }

                # General retry logic
                if ($retryAttempt -lt $maxRetries) {
                    Write-Host "       Will retry installation (attempt $($retryAttempt + 1) of $maxRetries)..." -ForegroundColor Cyan
                    continue
                }
                else {
                    Write-Host "       Max retries reached. Installation failed." -ForegroundColor Red
                }
            }
        }

        # Note: Log files are no longer created due to real-time output mode

        if (-not $installationSuccess) {
            # Handle retry logic only if AllowTryInstall is true
            if ($AllowTryInstall) {
                if (-not (Test-Path $tryInstallFlag)) {
                    Write-Host "       Failed and try to reinstall $Id" -ForegroundColor Red
                    
                    # Perform comprehensive repair before retry
                    Write-Host "       Performing comprehensive installer repair before retry..." -ForegroundColor Cyan
                    $comprehensiveRepairResult = Repair-InstallerPermissions -PackageId $Id -ForceRepair $true
                    
                    if ($comprehensiveRepairResult.Success) {
                        Write-Host "       Comprehensive repair completed, proceeding with uninstall and reinstall..." -ForegroundColor Green
                    }
                    else {
                        Write-Host "       Comprehensive repair had issues, proceeding anyway..." -ForegroundColor Yellow
                    }
                    
                    Start-Process -FilePath "winget" -ArgumentList "uninstall $Id" -Wait -NoNewWindow -PassThru
                    $process = Start-Process -FilePath "winget" -ArgumentList "install --id $Id $params" -Wait -NoNewWindow -PassThru
                    if ($process.ExitCode -eq 0) {
                        Write-Host "       Successfully reinstalled $Id" -ForegroundColor Green
                        $installationResult = $true
                        Set-Content -Path $tryInstallFlag -Value "true" -Force
                        # Create installation success flag
                        New-Item -ItemType File -Path $installSuccessFlag -Force | Out-Null
                    }
                    else {
                        Write-Host "       Failed to reinstall $Id" -ForegroundColor Red
                        Set-Content -Path $tryInstallFlag -Value "false" -Force
                        $installationResult = $false
                    }
                }
                else {
                    Write-Host "       $Id already tried to install, but failed" -ForegroundColor Yellow
                    $installationResult = $false
                }
            }
            else {
                Write-Host "       Failed to install $Id after $maxRetries attempts" -ForegroundColor Red
                $installationResult = $false
            }
        }

    }
    $isRepair = $false
    if ($installationResult -eq $true -and -not [string]::IsNullOrEmpty($Keyword) -and -not $isInExpectedDir -eq $true -and $ForceToInstallDir -eq $true) {
        $isRepair = $true
        Write-Host "       Performing final repair check..." -ForegroundColor Cyan
        Write-Host "       [DEBUG] About to call Repair-WingetInstallation with exePath: $exePath" -ForegroundColor Magenta
        $repairedExePath = Repair-WingetInstallation -Id $Id -ExpectedInstallDir $InstallDir -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -FoundExecutablePath $exePath
        if ($repairedExePath -ne $null) {
            Write-Host "       Repair completed successfully" -ForegroundColor Green
            $installationResult = $true
            $finalExePath = $repairedExePath
        }
        else {
            Write-Host "       Repair failed" -ForegroundColor Red
        }
    }
    else {
        Write-Host "       [Repair condition not met - Values: installationResult=$installationResult, Keyword='$Keyword', isInExpectedDir=$isInExpectedDir, ForceToInstallDir=$ForceToInstallDir, IncludeSystemPaths=$IncludeSystemPaths]" -ForegroundColor Cyan
    }
    if (-not $isRepair -and $ForceToInstallDir) {
        Write-Host "       [WARNING] Package requires forced installation to install directory, but repair command cannot be executed due to insufficient parameters:" -ForegroundColor Yellow
        if ([string]::IsNullOrEmpty($Keyword)) {
            Write-Host "       [WARNING] Missing required parameter: Keyword" -ForegroundColor Yellow
        }
        if ([string]::IsNullOrEmpty($InstallDir)) {
            Write-Host "       [WARNING] Missing required parameter: InstallDir" -ForegroundColor Yellow
        }
        if ([string]::IsNullOrEmpty($Id)) {
            Write-Host "       [WARNING] Missing required parameter: Id" -ForegroundColor Yellow
        }
        Write-Host "       [WARNING] Repair command requires: Id, InstallDir, Keyword, and AdditionalKeywords parameters" -ForegroundColor Yellow
    }
    
    # If installation was successful but we don't have an executable path yet, try to find it
    if ($installationResult -and -not $finalExePath -and -not [string]::IsNullOrEmpty($Keyword)) {
        $finalExePath = Find-ExecutableByKeyword -IncludeSystemPaths $IncludeSystemPaths -Keywords $Keyword -AdditionalScanPaths $InstallDir -Recursive $true -AdditionalKeywords $AdditionalKeywords
        if ($finalExePath) {
            Write-Host "       Found executable after installation: $finalExePath" -ForegroundColor Green
        }
    }
    
    # Ensure we return a single string, not an array
    if ($finalExePath -is [array]) {
        # Find the first valid string path (non-boolean)
        foreach ($item in $finalExePath) {
            if ($item -and $item -is [string] -and -not ($item -is [bool])) {
                return $item
            }
        }
        return $null
    }
    return $finalExePath
}

<#
.SYNOPSIS
    Repairs Windows Installer permissions and cleans temporary files to resolve installation issues.

.DESCRIPTION
    This function addresses common Windows Installer issues by:
    1. Cleaning temporary files from multiple locations
    2. Repairing Windows Installer service permissions
    3. Clearing Windows Installer cache
    4. Fixing registry permissions for installer operations
    5. Ensuring proper disk space and directory permissions

.PARAMETER PackageId
    Optional package ID for targeted cleanup (e.g., "Google.Chrome")

.PARAMETER ForceRepair
    If true, performs aggressive cleanup including Windows Installer service restart

.RETURNS
    Returns a hashtable with repair results and statistics

.EXAMPLE
    $result = Repair-InstallerPermissions -PackageId "Google.Chrome" -ForceRepair $true

.NOTES
    - Requires administrator privileges
    - Automatically detects and fixes common MSI installation issues
    - Safe to run multiple times
    - Addresses Error 1722, Error 1603, and temporary directory issues
#>
function Repair-InstallerPermissions {
    param(
        [string]$PackageId = "",
        [bool]$ForceRepair = $false
    )
    
    Write-Host "=== Starting Installer Permission Repair ===" -ForegroundColor Magenta
    
    $repairResults = @{
        TempFilesCleaned = 0
        CacheCleared = 0
        PermissionsFixed = 0
        ServicesRestarted = 0
        DiskSpaceFreed = 0
        Errors = @()
        Success = $true
    }
    
    try {
        # Method 1: Clean temporary files from multiple locations
        Write-Host "       [REPAIR] Cleaning temporary files..." -ForegroundColor Cyan
        
        $tempLocations = @(
            "$env:TEMP",
            "$env:LOCALAPPDATA\Temp",
            "C:\Windows\Temp",
            "C:\Windows\Installer",
            "$env:LOCALAPPDATA\Microsoft\Windows\INetCache",
            "$env:LOCALAPPDATA\Microsoft\Windows\WebCache"
        )
        
        foreach ($location in $tempLocations) {
            if (Test-Path $location) {
                try {
                    # Clean temporary files older than 1 hour
                    $tempFiles = Get-ChildItem -Path $location -Recurse -File -ErrorAction SilentlyContinue | 
                        Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-1) }
                    
                    $fileCount = 0
                    foreach ($file in $tempFiles) {
                        try {
                            Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
                            $fileCount++
                        }
                        catch {
                            # Skip files that can't be deleted
                        }
                    }
                    
                    # Clean empty directories
                    Get-ChildItem -Path $location -Recurse -Directory -ErrorAction SilentlyContinue | 
                        Where-Object { (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue).Count -eq 0 } |
                        ForEach-Object { 
                            try { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue } catch {} 
                        }
                    
                    $repairResults.TempFilesCleaned += $fileCount
                    Write-Host "       [REPAIR] Cleaned $fileCount files from $location" -ForegroundColor Green
                }
                catch {
                    Write-Host "       [REPAIR] Warning: Could not clean $location - $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        }
        
        # Method 2: Clean WinGet cache specifically
        Write-Host "       [REPAIR] Cleaning WinGet cache..." -ForegroundColor Cyan
        
        $wingetCachePaths = @(
            "$env:LOCALAPPDATA\Temp\WinGet",
            "$env:LOCALAPPDATA\Microsoft\WinGet\Packages",
            "$env:LOCALAPPDATA\Microsoft\WinGet\Cache"
        )
        
        foreach ($cachePath in $wingetCachePaths) {
            if (Test-Path $cachePath) {
                try {
                    $cacheSize = (Get-ChildItem -Path $cachePath -Recurse -ErrorAction SilentlyContinue | 
                        Measure-Object -Property Length -Sum).Sum
                    
                    Remove-Item -Path "$cachePath\*" -Recurse -Force -ErrorAction SilentlyContinue
                    $repairResults.CacheCleared++
                    $repairResults.DiskSpaceFreed += $cacheSize
                    Write-Host "       [REPAIR] Cleared WinGet cache: $cachePath" -ForegroundColor Green
                }
                catch {
                    Write-Host "       [REPAIR] Warning: Could not clear cache $cachePath" -ForegroundColor Yellow
                }
            }
        }
        
        # Method 3: Fix Windows Installer service permissions
        Write-Host "       [REPAIR] Repairing Windows Installer service..." -ForegroundColor Cyan
        
        try {
            # Stop Windows Installer service
            Stop-Service -Name "msiserver" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            
            # Clear Windows Installer cache
            $installerCache = "C:\Windows\Installer"
            if (Test-Path $installerCache) {
                Get-ChildItem -Path $installerCache -Filter "*.tmp" -ErrorAction SilentlyContinue | 
                    Remove-Item -Force -ErrorAction SilentlyContinue
            }
            
            # Restart Windows Installer service
            Start-Service -Name "msiserver" -ErrorAction SilentlyContinue
            $repairResults.ServicesRestarted++
            Write-Host "       [REPAIR] Windows Installer service restarted" -ForegroundColor Green
        }
        catch {
            Write-Host "       [REPAIR] Warning: Could not restart Windows Installer service" -ForegroundColor Yellow
        }
        
        # Method 4: Fix registry permissions for installer operations
        Write-Host "       [REPAIR] Repairing registry permissions..." -ForegroundColor Cyan
        
        $registryPaths = @(
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer",
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
        )
        
        foreach ($regPath in $registryPaths) {
            try {
                # Ensure current user has full control
                $acl = Get-Acl $regPath
                $accessRule = New-Object System.Security.AccessControl.RegistryAccessRule(
                    [System.Security.Principal.WindowsIdentity]::GetCurrent().Name,
                    "FullControl",
                    "ContainerInherit,ObjectInherit",
                    "None",
                    "Allow"
                )
                $acl.SetAccessRule($accessRule)
                Set-Acl -Path $regPath -AclObject $acl
                $repairResults.PermissionsFixed++
            }
            catch {
                Write-Host "       [REPAIR] Warning: Could not fix registry permissions for $regPath" -ForegroundColor Yellow
            }
        }
        
        # Method 5: Force repair if requested
        if ($ForceRepair) {
            Write-Host "       [REPAIR] Performing force repair..." -ForegroundColor Cyan
            
            # Clear all Windows Installer temporary files
            try {
                Get-ChildItem -Path "C:\Windows\Installer" -Filter "*.tmp" -ErrorAction SilentlyContinue | 
                    Remove-Item -Force -ErrorAction SilentlyContinue
                
                # Clear Windows Installer log files
                Get-ChildItem -Path "C:\Windows\Installer" -Filter "*.log" -ErrorAction SilentlyContinue | 
                    Remove-Item -Force -ErrorAction SilentlyContinue
                
                # Reset Windows Installer service
                Restart-Service -Name "msiserver" -Force -ErrorAction SilentlyContinue
                
                Write-Host "       [REPAIR] Force repair completed" -ForegroundColor Green
            }
            catch {
                Write-Host "       [REPAIR] Warning: Force repair encountered issues" -ForegroundColor Yellow
            }
        }
        
        # Method 6: Check and report disk space
        Write-Host "       [REPAIR] Checking disk space..." -ForegroundColor Cyan
        
        $drives = @("C:", "D:")
        foreach ($drive in $drives) {
            if (Test-Path $drive) {
                $driveInfo = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='$drive'"
                if ($driveInfo) {
                    $freeSpaceGB = [math]::Round($driveInfo.FreeSpace / 1GB, 2)
                    $totalSpaceGB = [math]::Round($driveInfo.Size / 1GB, 2)
                    Write-Host "       [REPAIR] Drive $drive - Free: ${freeSpaceGB}GB / Total: ${totalSpaceGB}GB" -ForegroundColor Gray
                    
                    if ($freeSpaceGB -lt 2) {
                        Write-Host "       [REPAIR] Warning: Low disk space on $drive (${freeSpaceGB}GB free)" -ForegroundColor Red
                        $repairResults.Errors += "Low disk space on $drive"
                    }
                }
            }
        }
        
        Write-Host "       [REPAIR] Installer permission repair completed successfully" -ForegroundColor Green
        Write-Host "       [REPAIR] Summary: $($repairResults.TempFilesCleaned) temp files cleaned, $($repairResults.CacheCleared) caches cleared, $($repairResults.PermissionsFixed) permissions fixed" -ForegroundColor Cyan
        
    }
    catch {
        $errorMsg = "Repair operation failed: $($_.Exception.Message)"
        Write-Host "       [REPAIR] $errorMsg" -ForegroundColor Red
        $repairResults.Errors += $errorMsg
        $repairResults.Success = $false
    }
    
    return $repairResults
}

<#
.SYNOPSIS
    Resets and updates WinGet to resolve hanging or unresponsive issues

.DESCRIPTION
    This function performs a comprehensive reset of WinGet including:
    1. Stopping all WinGet processes
    2. Clearing WinGet cache and temporary files
    3. Resetting WinGet sources
    4. Re-initializing WinGet with automatic agreement acceptance
    5. Testing WinGet functionality

.PARAMETER PackageId
    Optional package ID for targeted testing after reset

.RETURNS
    Returns a hashtable with reset results and status

.EXAMPLE
    $result = Reset-WinGetEnvironment -PackageId "vim.vim"

.NOTES
    - Requires administrator privileges for some operations
    - Automatically accepts source agreements to prevent hanging
    - Safe to run multiple times
    - Addresses WinGet hanging and unresponsive issues
#>
function Reset-WinGetEnvironment {
    param(
        [string]$PackageId = ""
    )
    
    Write-Host "=== Starting WinGet Environment Reset ===" -ForegroundColor Magenta
    
    $resetResults = @{
        ProcessesStopped = 0
        CacheCleared = 0
        SourcesReset = 0
        SourcesAdded = 0
        TestPassed = $false
        Errors = @()
        Success = $true
    }
    
    try {
        # Step 1: Stop all WinGet processes
        Write-Host "       [RESET] Stopping WinGet processes..." -ForegroundColor Cyan
        
        $wingetProcesses = Get-Process | Where-Object { $_.ProcessName -eq "winget" }
        foreach ($process in $wingetProcesses) {
            try {
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                $resetResults.ProcessesStopped++
                Write-Host "       [RESET] Stopped WinGet process (PID: $($process.Id))" -ForegroundColor Green
            }
            catch {
                Write-Host "       [RESET] Warning: Could not stop process $($process.Id)" -ForegroundColor Yellow
            }
        }
        
        # Step 2: Clear WinGet cache and temporary files
        Write-Host "       [RESET] Clearing WinGet cache..." -ForegroundColor Cyan
        
        $wingetCachePaths = @(
            "$env:LOCALAPPDATA\Microsoft\WinGet",
            "$env:LOCALAPPDATA\Temp\WinGet",
            "$env:LOCALAPPDATA\Packages\Microsoft.DesktopAppInstaller_8wekyb3d8bbwe\LocalCache",
            "$env:TEMP\winget*"
        )
        
        foreach ($cachePath in $wingetCachePaths) {
            if (Test-Path $cachePath) {
                try {
                    Remove-Item -Path $cachePath -Recurse -Force -ErrorAction SilentlyContinue
                    $resetResults.CacheCleared++
                    Write-Host "       [RESET] Cleared cache: $cachePath" -ForegroundColor Green
                }
                catch {
                    Write-Host "       [RESET] Warning: Could not clear $cachePath" -ForegroundColor Yellow
                }
            }
        }
        
        # Step 3: Reset WinGet sources using official method
        Write-Host "       [RESET] Resetting WinGet sources..." -ForegroundColor Cyan
        
        try {
            # Reset sources with force
            $sourceResetJob = Start-Job -ScriptBlock {
                winget source reset --force
            }
            
            $sourceResetCompleted = Wait-Job $sourceResetJob -Timeout 30
            if ($sourceResetCompleted) {
                Receive-Job $sourceResetJob | Out-Null
                Remove-Job $sourceResetJob -Force
                $resetResults.SourcesReset++
                Write-Host "       [RESET] Sources reset successfully" -ForegroundColor Green
            }
            else {
                Write-Host "       [RESET] Source reset timed out, stopping job..." -ForegroundColor Yellow
                Stop-Job $sourceResetJob -PassThru | Remove-Job -Force
            }
        }
        catch {
            Write-Host "       [RESET] Warning: Source reset failed" -ForegroundColor Yellow
        }
        
        # Step 4: Update WinGet sources using official method
        Write-Host "       [RESET] Updating WinGet sources..." -ForegroundColor Cyan
        
        try {
            # Update sources
            $sourceUpdateJob = Start-Job -ScriptBlock {
                winget source update
            }
            
            $sourceUpdateCompleted = Wait-Job $sourceUpdateJob -Timeout 60
            if ($sourceUpdateCompleted) {
                Receive-Job $sourceUpdateJob | Out-Null
                Remove-Job $sourceUpdateJob -Force
                $resetResults.SourcesAdded++
                Write-Host "       [RESET] Sources updated successfully" -ForegroundColor Green
            }
            else {
                Write-Host "       [RESET] Source update timed out, stopping job..." -ForegroundColor Yellow
                Stop-Job $sourceUpdateJob -PassThru | Remove-Job -Force
            }
        }
        catch {
            Write-Host "       [RESET] Warning: Source update failed" -ForegroundColor Yellow
        }
        
        # Step 5: Test WinGet functionality
        Write-Host "       [RESET] Testing WinGet functionality..." -ForegroundColor Cyan
        
        try {
            # Test with a simple search
            $testJob = Start-Job -ScriptBlock {
                winget search --help
            }
            
            $testCompleted = Wait-Job $testJob -Timeout 15
            if ($testCompleted) {
                Receive-Job $testJob | Out-Null
                Remove-Job $testJob -Force
                $resetResults.TestPassed = $true
                Write-Host "       [RESET] WinGet functionality test passed" -ForegroundColor Green
            }
            else {
                Write-Host "       [RESET] WinGet functionality test timed out" -ForegroundColor Yellow
                Stop-Job $testJob -PassThru | Remove-Job -Force
            }
        }
        catch {
            Write-Host "       [RESET] Warning: WinGet functionality test failed" -ForegroundColor Yellow
        }
        
        # Step 6: Test specific package search if provided
        if (-not [string]::IsNullOrEmpty($PackageId)) {
            Write-Host "       [RESET] Testing package search for: $PackageId" -ForegroundColor Cyan
            
            try {
                $packageTestJob = Start-Job -ScriptBlock {
                    param($pkgId, $isWin11)
                    $searchArgs = "search $pkgId --accept-source-agreements"
                    if ($isWin11) {
                        $searchArgs += " --accept-package-agreements"
                    }
                    Invoke-Expression "winget $searchArgs"
                } -ArgumentList $PackageId, $Global:isWin11
                
                $packageTestCompleted = Wait-Job $packageTestJob -Timeout 20
                if ($packageTestCompleted) {
                    Receive-Job $packageTestJob | Out-Null
                    Remove-Job $packageTestJob -Force
                    Write-Host "       [RESET] Package search test passed for: $PackageId" -ForegroundColor Green
                }
                else {
                    Write-Host "       [RESET] Package search test timed out for: $PackageId" -ForegroundColor Yellow
                    Stop-Job $packageTestJob -PassThru | Remove-Job -Force
                }
            }
            catch {
                Write-Host "       [RESET] Warning: Package search test failed for: $PackageId" -ForegroundColor Yellow
            }
        }
        
        Write-Host "       [RESET] WinGet environment reset completed successfully" -ForegroundColor Green
        Write-Host "       [RESET] Summary: $($resetResults.ProcessesStopped) processes stopped, $($resetResults.CacheCleared) caches cleared, $($resetResults.SourcesReset) sources reset, $($resetResults.SourcesAdded) sources added" -ForegroundColor Cyan
        
    }
    catch {
        $errorMsg = "WinGet reset operation failed: $($_.Exception.Message)"
        Write-Host "       [RESET] $errorMsg" -ForegroundColor Red
        $resetResults.Errors += $errorMsg
        $resetResults.Success = $false
    }
    
    return $resetResults
}

function Invoke-Command {
    param(
        [string]$Command,
        [string]$Description = "",
        [bool]$ShowOutput = $true
    )
    
    if ($ShowOutput) {
        Write-Host "Executing: $Command" -ForegroundColor Cyan
        if ($Description) {
            Write-Host "Description: $Description" -ForegroundColor Yellow
        }
    }
    
    try {
        $process = Start-Process -FilePath "powershell" -ArgumentList "-Command $Command" -Wait -NoNewWindow -PassThru
        if ($process.ExitCode -ne 0) {
            Write-Error "Command failed with exit code: $($process.ExitCode)"
            return $false
        }
        return $true
    }
    catch {
        Write-Error "Error executing command: $_"
        return $false
    }
}

function Get-FileWithSizeCheck {
    param(
        [string]$localPath,
        [string]$remoteUrl,
        [string]$description = ""
    )
    
    $shouldDownload = $false
    $tempFile = "$localPath.tmp"
    
    if (Test-Path $localPath) {
        $localSize = (Get-Item $localPath).Length
        try {
            $response = Invoke-WebRequest -Uri $remoteUrl -Method Head
            $remoteSize = [int]$response.Headers['Content-Length']
            
            if ($localSize -ne $remoteSize) {
                $shouldDownload = $true
                Write-Host "File sizes differ. Local: $localSize bytes, Remote: $remoteSize bytes" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Warning "Could not check remote file size: $_"
            $shouldDownload = $true
        }
    }
    else {
        $shouldDownload = $true
    }
    
    if ($shouldDownload) {
        Write-Host "Downloading $description..." -ForegroundColor Yellow
        try {
            $webClient = New-Object System.Net.WebClient
            
            $totalSize = 0
            try {
                $response = Invoke-WebRequest -Uri $remoteUrl -Method Head
                $totalSize = [int]$response.Headers['Content-Length']
            }
            catch {
                Write-Warning "Could not get file size: $_"
            }
            
            $webClient.DownloadFileAsync((New-Object Uri($remoteUrl)), $tempFile)
            
            $lastProgress = 0
            $lastBytes = 0
            $startTime = [DateTime]::Now
            $lastTime = $startTime
            
            while ($webClient.IsBusy) {
                Start-Sleep -Milliseconds 500
                $currentTime = [DateTime]::Now
                $timeDiff = ($currentTime - $lastTime).TotalSeconds
                
                if ($totalSize -gt 0) {
                    $bytesDownloaded = (Get-Item $tempFile -ErrorAction SilentlyContinue).Length
                    $percentage = [math]::Min(100, [math]::Floor(($bytesDownloaded / $totalSize) * 100))
                    
                    if ($timeDiff -gt 0) {
                        $bytesDiff = $bytesDownloaded - $lastBytes
                        $speedMBps = [math]::Round($bytesDiff / $timeDiff / 1MB, 2)
                        $status = "$percentage% Complete - $speedMBps MB/s"
                    }
                    else {
                        $status = "$percentage% Complete"
                    }
                    
                    if ($percentage -ne $lastProgress) {
                        Write-Progress -Activity "Downloading $description" -Status $status -PercentComplete $percentage
                        $lastProgress = $percentage
                        $lastBytes = $bytesDownloaded
                        $lastTime = $currentTime
                    }
                }
                else {
                    Write-Progress -Activity "Downloading $description" -Status "Downloading..." -PercentComplete -1
                }
            }
            
            $totalTime = ([DateTime]::Now - $startTime).TotalSeconds

            if (-not (Test-Path $tempFile)) {
                Write-Error "Failed to download file: No temporary file created"
                return $false
            }

            $finalSize = (Get-Item $tempFile).Length

            if ($finalSize -eq 0) {
                Write-Error "Downloaded file is empty (0 bytes)"
                Remove-Item -Path $tempFile -Force
                return $false
            }

            if ($totalSize -gt 0 -and $finalSize -ne $totalSize) {
                Write-Warning "Downloaded file size ($finalSize bytes) does not match expected size ($totalSize bytes)"
            }

            $averageSpeed = if ($totalTime -gt 0) { [math]::Round($finalSize / $totalTime / 1MB, 2) } else { 0 }

            Write-Progress -Activity "Downloading $description" -Status "Download Complete - Average Speed: $averageSpeed MB/s" -PercentComplete 100 -Completed

            if (Test-Path $localPath) {
                Remove-Item -Path $localPath -Force
            }
            Rename-Item -Path $tempFile -NewName (Split-Path $localPath -Leaf) -Force
            Write-Host "Download completed: $localPath (Average Speed: $averageSpeed MB/s)" -ForegroundColor Green
            return $true
        }
        catch {
            Write-Error "Failed to download file: $_"
            if (Test-Path $tempFile) {
                Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
            }
            return $false
        }
        finally {
            if ($webClient) {
                $webClient.Dispose()
            }
        }
    }
    
    return $false
}

function Test-AndRecreateHardLink {
    param (
        [Parameter(Mandatory = $true)]
        [string]$LinkPath,
        
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )
    
    Write-Host "       Checking hard link: $LinkPath" -ForegroundColor Cyan
    
    if (Test-Path $LinkPath) {
        try {
            $fsi = Get-Item $LinkPath -Force
            $isHardLink = $fsi.Attributes -band [System.IO.FileAttributes]::ReparsePoint
            
            if ($isHardLink) {
                $currentTarget = (Get-Item $LinkPath).Target
                if ($currentTarget -eq $TargetPath) {
                    Write-Host "       Hard link is valid and points to correct target" -ForegroundColor Green
                    return $true
                }
                else {
                    Write-Host "       Hard link exists but points to wrong target: $currentTarget" -ForegroundColor Yellow
                }
            }
            else {
                Write-Host "       Path exists but is not a hard link" -ForegroundColor Yellow
            }
            
            Write-Host "       Removing existing path: $LinkPath" -ForegroundColor Yellow
            Remove-Item -Path $LinkPath -Recurse -Force
        }
        catch {
            Write-Host "       Error checking link: $($_.Exception.Message)" -ForegroundColor Red
            return $false
        }
    }
    
    $parentDir = Split-Path $LinkPath -Parent
    New-DirectoryIfNotExists -Path $parentDir -Category "SYMLINK"
    
    try {
        Write-Host "       Creating hard link from $LinkPath to $TargetPath" -ForegroundColor Yellow
        cmd /c mklink /J "$LinkPath" "$TargetPath"
        Write-Host "       Successfully created hard link" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "       Error creating hard link: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-DirectoryNotEmpty {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Path
    )
    
    if (-not (Test-Path $Path)) {
        return $false
    }
    
    $items = Get-ChildItem -Path $Path -Force
    return $null -ne $items -and @($items).Count -gt 0
}

function Test-DirectoryExistsAndNotEmpty {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Path
    )
    
    if (-not (Test-Path -Path $Path -PathType Container)) {
        return $false
    }
    
    $items = Get-ChildItem -Path $Path
    return ($items.Count -gt 0)
}

# Function to ensure global variables are properly encoded
function Ensure-GlobalVarsEncoding {
    if (Test-Path $Global:GLOBAL_VAR_DIR) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        Get-ChildItem -Path $Global:GLOBAL_VAR_DIR -File | ForEach-Object {
            # Read content with current encoding
            $content = Get-Content -Path $_.FullName -Raw
            if ($content) {
                # Remove any null bytes and write back with UTF-8 encoding
                $cleanContent = $content -replace "`0", ""
                [System.IO.File]::WriteAllText($_.FullName, $cleanContent, $utf8NoBom)
            }
        }
    }
}

# Function to read a global variable value
function Get-GlobalVar {
    param (
        [string]$key
    )
    
    # Ensure directory exists
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
    }
    
    $filePath = Join-Path $Global:GLOBAL_VAR_DIR $key
    if (Test-Path $filePath) {
        # Read file with UTF-8 encoding without BOM
        $content = Get-Content -Path $filePath -Encoding UTF8 -TotalCount 1
        # Remove any null bytes and return
        return $content -replace "`0", ""
    }
    return $null
}

# Function to write a global variable value
function Set-GlobalVar {
    param (
        [string]$key,
        [string]$value
    )
    
    # Ensure directory exists
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
    }
    
    $filePath = Join-Path $Global:GLOBAL_VAR_DIR $key
    # Create UTF-8 encoding without BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    # Remove any null bytes from the value
    $cleanValue = $value -replace "`0", ""
    # Write content with UTF-8 encoding without BOM
    [System.IO.File]::WriteAllText($filePath, $cleanValue, $utf8NoBom)
}

# Function to list all global variables
function Get-AllGlobalVars {
    # Ensure directory exists
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
    }
    
    $vars = @{}
    Get-ChildItem $Global:GLOBAL_VAR_DIR | ForEach-Object {
        $vars[$_.Name] = Get-Content $_.FullName -Raw
    }
    return $vars
}

# Set-WindowsPathByJS function has been deprecated and removed
# Use WindowsPathFunction.ps1 instead for environment variable management



function Add-FileContextMenu {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExePath,
        [Parameter(Mandatory = $true)]
        [string]$MenuName,
        [string]$IconPath = $null,
        [switch]$ForFilesOnly
    )
    if (-not (Test-Path $Global:TEMP_REG_DIR)) {
        New-Item -ItemType Directory -Path $Global:TEMP_REG_DIR -Force | Out-Null
    }
    try {
        # Create a timestamp for the reg file
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        
        # Generate a shell-friendly menu name (no spaces)
        $shellMenuName = $MenuName -replace '\s+', ''
        $regFileName = "context_menu_${shellMenuName}_${timestamp}.reg"
        $tempRegFile = Join-Path $Global:TEMP_REG_DIR $regFileName
        
        # Process command based on application name
        $appName = Split-Path $ExePath -Leaf
        
        # Escape paths for registry
        $escapedExePath = $ExePath -replace '\\', '\\'
        $escapedIconPath = if ($IconPath) { $IconPath -replace '\\', '\\' } else { $escapedExePath }
        
        # Create .reg file content with proper escaping
        $regContent = @"
Windows Registry Editor Version 5.00

"@

        # Special handling for Bandizip
        if ($appName -eq "Bandizip.exe") {
            # Add extract option for archive files
            $regContent += @"

[HKEY_CLASSES_ROOT\.zip\shell\BandizipExtract]
@="Extract with Bandizip"
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\.zip\shell\BandizipExtract\command]
@="\`"$escapedExePath\`" x \`"%1\`""

[HKEY_CLASSES_ROOT\.rar\shell\BandizipExtract]
@="Extract with Bandizip"
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\.rar\shell\BandizipExtract\command]
@="\`"$escapedExePath\`" x \`"%1\`""

[HKEY_CLASSES_ROOT\.7z\shell\BandizipExtract]
@="Extract with Bandizip"
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\.7z\shell\BandizipExtract\command]
@="\`"$escapedExePath\`" x \`"%1\`""

[HKEY_CLASSES_ROOT\.tar\shell\BandizipExtract]
@="Extract with Bandizip"
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\.tar\shell\BandizipExtract\command]
@="\`"$escapedExePath\`" x \`"%1\`""

[HKEY_CLASSES_ROOT\.gz\shell\BandizipExtract]
@="Extract with Bandizip"
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\.gz\shell\BandizipExtract\command]
@="\`"$escapedExePath\`" x \`"%1\`""

[HKEY_CLASSES_ROOT\.bz2\shell\BandizipExtract]
@="Extract with Bandizip"
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\.bz2\shell\BandizipExtract\command]
@="\`"$escapedExePath\`" x \`"%1\`""

[HKEY_CLASSES_ROOT\.xz\shell\BandizipExtract]
@="Extract with Bandizip"
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\.iso\shell\BandizipExtract]
@="Extract with Bandizip"
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\.iso\shell\BandizipExtract\command]
@="\`"$escapedExePath\`" x \`"%1\`""

# Add compress option for files
[HKEY_CLASSES_ROOT\*\shell\BandizipCompress]
@="Add to archive..."
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\*\shell\BandizipCompress\command]
@="\`"$escapedExePath\`" a \`"%1\`""

# Add compress option for directories
[HKEY_CLASSES_ROOT\Directory\shell\BandizipCompress]
@="Add to archive..."
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\Directory\shell\BandizipCompress\command]
@="\`"$escapedExePath\`" a \`"%1\`""
"@
        }
        else {
            # Default handling for other applications
            $regContent += @"

[HKEY_CLASSES_ROOT\*\shell\$shellMenuName]
@="$MenuName"
"Icon"="$escapedIconPath"

[HKEY_CLASSES_ROOT\*\shell\$shellMenuName\command]
@="\`"$escapedExePath\`" \`"%1\`""
"@
        }

        # Write the .reg file
        Set-Content -Path $tempRegFile -Value $regContent -Encoding Unicode
        Write-ColorMessage -Message "Created registry file: $tempRegFile" -Type "Info"

        # Import the .reg file
        $process = Start-Process -FilePath "regedit.exe" -ArgumentList "/s `"$tempRegFile`"" -Wait -NoNewWindow -PassThru
        
        if ($process.ExitCode -eq 0) {
            Write-ColorMessage -Message "Context menu added: $MenuName" -Type "Success"
            return $true
        }
        else {
            Write-ColorMessage -Message "Failed to add context menu: Registry import failed" -Type "Error"
            return $false
        }
    }
    catch {
        Write-ColorMessage -Message "Failed to add context menu: $_" -Type "Error"
        return $false
    }
}


function Create-RecursiveSymbolicLinks {
    param (
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,
        
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )
    
    Write-Host "       Copying from $SourcePath to $TargetPath" -ForegroundColor Cyan
    
    if (-not (Test-Path $SourcePath)) {
        Write-Host "       Error: Source path does not exist: $SourcePath" -ForegroundColor Red
        return $false
    }
    
    try {
        # Create target directory if it doesn't exist
        if (-not (Test-Path $TargetPath)) {
            New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
            Write-Host "       Created target directory: $TargetPath" -ForegroundColor Green
        }
        
        # Get source item
        $sourceItem = Get-Item $SourcePath
        
        if ($sourceItem.PSIsContainer) {
            # If source is a directory, copy all contents recursively
            Get-ChildItem -Path $SourcePath -Recurse | ForEach-Object {
                $relativePath = $_.FullName.Substring($SourcePath.Length)
                $targetItemPath = Join-Path $TargetPath $relativePath
                
                if ($_.PSIsContainer) {
                    # Create directory if it doesn't exist
                    if (-not (Test-Path $targetItemPath)) {
                        New-Item -ItemType Directory -Path $targetItemPath -Force | Out-Null
                    }
                }
                else {
                    # For files, copy only if target doesn't exist or is older
                    $shouldCopy = $true
                    if (Test-Path $targetItemPath) {
                        $targetItem = Get-Item $targetItemPath
                        if ($targetItem.LastWriteTime -ge $_.LastWriteTime) {
                            $shouldCopy = $false
                        }
                    }
                    
                    if ($shouldCopy) {
                        Copy-Item -Path $_.FullName -Destination $targetItemPath -Force
                        Write-Host "       Copied: $($_.Name)" -ForegroundColor Green
                    }
                }
            }
        }
        else {
            # If source is a file, copy only if target doesn't exist or is older
            $shouldCopy = $true
            if (Test-Path $TargetPath) {
                $targetItem = Get-Item $TargetPath
                if ($targetItem.LastWriteTime -ge $sourceItem.LastWriteTime) {
                    $shouldCopy = $false
                }
            }
            
            if ($shouldCopy) {
                Copy-Item -Path $SourcePath -Destination $TargetPath -Force
                Write-Host "       Copied: $($sourceItem.Name)" -ForegroundColor Green
            }
        }
        
        Write-Host "       Successfully copied all items" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "       Error during copy operation: $_" -ForegroundColor Red
        return $false
    }
}


<#
.SYNOPSIS
    Creates desktop shortcuts for installed packages with smart shortcut detection and organization

.DESCRIPTION
    This function creates desktop shortcuts for installed packages with the following design approach:
    
    Design Philosophy:
    - Simplified parameter structure: shortcut name, exe path, icon path, category, and scan keywords
    - Smart shortcut detection: scans desktop for existing shortcuts using keywords
    - Automatic organization: moves found shortcuts to backup directory and renames them
    - Backup preservation: ensures shortcuts survive system reinstallation
    
    Smart Shortcut Handling:
    - If scan keywords are provided, searches desktop for existing shortcuts
    - When found, moves them to backup directory and renames to desired name
    - If not found, creates new shortcut in backup directory
    - This approach leverages application-created shortcuts for better compatibility
    
    Backup Strategy:
    - Base backup directory: $Global:LANG_COMPILER_DIR\.desktopIcons
    - Category subdirectories created automatically when category name provided
    - Category directories linked to desktop for easy access
    - All shortcuts stored in backup location with symbolic links to desktop
    
    Benefits:
    - System reinstallation safe: shortcuts can be restored from backup
    - Leverages application-created shortcuts for better compatibility
    - Automatic organization with category support
    - Simplified parameter structure for easier usage

.PARAMETER ShortcutName
    The desired name for the shortcut

.PARAMETER ExePath
    The executable path to link to

.PARAMETER IconPath
    The icon path (defaults to ExePath if not specified)

.PARAMETER CategoryName
    Optional category name for organizing shortcuts in a subdirectory

.PARAMETER ScanKeywords
    Optional array of keywords to scan desktop for existing shortcuts

.RETURNS
    Returns $true if shortcuts were created successfully, $false otherwise

.NOTES
    - Automatically handles backup directory creation
    - Scans desktop for existing shortcuts when keywords provided
    - Moves and renames found shortcuts to backup location
    - Creates new shortcuts if none found during scan
    - Links category directories to desktop automatically
#>
function Create-DesktopShortcutsForPackage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ShortcutName,
        [Parameter(Mandatory = $true)]
        [string]$ExePath,
        [Parameter(Mandatory = $false)]
        [string]$IconPath = "",
        [Parameter(Mandatory = $false)]
        [string]$CategoryName = "",
        [Parameter(Mandatory = $false)]
        [array]$ScanKeywords = @()
    )
    
    Write-Host "       [DESKTOP] Creating desktop shortcut: $ShortcutName" -ForegroundColor Cyan
    
    # Set default icon path to exe path if not specified
    if (-not $IconPath) {
        $IconPath = $ExePath
    }
    
    # Ensure the base desktop icons directory exists
    $baseDesktopIconsDir = Join-Path $Global:LANG_COMPILER_DIR ".desktopIcons"
    Write-DebugLog -Message "LANG_COMPILER_DIR = '$Global:LANG_COMPILER_DIR'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
    Write-DebugLog -Message "baseDesktopIconsDir = '$baseDesktopIconsDir'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
    if (-not (Test-Path $baseDesktopIconsDir)) {
        New-Item -ItemType Directory -Path $baseDesktopIconsDir -Force | Out-Null
        Write-Host "       [DESKTOP] Created base desktop icons directory: $baseDesktopIconsDir" -ForegroundColor Green
    }
    
    Write-Host "       [DESKTOP] CategoryName: '$CategoryName'" -ForegroundColor Green

    # Determine if this is a real category (non-empty string) or root category (empty string)
    $isRootCategory = ($CategoryName -eq "")
    $isRealCategory = ($CategoryName -ne "" -and $CategoryName -ne $null)

    Write-DebugLog -Message "isRootCategory = $isRootCategory, isRealCategory = $isRealCategory" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS

    # Handle CategoryName parameter - create category directory and link to desktop
    if ($isRealCategory) {
        $categoryDir = Join-Path $baseDesktopIconsDir $CategoryName
        Write-DebugLog -Message "categoryDir = '$categoryDir'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
        if (-not (Test-Path $categoryDir)) {
            New-Item -ItemType Directory -Path $categoryDir -Force | Out-Null
            Write-Host "       [DESKTOP] Created category directory: $categoryDir" -ForegroundColor Green
        }

        # Create symbolic link to category directory on desktop
        $desktopPath = [Environment]::GetFolderPath('Desktop')
        $desktopCategoryPath = Join-Path $desktopPath "$CategoryName.lnk"

        # Remove existing category link on desktop if it exists
        if (-not (Test-Path $desktopCategoryPath)) {
            # Create symbolic link to category directory on desktop
            New-Item -ItemType SymbolicLink -Path $desktopCategoryPath -Target $categoryDir -Force | Out-Null
            Write-Host "       [DESKTOP] Linked category directory to desktop: $desktopCategoryPath" -ForegroundColor Green
        }
    }

    # Determine target directory for shortcut
    $targetDir = if ($isRealCategory) {
        Join-Path $baseDesktopIconsDir $CategoryName
    }
    else {
        $baseDesktopIconsDir
    }
    Write-DebugLog -Message "targetDir = '$targetDir'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
    
    # Scan for existing shortcuts on desktop if keywords provided
    $foundShortcut = $null
    if ($ScanKeywords -and $ScanKeywords.Count -gt 0) {
        # Define desktop paths to scan - both user desktop and public desktop
        $userDesktopPath = [Environment]::GetFolderPath('Desktop')
        $publicDesktopPath = "C:\Users\Public\Desktop"
        $desktopPaths = @($userDesktopPath, $publicDesktopPath)
        
        Write-DebugLog -Message "User desktop path: '$userDesktopPath'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
        Write-DebugLog -Message "Public desktop path: '$publicDesktopPath'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
        # Use keywords directly without conversion since we're using Unicode variables
        Write-Host "       [DESKTOP] Scanning both desktops for existing shortcuts with keywords: $($ScanKeywords -join ', ')" -ForegroundColor Yellow
        
        foreach ($keyword in $ScanKeywords) {
            Write-DebugLog -Message "Processing keyword = '$keyword' (Length: $($keyword.Length))" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
            
            # Scan each desktop path
            foreach ($desktopPath in $desktopPaths) {
                if (-not (Test-Path $desktopPath)) {
                    Write-DebugLog -Message "Desktop path does not exist: '$desktopPath'" -Category "DESKTOP" -Color "DarkGray" -LocalDebug $script:DEBUG_DESKTOP_ICONS
                    continue
                }
            
                Write-DebugLog -Message "Scanning desktop path: '$desktopPath'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
                
                # Use .NET method to get files for better Chinese character handling
                try {
                    $lnkFiles = [System.IO.Directory]::GetFiles($desktopPath, "*.lnk")
                    $desktopShortcuts = @()
                    foreach ($filePath in $lnkFiles) {
                        $desktopShortcuts += Get-Item $filePath
                    }
                }
                catch {
                    # Fallback to PowerShell method
                    $desktopShortcuts = Get-ChildItem -Path $desktopPath -Filter "*.lnk" -ErrorAction SilentlyContinue
                }
                
                Write-DebugLog -Message "Found $($desktopShortcuts.Count) shortcuts in '$desktopPath'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
                
                foreach ($shortcut in $desktopShortcuts) {
                    Write-DebugLog -Message "Original name: '$($shortcut.Name)'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
                    $shell = New-Object -ComObject WScript.Shell
                    $targetPath = $shell.CreateShortcut($shortcut.FullName).TargetPath
                    Write-DebugLog -Message "Shortcut target path: '$targetPath'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
                    
                    # Check if targetPath is empty or null
                    if (-not $targetPath -or $targetPath -eq "") {
                        Write-DebugLog -Message "Skipping shortcut with empty target path: $($shortcut.Name)" -Category "DESKTOP" -Color "DarkGray" -LocalDebug $script:DEBUG_DESKTOP_ICONS
                        continue
                    }
                    
                    if (-not (Test-Path $targetPath -PathType Leaf)) {
                        Write-Host "       [DESKTOP] Skipping folder shortcut: $($shortcut.Name)" -ForegroundColor DarkGray
                        continue
                    }
                    
                    # Simple and efficient string matching without encoding conversion
                    $isMatch = $false
                    $matchMethod = ""
                    
                    # Method 1: Direct string comparison with original filename
                    if ($shortcut.Name -like "*$keyword*") {
                        $isMatch = $true
                        $matchMethod = "Direct filename match"
                    }
                    # Method 2: Case-insensitive comparison
                    elseif ($shortcut.Name.ToLower() -like "*$($keyword.ToLower())*") {
                        $isMatch = $true
                        $matchMethod = "Case-insensitive match"
                    }
                    
                    if ($isMatch) {
                        Write-Host "       [DESKTOP] Found existing shortcut: $($shortcut.Name) in '$desktopPath' (Method: $matchMethod)" -ForegroundColor Green
                        $foundShortcut = $shortcut
                        break
                    }
                }
                if ($foundShortcut) { 
                    Write-DebugLog -Message "Found matching shortcut, breaking desktop path loop" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
                    break 
                }
            }
            if ($foundShortcut) { 
                Write-DebugLog -Message "Found matching shortcut, breaking keyword loop" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
                break 
            }
        }
    }
     
    
    
    # Create or move shortcut
    try {
        Write-DebugLog -Message "About to create shortcutPath with targetDir='$targetDir' and ShortcutName='$ShortcutName'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
        $shortcutPath = Join-Path $targetDir "$ShortcutName.lnk"
        Write-DebugLog -Message "shortcutPath = '$shortcutPath'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
        
        # Remove existing target shortcut if it exists
        if (Test-Path $shortcutPath) {
            Write-Host "       [DESKTOP] Removing existing target shortcut: $shortcutPath" -ForegroundColor Yellow
            Remove-Item $shortcutPath -Force
        }
        
        if ($foundShortcut) {
            # Move existing shortcut to target directory and rename
            Write-Host "       [DESKTOP] Moving existing shortcut to: $shortcutPath" -ForegroundColor Green
            Move-Item -Path $foundShortcut.FullName -Destination $shortcutPath -Force
            
            # Update the shortcut properties if needed
            $WshShell = New-Object -ComObject WScript.Shell
            $shortcut = $WshShell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $ExePath
            $shortcut.WorkingDirectory = Split-Path $ExePath
            $shortcut.IconLocation = $IconPath
            $shortcut.Save()
            
            Write-Host "       [DESKTOP] Updated shortcut properties" -ForegroundColor Green
        }
        else {
            # Create new shortcut
            Write-Host "       [DESKTOP] Creating new shortcut: $shortcutPath" -ForegroundColor Green
            
            # Create WScript.Shell object
            $WshShell = New-Object -ComObject WScript.Shell
            $shortcut = $WshShell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $ExePath
            $shortcut.WorkingDirectory = Split-Path $ExePath
            $shortcut.IconLocation = $IconPath
            $shortcut.Save()
        }

        # Handle desktop linking based on category type
        if ($isRootCategory) {
            # For root category (empty string), copy shortcut directly to desktop
            $userDesktopPath = [Environment]::GetFolderPath('Desktop')
            $publicDesktopPath = "C:\Users\Public\Desktop"
            $desktopPaths = @($userDesktopPath, $publicDesktopPath)

            Write-DebugLog -Message "Root category - copying shortcut directly to desktop" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS
            $desktopIndex = 0
            foreach ($desktopPath in $desktopPaths) {
                if (-not (Test-Path $desktopPath)) {
                    Write-DebugLog -Message "Desktop path does not exist, skipping: '$desktopPath'" -Category "DESKTOP" -Color "DarkGray" -LocalDebug $script:DEBUG_DESKTOP_ICONS
                    continue
                }

                $desktopShortcutPath = Join-Path $desktopPath "$ShortcutName.lnk"
                Write-DebugLog -Message "Creating shortcut in: '$desktopPath'" -Category "DESKTOP" -Color "Magenta" -LocalDebug $script:DEBUG_DESKTOP_ICONS

                # Remove existing shortcut on desktop if it exists
                if (Test-Path $desktopShortcutPath) {
                    Write-Host "       [DESKTOP] Removing existing shortcut: $desktopShortcutPath" -ForegroundColor Yellow
                    Remove-Item $desktopShortcutPath -Force
                }
                if ($desktopIndex -eq 1) {
                    # Copy shortcut to desktop
                    Copy-Item -Path $shortcutPath -Destination $desktopShortcutPath -Force
                    Write-Host "       [DESKTOP] Linked shortcut to desktop: $desktopShortcutPath" -ForegroundColor Green
                }
                $desktopIndex++
            }
        }
        # For real categories (non-empty string), the category folder link is already created above
        # No additional desktop linking needed for real categories
    }
    catch {
        Write-Host "       [DESKTOP] Error creating shortcut for ${ShortcutName}: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    
    Write-Host "       [DESKTOP] Desktop shortcut created successfully: $ShortcutName" -ForegroundColor Green
    return $true
}




# Legacy function for backward compatibility - delegates to Create-DesktopShortcutsForPackage
# AI NOTE: This function is deprecated. Use Create-DesktopShortcutsForPackage instead for new code.
function Create-DesktopShortcut {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExePath,
        [Parameter(Mandatory = $true)]
        [string]$ShortcutName,
        [string]$IconPath = $null,
        [string]$TargetPath = $null
    )
    
    # Convert legacy parameters to new function format
    $iconPathParam = if ($IconPath) { $IconPath } else { "" }
    $categoryName = if ($TargetPath) { (Split-Path -Leaf $TargetPath) } else { "" }
    
    return Create-DesktopShortcutsForPackage -ShortcutName $ShortcutName -ExePath $ExePath -IconPath $iconPathParam -CategoryName $categoryName
}


# Background Process Management Functions for MCP Services
function Start-BackgroundProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProcessName,

        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,

        [string]$Arguments = "",
        [string]$WorkingDirectory = "",
        [hashtable]$EnvironmentVars = @{},
        [string]$LogPrefix = "BG"
    )

    Write-ColorMessage -Message "[$LogPrefix] Starting background process: $ProcessName" -Type "Info"
    Write-ColorMessage -Message "[$LogPrefix] Executable: $ExecutablePath" -Type "Info"
    Write-ColorMessage -Message "[$LogPrefix] Arguments: $Arguments" -Type "Info"
    Write-ColorMessage -Message "[$LogPrefix] Working Directory: $WorkingDirectory" -Type "Info"

    # Check if executable exists
    if (-not (Get-Command $ExecutablePath -ErrorAction SilentlyContinue)) {
        Write-ColorMessage -Message "[$LogPrefix] Executable not found: $ExecutablePath" -Type "Error"
        return $null
    }

    # Check if process is already running
    $existingProcess = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    if ($existingProcess) {
        Write-ColorMessage -Message "[$LogPrefix] Process $ProcessName is already running (PID: $($existingProcess.Id))" -Type "Warning"
        return $existingProcess.Id
    }

    try {
        # Set environment variables for the process
        foreach ($key in $EnvironmentVars.Keys) {
            [Environment]::SetEnvironmentVariable($key, $EnvironmentVars[$key], "Process")
            Write-ColorMessage -Message "[$LogPrefix] Set environment variable: $key=$($EnvironmentVars[$key])" -Type "Info"
        }

        # Prepare start process parameters
        $startParams = @{
            FilePath    = $ExecutablePath
            WindowStyle = "Hidden"
            PassThru    = $true
        }

        if ($Arguments) {
            $startParams.ArgumentList = $Arguments
        }

        if ($WorkingDirectory -and (Test-Path $WorkingDirectory)) {
            $startParams.WorkingDirectory = $WorkingDirectory
        }

        # Start the background process
        Write-ColorMessage -Message "[$LogPrefix] Executing Start-Process with parameters:" -Type "Info"
        Write-ColorMessage -Message "[$LogPrefix] FilePath: $($startParams.FilePath)" -Type "Info"
        if ($startParams.ArgumentList) {
            Write-ColorMessage -Message "[$LogPrefix] ArgumentList: $($startParams.ArgumentList)" -Type "Info"
        }
        if ($startParams.WorkingDirectory) {
            Write-ColorMessage -Message "[$LogPrefix] WorkingDirectory: $($startParams.WorkingDirectory)" -Type "Info"
        }

        $process = Start-Process @startParams

        if ($process) {
            Write-ColorMessage -Message "[$LogPrefix] Background process started: $ProcessName (PID: $($process.Id))" -Type "Success"

            # Wait a moment and verify the process is still running
            Start-Sleep -Seconds 2
            $verifyProcess = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
            if ($verifyProcess) {
                Write-ColorMessage -Message "[$LogPrefix] Process verified running: $ProcessName (PID: $($process.Id))" -Type "Success"
            }
            else {
                Write-ColorMessage -Message "[$LogPrefix] Warning: Process may have exited immediately: $ProcessName" -Type "Warning"
            }

            return $process.Id
        }
        else {
            Write-ColorMessage -Message "[$LogPrefix] Failed to start background process: $ProcessName" -Type "Error"
            return $null
        }

    }
    catch {
        Write-ColorMessage -Message "[$LogPrefix] Error starting background process $ProcessName`: $($_.Exception.Message)" -Type "Error"
        return $null
    }
}

function Stop-BackgroundProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProcessName,

        [int]$Port = 0,
        [string]$LogPrefix = "BG"
    )

    Write-ColorMessage -Message "[$LogPrefix] Stopping background process: $ProcessName" -Type "Info"

    try {
        $stopped = $false

        # Method 1: Stop by process name
        $processes = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
        if ($processes) {
            foreach ($process in $processes) {
                Write-ColorMessage -Message "[$LogPrefix] Stopping process $ProcessName (PID: $($process.Id))" -Type "Info"
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                $stopped = $true
            }
        }

        # Method 2: Stop by port if specified
        if ($Port -gt 0) {
            try {
                $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
                foreach ($connection in $connections) {
                    $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-ColorMessage -Message "[$LogPrefix] Stopping process on port $Port`: $($process.Name) (PID: $($process.Id))" -Type "Info"
                        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                        $stopped = $true
                    }
                }
            }
            catch {
                Write-ColorMessage -Message "[$LogPrefix] Could not check port $Port`: $($_.Exception.Message)" -Type "Warning"
            }
        }

        if ($stopped) {
            Write-ColorMessage -Message "[$LogPrefix] Background process stopped: $ProcessName" -Type "Success"
            return $true
        }
        else {
            Write-ColorMessage -Message "[$LogPrefix] No running process found: $ProcessName" -Type "Warning"
            return $false
        }

    }
    catch {
        Write-ColorMessage -Message "[$LogPrefix] Error stopping background process $ProcessName`: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Restart-BackgroundProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProcessName,

        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,

        [string]$Arguments = "",
        [string]$WorkingDirectory = "",
        [hashtable]$EnvironmentVars = @{},
        [int]$Port = 0,
        [int]$RestartDelay = 3,
        [string]$LogPrefix = "BG"
    )

    Write-ColorMessage -Message "[$LogPrefix] Restarting background process: $ProcessName" -Type "Info"

    # Stop the process first
    Stop-BackgroundProcess -ProcessName $ProcessName -Port $Port -LogPrefix $LogPrefix

    # Wait for process to fully stop
    Write-ColorMessage -Message "[$LogPrefix] Waiting $RestartDelay seconds for process to stop..." -Type "Info"
    Start-Sleep -Seconds $RestartDelay

    # Start the process again
    $processId = Start-BackgroundProcess -ProcessName $ProcessName -ExecutablePath $ExecutablePath -Arguments $Arguments -WorkingDirectory $WorkingDirectory -EnvironmentVars $EnvironmentVars -LogPrefix $LogPrefix

    if ($processId) {
        Write-ColorMessage -Message "[$LogPrefix] Background process restarted successfully: $ProcessName (PID: $processId)" -Type "Success"
        return $processId
    }
    else {
        Write-ColorMessage -Message "[$LogPrefix] Failed to restart background process: $ProcessName" -Type "Error"
        return $null
    }
}

function Test-BackgroundProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProcessName,

        [int]$Port = 0,
        [string]$LogPrefix = "BG"
    )

    try {
        # Check by process name
        $process = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
        $processRunning = $process -ne $null

        # Check by port if specified
        $portActive = $false
        if ($Port -gt 0) {
            try {
                $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
                $portActive = $connection -ne $null
            }
            catch {
                $portActive = $false
            }
        }

        $status = @{
            ProcessName    = $ProcessName
            ProcessRunning = $processRunning
            ProcessId      = if ($process) { $process.Id } else { $null }
            Port           = $Port
            PortActive     = $portActive
            IsHealthy      = $processRunning -and ($Port -eq 0 -or $portActive)
        }

        return $status

    }
    catch {
        Write-ColorMessage -Message "[$LogPrefix] Error checking background process $ProcessName`: $($_.Exception.Message)" -Type "Error"
        return @{
            ProcessName    = $ProcessName
            ProcessRunning = $false
            ProcessId      = $null
            Port           = $Port
            PortActive     = $false
            IsHealthy      = $false
            Error          = $_.Exception.Message
        }
    }
}

function Invoke-SmartLoadScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SubPath,
        
        [Parameter(Mandatory = $false)]
        [bool]$ForceDownload = $false
    )
    
    # Use global variables from GlobalVars.ps1
    $BASE_DIR = $Global:BASE_DIR
    $USER_CORE_NODE_DIR = $Global:USER_DIR
    # Use region-appropriate URL for downloads
    $GITEE_BASE_URL = if ($Global:CURRENT_BASE_URL) { $Global:CURRENT_BASE_URL } else { 
        $selectedRegion = Get-GlobalVar -key "SELECTED_REGION" -defaultValue "China"
        if ($selectedRegion -eq "Global") { 
            "https://raw.githubusercontent.com/accountbelongstox/core_node/main" 
        }
        else { 
            "https://gitee.com/accountbelongstox/core_node/raw/main" 
        }
    }
    
    # Use global variable for running environment check
    $IS_RUNNING_FROM_BASE_DIR_SUBDIR = $Global:IS_RUNNING_FROM_BASE_DIR_SUBDIR
    
    # Define paths
    $localScriptsDir = Join-Path $USER_CORE_NODE_DIR "scripts"
    $baseScriptsDir = Join-Path $BASE_DIR "scripts"
    $targetSubPath = Join-Path $localScriptsDir $SubPath
    $baseSubPath = Join-Path $baseScriptsDir $SubPath
    
    # Check if running from BASE_DIR subdirectory and file exists in base scripts
    if ($IS_RUNNING_FROM_BASE_DIR_SUBDIR -and (Test-Path $baseSubPath) -and -not $ForceDownload) {
        Write-Host "Script is running from BASE_DIR subdirectory and file exists at: $baseSubPath" -ForegroundColor Yellow
        Write-Host "Skipping download for: $SubPath" -ForegroundColor Yellow
        return $baseSubPath
    }
    
    # Ensure local scripts directory exists
    if (-not (Test-Path $localScriptsDir)) {
        New-Item -ItemType Directory -Path $localScriptsDir -Force | Out-Null
        Write-Host "Created local scripts directory: $localScriptsDir" -ForegroundColor Green
    }
    
    # Ensure target subdirectory exists
    $targetSubDir = Split-Path $targetSubPath -Parent
    if (-not (Test-Path $targetSubDir)) {
        New-Item -ItemType Directory -Path $targetSubDir -Force | Out-Null
        Write-Host "Created target subdirectory: $targetSubDir" -ForegroundColor Green
    }
    
    # Construct download URL
    $downloadUrl = "$GITEE_BASE_URL/scripts/$SubPath"
    Write-Host "Downloading from: $downloadUrl" -ForegroundColor Cyan
    Write-Host "Target path: $targetSubPath" -ForegroundColor Cyan
    
    # Download with temporary file for safe replacement
    $tempPath = "$targetSubPath.tmp"
    
    try {
        # Clean up any existing temp file
        if (Test-Path $tempPath) {
            Remove-Item -Force $tempPath -ErrorAction SilentlyContinue
        }
        
        # Download to temporary file
        Write-Host "Downloading to temporary file..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tempPath -UseBasicParsing -ErrorAction Stop
        
        # Verify download was successful
        if (-not (Test-Path $tempPath) -or ((Get-Item $tempPath).Length -le 0)) {
            throw "Empty or failed download"
        }
        
        # Remove existing file if it exists
        if (Test-Path $targetSubPath) {
            Write-Host "Removing existing file..." -ForegroundColor Yellow
            Remove-Item -Force $targetSubPath -ErrorAction Stop
        }
        
        # Move temporary file to target location
        Move-Item -Force -Path $tempPath -Destination $targetSubPath
        Write-Host "File downloaded and replaced successfully: $targetSubPath" -ForegroundColor Green
        
        return $targetSubPath
        
    }
    catch {
        Write-Host "Failed to download file: $_" -ForegroundColor Red
        
        # Clean up temp file on failure
        if (Test-Path $tempPath) {
            Remove-Item -Force $tempPath -ErrorAction SilentlyContinue
        }
        
        return $null
    }
}

# Legacy function name for backward compatibility
function Invoke-SmartScriptDownload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SubPath,
        
        [Parameter(Mandatory = $false)]
        [bool]$ForceDownload = $false
    )
    
    $result = Invoke-SmartLoadScript -SubPath $SubPath -ForceDownload $ForceDownload
    
    # Convert path result to boolean for backward compatibility
    if ($result) {
        return $true
    }
    else {
        return $false
    }
}

<#
.SYNOPSIS
    Removes precise registry entries based on strict keyword matching in property values

.DESCRIPTION
    This function performs precise registry cleanup by scanning uninstall registry locations
    and checking if any property values contain the specified keywords. Only removes entries
    where at least one property value contains a keyword match.

.PARAMETER SearchKeywords
    Array of keywords to search for in registry property values

.EXAMPLE
    Remove-PreciseRegistryEntries -SearchKeywords @("VSCodium", "VSCodium.exe")
#>
function Remove-PreciseRegistryEntries {
    param(
        [Parameter(Mandatory = $true)]
        [array]$SearchKeywords
    )

    Write-Host "       [PRECISE_CLEANUP] Starting precise registry cleanup with keywords: $($SearchKeywords -join ', ')" -ForegroundColor Cyan

    # Variables declaration
    $cleanupResults = @{
        EntriesFound     = 0
        EntriesRemoved   = 0
        LocationsCleaned = @()
        Errors           = @()
    }

    # Registry paths to scan
    $registryPaths = @(
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    )

    foreach ($registryPath in $registryPaths) {
        if (-not (Test-Path $registryPath)) {
            Write-Host "       [PRECISE_CLEANUP] Registry path not found: $registryPath" -ForegroundColor Gray
            continue
        }

        Write-Host "       [PRECISE_CLEANUP] Scanning registry path: $registryPath" -ForegroundColor Yellow

        try {
            # Get all subkeys in the uninstall registry
            $subKeys = Get-ChildItem $registryPath -ErrorAction SilentlyContinue

            foreach ($subKey in $subKeys) {
                try {
                    # Get all properties of the subkey
                    $properties = Get-ItemProperty $subKey.PSPath -ErrorAction SilentlyContinue

                    if (-not $properties) {
                        continue
                    }

                    # Check if any property value contains any of the keywords
                    $matchFound = $false
                    $matchedProperties = @()

                    # Properties to check for keyword matches
                    $propertiesToCheck = @(
                        "DisplayName", "DisplayIcon", "InstallLocation", "UninstallString",
                        "QuietUninstallString", "Publisher", "URLInfoAbout", "HelpLink",
                        "Inno Setup: App Path", "InstallSource", "ModifyPath"
                    )

                    foreach ($propName in $propertiesToCheck) {
                        if ($properties.PSObject.Properties.Name -contains $propName -and $properties.$propName) {
                            $propValue = $properties.$propName.ToString()

                            foreach ($keyword in $SearchKeywords) {
                                if ($propValue -like "*$keyword*") {
                                    $matchFound = $true
                                    $matchedProperties += "$propName=$propValue"
                                    break
                                }
                            }

                            if ($matchFound) {
                                break
                            }
                        }
                    }

                    if ($matchFound) {
                        $displayName = if ($properties.DisplayName) { $properties.DisplayName } else { $subKey.PSChildName }
                        Write-Host "       [PRECISE_CLEANUP] Found matching entry: $displayName" -ForegroundColor Green
                        Write-Host "       [PRECISE_CLEANUP] Registry key: $($subKey.PSPath)" -ForegroundColor Gray
                        Write-Host "       [PRECISE_CLEANUP] Matched properties: $($matchedProperties -join '; ')" -ForegroundColor Gray

                        $cleanupResults.EntriesFound++

                        # Attempt to remove the registry key
                        try {
                            Remove-Item $subKey.PSPath -Recurse -Force -ErrorAction Stop
                            Write-Host "       [PRECISE_CLEANUP] Successfully removed registry entry: $displayName" -ForegroundColor Green
                            $cleanupResults.EntriesRemoved++
                            $cleanupResults.LocationsCleaned += $subKey.PSPath
                        }
                        catch {
                            $errorMsg = "Failed to remove registry entry: $($subKey.PSPath) - $($_.Exception.Message)"
                            Write-Host "       [PRECISE_CLEANUP] $errorMsg" -ForegroundColor Red
                            $cleanupResults.Errors += $errorMsg
                        }
                    }

                }
                catch {
                    # Skip entries that can't be read
                    Write-Host "       [PRECISE_CLEANUP] Error reading registry entry: $($subKey.PSPath) - $($_.Exception.Message)" -ForegroundColor DarkGray
                    continue
                }
            }

        }
        catch {
            $errorMsg = "Error scanning registry path: $registryPath - $($_.Exception.Message)"
            Write-Host "       [PRECISE_CLEANUP] $errorMsg" -ForegroundColor Red
            $cleanupResults.Errors += $errorMsg
        }
    }

    Write-Host "       [PRECISE_CLEANUP] Precise registry cleanup completed - Found: $($cleanupResults.EntriesFound), Removed: $($cleanupResults.EntriesRemoved)" -ForegroundColor Cyan

    if ($cleanupResults.LocationsCleaned.Count -gt 0) {
        Write-Host "       [PRECISE_CLEANUP] Cleaned locations:" -ForegroundColor Gray
        foreach ($location in $cleanupResults.LocationsCleaned) {
            Write-Host "       - $location" -ForegroundColor Gray
        }
    }

    return $cleanupResults
}
