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

const aiTranslator = require('./index.js');
const logger = require('#@logger');
const path = require('path');

// Example usage of the AI Translator utility

async function exampleBasicUsage() {
    try {
        logger.info('=== Basic Translation Example ===');
        
        // Translate a simple text
        const text = 'Hello, this is a test document for translation.';
        const translatedText = await aiTranslator.translateText(text, 'zh');
        
        logger.info(`Original: ${text}`);
        logger.info(`Translated: ${translatedText}`);
        
    } catch (error) {
        logger.error(`Basic usage error: ${error.message}`);
    }
}

async function exampleBatchTranslation() {
    try {
        logger.info('=== Batch Translation Example ===');
        
        const texts = [
            'This is the first paragraph.',
            'This is the second paragraph.',
            'This is the third paragraph.'
        ];
        
        const translatedTexts = await aiTranslator.translateBatch(texts, 'zh');
        
        for (let i = 0; i < texts.length; i++) {
            logger.info(`Original ${i + 1}: ${texts[i]}`);
            logger.info(`Translated ${i + 1}: ${translatedTexts[i]}`);
        }
        
    } catch (error) {
        logger.error(`Batch translation error: ${error.message}`);
    }
}

async function exampleParagraphSplitting() {
    try {
        logger.info('=== Paragraph Splitting Example ===');
        
        const longText = `# This is a title

This is the first paragraph with some content. It contains multiple sentences. Each sentence provides information about the topic.

## This is a subtitle

This is the second paragraph. It also contains multiple sentences and information.

\`\`\`javascript
// This is a code block
function example() {
    return "hello world";
}
\`\`\`

This is the final paragraph after the code block.`;

        const paragraphs = aiTranslator.splitParagraphs(longText, {
            maxLength: 200,
            preserveCodeBlocks: true,
            preserveHeaders: true
        });
        
        logger.info(`Split into ${paragraphs.length} paragraphs:`);
        paragraphs.forEach((paragraph, index) => {
            logger.info(`Paragraph ${index + 1}: ${paragraph.substring(0, 50)}...`);
        });
        
    } catch (error) {
        logger.error(`Paragraph splitting error: ${error.message}`);
    }
}

async function exampleFileWatching() {
    try {
        logger.info('=== File Watching Example ===');
        
        // Define directories to watch
        const watchPaths = [
            path.join(process.cwd(), 'docs'),
            path.join(process.cwd(), 'content')
        ];
        
        // Start the translation service
        logger.info('Starting AI Translator service...');
        await aiTranslator.startTranslation(watchPaths, 'auto');
        
        // Check status
        const status = await aiTranslator.getStatus();
        logger.info('Translation service status:', status);
        
        // Let it run for a while (in real usage, this would be indefinite)
        logger.info('Service running... (will stop after 30 seconds for demo)');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Stop the service
        logger.info('Stopping AI Translator service...');
        await aiTranslator.stopTranslation();
        
        logger.info('Service stopped.');
        
    } catch (error) {
        logger.error(`File watching error: ${error.message}`);
    }
}

async function exampleAdvancedUsage() {
    try {
        logger.info('=== Advanced Usage Example ===');
        
        // Create a custom translator instance
        const customTranslator = new aiTranslator.AITranslatorMain();
        
        // Initialize with custom settings
        await customTranslator.initialize(['./custom_docs'], 'zh');
        
        // Get status
        const status = await customTranslator.getStatus();
        logger.info('Custom translator status:', status);
        
        // Clean up
        await customTranslator.stop();
        
    } catch (error) {
        logger.error(`Advanced usage error: ${error.message}`);
    }
}

async function exampleComponentUsage() {
    try {
        logger.info('=== Component Usage Example ===');
        
        // Use individual components
        const { CacheManager, TranslationManager } = aiTranslator;
        
        // Initialize cache manager
        const cacheManager = new CacheManager('./temp_cache');
        await cacheManager.initialize();
        
        // Get cache statistics
        const stats = await cacheManager.getCacheStats();
        logger.info('Cache statistics:', stats);
        
        // Initialize translation manager
        const translationManager = new TranslationManager('./temp_db', './temp_work');
        await translationManager.initialize();
        
        // Get manager statistics
        const managerStats = await translationManager.getManagerStats();
        logger.info('Manager statistics:', managerStats);
        
        // Clean up
        await cacheManager.close();
        
    } catch (error) {
        logger.error(`Component usage error: ${error.message}`);
    }
}

// Main execution function
async function runExamples() {
    logger.info('Starting AI Translator examples...');
    
    try {
        await exampleBasicUsage();
        await exampleBatchTranslation();
        await exampleParagraphSplitting();
        // await exampleFileWatching(); // Uncomment to test file watching
        await exampleAdvancedUsage();
        await exampleComponentUsage();
        
        logger.info('All examples completed successfully!');
        
    } catch (error) {
        logger.error(`Examples execution error: ${error.message}`);
    }
}

// Export for use in other modules
module.exports = {
    exampleBasicUsage,
    exampleBatchTranslation,
    exampleParagraphSplitting,
    exampleFileWatching,
    exampleAdvancedUsage,
    exampleComponentUsage,
    runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
    runExamples().catch(error => {
        logger.error(`Failed to run examples: ${error.message}`);
        process.exit(1);
    });
}