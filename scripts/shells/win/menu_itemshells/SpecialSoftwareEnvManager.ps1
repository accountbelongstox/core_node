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
    Special Software Environment Variables Management Menu
.DESCRIPTION
    Provides a menu interface for setting environment variables for special software like AI tools
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:COMMON_FUNC_PATH = Join-Path $script:WIN_COMMON_DIR "CommanFunc.ps1"
$script:WINDOWS_PATH_FUNCTION_PATH = Join-Path $script:WIN_COMMON_DIR "WindowsPathFunction.ps1"

# Global variables for file management
$script:SelectedFileAction = $null          # "new" or file path for replacement
$script:SelectedFileText = $null            # Display text of selected option
$script:SelectedFileIndex = -1              # Index of selected menu item
$script:IsReplacingFile = $false            # Boolean flag for replacement mode
$script:TargetFilePath = $null              # Full path of target file for replacement

# Global variables for current operation
$script:CurrentConfigName = $null           # Current configuration being processed
$script:CurrentConfig = $null               # Current configuration object
$script:CurrentCommandPrefix = $null        # Current command prefix (e.g., "claude", "aliyun")
$script:CurrentFileNumber = 1               # Current file number for auto-increment
$script:CurrentWinEnvsDir = $null           # Current .winenvs directory path
$script:CurrentFileName = $null             # Current file name being generated
$script:CurrentBatchContent = $null         # Current batch file content
$script:CurrentPsCommand = $null            # Current PowerShell command to execute

# Load common functions
. $script:COMMON_FUNC_PATH
. $script:WINDOWS_PATH_FUNCTION_PATH
#endregion

#region Helper Functions

function Test-AdminPrivileges {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Set-EnvironmentVariable {
    param(
        [Parameter(Mandatory=$true)] [string]$VariableName,
        [Parameter(Mandatory=$false)] [string]$VariableValue = "",
        [Parameter(Mandatory=$false)] [switch]$Delete
    )
    
    if (-not (Test-Path $script:WINDOWS_PATH_FUNCTION_PATH)) {
        Write-ColorMessage -Message "Error: WindowsPathFunction.ps1 not found at: $script:WINDOWS_PATH_FUNCTION_PATH" -Type "Error"
        return $false
    }
    
    if ($Delete) {
        # Delete the environment variable
        & $script:WINDOWS_PATH_FUNCTION_PATH "delvar" $VariableName
    } else {
        # Set the environment variable
        & $script:WINDOWS_PATH_FUNCTION_PATH "setvar" $VariableName $VariableValue
    }
    return $true
}

function Get-EnvironmentVariable {
    param(
        [Parameter(Mandatory=$true)] [string]$VariableName
    )
    
    if (-not (Test-Path $script:WINDOWS_PATH_FUNCTION_PATH)) {
        Write-ColorMessage -Message "Error: WindowsPathFunction.ps1 not found at: $script:WINDOWS_PATH_FUNCTION_PATH" -Type "Error"
        return $null
    }
    
    $value = & $script:WINDOWS_PATH_FUNCTION_PATH "getvar" $VariableName
    return $value
}

#endregion

#region Smart Recognition Helper Functions

function Test-StringHasWhitespaceInMiddle {
    param(
        [Parameter(Mandatory=$true)] [string]$InputString
    )
    
    # Check if string contains whitespace, newlines, or carriage returns in the middle
    # (not at the beginning or end)
    $trimmed = $InputString.Trim()
    if ($trimmed.Length -ne $InputString.Length) {
        return $true  # Has leading/trailing whitespace
    }
    
    # Check for whitespace characters in the middle
    if ($InputString -match '\s') {
        return $true
    }
    
    # Check for newlines or carriage returns
    if ($InputString -match '[\r\n]') {
        return $true
    }
    
    return $false
}

function Extract-ApiUrlAndToken {
    param(
        [Parameter(Mandatory=$true)] [string]$InputText
    )
    
    # Clean up the text: remove extra whitespace and normalize line breaks
    $cleanedText = $InputText -replace '\r\n|\r|\n', ' '  # Replace all line breaks with spaces
    $cleanedText = $cleanedText -replace '\s+', ' '       # Replace multiple spaces with single space
    $cleanedText = $cleanedText.Trim()                    # Remove leading/trailing whitespace
    
    # Split using whitespace pattern
    $tokens = $cleanedText -split '[\s\n\r]+' |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne '' }
    
    # Extract API URLs and Tokens
    $apiUrls = @()
    $foundTokens = @()
    
    foreach ($token in $tokens) {
        if ($token -match '^https?://') {
            $apiUrls += $token
        } elseif ($token.Length -gt 37) {
            $foundTokens += $token
        }
    }
    
    return @{
        ApiUrls = $apiUrls
        Tokens = $foundTokens
        CleanedText = $cleanedText
        TotalSegments = $tokens.Count
    }
}

#endregion

#region Smart Input Processing Functions

function Get-SmartInputForVariable {
    param(
        [Parameter(Mandatory=$true)] [hashtable]$Variable,
        [Parameter(Mandatory=$true)] [hashtable]$Config,
        [Parameter(Mandatory=$true)] [bool]$HasCurrentValue,
        [Parameter(Mandatory=$true)] [string]$CurrentValue
    )
    
    # Check if smart recognition is enabled for this config (with error handling)
    $smartRecognitionEnabled = $false
    try {
        if ($Config -and $Config.ContainsKey("SmartRecognition") -and $Config.SmartRecognition -and $Config.SmartRecognition.ContainsKey("Enabled") -and $Config.SmartRecognition.Enabled) {
            $smartRecognitionEnabled = $true
        }
    } catch {
        # Default to disabled if any error occurs
        $smartRecognitionEnabled = $false
    }
    
    # Build prompt
    if ($HasCurrentValue) {
        $prompt = "Please enter $($Variable.DisplayName) (or press Enter to keep current value):"
    } else {
        $prompt = "Please enter $($Variable.DisplayName) (or press Enter to skip):"
    }
    
    if ($Variable.Description) {
        $prompt += "`nDescription: $($Variable.Description)"
        
        # Add smart recognition hint if enabled and this is the first variable
        try {
            if ($smartRecognitionEnabled -and $Config -and $Config.ContainsKey("Variables") -and $Config.Variables -and $Config.Variables.IndexOf($Variable) -eq 0) {
                $prompt += "`nNote: Multi-line input is supported and will be intelligently parsed."
            }
        } catch {
            # Skip hint if any error occurs
        }
    }
    
    Write-ColorMessage -Message $prompt -Type "Info"
    
    # Get user input
    $userInput = Read-Host $Variable.DisplayName
    
    # Check if input is empty
    if ([string]::IsNullOrWhiteSpace($userInput)) {
        return @{
            Value = $null
            ExtractedData = $null
            ShouldSkipNext = $false
        }
    }
    
    # Check if smart recognition should be applied
    $extractedData = $null
    $shouldSkipNext = $false
    
    try {
        $isFirstVariable = $false
        if ($Config -and $Config.ContainsKey("Variables") -and $Config.Variables) {
            $isFirstVariable = ($Config.Variables.IndexOf($Variable) -eq 0)
        }
    } catch {
        $isFirstVariable = $false
    }
    
    if ($smartRecognitionEnabled -and $isFirstVariable) {
        # Check if input has whitespace/newlines in the middle
        if (Test-StringHasWhitespaceInMiddle -InputString $userInput) {
            Write-ColorMessage -Message "Multi-line input detected. Applying smart recognition..." -Type "Info"
            
            # Extract API URLs and tokens
            $extractedData = Extract-ApiUrlAndToken -InputText $userInput
            
            Write-ColorMessage -Message "Extraction Results:" -Type "Info"
            Write-ColorMessage -Message "Total segments: $($extractedData.TotalSegments)" -Type "Info"
            
            if ($extractedData.ApiUrls.Count -gt 0) {
                Write-ColorMessage -Message "Found API URLs:" -Type "Info"
                foreach ($url in $extractedData.ApiUrls) {
                    Write-ColorMessage -Message "  - $url" -Type "Info"
                }
            }
            
            if ($extractedData.Tokens.Count -gt 0) {
                Write-ColorMessage -Message "Found Tokens (length > 37):" -Type "Info"
                foreach ($token in $extractedData.Tokens) {
                    Write-ColorMessage -Message "  - $token" -Type "Info"
                }
            }
            
            # Determine the value for current variable based on InputType (with error handling)
            $currentInputType = ""
            try {
                if ($Variable -and $Variable.ContainsKey("InputType") -and $Variable.InputType) {
                    $currentInputType = $Variable.InputType
                }
            } catch {
                $currentInputType = ""
            }
            
            $finalValue = $null
            
            if ($currentInputType -eq "Url" -and $extractedData.ApiUrls.Count -gt 0) {
                $finalValue = $extractedData.ApiUrls[0]
                Write-ColorMessage -Message "Using first API URL: $finalValue" -Type "Success"
            } elseif ($currentInputType -eq "Token" -and $extractedData.Tokens.Count -gt 0) {
                $finalValue = $extractedData.Tokens[0]
                Write-ColorMessage -Message "Using first Token: [HIDDEN]" -Type "Success"
            } else {
                # Fallback to original input
                $finalValue = $userInput
                Write-ColorMessage -Message "Using original input (no matching type found)" -Type "Warning"
            }
            
            # Check if we should skip the next variable (with error handling)
            try {
                if ($Config -and $Config.ContainsKey("Variables") -and $Config.Variables -and $Config.Variables.Count -gt 1) {
                    $nextVariable = $Config.Variables[1]
                    $nextInputType = ""
                    if ($nextVariable -and $nextVariable.ContainsKey("InputType") -and $nextVariable.InputType) {
                        $nextInputType = $nextVariable.InputType
                    }
                    
                    # If we found both URL and token, and next variable is the other type, skip it
                    if ($extractedData.ApiUrls.Count -gt 0 -and $extractedData.Tokens.Count -gt 0) {
                        if (($currentInputType -eq "Url" -and $nextInputType -eq "Token") -or 
                            ($currentInputType -eq "Token" -and $nextInputType -eq "Url")) {
                            $shouldSkipNext = $true
                            Write-ColorMessage -Message "Both URL and Token found. Next variable will be auto-filled." -Type "Info"
                        }
                    }
                }
            } catch {
                # Skip auto-fill if any error occurs
                $shouldSkipNext = $false
            }
            
            return @{
                Value = $finalValue
                ExtractedData = $extractedData
                ShouldSkipNext = $shouldSkipNext
            }
        }
    }
    
    # Return normal input
    return @{
        Value = $userInput
        ExtractedData = $null
        ShouldSkipNext = $false
    }
}

function Get-ValueForNextVariable {
    param(
        [Parameter(Mandatory=$true)] [hashtable]$Variable,
        [Parameter(Mandatory=$true)] [hashtable]$ExtractedData
    )
    
    try {
        $inputType = ""
        if ($Variable -and $Variable.ContainsKey("InputType") -and $Variable.InputType) {
            $inputType = $Variable.InputType
        }
        
        if ($inputType -eq "Url" -and $ExtractedData -and $ExtractedData.ContainsKey("ApiUrls") -and $ExtractedData.ApiUrls -and $ExtractedData.ApiUrls.Count -gt 0) {
            return $ExtractedData.ApiUrls[0]
        } elseif ($inputType -eq "Token" -and $ExtractedData -and $ExtractedData.ContainsKey("Tokens") -and $ExtractedData.Tokens -and $ExtractedData.Tokens.Count -gt 0) {
            return $ExtractedData.Tokens[0]
        }
    } catch {
        # Return null if any error occurs
    }
    
    return $null
}

#endregion

#region Configuration Mapping
$script:ActionToConfigMapping = @{
    'claude' = 'Claude AI'
    'alibaba' = 'Alibaba Cloud'
}

function Get-FullConfigName {
    param(
        [Parameter(Mandatory=$true)] [string]$Action
    )
    
    if ($script:ActionToConfigMapping.ContainsKey($Action)) {
        return $script:ActionToConfigMapping[$Action]
    }
    return $Action
}
#endregion

#region Environment Variables Configuration
$script:EnvironmentConfigs = @{
    "Claude AI" = @{
        Title = "Claude AI Environment Variables"
        Description = "Set up Claude AI environment variables for API access"
        Common = "claude"
        CommandPrefix = "claude"
        DisplayName = "Claude AI"
        SmartRecognition = @{
            Enabled = $true
            AllowedTypes = @("token", "url")
        }
        Variables = @(
            @{
                Name = "ANTHROPIC_BASE_URL"
                DisplayName = "ANTHROPIC_BASE_URL"
                Description = "Claude AI API base URL"
                IsSecret = $false
                InputType = "Url"
            },
            @{
                Name = "ANTHROPIC_AUTH_TOKEN"
                DisplayName = "ANTHROPIC_AUTH_TOKEN"
                Description = "Claude AI authentication token"
                IsSecret = $true
                InputType = "Token"
            }
        )
    }
    "Alibaba Cloud" = @{
        Title = "Alibaba Cloud Environment Variables"
        Description = "Set up Alibaba Cloud environment variables for API access"
        Common = "alibaba"
        CommandPrefix = "aliyun"
        DisplayName = "Alibaba Cloud"
        Variables = @(
            @{
                Name = "ALIBABA_CLOUD_ACCESS_KEY_ID"
                DisplayName = "ALIBABA_CLOUD_ACCESS_KEY_ID"
                Description = "Alibaba Cloud access key ID"
                IsSecret = $false
                InputType = "AccessKeyId"
            },
            @{
                Name = "ALIBABA_CLOUD_ACCESS_KEY_SECRET"
                DisplayName = "ALIBABA_CLOUD_ACCESS_KEY_SECRET"
                Description = "Alibaba Cloud access key secret"
                IsSecret = $true
                InputType = "Token"
            }
        )
    }
    # Example: Add new service configuration
    # "OpenAI" = @{
    #     Title = "OpenAI Environment Variables"
    #     Description = "Set up OpenAI environment variables for API access"
    #     Variables = @(
    #         @{
    #             Name = "OPENAI_API_KEY"
    #             DisplayName = "OPENAI_API_KEY"
    #             Description = "OpenAI API key"
    #             IsSecret = $true
    #         },
    #         @{
    #             Name = "OPENAI_BASE_URL"
    #             DisplayName = "OPENAI_BASE_URL"
    #             Description = "OpenAI API base URL (optional)"
    #             IsSecret = $false
    #         }
    #     )
    # }
}
#endregion

#region Script Generation Functions

function Ensure-Array {
    param(
        [Parameter(Mandatory=$false)] $InputObject
    )
    
    if ($null -eq $InputObject) {
        return ,@()  # Force return as array
    } else {
        return ,@($InputObject)  # Force return as array
    }
}

function Get-CommonName {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    if ($script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        return $script:EnvironmentConfigs[$ConfigName].Common
    }
    return $null
}

function Get-ListScriptName {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    if ($script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        $config = $script:EnvironmentConfigs[$ConfigName]
        # Use CommandPrefix if available, otherwise fall back to Common
        if ($config.CommandPrefix) {
            return "${config.CommandPrefix}list"
        } elseif ($config.Common) {
            return "${config.Common}list"
        }
    }
    return $null
}

function Get-ExistingScripts {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    $listScriptName = Get-ListScriptName -ConfigName $ConfigName
    if (-not $listScriptName) {
        return @()
    }
    
    $winEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
    if (-not (Test-Path $winEnvsDir)) {
        return @()
    }
    
    $pattern = "${listScriptName}*"
    $scripts = Get-ChildItem -Path $winEnvsDir -Filter $pattern -File -ErrorAction SilentlyContinue | Sort-Object Name
    
    # Ensure $scripts is always an array
    $scripts = Ensure-Array -InputObject $scripts
    
    return $scripts
}

function Show-ExistingScriptsMenu {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName,
        [Parameter(Mandatory=$false)] [array]$Scripts = @()
    )
    
    # Ensure Scripts is always an array
    $Scripts = Ensure-Array -InputObject $Scripts
    
    if ($Scripts.Count -eq 0) {
        return "new"
    }
    
    $menuItems = @(
        @{ Text = "Create new script"; Action = "new" }
    )
    
    foreach ($script in $Scripts) {
        $menuItems += @{ Text = "Replace: $($script.Name)"; Action = $script.FullName }
    }
    
    $selectedIndex = 0
    
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "Script Management for $ConfigName" -Type "Info"
        Write-ColorMessage -Message "Use Up/Down arrows to navigate, Enter to select" -Type "Info"
        Write-ColorMessage -Message "=" -Type "Info"
        
        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selectedIndex) {
                Write-Host "> $($menuItems[$i].Text)" -ForegroundColor Yellow
            } else {
                Write-Host "  $($menuItems[$i].Text)" -ForegroundColor White
            }
        }
        
        $key = [Console]::ReadKey($true).Key
        
        switch ($key) {
            'UpArrow' {
                $selectedIndex = if ($selectedIndex -gt 0) { $selectedIndex - 1 } else { $menuItems.Count - 1 }
            }
            'DownArrow' {
                $selectedIndex = if ($selectedIndex -lt $menuItems.Count - 1) { $selectedIndex + 1 } else { 0 }
            }
            'Enter' {
                return $menuItems[$selectedIndex].Action
            }
        }
    }
}

function Generate-EnvironmentScript {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName,
        [Parameter(Mandatory=$false)] [string]$TargetScriptPath = $null
    )
    
    if (-not $script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        Write-ColorMessage -Message "Configuration '$ConfigName' not found." -Type "Error"
        return $false
    }
    
    $config = $script:EnvironmentConfigs[$ConfigName]
    
    Clear-Host
    Write-ColorMessage -Message "Generate $($config.Title) Script" -Type "Info"
    Write-ColorMessage -Message $config.Description -Type "Info"
    Write-ColorMessage -Message ("=" * $config.Title.Length) -Type "Info"
    
    # Get user input for each variable
    $envCommands = @()
    $envCommands += "# Environment variables for $($config.Title)"
    $envCommands += "# Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $envCommands += ""
    
    foreach ($var in $config.Variables) {
        $prompt = "Please enter $($var.DisplayName):"
        if ($var.Description) {
            $prompt += "`nDescription: $($var.Description)"
        }
        
        Write-ColorMessage -Message $prompt -Type "Info"
        $userInput = Read-Host $var.DisplayName
        
        if (-not [string]::IsNullOrWhiteSpace($userInput)) {
            $envCommands += "`$env:$($var.Name) = `"$userInput`""
        } else {
            $envCommands += "# `$env:$($var.Name) = `"`"  # Not set"
        }
    }
    
    # Generate script number
    $existingScripts = Get-ExistingScripts -ConfigName $ConfigName
    
    # Ensure $existingScripts is always an array
    $existingScripts = Ensure-Array -InputObject $existingScripts
    
    $scriptNumber = $existingScripts.Count + 1
    
    # Generate script filename
    if (-not $TargetScriptPath) {
        $listScriptName = Get-ListScriptName -ConfigName $ConfigName
        $scriptName = "${listScriptName}${scriptNumber}.ps1"
        $winEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
        $TargetScriptPath = Join-Path $winEnvsDir $scriptName
    }
    
    # Create PowerShell script content
    $scriptContent = @"
# $($config.Title) Environment Script
# Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

# Set environment variables
$($envCommands -join "`n")

# Display status
Write-Host "Environment variables set for $($config.Title):" -ForegroundColor Green
foreach (`$var in @($($config.Variables | ForEach-Object { "`"$($_.Name)`"" } | Join-String -Separator ", "))) {
    `$value = [Environment]::GetEnvironmentVariable(`$var)
    if (`$value) {
        Write-Host "  `$var = [SET]" -ForegroundColor Yellow
    } else {
        Write-Host "  `$var = [NOT SET]" -ForegroundColor Red
    }
}
"@
    
    try {
        # Ensure directory exists
        $scriptDir = Split-Path $TargetScriptPath -Parent
        if (-not (Test-Path $scriptDir)) {
            New-Item -ItemType Directory -Path $scriptDir -Force | Out-Null
        }
        
        # Write script file
        $scriptContent | Out-File -FilePath $TargetScriptPath -Encoding UTF8 -Force
        
        # Add to winenvs using the existing function
        & $script:WINDOWS_PATH_FUNCTION_PATH "addfile" $TargetScriptPath
        
        Write-ColorMessage -Message "Script generated successfully: $TargetScriptPath" -Type "Success"
        Write-ColorMessage -Message "Script has been added to .winenvs directory" -Type "Success"
        
        return $true
    } catch {
        Write-ColorMessage -Message "Failed to generate script: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Show-ListScripts {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    $commandPrefix = Get-CommandPrefix -ConfigName $ConfigName
    if (-not $commandPrefix) {
        Write-ColorMessage -Message "No command prefix found for $ConfigName" -Type "Error"
        return
    }
    
    $winEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
    if (-not (Test-Path $winEnvsDir)) {
        Write-ColorMessage -Message ".winenvs directory not found" -Type "Error"
        return
    }
    
    $files = Get-ExistingFiles -ConfigName $ConfigName
    
    # Ensure $files is always an array
    $files = Ensure-Array -InputObject $files
    
    $listScriptName = "${commandPrefix}list"
    
    Clear-Host
    Write-ColorMessage -Message "Available Files for $ConfigName" -Type "Info"
    Write-ColorMessage -Message "Pattern: ${commandPrefix}*" -Type "Info"
    Write-ColorMessage -Message ("=" * 50) -Type "Info"
    
    if ($files.Count -eq 0) {
        Write-ColorMessage -Message "No files found matching pattern: ${commandPrefix}*" -Type "Warning"
    } else {
        foreach ($file in $files) {
            Write-ColorMessage -Message "  $($file.Name)" -Type "Info"
        }
    }
    
    Write-ColorMessage -Message "`nList script: ${listScriptName}.bat" -Type "Info"
    Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

#endregion

#region Global Command Functions

function Get-ConfigDisplayName {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    if ($script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        $config = $script:EnvironmentConfigs[$ConfigName]
        return $config.DisplayName
    }
    return $ConfigName
}

function Get-CommandPrefix {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    if ($script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        $config = $script:EnvironmentConfigs[$ConfigName]
        # Use CommandPrefix if available, otherwise fall back to Common
        if ($config.CommandPrefix) {
            return $config.CommandPrefix
        } elseif ($config.Common) {
            return $config.Common
        }
    }
    return $null
}

function Get-ExistingFiles {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    # DEBUG: Check global variables
    Write-ColorMessage -Message "DEBUG: LANG_COMPILER_DIR: $Global:LANG_COMPILER_DIR" -Type "Info"
    Write-ColorMessage -Message "DEBUG: WINENVS_DIR: $Global:WINENVS_DIR" -Type "Info"
    
    $filePrefix = Get-CommandPrefix -ConfigName $ConfigName
    Write-ColorMessage -Message "DEBUG: filePrefix: $filePrefix" -Type "Info"
    if (-not $filePrefix) {
        return @()
    }
    
    $winEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
    Write-ColorMessage -Message "DEBUG: winEnvsDir: $winEnvsDir" -Type "Info"
    if (-not (Test-Path $winEnvsDir)) {
        return @()
    }
    
    # Scan for existing files to avoid naming conflicts
    # Look for files like claude1.bat, claude2.bat, aliyun1.bat, aliyun2.bat
    Write-ColorMessage -Message "Scanning directory: $winEnvsDir" -Type "Info"
    Write-ColorMessage -Message "Looking for patternA: ${filePrefix}*" -Type "Info"
    
    # Get all files matching the prefix pattern
    $files = Get-ChildItem -Path $winEnvsDir -Filter "${filePrefix}*" -File -ErrorAction SilentlyContinue
    
    # Ensure $files is always an array, even if no files found
    $files = Ensure-Array -InputObject $files
    
    if ($files.Count -eq 0) {
        Write-ColorMessage -Message "DEBUG: files is empty array" -Type "Info"
    } else {
        Write-ColorMessage -Message "DEBUG: files type: $($files.GetType().Name)" -Type "Info"
        Write-ColorMessage -Message "DEBUG: files value: $files" -Type "Info"
    }
    
    # Use the already processed $files array
    $allFiles = $files
    
    # Ensure we have a proper array and filter out any null values
    $allFiles = @($allFiles | Where-Object { $null -ne $_ })
    
    # DEBUG: Check what allFiles becomes
    if ($null -eq $allFiles) {
        Write-ColorMessage -Message "DEBUG: allFiles is null" -Type "Info"
    } else {
        Write-ColorMessage -Message "DEBUG: allFiles type: $($allFiles.GetType().Name)" -Type "Info"
        Write-ColorMessage -Message "DEBUG: allFiles is null: $($null -eq $allFiles)" -Type "Info"
        Write-ColorMessage -Message "DEBUG: allFiles has Count: $($allFiles -is [array])" -Type "Info"
    }
    
    Write-ColorMessage -Message "Found $($allFiles.Count) files matching pattern" -Type "Info"
    
    # Show all files found
    foreach ($file in $allFiles) {
        Write-ColorMessage -Message "  - $($file.Name)" -Type "Info"
    }
    
    # Always return an array of file objects, never null
    return $allFiles
}

function Show-ExistingFilesMenu {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName,
        [Parameter(Mandatory=$false)] [array]$Files = @()
    )
    
    # Ensure Files is always an array
    $Files = Ensure-Array -InputObject $Files
    
    # Get file prefix
    $filePrefix = Get-CommandPrefix -ConfigName $ConfigName
    if ([string]::IsNullOrWhiteSpace($filePrefix)) {
        Write-ColorMessage -Message "No file prefix found for $ConfigName" -Type "Error"
        return "new"
    }
    
    # If no files exist, directly create new file
    if ($Files.Count -eq 0) {
        return "new"
    }
    
    # Calculate next available file number - find the first available number starting from 1
    $nextFileNumber = 1
    $existingNumbers = @()
    
    # Extract existing file numbers
    foreach ($file in $Files) {
        if ($null -ne $file -and $file.Name -match "^${filePrefix}(\d+)\.bat$") {
            $existingNumbers += [int]$matches[1]
        }
    }
    
    # Find the first available number starting from 1
    while ($existingNumbers -contains $nextFileNumber) {
        $nextFileNumber++
    }
    
    $nextFileName = "${filePrefix}${nextFileNumber}.bat"
    
    $menuItems = @()
    
    # Add option to create new file
    $menuItems += @{ Text = "Create new file: $nextFileName (auto-increment)"; Action = "new" }
    
    # Add options to replace existing files
    Write-ColorMessage -Message "DEBUG: Processing $($Files.Count) files for replacement options" -Type "Info"
    $winEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
    foreach ($file in $Files) {
        if ($null -ne $file -and $file.PSObject.Properties['Name'] -and $file.Name) {
            # Build full path manually since $file.FullName might be empty
            $fullPath = Join-Path $winEnvsDir $file.Name
            Write-ColorMessage -Message "DEBUG: File - Name: '$($file.Name)', FullName: '$($file.FullName)', Built Path: '$fullPath'" -Type "Info"
            $menuItems += @{ Text = "Replace existing: $($file.Name)"; Action = $fullPath }
        } else {
            Write-ColorMessage -Message "DEBUG: Skipping file - file is null or missing Name property" -Type "Warning"
        }
    }
    
    $selectedIndex = 0
    
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "File Management for $ConfigName Files" -Type "Info"
        Write-ColorMessage -Message "Use Up/Down arrows to navigate, Enter to select" -Type "Info"
        Write-ColorMessage -Message "=" -Type "Info"
        
        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selectedIndex) {
                Write-Host "> $($menuItems[$i].Text)" -ForegroundColor Yellow
            } else {
                Write-Host "  $($menuItems[$i].Text)" -ForegroundColor White
            }
        }
        
        $key = [Console]::ReadKey($true).Key
        
        switch ($key) {
            'UpArrow' {
                $selectedIndex = if ($selectedIndex -gt 0) { $selectedIndex - 1 } else { $menuItems.Count - 1 }
            }
            'DownArrow' {
                $selectedIndex = if ($selectedIndex -lt $menuItems.Count - 1) { $selectedIndex + 1 } else { 0 }
            }
            'Enter' {
                $script:SelectedFileAction = $menuItems[$selectedIndex].Action
                $script:SelectedFileText = $menuItems[$selectedIndex].Text
                $script:SelectedFileIndex = $selectedIndex
                
                # Set replacement mode flags
                if ($script:SelectedFileAction -eq "new") {
                    $script:IsReplacingFile = $false
                    $script:TargetFilePath = $null
                } else {
                    $script:IsReplacingFile = $true
                    $script:TargetFilePath = $script:SelectedFileAction
                }
                
                # Debug information
                Write-ColorMessage -Message "DEBUG: Selected file menu item: '$script:SelectedFileText'" -Type "Info"
                Write-ColorMessage -Message "DEBUG: Selected file action: '$script:SelectedFileAction'" -Type "Info"
                Write-ColorMessage -Message "DEBUG: Selected file index: $script:SelectedFileIndex" -Type "Info"
                Write-ColorMessage -Message "DEBUG: Is replacing file: $script:IsReplacingFile" -Type "Info"
                Write-ColorMessage -Message "DEBUG: Target file path: '$script:TargetFilePath'" -Type "Info"
                Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
                $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                
                # Return immediately (no need to return value)
                return
            }
        }
    }
}

function Generate-ListScript {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    if (-not $script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        Write-ColorMessage -Message "Configuration '$ConfigName' not found." -Type "Error"
        return $false
    }
    
    $config = $script:EnvironmentConfigs[$ConfigName]
    $commandPrefix = Get-CommandPrefix -ConfigName $ConfigName
    if (-not $commandPrefix) {
        Write-ColorMessage -Message "No command prefix found for $ConfigName" -Type "Error"
        return $false
    }
    
    $winEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
    if (-not (Test-Path $winEnvsDir)) {
        Write-ColorMessage -Message ".winenvs directory not found" -Type "Error"
        return $false
    }
    
    # Find all existing files
    $existingFiles = Get-ExistingFiles -ConfigName $ConfigName
    
    # Ensure $existingFiles is always an array
    $existingFiles = Ensure-Array -InputObject $existingFiles
    
    # Get the count for use in the script template
    $fileCount = $existingFiles.Count
    
    # Generate list script content
    $listScriptName = "${commandPrefix}list"
    $listScriptPath = Join-Path $winEnvsDir "${listScriptName}.bat"
    
    $listScriptContent = @"
@echo off
setlocal enabledelayedexpansion
REM $($config.Title) Command List with Delete Function
REM Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

echo.
echo $($config.Title) Available Commands:
echo =====================================
echo.

if not exist "%~dp0${commandPrefix}*.bat" (
    echo No ${commandPrefix} commands found.
    echo.
    pause
    exit /b
)

set /a counter=0
for %%f in ("%~dp0${commandPrefix}*.bat") do (
    set /a counter+=1
    echo   !counter!. %%~nf
)

echo.
echo Total: $fileCount files available
echo.
echo =====================================
echo File Management Options:
echo =====================================
echo 1. Delete a file (enter file number)
echo 2. Exit
echo.
set /p choice="Enter your choice (1-2): "

if "%choice%"=="1" goto :delete_file
if "%choice%"=="2" goto :end
echo Invalid choice. Please try again.
pause
goto :end

:delete_file
echo.
set /p file_num="Enter file number to delete: "
if "%file_num%"=="" goto :end

set /a counter=0
for %%f in ("%~dp0${commandPrefix}*.bat") do (
    set /a counter+=1
    if !counter!==%file_num% (
        echo.
        echo File to delete: %%~nf
        set /p confirm="Are you sure you want to delete this file? (Y/N): "
        if /i "%confirm%"=="Y" (
            del "%%f"
            echo File deleted successfully: %%~nf
        ) else (
            echo Deletion cancelled.
        )
        echo.
        pause
        goto :end
    )
)

echo File number %file_num% not found.
pause
goto :end

:end
echo.
echo Press any key to exit...
pause >nul
"@
    
    try {
        $listScriptContent | Out-File -FilePath $listScriptPath -Encoding ASCII -Force
        Write-ColorMessage -Message "List script generated: $listScriptPath" -Type "Success"
        return $true
    } catch {
        Write-ColorMessage -Message "Failed to generate list script: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Generate-GlobalCommand {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName,
        [Parameter(Mandatory=$false)] [string]$TargetCommandPath = $null
    )
    
    # DEBUG: Print function parameters
    Write-ColorMessage -Message "DEBUG: Generate-GlobalCommand called with ConfigName: '$ConfigName'" -Type "Info"
    Write-ColorMessage -Message "DEBUG: Generate-GlobalCommand called with TargetCommandPath: '$TargetCommandPath'" -Type "Info"
    Write-ColorMessage -Message "DEBUG: TargetCommandPath is null: $($null -eq $TargetCommandPath)" -Type "Info"
    Write-ColorMessage -Message "DEBUG: TargetCommandPath is empty: $([string]::IsNullOrEmpty($TargetCommandPath))" -Type "Info"
    
    if (-not $script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        Write-ColorMessage -Message "Configuration '$ConfigName' not found." -Type "Error"
        return $false
    }
    
    # Initialize global variables for current operation
    $script:CurrentConfigName = $ConfigName
    $script:CurrentConfig = $script:EnvironmentConfigs[$ConfigName]
    $script:CurrentCommandPrefix = Get-CommandPrefix -ConfigName $ConfigName
    $script:CurrentFileNumber = 1
    $script:CurrentWinEnvsDir = Join-Path $Global:LANG_COMPILER_DIR $Global:WINENVS_DIR
    $script:CurrentFileName = $null
    $script:CurrentBatchContent = $null
    $script:CurrentPsCommand = $script:CurrentConfig.Common
    
    # Initialize local variables
    $envCommands = @()
    $psEnvVars = @()
    
    # Validate configuration
    if ($null -eq $script:CurrentConfig) {
        Write-ColorMessage -Message "Configuration '$ConfigName' not found." -Type "Error"
        return $false
    }
    
    # Validate command prefix
    if ([string]::IsNullOrWhiteSpace($script:CurrentCommandPrefix)) {
        Write-ColorMessage -Message "No command prefix found for $ConfigName" -Type "Error"
        return $false
    }
    
    Clear-Host
    Write-ColorMessage -Message "Generate $($script:CurrentConfig.Title) Global Command" -Type "Info"
    Write-ColorMessage -Message $script:CurrentConfig.Description -Type "Info"
    Write-ColorMessage -Message ("=" * $script:CurrentConfig.Title.Length) -Type "Info"
    
    # Display operation type using global variables
    if ($script:IsReplacingFile) {
        $targetFileName = Split-Path $script:TargetFilePath -Leaf
        Write-ColorMessage -Message "Operation: Replacing existing file '$targetFileName'" -Type "Warning"
    } else {
        Write-ColorMessage -Message "Operation: Creating new file" -Type "Success"
    }
    Write-Host ""
    
    # Initialize environment variables for PowerShell
    $envCommands += "REM Environment variables for $($script:CurrentConfig.Title)"
    $envCommands += "REM Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $envCommands += ""
    
    foreach ($var in $script:CurrentConfig.Variables) {
        $prompt = "Please enter $($var.DisplayName):"
        if ($var.Description) {
            $prompt += "`nDescription: $($var.Description)"
        }
        
        Write-ColorMessage -Message $prompt -Type "Info"
        $userInput = Read-Host $var.DisplayName
        
        if (-not [string]::IsNullOrWhiteSpace($userInput)) {
            # Add to batch file for display
            $envCommands += "echo Setting $($var.Name)=$userInput"
            $envCommands += "set $($var.Name)=$userInput"
            # Add to PowerShell environment variables
            $psEnvVars += "`$env:$($var.Name)='$userInput'"
        } else {
            $envCommands += "echo Skipping $($var.Name) (not set)"
            $envCommands += "REM set $($var.Name)=  # Not set"
        }
    }
    
    # Use the Common value from config as the command to execute
    if ([string]::IsNullOrWhiteSpace($script:CurrentPsCommand)) {
        Write-ColorMessage -Message "No command specified in configuration." -Type "Error"
        return $false
    }
    
    Write-ColorMessage -Message "Command to execute: $script:CurrentPsCommand" -Type "Info"
    
    # Generate command filename - always generate to .winenvs directory
    if (-not (Test-Path $script:CurrentWinEnvsDir)) {
        New-Item -ItemType Directory -Path $script:CurrentWinEnvsDir -Force | Out-Null
        Write-ColorMessage -Message "Created .winenvs directory: $script:CurrentWinEnvsDir" -Type "Info"
    }
    
    # Use global variables to determine file generation mode
    if ($script:IsReplacingFile) {
        Write-ColorMessage -Message "DEBUG: Replacing existing file using global variables" -Type "Info"
        # Use the target file path from global variables
        $script:CurrentFileName = Split-Path $script:TargetFilePath -Leaf
        $TargetCommandPath = Join-Path $script:CurrentWinEnvsDir $script:CurrentFileName
        
        Write-ColorMessage -Message "DEBUG: Target file path: $script:TargetFilePath" -Type "Info"
        Write-ColorMessage -Message "DEBUG: Extracted filename: $script:CurrentFileName" -Type "Info"
        Write-ColorMessage -Message "DEBUG: Final target path: $TargetCommandPath" -Type "Info"
        
        # Extract file number from filename for display purposes
        if ($script:CurrentFileName -match "^${script:CurrentCommandPrefix}(\d+)\.bat$") {
            $script:CurrentFileNumber = [int]$matches[1]
            Write-ColorMessage -Message "DEBUG: Extracted file number: $script:CurrentFileNumber" -Type "Info"
        } else {
            $script:CurrentFileNumber = 1  # fallback
            Write-ColorMessage -Message "DEBUG: Could not extract file number, using fallback: $script:CurrentFileNumber" -Type "Info"
        }
    } else {
        Write-ColorMessage -Message "DEBUG: Creating new file using global variables" -Type "Info"
        # Generate new file number - find the first available number starting from 1
        $existingFiles = Get-ExistingFiles -ConfigName $script:CurrentConfigName
        $script:CurrentFileNumber = 1
        $existingNumbers = @()
        
        # Extract existing file numbers
        foreach ($file in $existingFiles) {
            if ($file.Name -match "^${script:CurrentCommandPrefix}(\d+)\.bat$") {
                $existingNumbers += [int]$matches[1]
            }
        }
        
        # Find the first available number starting from 1
        while ($existingNumbers -contains $script:CurrentFileNumber) {
            $script:CurrentFileNumber++
        }
        
        $script:CurrentFileName = "${script:CurrentCommandPrefix}${script:CurrentFileNumber}.bat"
        $TargetCommandPath = Join-Path $script:CurrentWinEnvsDir $script:CurrentFileName
        Write-ColorMessage -Message "DEBUG: Generated new file: $script:CurrentFileName (number: $script:CurrentFileNumber)" -Type "Info"
    }
    
    # Create batch script content
    $psEnvVarsString = $psEnvVars -join "; "

    # Check if this is a Claude command and add upgrade prompt + MCP sync
    $upgradeSection = ""
    if ($script:CurrentPsCommand -eq "claude") {
        $upgradeSection = @"

REM Prompt for upgrade and sync MCP configuration
echo.
echo ============================================================
echo Claude Code - Pre-Launch Tasks
echo ============================================================
echo.
echo Available tasks:
echo   [1] Upgrade Claude Code to latest version (runs in separate window)
echo   [2] Sync MCP server configurations (runs now)
echo.

REM Ask user if they want to upgrade
set /p UPGRADE_CHOICE="Do you want to upgrade Claude Code? (y/N): "
if /i "%UPGRADE_CHOICE%"=="y" (
    echo.
    echo [INFO] Launching upgrade in separate window...
    start "Claude Code Upgrade" "D:\programing\core_node\scripts\pytools\claude_tools\upgrade_claude_code.bat"
    echo [SUCCESS] Upgrade window opened
) else (
    echo [INFO] Skipping upgrade
)

echo.
echo ============================================================
echo Syncing MCP Server Configurations...
echo ============================================================
echo.

REM Run MCP sync in main thread with unbuffered output for real-time display
python -u "D:\programing\core_node\scripts\pytools\claude_tools\sync_mcp_servers.py"

set MCP_EXIT_CODE=%ERRORLEVEL%

if %MCP_EXIT_CODE% EQU 0 (
    echo [SUCCESS] MCP configuration sync completed
) else (
    echo [WARNING] MCP sync exited with code: %MCP_EXIT_CODE%
)

echo.
echo ============================================================
echo Press Enter to start Claude Code...
echo ============================================================
set /p CONTINUE="Press Enter to continue..."

"@
    }

    $script:CurrentBatchContent = @"
@echo off
REM $($script:CurrentConfig.Title) Global File #$script:CurrentFileNumber
REM Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

REM Set environment variables
$($envCommands -join "`n")
$upgradeSection
REM Execute PowerShell command with environment variables
echo Executing: $script:CurrentPsCommand
echo.
echo PowerShell Command: powershell -NoProfile -ExecutionPolicy Bypass -Command "$psEnvVarsString; $script:CurrentPsCommand"
echo.
echo Press any key to continue...
pause >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$psEnvVarsString; $script:CurrentPsCommand"

echo.
pause
"@
    
    # Preview the generated content
    Write-ColorMessage -Message "`nPreview of generated batch file:" -Type "Info"
    Write-ColorMessage -Message "File: $TargetCommandPath" -Type "Info"
    Write-ColorMessage -Message ("=" * 50) -Type "Info"
    Write-Host $script:CurrentBatchContent -ForegroundColor Cyan
    Write-ColorMessage -Message ("=" * 50) -Type "Info"
    
    # Ask for confirmation
    Write-ColorMessage -Message "Press Enter to generate, any other key to cancel" -Type "Info"
    $confirm = Read-Host "Confirm"
    if ($confirm -ne '') {
        Write-ColorMessage -Message "Command generation cancelled." -Type "Warning"
        return $false
    }
    
    # Ensure directory exists
    $commandDir = Split-Path $TargetCommandPath -Parent
    if (-not (Test-Path $commandDir)) {
        New-Item -ItemType Directory -Path $commandDir -Force | Out-Null
    }
    
    # Write batch file using the new addscript method
    Write-ColorMessage -Message "DEBUG: Calling addscript with filename: '$script:CurrentFileName'" -Type "Info"
    Write-ColorMessage -Message "DEBUG: TargetCommandPath: '$TargetCommandPath'" -Type "Info"
    & $script:WINDOWS_PATH_FUNCTION_PATH "addscript" $script:CurrentBatchContent $script:CurrentFileName
    
    Write-ColorMessage -Message "Global command generated successfully: $TargetCommandPath" -Type "Success"
    Write-ColorMessage -Message "File written to .winenvs directory using addscript method" -Type "Success"
    
    # Verify file was created
    if (Test-Path $TargetCommandPath) {
        Write-ColorMessage -Message "File verification: SUCCESS" -Type "Success"
    } else {
        Write-ColorMessage -Message "File verification: FAILED" -Type "Error"
    }
    
    # Generate or update list script
    Generate-ListScript -ConfigName $script:CurrentConfigName | Out-Null
    
    return $true
}

#endregion

#region Generic Environment Variables Functions
function Set-EnvironmentVariables {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    if (-not $script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        Write-ColorMessage -Message "Configuration '$ConfigName' not found." -Type "Error"
        return
    }
    
    $config = $script:EnvironmentConfigs[$ConfigName]
    
    Clear-Host
    Write-ColorMessage -Message $config.Title -Type "Info"
    Write-ColorMessage -Message $config.Description -Type "Info"
    Write-ColorMessage -Message ("=" * $config.Title.Length) -Type "Info"
    
    # Check admin privileges
    if (-not (Test-AdminPrivileges)) {
        Write-ColorMessage -Message "This operation requires administrator privileges." -Type "Error"
        Write-ColorMessage -Message "Please run this script as administrator." -Type "Warning"
        Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
        $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    
    # Get current values
    $currentValues = @{}
    Write-ColorMessage -Message "Current environment variable status:" -Type "Info"
    foreach ($var in $config.Variables) {
        $currentValue = Get-EnvironmentVariable -VariableName $var.Name
        $currentValues[$var.Name] = $currentValue
        
        if ($currentValue) {
            if ($var.IsSecret) {
                Write-ColorMessage -Message "$($var.Name) ($($var.DisplayName)): [HIDDEN - Already set]" -Type "Success"
            } else {
                Write-ColorMessage -Message "$($var.Name) ($($var.DisplayName)): $currentValue" -Type "Success"
            }
        } else {
            Write-ColorMessage -Message "$($var.Name) ($($var.DisplayName)): [Not set - Will be configured]" -Type "Warning"
        }
    }
    
    Write-ColorMessage -Message "Now you will be prompted to enter values for each environment variable." -Type "Info"
    Write-ColorMessage -Message "If a variable is already set, you can press Enter to keep the current value or skip setting." -Type "Info"
    Write-ColorMessage -Message "If a variable is not set, you can press Enter to skip setting it." -Type "Info"
    
    # Get user input for each variable
    $newValues = @{}
    $emptyVariables = @()
    $temporarilyCleared = @()  # Track variables that were temporarily cleared
    $extractedData = $null     # Store extracted data for auto-filling next variables
    $skipNext = $false         # Flag to skip next variable input
    
    for ($i = 0; $i -lt $config.Variables.Count; $i++) {
        $var = $config.Variables[$i]
        $hasCurrentValue = $currentValues[$var.Name]
        
        # Check if we should skip this variable (auto-filled from previous extraction)
        if ($skipNext) {
            $skipNext = $false
            $autoValue = Get-ValueForNextVariable -Variable $var -ExtractedData $extractedData
            if ($autoValue) {
                $newValues[$var.Name] = $autoValue
                if ($var.IsSecret) {
                    Write-ColorMessage -Message "Auto-filled $($var.DisplayName): [HIDDEN]" -Type "Success"
                } else {
                    Write-ColorMessage -Message "Auto-filled $($var.DisplayName): $autoValue" -Type "Success"
                }
                continue
            }
        }
        
        # Use smart input processing
        $inputResult = Get-SmartInputForVariable -Variable $var -Config $config -HasCurrentValue $hasCurrentValue -CurrentValue $currentValues[$var.Name]
        $userInput = $inputResult.Value
        $extractedData = $inputResult.ExtractedData
        $skipNext = $inputResult.ShouldSkipNext
        
        if ([string]::IsNullOrWhiteSpace($userInput)) {
            if ($hasCurrentValue) {
                # Show options for variables that have current values
                Write-ColorMessage -Message "Variable has current value. Choose action:" -Type "Info"
                Write-ColorMessage -Message "1. Keep current value" -Type "Info"
                Write-ColorMessage -Message "2. Set to empty (delete key)" -Type "Info"
                Write-ColorMessage -Message "3. Set to empty (keep key)" -Type "Info"
                Write-ColorMessage -Message "4. Temporarily clear (current session only)" -Type "Info"
                
                $choice = Read-Host "Enter choice (1-4, default: 1)"
                
                # Handle empty input as default choice
                if ([string]::IsNullOrWhiteSpace($choice)) {
                    $choice = "1"
                }
                
                switch ($choice) {
                    "2" {
                        $newValues[$var.Name] = "__DELETE__"
                        Write-ColorMessage -Message "Setting $($var.DisplayName) to empty (deleting key)" -Type "Info"
                    }
                    "3" {
                        $newValues[$var.Name] = ""
                        Write-ColorMessage -Message "Setting $($var.DisplayName) to empty (keeping key)" -Type "Info"
                    }
                    "4" {
                        # Temporarily clear in current session only
                        $temporarilyCleared += $var.Name
                        Write-ColorMessage -Message "Marked $($var.DisplayName) for temporary clearing" -Type "Success"
                        Write-ColorMessage -Message "System environment variable unchanged" -Type "Info"
                        Write-ColorMessage -Message "Command to clear: `$env:$($var.Name) = `"`"" -Type "Info"
                        # Don't add to newValues, so it won't be processed in the system update
                    }
                    default {
                        $newValues[$var.Name] = $currentValues[$var.Name]
                        if ($var.IsSecret) {
                            Write-ColorMessage -Message "Keeping current value: [HIDDEN]" -Type "Info"
                        } else {
                            Write-ColorMessage -Message "Keeping current value: $($currentValues[$var.Name])" -Type "Info"
                        }
                    }
                }
            } else {
                Write-ColorMessage -Message "Skipping $($var.DisplayName) - no value entered" -Type "Warning"
                $emptyVariables += $var
                # Don't add to newValues, effectively skipping this variable
            }
        } else {
            $newValues[$var.Name] = $userInput
            if ($var.IsSecret) {
                Write-ColorMessage -Message "New value set: [HIDDEN]" -Type "Success"
            } else {
                Write-ColorMessage -Message "New value set: $userInput" -Type "Success"
            }
        }
    }
    
    # Check if any variables are empty and show selection menu
    if ($emptyVariables.Count -gt 0) {
        if ($emptyVariables.Count -eq 1) {
            Write-ColorMessage -Message "One variable was left empty. Please choose how to handle it:" -Type "Warning"
        } else {
            Write-ColorMessage -Message "Multiple variables were left empty. Please choose how to handle them:" -Type "Warning"
        }
        Write-ColorMessage -Message "Empty variables:" -Type "Info"
        foreach ($var in $emptyVariables) {
            Write-ColorMessage -Message "  - $($var.DisplayName)" -Type "Info"
        }
        
        $emptyVariablesChoice = Show-EmptyVariablesMenu
        switch ($emptyVariablesChoice) {
            'keep' {
                Write-ColorMessage -Message "Keeping old values for empty variables..." -Type "Info"
                foreach ($var in $emptyVariables) {
                    if ($currentValues[$var.Name]) {
                        $newValues[$var.Name] = $currentValues[$var.Name]
                        if ($var.IsSecret) {
                            Write-ColorMessage -Message "Keeping $($var.DisplayName): [HIDDEN]" -Type "Info"
                        } else {
                            Write-ColorMessage -Message "Keeping $($var.DisplayName): $($currentValues[$var.Name])" -Type "Info"
                        }
                    }
                }
            }
            'delete' {
                Write-ColorMessage -Message "Deleting empty variables..." -Type "Info"
                foreach ($var in $emptyVariables) {
                    $newValues[$var.Name] = ""
                    Write-ColorMessage -Message "Deleting $($var.DisplayName)" -Type "Info"
                }
            }
            'empty' {
                Write-ColorMessage -Message "Setting empty variables to empty values..." -Type "Info"
                foreach ($var in $emptyVariables) {
                    $newValues[$var.Name] = ""
                    Write-ColorMessage -Message "Setting $($var.DisplayName) to empty" -Type "Info"
                }
            }
        }
    }
    
    # Set environment variables
    if ($newValues.Count -gt 0) {
        Write-ColorMessage -Message "Setting environment variables..." -Type "Info"
        
        $successCount = 0
        $totalCount = $newValues.Count  # Only count variables that need to be set
        
        foreach ($var in $config.Variables) {
            if ($newValues.ContainsKey($var.Name)) {
                if ($newValues[$var.Name] -eq "__DELETE__") {
                    # Delete the environment variable
                    $success = Set-EnvironmentVariable -VariableName $var.Name -Delete
                    if ($success) {
                        $successCount++
                        Write-ColorMessage -Message "Deleted $($var.DisplayName)" -Type "Success"
                    }
                } else {
                    # Set the environment variable
                    $success = Set-EnvironmentVariable -VariableName $var.Name -VariableValue $newValues[$var.Name]
                    if ($success) {
                        $successCount++
                        if ($var.IsSecret) {
                            Write-ColorMessage -Message "Set $($var.DisplayName): [HIDDEN]" -Type "Success"
                        } else {
                            Write-ColorMessage -Message "Set $($var.DisplayName): $($newValues[$var.Name])" -Type "Success"
                        }
                    }
                }
            }
        }
    } else {
        Write-ColorMessage -Message "No system environment variables to set (all variables were temporarily cleared or skipped)" -Type "Info"
        $successCount = 0
        $totalCount = 0
    }
    
    if ($successCount -eq $totalCount) {
        Write-ColorMessage -Message "Environment variables processed successfully!" -Type "Success"
        foreach ($var in $config.Variables) {
            if ($newValues.ContainsKey($var.Name)) {
                if ($newValues[$var.Name] -eq "__DELETE__") {
                    Write-ColorMessage -Message "$($var.DisplayName): [DELETED]" -Type "Info"
                } else {
                    if ($var.IsSecret) {
                        Write-ColorMessage -Message "$($var.DisplayName): [HIDDEN]" -Type "Info"
                    } else {
                        Write-ColorMessage -Message "$($var.DisplayName): $($newValues[$var.Name])" -Type "Info"
                    }
                }
            } elseif ($temporarilyCleared -contains $var.Name) {
                Write-ColorMessage -Message "$($var.DisplayName): [TEMPORARILY CLEARED]" -Type "Info"
            }
        }
        
        # Refresh environment variables in current session
        # Always refresh if there are any changes (system changes or temporary clearing)
        if ($newValues.Count -gt 0 -or $temporarilyCleared.Count -gt 0) {
            Write-ColorMessage -Message "Refreshing environment variables in current session..." -Type "Info"
            
            # Refresh all environment variables (including deleted ones)
            & $script:WINDOWS_PATH_FUNCTION_PATH "refreshvar" | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "All environment variables have been refreshed in the current session." -Type "Success"
                
                # Re-apply temporary clearing for variables that were temporarily cleared
                # This must be done after refresh to override the refreshed values
                if ($temporarilyCleared.Count -gt 0) {
                    Write-ColorMessage -Message "Attempting to clear environment variables..." -Type "Info"
                    
                    # Try to clear the variables directly
                    $clearedCount = 0
                    foreach ($varName in $temporarilyCleared) {
                        try {
                            Set-Item -Path "env:$varName" -Value ""
                            $clearedCount++
                            Write-ColorMessage -Message "Cleared $varName" -Type "Success"
                        } catch {
                            $errorMsg = $_.Exception.Message
                            Write-ColorMessage -Message "Failed to clear ${varName}: $errorMsg" -Type "Error"
                        }
                    }
                    
                    # Always provide manual commands as backup
                    Write-ColorMessage -Message "Manual commands to clear variables (copy and paste):" -Type "Warning"
                    Write-Host ""
                    foreach ($varName in $temporarilyCleared) {
                        $clearCommand = "`$env:$varName = `"`""
                        Write-Host "  $clearCommand" -ForegroundColor Cyan
                    }
                    Write-Host ""
                    Write-ColorMessage -Message "Or run this single command:" -Type "Info"
                    $allClearCommands = $temporarilyCleared | ForEach-Object { "`$env:$_ = `"`"" }
                    Write-Host "  $($allClearCommands -join '; ')" -ForegroundColor Yellow
                    Write-Host ""
                    
                    if ($clearedCount -lt $temporarilyCleared.Count) {
                        Write-ColorMessage -Message "Some variables could not be cleared automatically." -Type "Warning"
                    } else {
                        Write-ColorMessage -Message "Variables marked for clearing. Use commands above if needed." -Type "Info"
                    }
                }
                
                # Show specific status for each variable that was modified
                foreach ($var in $config.Variables) {
                    if ($newValues.ContainsKey($var.Name)) {
                        if ($newValues[$var.Name] -eq "__DELETE__") {
                            Write-ColorMessage -Message "Refreshed $($var.DisplayName) (deleted)" -Type "Success"
                        } else {
                            Write-ColorMessage -Message "Refreshed $($var.DisplayName)" -Type "Success"
                        }
                    } elseif ($temporarilyCleared -contains $var.Name) {
                        Write-ColorMessage -Message "Refreshed $($var.DisplayName) (temporarily cleared)" -Type "Info"
                    }
                }
            } else {
                Write-ColorMessage -Message "Failed to refresh environment variables in current session." -Type "Error"
            }
        } else {
            Write-ColorMessage -Message "No environment variables to refresh." -Type "Info"
        }
        Write-ColorMessage -Message "Note: You may need to restart your applications to use the new environment variables." -Type "Warning"
    } else {
        Write-ColorMessage -Message "Failed to set some environment variables. Please check the errors above." -Type "Error"
        Write-ColorMessage -Message "This might be due to insufficient permissions or system restrictions." -Type "Warning"
    }
    
    Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Show-EnvironmentVariables {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    if (-not $script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        Write-ColorMessage -Message "Configuration '$ConfigName' not found." -Type "Error"
        return
    }
    
    $config = $script:EnvironmentConfigs[$ConfigName]
    
    Clear-Host
    Write-ColorMessage -Message $config.Title -Type "Info"
    Write-ColorMessage -Message $config.Description -Type "Info"
    Write-ColorMessage -Message ("=" * $config.Title.Length) -Type "Info"
    
    foreach ($var in $config.Variables) {
        $value = Get-EnvironmentVariable -VariableName $var.Name
        
        Write-ColorMessage -Message "$($var.DisplayName): " -NoNewline -Type "Info"
        if ($value) {
            if ($var.IsSecret) {
                Write-ColorMessage -Message "[HIDDEN - Set]" -Type "Success"
            } else {
                Write-ColorMessage -Message $value -Type "Success"
            }
        } else {
            Write-ColorMessage -Message "[Not set]" -Type "Warning"
        }
    }
    
    Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Show-AllEnvironmentVariables {
    Clear-Host
    Write-ColorMessage -Message "All Environment Variables Status" -Type "Info"
    Write-ColorMessage -Message "===============================" -Type "Info"
    
    foreach ($configName in $script:EnvironmentConfigs.Keys) {
        $config = $script:EnvironmentConfigs[$configName]
        Write-Host ""
        Write-ColorMessage -Message $config.Title -Type "Info"
        Write-ColorMessage -Message ("-" * $config.Title.Length) -Type "Info"
        
        foreach ($var in $config.Variables) {
            $value = Get-EnvironmentVariable -VariableName $var.Name
            
            if ($value) {
                if ($var.IsSecret) {
                    Write-ColorMessage -Message "$($var.DisplayName): [HIDDEN - Set]" -Type "Success"
                } else {
                    Write-ColorMessage -Message "$($var.DisplayName): $value" -Type "Success"
                }
            } else {
                Write-ColorMessage -Message "$($var.DisplayName): [Not set]" -Type "Warning"
            }
        }
    }
    
    Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Refresh-CurrentTerminalEnvironment {
    Clear-Host
    Write-ColorMessage -Message "Refresh Current Terminal Environment" -Type "Info"
    Write-ColorMessage -Message "====================================" -Type "Info"
    Write-ColorMessage -Message "This will refresh all environment variables in the current terminal session." -Type "Info"
    Write-ColorMessage -Message "No system changes will be made - only current terminal will be updated." -Type "Info"
    Write-Host ""
    
    Write-ColorMessage -Message "Refreshing all environment variables..." -Type "Info"
    
    try {
        # Call the refreshvar function from WindowsPathFunction.ps1
        if (Test-Path $script:WINDOWS_PATH_FUNCTION_PATH) {
            & $script:WINDOWS_PATH_FUNCTION_PATH "refreshvar" | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "All environment variables refreshed successfully!" -Type "Success"
                Write-ColorMessage -Message "Current terminal session now has the latest environment variables." -Type "Success"
                
                # Show status of all configured environment variables
                Write-Host ""
                Write-ColorMessage -Message "Current status of configured environment variables:" -Type "Info"
                Write-ColorMessage -Message "=================================================" -Type "Info"
                
                foreach ($configName in $script:EnvironmentConfigs.Keys) {
                    $config = $script:EnvironmentConfigs[$configName]
                    Write-ColorMessage -Message "$($config.Title):" -Type "Info"
                    
                    foreach ($var in $config.Variables) {
                        $currentValue = Get-EnvironmentVariable -VariableName $var.Name
                        if ($currentValue) {
                            if ($var.IsSecret) {
                                Write-ColorMessage -Message "  $($var.DisplayName): [HIDDEN - Set]" -Type "Success"
                            } else {
                                Write-ColorMessage -Message "  $($var.DisplayName): $currentValue" -Type "Success"
                            }
                        } else {
                            Write-ColorMessage -Message "  $($var.DisplayName): [Not set]" -Type "Warning"
                        }
                    }
                    Write-Host ""
                }
            } else {
                Write-ColorMessage -Message "Failed to refresh environment variables." -Type "Error"
            }
        } else {
            Write-ColorMessage -Message "Error: WindowsPathFunction.ps1 not found at: $script:WINDOWS_PATH_FUNCTION_PATH" -Type "Error"
        }
    } catch {
        Write-ColorMessage -Message "Error occurred while refreshing environment variables: $($_.Exception.Message)" -Type "Error"
    }
    
    Write-Host ""
    Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
#endregion

#region Empty Variables Menu Function
function Show-EmptyVariablesMenu {
    $menuItems = @(
        @{ Text = "Keep old values (default)"; Action = "keep" },
        @{ Text = "Delete variables"; Action = "delete" },
        @{ Text = "Set to empty values"; Action = "empty" }
    )
    
    $selectedIndex = 0
    
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "Empty Variables Handling Options" -Type "Info"
        Write-ColorMessage -Message "Use Up/Down arrows to navigate, Enter to select" -Type "Info"
        Write-ColorMessage -Message "=" -Type "Info"
        
        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selectedIndex) {
                Write-Host "> $($menuItems[$i].Text)" -ForegroundColor Yellow
            } else {
                Write-Host "  $($menuItems[$i].Text)" -ForegroundColor White
            }
        }
        
        $key = [Console]::ReadKey($true).Key
        
        switch ($key) {
            'UpArrow' {
                $selectedIndex = if ($selectedIndex -gt 0) { $selectedIndex - 1 } else { $menuItems.Count - 1 }
            }
            'DownArrow' {
                $selectedIndex = if ($selectedIndex -lt $menuItems.Count - 1) { $selectedIndex + 1 } else { 0 }
            }
            'Enter' {
                return $menuItems[$selectedIndex].Action
            }
        }
    }
}
#endregion

#region Main Menu Functions
function Show-SpecialSoftwareEnvMenu {
    $menuItems = @(
        @{ Text = "Claude AI"; Action = "claude"; HasSubMenu = $true },
        @{ Text = "Alibaba Cloud"; Action = "alibaba"; HasSubMenu = $true },
        @{ Text = "View All Environment Variables"; Action = "viewall"; HasSubMenu = $false },
        @{ Text = "Refresh Current Terminal Environment"; Action = "refresh"; HasSubMenu = $false },
        @{ Text = "Back to Main Menu"; Action = "back"; HasSubMenu = $false },
        @{ Text = "Exit"; Action = "exit"; HasSubMenu = $false }
    )
    
    $selectedIndex = 0
    
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "Special Software Environment Variables Manager" -Type "Info"
        Write-ColorMessage -Message "Use Up/Down arrows to navigate, Enter to select" -Type "Info"
        Write-ColorMessage -Message "=" -Type "Info"
        
        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selectedIndex) {
                if ($menuItems[$i].HasSubMenu) {
                    Write-Host "> $($menuItems[$i].Text) >" -ForegroundColor Yellow
                } else {
                    Write-Host "> $($menuItems[$i].Text)" -ForegroundColor Yellow
                }
            } else {
                if ($menuItems[$i].HasSubMenu) {
                    Write-Host "  $($menuItems[$i].Text) >" -ForegroundColor White
                } else {
                    Write-Host "  $($menuItems[$i].Text)" -ForegroundColor White
                }
            }
        }
        
        $key = [Console]::ReadKey($true).Key
        
        switch ($key) {
            'UpArrow' {
                $selectedIndex = if ($selectedIndex -gt 0) { $selectedIndex - 1 } else { $menuItems.Count - 1 }
            }
            'DownArrow' {
                $selectedIndex = if ($selectedIndex -lt $menuItems.Count - 1) { $selectedIndex + 1 } else { 0 }
            }
            'Enter' {
                $action = $menuItems[$selectedIndex].Action
                $hasSubMenu = $menuItems[$selectedIndex].HasSubMenu
                
                if ($hasSubMenu) {
                    # Convert action to full config name
                    $fullConfigName = Get-FullConfigName -Action $action
                    Show-SubMenu -ConfigName $fullConfigName
                } else {
                    switch ($action) {
                        'viewall' { Show-AllEnvironmentVariables }
                        'refresh' { Refresh-CurrentTerminalEnvironment }
                        'back' { return }
                        'exit' { exit }
                    }
                }
            }
        }
    }
}

function Show-SubMenu {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )
    
    $configDisplayName = Get-ConfigDisplayName -ConfigName $ConfigName
    
    $menuItems = @(
        @{ Text = "Add $configDisplayName Global Command"; Action = "addcommand" },
        @{ Text = "Set $configDisplayName Environment Variables"; Action = "setenv" },
        @{ Text = "View $configDisplayName Scripts"; Action = "viewscripts" },
        @{ Text = "Back to Main Menu"; Action = "back" }
    )
    
    $selectedIndex = 0
    
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "$configDisplayName - Sub Menu" -Type "Info"
        Write-ColorMessage -Message "Use Up/Down arrows to navigate, Enter to select" -Type "Info"
        Write-ColorMessage -Message "=" -Type "Info"
        
        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selectedIndex) {
                Write-Host "> $($menuItems[$i].Text)" -ForegroundColor Yellow
            } else {
                Write-Host "  $($menuItems[$i].Text)" -ForegroundColor White
            }
        }
        
        $key = [Console]::ReadKey($true).Key
        
        switch ($key) {
            'UpArrow' {
                $selectedIndex = if ($selectedIndex -gt 0) { $selectedIndex - 1 } else { $menuItems.Count - 1 }
            }
            'DownArrow' {
                $selectedIndex = if ($selectedIndex -lt $menuItems.Count - 1) { $selectedIndex + 1 } else { 0 }
            }
            'Enter' {
                $action = $menuItems[$selectedIndex].Action
                switch ($action) {
                    'addcommand' { 
                        $existingFiles = Get-ExistingFiles -ConfigName $ConfigName
                        
                        # Ensure $existingFiles is always an array
                        $existingFiles = Ensure-Array -InputObject $existingFiles
                        
                        Show-ExistingFilesMenu -ConfigName $ConfigName -Files $existingFiles
                        
                        # Use global variables to determine action
                        if ($script:IsReplacingFile) {
                            Write-ColorMessage -Message "DEBUG: Replacing existing file: $script:TargetFilePath" -Type "Info"
                            Generate-GlobalCommand -ConfigName $ConfigName -TargetCommandPath $script:TargetFilePath
                        } else {
                            Write-ColorMessage -Message "DEBUG: Creating new file" -Type "Info"
                            Generate-GlobalCommand -ConfigName $ConfigName
                        }
                    }
                    'setenv' { Set-EnvironmentVariables -ConfigName $ConfigName }
                    'viewscripts' { Show-ListScripts -ConfigName $ConfigName }
                    'back' { return }
                }
            }
        }
    }
}
#endregion

#region Main Execution
# Check if running as administrator
if (-not (Test-AdminPrivileges)) {
    Write-ColorMessage -Message "This script requires administrator privileges." -Type "Error"
    Write-ColorMessage -Message "Please run as administrator to manage system environment variables." -Type "Warning"
    Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Show main menu
Show-SpecialSoftwareEnvMenu
#endregion

