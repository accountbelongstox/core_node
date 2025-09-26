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
    $temporarilyCleared = @()  # Track variables that were temporarily cleared
    
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
        @{ Text = "Set Claude AI Environment Variables"; Action = "claude" },
        @{ Text = "Set Alibaba Cloud Environment Variables"; Action = "alibaba" },
        @{ Text = "View All Environment Variables"; Action = "viewall" },
        @{ Text = "Refresh Current Terminal Environment"; Action = "refresh" },
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
                    'refresh' { Refresh-CurrentTerminalEnvironment }
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

