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
    OpenAI Environment Variables Menu Module
.DESCRIPTION
    Provides menu functions for managing OpenAI environment variables
#>

#region Configuration

function Get-OpenAIConfig {
    return @{
        Title = "OpenAI Environment Variables"
        Description = "Set up OpenAI environment variables for API access"
        Common = "openai"
        CommandPrefix = "openai"
        DisplayName = "OpenAI"
        SmartRecognition = @{
            Enabled = $true
            AllowedTypes = @("token", "url")
        }
        Variables = @(
            @{
                Name = "OPENAI_API_KEY"
                DisplayName = "OPENAI_API_KEY"
                Description = "OpenAI API key"
                IsSecret = $true
                InputType = "Token"
            },
            @{
                Name = "OPENAI_BASE_URL"
                DisplayName = "OPENAI_BASE_URL"
                Description = "OpenAI API base URL (optional)"
                IsSecret = $false
                InputType = "Url"
            },
            @{
                Name = "OPENAI_ORG_ID"
                DisplayName = "OPENAI_ORG_ID"
                Description = "OpenAI Organization ID (optional)"
                IsSecret = $false
                InputType = "Token"
            }
        )
    }
}

#endregion

#region Menu Functions

function Show-OpenAISubMenu {
    $config = Get-OpenAIConfig
    $configDisplayName = $config.DisplayName

    $menuItems = @(
        @{ Text = "Add $configDisplayName Global Command"; Action = "addcommand" },
        @{ Text = "View $configDisplayName Scripts"; Action = "viewscripts" },
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
                        $configName = "OpenAI"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-OpenAIConfig
                        }

                        Show-ExistingFilesMenu -ConfigName $configName -Files (Get-ExistingFiles -ConfigName $configName)
                        Generate-GlobalCommand -ConfigName $configName
                        Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
                        $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                    }
                    'viewscripts' {
                        $configName = "OpenAI"
                        if (-not $script:EnvironmentConfigs.ContainsKey($configName)) {
                            $script:EnvironmentConfigs[$configName] = Get-OpenAIConfig
                        }
                        Show-ListScripts -ConfigName $configName
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

