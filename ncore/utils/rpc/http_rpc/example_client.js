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
