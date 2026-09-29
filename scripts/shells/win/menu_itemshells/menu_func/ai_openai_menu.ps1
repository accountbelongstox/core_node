<#
.SYNOPSIS
    Codex CLI Environment Variables Menu Module
.DESCRIPTION
    Provides menu functions for managing Codex CLI (OpenAI) environment variables
#>

#region Configuration

function Get-CodexConfig {
    return @{
        Title = "Codex CLI Environment Variables"
        Description = "Set up Codex CLI environment variables for API access"
        Common = "codex"
        CommandPrefix = "codex"
        DisplayName = "Codex CLI"
        SmartRecognition = @{
            Enabled = $true
            AllowedTypes = @("token", "url")
        }
        Variables = @(
            @{
                Name = "OPENAI_API_KEY"
                DisplayName = "OPENAI_API_KEY"
                Description = "OpenAI API key for Codex CLI"
                IsSecret = $true
                InputType = "Token"
            },
            @{
                Name = "OPENAI_BASE_URL"
                DisplayName = "OPENAI_BASE_URL"
                Description = "OpenAI-compatible API base URL (proxy/relay, leave empty for api.openai.com)"
                IsSecret = $false
                InputType = "Url"
            }
        )
    }
}

# Backward-compatible alias
function Get-OpenAIConfig { Get-CodexConfig }

#endregion

#region Menu Functions

function Show-CodexSubMenu {
    $config = Get-CodexConfig
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
                        $configName = "Codex CLI"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-CodexConfig
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
                        $configName = "Codex CLI"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-CodexConfig
                        }
                        Show-ListScripts -ConfigName $configName
                    }
                    'restore' {
                        $configName = "Codex CLI"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-CodexConfig
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
