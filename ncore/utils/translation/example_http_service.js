const translationService = require('#@ncore/utils/translation/index.js');
const logger = require('#@logger');

logger.info('Starting translation HTTP service...');

translationService.startHttpService(36315);

logger.info('Translation HTTP service started at http://localhost:36315');
logger.info('Send POST request to http://localhost:36315/translate with body:');
logger.info('{ "text": "Hello World", "targetLanguage": "zh", "provider": "baidu" }');
