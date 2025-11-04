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

const { Fetcher } = require('./main');
const logger = require('#@logger');
const fs = require('fs');
const path = require('path');

async function exampleIframeRecursiveCrawl() {
    const fetcher = new Fetcher();
    let pagesProcessed = 0;

    try {
        await fetcher.initialize('edge', { headless: false });

        logger.info('Fetcher initialized for recursive iframe crawling');

        const url = 'https://www.example.com';
        logger.info(`Navigating to: ${url}`);

        const result = await fetcher.fetchIframeContentRecursive(url, {
            maxDepth: 3,
            delay: 1000,
            maxLinksPerPage: 10,
            sameOriginOnly: true,
            skipHashLinks: true,
            onPageCallback: async (pageResult, totalProcessed, depth) => {
                pagesProcessed++;
                logger.success(`[PAGE-${totalProcessed}] Depth ${depth}: ${pageResult.url}`);
                logger.info(`  Content length: ${pageResult.contentLength} bytes`);
                logger.info(`  Link text: "${pageResult.linkText}"`);
            },
            onFailedCallback: async (failedResult) => {
                logger.error(`[FAILED] Depth ${failedResult.depth}: ${failedResult.targetUrl}`);
                logger.error(`  Error: ${failedResult.error}`);
                logger.error(`  Link text: "${failedResult.linkText}"`);
            }
        });

        logger.success(`Recursive crawl completed!`);
        logger.info(`Total iframes processed: ${result.totalIframes}`);

        for (let i = 0; i < result.iframes.length; i++) {
            const iframe = result.iframes[i];
            if (iframe.success === false) {
                logger.error(`Iframe ${i} failed: ${iframe.error}`);
                continue;
            }

            const crawlResult = iframe.crawlResult;
            const stats = iframe.statistics;

            logger.info(`\nIframe ${i} Results:`);
            logger.info(`  Total pages crawled: ${crawlResult.totalProcessed}`);
            logger.info(`  Max depth reached: ${crawlResult.maxDepthReached}`);
            logger.info(`  Successful pages: ${crawlResult.globalProcessedUrls.length}`);
            logger.info(`  Failed URLs: ${crawlResult.failedUrls.length}`);
            logger.info(`  Average links per page: ${stats.averageLinksPerPage.toFixed(2)}`);

            const outputFile = path.join(__dirname, `iframe_${i}_recursive_result.json`);
            fs.writeFileSync(outputFile, JSON.stringify({
                iframeIndex: iframe.iframeIndex,
                iframeInfo: iframe.iframeInfo,
                crawlResult: crawlResult,
                statistics: stats
            }, null, 2), 'utf8');
            logger.success(`Results exported to: ${outputFile}`);

            logger.info('\nPage Link Map:');
            const pageLinkMap = crawlResult.pageLinkMap;
            for (const [pageUrl, links] of Object.entries(pageLinkMap)) {
                logger.info(`  ${pageUrl}: ${links.length} links`);
            }

            logger.info('\nProcessed URLs:');
            crawlResult.globalProcessedUrls.slice(0, 10).forEach((url, idx) => {
                logger.info(`  ${idx + 1}. ${url}`);
            });

            if (crawlResult.failedUrls.length > 0) {
                logger.info('\nFailed URLs:');
                crawlResult.failedUrls.forEach((url, idx) => {
                    logger.error(`  ${idx + 1}. ${url}`);
                });
            }
        }

    } catch (error) {
        logger.error('Error during recursive iframe crawling:', error);
    } finally {
        await fetcher.close();
        logger.info('Fetcher closed');
    }
}

if (require.main === module) {
    logger.info('Starting Iframe Recursive Crawl Example');
    exampleIframeRecursiveCrawl().then(() => {
        logger.success('Example completed successfully');
        process.exit(0);
    }).catch(error => {
        logger.error('Example failed:', error);
        process.exit(1);
    });
}

module.exports = {
    exampleIframeRecursiveCrawl
};
