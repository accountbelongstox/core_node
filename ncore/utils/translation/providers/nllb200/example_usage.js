const translation = require('#@ncore/utils/translation');
const logger = require('#@logger');

async function testNLLB200() {
  logger.info('='.repeat(60));
  logger.info('  NLLB-200 Translation Provider - Example Usage');
  logger.info('='.repeat(60));
  logger.info('');

  try {
    logger.info('0. Initializing NLLB-200 provider...');
    logger.info('-'.repeat(60));

    const translator = translation.getTranslator('nllb200');
    const initialized = await translator.initialize();

    if (!initialized) {
      logger.error('Failed to initialize NLLB-200 provider');
      return;
    }

    logger.info('NLLB-200 provider initialized successfully');
    logger.info('');

    logger.info('1. Testing English to Chinese translation...');
    logger.info('-'.repeat(60));

    const result1 = await translation.translate({
      text: 'Hello! This is a test of the NLLB-200 translation model.',
      from: 'en',
      to: 'zh'
    }, 'nllb200');

    logger.info('Translation Result:');
    logger.info(`  Original: ${result1.originalText || 'Hello! This is a test of the NLLB-200 translation model.'}`);
    logger.info(`  Translated: ${result1.text}`);
    logger.info(`  From: ${result1.from}`);
    logger.info(`  To: ${result1.to}`);
    logger.info(`  Provider: ${result1.provider}`);
    logger.info(`  Model: ${result1.model}`);
    logger.info('');

    logger.info('2. Testing Chinese to English translation...');
    logger.info('-'.repeat(60));

    const result2 = await translation.translate({
      text: '你好！这是一个测试。',
      from: 'zh',
      to: 'en'
    }, 'nllb200');

    logger.info('Translation Result:');
    logger.info(`  Original: 你好！这是一个测试。`);
    logger.info(`  Translated: ${result2.text}`);
    logger.info(`  From: ${result2.from}`);
    logger.info(`  To: ${result2.to}`);
    logger.info(`  Provider: ${result2.provider}`);
    logger.info('');

    logger.info('3. Testing Japanese to Korean translation...');
    logger.info('-'.repeat(60));

    const result3 = await translation.translate({
      text: 'こんにちは、世界！',
      from: 'ja',
      to: 'ko'
    }, 'nllb200');

    logger.info('Translation Result:');
    logger.info(`  Original: こんにちは、世界！`);
    logger.info(`  Translated: ${result3.text}`);
    logger.info(`  From: ${result3.from}`);
    logger.info(`  To: ${result3.to}`);
    logger.info(`  Provider: ${result3.provider}`);
    logger.info('');

    logger.info('4. Getting provider status...');
    logger.info('-'.repeat(60));

    const status = await translator.getStatus();

    logger.info('Provider Status:');
    logger.info(`  Initialized: ${status.initialized}`);
    logger.info(`  Ready: ${status.ready}`);
    logger.info(`  Model: ${status.model}`);
    logger.info(`  Script Path: ${status.scriptPath}`);
    logger.info(`  Message: ${status.message}`);
    logger.info('');

    logger.info('5. Testing batch translation...');
    logger.info('-'.repeat(60));

    const batchOptions = [
      { text: 'Good morning', from: 'en', to: 'zh' },
      { text: 'Thank you', from: 'en', to: 'ja' },
      { text: 'Welcome', from: 'en', to: 'ko' }
    ];

    const batchResults = await translator.batchTranslate(batchOptions);

    logger.info('Batch Translation Results:');
    batchResults.forEach((result, index) => {
      if (result.success) {
        logger.info(`  [${index + 1}] ${batchOptions[index].text} -> ${result.text} (${result.from} -> ${result.to})`);
      } else {
        logger.error(`  [${index + 1}] Failed: ${result.error}`);
      }
    });
    logger.info('');

    logger.info('6. Getting model info...');
    logger.info('-'.repeat(60));

    const modelInfo = await translator.getModelInfo();

    logger.info('Model Information:');
    logger.info(`  Architecture: ${modelInfo.architecture}`);
    logger.info(`  Model Type: ${modelInfo.model_type}`);
    logger.info(`  Hidden Size: ${modelInfo.hidden_size}`);
    logger.info(`  Num Layers: ${modelInfo.num_layers}`);
    logger.info(`  Vocab Size: ${modelInfo.vocab_size}`);
    logger.info('');

    logger.info('='.repeat(60));
    logger.info('  All Tests Completed Successfully!');
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error(`Test failed: ${error.message}`);
    logger.error(error.stack);
  }
}

testNLLB200()
  .then(() => {
    logger.info('');
    logger.info('NLLB-200 example usage completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error('Example usage failed:', error);
    process.exit(1);
  });
