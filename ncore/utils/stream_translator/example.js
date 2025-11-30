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

async function checkSetup() {
    logger.info('=== Checking Azure Translator Setup ===');

    const isConfigured = streamTranslator.checkConfig();

    if (!isConfigured) {
        logger.error('Azure Translator is not properly configured!');
        logger.info('Please run: streamTranslator.printSetupInstructions()');
        return false;
    }

    logger.info('Configuration looks good!');
    streamTranslator.printConfigSummary();
    streamTranslator.printSupportedLanguages();

    return true;
}

async function exampleBasicUsage() {
    const sessionId = 'example-session-1';

    streamTranslator.onTranslationReady((data) => {
        logger.info('Translation ready for session: ' + data.id + ', index: ' + data.index);
    });

    streamTranslator.appendData(sessionId, 'This is the first line\n');
    streamTranslator.appendData(sessionId, 'This is the second line\n');
    streamTranslator.appendData(sessionId, '# This is a comment\n');
    streamTranslator.appendData(sessionId, 'Normal text here');

    streamTranslator.flushSession(sessionId);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const fullText = streamTranslator.getFullText(sessionId);
    logger.info('Full text with translations:');
    logger.info(JSON.stringify(fullText, null, 2));

    const translationMap = streamTranslator.getTranslationMap(sessionId);
    logger.info('Translation map:');
    logger.info(JSON.stringify(translationMap, null, 2));

    const streamOutput = streamTranslator.getStreamOutput(sessionId);
    logger.info('Stream output:');
    logger.info(streamOutput);

    streamTranslator.clearSession(sessionId);
}

async function exampleCodeTranslation() {
    const sessionId = 'code-session-1';

    streamTranslator.appendData(sessionId, 'Here is some python code:\n');
    streamTranslator.appendData(sessionId, '```python\n');
    streamTranslator.appendData(sessionId, '# This function calculates factorial\n');
    streamTranslator.appendData(sessionId, 'def factorial(n):\n');
    streamTranslator.appendData(sessionId, '    # Base case\n');
    streamTranslator.appendData(sessionId, '    if n == 0:\n');
    streamTranslator.appendData(sessionId, '        return 1\n');
    streamTranslator.appendData(sessionId, '    return n * factorial(n - 1)\n');
    streamTranslator.appendData(sessionId, '```\n');
    streamTranslator.appendData(sessionId, 'The code above implements recursion\n');

    streamTranslator.flushSession(sessionId);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const sessionInfo = streamTranslator.getSessionInfo(sessionId);
    logger.info('Session info:');
    logger.info(JSON.stringify(sessionInfo, null, 2));

    const translationMap = streamTranslator.getTranslationMap(sessionId);
    logger.info('Translation map for code:');
    logger.info(JSON.stringify(translationMap, null, 2));

    streamTranslator.clearSession(sessionId);
}

async function exampleMultipleSessions() {
    const session1 = 'multi-session-1';
    const session2 = 'multi-session-2';

    streamTranslator.appendData(session1, 'First session line 1\n');
    streamTranslator.appendData(session2, 'Second session line 1\n');
    streamTranslator.appendData(session1, 'First session line 2\n');
    streamTranslator.appendData(session2, 'Second session line 2\n');

    streamTranslator.flushSession(session1);
    streamTranslator.flushSession(session2);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const allSessions = streamTranslator.getAllSessions();
    logger.info('All sessions:');
    logger.info(JSON.stringify(allSessions, null, 2));

    streamTranslator.clearAllSessions();
}

async function runExamples() {
    const setupOk = await checkSetup();

    if (!setupOk) {
        logger.error('Please configure Azure Translator first. See SETUP_AZURE.txt for instructions.');
        return;
    }

    logger.info('\n=== Example 1: Basic Usage ===');
    await exampleBasicUsage();

    logger.info('\n=== Example 2: Code Translation ===');
    await exampleCodeTranslation();

    logger.info('\n=== Example 3: Multiple Sessions ===');
    await exampleMultipleSessions();
}

if (require.main === module) {
    runExamples().catch(error => {
        logger.error('Example error: ' + error.message);
    });
}

module.exports = {
    checkSetup,
    exampleBasicUsage,
    exampleCodeTranslation,
    exampleMultipleSessions
};
