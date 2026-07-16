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

param (
    [string]$action,
    [string]$param1,
    [string]$param2,
    [string]$param3,
    [switch]$SkipInit
)

$systemName = "win"
$osInfo = Get-CimInstance Win32_OperatingSystem
$winVer = $osInfo.Version
$winBuild = [int]$osInfo.BuildNumber

$Global:HAS_ADMIN_RIGHTS = $false
try {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    $Global:HAS_ADMIN_RIGHTS = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} catch {
    $Global:HAS_ADMIN_RIGHTS = $false
}

function Write-Log {
    param (
        [string]$message,
        [string]$color = "White"
    )
    Write-Host $message -ForegroundColor $color
}


if ($winBuild -ge 22000) {
    $systemName = "win11"
    $Global:isWin11 = $true
    $Global:isWin10 = $false
} elseif ($winVer.StartsWith("10.0")) {
    $systemName = "win10"
    $Global:isWin11 = $false
    $Global:isWin10 = $true
} elseif ($winVer.StartsWith("6.3")) {
    $systemName = "win_8"
    $Global:isWin11 = $false
    $Global:isWin10 = $false
} elseif ($winVer.StartsWith("6.2")) {
    $systemName = "win_8"
    $Global:isWin11 = $false
    $Global:isWin10 = $false
} elseif ($winVer.StartsWith("6.1")) {
    $systemName = "win_7"
    $Global:isWin11 = $false
    $Global:isWin10 = $false
} else {
    $systemName = "win"
    $Global:isWin11 = $false
    $Global:isWin10 = $false
}

$Global:LANG_COMPILER_DIR = "D:\.dev_$systemName"
$Global:WINENVS_DIR = ".winenvs"

# Load GlobalVars.ps1 to get PROJECT_DIR and INLINE_WINENVS_DIR
# This is needed when WindowsPathFunction.ps1 is called as a standalone script
$scriptDir = $PSScriptRoot
if ($scriptDir) {
    $globalVarsPath = Join-Path $scriptDir "GlobalVars.ps1"
    if (Test-Path $globalVarsPath) {
        . $globalVarsPath
    }
}

function Test-IsExecutableFile {
    param (
        [System.IO.FileInfo]$FileItem
    )
    
    # Check if the item is a file (not a directory)
    if ($FileItem.PSIsContainer) {
        return $false
    }
    
    # Check if the file extension matches supported executable formats
    $supportedExtensions = @('.exe', '.cmd', '.bat', '.ps1')
    $fileExtension = $FileItem.Extension.ToLower()
    
    return $supportedExtensions -contains $fileExtension
}

function Normalize-WindowsPath {
    param (
        [string]$p
    )
    if ([string]::IsNullOrWhiteSpace($p)) { return $null }
    $p = $p.Trim().Trim('"')
    $p = $p -replace '/', '\\'
    try { $p = [System.IO.Path]::GetFullPath($p) } catch {}
    if ($p -match '^[a-z]:\\') { $p = $p.Substring(0,1).ToUpper() + $p.Substring(1) }
    if ($p.Length -gt 3) { $p = $p.TrimEnd('\\') }
    return $p
}

function Build-CombinedNormalizedPath {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $segments = @()
    if ($userPath)   { $segments += ($userPath -split ';') }
    if ($machinePath){ $segments += ($machinePath -split ';') }
    $normalized = @()
    foreach ($seg in $segments) {
        $n = Normalize-WindowsPath $seg
        if ($n -and -not ($normalized -contains $n)) { $normalized += $n }
    }
    return ($normalized -join ';')
}

function Emit-CmdSetPath {
    param (
        [string]$combinedPath
    )
    # Output only the set command for CMD to consume
    Write-Output ('set "PATH={0}"' -f $combinedPath)
}

function Get-EffectiveEnvVar {
    param (
        [string]$varName
    )
    $userVal = [Environment]::GetEnvironmentVariable($varName, "User")
    if (-not [string]::IsNullOrEmpty($userVal)) { return $userVal }
    return [Environment]::GetEnvironmentVariable($varName, "Machine")
}

function Emit-CmdSetVar {
    param (
        [string]$varName,
        [string]$varValue
    )
    Write-Output ('set "{0}={1}"' -f $varName, $varValue)
}

function Write-RefreshBatch {
    $combined = Build-CombinedNormalizedPath
    $content  = @"
@echo off
set "PATH=$combined"
exit /b 0
"@
    $outFile  = Join-Path $env:TEMP "refresh_env.cmd"
    $enc = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($outFile, $content, $enc)
    Write-Log "Generated: $outFile" -color "Green"
}

function Write-RefreshAllVarsBatch {
    Write-Log "Refreshing all environment variables using batch script..." -color "Green"
    
    # Get all machine environment variables
    $machineVars = [Environment]::GetEnvironmentVariables("Machine")
    $userVars = [Environment]::GetEnvironmentVariables("User")
    
    # Build batch script content
    $batchContent = @"
@echo off
REM Auto-generated environment variables refresh script
REM Generated by WindowsPathFunction.ps1

"@
    
    # Add machine environment variables
    foreach ($var in $machineVars.GetEnumerator()) {
        $escapedValue = $var.Value -replace '"', '""'
        $batchContent += "`nset `"$($var.Key)=$escapedValue`""
    }
    
    # Add user environment variables (user vars override machine vars)
    foreach ($var in $userVars.GetEnumerator()) {
        $escapedValue = $var.Value -replace '"', '""'
        $batchContent += "`nset `"$($var.Key)=$escapedValue`""
    }
    
    $batchContent += "`n`nexit /b 0"
    
    # Write to temporary batch file
    $outFile = Join-Path $env:TEMP "refresh_all_env.cmd"
    $enc = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($outFile, $batchContent, $enc)
    
    Write-Log "Generated refresh script: $outFile" -color "Green"
    Write-Log "Executing refresh script..." -color "Green"
    
    # Execute the batch script
    try {
        & $outFile
        Write-Log "Environment variables refreshed successfully" -color "Green"
        
        # Clean up temporary file
        Remove-Item $outFile -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Log "Failed to execute refresh script: $($_.Exception.Message)" -color "Red"
    }
}


function Normalize-WindowsPath {
    param (
        [string]$p
    )
    if ([string]::IsNullOrWhiteSpace($p)) { return $null }
    $p = $p.Trim().Trim('"')
    $p = $p -replace '/', '\\'
    try {
        $p = [System.IO.Path]::GetFullPath($p)
    } catch {
        # keep original if GetFullPath fails
    }
    if ($p -match '^[a-z]:\\') { $p = $p.Substring(0,1).ToUpper() + $p.Substring(1) }
    if ($p.Length -gt 3) { $p = $p.TrimEnd('\') }
    return $p
}

function Backup-Environment {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "D:\.tmp\.GlobalEnv"
    $backupFile = "$backupDir\path_$timestamp.bak"

    try {
        if (-not (Test-Path $backupDir)) {
            New-Item -ItemType Directory -Path $backupDir -Force -ErrorAction Stop | Out-Null
            Write-Log "Created backup directory: $backupDir" -color "Yellow"
        }

        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        Set-Content -Path $backupFile -Value $currentPath -ErrorAction Stop
        Write-Log "Backup created at $backupFile" -color "Green"

        $backupFiles = @(Get-ChildItem -Path $backupDir -Filter "path_*.bak" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
        if ($backupFiles -and $backupFiles.Count -gt 100) {
            $filesToDelete = @($backupFiles | Select-Object -Skip 100)
            if ($filesToDelete -and $filesToDelete.Count -gt 0) {
                foreach ($file in $filesToDelete) {
                    Remove-Item -Path $file.FullName -Force -ErrorAction SilentlyContinue
                }
                Write-Log "Cleaned up $($filesToDelete.Count) old backup files, keeping the most recent 100" -color "Yellow"
            }
        }
    } catch {
        Write-Log "Failed to create backup: $($_.Exception.Message)" -color "Yellow"
    }
}

function Add-Path {
    param (
        [Alias('PathToAdd')]
        [string]$newPath
    )

    if (-not [string]::IsNullOrWhiteSpace($newPath)) {
        $normalizedPath = Normalize-WindowsPath $newPath
        if ($normalizedPath -and (Test-Path $normalizedPath -PathType Leaf)) {
            $parentDir = Split-Path $normalizedPath -Parent
            Write-Log "Detected file path, using parent directory: $parentDir" -color "Yellow"
            $newPath = $parentDir
        }
    }

    $newPath = Normalize-WindowsPath $newPath
    if (-not $newPath) { return }

    if (-not $Global:HAS_ADMIN_RIGHTS) {
        $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        $combinedPath = if ($userPath) { "$userPath;$machinePath" } else { $machinePath }
        if ($combinedPath -notlike "*$newPath*") {
            [Environment]::SetEnvironmentVariable("Path", "$newPath;$combinedPath", "Process")
        }
        Write-Log "Session PATH updated (admin required for permanent Machine PATH): $newPath" -color "Yellow"
        return
    }

    try {
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $paths = $currentPath -split ';'
        $pathsNormalized = $paths | ForEach-Object { Normalize-WindowsPath $_ } | Where-Object { $_ }

        if (-not ($pathsNormalized -contains $newPath)) {
            $pathsNormalized += $newPath
            $newPathString = ($pathsNormalized | Where-Object { $_ }) -join ';'
            Backup-Environment
            Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" -Name "Path" -Value $newPathString -ErrorAction Stop
            Write-Log "Added $newPath to PATH" -color "Green"
        } else {
            Write-Log "Path $newPath already exists" -color "Yellow"
        }

        # Always refresh current process PATH to ensure consistency (idempotent repair step)
        # This ensures that commands executed immediately after Add-Path can access the new PATH
        try {
            $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
            $combinedPath = if ($userPath) { "$userPath;$machinePath" } else { $machinePath }
            [Environment]::SetEnvironmentVariable("Path", $combinedPath, "Process")
        } catch {
            Write-Log "Warning: Failed to refresh current process PATH: $($_.Exception.Message)" -color "Yellow"
        }
    } catch {
        Write-Log "ERROR: Failed to add $newPath to PATH: $($_.Exception.Message)" -color "Red"
    }
}

function Remove-Path {
    param (
        [string]$pathToRemove
    )

    try {
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $paths = $currentPath -split ';'
        $normToRemove = Normalize-WindowsPath $pathToRemove
        $pathsNormalized = $paths | ForEach-Object { Normalize-WindowsPath $_ } | Where-Object { $_ }

        if ($pathsNormalized -contains $normToRemove) {
            $pathsNormalized = $pathsNormalized | Where-Object { $_ -ne $normToRemove }
            $newPathString = ($pathsNormalized | Where-Object { $_ }) -join ';'
            Backup-Environment
            Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" -Name "Path" -Value $newPathString -ErrorAction Stop
            Write-Log "Removed $normToRemove from PATH" -color "Green"
        } else {
            Write-Log "Path $normToRemove does not exist" -color "Yellow"
        }
    } catch {
        Write-Log "ERROR: Failed to remove $pathToRemove from PATH: $($_.Exception.Message)" -color "Red"
    }
}

function Is-Path {
    param (
        [string]$pathToCheck
    )
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $paths = $currentPath -split ';'
    $normToCheck = Normalize-WindowsPath $pathToCheck
    $pathsNormalized = $paths | ForEach-Object { Normalize-WindowsPath $_ } | Where-Object { $_ }
    return ($pathsNormalized -contains $normToCheck)
}

function Show-Path {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $paths = $currentPath -split ';'
    Write-Log "Current PATH entries:" -color "Cyan"
    $paths | ForEach-Object { Write-Log $_ }
}

function Get-EnvVar {
    param (
        [string]$varName
    )
    return [Environment]::GetEnvironmentVariable($varName, "Machine")
}

function Is-EnvVar {
    param (
        [string]$varName,
        [string]$varValue
    )
    $effective = Get-EffectiveEnvVar -varName $varName
    if ([string]::IsNullOrEmpty($varValue)) {
        return -not [string]::IsNullOrEmpty($effective)
    }
    return [string]::Equals($effective, $varValue, [System.StringComparison]::OrdinalIgnoreCase)
}

function Set-EnvVar {
    param (
        [string]$varName,
        [string]$varValue
    )

    try {
        Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" -Name $varName -Value $varValue -ErrorAction Stop
        Write-Log "Set $varName to $varValue" -color "Green"
    } catch {
        Write-Log "ERROR: Failed to set ${varName}: $($_.Exception.Message)" -color "Red"
    }
}

function Remove-EnvVar {
    param (
        [string]$varName
    )

    try {
        Remove-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" -Name $varName -ErrorAction Stop
        Write-Log "Removed $varName" -color "Green"
    } catch {
        Write-Log "WARNING: Failed to remove ${varName}: $($_.Exception.Message)" -color "Yellow"
    }
}

function Add-ExecutableToGlobalEnvs {
    param (
        [string]$exePath
    )
    
    # Ensure GlobalEnvs directory exists and is in PATH
    $globalEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
    if (-not (Test-Path $globalEnvsDir)) {
        New-Item -ItemType Directory -Path $globalEnvsDir -Force | Out-Null
        Write-Log "Created GlobalEnvs directory: $globalEnvsDir" -color "Yellow"
    }
    
    # Add GlobalEnvs directory to PATH if not already present
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $paths = $currentPath -split ';'
    $globalEnvsNormalized = Normalize-WindowsPath $globalEnvsDir
    $pathsNormalized = $paths | ForEach-Object { Normalize-WindowsPath $_ } | Where-Object { $_ }
    
    if (-not ($pathsNormalized -contains $globalEnvsNormalized)) {
        $pathsNormalized += $globalEnvsNormalized
        $newPathString = ($pathsNormalized | Where-Object { $_ }) -join ';'
        Backup-Environment
        Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" -Name "Path" -Value $newPathString
        Write-Log "Added GlobalEnvs directory to PATH: $globalEnvsDir" -color "Green"
    }
    
    # Process the executable path
    $exePathNormalized = Normalize-WindowsPath $exePath
    if (-not (Test-Path $exePathNormalized)) {
        Write-Log "Executable path does not exist: $exePathNormalized" -color "Red"
        return
    }
    
    $exeItem = Get-Item $exePathNormalized
    
    if ($exeItem.PSIsContainer) {
        # If it's a directory, process all executable files recursively
        Write-Log "Processing directory: $exePathNormalized" -color "Cyan"
        $executableFiles = Get-ChildItem -Path $exePathNormalized -Recurse -ErrorAction SilentlyContinue | Where-Object { 
            Test-IsExecutableFile -FileItem $_
        }
        foreach ($file in $executableFiles) {
            Create-SymbolicLinkForExecutable -executableFile $file -globalEnvsDir $globalEnvsDir
        }
    } else {
        # If it's a single file, process it directly
        if (Test-IsExecutableFile -FileItem $exeItem) {
            Create-SymbolicLinkForExecutable -executableFile $exeItem -globalEnvsDir $globalEnvsDir
        } else {
            Write-Log "File is not a supported executable format: $exePathNormalized (Supported: .exe, .cmd, .bat, .ps1)" -color "Yellow"
        }
    }
}

function Create-SymbolicLinkForExecutable {
    param (
        [System.IO.FileInfo]$executableFile,
        [string]$globalEnvsDir
    )
    
    $linkName = $executableFile.Name
    $linkPath = Join-Path $globalEnvsDir $linkName
    
    # Remove existing link if it exists
    if (Test-Path $linkPath) {
        try {
            Remove-Item -Path $linkPath -Force -ErrorAction Stop
            Write-Log "Removed existing link: $linkPath" -color "Yellow"
        } catch {
            Write-Log "Failed to remove existing link: $linkPath" -color "Red"
            return
        }
    }
    
    # Create symbolic link
    try {
        New-Item -ItemType SymbolicLink -Path $linkPath -Target $executableFile.FullName -Force | Out-Null
            Write-Log "Created symbolic link: $linkName -> $($executableFile.FullName)" -color "Green"
    } catch {
        Write-Log "Failed to create symbolic link for $linkName" -color "Red"
    }
}

function Add-FileToWinEnvs {
    param (
        [string]$filePath
    )
    
    # Ensure .winenvs directory exists
    $winEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
    if (-not (Test-Path $winEnvsDir)) {
        New-Item -ItemType Directory -Path $winEnvsDir -Force | Out-Null
        Write-Log "Created $Global:WINENVS_DIR directory: $winEnvsDir" -color "Yellow"
    }
    
    # Process the file path
    $filePathNormalized = Normalize-WindowsPath $filePath
    if (-not (Test-Path $filePathNormalized)) {
        Write-Log "File path does not exist: $filePathNormalized" -color "Red"
        return
    }
    
    $fileItem = Get-Item $filePathNormalized
    
    if ($fileItem.PSIsContainer) {
        # If it's a directory, process all executable files recursively
        Write-Log "Processing directory: $filePathNormalized" -color "Cyan"
        $executableFiles = Get-ChildItem -Path $filePathNormalized -Recurse -ErrorAction SilentlyContinue | Where-Object { 
            Test-IsExecutableFile -FileItem $_
        }
        foreach ($file in $executableFiles) {
            Copy-FileToWinEnvs -file $file -winEnvsDir $winEnvsDir
        }
    } else {
        # If it's a single file, process it directly if it's executable
        if (Test-IsExecutableFile -FileItem $fileItem) {
            Copy-FileToWinEnvs -file $fileItem -winEnvsDir $winEnvsDir
        } else {
            Write-Log "File is not a supported executable format: $filePathNormalized (Supported: .exe, .cmd, .bat, .ps1)" -color "Yellow"
        }
    }

    # Ensure .winenvs is on PATH and refresh environment after adding
    try {
        $globalEnvsNormalized = Normalize-WindowsPath $winEnvsDir
        Add-Path -newPath $globalEnvsNormalized
        Write-RefreshAllVarsBatch
    } catch {
        Write-Log "Failed to update PATH/refresh environment: $($_.Exception.Message)" -color "Yellow"
    }
}

function Copy-FileToWinEnvs {
    param (
        [System.IO.FileInfo]$file,
        [string]$winEnvsDir
    )
    
    $fileName = $file.Name
    $targetPath = Join-Path $winEnvsDir $fileName
    
    # Remove existing file if it exists
    if (Test-Path $targetPath) {
        try {
            Remove-Item -Path $targetPath -Force -ErrorAction Stop
            Write-Log "Removed existing file: $targetPath" -color "Yellow"
        } catch {
            Write-Log "Failed to remove existing file: $targetPath" -color "Red"
            return
        }
    }
    
    # Copy file to .winenvs directory
    try {
        Copy-Item -Path $file.FullName -Destination $targetPath -Force
        Write-Log "Copied file to .winenvs: $fileName -> $targetPath" -color "Green"
    } catch {
        Write-Log "Failed to copy file $fileName to .winenvs: $($_.Exception.Message)" -color "Red"
    }
}

function Add-ScriptContentToWinEnvs {
    param (
        [string]$Content,
        [string]$FileName
    )
    
    # Ensure .winenvs directory exists
    $winEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
    if (-not (Test-Path $winEnvsDir)) {
        New-Item -ItemType Directory -Path $winEnvsDir -Force | Out-Null
        Write-Log "Created $Global:WINENVS_DIR directory: $winEnvsDir" -color "Yellow"
    }
    
    # Validate parameters
    if ([string]::IsNullOrWhiteSpace($Content)) {
        Write-Log "Content cannot be empty" -color "Red"
        return
    }
    
    if ([string]::IsNullOrWhiteSpace($FileName)) {
        Write-Log "FileName cannot be empty" -color "Red"
        return
    }
    
    # Ensure filename has proper extension
    if (-not $FileName.EndsWith('.bat') -and -not $FileName.EndsWith('.ps1') -and -not $FileName.EndsWith('.cmd')) {
        $FileName = $FileName + '.bat'
    }
    
    $targetPath = Join-Path $winEnvsDir $FileName
    
    # DEBUG: Print target information
    Write-Log "DEBUG: Target directory: $winEnvsDir" -color "Cyan"
    Write-Log "DEBUG: Target file path: $targetPath" -color "Cyan"
    Write-Log "DEBUG: File name: $FileName" -color "Cyan"
    Write-Log "DEBUG: Content length: $($Content.Length) characters" -color "Cyan"
    
    # Check if file already exists
    if (Test-Path $targetPath) {
        Write-Log "File already exists: $FileName" -color "Yellow"
        Write-Log "Replacing existing file..." -color "Yellow"
        
        try {
            Remove-Item -Path $targetPath -Force -ErrorAction Stop
            Write-Log "Removed existing file: $targetPath" -color "Yellow"
        } catch {
            Write-Log "Failed to remove existing file: $($_.Exception.Message)" -color "Red"
            return
        }
    }
    
    # Write content to file
    try {
        $Content | Out-File -FilePath $targetPath -Encoding ASCII -Force
        Write-Log "Script content written to .winenvs: $FileName -> $targetPath" -color "Green"
        
        # DEBUG: Verify file was created
        if (Test-Path $targetPath) {
            $fileSize = (Get-Item $targetPath).Length
            Write-Log "DEBUG: File verification SUCCESS - Size: $fileSize bytes" -color "Cyan"
        } else {
            Write-Log "DEBUG: File verification FAILED - File not found" -color "Red"
        }
    } catch {
        Write-Log "Failed to write script content to .winenvs: $($_.Exception.Message)" -color "Red"
    }

    # Ensure .winenvs is on PATH and refresh environment after writing
    try {
        $globalEnvsNormalized = Normalize-WindowsPath $winEnvsDir
        Add-Path -newPath $globalEnvsNormalized
        Write-RefreshAllVarsBatch
    } catch {
        Write-Log "Failed to update PATH/refresh environment: $($_.Exception.Message)" -color "Yellow"
    }
}

# Ensure project directories are appended to PATH so dd.cmd and winenv scripts are globally accessible.
function Set-CoreNodePaths {
    $pathsToAdd = @()

    if ($Global:PROJECT_DIR) {
        $pathsToAdd += (Normalize-WindowsPath $Global:PROJECT_DIR)
        $pathsToAdd += (Normalize-WindowsPath (Join-Path $Global:PROJECT_DIR "scripts"))
        $pathsToAdd += (Normalize-WindowsPath (Join-Path $Global:PROJECT_DIR "scripts\winenvs"))
    }

    if ($Global:CORE_NODE_DIR -and $Global:CORE_NODE_DIR -ne $Global:PROJECT_DIR) {
        $pathsToAdd += (Normalize-WindowsPath $Global:CORE_NODE_DIR)
    }

    $pathsToAdd = $pathsToAdd | Where-Object { $_ }
    foreach ($pathToAdd in $pathsToAdd) {
        Add-Path -newPath $pathToAdd
    }
}

# DEPRECATED: Ensure-InlineWinEnvsDir is no longer used
# We now simply add PROJECT_DIR to PATH instead of managing separate inline/global directories
function Ensure-InlineWinEnvsDir {
    Write-Log "Ensure-InlineWinEnvsDir is deprecated. PROJECT_DIR is added to PATH instead." -color "Yellow"
    return
}

function Copy-ItemToInline {
    param (
        [System.IO.FileInfo]$item
    )
    $targetPath = Join-Path $Global:INLINE_WINENVS_DIR $item.Name
    if (Test-Path $targetPath) {
        Remove-Item -Path $targetPath -Force -ErrorAction SilentlyContinue | Out-Null
    }
    try {
        Copy-Item -Path $item.FullName -Destination $targetPath -Force
        Write-Log "File added to inline: $($item.Name) -> $targetPath" -color "Green"
    } catch {
        Write-Log "Failed to copy: $($_.Exception.Message)" -color "Red"
    }
}

function Link-ExecToInline {
    param (
        [System.IO.FileInfo]$item
    )
    $targetPath = Join-Path $Global:INLINE_WINENVS_DIR $item.Name
    if (Test-Path $targetPath) {
        Remove-Item -Path $targetPath -Force -ErrorAction SilentlyContinue | Out-Null
    }
    try {
        New-Item -ItemType SymbolicLink -Path $targetPath -Target $item.FullName -Force | Out-Null
        Write-Log "Symbolic link created: $($item.Name) -> $($item.FullName)" -color "Green"
    } catch {
        Write-Log "Failed to create link: $($_.Exception.Message)" -color "Red"
    }
}

function Add-FileToInline {
    param ([string]$filePath)
    Ensure-InlineWinEnvsDir
    $pathNormalized = Normalize-WindowsPath $filePath
    if (-not (Test-Path $pathNormalized)) {
        Write-Log "Path does not exist: $pathNormalized" -color "Red"
        return
    }
    $item = Get-Item $pathNormalized
    if ($item.PSIsContainer) {
        Get-ChildItem -Path $pathNormalized -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { Copy-ItemToInline -item $_ }
    } else {
        Copy-ItemToInline -item $item
    }
}

function Add-ExecToInline {
    param ([string]$execPath)
    Ensure-InlineWinEnvsDir
    $pathNormalized = Normalize-WindowsPath $execPath
    if (-not (Test-Path $pathNormalized)) {
        Write-Log "Path does not exist: $pathNormalized" -color "Red"
        return
    }
    $item = Get-Item $pathNormalized
    if ($item.PSIsContainer) {
        Get-ChildItem -Path $pathNormalized -Recurse -ErrorAction SilentlyContinue | Where-Object { Test-IsExecutableFile -FileItem $_ } | ForEach-Object { Link-ExecToInline -item $_ }
    } else {
        if (Test-IsExecutableFile -FileItem $item) {
            Link-ExecToInline -item $item
        } else {
            Write-Log "Not an executable: $pathNormalized" -color "Red"
        }
    }
}

Set-Alias -Name Add-ScriptToInline -Value Add-FileToInline

# DEPRECATED: Sync-InlineToGlobal is no longer used
# We now simply add PROJECT_DIR to PATH instead of creating symlinks
# This simplifies the architecture and avoids issues with:
# - WSL/Linux reserved filenames (nul, CON, PRN, etc.)
# - Complex sync logic and symlink management
# - File conflicts between projects
function Sync-InlineToGlobal {
    param([switch]$Force)

    Write-Log "Sync-InlineToGlobal is deprecated." -color "Yellow"
    Write-Log "PROJECT_DIR is now added to PATH directly - no sync needed." -color "Green"
    Write-Log "Scripts in project directory are automatically available from anywhere." -color "Green"
    return
}

# Ensure .winenvs exists in Machine PATH before executing any action (after all functions are defined)
# Only run initialization if -SkipInit is not specified
if (-not $SkipInit) {
    Write-Log "Initializing WindowsPathFunction..." -color "Cyan"

    if (-not $Global:HAS_ADMIN_RIGHTS) {
        Write-Log "WindowsPathFunction initialization complete (session only; admin required for Machine PATH)" -color "Yellow"
    } else {
        try {
            $winEnvsDirGuard = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
            $winEnvsNormGuard = Normalize-WindowsPath $winEnvsDirGuard
            if ($winEnvsNormGuard) {
                Add-Path -newPath $winEnvsNormGuard
            }
        } catch {
            Write-Log "Failed to add .winenvs to PATH: $($_.Exception.Message)" -color "Red"
        }

        try {
            $inlineWinEnvsDirGuard = $Global:INLINE_WINENVS_DIR
            $inlineWinEnvsNormGuard = Normalize-WindowsPath $inlineWinEnvsDirGuard
            if ($inlineWinEnvsNormGuard) {
                Add-Path -newPath $inlineWinEnvsNormGuard
            }
        } catch {
            Write-Log "Failed to add inline winenvs to PATH: $($_.Exception.Message)" -color "Red"
        }

        Write-Log "WindowsPathFunction initialization complete" -color "Green"
    }
} else {
    Write-Log "WindowsPathFunction initialization skipped (SkipInit flag)" -color "Gray"
}

# Main logic (skip when dot-sourced without an explicit action)
if (-not [string]::IsNullOrWhiteSpace($action)) {
switch ($action) {
    "init" {
        # Explicit initialization action
        Write-Log "Initialization already performed during script load" -color "Green"
    }
    "add" {
        Add-Path -newPath $param1
    }
    "remove" {
        Remove-Path -pathToRemove $param1
    }
    "is" {
        $exists = Is-Path -pathToCheck $param1
        Write-Log $exists
    }
    "show" {
        Show-Path
    }
    "refresh" {
        $combined = Build-CombinedNormalizedPath
        Emit-CmdSetPath -combinedPath $combined
    }
    "refresh-bat" {
        Write-RefreshBatch
    }
    "refreshvar" {
        # Refresh all environment variables using batch script approach
        Write-RefreshAllVarsBatch
    }
    "get" {
        # DEPRECATED: For compatibility only. Use getvar or getpath instead.
        Write-Log "WARNING: 'get' is deprecated. Use 'getvar' for environment variables or 'getpath' for PATH." -color "Yellow"
        $value = Get-EnvVar -varName $param1
        if ($value) {
            Write-Log "$param1=$value"
        } else {
            Write-Log "Variable $param1 not found" -color "Yellow"
        }
    }
    "getvar" {
        # Get environment variable value
        # param1 = variable name
        if ([string]::IsNullOrWhiteSpace($param1)) {
            Write-Log "Variable name is required for getvar" -color "Red"
            return $null
        } else {
            $value = Get-EnvVar -varName $param1
            if ($value) {
                Write-Log "$param1=$value"
                return $value
            } else {
                Write-Log "Variable $param1 not found" -color "Yellow"
                return $null
            }
        }
    }
    "getpath" {
        # Get PATH environment variable
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        Write-Log "Current PATH:"
        $paths = $currentPath -split ';'
        foreach ($p in $paths) {
            if (-not [string]::IsNullOrWhiteSpace($p)) {
                Write-Log "  $p"
            }
        }
    }
    "getvars" {
        # Get all environment variables
        Write-Log "All Environment Variables:"
        $envVars = [Environment]::GetEnvironmentVariables("Machine")
        foreach ($var in $envVars.GetEnumerator()) {
            Write-Log "$($var.Key)=$($var.Value)"
        }
    }
    "isvar" {
        $exists = Is-EnvVar -varName $param1 -varValue $param2
        Write-Log $exists
    }
    "setvar" {
        # param1 = variable name, param2 = variable value
        if ([string]::IsNullOrWhiteSpace($param1)) {
            Write-Log "Variable name is required for setvar" -color "Red"
        } else {
            Set-EnvVar -varName $param1 -varValue $param2
        }
    }
    "removevar" {
        Remove-EnvVar -varName $param1
    }
    "delvar" {
        # Delete environment variable (alias for removevar)
        if ([string]::IsNullOrWhiteSpace($param1)) {
            Write-Log "Variable name is required for delvar" -color "Red"
        } else {
            Remove-EnvVar -varName $param1
        }
    }
    "addexec" {
        if ([string]::IsNullOrWhiteSpace($param1)) {
            Write-Log "Executable path is required for addexec" -color "Red"
        } else {
            Add-ExecutableToGlobalEnvs -exePath $param1
        }
    }
    "addfile" {
        if ([string]::IsNullOrWhiteSpace($param1)) {
            Write-Log "File path is required for addfile" -color "Red"
        } else {
            Add-FileToWinEnvs -filePath $param1
        }
    }
    "addscript" {
        if ([string]::IsNullOrWhiteSpace($param1) -or [string]::IsNullOrWhiteSpace($param2)) {
            Write-Log "Content and filename are required for addscript" -color "Red"
            Write-Log "Usage: addscript <content> <filename>" -color "Yellow"
        } else {
            Add-ScriptContentToWinEnvs -Content $param1 -FileName $param2
        }
    }
    "inlineaddscript" {
        if ([string]::IsNullOrWhiteSpace($param1)) {
            Write-Log "Script path is required" -color "Red"
        } else {
            Add-FileToInline -filePath $param1
        }
    }
    "inlineaddfile" {
        if ([string]::IsNullOrWhiteSpace($param1)) {
            Write-Log "File path is required" -color "Red"
        } else {
            Add-FileToInline -filePath $param1
        }
    }
    "inlineaddexec" {
        if ([string]::IsNullOrWhiteSpace($param1)) {
            Write-Log "Executable path is required" -color "Red"
        } else {
            Add-ExecToInline -execPath $param1
        }
    }
    "setcorepaths" {
        Set-CoreNodePaths
    }
    "sync" {
        if ($param1 -eq "-Force" -or $param1 -eq "force") {
            Sync-InlineToGlobal -Force
        } else {
            Sync-InlineToGlobal
        }
    }
    "help" {
        Write-Log "Invalid action. Available actions:" -color "Red"
        Write-Log "  Initialization:" -color "Yellow"
        Write-Log "    -SkipInit switch              - Skip initialization when loading script" -color "White"
        Write-Log "  PATH Management:" -color "Yellow"
        Write-Log "    add <path>                    - Add directory to system PATH (auto-detects file paths)" -color "White"
        Write-Log "    remove <path>                 - Remove directory from system PATH" -color "White"
        Write-Log "    is <path>                     - Check if directory exists in PATH" -color "White"
        Write-Log "    show                          - Display current PATH entries" -color "White"
        Write-Log "  Environment Variables:" -color "Yellow"
        Write-Log "    setvar <varName> <varValue>   - Set environment variable" -color "White"
        Write-Log "    getvar <varName>              - Get environment variable value" -color "White"
        Write-Log "    getvars                       - Get all environment variables" -color "White"
        Write-Log "    getpath                       - Get PATH environment variable" -color "White"
        Write-Log "    get <varName>                 - Get environment variable (DEPRECATED)" -color "Gray"
        Write-Log "    isvar <varName> <varValue>    - Check if variable equals value" -color "White"
        Write-Log "    removevar <varName>           - Remove environment variable" -color "White"
        Write-Log "    delvar <varName>              - Delete environment variable (alias for removevar)" -color "White"
        Write-Log "  Refresh Operations:" -color "Yellow"
        Write-Log "    refresh                       - Output PATH for CMD consumption" -color "White"
        Write-Log "    refresh-bat                   - Generate refresh batch file" -color "White"
        Write-Log "    refreshvar                    - Refresh all environment variables using batch script" -color "White"
        Write-Log "  File Management:" -color "Yellow"
        Write-Log "    addexec <exePath>              - Add executable via symbolic links to external .winenvs" -color "White"
        Write-Log "    addfile <filePath>             - Copy file to external .winenvs directory" -color "White"
        Write-Log "    addscript <content> <filename> - Write script content to external .winenvs directory" -color "White"
        Write-Log "  Inline File Management (version-controlled):" -color "Yellow"
        Write-Log "    inlineaddscript <scriptPath>   - Add script to inline winenvs (travels with code)" -color "White"
        Write-Log "    inlineaddfile <filePath>       - Add file to inline winenvs (travels with code)" -color "White"
        Write-Log "    inlineaddexec <execPath>       - Add executable to inline winenvs (travels with code)" -color "White"
        Write-Log "  Synchronization:" -color "Yellow"
        Write-Log "    sync                           - Sync scripts from inline winenvs to global .winenvs (smart link)" -color "White"
        Write-Log "    sync force                     - Force sync all scripts (recreate all links)" -color "White"
        Write-Log "  Examples:" -color "Yellow"
        Write-Log "    .\WindowsPathFunction.ps1 add 'C:\Program Files\Git\bin'" -color "Cyan"
        Write-Log "    .\WindowsPathFunction.ps1 add 'C:\Program Files\Git\cmd\git.exe'  # Auto-detects file" -color "Cyan"
        Write-Log "    .\WindowsPathFunction.ps1 setvar 'JAVA_HOME' 'C:\Program Files\Java\jdk-11'" -color "Cyan"
        Write-Log "    .\WindowsPathFunction.ps1 addexec 'C:\Program Files\Git\bin'" -color "Cyan"
        Write-Log "    .\WindowsPathFunction.ps1 addscript '@echo off\necho Hello' 'test.bat'" -color "Cyan"
    }
    default {
        Write-Log "Use WindowsPathFunction.ps1 v1.0.0; help ?" -color "Green"
    }
}
}


