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
