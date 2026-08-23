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

<#
.SYNOPSIS
    Compares and synchronizes files between two network shares with directory skipping.
.DESCRIPTION
    Recursively scans the configured primary share and checks the configured secondary share.
    Skips specified directories (node_modules, vendor) and provides detailed statistics.
.NOTES
    File Name      : FileSyncAdvanced.ps1
    Author         : Your Name
    Prerequisite   : PowerShell 5.1 or later
#>

# Import required modules
#Requires -Version 5.1

# Initialize counters
$script:totalFiles = 0
$script:copiedFiles = 0
$script:skippedFiles = 0
$script:errorFiles = 0
$script:skippedDirs = 0
$script:copiedBytes = 0
$script:skippedBytes = 0
$script:startTime = Get-Date
$script:skippedDirNames = @()
$script:processedFiles = 0
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptsDirectory = Split-Path -Parent $scriptDirectory
$serviceContractCommon = Join-Path $scriptsDirectory "shells\win\win_common\ServiceContract.ps1"

. $serviceContractCommon

# Network paths
$sourceHost = Get-ServiceContractHost -Name "lan_storage_primary"
$targetHost = Get-ServiceContractHost -Name "lan_storage_secondary"
$sourcePath = Join-Path -Path "\\" -ChildPath $sourceHost
$targetPath = Join-Path -Path "\\" -ChildPath $targetHost

# Directories to skip (case insensitive)
$skipDirectories = @("node_modules", "vendor", "bin", "obj", "packages", ".git", ".vs", ".idea")

# Function to get file size
function Get-FileSize {
    param (
        [string]$filePath
    )
    try {
        $file = Get-Item -Path $filePath -Force -ErrorAction Stop
        return $file.Length
    }
    catch {
        Write-Verbose "Error reading file size: $filePath"
        return $null
    }
}

# Function to check if path should be skipped
function Test-SkipPath {
    param (
        [string]$path
    )
    
    foreach ($dir in $skipDirectories) {
        if ($path -like "*\$dir\*" -or $path -like "*\$dir") {
            if (-not ($script:skippedDirNames -contains $dir)) {
                $script:skippedDirNames += $dir
            }
            return $true
        }
    }
    return $false
}

# Function to compare files
function Compare-Files {
    param (
        [string]$sourceFile,
        [string]$targetFile
    )
    
    $sourceSize = Get-FileSize -filePath $sourceFile
    if ($null -eq $sourceSize) {
        return $false
    }
    
    $targetSize = Get-FileSize -filePath $targetFile
    
    if (-not (Test-Path -Path $targetFile -PathType Leaf)) {
        return $false
    }
    
    return $sourceSize -eq $targetSize
}

# Function to copy file
function Copy-FileWithRetry {
    param (
        [string]$source,
        [string]$destination,
        [long]$fileSize
    )
    
    $retryCount = 0
    $maxRetries = 3
    $success = $false
    
    # Ensure target directory exists
    $targetDir = [System.IO.Path]::GetDirectoryName($destination)
    if (-not (Test-Path -Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    
    while (-not $success -and $retryCount -lt $maxRetries) {
        try {
            Copy-Item -Path $source -Destination $destination -Force -ErrorAction Stop
            $script:copiedBytes += $fileSize
            $success = $true
        }
        catch {
            $retryCount++
            if ($retryCount -ge $maxRetries) {
                Write-Verbose "Failed to copy file after $maxRetries attempts: $source"
                return $false
            }
            Start-Sleep -Seconds (1 * $retryCount)
        }
    }
    
    return $success
}

# Function to print progress
function Print-Progress {
    param (
        [string]$operation,
        [string]$filePath,
        [bool]$isSuccess,
        [long]$fileSize,
        [int]$currentCount,
        [int]$totalCount
    )
    
    $elapsed = (Get-Date) - $script:startTime
    $status = if ($isSuccess) { "SUCCESS" } else { "FAILED" }
    $percentComplete = ($currentCount / $totalCount) * 100
    
    # Calculate throughput
    $throughput = if ($elapsed.TotalSeconds -gt 0) {
        [math]::Round(($script:copiedBytes / 1MB) / $elapsed.TotalSeconds, 2)
    } else { 0 }
    
    # Format sizes
    $copiedGB = [math]::Round($script:copiedBytes / 1GB, 2)
    $skippedGB = [math]::Round($script:skippedBytes / 1GB, 2)
    
    # Clear current line and print updated status
    $host.UI.RawUI.CursorPosition = New-Object System.Management.Automation.Host.Coordinates 0 $host.UI.RawUI.CursorPosition.Y
    Write-Host ("[{0:HH:mm:ss}] {1} {2} - {3} ({4:0.00} MB) | Copied: {5:0.00} GB | Skipped: {6:0.00} GB | {7:0.0} MB/s | {8:0.0}% " -f `
        (Get-Date), $status, $operation, $filePath, ($fileSize / 1MB), $copiedGB, $skippedGB, $throughput, $percentComplete) -NoNewline
}

# Main synchronization function
function Sync-Files {
    param (
        [string]$sourceRoot,
        [string]$targetRoot
    )
    
    # Get all files recursively from source
    try {
        $sourceFiles = Get-ChildItem -Path $sourceRoot -Recurse -File -Force -ErrorAction Stop | 
                      Where-Object { -not (Test-SkipPath -path $_.FullName) }
    }
    catch {
        Write-Host "ERROR: Failed to enumerate source files: $_" -ForegroundColor Red
        exit 1
    }
    
    $script:totalFiles = $sourceFiles.Count
    $currentCount = 0
    
    foreach ($file in $sourceFiles) {
        $currentCount++
        $script:processedFiles = $currentCount
        $relativePath = $file.FullName.Substring($sourceRoot.Length)
        $targetFile = Join-Path -Path $targetRoot -ChildPath $relativePath
        
        try {
            if (Test-SkipPath -path $file.FullName) {
                $script:skippedDirs++
                continue
            }
            
            $fileSize = $file.Length
            
            if (Compare-Files -sourceFile $file.FullName -targetFile $targetFile) {
                $script:skippedFiles++
                $script:skippedBytes += $fileSize
                Print-Progress -operation "SKIPPED" -filePath $relativePath -isSuccess $true -fileSize $fileSize -currentCount $currentCount -totalCount $script:totalFiles
                continue
            }
            
            $copyResult = Copy-FileWithRetry -source $file.FullName -destination $targetFile -fileSize $fileSize
            
            if ($copyResult) {
                $script:copiedFiles++
                Print-Progress -operation "COPIED" -filePath $relativePath -isSuccess $true -fileSize $fileSize -currentCount $currentCount -totalCount $script:totalFiles
            }
            else {
                $script:errorFiles++
                Print-Progress -operation "COPY FAILED" -filePath $relativePath -isSuccess $false -fileSize $fileSize -currentCount $currentCount -totalCount $script:totalFiles
            }
        }
        catch {
            $script:errorFiles++
            Print-Progress -operation "ERROR PROCESSING" -filePath $relativePath -isSuccess $false -fileSize $fileSize -currentCount $currentCount -totalCount $script:totalFiles
            Write-Verbose "Error processing file: $_"
        }
    }
}

# Main execution
Write-Host "Starting file synchronization from $sourcePath to $targetPath"
Write-Host "Start time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Skipping directories: $($skipDirectories -join ', ')"
Write-Host "----------------------------------------"

Sync-Files -sourceRoot $sourcePath -targetRoot $targetPath

# Calculate total time
$endTime = Get-Date
$totalTime = $endTime - $script:startTime

# Format sizes
$copiedGB = [math]::Round($script:copiedBytes / 1GB, 2)
$skippedGB = [math]::Round($script:skippedBytes / 1GB, 2)
$totalGB = [math]::Round(($script:copiedBytes + $script:skippedBytes) / 1GB, 2)

# Print summary
Write-Host ""
Write-Host "----------------------------------------"
Write-Host "Synchronization completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Total processing time: $($totalTime.ToString('hh\:mm\:ss'))"
Write-Host "----------------------------------------"
Write-Host "Files Statistics:"
Write-Host "  Total files scanned: $($script:totalFiles)"
Write-Host "  Files copied: $($script:copiedFiles) ($copiedGB GB)"
Write-Host "  Files skipped: $($script:skippedFiles) ($skippedGB GB)"
Write-Host "  Files with errors: $($script:errorFiles)"
Write-Host "  Total processed: $($script:copiedFiles + $script:skippedFiles) ($totalGB GB)"
Write-Host ""
Write-Host "Directory Statistics:"
Write-Host "  Skipped directories: $($script:skippedDirs)"
Write-Host "  Skipped directory types: $($script:skippedDirNames -join ', ')"
Write-Host "----------------------------------------"
