<#
.SYNOPSIS
    SSH Connection Environment Variables Menu Module
.DESCRIPTION
    Provides menu functions for managing SSH connection configurations with encrypted password storage
#>

#region Configuration

function Get-SSHConfig {
    return @{
        Title = "SSH Connection Configuration"
        Description = "Set up SSH connection with encrypted password storage"
        Common = "ssh"
        CommandPrefix = "ssh"
        DisplayName = "SSH Connection"
        SmartRecognition = @{
            Enabled = $true
            AllowedTypes = @("text", "password")
        }
        Variables = @(
            @{
                Name = "SSH_CONNECTION"
                DisplayName = "SSH_CONNECTION"
                Description = "SSH connection string (e.g., root@203.0.113.10)"
                IsSecret = $false
                InputType = "Text"
            },
            @{
                Name = "SSH_PASSWORD"
                DisplayName = "SSH_PASSWORD"
                Description = "SSH connection password (optional, will be encrypted)"
                IsSecret = $true
                InputType = "Password"
            }
        )
    }
}

#endregion

#region Menu Functions

function Show-SSHSubMenu {
    $config = Get-SSHConfig
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
                        $configName = "SSH Connection"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-SSHConfig
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
                        $configName = "SSH Connection"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-SSHConfig
                        }
                        Show-ListScripts -ConfigName $configName
                    }
                    'restore' {
                        $configName = "SSH Connection"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-SSHConfig
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
