const translationService = require('#@ncore/utils/translation/index.js');
const logger = require('#@logger');

async function main() {
  const translationOption = {
    text: 'Hello World',
    targetLanguage: 'zh',
    sourceLanguage: 'en',
  };

  logger.info('Starting translation...');

  const result = await translationService.translate(translationOption, 'baidu');

  if (result.success) {
    logger.info('Translation successful:');
    logger.info('Original:', translationOption.text);
    logger.info('Translated:', result.data.text);
    logger.info('Platform:', result.platform);
  } else {
    logger.error('Translation failed:');
    logger.error('Error:', result.error.message);
    logger.error('Platform:', result.platform);
  }
}

main().catch((error) => {
  logger.error('Error:', error.message);
});
