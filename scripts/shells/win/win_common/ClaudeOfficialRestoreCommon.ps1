$ClaudeOfficialConfigDir = Join-Path $env:USERPROFILE ".claude"
$ClaudeOfficialSettingsPath = Join-Path $ClaudeOfficialConfigDir "settings.json"
$ClaudeOfficialSettingsOverrideKeys = @(
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_DEFAULT_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_FABLE_MODEL",
    "ANTHROPIC_CUSTOM_MODEL_OPTION",
    "CLAUDE_CODE_SUBAGENT_MODEL",
    "CLAUDE_CONFIG_DIR"
)
$ClaudeOfficialProcessResetKeys = @(
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_DEFAULT_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_FABLE_MODEL",
    "ANTHROPIC_CUSTOM_MODEL_OPTION",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_NAME",
    "CLAUDE_CODE_SUBAGENT_MODEL",
    "CLAUDE_CODE_MAX_CONTEXT_TOKENS",
    "CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
    "CLAUDE_CONFIG_DIR"
)

function Test-ClaudeOfficialSettingsOverride {
    param([string]$SettingsPath)

    $settingsContent = ""
    $settings = $null
    $settingsEnvironment = $null
    $overrideKey = ""
    $overrideProperty = $null

    if (-not (Test-Path -LiteralPath $SettingsPath -PathType Leaf)) {
        return $false
    }

    $settingsContent = [System.IO.File]::ReadAllText($SettingsPath)
    try {
        $settings = $settingsContent | ConvertFrom-Json -ErrorAction Stop
        if (($null -eq $settings) -or -not ($settings.PSObject.Properties.Name -contains "env")) {
            return $false
        }
        $settingsEnvironment = $settings.env
        if ($null -eq $settingsEnvironment) {
            return $false
        }
        foreach ($overrideKey in $ClaudeOfficialSettingsOverrideKeys) {
            $overrideProperty = $settingsEnvironment.PSObject.Properties[$overrideKey]
            if (($null -ne $overrideProperty) -and -not [string]::IsNullOrWhiteSpace([string]$overrideProperty.Value)) {
                return $true
            }
        }
        return $false
    }
    catch {
        foreach ($overrideKey in $ClaudeOfficialSettingsOverrideKeys) {
            if ($settingsContent -match ('"{0}"\s*:' -f [regex]::Escape($overrideKey))) {
                return $true
            }
        }
        return $false
    }
}

function Test-ClaudeOfficialProcessOverride {
    $configDirValue = ""
    $overrideKey = ""
    $overrideValue = ""

    $configDirValue = [Environment]::GetEnvironmentVariable("CLAUDE_CONFIG_DIR", "Process")
    if (-not [string]::IsNullOrWhiteSpace($configDirValue)) {
        return $true
    }
    foreach ($overrideKey in $ClaudeOfficialSettingsOverrideKeys) {
        $overrideValue = [Environment]::GetEnvironmentVariable($overrideKey, "Process")
        if (-not [string]::IsNullOrWhiteSpace($overrideValue)) {
            return $true
        }
    }
    return $false
}

function Invoke-ClaudeOfficialRestore {
    $settingsOverrideDetected = $false
    $processOverrideDetected = $false
    $restoreRequired = $false
    $resetKey = ""

    $settingsOverrideDetected = Test-ClaudeOfficialSettingsOverride -SettingsPath $ClaudeOfficialSettingsPath
    $processOverrideDetected = Test-ClaudeOfficialProcessOverride
    $restoreRequired = $settingsOverrideDetected -or $processOverrideDetected

    if (-not $restoreRequired) {
        return
    }
    if ($settingsOverrideDetected) {
        Remove-Item -LiteralPath $ClaudeOfficialSettingsPath -Force
        Write-Host "[RESTORE] Removed overridden Claude Code user settings; Claude Code will regenerate official defaults." -ForegroundColor Green
    }
    foreach ($resetKey in $ClaudeOfficialProcessResetKeys) {
        Remove-Item -LiteralPath ("Env:{0}" -f $resetKey) -ErrorAction SilentlyContinue
    }
    if ($processOverrideDetected) {
        Write-Host "[RESTORE] Cleared inherited Claude Code provider and model overrides for this launch." -ForegroundColor Green
    }
}
