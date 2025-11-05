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

const streamTranslator = require('./index.js');
const logger = require('./libs/Logger.js');

logger.info('=== Stream Translator with Trigger Words Example ===');
logger.info('');

logger.info('Scenario: User sends multiple messages, but only wants to translate after saying "翻译"');
logger.info('');

const sessionId = 'user-chat-session';

logger.info('Step 1: Configure trigger words');
streamTranslator.setTriggerWords(sessionId, ['翻译', '请翻译', '帮我翻译']);
streamTranslator.enableTriggerWords(sessionId);

const status = streamTranslator.getTriggerWordsStatus(sessionId);
logger.info('Trigger words configured: ' + JSON.stringify(status.triggerWords));
logger.info('Trigger detection enabled: ' + status.enabled);
logger.info('');

logger.info('Step 2: User sends messages WITHOUT trigger word (no translation)');
streamTranslator.appendData(sessionId, 'User: Hello, how are you?\n');
streamTranslator.appendData(sessionId, 'Bot: I am fine, thank you.\n');
streamTranslator.appendData(sessionId, 'User: What is the weather like?\n');
streamTranslator.appendData(sessionId, 'Bot: It is sunny today.\n');
logger.info('  [Messages sent - no translation expected]');
logger.info('');

logger.info('Step 3: User says trigger word "翻译" (translation starts NOW)');
streamTranslator.appendData(sessionId, 'User: 翻译 Can you help me with this document?\n');
logger.info('  [Trigger word detected!]');
logger.info('');

logger.info('Step 4: User continues (these WILL be translated)');
streamTranslator.appendData(sessionId, 'Bot: Sure, I can help you translate the document.\n');
streamTranslator.appendData(sessionId, 'User: The document is about machine learning.\n');
streamTranslator.appendData(sessionId, 'Bot: Machine learning is a subset of artificial intelligence.\n');
logger.info('  [All messages after trigger will be translated]');
logger.info('');

streamTranslator.flushSession(sessionId);

logger.info('Step 5: Wait for translation processing...');
setTimeout(() => {
    logger.info('');
    logger.info('Step 6: Check results');
    logger.info('--------------------');

    const fullText = streamTranslator.getFullText(sessionId);
    const triggerStatus = streamTranslator.getTriggerWordsStatus(sessionId);

    logger.info('Trigger found: ' + triggerStatus.triggerFound);
    logger.info('Total messages: ' + fullText.length);
    logger.info('');

    logger.info('Messages breakdown:');
    let i;
    for (i = 0; i < fullText.length; i++) {
        const item = fullText[i];
        const wasTranslated = item.translation !== '' && item.translation !== item.original;
        const preview = item.original.substring(0, 50).replace(/\n/g, ' ');

        logger.info('[' + i + '] ' + preview);
        logger.info('    Translated: ' + wasTranslated);
        if (wasTranslated) {
            logger.info('    Translation: ' + item.translation.substring(0, 50));
        }
        logger.info('');
    }

    logger.info('=== Example Complete ===');
    logger.info('');
    logger.info('SUMMARY:');
    logger.info('- Messages 0-3: NOT translated (before trigger)');
    logger.info('- Message 4: Contains trigger word "翻译"');
    logger.info('- Messages 4-7: TRANSLATED (after trigger detected)');
    logger.info('');
    logger.info('BENEFITS:');
    logger.info('✓ Save API costs (only translate when needed)');
    logger.info('✓ User controls when translation starts');
    logger.info('✓ Works with real-time chat/streaming scenarios');
    logger.info('✓ Supports multiple trigger words (翻译, 请翻译, etc.)');
    logger.info('');
    logger.info('TRY IT WITH AZURE API:');
    logger.info('1. Set your Azure key: $env:AZURE_TRANSLATOR_KEY="your-key"');
    logger.info('2. Run this example again: node example_trigger.js');
    logger.info('3. Messages after "翻译" will be translated to Chinese');

    streamTranslator.clearSession(sessionId);
}, 2000);

logger.info('');
logger.info('MORE EXAMPLES:');
logger.info('');
logger.info('Example 1: Single trigger word');
logger.info('  translator.setTriggerWords(id, "翻译");');
logger.info('');
logger.info('Example 2: Multiple trigger words');
logger.info('  translator.setTriggerWords(id, ["翻译", "请翻译", "帮我翻译"]);');
logger.info('');
logger.info('Example 3: Add trigger word dynamically');
logger.info('  translator.addTriggerWord(id, "需要翻译");');
logger.info('');
logger.info('Example 4: Disable trigger words');
logger.info('  translator.disableTriggerWords(id);  // Translate everything');
logger.info('');
logger.info('See TRIGGER_WORDS_USAGE.txt for complete documentation');
logger.info('');
