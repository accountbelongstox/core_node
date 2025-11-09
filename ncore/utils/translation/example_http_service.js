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

const translationService = require('#@ncore/utils/translation');
const logger = require('#@logger');

logger.info('Starting translation HTTP service...');

translationService.startHttpService(36315);

logger.info('Translation HTTP service started at http://localhost:36315');
logger.info('Send POST request to http://localhost:36315/translate with body:');
logger.info('{ "text": "Hello World", "targetLanguage": "zh", "provider": "baidu" }');
