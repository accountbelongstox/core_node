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
    Claude AI Environment Variables Menu Module
.DESCRIPTION
    Provides menu functions for managing Claude AI environment variables
#>

#region Configuration

function Get-ClaudeConfig {
    return @{
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
            },
            @{
                Name = "ANTHROPIC_API_KEY"
                DisplayName = "ANTHROPIC_API_KEY"
                Description = "Claude AI API key (alternative to ANTHROPIC_AUTH_TOKEN)"
                IsSecret = $true
                InputType = "Token"
            }
        )
    }
}

#endregion

#region Menu Functions

function Show-ClaudeSubMenu {
    $config = Get-ClaudeConfig
    $configDisplayName = $config.DisplayName

    $menuItems = @(
        @{ Text = "Add $configDisplayName Global Command"; Action = "addcommand" },
        @{ Text = "View $configDisplayName Scripts"; Action = "viewscripts" },
        @{ Text = "Restore from Configuration"; Action = "restore" },
        @{ Text = "Back to Main Menu"; Action = "back" }
    )

    $selectedIndex = 0

    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "$configDisplayName Menu" -Type "Info"
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
                        $configName = "Claude AI"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-ClaudeConfig
                        }

                        Show-ExistingFilesMenu -ConfigName $configName -Files (Get-ExistingFiles -ConfigName $configName)
                        $result = Generate-GlobalCommand -ConfigName $configName

                        if ($result) {
                            Write-ColorMessage -Message "" -Type "Info"
                            Write-ColorMessage -Message "Do you want to save this configuration for later restoration? (Y/N)" -Type "Info"
                            $saveConfig = Read-Host "Save configuration"

                            if ($saveConfig -eq "Y" -or $saveConfig -eq "y") {
                                if ($script:UserInputValues -and $script:UserInputValues.Count -gt 0) {
                                    Save-ConfigurationToFile -ConfigName $configName -ConfigData $script:UserInputValues
                                }
                            }
                        }

                        Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
                        $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                    }
                    'viewscripts' {
                        $configName = "Claude AI"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-ClaudeConfig
                        }
                        Show-ListScripts -ConfigName $configName
                    }
                    'restore' {
                        $configName = "Claude AI"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-ClaudeConfig
                        }

                        $savedConfigData = Show-RestoreConfigurationMenu -ConfigName $configName
                        if ($savedConfigData) {
                            Restore-ConfigurationAndGenerate -ConfigName $configName -SavedConfigData $savedConfigData
                        }
                    }
                    'back' {
                        return
                    }
                }
            }
        }
    }
}

#endregion

