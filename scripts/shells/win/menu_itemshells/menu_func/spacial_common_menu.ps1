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
    Common Functions Module for Special Software Environment Manager
.DESCRIPTION
    Contains all shared functions and utilities used by AI tool menu modules
#>

#region Variable Declarations
$script:SecretManagerPassword = $null
$script:AutoFilledVariables = @{}
#endregion

#region Helper Functions

function Write-ColorMessage {
    param(
        [Parameter(Mandatory=$true)] [AllowEmptyString()] [string]$Message,
        [Parameter(Mandatory=$false)] [string]$Type = "Info",
        [Parameter(Mandatory=$false)] [switch]$NoNewline
    )
    
    $color = switch ($Type) {
        "Error" { "Red" }
        "Warning" { "Yellow" }
        "Success" { "Green" }
        "Info" { "Cyan" }
        default { "White" }
    }
    
    if ($Message -eq "") {
        if ($NoNewline) {
            Write-Host "" -NoNewline
        } else {
            Write-Host ""
        }
        return
    }
    
    if ($NoNewline) {
        Write-Host $Message -ForegroundColor $color -NoNewline
    } else {
        Write-Host $Message -ForegroundColor $color
    }
}

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
        & $script:WINDOWS_PATH_FUNCTION_PATH "delvar" $VariableName
    } else {
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

function Save-SecretToManager {
    param(
        [Parameter(Mandatory=$true)] [string]$KeyName,
        [Parameter(Mandatory=$true)] [string]$Value,
        [Parameter(Mandatory=$false)] [string]$Password = $null,
        [Parameter(Mandatory=$false)] [switch]$SkipEncryption
    )

    if ([string]::IsNullOrWhiteSpace($KeyName) -or [string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }

    if (-not (Get-Command Set-SecretKey -ErrorAction SilentlyContinue)) {
        Write-ColorMessage -Message "SecretManager not loaded. Please ensure SecretManager.ps1 is sourced." -Type "Error"
        return $false
    }

    try {
        if ([string]::IsNullOrWhiteSpace($Password) -and -not $SkipEncryption) {
            if (-not (Get-Variable -Name "script:SecretManagerPassword" -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace($script:SecretManagerPassword)) {
                $Password = $script:SecretManagerPassword
            }
        }

        if ($SkipEncryption) {
            $result = Set-SecretKey -KeyName $KeyName -Value $Value -SkipEncryption
        } elseif (-not [string]::IsNullOrWhiteSpace($Password)) {
            $result = Set-SecretKey -KeyName $KeyName -Value $Value -Password $Password
            if ($result) {
                $script:SecretManagerPassword = $Password
            }
        } else {
            $result = Set-SecretKey -KeyName $KeyName -Value $Value
            if ($result) {
                $script:SecretManagerPassword = $Password
            }
        }

        return $result
    } catch {
        Write-ColorMessage -Message "Failed to save secret to SecretManager: $KeyName - $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

#endregion

#region Smart Recognition Helper Functions

function Test-StringHasWhitespaceInMiddle {
    param(
        [Parameter(Mandatory=$true)] [string]$InputString
    )
    
    $trimmed = $InputString.Trim()
    if ($trimmed.Length -ne $InputString.Length) {
        return $true
    }
    
    if ($InputString -match '\s') {
        return $true
    }
    
    if ($InputString -match '[\r\n]') {
        return $true
    }
    
    return $false
}

function Extract-ApiUrlAndToken {
    param(
        [Parameter(Mandatory=$true)] [string]$InputText
    )
    
    $cleanedText = $InputText -replace '\r\n|\r|\n', ' '
    $cleanedText = $cleanedText -replace '\s+', ' '
    $cleanedText = $cleanedText.Trim()
    
    $tokens = $cleanedText -split '[\s\n\r]+' |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne '' }
    
    $apiUrls = @()
    $foundTokens = @()
    $accessKeyIds = @()
    
    foreach ($token in $tokens) {
        if ($token -match '^https?://') {
            $apiUrls += $token
        } elseif ($token -match '^[A-Z0-9]{16,}$') {
            $accessKeyIds += $token
        } elseif ($token.Length -gt 37) {
            $foundTokens += $token
        }
    }
    
    return @{
        ApiUrls = $apiUrls
        Tokens = $foundTokens
        AccessKeyIds = $accessKeyIds
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
        [Parameter(Mandatory=$false)] [bool]$IsRequired = $false
    )

    $smartRecognitionEnabled = $false
    try {
        if ($Config -and $Config.ContainsKey("SmartRecognition") -and $Config.SmartRecognition -and $Config.SmartRecognition.ContainsKey("Enabled") -and $Config.SmartRecognition.Enabled) {
            $smartRecognitionEnabled = $true
        }
    } catch {
        $smartRecognitionEnabled = $false
    }

    $currentInputType = ""
    try {
        if ($Variable -and $Variable.ContainsKey("InputType") -and $Variable.InputType) {
            $currentInputType = $Variable.InputType
        }
    } catch {
        $currentInputType = ""
    }

    $sameTypeCount = 0
    $currentTypeIndex = -1
    $hasPreviousSameTypeWithValue = $false
    $hasAutoFilledSameType = $false

    try {
        if ($Config -and $Config.ContainsKey("Variables") -and $Config.Variables) {
            $currentVariableIndex = $Config.Variables.IndexOf($Variable)

            for ($i = 0; $i -lt $Config.Variables.Count; $i++) {
                $v = $Config.Variables[$i]
                $vType = ""
                if ($v -and $v.ContainsKey("InputType") -and $v.InputType) {
                    $vType = $v.InputType
                }

                if ($vType -eq $currentInputType -and $currentInputType -ne "") {
                    if ($i -eq $currentVariableIndex) {
                        $currentTypeIndex = $sameTypeCount
                    }
                    if ($i -lt $currentVariableIndex) {
                        if ($script:UserInputValues -and $script:UserInputValues.ContainsKey($v.Name) -and -not [string]::IsNullOrWhiteSpace($script:UserInputValues[$v.Name])) {
                            $hasPreviousSameTypeWithValue = $true
                        }
                        if ($script:AutoFilledVariables -and $script:AutoFilledVariables.ContainsKey($v.Name)) {
                            $hasAutoFilledSameType = $true
                        }
                    }
                    $sameTypeCount++
                }
            }
        }
    } catch {
        $sameTypeCount = 0
        $currentTypeIndex = -1
    }

    $promptSuffix = ""
    if ($HasCurrentValue) {
        $promptSuffix = "(or press Enter to keep current value)"
    } elseif ($IsRequired) {
        $promptSuffix = "(required)"
    } elseif ($hasAutoFilledSameType) {
        $promptSuffix = "(optional, same type already auto-filled from smart recognition)"
    } elseif ($hasPreviousSameTypeWithValue -and $currentInputType -eq "Token") {
        $promptSuffix = "(required, previous token was provided)"
    } else {
        $promptSuffix = "(or press Enter to skip)"
    }

    $prompt = "Please enter $($Variable.DisplayName) $promptSuffix"

    if ($Variable.Description) {
        $prompt = $prompt + "`nDescription: $($Variable.Description)"
    }

    $defaultValue = Get-DefaultValueForVariable -Variable $Variable
    if ($defaultValue) {
        $prompt = $prompt + "`nDefault value: $defaultValue (from $($Variable.DefaultValue))"
    }

    try {
        if ($smartRecognitionEnabled) {
            $isFirstVariable = $false
            if ($Config -and $Config.ContainsKey("Variables") -and $Config.Variables) {
                $isFirstVariable = ($Config.Variables.IndexOf($Variable) -eq 0)
            }

            if ($isFirstVariable) {
                $prompt = $prompt + "`nNote: Multi-line input is supported and will be intelligently parsed."
                $prompt = $prompt + "`nIf input contains spaces or line breaks, smart extraction will be applied."
                $prompt = $prompt + "`nSubsequent variables may be auto-filled if both URL and Token are detected."
            }
        }
    } catch {
    }

    Write-ColorMessage -Message $prompt -Type "Info"

    $userInput = Read-Host $Variable.DisplayName

    if ([string]::IsNullOrWhiteSpace($userInput)) {
        if ($IsRequired -or (($hasPreviousSameTypeWithValue -and $currentInputType -eq "Token") -and -not $hasAutoFilledSameType)) {
            Write-ColorMessage -Message "This field is required. Please provide a value." -Type "Warning"
            return Get-SmartInputForVariable -Variable $Variable -Config $Config -HasCurrentValue $HasCurrentValue -IsRequired $true
        }

        $defaultValue = Get-DefaultValueForVariable -Variable $Variable
        if ($defaultValue) {
            return @{
                Value = $defaultValue
                ExtractedData = $null
                ShouldSkipNext = $false
            }
        }

        if ($hasAutoFilledSameType) {
            Write-ColorMessage -Message "Skipped (same type already auto-filled)" -Type "Info"
        }

        return @{
            Value = $null
            ExtractedData = $null
            ShouldSkipNext = $false
        }
    }

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
        if (Test-StringHasWhitespaceInMiddle -InputString $userInput) {
            Write-ColorMessage -Message "Multi-line input detected. Applying smart recognition..." -Type "Info"

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

            Write-ColorMessage -Message "" -Type "Info"
            Write-ColorMessage -Message "Press Enter to continue with smart extraction, or any other key to return to manual input:" -Type "Info"
            $confirmKey = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

            if ($confirmKey.Character -ne "`r" -and $confirmKey.Character -ne "`n") {
                Write-ColorMessage -Message "Returning to manual input..." -Type "Info"
                return @{
                    Value = $userInput
                    ExtractedData = $null
                    ShouldSkipNext = $false
                    TokenFillStrategy = $null
                    TargetTokenVariable = $null
                }
            }

            Write-ColorMessage -Message "Continuing with smart extraction..." -Type "Success"

            $tokenFillStrategy = "all"
            $targetTokenVariable = $null

            if ($extractedData.Tokens.Count -gt 0) {
                $tokenVariables = @()
                try {
                    if ($Config -and $Config.ContainsKey("Variables") -and $Config.Variables) {
                        foreach ($v in $Config.Variables) {
                            if ($v -and $v.ContainsKey("InputType") -and $v.InputType -eq "Token") {
                                $tokenVariables += $v
                            }
                        }
                    }
                } catch {
                    $tokenVariables = @()
                }

                if ($tokenVariables.Count -gt 1) {
                    Write-ColorMessage -Message "" -Type "Info"
                    Write-ColorMessage -Message "Token filling strategy:" -Type "Info"
                    Write-ColorMessage -Message "  [Enter/Y] Fill all Token-type variables (default)" -Type "Info"

                    for ($idx = 0; $idx -lt $tokenVariables.Count; $idx++) {
                        $tokenVar = $tokenVariables[$idx]
                        Write-ColorMessage -Message "  [$($idx + 1)] Fill only: $($tokenVar.DisplayName)" -Type "Info"
                    }

                    Write-ColorMessage -Message "" -Type "Info"
                    $strategyChoice = Read-Host "Select strategy (default: all)"

                    if ([string]::IsNullOrWhiteSpace($strategyChoice) -or $strategyChoice -eq "Y" -or $strategyChoice -eq "y") {
                        $tokenFillStrategy = "all"
                        Write-ColorMessage -Message "Strategy: Fill all Token variables" -Type "Success"
                    } else {
                        try {
                            $selectedIdx = [int]$strategyChoice - 1
                            if ($selectedIdx -ge 0 -and $selectedIdx -lt $tokenVariables.Count) {
                                $tokenFillStrategy = "single"
                                $targetTokenVariable = $tokenVariables[$selectedIdx]
                                Write-ColorMessage -Message "Strategy: Fill only $($targetTokenVariable.DisplayName)" -Type "Success"
                            } else {
                                Write-ColorMessage -Message "Invalid selection, using default: Fill all" -Type "Warning"
                                $tokenFillStrategy = "all"
                            }
                        } catch {
                            Write-ColorMessage -Message "Invalid input, using default: Fill all" -Type "Warning"
                            $tokenFillStrategy = "all"
                        }
                    }
                }
            }

            $finalValue = $null

            if ($currentInputType -eq "Url" -and $extractedData.ApiUrls.Count -gt 0) {
                $finalValue = $extractedData.ApiUrls[0]
                Write-ColorMessage -Message "Using first API URL: $finalValue" -Type "Success"
            } elseif ($currentInputType -eq "Token" -and $extractedData.Tokens.Count -gt 0) {
                $finalValue = $extractedData.Tokens[0]
                Write-ColorMessage -Message "Using first Token: $finalValue" -Type "Success"
            } else {
                $finalValue = $userInput
                Write-ColorMessage -Message "Using original input (no matching type found)" -Type "Warning"
            }

            try {
                if ($Config -and $Config.ContainsKey("Variables") -and $Config.Variables -and $Config.Variables.Count -gt 1) {
                    $nextVariable = $Config.Variables[1]
                    $nextInputType = ""
                    if ($nextVariable -and $nextVariable.ContainsKey("InputType") -and $nextVariable.InputType) {
                        $nextInputType = $nextVariable.InputType
                    }

                    if ($extractedData.ApiUrls.Count -gt 0 -and $extractedData.Tokens.Count -gt 0) {
                        if (($currentInputType -eq "Url" -and $nextInputType -eq "Token") -or
                            ($currentInputType -eq "Token" -and $nextInputType -eq "Url")) {
                            $shouldSkipNext = $true
                            Write-ColorMessage -Message "Both URL and Token found. Next variable will be auto-filled." -Type "Info"
                        }
                    }
                }
            } catch {
                $shouldSkipNext = $false
            }

            return @{
                Value = $finalValue
                ExtractedData = $extractedData
                ShouldSkipNext = $shouldSkipNext
                TokenFillStrategy = $tokenFillStrategy
                TargetTokenVariable = $targetTokenVariable
            }
        }
    }

    return @{
        Value = $userInput
        ExtractedData = $null
        ShouldSkipNext = $false
        TokenFillStrategy = $null
        TargetTokenVariable = $null
    }
}

function Get-DefaultValueForVariable {
    param(
        [Parameter(Mandatory=$true)] [hashtable]$Variable
    )
    
    if ($Variable -and $Variable.ContainsKey("DefaultValue") -and $Variable.DefaultValue) {
        $defaultVarName = $Variable.DefaultValue
        
        if ($script:UserInputValues -and $script:UserInputValues.ContainsKey($defaultVarName)) {
            return $script:UserInputValues[$defaultVarName]
        }
        
        $defaultValue = [Environment]::GetEnvironmentVariable($defaultVarName)
        if ($defaultValue) {
            return $defaultValue
        }
    }
    
    return $null
}

function Reset-InputTypeIndexTracker {
    $script:InputTypeIndexTracker = @{}
}

function Reset-UserInputValues {
    $script:UserInputValues = @{}
    $script:AutoFilledVariables = @{}
}

function Get-ValueForNextVariable {
    param(
        [Parameter(Mandatory=$true)] [hashtable]$Variable,
        [Parameter(Mandatory=$true)] [hashtable]$ExtractedData,
        [Parameter(Mandatory=$false)] [string]$TokenFillStrategy = "all",
        [Parameter(Mandatory=$false)] [hashtable]$TargetTokenVariable = $null
    )
    
    try {
        $defaultValue = Get-DefaultValueForVariable -Variable $Variable
        if ($defaultValue) {
            return $defaultValue
        }
        
        $inputType = ""
        if ($Variable -and $Variable.ContainsKey("InputType") -and $Variable.InputType) {
            $inputType = $Variable.InputType
        }

        if (-not $inputType) {
            return $null
        }

        if ($inputType -eq "Token" -and $TokenFillStrategy -eq "single" -and $TargetTokenVariable) {
            if ($Variable.Name -ne $TargetTokenVariable.Name) {
                return $null
            }
        }
        
        if ($script:UserInputValues -and $script:UserInputValues.Count -gt 0) {
            foreach ($key in $script:UserInputValues.Keys) {
                $existingVar = $null
                if ($script:CurrentConfig -and $script:CurrentConfig.ContainsKey("Variables")) {
                    $existingVar = $script:CurrentConfig.Variables | Where-Object { $_.Name -eq $key }
                }
                
                if ($existingVar -and $existingVar.ContainsKey("InputType") -and $existingVar.InputType -eq $inputType) {
                    return $script:UserInputValues[$key]
                }
            }
        }
        
        if (-not $script:InputTypeIndexTracker.ContainsKey($inputType)) {
            $script:InputTypeIndexTracker[$inputType] = 0
        }
        
        $currentIndex = $script:InputTypeIndexTracker[$inputType]
        
        $valueArray = $null
        switch ($inputType) {
            "Url" {
                if ($ExtractedData -and $ExtractedData.ContainsKey("ApiUrls") -and $ExtractedData.ApiUrls) {
                    $valueArray = $ExtractedData.ApiUrls
                }
            }
            "Token" {
                if ($ExtractedData -and $ExtractedData.ContainsKey("Tokens") -and $ExtractedData.Tokens) {
                    $valueArray = $ExtractedData.Tokens
                }
            }
            "AccessKeyId" {
                if ($ExtractedData -and $ExtractedData.ContainsKey("AccessKeyIds") -and $ExtractedData.AccessKeyIds) {
                    $valueArray = $ExtractedData.AccessKeyIds
                } elseif ($ExtractedData -and $ExtractedData.ContainsKey("Tokens") -and $ExtractedData.Tokens) {
                    $valueArray = $ExtractedData.Tokens
                }
            }
            default {
                if ($ExtractedData -and $ExtractedData.ContainsKey("Tokens") -and $ExtractedData.Tokens) {
                    $valueArray = $ExtractedData.Tokens
                }
            }
        }
        
        if ($valueArray -and $valueArray.Count -gt 0) {
            $targetIndex = if ($currentIndex -lt $valueArray.Count) { $currentIndex } else { $valueArray.Count - 1 }
            $selectedValue = $valueArray[$targetIndex]
            
            $script:InputTypeIndexTracker[$inputType] = $currentIndex + 1
            
            return $selectedValue
        }
    } catch {
    }
    
    return $null
}

#endregion

#region Script Generation Functions

function Ensure-Array {
    param(
        [Parameter(Mandatory=$false)] $InputObject
    )
    
    if ($null -eq $InputObject) {
        return ,@()
    } else {
        return ,@($InputObject)
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

    if (-not (Test-Path $Global:INLINE_WINENVS_DIR)) {
        return @()
    }

    $pattern = "${listScriptName}*"
    $scripts = Get-ChildItem -Path $Global:INLINE_WINENVS_DIR -Filter $pattern -File -ErrorAction SilentlyContinue | Sort-Object Name
    
    $scripts = Ensure-Array -InputObject $scripts
    
    return $scripts
}

function Show-ExistingScriptsMenu {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName,
        [Parameter(Mandatory=$false)] [array]$Scripts = @()
    )
    
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
    
    $envCommands = @()
    $envCommands += "# Environment variables for $($config.Title)"
    $envCommands += "# Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $envCommands += ""
    
    $extractedData = $null
    $skipNext = $false
    
    Reset-InputTypeIndexTracker
    Reset-UserInputValues
    
    for ($i = 0; $i -lt $config.Variables.Count; $i++) {
        $var = $config.Variables[$i]
        
        if ($skipNext) {
            $skipNext = $false
            $autoValue = Get-ValueForNextVariable -Variable $var -ExtractedData $extractedData
            if ($autoValue) {
                $envCommands += "`$env:$($var.Name) = `"$autoValue`"  # Auto-filled"
                Write-ColorMessage -Message "Auto-filled $($var.DisplayName): $autoValue" -Type "Success"
                $script:UserInputValues[$var.Name] = $autoValue
                continue
            }
        }
        
        $inputResult = Get-SmartInputForVariable -Variable $var -Config $config -HasCurrentValue $false
        $userInput = $inputResult.Value
        $extractedData = $inputResult.ExtractedData
        $skipNext = $inputResult.ShouldSkipNext
        
        if ([string]::IsNullOrWhiteSpace($userInput)) {
            $defaultValue = Get-DefaultValueForVariable -Variable $var
            if ($defaultValue) {
                $userInput = $defaultValue
                Write-ColorMessage -Message "Using default value for $($var.DisplayName): $defaultValue" -Type "Success"
            }
        }
        
        if (-not [string]::IsNullOrWhiteSpace($userInput)) {
            $envCommands += "`$env:$($var.Name) = `"$userInput`""
            $script:UserInputValues[$var.Name] = $userInput
        } else {
            $envCommands += "# `$env:$($var.Name) = `"`"  # Not set"
        }
    }
    
    $existingScripts = Get-ExistingScripts -ConfigName $ConfigName
    
    $existingScripts = Ensure-Array -InputObject $existingScripts
    
    $scriptNumber = $existingScripts.Count + 1
    
    if (-not $TargetScriptPath) {
        $listScriptName = Get-ListScriptName -ConfigName $ConfigName
        $scriptName = "${listScriptName}${scriptNumber}.ps1"
        $TargetScriptPath = Join-Path $Global:INLINE_WINENVS_DIR $scriptName
    }
    
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
        $scriptDir = Split-Path $TargetScriptPath -Parent
        if (-not (Test-Path $scriptDir)) {
            New-Item -ItemType Directory -Path $scriptDir -Force | Out-Null
        }
        
        $scriptContent | Out-File -FilePath $TargetScriptPath -Encoding UTF8 -Force
        
        & $script:WINDOWS_PATH_FUNCTION_PATH "addfile" $TargetScriptPath

        Write-ColorMessage -Message "Script generated successfully: $TargetScriptPath" -Type "Success"
        Write-ColorMessage -Message "Script has been added to inline winenvs directory (travels with code)" -Type "Success"
        
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

    if (-not (Test-Path $Global:INLINE_WINENVS_DIR)) {
        Write-ColorMessage -Message "Inline winenvs directory not found" -Type "Error"
        return
    }
    
    $files = Get-ExistingFiles -ConfigName $ConfigName
    
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
    
    Write-ColorMessage -Message "`nList script: ${listScriptName}.ps1" -Type "Info"
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
    
    $filePrefix = Get-CommandPrefix -ConfigName $ConfigName
    if (-not $filePrefix) {
        return @()
    }

    if (-not (Test-Path $Global:INLINE_WINENVS_DIR)) {
        return @()
    }

    $files = Get-ChildItem -Path $Global:INLINE_WINENVS_DIR -Filter "${filePrefix}*" -File -ErrorAction SilentlyContinue
    
    $files = Ensure-Array -InputObject $files
    
    $allFiles = @($files | Where-Object { $null -ne $_ })
    
    return $allFiles
}

function Show-ExistingFilesMenu {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName,
        [Parameter(Mandatory=$false)] [array]$Files = @()
    )
    
    $Files = Ensure-Array -InputObject $Files
    
    $filePrefix = Get-CommandPrefix -ConfigName $ConfigName
    if ([string]::IsNullOrWhiteSpace($filePrefix)) {
        Write-ColorMessage -Message "No file prefix found for $ConfigName" -Type "Error"
        return "new"
    }
    
    if ($Files.Count -eq 0) {
        return "new"
    }
    
    $nextFileNumber = 1
    $existingNumbers = @()
    
    foreach ($file in $Files) {
        if ($null -ne $file -and $file.Name -match "^${filePrefix}(\d+)\.ps1$") {
            $existingNumbers += [int]$matches[1]
        }
    }

    while ($existingNumbers -contains $nextFileNumber) {
        $nextFileNumber++
    }

    $nextFileName = "${filePrefix}${nextFileNumber}.ps1"
    
    $menuItems = @()
    
    $menuItems += @{ Text = "Create new file: $nextFileName (auto-increment)"; Action = "new" }

    foreach ($file in $Files) {
        if ($null -ne $file -and $file.PSObject.Properties['Name'] -and $file.Name) {
            $fullPath = Join-Path $Global:INLINE_WINENVS_DIR $file.Name
            $menuItems += @{ Text = "Replace existing: $($file.Name)"; Action = $fullPath }
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
                
                if ($script:SelectedFileAction -eq "new") {
                    $script:IsReplacingFile = $false
                    $script:TargetFilePath = $null
                } else {
                    $script:IsReplacingFile = $true
                    $script:TargetFilePath = $script:SelectedFileAction
                }
                
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

    if (-not (Test-Path $Global:INLINE_WINENVS_DIR)) {
        Write-ColorMessage -Message "Inline winenvs directory not found" -Type "Error"
        return $false
    }

    $existingFiles = Get-ExistingFiles -ConfigName $ConfigName

    $existingFiles = Ensure-Array -InputObject $existingFiles

    $fileCount = $existingFiles.Count

    $listScriptName = "${commandPrefix}list"
    $listScriptPath = Join-Path $Global:INLINE_WINENVS_DIR "${listScriptName}.ps1"

    $listScriptContent = @"
# $($config.Title) Command List with Delete Function
# Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

Set-StrictMode -Version Latest
`$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "$($config.Title) Available Commands:" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

`$scriptPath = `$PSScriptRoot
if ([string]::IsNullOrWhiteSpace(`$scriptPath)) {
    `$scriptPath = Get-Location
}

`$files = Get-ChildItem -Path `$scriptPath -Filter "${commandPrefix}*.ps1" | Where-Object { `$_.Name -ne "${listScriptName}.ps1" }

if (`$files.Count -eq 0) {
    Write-Host "No ${commandPrefix} commands found." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

`$counter = 0
foreach (`$file in `$files) {
    `$counter++
    Write-Host "  `$counter. `$(`$file.BaseName)" -ForegroundColor White
}

Write-Host ""
Write-Host "Total: `$(`$files.Count) files available" -ForegroundColor Green
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Environment Variables Status:" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
$($config.Variables | ForEach-Object {
    "Write-Host `"  $($_.DisplayName): Checking...`" -ForegroundColor White"
})
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "File Management Options:" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "1. Delete a file (enter file number)" -ForegroundColor White
Write-Host "2. Exit" -ForegroundColor White
Write-Host ""

`$choice = Read-Host "Enter your choice (1-2)"

if (`$choice -eq "1") {
    Write-Host ""
    `$fileNum = Read-Host "Enter file number to delete"

    if (-not [string]::IsNullOrWhiteSpace(`$fileNum)) {
        try {
            `$fileNumInt = [int]`$fileNum
            if (`$fileNumInt -gt 0 -and `$fileNumInt -le `$files.Count) {
                `$fileToDelete = `$files[`$fileNumInt - 1]
                Write-Host ""
                Write-Host "File to delete: `$(`$fileToDelete.Name)" -ForegroundColor Yellow
                `$confirm = Read-Host "Are you sure you want to delete this file? (Y/N)"

                if (`$confirm -eq "Y" -or `$confirm -eq "y") {
                    Remove-Item -Path `$fileToDelete.FullName -Force
                    Write-Host "File deleted successfully: `$(`$fileToDelete.Name)" -ForegroundColor Green
                } else {
                    Write-Host "Deletion cancelled." -ForegroundColor Yellow
                }
            } else {
                Write-Host "Invalid file number." -ForegroundColor Red
            }
        } catch {
            Write-Host "Invalid input." -ForegroundColor Red
        }
    }
    Write-Host ""
    Read-Host "Press Enter to exit"
}
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
    
    if (-not $script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        Write-ColorMessage -Message "Configuration '$ConfigName' not found." -Type "Error"
        return $false
    }
    
    $script:CurrentConfigName = $ConfigName
    $script:CurrentConfig = $script:EnvironmentConfigs[$ConfigName]
    $script:CurrentCommandPrefix = Get-CommandPrefix -ConfigName $ConfigName
    $script:CurrentFileNumber = 1
    $script:CurrentWinEnvsDir = $Global:INLINE_WINENVS_DIR
    $script:CurrentFileName = $null
    $script:CurrentBatchContent = $null
    $script:CurrentPsCommand = $script:CurrentConfig.Common
    
    $envCommands = @()
    $psEnvVars = @()
    
    if ($null -eq $script:CurrentConfig) {
        Write-ColorMessage -Message "Configuration '$ConfigName' not found." -Type "Error"
        return $false
    }
    
    if ([string]::IsNullOrWhiteSpace($script:CurrentCommandPrefix)) {
        Write-ColorMessage -Message "No command prefix found for $ConfigName" -Type "Error"
        return $false
    }
    
    if ($script:IsReplacingFile) {
        $tempFileName = Split-Path $script:TargetFilePath -Leaf
        if ($tempFileName -match "^${script:CurrentCommandPrefix}(\d+)\.ps1$") {
            $script:CurrentFileNumber = [int]$matches[1]
        } else {
            $script:CurrentFileNumber = 1
        }
    } else {
        $existingFiles = Get-ExistingFiles -ConfigName $script:CurrentConfigName
        $script:CurrentFileNumber = 1
        $existingNumbers = @()

        foreach ($file in $existingFiles) {
            if ($file.Name -match "^${script:CurrentCommandPrefix}(\d+)\.ps1$") {
                $existingNumbers += [int]$matches[1]
            }
        }

        while ($existingNumbers -contains $script:CurrentFileNumber) {
            $script:CurrentFileNumber++
        }
    }

    Clear-Host
    Write-ColorMessage -Message "Generate $($script:CurrentConfig.Title) Global Command" -Type "Info"
    Write-ColorMessage -Message $script:CurrentConfig.Description -Type "Info"
    Write-ColorMessage -Message ("=" * $script:CurrentConfig.Title.Length) -Type "Info"

    if ($script:IsReplacingFile) {
        $targetFileName = Split-Path $script:TargetFilePath -Leaf
        Write-ColorMessage -Message "Operation: Replacing existing file '$targetFileName'" -Type "Warning"
    } else {
        Write-ColorMessage -Message "Operation: Creating new file" -Type "Success"
        Write-ColorMessage -Message "File will be: ${script:CurrentCommandPrefix}${script:CurrentFileNumber}.ps1" -Type "Info"
    }

    Write-Host ""
    Write-ColorMessage -Message "NOTE: All entered values will be encrypted and saved securely." -Type "Info"
    Write-ColorMessage -Message "You will be prompted for an encryption password after entering all values." -Type "Info"
    Write-Host ""

    $envCommands += "REM Environment variables for $($script:CurrentConfig.Title)"
    $envCommands += "REM Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $envCommands += ""

    $extractedData = $null
    $skipNext = $false
    $secretsToSave = @{}
    $tokenFillStrategy = "all"
    $targetTokenVariable = $null

    Reset-InputTypeIndexTracker
    Reset-UserInputValues

    for ($i = 0; $i -lt $script:CurrentConfig.Variables.Count; $i++) {
        $var = $script:CurrentConfig.Variables[$i]

        if ($skipNext) {
            $skipNext = $false
            $autoValue = Get-ValueForNextVariable -Variable $var -ExtractedData $extractedData -TokenFillStrategy $tokenFillStrategy -TargetTokenVariable $targetTokenVariable
            if ($autoValue) {
                $envCommands += "echo Setting $($var.Name)=[AUTO-FILLED]"
                $envCommands += "set $($var.Name)=$autoValue"
                $psEnvVars += "`$env:$($var.Name)='$autoValue'"
                Write-ColorMessage -Message "Auto-filled $($var.DisplayName): $autoValue" -Type "Success"
                $script:UserInputValues[$var.Name] = $autoValue
                $script:AutoFilledVariables[$var.Name] = $true

                $secretKeyName = "$($var.Name)_$($script:CurrentFileNumber)"
                $secretsToSave[$secretKeyName] = $autoValue
                continue
            }
        }

        $shouldAutoFill = $false
        if ($extractedData -and $tokenFillStrategy -and $var.InputType -eq "Token") {
            if ($tokenFillStrategy -eq "all") {
                $shouldAutoFill = $true
            } elseif ($tokenFillStrategy -eq "single" -and $targetTokenVariable -and $var.Name -eq $targetTokenVariable.Name) {
                $shouldAutoFill = $true
            }
        }

        if ($shouldAutoFill) {
            $autoValue = Get-ValueForNextVariable -Variable $var -ExtractedData $extractedData -TokenFillStrategy $tokenFillStrategy -TargetTokenVariable $targetTokenVariable
            if ($autoValue) {
                $envCommands += "echo Setting $($var.Name)=[AUTO-FILLED]"
                $envCommands += "set $($var.Name)=$autoValue"
                $psEnvVars += "`$env:$($var.Name)='$autoValue'"
                Write-ColorMessage -Message "Auto-filled $($var.DisplayName): $autoValue" -Type "Success"
                $script:UserInputValues[$var.Name] = $autoValue
                $script:AutoFilledVariables[$var.Name] = $true

                $secretKeyName = "$($var.Name)_$($script:CurrentFileNumber)"
                $secretsToSave[$secretKeyName] = $autoValue
                continue
            }
        }

        $inputResult = Get-SmartInputForVariable -Variable $var -Config $script:CurrentConfig -HasCurrentValue $false
        $userInput = $inputResult.Value
        $extractedData = $inputResult.ExtractedData
        $skipNext = $inputResult.ShouldSkipNext

        if ($inputResult.ContainsKey("TokenFillStrategy") -and $inputResult.TokenFillStrategy) {
            $tokenFillStrategy = $inputResult.TokenFillStrategy
        }
        if ($inputResult.ContainsKey("TargetTokenVariable") -and $inputResult.TargetTokenVariable) {
            $targetTokenVariable = $inputResult.TargetTokenVariable
        }

        if ([string]::IsNullOrWhiteSpace($userInput)) {
            $defaultValue = Get-DefaultValueForVariable -Variable $var
            if ($defaultValue) {
                $userInput = $defaultValue
                Write-ColorMessage -Message "Using default value for $($var.DisplayName): $defaultValue" -Type "Success"
            }
        }

        if (-not [string]::IsNullOrWhiteSpace($userInput)) {
            $envCommands += "echo Setting $($var.Name)=$userInput"
            $envCommands += "set $($var.Name)=$userInput"
            $psEnvVars += "`$env:$($var.Name)='$userInput'"
            $script:UserInputValues[$var.Name] = $userInput

            $secretKeyName = "$($var.Name)_$($script:CurrentFileNumber)"
            $secretsToSave[$secretKeyName] = $userInput
        } else {
            $envCommands += "echo Skipping $($var.Name) (not set)"
            $envCommands += "REM set $($var.Name)=  # Not set"
        }
    }

    if ($secretsToSave.Count -gt 0) {
        Write-ColorMessage -Message "" -Type "Info"
        Write-ColorMessage -Message "Saving $($secretsToSave.Count) secrets to SecretManager..." -Type "Info"
        if (Get-Command Set-SecretKeyBatch -ErrorAction SilentlyContinue) {
            Set-SecretKeyBatch -Secrets $secretsToSave | Out-Null
        } else {
            Write-ColorMessage -Message "Set-SecretKeyBatch not available, using fallback method" -Type "Warning"
            foreach ($key in $secretsToSave.Keys) {
                Save-SecretToManager -KeyName $key -Value $secretsToSave[$key] -SkipEncryption | Out-Null
            }
        }
    }
    
    if ([string]::IsNullOrWhiteSpace($script:CurrentPsCommand)) {
        Write-ColorMessage -Message "No command specified in configuration." -Type "Error"
        return $false
    }
    
    Write-ColorMessage -Message "Command to execute: $script:CurrentPsCommand" -Type "Info"
    
    if (-not (Test-Path $script:CurrentWinEnvsDir)) {
        New-Item -ItemType Directory -Path $script:CurrentWinEnvsDir -Force | Out-Null
        Write-ColorMessage -Message "Created inline winenvs directory: $script:CurrentWinEnvsDir" -Type "Info"
    }

    if ($script:IsReplacingFile) {
        $script:CurrentFileName = Split-Path $script:TargetFilePath -Leaf
    } else {
        $script:CurrentFileName = "${script:CurrentCommandPrefix}${script:CurrentFileNumber}.ps1"
    }

    $TargetCommandPath = Join-Path $script:CurrentWinEnvsDir $script:CurrentFileName
    
    $userInputs = @{}
    foreach ($var in $script:CurrentConfig.Variables) {
        $userInput = ""
        foreach ($cmd in $envCommands) {
            if ($cmd -match "set $($var.Name)=(.*)") {
                $userInput = $matches[1]
                break
            }
        }
        $userInputs[$var.Name] = $userInput
    }

    $result = New-CompleteCommandContent -Config $script:CurrentConfig -CommandPrefix $script:CurrentCommandPrefix -PsCommand $script:CurrentPsCommand -FileNumber $script:CurrentFileNumber -UserInputs $userInputs -ShowPreview $true -RequireConfirmation $true -FileName $script:CurrentFileName

    if (-not $result.Success) {
        Write-ColorMessage -Message "Failed to generate command content: $($result.Message)" -Type "Error"
        return $false
    }

    $script:CurrentBatchContent = $result.Content
    
    $commandDir = Split-Path $TargetCommandPath -Parent
    if (-not (Test-Path $commandDir)) {
        New-Item -ItemType Directory -Path $commandDir -Force | Out-Null
    }

    try {
        $script:CurrentBatchContent | Out-File -FilePath $TargetCommandPath -Encoding ASCII -Force
        Write-ColorMessage -Message "Global command generated successfully: $TargetCommandPath" -Type "Success"
        Write-ColorMessage -Message "File written to inline winenvs directory" -Type "Success"

        if (Test-Path $TargetCommandPath) {
            $fileSize = (Get-Item $TargetCommandPath).Length
            Write-ColorMessage -Message "File verification: SUCCESS - Size: $fileSize bytes" -Type "Success"
        } else {
            Write-ColorMessage -Message "File verification: FAILED" -Type "Error"
        }
    } catch {
        Write-ColorMessage -Message "Failed to write file: $($_.Exception.Message)" -Type "Error"
        return $false
    }
    
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
    
    if (-not (Test-AdminPrivileges)) {
        Write-ColorMessage -Message "This operation requires administrator privileges." -Type "Error"
        Write-ColorMessage -Message "Please run this script as administrator." -Type "Warning"
        Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
        $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    
    $currentValues = @{}
    Write-ColorMessage -Message "Current environment variable status:" -Type "Info"
    foreach ($var in $config.Variables) {
        $currentValue = Get-EnvironmentVariable -VariableName $var.Name
        $currentValues[$var.Name] = $currentValue
        
        if ($currentValue) {
            Write-ColorMessage -Message "$($var.Name) ($($var.DisplayName)): $currentValue" -Type "Success"
        } else {
            Write-ColorMessage -Message "$($var.Name) ($($var.DisplayName)): [Not set - Will be configured]" -Type "Warning"
        }
    }
    
    Write-ColorMessage -Message "Now you will be prompted to enter values for each environment variable." -Type "Info"
    Write-ColorMessage -Message "If a variable is already set, you can press Enter to keep the current value or skip setting." -Type "Info"
    Write-ColorMessage -Message "If a variable is not set, you can press Enter to skip setting it." -Type "Info"
    
    $newValues = @{}
    $emptyVariables = @()
    $temporarilyCleared = @()
    $extractedData = $null
    $skipNext = $false
    $secretsToSave = @{}

    Reset-InputTypeIndexTracker
    Reset-UserInputValues

    for ($i = 0; $i -lt $config.Variables.Count; $i++) {
        $var = $config.Variables[$i]
        $hasCurrentValue = [bool]$currentValues[$var.Name]

        if ($skipNext) {
            $skipNext = $false
            $autoValue = Get-ValueForNextVariable -Variable $var -ExtractedData $extractedData
            if ($autoValue) {
                $newValues[$var.Name] = $autoValue
                Write-ColorMessage -Message "Auto-filled $($var.DisplayName): $autoValue" -Type "Success"
                $script:UserInputValues[$var.Name] = $autoValue

                $secretKeyName = "$($var.Name)_DEFAULT".ToUpper()
                $secretsToSave[$secretKeyName] = $autoValue
                continue
            }
        }

        $inputResult = Get-SmartInputForVariable -Variable $var -Config $config -HasCurrentValue $hasCurrentValue
        $userInput = $inputResult.Value
        $extractedData = $inputResult.ExtractedData
        $skipNext = $inputResult.ShouldSkipNext

        if ([string]::IsNullOrWhiteSpace($userInput)) {
            if ($hasCurrentValue) {
                Write-ColorMessage -Message "Variable has current value. Choose action:" -Type "Info"
                Write-ColorMessage -Message "1. Keep current value" -Type "Info"
                Write-ColorMessage -Message "2. Set to empty (delete key)" -Type "Info"
                Write-ColorMessage -Message "3. Set to empty (keep key)" -Type "Info"
                Write-ColorMessage -Message "4. Temporarily clear (current session only)" -Type "Info"

                $choice = Read-Host "Enter choice (1-4, default: 1)"

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
                        $temporarilyCleared += $var.Name
                        Write-ColorMessage -Message "Marked $($var.DisplayName) for temporary clearing" -Type "Success"
                        Write-ColorMessage -Message "System environment variable unchanged" -Type "Info"
                        Write-ColorMessage -Message "Command to clear: `$env:$($var.Name) = `"`"" -Type "Info"
                    }
                    default {
                        $newValues[$var.Name] = $currentValues[$var.Name]
                        Write-ColorMessage -Message "Keeping current value: $($currentValues[$var.Name])" -Type "Info"

                        if (-not [string]::IsNullOrWhiteSpace($currentValues[$var.Name])) {
                            $secretKeyName = "$($var.Name)_DEFAULT".ToUpper()
                            $secretsToSave[$secretKeyName] = $currentValues[$var.Name]
                        }
                    }
                }
            } else {
                $defaultValue = Get-DefaultValueForVariable -Variable $var
                if ($defaultValue) {
                    $newValues[$var.Name] = $defaultValue
                    Write-ColorMessage -Message "Using default value for $($var.DisplayName): $defaultValue" -Type "Success"

                    $secretKeyName = "$($var.Name)_DEFAULT".ToUpper()
                    $secretsToSave[$secretKeyName] = $defaultValue
                } else {
                    Write-ColorMessage -Message "Skipping $($var.DisplayName) - no value entered" -Type "Warning"
                    $emptyVariables += $var
                }
            }
        } else {
            $newValues[$var.Name] = $userInput
            Write-ColorMessage -Message "New value set: $userInput" -Type "Success"
            $script:UserInputValues[$var.Name] = $userInput

            $secretKeyName = "$($var.Name)_DEFAULT".ToUpper()
            $secretsToSave[$secretKeyName] = $userInput
        }
    }
    
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
                        Write-ColorMessage -Message "Keeping $($var.DisplayName): $($currentValues[$var.Name])" -Type "Info"

                        $secretKeyName = "$($var.Name)_DEFAULT".ToUpper()
                        $secretsToSave[$secretKeyName] = $currentValues[$var.Name]
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
    
    if ($newValues.Count -gt 0) {
        Write-ColorMessage -Message "Setting environment variables..." -Type "Info"
        
        $successCount = 0
        $totalCount = $newValues.Count
        
        foreach ($var in $config.Variables) {
            if ($newValues.ContainsKey($var.Name)) {
                if ($newValues[$var.Name] -eq "__DELETE__") {
                    $success = Set-EnvironmentVariable -VariableName $var.Name -Delete
                    if ($success) {
                        $successCount++
                        Write-ColorMessage -Message "Deleted $($var.DisplayName)" -Type "Success"
                    }
                } else {
                    $success = Set-EnvironmentVariable -VariableName $var.Name -VariableValue $newValues[$var.Name]
                    if ($success) {
                        $successCount++
                        Write-ColorMessage -Message "Set $($var.DisplayName): $($newValues[$var.Name])" -Type "Success"
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
                    Write-ColorMessage -Message "$($var.DisplayName): $($newValues[$var.Name])" -Type "Info"
                }
            } elseif ($temporarilyCleared -contains $var.Name) {
                Write-ColorMessage -Message "$($var.DisplayName): [TEMPORARILY CLEARED]" -Type "Info"
            }
        }
        
        if ($secretsToSave.Count -gt 0) {
            Write-ColorMessage -Message "" -Type "Info"
            Write-ColorMessage -Message "Saving $($secretsToSave.Count) secrets to SecretManager..." -Type "Info"
            if (Get-Command Set-SecretKeyBatch -ErrorAction SilentlyContinue) {
                Set-SecretKeyBatch -Secrets $secretsToSave | Out-Null
            } else {
                Write-ColorMessage -Message "Set-SecretKeyBatch not available, using fallback method" -Type "Warning"
                foreach ($key in $secretsToSave.Keys) {
                    Save-SecretToManager -KeyName $key -Value $secretsToSave[$key] -SkipEncryption | Out-Null
                }
            }
        }

        if ($newValues.Count -gt 0 -or $temporarilyCleared.Count -gt 0) {
            Write-ColorMessage -Message "Refreshing environment variables in current session..." -Type "Info"

            & $script:WINDOWS_PATH_FUNCTION_PATH "refreshvar" | Out-Null
            Write-ColorMessage -Message "All environment variables have been refreshed in the current session." -Type "Success"

            if ($temporarilyCleared.Count -gt 0) {
                Write-ColorMessage -Message "Attempting to clear environment variables..." -Type "Info"
                
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
            Write-ColorMessage -Message $value -Type "Success"
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
                Write-ColorMessage -Message "$($var.DisplayName): $value" -Type "Success"
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
        if (Test-Path $script:WINDOWS_PATH_FUNCTION_PATH) {
            & $script:WINDOWS_PATH_FUNCTION_PATH "refreshvar" | Out-Null
            Write-ColorMessage -Message "All environment variables refreshed successfully!" -Type "Success"
            Write-ColorMessage -Message "Current terminal session now has the latest environment variables." -Type "Success"
            
            Write-Host ""
            Write-ColorMessage -Message "Current status of configured environment variables:" -Type "Info"
            Write-ColorMessage -Message "=================================================" -Type "Info"
            
            foreach ($configName in $script:EnvironmentConfigs.Keys) {
                $config = $script:EnvironmentConfigs[$configName]
                Write-ColorMessage -Message "$($config.Title):" -Type "Info"
                
                foreach ($var in $config.Variables) {
                    $currentValue = Get-EnvironmentVariable -VariableName $var.Name
                    if ($currentValue) {
                        Write-ColorMessage -Message "  $($var.DisplayName): $currentValue" -Type "Success"
                    } else {
                        Write-ColorMessage -Message "  $($var.DisplayName): [Not set]" -Type "Warning"
                    }
                }
                Write-Host ""
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

#region Configuration Save and Restore Functions

<#
.SYNOPSIS
    Save configuration to a file

.DESCRIPTION
    Saves the current configuration (environment variables) to a PowerShell script file
    The saved configuration can be used to restore settings on other machines

.PARAMETER ConfigName
    Configuration name (e.g. "Claude AI", "Factory AI Droid")

.PARAMETER ConfigData
    Hashtable containing configuration data with variables and their values

.PARAMETER ConfigFilePath
    Optional custom path for the configuration file
    If not specified, will save to menu_func directory with auto-generated name

.EXAMPLE
    Save-ConfigurationToFile -ConfigName "Claude AI" -ConfigData $configData
#>
function Save-ConfigurationToFile {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName,
        [Parameter(Mandatory=$true)] [hashtable]$ConfigData,
        [Parameter(Mandatory=$false)] [string]$ConfigFilePath = $null
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

    if ([string]::IsNullOrWhiteSpace($ConfigFilePath)) {
        $safeConfigName = $commandPrefix -replace '[^\w]', '_'
        $configFileName = "${safeConfigName}_config.ps1"
        $ConfigFilePath = Join-Path $script:MENU_FUNC_DIR $configFileName
    }

    $configFileContent = @"
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
    Saved Configuration for $ConfigName

.DESCRIPTION
    This file contains saved configuration data for $ConfigName
    Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

.NOTES
    To restore this configuration, use "Restore from Configuration" menu option
#>

function Get-SavedConfigurationData {
    return @{
        ConfigName = "$ConfigName"
        CommandPrefix = "$commandPrefix"
        SavedDate = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        Variables = @{
"@

    foreach ($var in $config.Variables) {
        if ($ConfigData.ContainsKey($var.Name) -and -not [string]::IsNullOrWhiteSpace($ConfigData[$var.Name])) {
            $value = $ConfigData[$var.Name]
            $configFileContent += @"

            "$($var.Name)" = "$value"
"@
        }
    }

    $configFileContent += @"

        }
    }
}
"@

    try {
        $configDir = Split-Path $ConfigFilePath -Parent
        if (-not (Test-Path $configDir)) {
            New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        }

        $configFileContent | Out-File -FilePath $ConfigFilePath -Encoding UTF8 -Force

        Write-ColorMessage -Message "Configuration saved successfully: $ConfigFilePath" -Type "Success"
        return $true
    } catch {
        Write-ColorMessage -Message "Failed to save configuration: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

<#
.SYNOPSIS
    Load configuration from a file

.DESCRIPTION
    Loads configuration data from a saved PowerShell script file

.PARAMETER ConfigFilePath
    Path to the configuration file

.EXAMPLE
    $configData = Load-ConfigurationFromFile -ConfigFilePath "C:\path\to\config.ps1"
#>
function Load-ConfigurationFromFile {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigFilePath
    )

    if (-not (Test-Path $ConfigFilePath)) {
        Write-ColorMessage -Message "Configuration file not found: $ConfigFilePath" -Type "Error"
        return $null
    }

    try {
        . $ConfigFilePath
        if (Get-Command Get-SavedConfigurationData -ErrorAction SilentlyContinue) {
            $configData = Get-SavedConfigurationData
            Remove-Item Function:\Get-SavedConfigurationData -ErrorAction SilentlyContinue
            return $configData
        } else {
            Write-ColorMessage -Message "Invalid configuration file format" -Type "Error"
            return $null
        }
    } catch {
        Write-ColorMessage -Message "Failed to load configuration: $($_.Exception.Message)" -Type "Error"
        return $null
    }
}

<#
.SYNOPSIS
    Get list of saved configuration files

.DESCRIPTION
    Returns array of configuration files for a specific tool

.PARAMETER ConfigName
    Configuration name (e.g. "Claude AI", "Factory AI Droid")

.EXAMPLE
    $configs = Get-SavedConfigurations -ConfigName "Claude AI"
#>
function Get-SavedConfigurations {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )

    $commandPrefix = Get-CommandPrefix -ConfigName $ConfigName
    if (-not $commandPrefix) {
        return @()
    }

    if (-not (Test-Path $script:MENU_FUNC_DIR)) {
        return @()
    }

    $safeConfigName = $commandPrefix -replace '[^\w]', '_'
    $pattern = "${safeConfigName}_config_*.ps1"
    $configFiles = Get-ChildItem -Path $script:MENU_FUNC_DIR -Filter $pattern -File -ErrorAction SilentlyContinue | Sort-Object Name -Descending

    $configFiles = Ensure-Array -InputObject $configFiles

    return $configFiles
}

<#
.SYNOPSIS
    Show menu to select and restore a saved configuration

.DESCRIPTION
    Displays interactive menu to select from saved configurations and restore them

.PARAMETER ConfigName
    Configuration name (e.g. "Claude AI", "Factory AI Droid")

.EXAMPLE
    Show-RestoreConfigurationMenu -ConfigName "Claude AI"
#>
function Show-RestoreConfigurationMenu {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName
    )

    $savedConfigs = Get-SavedConfigurations -ConfigName $ConfigName
    $savedConfigs = Ensure-Array -InputObject $savedConfigs

    if ($savedConfigs.Count -eq 0) {
        Clear-Host
        Write-ColorMessage -Message "No saved configurations found for $ConfigName" -Type "Warning"
        Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
        $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        return $null
    }

    $menuItems = @()

    foreach ($configFile in $savedConfigs) {
        $configData = Load-ConfigurationFromFile -ConfigFilePath $configFile.FullName
        if ($configData) {
            $displayText = "$($configFile.Name) (Saved: $($configData.SavedDate))"
            $menuItems += @{ Text = $displayText; Action = $configFile.FullName; Data = $configData }
        }
    }

    $menuItems += @{ Text = "Back to Menu"; Action = "back"; Data = $null }

    $selectedIndex = 0

    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "Restore Configuration for $ConfigName" -Type "Info"
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
                if ($action -eq "back") {
                    return $null
                }
                return $menuItems[$selectedIndex].Data
            }
        }
    }
}

<#
.SYNOPSIS
    Restore configuration and generate command using CommandContentGenerator

.DESCRIPTION
    Takes saved configuration data and generates a new command file using the standard generation process

.PARAMETER ConfigName
    Configuration name (e.g. "Claude AI", "Factory AI Droid")

.PARAMETER SavedConfigData
    Configuration data loaded from saved configuration file

.EXAMPLE
    Restore-ConfigurationAndGenerate -ConfigName "Claude AI" -SavedConfigData $configData
#>
function Restore-ConfigurationAndGenerate {
    param(
        [Parameter(Mandatory=$true)] [string]$ConfigName,
        [Parameter(Mandatory=$true)] [hashtable]$SavedConfigData
    )

    if (-not $script:EnvironmentConfigs.ContainsKey($ConfigName)) {
        Write-ColorMessage -Message "Configuration '$ConfigName' not found." -Type "Error"
        return $false
    }

    $script:CurrentConfigName = $ConfigName
    $script:CurrentConfig = $script:EnvironmentConfigs[$ConfigName]
    $script:CurrentCommandPrefix = Get-CommandPrefix -ConfigName $ConfigName
    $script:CurrentWinEnvsDir = $Global:INLINE_WINENVS_DIR
    $script:CurrentPsCommand = $script:CurrentConfig.Common

    Clear-Host
    Write-ColorMessage -Message "Restore Configuration for $ConfigName" -Type "Info"
    Write-ColorMessage -Message "Saved Date: $($SavedConfigData.SavedDate)" -Type "Info"
    Write-ColorMessage -Message ("=" * 50) -Type "Info"
    Write-Host ""

    Write-ColorMessage -Message "Configuration will be restored with the following values:" -Type "Info"
    foreach ($varName in $SavedConfigData.Variables.Keys) {
        $value = $SavedConfigData.Variables[$varName]
        Write-ColorMessage -Message "  $varName = $value" -Type "Success"
    }

    Write-Host ""
    Write-ColorMessage -Message "Do you want to proceed with restoring this configuration? (Y/N)" -Type "Warning"
    $confirm = Read-Host "Confirm"

    if ($confirm -ne "Y" -and $confirm -ne "y") {
        Write-ColorMessage -Message "Configuration restore cancelled" -Type "Warning"
        return $false
    }

    $existingFiles = Get-ExistingFiles -ConfigName $ConfigName
    Show-ExistingFilesMenu -ConfigName $ConfigName -Files $existingFiles

    $existingFiles = Get-ExistingFiles -ConfigName $ConfigName
    $script:CurrentFileNumber = 1
    $existingNumbers = @()

    if ($script:IsReplacingFile) {
        $tempFileName = Split-Path $script:TargetFilePath -Leaf
        if ($tempFileName -match "^${script:CurrentCommandPrefix}(\d+)\.ps1$") {
            $script:CurrentFileNumber = [int]$matches[1]
        } else {
            $script:CurrentFileNumber = 1
        }
    } else {
        foreach ($file in $existingFiles) {
            if ($file.Name -match "^${script:CurrentCommandPrefix}(\d+)\.ps1$") {
                $existingNumbers += [int]$matches[1]
            }
        }

        while ($existingNumbers -contains $script:CurrentFileNumber) {
            $script:CurrentFileNumber++
        }
    }

    if ($script:IsReplacingFile) {
        $script:CurrentFileName = Split-Path $script:TargetFilePath -Leaf
    } else {
        $script:CurrentFileName = "${script:CurrentCommandPrefix}${script:CurrentFileNumber}.ps1"
    }

    $TargetCommandPath = Join-Path $script:CurrentWinEnvsDir $script:CurrentFileName

    $secretsToSave = @{}
    foreach ($varName in $SavedConfigData.Variables.Keys) {
        $value = $SavedConfigData.Variables[$varName]
        $secretKeyName = "${varName}_$($script:CurrentFileNumber)"
        $secretsToSave[$secretKeyName] = $value
    }

    if ($secretsToSave.Count -gt 0) {
        Write-ColorMessage -Message "" -Type "Info"
        Write-ColorMessage -Message "Saving $($secretsToSave.Count) secrets to SecretManager..." -Type "Info"
        if (Get-Command Set-SecretKeyBatch -ErrorAction SilentlyContinue) {
            Set-SecretKeyBatch -Secrets $secretsToSave | Out-Null
        } else {
            Write-ColorMessage -Message "Set-SecretKeyBatch not available, using fallback method" -Type "Warning"
            foreach ($key in $secretsToSave.Keys) {
                Save-SecretToManager -KeyName $key -Value $secretsToSave[$key] -SkipEncryption | Out-Null
            }
        }
    }

    $result = New-CompleteCommandContent -Config $script:CurrentConfig -CommandPrefix $script:CurrentCommandPrefix -PsCommand $script:CurrentPsCommand -FileNumber $script:CurrentFileNumber -UserInputs $SavedConfigData.Variables -ShowPreview $true -RequireConfirmation $true -FileName $script:CurrentFileName

    if (-not $result.Success) {
        Write-ColorMessage -Message "Failed to generate command content: $($result.Message)" -Type "Error"
        return $false
    }

    $script:CurrentBatchContent = $result.Content

    $commandDir = Split-Path $TargetCommandPath -Parent
    if (-not (Test-Path $commandDir)) {
        New-Item -ItemType Directory -Path $commandDir -Force | Out-Null
    }

    try {
        $script:CurrentBatchContent | Out-File -FilePath $TargetCommandPath -Encoding ASCII -Force
        Write-ColorMessage -Message "Configuration restored and command generated successfully: $TargetCommandPath" -Type "Success"
        Write-ColorMessage -Message "File written to inline winenvs directory" -Type "Success"

        if (Test-Path $TargetCommandPath) {
            $fileSize = (Get-Item $TargetCommandPath).Length
            Write-ColorMessage -Message "File verification: SUCCESS - Size: $fileSize bytes" -Type "Success"
        } else {
            Write-ColorMessage -Message "File verification: FAILED" -Type "Error"
        }
    } catch {
        Write-ColorMessage -Message "Failed to write file: $($_.Exception.Message)" -Type "Error"
        Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
        $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        return
    }

    Generate-ListScript -ConfigName $script:CurrentConfigName | Out-Null

    Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    return $true
}

#endregion

