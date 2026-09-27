const translationService = require('#@ncore/utils/translation/index.js');
const secretManager = require('#@secret_manager');
const logger = require('#@logger');

async function main() {
  let config, translationOption, result;

  logger.info('=== Translation with Secret Manager Example ===');
  logger.info('');

  logger.info('Step 1: Check if secret keys are available...');
  if (secretManager.hasSecretKey('BAIDU_TRANSLATION_APP_ID')) {
    logger.info('  ✓ BAIDU_TRANSLATION_APP_ID found');
  } else {
    logger.warn('  ✗ BAIDU_TRANSLATION_APP_ID not found');
  }

  if (secretManager.hasSecretKey('MOONSHOT_API_KEY')) {
    logger.info('  ✓ MOONSHOT_API_KEY found');
  } else {
    logger.warn('  ✗ MOONSHOT_API_KEY not found');
  }

  logger.info('');
  logger.info('Step 2: Load translation configuration...');
  logger.info('  (Secret keys will be auto-loaded from .secret_keys/)');
  logger.info('  Set SECRET_PASSWORD environment variable or use cached keys');
  logger.info('');

  config = translationService.getConfig();
  logger.info('Configuration loaded successfully');
  logger.info('  Default provider:', config.defaultProvider);

  logger.info('');
  logger.info('Step 3: Perform translation...');

  translationOption = {
    text: 'Hello World',
    targetLanguage: 'zh',
    sourceLanguage: 'en',
  };

  result = await translationService.translate(translationOption, 'baidu');

  if (result.success) {
    logger.info('  ✓ Translation successful');
    logger.info('    Original:', translationOption.text);
    logger.info('    Translated:', result.data.text);
    logger.info('    Platform:', result.platform);
  } else {
    logger.error('  ✗ Translation failed');
    logger.error('    Error:', result.error.message);
    logger.error('    Platform:', result.platform);
  }

  logger.info('');
  logger.info('=== Example Complete ===');
}

main().catch((error) => {
  logger.error('Error:', error.message);
  process.exit(1);
});
