// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const { Fetcher } = require('./main');
const logger = require('#@logger');
const fs = require('fs');
const path = require('path');

async function exampleResourceCollection() {
    const fetcher = new Fetcher();

    try {
        await fetcher.initialize('edge', { headless: false });

        logger.info('Fetcher initialized with resource collection enabled by default');

        const url = 'https://www.example.com';
        logger.info(`Navigating to: ${url}`);

        await fetcher.fetch(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        logger.info('Page loaded, collecting resources...');

        const collectionResult = await fetcher.collectResources({
            waitForNetwork: true,
            waitTime: 2000,
            includeIframes: true,
            includeDataUrls: false
        });

        if (collectionResult) {
            logger.success(`Resource collection complete!`);
            logger.info(`Total resources: ${collectionResult.stats.total}`);
            logger.info(`Matched with interception: ${collectionResult.stats.matched}`);
            logger.info(`Unmatched: ${collectionResult.stats.unmatched}`);

            logger.info('Resources by source type:');
            for (const [type, count] of Object.entries(collectionResult.stats.bySourceType)) {
                logger.info(`  ${type}: ${count}`);
            }

            logger.info('Resources by tag name:');
            for (const [tag, count] of Object.entries(collectionResult.stats.byTagName)) {
                logger.info(`  ${tag}: ${count}`);
            }

            const outputFile = path.join(__dirname, 'resource_collection_result.json');
            const collector = fetcher.getResourceCollector();
            if (collector) {
                const jsonOutput = collector.exportToJson(false);
                fs.writeFileSync(outputFile, JSON.stringify(jsonOutput, null, 2), 'utf8');
                logger.success(`Results exported to: ${outputFile}`);
            }

            logger.info('\nExample matched resources:');
            const matchedResources = collectionResult.resources.filter(r => r.matched).slice(0, 5);
            for (const resource of matchedResources) {
                logger.info(`  [${resource.tagName}] ${resource.url}`);
                logger.info(`    XPath: ${resource.xpath}`);
                logger.info(`    Source: ${resource.sourceType}`);
                if (resource.intercepted) {
                    logger.info(`    Status: ${resource.intercepted.status}`);
                    logger.info(`    Type: ${resource.intercepted.contentType}`);
                    logger.info(`    Size: ${resource.intercepted.actualSize || resource.intercepted.contentLength} bytes`);
                }
            }

            logger.info('\nExample unmatched resources (DOM only, not intercepted):');
            const unmatchedResources = collectionResult.resources.filter(r => !r.matched).slice(0, 3);
            for (const resource of unmatchedResources) {
                logger.info(`  [${resource.tagName}] ${resource.url}`);
                logger.info(`    XPath: ${resource.xpath}`);
                logger.info(`    Source: ${resource.sourceType}`);
            }
        }

    } catch (error) {
        logger.error('Error during resource collection:', error);
    } finally {
        await fetcher.close();
        logger.info('Fetcher closed');
    }
}

async function exampleDirectAccess() {
    const fetcher = new Fetcher();

    try {
        await fetcher.initialize();

        await fetcher.fetch('https://www.example.com');

        const collector = fetcher.getResourceCollector();

        if (collector) {
            const imageResources = collector.getResourcesByType('src');
            logger.info(`Found ${imageResources.length} image resources with src attribute`);

            const cssBackgroundImages = collector.getResourcesByType('css-background-image');
            logger.info(`Found ${cssBackgroundImages.length} CSS background images`);

            const imgTags = collector.getResourcesByTag('img');
            logger.info(`Found ${imgTags.length} <img> tags`);

            const mainFrameResources = collector.getResourcesByFrame('/');
            logger.info(`Found ${mainFrameResources.length} resources in main frame`);

            const specificResource = collector.findResourceByXpath('/html[1]/body[1]/div[1]/img[1]');
            if (specificResource) {
                logger.info(`Found resource at specific XPath: ${specificResource.url}`);
            }
        }

    } catch (error) {
        logger.error('Error:', error);
    } finally {
        await fetcher.close();
    }
}

if (require.main === module) {
    logger.info('Example 1: Basic Resource Collection');
    exampleResourceCollection().then(() => {
        logger.info('\n\nExample 2: Direct Collector Access');
        return exampleDirectAccess();
    }).then(() => {
        logger.success('All examples completed successfully');
        process.exit(0);
    }).catch(error => {
        logger.error('Example failed:', error);
        process.exit(1);
    });
}

module.exports = {
    exampleResourceCollection,
    exampleDirectAccess
};
