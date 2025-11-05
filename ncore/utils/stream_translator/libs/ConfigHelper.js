// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const config = require('../config/index.js');
const logger = require('./Logger.js');

class ConfigHelper {
    static checkAzureConfig() {
        const endpoint = config.azure.endpoint;
        const apiKey = config.azure.apiKey;
        const region = config.azure.region;

        logger.info('=== Azure Translator Configuration Check ===');

        if (!endpoint || endpoint === '') {
            logger.error('[MISSING] Azure Translator Endpoint');
            logger.info('Set environment variable: AZURE_TRANSLATOR_ENDPOINT=api.cognitive.microsofttranslator.com');
        } else {
            logger.info('[OK] Endpoint: ' + endpoint);
        }

        if (!apiKey || apiKey === '') {
            logger.error('[MISSING] Azure Translator API Key');
            logger.info('Set environment variable: AZURE_TRANSLATOR_KEY=<your-key>');
            logger.info('Get your key from: https://portal.azure.com');
            logger.info('Navigate to: Translator resource -> Keys and Endpoint');
        } else {
            const maskedKey = apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
            logger.info('[OK] API Key: ' + maskedKey);
        }

        if (!region || region === '') {
            logger.warn('[WARNING] Azure Region not set, using default: global');
            logger.info('Set environment variable: AZURE_TRANSLATOR_REGION=<your-region>');
        } else {
            logger.info('[OK] Region: ' + region);
        }

        logger.info('=== Configuration Check Complete ===');

        return !!(endpoint && apiKey);
    }

    static printSetupInstructions() {
        logger.info('=== Azure Translator Setup Instructions ===');
        logger.info('');
        logger.info('Step 1: Create Azure Translator Resource');
        logger.info('  - Go to https://portal.azure.com');
        logger.info('  - Search for "Translator" or "Cognitive Services"');
        logger.info('  - Click "Create"');
        logger.info('  - Fill in the required information:');
        logger.info('    * Subscription: Your Azure subscription');
        logger.info('    * Resource Group: Create new or use existing');
        logger.info('    * Region: Select your preferred region');
        logger.info('    * Name: Choose a unique name');
        logger.info('    * Pricing tier: Select F0 (Free) or S1 (Standard)');
        logger.info('');
        logger.info('Step 2: Get Your API Key');
        logger.info('  - After deployment, go to your Translator resource');
        logger.info('  - Click "Keys and Endpoint" in the left menu');
        logger.info('  - Copy KEY 1 or KEY 2');
        logger.info('  - Copy the Region (e.g., eastus, westus2, global)');
        logger.info('');
        logger.info('Step 3: Configure Environment Variables');
        logger.info('  Windows PowerShell:');
        logger.info('    $env:AZURE_TRANSLATOR_ENDPOINT="api.cognitive.microsofttranslator.com"');
        logger.info('    $env:AZURE_TRANSLATOR_KEY="<your-key>"');
        logger.info('    $env:AZURE_TRANSLATOR_REGION="<your-region>"');
        logger.info('');
        logger.info('  Linux/Mac:');
        logger.info('    export AZURE_TRANSLATOR_ENDPOINT="api.cognitive.microsofttranslator.com"');
        logger.info('    export AZURE_TRANSLATOR_KEY="<your-key>"');
        logger.info('    export AZURE_TRANSLATOR_REGION="<your-region>"');
        logger.info('');
        logger.info('  Or add to your config file (gconfig.stream_translator):');
        logger.info('    {');
        logger.info('      "azure": {');
        logger.info('        "endpoint": "api.cognitive.microsofttranslator.com",');
        logger.info('        "apiKey": "<your-key>",');
        logger.info('        "region": "<your-region>"');
        logger.info('      }');
        logger.info('    }');
        logger.info('');
        logger.info('Step 4: Test Your Configuration');
        logger.info('  Run: node -e "require(\'#@ncore/utils/stream_translator/libs/ConfigHelper.js\').checkAzureConfig()"');
        logger.info('');
        logger.info('=== Setup Instructions Complete ===');
    }

    static getSupportedLanguages() {
        return config.supportedLanguages;
    }

    static printSupportedLanguages() {
        logger.info('=== Supported Languages ===');
        const languages = config.supportedLanguages;
        let keys = Object.keys(languages);
        let i;

        for (i = 0; i < keys.length; i++) {
            const code = keys[i];
            const name = languages[code];
            logger.info(code + ' - ' + name);
        }

        logger.info('=== Total: ' + keys.length + ' languages ===');
    }

    static getConfigSummary() {
        const summary = {
            azure: {
                endpoint: config.azure.endpoint || 'Not configured',
                hasApiKey: !!(config.azure.apiKey && config.azure.apiKey !== ''),
                region: config.azure.region || 'global',
                defaultTargetLanguage: config.azure.defaultTargetLanguage,
                apiVersion: config.azure.apiVersion,
                timeout: config.azure.timeout,
                retryCount: config.azure.retryCount
            },
            features: {
                enableCache: config.enableCache,
                enableLanguageDetection: config.enableLanguageDetection,
                maxCacheSize: config.maxCacheSize,
                batchSize: config.batchSize
            },
            codeDetection: {
                supportedMarkers: config.codeMarkers.length,
                singleLineComments: config.commentPatterns.singleLine.length,
                multiLineComments: config.commentPatterns.multiLineStart.length
            }
        };

        return summary;
    }

    static printConfigSummary() {
        const summary = this.getConfigSummary();
        logger.info('=== Stream Translator Configuration Summary ===');
        logger.info(JSON.stringify(summary, null, 2));
        logger.info('=== Summary Complete ===');
    }
}

module.exports = ConfigHelper;
