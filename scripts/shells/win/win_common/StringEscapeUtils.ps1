# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
# ### AI SPECIAL ATTENTIONS RULES END ###

<#
.SYNOPSIS
    String escape utilities for registry and command line processing

.DESCRIPTION
    Provides utility functions for escaping strings in registry files and command lines,
    specifically handling quotes and backslashes for proper Windows registry format.

.NOTES
    Author: Core Node Development Team
    Version: 1.0
#>

function Escape-QuotesInString {
    <#
    .SYNOPSIS
        Escapes quotes within a string while preserving the first and last quotes
    
    .DESCRIPTION
        Takes a string that starts and ends with quotes, and escapes all internal quotes
        by adding backslashes before them. The first and last quotes are preserved.
        Only processes if first and last quotes are the same type.
    
    .PARAMETER InputString
        The input string to process
    
    .EXAMPLE
        Escape-QuotesInString '"D:\path\file.exe" "%1"'
        Returns: "D:\path\file.exe" \"%1\"
    
    .EXAMPLE
        Escape-QuotesInString '"C:\Program Files\App\app.exe" "arg1" "arg2"'
        Returns: "C:\Program Files\App\app.exe" \"arg1\" \"arg2\"
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$InputString
    )
    
    if ([string]::IsNullOrEmpty($InputString)) {
        return $InputString
    }
    
    # Check if string starts and ends with quotes
    if (-not ($InputString.StartsWith('"') -and $InputString.EndsWith('"'))) {
        return $InputString
    }
    
    # Extract content between first and last quotes
    $content = $InputString.Substring(1, $InputString.Length - 2)
    
    # Escape internal quotes (only double quotes)
    $escapedContent = $content -replace '"', '\"'
    
    # Reconstruct with preserved first and last quotes
    $result = '"' + $escapedContent + '"'
    
    return $result
}

function Escape-QuotesInStringSmart {
    <#
    .SYNOPSIS
        Intelligently escapes quotes within a string based on quote type matching
    
    .DESCRIPTION
        Only escapes internal quotes if the first and last quotes are the same type.
        Preserves the first and last quotes regardless of type.
    
    .PARAMETER InputString
        The input string to process
    
    .EXAMPLE
        Escape-QuotesInStringSmart '"D:\path\file.exe" "%1"'
        Returns: "D:\path\file.exe" \"%1\"
    
    .EXAMPLE
        Escape-QuotesInStringSmart "'D:\path\file.exe' '%1'"
        Returns: 'D:\path\file.exe' \'%1\'
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$InputString
    )
    
    if ([string]::IsNullOrEmpty($InputString)) {
        return $InputString
    }
    
    # Check if string starts and ends with quotes
    $startsWithDouble = $InputString.StartsWith('"')
    $startsWithSingle = $InputString.StartsWith("'")
    $endsWithDouble = $InputString.EndsWith('"')
    $endsWithSingle = $InputString.EndsWith("'")
    
    if (-not (($startsWithDouble -and $endsWithDouble) -or ($startsWithSingle -and $endsWithSingle))) {
        return $InputString
    }
    
    # Extract content between first and last quotes
    $content = $InputString.Substring(1, $InputString.Length - 2)
    
    # Escape internal quotes based on quote type
    if ($startsWithDouble -and $endsWithDouble) {
        $escapedContent = $content -replace '"', '\"'
        $result = '"' + $escapedContent + '"'
    }
    elseif ($startsWithSingle -and $endsWithSingle) {
        $escapedContent = $content -replace "'", "\'"
        $result = "'" + $escapedContent + "'"
    }
    else {
        $result = $InputString
    }
    
    return $result
}

function Escape-BackslashesInString {
    <#
    .SYNOPSIS
        Escapes backslashes in a string for registry format
    
    .DESCRIPTION
        Doubles all backslashes in the input string to make it registry-compatible
    
    .PARAMETER InputString
        The input string to process
    
    .EXAMPLE
        Escape-BackslashesInString 'D:\path\file.exe'
        Returns: D:\\path\\file.exe
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$InputString
    )
    
    if ([string]::IsNullOrEmpty($InputString)) {
        return $InputString
    }
    
    return $InputString -replace '\\', '\\'
}

function Escape-RegistryString {
    <#
    .SYNOPSIS
        Escapes a string for use in Windows registry files
    
    .DESCRIPTION
        Applies both backslash and quote escaping to make a string registry-compatible.
        First escapes backslashes, then handles quotes within quoted strings using smart logic.
    
    .PARAMETER InputString
        The input string to process
    
    .EXAMPLE
        Escape-RegistryString '"D:\path\file.exe" "%1"'
        Returns: "D:\\path\\file.exe" \"%1\"
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$InputString
    )
    
    if ([string]::IsNullOrEmpty($InputString)) {
        return $InputString
    }
    
    # First escape backslashes
    $result = Escape-BackslashesInString -InputString $InputString
    
    # Then escape quotes within quoted strings using smart logic
    $result = Escape-QuotesInStringSmart -InputString $result
    
    return $result
}

function Format-RegistryCommand {
    <#
    .SYNOPSIS
        Formats a command string for Windows registry with proper escaping
    
    .DESCRIPTION
        Takes a command string and formats it for use in Windows registry files,
        applying all necessary escaping for backslashes and quotes.
    
    .PARAMETER ExecutablePath
        Path to the executable file
    
    .PARAMETER Arguments
        Command line arguments
    
    .EXAMPLE
        Format-RegistryCommand -ExecutablePath 'D:\7zip\7z.exe' -Arguments 'x "%1" -o"%1" -y'
        Returns: "D:\\7zip\\7z.exe" x \"%1\" -o\"%1\" -y
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,
        
        [Parameter(Mandatory = $false)]
        [string]$Arguments = ""
    )
    
    # Escape the executable path
    $escapedPath = Escape-BackslashesInString -InputString $ExecutablePath
    
    # Wrap executable path in quotes
    $quotedPath = '"' + $escapedPath + '"'
    
    if ([string]::IsNullOrEmpty($Arguments)) {
        return $quotedPath
    }
    
    # Escape arguments
    $escapedArgs = Escape-RegistryString -InputString $Arguments
    
    return $quotedPath + " " + $escapedArgs
}

# Parameterized quote escaping controller
function Escape-Quotes {
    <#
    .SYNOPSIS
        Parameterized quote escaping

    .DESCRIPTION
        Controls whether to escape only inner quotes (preserving the first/last pair)
        or escape all quotes in the input string. If Mode is 'none', no changes are made.

    .PARAMETER InputString
        String to process

    .PARAMETER Mode
        One of: none | inner | all | registry
        - none: return input unchanged
        - inner: if the string starts/ends with the same quote, escape only quotes inside
        - all: escape every double-quote character
        - registry: format for Windows registry command values (escape both backslashes and quotes)
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$InputString,
        [ValidateSet('none','inner','all','registry')]
        [string]$Mode = 'inner'
    )

    if ($Mode -eq 'none') { return $InputString }
    if ($Mode -eq 'all')  { return ($InputString -replace '"', '\"') }
    if ($Mode -eq 'registry') { return (Escape-ForRegistryValue -InputString $InputString) }

    # inner mode: preserve the boundary quotes if they match, escape only inside
    $startsWithDouble = $InputString.StartsWith('"')
    $endsWithDouble   = $InputString.EndsWith('"')
    if ($startsWithDouble -and $endsWithDouble -and $InputString.Length -ge 2) {
        $content = $InputString.Substring(1, $InputString.Length - 2)
        $escapedContent = $content -replace '"', '\"'
        return '"' + $escapedContent + '"'
    }

    return $InputString
}

function Escape-ForRegistryValue {
    <#
    .SYNOPSIS
        Escapes a command string for Windows registry value format

    .DESCRIPTION
        Properly escapes both backslashes and quotes for use in Windows registry files.
        This function handles the complete escaping needed for registry command values.

        Processing order:
        1. Escape backslashes: \ -> \\
        2. Escape quotes: " -> \"

        Example:
        Input:  "D:\path\file.exe" arg "%1"
        Output: \"D:\\path\\file.exe\" arg \"%1\"

    .PARAMETER InputString
        The command string to escape

    .EXAMPLE
        Escape-ForRegistryValue '"D:\7z\7z.exe" a "%1.zip" "%1"'
        Returns: \"D:\\7z\\7z.exe\" a \"%1.zip\" \"%1\"
    #>
    param(
        [Parameter(Mandatory = $true)]
        [string]$InputString
    )

    if ([string]::IsNullOrEmpty($InputString)) {
        return $InputString
    }

    # Step 1: Escape backslashes first (\ -> \\)
    $result = $InputString -replace '\\', '\\'

    # Step 2: Escape double quotes (" -> \")
    $result = $result -replace '"', '\"'

    return $result
}

# Functions are available for use in other scripts when this file is dot-sourced
