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

const ModelInitializer = require('./libs/ModelInitializer.js');
const logger = require('./libs/Logger.js');

async function initializeDeepSeek() {
    logger.info('==========================================================');
    logger.info('  DeepSeek-VL Model Initialization Script');
    logger.info('==========================================================');
    logger.info('');

    const initializer = new ModelInitializer();

    logger.info('Step 1: Check platform and directories');
    logger.info('------------------------------------------------------------');
    const status = initializer.getStatus();

    logger.info('Platform: ' + status.platform);
    logger.info('Base directory: ' + status.baseDir);
    logger.info('Model directory: ' + status.modelDir);
    logger.info('Model exists: ' + status.exists);

    if (status.exists) {
        logger.info('Model valid: ' + status.isValid);
        logger.info('File count: ' + status.fileCount);
        logger.info('Has requirements.txt: ' + status.hasRequirements);
        logger.info('Has code directory: ' + status.hasCode);
    }

    logger.info('');

    if (status.isValid) {
        logger.info('DeepSeek-VL model already exists and is valid!');
        logger.info('Model path: ' + status.modelDir);
        logger.info('');
        logger.info('You can now use the model with:');
        logger.info('  process.env.DEEPSEEK_MODEL_DIR = "' + status.modelDir + '"');
        logger.info('  process.env.TRANSLATOR_PROVIDER = "deepseek"');
        logger.info('');
        return {
            success: true,
            message: 'Model already exists',
            path: status.modelDir
        };
    }

    logger.info('Step 2: Initialize DeepSeek-VL model');
    logger.info('------------------------------------------------------------');
    logger.info('This will:');
    logger.info('1. Clone DeepSeek-VL repository from GitHub');
    logger.info('2. Install Python dependencies');
    logger.info('3. Verify installation');
    logger.info('');
    logger.info('This may take several minutes...');
    logger.info('');

    const result = await initializer.initializeModel();

    logger.info('');
    logger.info('==========================================================');
    logger.info('  Initialization Result');
    logger.info('==========================================================');
    logger.info('');

    if (result.success) {
        logger.info('SUCCESS! DeepSeek-VL model initialized successfully!');
        logger.info('');
        logger.info('Model location: ' + result.path);
        logger.info('');
        logger.info('Next steps:');
        logger.info('1. Set environment variable:');
        logger.info('   Windows:');
        logger.info('     $env:DEEPSEEK_MODEL_DIR="' + result.path + '"');
        logger.info('     $env:TRANSLATOR_PROVIDER="deepseek"');
        logger.info('');
        logger.info('   Linux/WSL:');
        logger.info('     export DEEPSEEK_MODEL_DIR="' + result.path + '"');
        logger.info('     export TRANSLATOR_PROVIDER="deepseek"');
        logger.info('');
        logger.info('2. Test the model:');
        logger.info('   node test_deepseek.js');
        logger.info('');
    } else {
        logger.error('FAILED! Model initialization failed');
        logger.error('Error: ' + result.message);
        logger.info('');
        logger.info('Troubleshooting:');
        logger.info('1. Make sure Git is installed: git --version');
        logger.info('2. Make sure Python is installed: python --version');
        logger.info('3. Check network connection');
        logger.info('4. Check disk space in: ' + status.baseDir);
        logger.info('');
    }

    return result;
}

if (require.main === module) {
    initializeDeepSeek().then((result) => {
        if (result.success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    }).catch((error) => {
        logger.error('Initialization error: ' + error.message);
        logger.error(error.stack);
        process.exit(1);
    });
}

module.exports = { initializeDeepSeek };
