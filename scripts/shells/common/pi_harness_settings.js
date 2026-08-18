// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const fs = require('node:fs');
const childProcess = require('node:child_process');
const path = require('node:path');
const mode = process.argv[2] || '';
const targetPath = process.argv[3] || '';
const pnpmManagedInstallArgs = [
    '--config.public-hoist-pattern=*',
    '--config.auto-install-peers=false',
    '--config.confirm-modules-purge=false',
    '--config.strict-peer-dependencies=false',
    '--config.strict-dep-builds=false',
];
const piHostPeerPackageNames = [
    '@earendil-works/pi-agent-core',
    '@earendil-works/pi-ai',
    '@earendil-works/pi-coding-agent',
    '@earendil-works/pi-tui',
    '@mariozechner/pi-agent-core',
    '@mariozechner/pi-ai',
    '@mariozechner/pi-coding-agent',
    '@mariozechner/pi-tui',
    'typebox',
];
const publicHoistPatternExpression = /publicHoistPattern:\s*(?:\r?\n\s*-\s*['"]?\*['"]?|\[[^\]]*['"]?\*['"]?[^\]]*\])/;
const kimiK3ProviderId = 'kimi-coding';
const kimiK3ModelId = 'k3';
const kimiK3ContextWindow = 1048576;
const kimiK3MaxTokens = 131072;
let shellPath = '';
let pnpmPath = '';
let packageSource = '';
let packageSources = [];
let skillPaths = [];
let settings = {};
let settingsValid = true;
let existingSkills = [];
let existingPackages = [];
let mergedSkills = [];
let mergedPackages = [];
let rawConfig = '';
let parsedConfig = {};
let existingDirectories = [];
let mergedDirectories = [];
let getResult = null;
let serializedSettings = '';
let currentSettingsContent = '';
let settingsChanged = false;
let sourceConfigPath = '';
let targetAuthPath = '';
let sourceConfigContent = '';
let currentSection = '';
let kimiApiKey = '';
let line = '';
let sectionMatch = null;
let keyMatch = null;
let authSettings = {};
let serializedAuthSettings = '';
let currentAuthContent = '';
let existingKimiCredential = null;
let agentDirectory = '';
let packageName = '';
let packageDirectory = '';
let packageJsonPath = '';
let packageManifestPath = '';
let packageModulesMetadataPath = '';
let packageModulesMetadata = '';
let packageLayoutReady = false;
let packageJson = {};
let packagePnpmSettings = {};
let packagePeerDependencyRules = {};
let existingIgnoredPeerNames = [];
let packagePeerRulesReady = false;
let pnpmCliPath = '';
let packageManagerCommand = '';
let packageManagerArgs = [];
let packageRepairResult = null;
let packageInstallResult = null;
let authCredentialMutable = false;
let packageManagerOptions = {};
let authSettingsValid = true;
let serializedPackageJson = '';
let currentPackageJsonContent = '';
let sourceAuthPath = '';
let sourceAuthSettings = {};
let sourceTokens = {};
let codexAccessToken = '';
let codexRefreshToken = '';
let codexAccountId = '';
let codexExpires = 0;
let accessTokenParts = [];
let accessTokenPayload = '';
let accessTokenClaims = {};
let existingCodexCredential = null;
let sourceCredentialPath = '';
let targetCredentialPath = '';
let providerId = '';
let providerBaseUrl = '';
let providerApiKey = '';
let providerModels = [];
let modelsSettings = {};
let modelsSettingsValid = true;
let serializedModelsSettings = '';
let currentModelsContent = '';
let arkcliConfigContent = '';
let requestedProfileType = '';
let currentProfile = null;
let profilePropertyMatch = null;
let profileHeaderMatch = null;
let arkcliProfiles = [];
let arkcliProfile = null;
let profilePropertyValue = '';
let secretContent = '';
let secretValue = '';
let providerConfig = {};
let providerConfigValid = true;
let providerTools = {};
let providerToolName = '';
let providerToolConfig = {};
let serializedProviderConfig = '';
let currentProviderConfigContent = '';
let mcpConfig = {};
let mcpConfigValid = true;
let mcpServerName = '';
let mcpServerUrl = '';
let mcpServers = {};
let existingMcpServer = {};
let serializedMcpConfig = '';
let currentMcpConfigContent = '';
let webKitConfig = {};
let webKitConfigValid = true;
let serializedWebKitConfig = '';
let currentWebKitConfigContent = '';
let sourceMcpConfigPath = '';
let sourceMcpConfig = {};
let sourceMcpServer = {};
let targetMcpConfigPath = '';
let mcpCommandOverride = '';
let kimiAuthPath = '';
let kimiAuthConfig = {};
let kimiOAuthCredential = {};
let kimiNativeToolsEnabled = false;
let providerModelOverrides = {};
let providerModelConfig = {};
let cleanEnv = { ...process.env };
delete cleanEnv.SUDO_USER;
delete cleanEnv.SUDO_UID;
delete cleanEnv.SUDO_GID;

// Maintenance references:
// - Pi providers and canonical auth.json behavior: https://pi.dev/docs/latest/providers
// - Pi config-directory override: https://pi.dev/docs/latest/environment-variables
// - Claude Code credential bridge: https://pi.dev/packages/pi-claude-auth
// - Kimi Code provider and shared-login behavior: https://pi.dev/packages/pi-provider-kimi-code
// Keep this helper dependency-free so the Windows and Linux launchers share the
// same merge, installation, and credential-conversion rules. Each operation is
// independently idempotent; a completed package or credential step must never
// prevent another missing step from being repaired.

// Kimi native-tool reference: https://pi.dev/packages/pi-provider-kimi-code
// Kimi's search and fetch tools are provider-owned and require Kimi OAuth, so
// enable them only for profiles that can select the kimi-coding provider. Merge
// the two tool entries without replacing protocol, upload, or datasource knobs.
if (mode === 'kimi-tools') {
    kimiAuthPath = process.argv[4] || '';
    if (kimiAuthPath && fs.existsSync(kimiAuthPath)) {
        try {
            kimiAuthConfig = JSON.parse(fs.readFileSync(kimiAuthPath, 'utf8'));
            kimiOAuthCredential = kimiAuthConfig['kimi-coding'] || {};
            kimiNativeToolsEnabled = kimiOAuthCredential.type === 'oauth'
                && Boolean(kimiOAuthCredential.access)
                && Boolean(kimiOAuthCredential.refresh);
        } catch {
            kimiNativeToolsEnabled = false;
        }
    }
    if (fs.existsSync(targetPath)) {
        try {
            providerConfig = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        } catch {
            providerConfigValid = false;
            process.stderr.write(`[WARN] Kimi provider config is not valid JSON; leaving it unchanged: ${targetPath}\n`);
        }
    }
    if (providerConfigValid) {
        providerTools = providerConfig.tools && typeof providerConfig.tools === 'object'
            ? providerConfig.tools
            : {};
        for (providerToolName of ['moonshot_search', 'moonshot_fetch']) {
            providerToolConfig = providerTools[providerToolName]
                && typeof providerTools[providerToolName] === 'object'
                ? providerTools[providerToolName]
                : {};
            providerTools[providerToolName] = {
                ...providerToolConfig,
                enabled: kimiNativeToolsEnabled,
                default_collapsed: true,
            };
        }
        providerConfig.tools = providerTools;
        serializedProviderConfig = `${JSON.stringify(providerConfig, null, 2)}\n`;
        currentProviderConfigContent = fs.existsSync(targetPath)
            ? fs.readFileSync(targetPath, 'utf8')
            : '';
        if (currentProviderConfigContent !== serializedProviderConfig) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, serializedProviderConfig, 'utf8');
        }
    }
}

// Pi has no built-in MCP client. pi-mcp-extension uses this global mcp.json
// schema: https://pi.dev/packages/pi-mcp-extension
// Merge one remote server independently so a missing Ark docs server is repaired
// without removing any user-managed MCP server from the isolated Pi profile.
if (mode === 'pi-mcp-server') {
    mcpServerName = process.argv[4] || '';
    mcpServerUrl = process.argv[5] || '';
    if (fs.existsSync(targetPath)) {
        try {
            mcpConfig = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        } catch {
            mcpConfigValid = false;
            process.stderr.write(`[WARN] Pi MCP config is not valid JSON; leaving it unchanged: ${targetPath}\n`);
        }
    }
    if (mcpConfigValid && mcpServerName && mcpServerUrl) {
        mcpServers = mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object'
            ? mcpConfig.mcpServers
            : {};
        existingMcpServer = mcpServers[mcpServerName]
            && typeof mcpServers[mcpServerName] === 'object'
            ? mcpServers[mcpServerName]
            : {};
        mcpServers[mcpServerName] = {
            ...existingMcpServer,
            transport: 'streamable-http',
            url: mcpServerUrl,
            lifecycle: 'lazy',
        };
        mcpConfig.mcpServers = mcpServers;
        serializedMcpConfig = `${JSON.stringify(mcpConfig, null, 2)}\n`;
        currentMcpConfigContent = fs.existsSync(targetPath)
            ? fs.readFileSync(targetPath, 'utf8')
            : '';
        if (currentMcpConfigContent !== serializedMcpConfig) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, serializedMcpConfig, 'utf8');
        }
    }
}

// Volcengine Agent Plan Harness reference:
// https://www.volcengine.com/activity/agentplan
// The Harness search key is separate from the model API key. Reuse only the
// named AskEcho server from an existing Ark launcher config, preserve its env,
// and replace a PATH-dependent stdio command with the caller's absolute uvx.
if (mode === 'pi-mcp-source') {
    sourceMcpConfigPath = targetPath;
    targetMcpConfigPath = process.argv[4] || '';
    mcpServerName = process.argv[5] || '';
    mcpCommandOverride = process.argv[6] || '';
    if (sourceMcpConfigPath && targetMcpConfigPath && mcpServerName
        && fs.existsSync(sourceMcpConfigPath)) {
        try {
            sourceMcpConfig = JSON.parse(fs.readFileSync(sourceMcpConfigPath, 'utf8'));
            sourceMcpServer = sourceMcpConfig.mcpServers?.[mcpServerName] || {};
        } catch {
            process.stderr.write(`[WARN] Source MCP config could not be read: ${sourceMcpConfigPath}\n`);
        }
        if (sourceMcpServer && Object.keys(sourceMcpServer).length > 0) {
            if (fs.existsSync(targetMcpConfigPath)) {
                try {
                    mcpConfig = JSON.parse(fs.readFileSync(targetMcpConfigPath, 'utf8'));
                } catch {
                    mcpConfigValid = false;
                    process.stderr.write(`[WARN] Pi MCP config is not valid JSON; leaving it unchanged: ${targetMcpConfigPath}\n`);
                }
            }
            if (mcpConfigValid) {
                mcpServers = mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object'
                    ? mcpConfig.mcpServers
                    : {};
                mcpServers[mcpServerName] = {
                    ...sourceMcpServer,
                    ...(mcpCommandOverride ? { command: mcpCommandOverride } : {}),
                    transport: 'stdio',
                    lifecycle: 'lazy',
                };
                mcpConfig.mcpServers = mcpServers;
                serializedMcpConfig = `${JSON.stringify(mcpConfig, null, 2)}\n`;
                currentMcpConfigContent = fs.existsSync(targetMcpConfigPath)
                    ? fs.readFileSync(targetMcpConfigPath, 'utf8')
                    : '';
                if (currentMcpConfigContent !== serializedMcpConfig) {
                    fs.mkdirSync(path.dirname(targetMcpConfigPath), { recursive: true });
                    fs.writeFileSync(targetMcpConfigPath, serializedMcpConfig, { encoding: 'utf8', mode: 0o600 });
                }
            }
        }
    }
}

// Provider-independent web reference: https://pi.dev/packages/pi-web-kit
// Volcengine models do not expose the OpenAI/Anthropic native search transports.
// Use key-optional Exa MCP for search and keyless markdown.new for page fetches.
if (mode === 'pi-web-kit') {
    if (fs.existsSync(targetPath)) {
        try {
            webKitConfig = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        } catch {
            webKitConfigValid = false;
            process.stderr.write(`[WARN] Pi web-kit config is not valid JSON; leaving it unchanged: ${targetPath}\n`);
        }
    }
    if (webKitConfigValid) {
        webKitConfig.provider_search = 'exa_mcp';
        webKitConfig.provider_fetch = 'markdown_new';
        serializedWebKitConfig = `${JSON.stringify(webKitConfig, null, 2)}\n`;
        currentWebKitConfigContent = fs.existsSync(targetPath)
            ? fs.readFileSync(targetPath, 'utf8')
            : '';
        if (currentWebKitConfigContent !== serializedWebKitConfig) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, serializedWebKitConfig, 'utf8');
        }
    }
}

if (mode === 'pi') {
    shellPath = process.argv[4] === '-' ? '' : (process.argv[4] || '');
    pnpmPath = process.argv[5] || '';
    packageSource = process.argv[6] === '-' ? '' : (process.argv[6] || '');
    packageSources = packageSource.split(',').filter(Boolean);
    skillPaths = process.argv.slice(7).filter(Boolean);
    if (fs.existsSync(targetPath)) {
        try {
            settings = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        } catch {
            settingsValid = false;
            process.stderr.write(`[WARN] Pi settings are not valid JSON; leaving them unchanged: ${targetPath}\n`);
        }
    }

    if (settingsValid) {
        existingSkills = Array.isArray(settings.skills) ? settings.skills : [];
        existingPackages = Array.isArray(settings.packages) ? settings.packages : [];
        mergedSkills = [...new Set([...existingSkills, ...skillPaths])];
        mergedPackages = [...new Set([...existingPackages, ...packageSources])];
        settings.skills = mergedSkills;
        settings.packages = mergedPackages;
        settings.npmCommand = [pnpmPath, ...pnpmManagedInstallArgs];
        if (shellPath && !settings.shellPath) {
            settings.shellPath = shellPath;
        }
        serializedSettings = `${JSON.stringify(settings, null, 2)}\n`;
        currentSettingsContent = fs.existsSync(targetPath)
            ? fs.readFileSync(targetPath, 'utf8')
            : '';
        settingsChanged = currentSettingsContent !== serializedSettings;
        if (settingsChanged) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, serializedSettings, 'utf8');
        }
    }
}

if (mode === 'omp') {
    skillPaths = process.argv.slice(4).filter(Boolean);
    getResult = childProcess.spawnSync(targetPath, ['config', 'get', 'skills.customDirectories', '--json'], {
        encoding: 'utf8',
        env: cleanEnv,
    });
    rawConfig = getResult.stdout || '';
    try {
        parsedConfig = JSON.parse(rawConfig);
        existingDirectories = Array.isArray(parsedConfig.value) ? parsedConfig.value : [];
    } catch {
        existingDirectories = [];
    }
    mergedDirectories = [...new Set([...existingDirectories, ...skillPaths])];
    settingsChanged = JSON.stringify(existingDirectories) !== JSON.stringify(mergedDirectories);
    if (mergedDirectories.length > 0 && settingsChanged) {
        childProcess.spawnSync(
            targetPath,
            ['config', 'set', 'skills.customDirectories', JSON.stringify(mergedDirectories)],
            { stdio: 'inherit', env: cleanEnv },
        );
    }
}

if (mode === 'kimi-auth') {
    sourceConfigPath = targetPath;
    targetAuthPath = process.argv[4] || '';
    if (fs.existsSync(sourceConfigPath)) {
        sourceConfigContent = fs.readFileSync(sourceConfigPath, 'utf8');
        for (line of sourceConfigContent.split(/\r?\n/)) {
            sectionMatch = line.match(/^\s*\[([^\]]+)]\s*$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1].trim();
            } else if (currentSection.startsWith('providers.') && currentSection.toLowerCase().includes('kimi')) {
                keyMatch = line.match(/^\s*api_key\s*=\s*(["'])(.*?)\1\s*(?:#.*)?$/);
                if (keyMatch && keyMatch[2] && !kimiApiKey) {
                    kimiApiKey = keyMatch[2];
                }
            }
        }
    }

    if (kimiApiKey && targetAuthPath) {
        if (fs.existsSync(targetAuthPath)) {
            try {
                authSettings = JSON.parse(fs.readFileSync(targetAuthPath, 'utf8'));
            } catch {
                authSettingsValid = false;
                process.stderr.write(`[WARN] Pi auth is not valid JSON; leaving it unchanged: ${targetAuthPath}\n`);
            }
        }
        existingKimiCredential = authSettingsValid ? (authSettings['kimi-coding'] || null) : null;
        authCredentialMutable = authSettingsValid && (!existingKimiCredential || existingKimiCredential.type === 'api_key');
        if (authCredentialMutable) {
            authSettings['kimi-coding'] = { type: 'api_key', key: kimiApiKey };
            serializedAuthSettings = `${JSON.stringify(authSettings, null, 2)}\n`;
            currentAuthContent = fs.existsSync(targetAuthPath)
                ? fs.readFileSync(targetAuthPath, 'utf8')
                : '';
            if (currentAuthContent !== serializedAuthSettings) {
                fs.mkdirSync(path.dirname(targetAuthPath), { recursive: true });
                fs.writeFileSync(targetAuthPath, serializedAuthSettings, { encoding: 'utf8', mode: 0o600 });
            }
        }
    }
}

// A package entry in settings.json only enables discovery; it does not prove
// that the package or a loader-compatible dependency layout exists under the
// isolated agent directory. This deliberately supports scoped package names
// because path.join expands their slash into node_modules/@scope/name.
if (mode === 'pi-package') {
    agentDirectory = targetPath;
    pnpmPath = process.argv[4] || '';
    packageName = process.argv[5] || '';
    packageDirectory = path.join(agentDirectory, 'npm');
    packageJsonPath = path.join(packageDirectory, 'package.json');
    packageManifestPath = path.join(packageDirectory, 'node_modules', packageName, 'package.json');
    packageModulesMetadataPath = path.join(packageDirectory, 'node_modules', '.modules.yaml');
    packageModulesMetadata = fs.existsSync(packageModulesMetadataPath)
        ? fs.readFileSync(packageModulesMetadataPath, 'utf8')
        : '';
    packageLayoutReady = publicHoistPatternExpression.test(packageModulesMetadata);
    if (fs.existsSync(packageJsonPath)) {
        try {
            packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        } catch {
            packageJson = {};
        }
    }
    packagePnpmSettings = packageJson.pnpm && typeof packageJson.pnpm === 'object'
        && !Array.isArray(packageJson.pnpm)
        ? packageJson.pnpm
        : {};
    packagePeerDependencyRules = packagePnpmSettings.peerDependencyRules
        && typeof packagePnpmSettings.peerDependencyRules === 'object'
        && !Array.isArray(packagePnpmSettings.peerDependencyRules)
        ? packagePnpmSettings.peerDependencyRules
        : {};
    existingIgnoredPeerNames = Array.isArray(packagePeerDependencyRules.ignoreMissing)
        ? packagePeerDependencyRules.ignoreMissing
        : [];
    packagePeerRulesReady = piHostPeerPackageNames.every(
        (peerPackageName) => existingIgnoredPeerNames.includes(peerPackageName),
    );
    if (pnpmPath && packageName
        && (!fs.existsSync(packageManifestPath) || !packageLayoutReady || !packagePeerRulesReady)) {
        fs.mkdirSync(packageDirectory, { recursive: true });
        if (!packageJson.name) {
            packageJson.name = 'pi-extensions';
        }
        packageJson.private = true;
        packagePeerDependencyRules.ignoreMissing = Array.from(new Set([
            ...existingIgnoredPeerNames,
            ...piHostPeerPackageNames,
        ]));
        packagePnpmSettings.peerDependencyRules = packagePeerDependencyRules;
        packageJson.pnpm = packagePnpmSettings;
        serializedPackageJson = `${JSON.stringify(packageJson, null, 2)}\n`;
        currentPackageJsonContent = fs.existsSync(packageJsonPath)
            ? fs.readFileSync(packageJsonPath, 'utf8')
            : '';
        if (currentPackageJsonContent !== serializedPackageJson) {
            fs.writeFileSync(packageJsonPath, serializedPackageJson, 'utf8');
        }
        packageManagerCommand = pnpmPath;
        packageManagerArgs = [];
        pnpmCliPath = path.join(path.dirname(pnpmPath), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');
        if (process.platform === 'win32' && fs.existsSync(pnpmCliPath)) {
            packageManagerCommand = process.execPath;
            packageManagerArgs = [pnpmCliPath];
        }
        packageManagerOptions = {
            cwd: packageDirectory,
            stdio: 'inherit',
            env: cleanEnv,
        };
        if (!packageLayoutReady) {
            packageRepairResult = childProcess.spawnSync(
                packageManagerCommand,
                [...packageManagerArgs, 'install', ...pnpmManagedInstallArgs],
                packageManagerOptions,
            );
            if (packageRepairResult.status === 0 && fs.existsSync(packageModulesMetadataPath)) {
                packageModulesMetadata = fs.readFileSync(packageModulesMetadataPath, 'utf8');
                packageLayoutReady = publicHoistPatternExpression.test(packageModulesMetadata);
            }
        }
        if (packageLayoutReady && !fs.existsSync(packageManifestPath)) {
            packageInstallResult = childProcess.spawnSync(
                packageManagerCommand,
                [...packageManagerArgs, 'add', '--save-exact', packageName, ...pnpmManagedInstallArgs],
                packageManagerOptions,
            );
        }
    }
}

// Pi has a built-in openai-codex provider, so no replacement provider package
// is required. Codex CLI and Pi store the same OAuth material in different JSON
// shapes. Pi expects { type, access, refresh, expires, accountId }; Codex CLI
// stores it below tokens and carries expiry in the access-token JWT. Import only
// when Pi has no openai-codex entry: Pi may rotate a single-use refresh token,
// and overwriting that newer entry on every launch could invalidate the session.
// Recheck the Pi providers documentation and the installed Pi OAuth schema when
// either upstream changes its auth format.
if (mode === 'codex-auth') {
    sourceAuthPath = targetPath;
    targetAuthPath = process.argv[4] || '';
    if (fs.existsSync(sourceAuthPath) && targetAuthPath) {
        try {
            sourceAuthSettings = JSON.parse(fs.readFileSync(sourceAuthPath, 'utf8'));
            sourceTokens = sourceAuthSettings.tokens || {};
            codexAccessToken = sourceTokens.access_token || '';
            codexRefreshToken = sourceTokens.refresh_token || '';
            codexAccountId = sourceTokens.account_id || '';
            accessTokenParts = codexAccessToken.split('.');
            if (accessTokenParts.length > 1) {
                accessTokenPayload = accessTokenParts[1]
                    .replace(/-/g, '+')
                    .replace(/_/g, '/');
                accessTokenPayload = accessTokenPayload.padEnd(
                    accessTokenPayload.length + ((4 - (accessTokenPayload.length % 4)) % 4),
                    '=',
                );
                accessTokenClaims = JSON.parse(Buffer.from(accessTokenPayload, 'base64').toString('utf8'));
                codexExpires = Number(accessTokenClaims.exp || 0) * 1000;
                codexAccountId = codexAccountId
                    || accessTokenClaims['https://api.openai.com/auth']?.chatgpt_account_id
                    || '';
            }
        } catch {
            process.stderr.write(`[WARN] Codex auth could not be read: ${sourceAuthPath}\n`);
        }

        if (codexAccessToken && codexRefreshToken && codexAccountId && codexExpires) {
            if (fs.existsSync(targetAuthPath)) {
                try {
                    authSettings = JSON.parse(fs.readFileSync(targetAuthPath, 'utf8'));
                } catch {
                    authSettingsValid = false;
                    process.stderr.write(`[WARN] Pi auth is not valid JSON; leaving it unchanged: ${targetAuthPath}\n`);
                }
            }
            existingCodexCredential = authSettingsValid ? (authSettings['openai-codex'] || null) : null;
            if (authSettingsValid && !existingCodexCredential) {
                authSettings['openai-codex'] = {
                    type: 'oauth',
                    access: codexAccessToken,
                    refresh: codexRefreshToken,
                    expires: codexExpires,
                    accountId: codexAccountId,
                };
                serializedAuthSettings = `${JSON.stringify(authSettings, null, 2)}\n`;
                fs.mkdirSync(path.dirname(targetAuthPath), { recursive: true });
                fs.writeFileSync(targetAuthPath, serializedAuthSettings, { encoding: 'utf8', mode: 0o600 });
            }
        }
    }
}

// pi-claude-auth reads ~/.claude/.credentials.json on Windows and Linux. The
// launchers intentionally relocate HOME for separate Pi user data, so seed that
// isolated Claude directory once. Never overwrite it: the extension can rotate
// tokens and write newer credentials back to this isolated file. If the source
// file is absent, leave Pi unchanged so its normal /login behavior remains.
if (mode === 'credential-file') {
    sourceCredentialPath = targetPath;
    targetCredentialPath = process.argv[4] || '';
    if (sourceCredentialPath && targetCredentialPath
        && fs.existsSync(sourceCredentialPath)
        && !fs.existsSync(targetCredentialPath)) {
        fs.mkdirSync(path.dirname(targetCredentialPath), { recursive: true });
        fs.copyFileSync(sourceCredentialPath, targetCredentialPath);
        fs.chmodSync(targetCredentialPath, 0o600);
    }
}

if (mode === 'pi-kimi-k3') {
    if (fs.existsSync(targetPath)) {
        try {
            modelsSettings = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        } catch {
            modelsSettingsValid = false;
            process.stderr.write(`[WARN] Pi models are not valid JSON; leaving them unchanged: ${targetPath}\n`);
        }
    }
    if (modelsSettingsValid && targetPath) {
        modelsSettings.providers = modelsSettings.providers
            && typeof modelsSettings.providers === 'object'
            ? modelsSettings.providers
            : {};
        providerConfig = modelsSettings.providers[kimiK3ProviderId]
            && typeof modelsSettings.providers[kimiK3ProviderId] === 'object'
            ? modelsSettings.providers[kimiK3ProviderId]
            : {};
        providerModelOverrides = providerConfig.modelOverrides
            && typeof providerConfig.modelOverrides === 'object'
            ? providerConfig.modelOverrides
            : {};
        providerModelConfig = providerModelOverrides[kimiK3ModelId]
            && typeof providerModelOverrides[kimiK3ModelId] === 'object'
            ? providerModelOverrides[kimiK3ModelId]
            : {};
        providerModelOverrides[kimiK3ModelId] = {
            ...providerModelConfig,
            contextWindow: kimiK3ContextWindow,
            maxTokens: kimiK3MaxTokens,
        };
        providerConfig.modelOverrides = providerModelOverrides;
        modelsSettings.providers[kimiK3ProviderId] = providerConfig;
        serializedModelsSettings = `${JSON.stringify(modelsSettings, null, 2)}\n`;
        currentModelsContent = fs.existsSync(targetPath)
            ? fs.readFileSync(targetPath, 'utf8')
            : '';
        if (currentModelsContent !== serializedModelsSettings) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, serializedModelsSettings, 'utf8');
        }
    }
}

// Pi custom-provider reference: https://pi.dev/docs/latest/models
// Volcengine integration references:
// https://www.volcengine.com/docs/82379/2205646
// https://www.volcengine.com/docs/82379/1528783
// Agent Plan and Coding Plan expose separate OpenAI-compatible gateways at
// /api/plan/v3 and /api/coding/v3. Keep API keys as environment references
// instead of persisting secrets in models.json.
// Replace only this provider entry and preserve every unrelated provider.
if (mode === 'pi-provider') {
    providerId = process.argv[4] || '';
    providerBaseUrl = process.argv[5] || '';
    providerApiKey = process.argv[6] || '';
    providerModels = [...new Set(process.argv.slice(7).filter(Boolean))];
    if (fs.existsSync(targetPath)) {
        try {
            modelsSettings = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        } catch {
            modelsSettingsValid = false;
            process.stderr.write(`[WARN] Pi models are not valid JSON; leaving them unchanged: ${targetPath}\n`);
        }
    }
    if (modelsSettingsValid && providerId && providerBaseUrl && providerModels.length > 0) {
        modelsSettings.providers = modelsSettings.providers || {};
        modelsSettings.providers[providerId] = {
            baseUrl: providerBaseUrl,
            api: 'openai-completions',
            apiKey: providerApiKey,
            authHeader: true,
            compat: {
                supportsDeveloperRole: false,
                supportsReasoningEffort: false,
                maxTokensField: 'max_tokens',
            },
            models: providerModels.map((id) => ({
                id,
                reasoning: true,
                input: ['text'],
            })),
        };
        serializedModelsSettings = `${JSON.stringify(modelsSettings, null, 2)}\n`;
        currentModelsContent = fs.existsSync(targetPath)
            ? fs.readFileSync(targetPath, 'utf8')
            : '';
        if (currentModelsContent !== serializedModelsSettings) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, serializedModelsSettings, 'utf8');
        }
    }
}

// ark1/ark2/ark3 already keep both subscription profiles in config.yaml. Read
// the requested profile directly so Pi shares the existing authorization and
// never asks the user to switch the arkcli default profile. The parser handles
// only the stable scalar fields needed here and deliberately ignores secrets
// belonging to every unrelated profile.
if (mode === 'arkcli-profile') {
    requestedProfileType = process.argv[4] || '';
    if (targetPath && fs.existsSync(targetPath)) {
        arkcliConfigContent = fs.readFileSync(targetPath, 'utf8').replace(/^\uFEFF/, '');
        for (line of arkcliConfigContent.split(/\r?\n/)) {
            profileHeaderMatch = line.match(/^  ([^\s][^:]*):\s*$/);
            if (profileHeaderMatch) {
                if (currentProfile) {
                    arkcliProfiles.push(currentProfile);
                }
                currentProfile = { name: profileHeaderMatch[1] };
            } else if (currentProfile) {
                profilePropertyMatch = line.match(/^    ([A-Za-z0-9_]+):\s*(.*?)\s*$/);
                if (profilePropertyMatch) {
                    profilePropertyValue = profilePropertyMatch[2];
                    if ((profilePropertyValue.startsWith('"') && profilePropertyValue.endsWith('"'))
                        || (profilePropertyValue.startsWith("'") && profilePropertyValue.endsWith("'"))) {
                        profilePropertyValue = profilePropertyValue.slice(1, -1);
                    }
                    currentProfile[profilePropertyMatch[1]] = profilePropertyValue;
                }
            }
        }
        if (currentProfile) {
            arkcliProfiles.push(currentProfile);
        }
        arkcliProfile = arkcliProfiles.find((candidate) => candidate.type === requestedProfileType) || null;
        if (arkcliProfile && arkcliProfile.api_key) {
            process.stdout.write(`${arkcliProfile.api_key}\t${arkcliProfile.anthropic_base_url || ''}`);
        }
    }
}

// Secret files managed by dd.cmd/dd.sh are single-value files and may contain
// a UTF-8 BOM. Centralize their decoding here to keep Windows/Linux fallback
// behavior identical without copying parsing functions into every launcher.
if (mode === 'secret-file' && targetPath && fs.existsSync(targetPath)) {
    secretContent = fs.readFileSync(targetPath, 'utf8').replace(/^\uFEFF/, '');
    secretValue = secretContent.split(/\r?\n/).map((value) => value.trim()).find(Boolean) || '';
    process.stdout.write(secretValue);
}
