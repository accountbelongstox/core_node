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

const { createSession, shutdown } = require('./main');

async function example() {
    try {
        console.log('Creating spider session...');
        
        // Create a new session with desktop preset
        const session = await createSession({
            preset: 'desktop',
            browser: 'edge',
            headless: false
        });
        
        console.log('Session created:', session.id);
        
        // Create a new page
        const page = await session.newPage();
        console.log('Page created');
        
        // Navigate to a website
        await page.goto('https://example.com');
        console.log('Navigated to example.com');
        
        // Get page title
        const title = await page.getTitle();
        console.log('Page title:', title);
        
        // Get page content
        const content = await page.getContent();
        console.log('Page content length:', content.length);
        
        // Use plugins
        const contentPlugin = session.getPlugin('content');
        if (contentPlugin) {
            const extractedContent = await contentPlugin.extractAll(page);
            console.log('Extracted content:', {
                images: extractedContent.images.length,
                links: extractedContent.links.length,
                forms: extractedContent.forms.length
            });
        }
        
        // Download plugin example
        const downloadPlugin = session.getPlugin('download');
        if (downloadPlugin) {
            try {
                const downloadResult = await downloadPlugin.downloadFile('https://example.com/favicon.ico');
                console.log('Download completed:', downloadResult);
            } catch (error) {
                console.log('Download failed:', error.message);
            }
        }
        
        // Automation plugin example
        const automationPlugin = session.getPlugin('automation');
        if (automationPlugin) {
            try {
                await automationPlugin.delay(2000);
                console.log('Delayed for 2 seconds');
            } catch (error) {
                console.log('Automation failed:', error.message);
            }
        }
        
        // Close the session
        await session.close();
        console.log('Session closed');
        
    } catch (error) {
        console.error('Example failed:', error);
    } finally {
        // Shutdown the default engine
        await shutdown();
        console.log('Engine shutdown');
    }
}

// Run the example
if (require.main === module) {
    example();
}

module.exports = example;
