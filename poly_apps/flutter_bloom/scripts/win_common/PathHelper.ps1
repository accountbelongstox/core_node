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
Path Helper Module for PowerShell
Unified path handling utilities for the Flutter Bloom build system

.DESCRIPTION
Provides consistent path normalization and manipulation functions
Ensures paths work correctly across PowerShell and Python interop
#>

function Normalize-PathForPowerShell {
    <#
    .SYNOPSIS
    Normalize path for PowerShell execution

    .DESCRIPTION
    PowerShell accepts both backslashes and forward slashes,
    but forward slashes are safer for avoiding escape issues

    .PARAMETER Path
    Input path to normalize

    .EXAMPLE
    Normalize-PathForPowerShell "C:\Users\Test\file.txt"
    # Returns: C:/Users/Test/file.txt
    #>

    param(
        [Parameter(Mandatory=$false)]
        [string]$Path = ""
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    # Replace multiple backslashes with single forward slash
    $normalizedPath = $Path -replace '\\+', '/'

    # Replace multiple forward slashes with single forward slash
    $normalizedPath = $normalizedPath -replace '/+', '/'

    # Remove leading slash if it's not a UNC path (//server/share)
    if ($normalizedPath.StartsWith('/') -and -not $normalizedPath.StartsWith('//')) {
        $normalizedPath = $normalizedPath.Substring(1)
    }

    return $normalizedPath
}

function Normalize-PathForWindows {
    <#
    .SYNOPSIS
    Normalize path for Windows file system operations

    .PARAMETER Path
    Input path to normalize

    .EXAMPLE
    Normalize-PathForWindows "C:/Users/Test/file.txt"
    # Returns: C:\Users\Test\file.txt
    #>

    param(
        [Parameter(Mandatory=$false)]
        [string]$Path = ""
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    # Replace multiple forward slashes with single backslash
    $normalizedPath = $Path -replace '/+', '\'

    # Replace multiple backslashes with single backslash
    $normalizedPath = $normalizedPath -replace '\\+', '\'

    return $normalizedPath
}

function Normalize-PathForFlutter {
    <#
    .SYNOPSIS
    Normalize path for Flutter command-line arguments

    .DESCRIPTION
    Flutter accepts forward slashes on all platforms

    .PARAMETER Path
    Input path to normalize

    .EXAMPLE
    Normalize-PathForFlutter "lib\apps\app_wuy\main.dart"
    # Returns: lib/apps/app_wuy/main.dart
    #>

    param(
        [Parameter(Mandatory=$false)]
        [string]$Path = ""
    )

    return Normalize-PathForPowerShell -Path $Path
}

function ConvertTo-AbsolutePath {
    <#
    .SYNOPSIS
    Convert relative path to absolute path

    .PARAMETER Path
    Input path (can be relative or absolute)

    .PARAMETER BaseDir
    Base directory for relative paths (default: current location)

    .EXAMPLE
    ConvertTo-AbsolutePath -Path "build\output" -BaseDir "C:\Projects\MyApp"
    # Returns: C:\Projects\MyApp\build\output
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,

        [Parameter(Mandatory=$false)]
        [string]$BaseDir = ""
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    # Check if already absolute
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    # Use provided base directory or current location
    $base = if ($BaseDir) { $BaseDir } else { Get-Location }

    # Join and resolve path
    return Join-Path $base $Path | Resolve-Path -ErrorAction SilentlyContinue
}

function ConvertTo-RelativePath {
    <#
    .SYNOPSIS
    Convert absolute path to relative path

    .PARAMETER Path
    Input absolute path

    .PARAMETER BaseDir
    Base directory to calculate relative path from

    .EXAMPLE
    ConvertTo-RelativePath -Path "C:\Projects\MyApp\build\output" -BaseDir "C:\Projects\MyApp"
    # Returns: build\output
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,

        [Parameter(Mandatory=$true)]
        [string]$BaseDir
    )

    if ([string]::IsNullOrWhiteSpace($Path) -or [string]::IsNullOrWhiteSpace($BaseDir)) {
        return ""
    }

    try {
        # Use Push-Location to establish base, then resolve relative path
        Push-Location $BaseDir
        $relativePath = Resolve-Path -Relative $Path -ErrorAction Stop
        Pop-Location
        return $relativePath
    }
    catch {
        Pop-Location
        return $Path
    }
}

function Add-TrailingSlash {
    <#
    .SYNOPSIS
    Ensure path ends with a separator

    .PARAMETER Path
    Input path

    .PARAMETER Separator
    Separator to use (default: forward slash)

    .EXAMPLE
    Add-TrailingSlash -Path "C:/Users/Test"
    # Returns: C:/Users/Test/
    #>

    param(
        [Parameter(Mandatory=$false)]
        [string]$Path = "",

        [Parameter(Mandatory=$false)]
        [string]$Separator = '/'
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    if (-not $Path.EndsWith($Separator)) {
        return $Path + $Separator
    }

    return $Path
}

function Remove-TrailingSlash {
    <#
    .SYNOPSIS
    Remove trailing slashes from path

    .PARAMETER Path
    Input path

    .EXAMPLE
    Remove-TrailingSlash -Path "C:/Users/Test/"
    # Returns: C:/Users/Test
    #>

    param(
        [Parameter(Mandatory=$false)]
        [string]$Path = ""
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    # Remove trailing slashes (both / and \)
    while ($Path.Length -gt 0 -and ($Path[-1] -eq '/' -or $Path[-1] -eq '\')) {
        $Path = $Path.Substring(0, $Path.Length - 1)
    }

    return $Path
}

function Join-PathSafe {
    <#
    .SYNOPSIS
    Join multiple path components safely

    .PARAMETER Paths
    Path components to join

    .PARAMETER ForPowerShell
    If true, normalize for PowerShell (default: true)

    .EXAMPLE
    Join-PathSafe -Paths @('C:/Users', 'Test', 'Documents', 'file.txt')
    # Returns: C:/Users/Test/Documents/file.txt
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string[]]$Paths,

        [Parameter(Mandatory=$false)]
        [bool]$ForPowerShell = $true
    )

    if ($null -eq $Paths -or $Paths.Count -eq 0) {
        return ""
    }

    # Filter out empty paths
    $validPaths = $Paths | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    if ($validPaths.Count -eq 0) {
        return ""
    }

    # Join paths
    $joined = $validPaths[0]
    for ($i = 1; $i -lt $validPaths.Count; $i++) {
        $joined = Join-Path $joined $validPaths[$i]
    }

    if ($ForPowerShell) {
        return Normalize-PathForPowerShell -Path $joined
    }
    else {
        return $joined
    }
}

function Get-ParentPath {
    <#
    .SYNOPSIS
    Get parent directory path

    .PARAMETER Path
    Input path

    .PARAMETER Levels
    Number of levels to go up (default: 1)

    .EXAMPLE
    Get-ParentPath -Path "C:/Users/Test/Documents/file.txt" -Levels 2
    # Returns: C:/Users/Test
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,

        [Parameter(Mandatory=$false)]
        [int]$Levels = 1
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    $currentPath = $Path

    for ($i = 0; $i -lt $Levels; $i++) {
        $currentPath = Split-Path -Parent $currentPath
        if ([string]::IsNullOrWhiteSpace($currentPath)) {
            break
        }
    }

    return $currentPath
}

function Get-FileName {
    <#
    .SYNOPSIS
    Get filename from path

    .PARAMETER Path
    Input path

    .PARAMETER WithExtension
    Include file extension (default: true)

    .EXAMPLE
    Get-FileName -Path "C:/Users/Test/file.txt" -WithExtension $true
    # Returns: file.txt

    Get-FileName -Path "C:/Users/Test/file.txt" -WithExtension $false
    # Returns: file
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,

        [Parameter(Mandatory=$false)]
        [bool]$WithExtension = $true
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    if ($WithExtension) {
        return Split-Path -Leaf $Path
    }
    else {
        return [System.IO.Path]::GetFileNameWithoutExtension($Path)
    }
}

function Get-FileExtension {
    <#
    .SYNOPSIS
    Get file extension from path

    .PARAMETER Path
    Input path

    .PARAMETER WithDot
    Include leading dot (default: true)

    .EXAMPLE
    Get-FileExtension -Path "file.txt" -WithDot $true
    # Returns: .txt

    Get-FileExtension -Path "file.txt" -WithDot $false
    # Returns: txt
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,

        [Parameter(Mandatory=$false)]
        [bool]$WithDot = $true
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    $ext = [System.IO.Path]::GetExtension($Path)

    if (-not $WithDot -and $ext.StartsWith('.')) {
        $ext = $ext.Substring(1)
    }

    return $ext
}

function Set-FileExtension {
    <#
    .SYNOPSIS
    Change file extension

    .PARAMETER Path
    Input path

    .PARAMETER NewExtension
    New extension (with or without leading dot)

    .EXAMPLE
    Set-FileExtension -Path "file.txt" -NewExtension ".md"
    # Returns: file.md
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,

        [Parameter(Mandatory=$true)]
        [string]$NewExtension
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    # Ensure extension has leading dot
    if (-not [string]::IsNullOrWhiteSpace($NewExtension) -and -not $NewExtension.StartsWith('.')) {
        $NewExtension = '.' + $NewExtension
    }

    $pathWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($Path)
    $directory = Split-Path -Parent $Path

    if ($directory) {
        return Join-Path $directory ($pathWithoutExt + $NewExtension)
    }
    else {
        return $pathWithoutExt + $NewExtension
    }
}

function Test-PathExists {
    <#
    .SYNOPSIS
    Check if path exists

    .PARAMETER Path
    Path to check

    .EXAMPLE
    Test-PathExists -Path "C:/Users/Test/file.txt"
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $false
    }

    return Test-Path $Path
}

function Test-IsAbsolutePath {
    <#
    .SYNOPSIS
    Check if path is absolute

    .PARAMETER Path
    Path to check

    .EXAMPLE
    Test-IsAbsolutePath -Path "C:/Users/Test"
    # Returns: True
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $false
    }

    return [System.IO.Path]::IsPathRooted($Path)
}

function ConvertTo-NormalizedBatch {
    <#
    .SYNOPSIS
    Normalize a batch of paths

    .PARAMETER Paths
    Array of paths to normalize

    .PARAMETER ForPowerShell
    If true, normalize for PowerShell (default: true)

    .EXAMPLE
    ConvertTo-NormalizedBatch -Paths @('C:\Users\Test', 'D:\Projects\App')
    # Returns: @('C:/Users/Test', 'D:/Projects/App')
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string[]]$Paths,

        [Parameter(Mandatory=$false)]
        [bool]$ForPowerShell = $true
    )

    if ($null -eq $Paths -or $Paths.Count -eq 0) {
        return @()
    }

    $normalized = @()

    foreach ($path in $Paths) {
        if ($ForPowerShell) {
            $normalized += Normalize-PathForPowerShell -Path $path
        }
        else {
            $normalized += Normalize-PathForWindows -Path $path
        }
    }

    return $normalized
}

function ConvertTo-EscapedPath {
    <#
    .SYNOPSIS
    Escape path for PowerShell string interpolation
    Wraps path in quotes if it contains spaces

    .PARAMETER Path
    Input path

    .EXAMPLE
    ConvertTo-EscapedPath -Path "C:/Program Files/App"
    # Returns: "C:/Program Files/App"
    #>

    param(
        [Parameter(Mandatory=$false)]
        [string]$Path = ""
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    $normalized = Normalize-PathForPowerShell -Path $Path

    # If path contains spaces, wrap in quotes
    if ($normalized -match '\s') {
        return "`"$normalized`""
    }

    return $normalized
}

# Export all functions
Export-ModuleMember -Function @(
    'Normalize-PathForPowerShell',
    'Normalize-PathForWindows',
    'Normalize-PathForFlutter',
    'ConvertTo-AbsolutePath',
    'ConvertTo-RelativePath',
    'Add-TrailingSlash',
    'Remove-TrailingSlash',
    'Join-PathSafe',
    'Get-ParentPath',
    'Get-FileName',
    'Get-FileExtension',
    'Set-FileExtension',
    'Test-PathExists',
    'Test-IsAbsolutePath',
    'ConvertTo-NormalizedBatch',
    'ConvertTo-EscapedPath'
)
