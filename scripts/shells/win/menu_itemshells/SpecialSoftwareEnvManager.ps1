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
        [Parameter(Mandatory=$true)] [string]$VariableValue
    )
    
    if (-not (Test-Path $script:WINDOWS_PATH_FUNCTION_PATH)) {
        Write-ColorMessage -Message "Error: WindowsPathFunction.ps1 not found at: $script:WINDOWS_PATH_FUNCTION_PATH" -Type "Error"
        return $false
    }
    
    & $script:WINDOWS_PATH_FUNCTION_PATH "setvar" $VariableName $VariableValue
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

#region Environment Variables Configuration
$script:EnvironmentConfigs = @{
    "Claude AI" = @{
        Title = "Claude AI Environment Variables"
        Description = "Set up Claude AI environment variables for API access"
        Variables = @(
            @{
                Name = "ANTHROPIC_BASE_URL"
                DisplayName = "ANTHROPIC_BASE_URL"
                Description = "Claude AI API base URL"
                IsSecret = $false
            },
            @{
                Name = "ANTHROPIC_AUTH_TOKEN"
                DisplayName = "ANTHROPIC_AUTH_TOKEN"
                Description = "Claude AI authentication token"
                IsSecret = $true
            }
        )
    }
    "Alibaba Cloud" = @{
        Title = "Alibaba Cloud Environment Variables"
        Description = "Set up Alibaba Cloud environment variables for API access"
        Variables = @(
            @{
                Name = "ALIBABA_CLOUD_ACCESS_KEY_ID"
                DisplayName = "ALIBABA_CLOUD_ACCESS_KEY_ID"
                Description = "Alibaba Cloud access key ID"
                IsSecret = $false
            },
            @{
                Name = "ALIBABA_CLOUD_ACCESS_KEY_SECRET"
                DisplayName = "ALIBABA_CLOUD_ACCESS_KEY_SECRET"
                Description = "Alibaba Cloud access key secret"
                IsSecret = $true
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
    
    foreach ($var in $config.Variables) {
        $hasCurrentValue = $currentValues[$var.Name]
        
        if ($hasCurrentValue) {
            $prompt = "Please enter $($var.DisplayName) (or press Enter to keep current value):"
        } else {
            $prompt = "Please enter $($var.DisplayName) (or press Enter to skip):"
        }
        
        if ($var.Description) {
            $prompt += "`nDescription: $($var.Description)"
        }
        
        Write-ColorMessage -Message $prompt -Type "Info"
        $userInput = Read-Host $var.DisplayName
        
        if ([string]::IsNullOrWhiteSpace($userInput)) {
            if ($hasCurrentValue) {
                $newValues[$var.Name] = $currentValues[$var.Name]
                if ($var.IsSecret) {
                    Write-ColorMessage -Message "Keeping current value: [HIDDEN]" -Type "Info"
                } else {
                    Write-ColorMessage -Message "Keeping current value: $($currentValues[$var.Name])" -Type "Info"
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
    
    # Check if multiple variables are empty and show selection menu
    if ($emptyVariables.Count -gt 1) {
        Write-ColorMessage -Message "Multiple variables were left empty. Please choose how to handle them:" -Type "Warning"
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
    Write-ColorMessage -Message "Setting environment variables..." -Type "Info"
    
    $successCount = 0
    $totalCount = $config.Variables.Count
    
    foreach ($var in $config.Variables) {
        $success = Set-EnvironmentVariable -VariableName $var.Name -VariableValue $newValues[$var.Name]
        if ($success) {
            $successCount++
        }
    }
    
    if ($successCount -eq $totalCount) {
        Write-ColorMessage -Message "Environment variables set successfully!" -Type "Success"
        foreach ($var in $config.Variables) {
            if ($var.IsSecret) {
                Write-ColorMessage -Message "$($var.DisplayName): [HIDDEN]" -Type "Info"
            } else {
                Write-ColorMessage -Message "$($var.DisplayName): $($newValues[$var.Name])" -Type "Info"
            }
        }
        
        # Refresh environment variables in current session
        Write-ColorMessage -Message "Refreshing environment variables in current session..." -Type "Info"
        foreach ($var in $config.Variables) {
            $refreshResult = & $script:WINDOWS_PATH_FUNCTION_PATH "refreshvar" $var.Name
            if ($refreshResult) {
                Write-ColorMessage -Message "Refreshed $($var.DisplayName)" -Type "Success"
            }
        }
        
        Write-ColorMessage -Message "Environment variables have been refreshed in the current session." -Type "Success"
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
        @{ Text = "Set Claude AI Environment Variables"; Action = "claude" },
        @{ Text = "Set Alibaba Cloud Environment Variables"; Action = "alibaba" },
        @{ Text = "View All Environment Variables"; Action = "viewall" },
        @{ Text = "Back to Main Menu"; Action = "back" },
        @{ Text = "Exit"; Action = "exit" }
    )
    
    $selectedIndex = 0
    
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "Special Software Environment Variables Manager" -Type "Info"
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
                    'claude' { Set-EnvironmentVariables -ConfigName "Claude AI" }
                    'alibaba' { Set-EnvironmentVariables -ConfigName "Alibaba Cloud" }
                    'viewall' { Show-AllEnvironmentVariables }
                    'back' { return }
                    'exit' { exit }
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

