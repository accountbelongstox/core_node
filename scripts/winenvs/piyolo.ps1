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

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = $PSScriptRoot
$scriptsDirPath = Split-Path $scriptPath -Parent
$coreNodePath = Split-Path $scriptsDirPath -Parent
$shellsPath = Join-Path $scriptsDirPath 'shells'
$winShellsPath = Join-Path $shellsPath 'win'
$winCommonPath = Join-Path $winShellsPath 'win_common'
$globalVarsPath = Join-Path $winCommonPath 'GlobalVars.ps1'
$shellsCommonPath = Join-Path $shellsPath 'common'
$harnessSettingsScriptPath = Join-Path $shellsCommonPath 'pi_harness_settings.js'
$mode = 'auto'
$supportedModes = @('auto', 'codex', 'claude', 'kimi', 'volc-agent', 'volc-coding')
$forwardArgs = @()
$piCandidates = @()
$piPath = $null
$candidatePath = $null
$provider = 'openai-codex'
$model = 'gpt-5.6-sol'
$thinking = 'high'
$codexModels = @(
    'openai-codex/gpt-5.3-codex-spark',
    'openai-codex/gpt-5.4',
    'openai-codex/gpt-5.4-mini',
    'openai-codex/gpt-5.5',
    'openai-codex/gpt-5.6-luna',
    'openai-codex/gpt-5.6-sol',
    'openai-codex/gpt-5.6-terra'
)
$claudeModels = @('anthropic/*')
$kimiModels = @(
    'kimi-coding/kimi-for-coding',
    'kimi-coding/kimi-for-coding-highspeed',
    'kimi-coding/k3'
)
$enabledModels = @()
$piArgs = @()
$piUserDir = $null
$piAgentDir = $null
$piSettingsPath = $null
$piModelsPath = $null
$nodeExePath = $null
$pnpmExePath = $null
$packageSource = '-'
$packageSources = @()
$packageNames = @()
$kimiProviderPackage = 'npm:pi-provider-kimi-code'
$claudeAuthPackage = 'npm:pi-claude-auth'
$nativeWebSearchPackage = 'npm:pi-web-search'
$portableWebPackage = 'npm:pi-web-kit'
$mcpPackage = 'npm:pi-mcp-extension'
$nativeWebSearchPackageName = 'pi-web-search'
$portableWebPackageName = 'pi-web-kit'
$mcpPackageName = 'pi-mcp-extension'
$originalUserProfile = $env:USERPROFILE
$originalClaudeConfigDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $originalUserProfile '.claude' }
$originalCodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $originalUserProfile '.codex' }
$claudeSkillsPath = Join-Path $originalClaudeConfigDir 'skills'
$codexSkillsPath = Join-Path $originalCodexHome 'skills'
$kimiCodeHome = if ($env:KIMI_CODE_HOME) { $env:KIMI_CODE_HOME } else { Join-Path $originalUserProfile '.kimi-code' }
$kimiSkillsPath = Join-Path $kimiCodeHome 'skills'
$skillPaths = @()
$gitBashCandidates = @()
$gitBashPath = $null
$shellPathArgument = '-'
$prerequisitesReady = $false
$kimiConfigCandidates = @()
$kimiConfigPath = $null
$piAuthPath = $null
$kimiProviderPackageName = 'pi-provider-kimi-code'
$claudeAuthPackageName = 'pi-claude-auth'
$codexAuthCandidates = @()
$codexAuthPath = $null
$claudeCredentialCandidates = @()
$claudeCredentialPath = $null
$isolatedClaudeDir = $null
$isolatedClaudeCredentialPath = $null
$packageName = $null
$providerReady = $true
$volcProfileType = $null
$volcProvider = $null
$volcApiKey = $null
$volcBaseUrl = $null
$volcApiKeyReference = '$PI_VOLC_API_KEY'
$volcAgentDefaultBaseUrl = 'https://ark.cn-beijing.volces.com/api/plan/v3'
$volcCodingDefaultBaseUrl = 'https://ark.cn-beijing.volces.com/api/coding/v3'
$volcAgentDefaultModel = 'kimi-k3'
$volcCodingDefaultModel = 'ark-code-latest'
$volcAgentModels = @('kimi-k3', 'auto', 'doubao-seed-evolving', 'doubao-seed-2.0-pro')
$volcCodingModels = @('ark-code-latest')
$volcCodingModelHint = 'When available in the Volcengine Coding Plan console, select GLM-5.3 or GLM-5.2; ark-code-latest follows that selection.'
$volcModels = @()
$arkcliConfigCandidates = @()
$arkcliConfigPath = $null
$arkcliProfileResult = $null
$arkcliProfileParts = @()
$legacySecretPath = $null
$legacyBaseUrlPath = $null
$legacySecretValue = $null
$kimiProviderConfigPath = $null
$piMcpConfigPath = $null
$piWebKitConfigPath = $null
$arkDocsMcpName = 'ark-docs-mcp'
$arkDocsMcpUrl = 'https://sd6j8o9hu8aldae0o6es0.apigateway-cn-beijing.volceapi.com/mcp'
$volcSearchMcpName = 'mcp-server-askecho-search-infinity'
$volcAgentMcpCandidates = @()
$volcAgentMcpSourcePath = $null
$uvxExePath = $null

. $globalVarsPath

# Maintenance references:
# - Pi providers/auth.json: https://pi.dev/docs/latest/providers
# - Pi environment overrides: https://pi.dev/docs/latest/environment-variables
# - Claude Code auth bridge: https://pi.dev/packages/pi-claude-auth
# - Kimi Code integration: https://pi.dev/packages/pi-provider-kimi-code
# - Provider-native Codex search: https://pi.dev/packages/pi-web-search
# - Provider-independent Claude/Kimi/Volc search/fetch: https://pi.dev/packages/pi-web-kit
# - Pi MCP client: https://pi.dev/packages/pi-mcp-extension
# Design constraints: keep provider profiles under D:\programing\Users, use only
# absolute Node/pnpm paths from GlobalVars.ps1, and repair every package/auth
# substep independently. Do not replace Pi's built-in openai-codex provider.
# The shared JavaScript helper owns JSON parsing so Windows and Linux retain the
# same idempotency and no-overwrite behavior during future upgrades.

$nodeExePath = $Global:NODE_EXE_PATH
$pnpmExePath = $Global:PNPM_EXE_PATH
$piCandidates = @(
    (Join-Path $Global:PNPM_GLOBAL_BIN_DIR 'pi.cmd'),
    (Join-Path $Global:NODE_DIR 'pi.cmd'),
    (Join-Path $Global:NODE_DIR 'pi.exe')
)
$gitBashCandidates = @(
    (Join-Path $Global:GIT_INSTALL_DIR 'bin\bash.exe'),
    (Join-Path $env:ProgramFiles 'Git\bin\bash.exe')
)
$kimiConfigCandidates = @(
    (Join-Path $kimiCodeHome 'config.toml'),
    (Join-Path $Global:PROGRAMING_USER_DIR '.kimi-code\config.toml'),
    (Join-Path $originalUserProfile '.kimi-code\config.toml')
)
$codexAuthCandidates = @(
    (Join-Path $originalCodexHome 'auth.json'),
    (Join-Path $Global:PROGRAMING_USER_DIR '.codex\auth.json')
)
$claudeCredentialCandidates = @(
    (Join-Path $originalClaudeConfigDir '.credentials.json'),
    (Join-Path $Global:PROGRAMING_USER_DIR '.claude\.credentials.json')
)
$arkcliConfigCandidates = @(
    (Join-Path $Global:PROGRAMING_USERS_DIR 'ark1\.arkcli\config.yaml'),
    (Join-Path $Global:PROGRAMING_USERS_DIR 'ark2\.arkcli\config.yaml'),
    (Join-Path $Global:PROGRAMING_USERS_DIR 'ark3\.arkcli\config.yaml'),
    (Join-Path $originalUserProfile '.arkcli\config.yaml')
)
$volcAgentMcpCandidates = @(
    (Join-Path $Global:PROGRAMING_USERS_DIR 'ark1\.claude.json'),
    (Join-Path $Global:PROGRAMING_USERS_DIR 'ark2\.claude.json'),
    (Join-Path $Global:PROGRAMING_USERS_DIR 'ark3\.claude.json')
)
$uvxExePath = Join-Path $Global:PYTHON_SCRIPTS_DIR 'uvx.exe'

if ($args.Count -gt 0 -and $supportedModes -contains $args[0].ToLowerInvariant()) {
    $mode = $args[0].ToLowerInvariant()
    $argIndex = 1
    if ($args.Count -gt 1 -and $args[1] -match '^\d+$') {
        $index = $args[1]
        $argIndex = 2
    }
    if ($args.Count -gt $argIndex) {
        $forwardArgs = @($args[$argIndex..($args.Count - 1)])
    }
}
else {
    $forwardArgs = @($args)
}

foreach ($candidatePath in $piCandidates) {
    if (-not $piPath -and (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
        $piPath = (Resolve-Path -LiteralPath $candidatePath).Path
    }
}

if ($mode -eq 'claude') {
    $provider = 'anthropic'
    $model = 'claude-opus-4-8'
    $enabledModels = $claudeModels
    $piUserDir = $Global:PI_CLAUDE_CODE_USER_DIR
    $piAgentDir = $Global:PI_CLAUDE_CODE_AGENT_DIR
    $packageSources = @($claudeAuthPackage, $portableWebPackage)
    $packageNames = @($claudeAuthPackageName, $portableWebPackageName)
    if (Test-Path -LiteralPath $claudeSkillsPath -PathType Container) {
        $skillPaths = @($claudeSkillsPath)
    }
}
elseif ($mode -eq 'kimi') {
    $provider = 'kimi-coding'
    $model = 'k3'
    $enabledModels = $kimiModels
    $piUserDir = $Global:PI_KIMI_USER_DIR
    $piAgentDir = $Global:PI_KIMI_AGENT_DIR
    $packageSource = $kimiProviderPackage
    $packageSources = @($kimiProviderPackage, $portableWebPackage)
    $packageNames = @($kimiProviderPackageName, $portableWebPackageName)
    if (Test-Path -LiteralPath $kimiSkillsPath -PathType Container) {
        $skillPaths = @($kimiSkillsPath)
    }
}
elseif ($mode -eq 'codex') {
    $enabledModels = $codexModels
    $piUserDir = $Global:PI_CODEX_USER_DIR
    $piAgentDir = $Global:PI_CODEX_AGENT_DIR
    $packageSources = @($nativeWebSearchPackage)
    $packageNames = @($nativeWebSearchPackageName)
    if (Test-Path -LiteralPath $codexSkillsPath -PathType Container) {
        $skillPaths = @($codexSkillsPath)
    }
}
elseif ($mode -eq 'volc-agent') {
    $provider = 'volcengine-agent-plan'
    $model = $volcAgentDefaultModel
    $volcModels = $volcAgentModels
    $enabledModels = @($volcModels | ForEach-Object { [string]::Format('{0}/{1}', $provider, $_) })
    $piUserDir = $Global:PI_VOLC_AGENT_USER_DIR
    $piAgentDir = $Global:PI_VOLC_AGENT_AGENT_DIR
    $volcProfileType = 'agent-plan'
    $volcProvider = $provider
    $volcBaseUrl = $volcAgentDefaultBaseUrl
    $providerReady = $false
    $packageSources = @($portableWebPackage, $mcpPackage)
    $packageNames = @($portableWebPackageName, $mcpPackageName)
}
elseif ($mode -eq 'volc-coding') {
    $provider = 'volcengine-coding-plan'
    $model = $volcCodingDefaultModel
    $volcModels = $volcCodingModels
    $enabledModels = @($volcModels | ForEach-Object { [string]::Format('{0}/{1}', $provider, $_) })
    $piUserDir = $Global:PI_VOLC_CODING_USER_DIR
    $piAgentDir = $Global:PI_VOLC_CODING_AGENT_DIR
    $volcProfileType = 'coding-plan'
    $volcProvider = $provider
    $volcBaseUrl = $volcCodingDefaultBaseUrl
    $providerReady = $false
    $packageSources = @($portableWebPackage, $mcpPackage)
    $packageNames = @($portableWebPackageName, $mcpPackageName)
}
else {
    $enabledModels = @($codexModels + $claudeModels + $kimiModels)
    $piUserDir = $Global:PI_COMMON_USER_DIR
    $piAgentDir = $Global:PI_COMMON_AGENT_DIR
    $packageSource = $kimiProviderPackage
    $packageSources = @($kimiProviderPackage, $claudeAuthPackage, $portableWebPackage)
    $packageNames = @($kimiProviderPackageName, $claudeAuthPackageName, $portableWebPackageName)
    foreach ($candidatePath in @($claudeSkillsPath, $codexSkillsPath, $kimiSkillsPath)) {
        if (Test-Path -LiteralPath $candidatePath -PathType Container) {
            $skillPaths += $candidatePath
        }
    }
}

$packageSource = if ($packageSources.Count -gt 0) { $packageSources -join ',' } else { '-' }

$piSettingsPath = Join-Path $piAgentDir 'settings.json'
$piModelsPath = Join-Path $piAgentDir 'models.json'
$kimiProviderConfigPath = Join-Path $piUserDir '.pi\providers\kimi-coding\config.json'
$piMcpConfigPath = Join-Path $piAgentDir 'mcp.json'
$piWebKitConfigPath = Join-Path $piAgentDir 'pi-web-kit.json'
$isolatedClaudeDir = Join-Path $piUserDir '.claude'
$isolatedClaudeCredentialPath = Join-Path $isolatedClaudeDir '.credentials.json'
foreach ($candidatePath in $gitBashCandidates) {
    if (-not $gitBashPath -and (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
        $gitBashPath = (Resolve-Path -LiteralPath $candidatePath).Path
    }
}
$shellPathArgument = if ($gitBashPath) { $gitBashPath } else { '-' }
if ($piPath -and
    (Test-Path -LiteralPath $nodeExePath -PathType Leaf) -and
    (Test-Path -LiteralPath $pnpmExePath -PathType Leaf) -and
    (Test-Path -LiteralPath $harnessSettingsScriptPath -PathType Leaf)) {
    $prerequisitesReady = $true
    if (-not (Test-Path -LiteralPath $piAgentDir -PathType Container)) {
        New-Item -ItemType Directory -Path $piAgentDir -Force | Out-Null
    }
    & $nodeExePath $harnessSettingsScriptPath pi $piSettingsPath $shellPathArgument $pnpmExePath $packageSource @skillPaths

    # Official Volcengine integration reference:
    # https://www.volcengine.com/docs/82379/2205646
    # https://www.volcengine.com/docs/82379/1528783
    # Pi custom-provider reference: https://pi.dev/docs/latest/models
    # Reuse the existing ark1/ark2/ark3 authorization for the requested plan
    # without changing arkcli's default profile. Agent Plan and Coding Plan are
    # separate quota gateways, so each gets an isolated Pi provider and HOME.
    if ($volcProfileType) {
        foreach ($candidatePath in $arkcliConfigCandidates) {
            if (-not $volcApiKey -and (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
                $arkcliConfigPath = (Resolve-Path -LiteralPath $candidatePath).Path
                $arkcliProfileResult = & $nodeExePath $harnessSettingsScriptPath arkcli-profile $arkcliConfigPath $volcProfileType
                if ($arkcliProfileResult) {
                    $arkcliProfileParts = @($arkcliProfileResult -split "`t", 2)
                    $volcApiKey = $arkcliProfileParts[0]
                    if ($arkcliProfileParts.Count -gt 1 -and $arkcliProfileParts[1]) {
                        $volcBaseUrl = $arkcliProfileParts[1].TrimEnd('/')
                        if (-not $volcBaseUrl.ToLowerInvariant().EndsWith('/v3')) {
                            $volcBaseUrl = [string]::Format('{0}/v3', $volcBaseUrl)
                        }
                    }
                }
            }
        }

        # claudevolc predates arkcli profiles. Preserve its Coding Plan files as
        # a fallback, but never mix that key into the Agent Plan provider.
        if ($mode -eq 'volc-coding' -and -not $volcApiKey) {
            $legacySecretPath = Join-Path $coreNodePath ".secret_keys\.secret_ignore\ARK_API_KEY_$index"
            $volcApiKey = & $nodeExePath $harnessSettingsScriptPath secret-file $legacySecretPath
            if ($volcApiKey) {
                Write-Host "[INFO] Loaded Volcengine API Key from ARK_API_KEY_$index" -ForegroundColor Green
            }
            
            $legacyBaseUrlPath = Join-Path $coreNodePath ".secret_keys\.secret_ignore\ARKCLI_API_$index"
            $legacySecretValue = & $nodeExePath $harnessSettingsScriptPath secret-file $legacyBaseUrlPath
            if (-not $legacySecretValue) {
                $legacyBaseUrlPath = Join-Path $coreNodePath ".secret_keys\.secret_ignore\ARK_BASE_URL_$index"
                $legacySecretValue = & $nodeExePath $harnessSettingsScriptPath secret-file $legacyBaseUrlPath
            }
            if ($legacySecretValue) {
                Write-Host "[INFO] Loaded Volcengine Base URL: $legacySecretValue" -ForegroundColor Green
                $volcBaseUrl = $legacySecretValue.TrimEnd('/')
                if (-not $volcBaseUrl.ToLowerInvariant().EndsWith('/v3')) {
                    $volcBaseUrl = [string]::Format('{0}/v3', $volcBaseUrl)
                }
            }
        }
        if ($mode -eq 'volc-coding') {
            $legacyModelPath = Join-Path $coreNodePath ".secret_keys\.secret_ignore\ARKCLI_MODEL_$index"
            $legacySecretValue = & $nodeExePath $harnessSettingsScriptPath secret-file $legacyModelPath
            if (-not $legacySecretValue -and $index -eq '1') {
                $legacyModelPath = Join-Path $coreNodePath '.secret_keys\.secret_ignore\ARKCLI_MODEL_2'
                $legacySecretValue = & $nodeExePath $harnessSettingsScriptPath secret-file $legacyModelPath
            }
            if ($legacySecretValue) {
                Write-Host "[INFO] Loaded Volcengine Model: $legacySecretValue" -ForegroundColor Green
                $model = $legacySecretValue
                if ($legacySecretValue -eq $volcCodingDefaultModel -or $legacySecretValue -eq $volcCodingFallbackModel) {
                    $volcModels = @($volcCodingDefaultModel, $volcCodingFallbackModel)
                    $enabledModels = @($volcModels | ForEach-Object { [string]::Format('{0}/{1}', $provider, $_) })
                }
                else {
                    $volcModels = @($legacySecretValue, $volcCodingDefaultModel, $volcCodingFallbackModel)
                    $enabledModels = @($volcModels | ForEach-Object { [string]::Format('{0}/{1}', $provider, $_) })
                }
            }
        }
        if ($volcApiKey) {
            $providerReady = $true
            $env:PI_VOLC_API_KEY = $volcApiKey
            & $nodeExePath $harnessSettingsScriptPath pi-provider $piModelsPath $volcProvider $volcBaseUrl $volcApiKeyReference @volcModels
        }
    }

    # settings.json package declarations and physical package installation are
    # separate states. Repair each missing package manifest independently with
    # the absolute pnpm executable; never use one aggregate "installed" flag.
    foreach ($packageName in $packageNames) {
        & $nodeExePath $harnessSettingsScriptPath pi-package $piAgentDir $pnpmExePath $packageName
    }

    # Kimi search/fetch uses the same OAuth session as the Kimi model provider.
    # Codex uses provider-native server search through pi-web-search. Claude,
    # Kimi, and Volcengine keep web access independent from model credential
    # type through pi-web-kit; Volcengine also loads the public Ark docs MCP.
    if ($volcProfileType -or $mode -eq 'claude' -or $mode -eq 'kimi' -or $mode -eq 'auto') {
        & $nodeExePath $harnessSettingsScriptPath pi-web-kit $piWebKitConfigPath
    }
    if ($volcProfileType) {
        & $nodeExePath $harnessSettingsScriptPath pi-mcp-server $piMcpConfigPath $arkDocsMcpName $arkDocsMcpUrl
    }
    if ($mode -eq 'volc-agent' -and (Test-Path -LiteralPath $uvxExePath -PathType Leaf)) {
        foreach ($candidatePath in $volcAgentMcpCandidates) {
            if (-not $volcAgentMcpSourcePath -and (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
                $volcAgentMcpSourcePath = (Resolve-Path -LiteralPath $candidatePath).Path
            }
        }
        if ($volcAgentMcpSourcePath) {
            & $nodeExePath $harnessSettingsScriptPath pi-mcp-source $volcAgentMcpSourcePath $piMcpConfigPath $volcSearchMcpName $uvxExePath
        }
    }

    # Codex CLI auth.json is a reusable source, but Pi owns the destination once
    # imported. The helper only fills a missing openai-codex entry so a token
    # refreshed by Pi is not replaced by an older or already-rotated CLI token.
    if ($mode -eq 'codex' -or $mode -eq 'auto') {
        foreach ($candidatePath in $codexAuthCandidates) {
            if (-not $codexAuthPath -and (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
                $codexAuthPath = (Resolve-Path -LiteralPath $candidatePath).Path
            }
        }
        if ($codexAuthPath) {
            $piAuthPath = Join-Path $piAgentDir 'auth.json'
            & $nodeExePath $harnessSettingsScriptPath codex-auth $codexAuthPath $piAuthPath
        }
    }

    # pi-claude-auth discovers ~/.claude/.credentials.json. Because this launcher
    # switches HOME to an isolated profile, copy the original credential file
    # only when the isolated copy is missing; later refreshes belong to that copy.
    if ($mode -eq 'claude' -or $mode -eq 'auto') {
        foreach ($candidatePath in $claudeCredentialCandidates) {
            if (-not $claudeCredentialPath -and (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
                $claudeCredentialPath = (Resolve-Path -LiteralPath $candidatePath).Path
            }
        }
        if ($claudeCredentialPath) {
            & $nodeExePath $harnessSettingsScriptPath credential-file $claudeCredentialPath $isolatedClaudeCredentialPath
        }
    }
    if ($mode -eq 'kimi' -or $mode -eq 'auto') {
        foreach ($candidatePath in $kimiConfigCandidates) {
            if (-not $kimiConfigPath -and (Test-Path -LiteralPath $candidatePath -PathType Leaf)) {
                $kimiConfigPath = (Resolve-Path -LiteralPath $candidatePath).Path
            }
        }
        if ($kimiConfigPath) {
            $piAuthPath = Join-Path $piAgentDir 'auth.json'
            & $nodeExePath $harnessSettingsScriptPath kimi-auth $kimiConfigPath $piAuthPath
        }
        if ($mode -eq 'kimi') {
            $piAuthPath = Join-Path $piAgentDir 'auth.json'
            & $nodeExePath $harnessSettingsScriptPath pi-kimi-k3 $piModelsPath
            & $nodeExePath $harnessSettingsScriptPath kimi-tools $kimiProviderConfigPath $piAuthPath
        }
    }
}
$env:KIMI_CODE_HOME = $kimiCodeHome
if ($mode -eq 'claude' -or $mode -eq 'auto') {
    $env:CLAUDE_CONFIG_DIR = $isolatedClaudeDir
}
$env:USERPROFILE = $piUserDir
$env:HOME = $piUserDir
$env:USER_HOME = $piUserDir
$env:HOMEPATH = $piUserDir
$env:USER_DIR = $piUserDir
$env:PI_CODING_AGENT_DIR = $piAgentDir

$piArgs = @(
    '--approve',
    '--provider', $provider,
    '--model', $model,
    '--thinking', $thinking,
    '--models', ($enabledModels -join ',')
)

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host 'piyolo.ps1' -ForegroundColor Yellow
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host "[INFO] Mode: $mode" -ForegroundColor Green
Write-Host "[INFO] Default model: $provider/$model ($thinking)" -ForegroundColor Green
if ($mode -eq 'volc-coding') {
    Write-Host "[INFO] Model selection: $volcCodingModelHint" -ForegroundColor Green
}
Write-Host "[INFO] Pi user data: $piUserDir" -ForegroundColor Green
Write-Host "[INFO] Project trust: approved; model cycling: $($enabledModels.Count) entries" -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''

if ($prerequisitesReady -and $providerReady) {
    & $piPath @piArgs @forwardArgs
}
elseif ($prerequisitesReady -and -not $providerReady) {
    Write-Host "[ERROR] No reusable $volcProfileType API key was found in the local Ark profiles." -ForegroundColor Red
}
else {
    Write-Host '[ERROR] Pi prerequisites are incomplete. Run Step41_InstallPiHarness first.' -ForegroundColor Red
}
