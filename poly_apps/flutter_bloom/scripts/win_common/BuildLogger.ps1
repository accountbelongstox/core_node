# Build Logger Helper Functions
# Provides logging functionality for build scripts
# Author: Development Script System
# Version: 1.0

# Global log file path
$Global:BUILD_LOG_FILE = $null

function Initialize-BuildLogger {
    <#
    .SYNOPSIS
    Initialize build logger with log file path

    .PARAMETER LogFilePath
    Path to the log file

    .RETURNS
    True if successful
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$LogFilePath
    )

    try {
        $Global:BUILD_LOG_FILE = $LogFilePath

        # Ensure parent directory exists
        $logDir = Split-Path -Parent $LogFilePath
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }

        # Create or clear log file
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $header = @"
========================================
Build Log Initialized: $timestamp
========================================

"@
        Set-Content -Path $LogFilePath -Value $header -Encoding UTF8

        return $true
    }
    catch {
        Write-Warning "[LOGGER] Failed to initialize build logger: $_"
        return $false
    }
}

function Write-BuildLog {
    <#
    .SYNOPSIS
    Write message to both console and log file

    .PARAMETER Message
    Message to log

    .PARAMETER Color
    Console foreground color

    .PARAMETER NoNewline
    Do not add newline after message

    .PARAMETER LogOnly
    Only write to log file, not to console
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,

        [Parameter(Mandatory=$false)]
        [string]$Color = "White",

        [Parameter(Mandatory=$false)]
        [switch]$NoNewline,

        [Parameter(Mandatory=$false)]
        [switch]$LogOnly
    )

    # Write to console unless LogOnly
    if (-not $LogOnly) {
        if ($NoNewline) {
            Write-Host $Message -ForegroundColor $Color -NoNewline
        } else {
            Write-Host $Message -ForegroundColor $Color
        }
    }

    # Write to log file if initialized
    if ($Global:BUILD_LOG_FILE) {
        try {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
            $logLine = "[$timestamp] $Message"
            Add-Content -Path $Global:BUILD_LOG_FILE -Value $logLine -Encoding UTF8
        }
        catch {
            # Silently fail if log write fails
        }
    }
}

function Write-BuildLogSuccess {
    <#
    .SYNOPSIS
    Write success message to log

    .PARAMETER Message
    Success message
    #>

    param([string]$Message)
    Write-BuildLog -Message "[SUCCESS] $Message" -Color Green
}

function Write-BuildLogInfo {
    <#
    .SYNOPSIS
    Write info message to log

    .PARAMETER Message
    Info message
    #>

    param([string]$Message)
    Write-BuildLog -Message "[INFO] $Message" -Color Cyan
}

function Write-BuildLogWarning {
    <#
    .SYNOPSIS
    Write warning message to log

    .PARAMETER Message
    Warning message
    #>

    param([string]$Message)
    Write-BuildLog -Message "[WARNING] $Message" -Color Yellow
}

function Write-BuildLogError {
    <#
    .SYNOPSIS
    Write error message to log

    .PARAMETER Message
    Error message
    #>

    param([string]$Message)
    Write-BuildLog -Message "[ERROR] $Message" -Color Red
}

function Close-BuildLogger {
    <#
    .SYNOPSIS
    Close build logger and write footer
    #>

    if ($Global:BUILD_LOG_FILE) {
        try {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $footer = @"

========================================
Build Log Closed: $timestamp
========================================
"@
            Add-Content -Path $Global:BUILD_LOG_FILE -Value $footer -Encoding UTF8
        }
        catch {
            # Silently fail
        }
    }
}
