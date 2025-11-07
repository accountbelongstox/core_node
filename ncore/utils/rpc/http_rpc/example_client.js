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

const { HttpRpcClient } = require('#@ncore/utils/http_rpc');
const logger = require('#@logger');

async function testHttpRpcClient() {
    logger.info('=== Testing HTTP RPC Client ===');

    const client = new HttpRpcClient('http://localhost:3000', {
        basePath: '/rpc',
        timeout: 5000,
        retryCount: 2,
        retryDelay: 1000
    });

    try {
        logger.info('1. Health check');
        const health = await client.healthCheck();
        logger.info('Health:', health);

        logger.info('\n2. Single translation request');
        const result1 = await client.call('translateText', {
            text: 'Hello world',
            targetLang: 'zh'
        });
        logger.info('Translation result:', result1);

        logger.info('\n3. Get status');
        const status = await client.call('getStatus', {});
        logger.info('Status:', status);

        logger.info('\n4. Batch requests');
        const batchResults = await client.batch([
            { route: 'translateText', params: { text: 'Hello', targetLang: 'zh' } },
            { route: 'translateText', params: { text: 'Hello', targetLang: 'es' } },
            { route: 'translateText', params: { text: 'Hello', targetLang: 'fr' } }
        ]);
        logger.info('Batch results:', batchResults);

        logger.info('\n5. Batch with error handling');
        const settledResults = await client.batchSettled([
            { route: 'translateText', params: { text: 'Hello', targetLang: 'zh' } },
            { route: 'invalidRoute', params: {} },
            { route: 'translateText', params: { text: 'Hello', targetLang: 'fr' } }
        ]);
        logger.info('Settled results:', settledResults);

        logger.success('All tests completed');

    } catch (error) {
        logger.error('Test failed:', error.message);
    }
}

testHttpRpcClient().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
