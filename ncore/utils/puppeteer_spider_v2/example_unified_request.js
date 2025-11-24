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

'use strict';

const { createSession, UnifiedRequestUtils } = require('./main');
const logger = require('#@logger');

async function example1_BasicJsonRequest() {
    logger.info('=== Example 1: Basic JSON Request ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    await page.goto('https://jsonplaceholder.typicode.com');

    const requestUtils = new UnifiedRequestUtils(page, {
        timeout: 30000,
        fallbackEnabled: true,
        preferredMethod: 'auto'
    });

    try {
        const result = await requestUtils.fetch('https://jsonplaceholder.typicode.com/posts/1', {
            responseType: 'json'
        });

        logger.success(`Fetch succeeded via method: ${result.method}`);
        logger.info(`Status: ${result.status}`);
        logger.info(`Content-Type: ${result.contentType}`);
        logger.info(`Data type: ${result.dataType}`);
        logger.info(`Data:`, JSON.stringify(result.data, null, 2));
    } catch (error) {
        logger.error('Fetch failed:', error.message);
    } finally {
        await requestUtils.cleanup();
        await page.close();
        await session.close();
    }
}

async function example2_BinaryResource() {
    logger.info('=== Example 2: Binary Resource (Image) ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    await page.goto('https://httpbin.org');

    const requestUtils = new UnifiedRequestUtils(page, {
        timeout: 30000,
        fallbackEnabled: true
    });

    try {
        const result = await requestUtils.fetch('https://httpbin.org/image/png', {
            responseType: 'binary'
        });

        logger.success(`Fetch succeeded via method: ${result.method}`);
        logger.info(`Status: ${result.status}`);
        logger.info(`Content-Type: ${result.contentType}`);
        logger.info(`Is binary: ${result.isBinary}`);
        logger.info(`Binary data length: ${result.binary ? result.binary.length : 0} bytes`);

        if (result.binary && result.binary.length > 0) {
            const fs = require('fs');
            const outputPath = './downloaded_image.png';
            const buffer = Buffer.from(result.binary);
            fs.writeFileSync(outputPath, buffer);
            logger.success(`Binary data saved to: ${outputPath}`);
        }
    } catch (error) {
        logger.error('Fetch failed:', error.message);
    } finally {
        await requestUtils.cleanup();
        await page.close();
        await session.close();
    }
}

async function example3_UseSpecificMethod() {
    logger.info('=== Example 3: Use Specific Method ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    await page.goto('https://api.github.com');

    const requestUtils = new UnifiedRequestUtils(page);

    try {
        logger.info('--- Method 1: Inject Only ---');
        const result1 = await requestUtils.fetchViaInject('https://api.github.com/users/github');
        logger.success(`Status: ${result1.status}, Data:`, result1.data);
    } catch (error) {
        logger.error('Method 1 failed:', error.message);
    }

    await requestUtils.cleanup();
    await page.close();
    await session.close();
}

async function example4_FallbackMechanism() {
    logger.info('=== Example 4: Fallback Mechanism ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    await page.goto('https://example.com');

    const requestUtils = new UnifiedRequestUtils(page, {
        preferredMethod: 'inject',
        fallbackEnabled: true,
        timeout: 10000
    });

    try {
        const result = await requestUtils.fetch('https://httpbin.org/get');

        logger.success(`Fetch succeeded via method: ${result.method}`);
        logger.info(`Final result:`, result);
    } catch (error) {
        logger.error('All methods failed:', error.message);
    } finally {
        await requestUtils.cleanup();
        await page.close();
        await session.close();
    }
}

async function example5_PostRequest() {
    logger.info('=== Example 5: POST Request ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    await page.goto('https://httpbin.org');

    const requestUtils = new UnifiedRequestUtils(page);

    try {
        const result = await requestUtils.fetchViaInject('https://httpbin.org/post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                name: 'test',
                value: 123
            },
            responseType: 'json'
        });

        logger.success(`POST succeeded via method: ${result.method}`);
        logger.info(`Response:`, result.data);
    } catch (error) {
        logger.error('POST failed:', error.message);
    } finally {
        await requestUtils.cleanup();
        await page.close();
        await session.close();
    }
}

async function example6_MultipleRequests() {
    logger.info('=== Example 6: Multiple Requests on Same Page ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    await page.goto('https://jsonplaceholder.typicode.com');

    const requestUtils = new UnifiedRequestUtils(page);

    const urls = [
        'https://jsonplaceholder.typicode.com/posts/1',
        'https://jsonplaceholder.typicode.com/posts/2',
        'https://jsonplaceholder.typicode.com/posts/3'
    ];

    try {
        for (const url of urls) {
            const result = await requestUtils.fetch(url);
            logger.success(`Fetched ${url} via ${result.method}`);
            logger.info(`Title: ${result.data.title}`);
        }

        const stats = requestUtils.getStats();
        logger.info('Request stats:', stats);
    } catch (error) {
        logger.error('Request failed:', error.message);
    } finally {
        await requestUtils.cleanup();
        await page.close();
        await session.close();
    }
}

async function example7_DownloadInCurrentPage() {
    logger.info('=== Example 7: Download in Current Page ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    await page.goto('https://httpbin.org');

    const requestUtils = new UnifiedRequestUtils(page);

    try {
        const result = await requestUtils.downloadInCurrentPage('https://httpbin.org/image/png', {
            responseType: 'binary'
        });

        logger.success(`Download succeeded via method: ${result.method}`);
        logger.info(`Binary data length: ${result.binary ? result.binary.length : 0} bytes`);

        if (result.binary) {
            const fs = require('fs');
            fs.writeFileSync('./download_current.png', Buffer.from(result.binary));
            logger.success('File saved to: ./download_current.png');
        }
    } catch (error) {
        logger.error('Download failed:', error.message);
    } finally {
        await requestUtils.cleanup();
        await page.close();
        await session.close();
    }
}

async function example8_DownloadWithSameOriginNav() {
    logger.info('=== Example 8: Download with Same Origin Navigation ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    await page.goto('https://example.com');

    const requestUtils = new UnifiedRequestUtils(page);

    try {
        const result = await requestUtils.downloadWithSameOriginNav(
            'https://httpbin.org/image/jpeg',
            'https://httpbin.org/html',
            {
                responseType: 'binary',
                waitAfterNav: 3000
            }
        );

        logger.success(`Navigation action: ${result.navigationAction}`);
        logger.success(`Download via method: ${result.method}`);
        logger.info(`Match mode: ${result.matchMode}`);
        logger.info(`Binary data length: ${result.binary ? result.binary.length : 0} bytes`);

        if (result.binary) {
            const fs = require('fs');
            fs.writeFileSync('./download_sameorigin.jpg', Buffer.from(result.binary));
            logger.success('File saved to: ./download_sameorigin.jpg');
        }
    } catch (error) {
        logger.error('Download failed:', error.message);
    } finally {
        await requestUtils.cleanup();
        await page.close();
        await session.close();
    }
}

async function example9_DownloadWithFullUrlNav() {
    logger.info('=== Example 9: Download with Full URL Navigation ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    await page.goto('https://httpbin.org');

    const requestUtils = new UnifiedRequestUtils(page);

    try {
        const result = await requestUtils.downloadWithFullUrlNav(
            'https://httpbin.org/get',
            'https://httpbin.org/html',
            {
                responseType: 'json',
                waitAfterNav: 2000
            }
        );

        logger.success(`Navigation action: ${result.navigationAction}`);
        logger.success(`Download via method: ${result.method}`);
        logger.info(`Match mode: ${result.matchMode}`);
        logger.info(`Data:`, result.data);
    } catch (error) {
        logger.error('Download failed:', error.message);
    } finally {
        await requestUtils.cleanup();
        await page.close();
        await session.close();
    }
}

async function example10_TabReuseDemo() {
    logger.info('=== Example 10: Tab Reuse Demonstration ===');

    const session = await createSession({
        browser: 'edge',
        browserOptions: {
            headless: false
        }
    });

    const page = await session.newPage();
    const requestUtils = new UnifiedRequestUtils(page);

    try {
        logger.info('First download - will open new tab for httpbin.org');
        const result1 = await requestUtils.downloadWithSameOriginNav(
            'https://httpbin.org/json',
            'https://httpbin.org/html',
            { responseType: 'json' }
        );
        logger.success(`First download - Navigation: ${result1.navigationAction}`);

        await requestUtils.baseUtils.wait(2000);

        logger.info('Second download - should reuse httpbin.org tab (same origin)');
        const result2 = await requestUtils.downloadWithSameOriginNav(
            'https://httpbin.org/uuid',
            'https://httpbin.org/get',
            { responseType: 'json' }
        );
        logger.success(`Second download - Navigation: ${result2.navigationAction} (should be "switched")`);

        await requestUtils.baseUtils.wait(2000);

        logger.info('Third download - exact URL match');
        const result3 = await requestUtils.downloadWithFullUrlNav(
            'https://httpbin.org/anything',
            'https://httpbin.org/html',
            { responseType: 'json' }
        );
        logger.success(`Third download - Navigation: ${result3.navigationAction}`);

    } catch (error) {
        logger.error('Demo failed:', error.message);
    } finally {
        await requestUtils.cleanup();
        await page.close();
        await session.close();
    }
}

async function runAllExamples() {
    try {
        await example1_BasicJsonRequest();
        await example2_BinaryResource();
        await example3_UseSpecificMethod();
        await example4_FallbackMechanism();
        await example5_PostRequest();
        await example6_MultipleRequests();
        await example7_DownloadInCurrentPage();
        await example8_DownloadWithSameOriginNav();
        await example9_DownloadWithFullUrlNav();
        await example10_TabReuseDemo();

        logger.success('All examples completed successfully!');
    } catch (error) {
        logger.error('Example execution failed:', error);
    }
}

if (require.main === module) {
    logger.info('Choose an example to run:');
    logger.info('1. Basic JSON Request');
    logger.info('2. Binary Resource (Image)');
    logger.info('3. Use Specific Method');
    logger.info('4. Fallback Mechanism');
    logger.info('5. POST Request');
    logger.info('6. Multiple Requests');
    logger.info('7. Download in Current Page');
    logger.info('8. Download with Same Origin Navigation');
    logger.info('9. Download with Full URL Navigation');
    logger.info('10. Tab Reuse Demonstration');
    logger.info('all. Run all examples');
    logger.info('');
    logger.info('Usage: node example_unified_request.js [1-10|all]');

    const arg = process.argv[2];

    switch (arg) {
        case '1':
            example1_BasicJsonRequest();
            break;
        case '2':
            example2_BinaryResource();
            break;
        case '3':
            example3_UseSpecificMethod();
            break;
        case '4':
            example4_FallbackMechanism();
            break;
        case '5':
            example5_PostRequest();
            break;
        case '6':
            example6_MultipleRequests();
            break;
        case '7':
            example7_DownloadInCurrentPage();
            break;
        case '8':
            example8_DownloadWithSameOriginNav();
            break;
        case '9':
            example9_DownloadWithFullUrlNav();
            break;
        case '10':
            example10_TabReuseDemo();
            break;
        case 'all':
            runAllExamples();
            break;
        default:
            example1_BasicJsonRequest();
    }
}

module.exports = {
    example1_BasicJsonRequest,
    example2_BinaryResource,
    example3_UseSpecificMethod,
    example4_FallbackMechanism,
    example5_PostRequest,
    example6_MultipleRequests,
    example7_DownloadInCurrentPage,
    example8_DownloadWithSameOriginNav,
    example9_DownloadWithFullUrlNav,
    example10_TabReuseDemo,
    runAllExamples
};
