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
