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

# Flutter Log Manager System
# Provides centralized logging with automatic log rotation
# Author: Development Script System
# Version: 1.0

# Variables declaration
$Global:MAX_LOG_LINES = 10000
$Global:LOG_BACKUP_LINES = 5000
$Global:DEFAULT_LOG_FILE = "flutter_bloom.log"

# Initialize logging system
function Initialize-LoggingSystem {
    <#
    .SYNOPSIS
    Initialize the logging system and create required directories

    .DESCRIPTION
    Creates log directory if it doesn't exist and initializes logging subsystem

    .RETURNS
    Boolean indicating success
    #>

    try {
        # Ensure log directory exists
        if (-not (Test-Path $Global:LOG_BASE_DIR)) {
            New-Item -Path $Global:LOG_BASE_DIR -ItemType Directory -Force | Out-Null
        }

        # Create default log file if it doesn't exist
        $defaultLogPath = Join-Path $Global:LOG_BASE_DIR $Global:DEFAULT_LOG_FILE
        if (-not (Test-Path $defaultLogPath)) {
            New-Item -Path $defaultLogPath -ItemType File -Force | Out-Null
        }

        return $true
    }
    catch {
        Write-Error "Failed to initialize logging system: $_"
        return $false
    }
}

# Write log entry with rotation management
function Write-LogEntry {
    <#
    .SYNOPSIS
    Write a log entry with automatic rotation

    .DESCRIPTION
    Writes a log entry to the specified log file with timestamp.
    Automatically rotates log when it exceeds maximum lines.

    .PARAMETER Message
    The message to log

    .PARAMETER LogFileName
    Name of the log file (defaults to flutter_bloom.log)

    .PARAMETER Level
    Log level (INFO, WARNING, ERROR, DEBUG)

    .PARAMETER Source
    Source of the log entry (script name, function name, etc.)

    .RETURNS
    Boolean indicating success
    #>

    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [string]$LogFileName = $Global:DEFAULT_LOG_FILE,

        [Parameter(Mandatory = $false)]
        [ValidateSet("INFO", "WARNING", "ERROR", "DEBUG")]
        [string]$Level = "INFO",

        [Parameter(Mandatory = $false)]
        [string]$Source = "SYSTEM"
    )

    try {
        # Ensure logging system is initialized
        if (-not (Initialize-LoggingSystem)) {
            return $false
        }

        $logPath = Join-Path $Global:LOG_BASE_DIR $LogFileName
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $logEntry = "[$timestamp] [$Level] [$Source] $Message"

        # Check if log rotation is needed
        if (Test-Path $logPath) {
            $lineCount = (Get-Content $logPath | Measure-Object -Line).Lines

            if ($lineCount -ge $Global:MAX_LOG_LINES) {
                Optimize-LogFile -LogPath $logPath
            }
        }

        # Append log entry
        Add-Content -Path $logPath -Value $logEntry -Encoding UTF8

        return $true
    }
    catch {
        Write-Error "Failed to write log entry: $_"
        return $false
    }
}

# Log rotation optimization
function Optimize-LogFile {
    <#
    .SYNOPSIS
    Optimize log file by removing old entries

    .DESCRIPTION
    Keeps only the most recent entries when log file exceeds maximum lines

    .PARAMETER LogPath
    Full path to the log file to optimize

    .RETURNS
    Boolean indicating success
    #>

    param(
        [Parameter(Mandatory = $true)]
        [string]$LogPath
    )

    try {
        if (-not (Test-Path $LogPath)) {
            return $true
        }

        # Read all lines
        $allLines = Get-Content $LogPath
        $totalLines = $allLines.Count

        if ($totalLines -le $Global:MAX_LOG_LINES) {
            return $true
        }

        # Keep only the most recent lines
        $keepLines = $totalLines - $Global:LOG_BACKUP_LINES
        $recentLines = $allLines[$keepLines..($totalLines - 1)]

        # Add optimization marker
        $optimizationMarker = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [INFO] [LOG-MANAGER] Log optimized - removed $keepLines old entries, kept $($recentLines.Count) recent entries"
        $finalLines = @($optimizationMarker) + $recentLines

        # Write optimized content back
        Set-Content -Path $LogPath -Value $finalLines -Encoding UTF8

        return $true
    }
    catch {
        Write-Error "Failed to optimize log file: $_"
        return $false
    }
}

# Enhanced logging functions with both console output and log file
function Write-LogInfo {
    <#
    .SYNOPSIS
    Write informational message to console and log

    .PARAMETER Message
    The message to log

    .PARAMETER Source
    Source of the log entry

    .PARAMETER LogFileName
    Name of the log file
    #>

    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [string]$Source = "INFO",

        [Parameter(Mandatory = $false)]
        [string]$LogFileName = $Global:DEFAULT_LOG_FILE
    )

    # Write to console
    Write-Host $Message -ForegroundColor Green

    # Write to log
    Write-LogEntry -Message $Message -Level "INFO" -Source $Source -LogFileName $LogFileName | Out-Null
}

function Write-LogWarning {
    <#
    .SYNOPSIS
    Write warning message to console and log

    .PARAMETER Message
    The message to log

    .PARAMETER Source
    Source of the log entry

    .PARAMETER LogFileName
    Name of the log file
    #>

    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [string]$Source = "WARNING",

        [Parameter(Mandatory = $false)]
        [string]$LogFileName = $Global:DEFAULT_LOG_FILE
    )

    # Write to console
    Write-Host $Message -ForegroundColor Yellow

    # Write to log
    Write-LogEntry -Message $Message -Level "WARNING" -Source $Source -LogFileName $LogFileName | Out-Null
}

function Write-LogError {
    <#
    .SYNOPSIS
    Write error message to console and log

    .PARAMETER Message
    The message to log

    .PARAMETER Source
    Source of the log entry

    .PARAMETER LogFileName
    Name of the log file
    #>

    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [string]$Source = "ERROR",

        [Parameter(Mandatory = $false)]
        [string]$LogFileName = $Global:DEFAULT_LOG_FILE
    )

    # Write to console
    Write-Host $Message -ForegroundColor Red

    # Write to log
    Write-LogEntry -Message $Message -Level "ERROR" -Source $Source -LogFileName $LogFileName | Out-Null
}

function Write-LogDebug {
    <#
    .SYNOPSIS
    Write debug message to console and log

    .PARAMETER Message
    The message to log

    .PARAMETER Source
    Source of the log entry

    .PARAMETER LogFileName
    Name of the log file
    #>

    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [string]$Source = "DEBUG",

        [Parameter(Mandatory = $false)]
        [string]$LogFileName = $Global:DEFAULT_LOG_FILE
    )

    # Write to console (only in debug mode)
    if ($Global:DEBUG_MODE) {
        Write-Host $Message -ForegroundColor Cyan
    }

    # Write to log
    Write-LogEntry -Message $Message -Level "DEBUG" -Source $Source -LogFileName $LogFileName | Out-Null
}

function Write-LogSuccess {
    <#
    .SYNOPSIS
    Write success message to console and log

    .PARAMETER Message
    The message to log

    .PARAMETER Source
    Source of the log entry

    .PARAMETER LogFileName
    Name of the log file
    #>

    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $false)]
        [string]$Source = "SUCCESS",

        [Parameter(Mandatory = $false)]
        [string]$LogFileName = $Global:DEFAULT_LOG_FILE
    )

    # Write to console
    Write-Host $Message -ForegroundColor Green

    # Write to log
    Write-LogEntry -Message $Message -Level "INFO" -Source $Source -LogFileName $LogFileName | Out-Null
}

function Write-LogHeader {
    <#
    .SYNOPSIS
    Write formatted header to console and log

    .PARAMETER Title
    The header title

    .PARAMETER Source
    Source of the log entry

    .PARAMETER LogFileName
    Name of the log file
    #>

    param(
        [Parameter(Mandatory = $true)]
        [string]$Title,

        [Parameter(Mandatory = $false)]
        [string]$Source = "HEADER",

        [Parameter(Mandatory = $false)]
        [string]$LogFileName = $Global:DEFAULT_LOG_FILE
    )

    $separator = "=" * 80
    $formattedTitle = $Title.ToUpper()

    # Write to console
    Write-Host $separator -ForegroundColor Cyan
    Write-Host $formattedTitle -ForegroundColor Cyan
    Write-Host $separator -ForegroundColor Cyan

    # Write to log
    Write-LogEntry -Message $separator -Level "INFO" -Source $Source -LogFileName $LogFileName | Out-Null
    Write-LogEntry -Message $formattedTitle -Level "INFO" -Source $Source -LogFileName $LogFileName | Out-Null
    Write-LogEntry -Message $separator -Level "INFO" -Source $Source -LogFileName $LogFileName | Out-Null
}

# Get log file information
function Get-LogFileInfo {
    <#
    .SYNOPSIS
    Get information about a log file

    .PARAMETER LogFileName
    Name of the log file

    .RETURNS
    Hashtable with log file information
    #>

    param(
        [Parameter(Mandatory = $false)]
        [string]$LogFileName = $Global:DEFAULT_LOG_FILE
    )

    try {
        $logPath = Join-Path $Global:LOG_BASE_DIR $LogFileName

        if (-not (Test-Path $logPath)) {
            return @{
                Exists = $false
                Path = $logPath
                Lines = 0
                Size = 0
                LastModified = $null
            }
        }

        $fileInfo = Get-Item $logPath
        $lineCount = (Get-Content $logPath | Measure-Object -Line).Lines

        return @{
            Exists = $true
            Path = $logPath
            Lines = $lineCount
            Size = $fileInfo.Length
            LastModified = $fileInfo.LastWriteTime
            SizeFormatted = "{0:N2} KB" -f ($fileInfo.Length / 1KB)
        }
    }
    catch {
        Write-Error "Failed to get log file info: $_"
        return $null
    }
}

# Functions are automatically available when dot-sourced