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

/**
 * Page Routes - RPC handlers for page operations
 */

const { ncoreController } = require('../controller');

const pageRoutes = {
    /**
     * Create new page
     */
    'page/create': async (params) => {
        const { pageId, options } = params || {};
        return ncoreController.createPage(pageId, options);
    },

    /**
     * List all pages
     */
    'page/list': async (params) => {
        return {
            pages: ncoreController.listPages()
        };
    },

    /**
     * Navigate to URL
     */
    'page/navigate': async (params) => {
        const { pageId, url, options } = params || {};
        if (!pageId || !url) {
            return { error: 'pageId and url are required' };
        }
        return ncoreController.navigateTo(pageId, url, options);
    },

    /**
     * Get page content
     */
    'page/content': async (params) => {
        const { pageId } = params || {};
        if (!pageId) {
            return { error: 'pageId is required' };
        }
        const content = await ncoreController.getPageContent(pageId);
        return { content };
    },

    /**
     * Take screenshot
     */
    'page/screenshot': async (params) => {
        const { pageId, options } = params || {};
        if (!pageId) {
            return { error: 'pageId is required' };
        }
        const screenshot = await ncoreController.takeScreenshot(pageId, options);
        return {
            data: screenshot ? screenshot.toString('base64') : null,
            encoding: 'base64'
        };
    },

    /**
     * Close page
     */
    'page/close': async (params) => {
        const { pageId } = params || {};
        if (!pageId) {
            return { error: 'pageId is required' };
        }
        const success = await ncoreController.closePage(pageId);
        return { success };
    },

    /**
     * Evaluate JavaScript on page
     * params: {
     *   pageId: string,
     *   script: string | function,
     *   args?: array
     * }
     */
    'page/evaluate': async (params) => {
        const { pageId, script, args } = params || {};
        if (!pageId) {
            return { success: false, error: 'pageId is required' };
        }
        if (!script) {
            return { success: false, error: 'script is required' };
        }

        try {
            const page = ncoreController.getPage(pageId);
            if (!page) {
                return { success: false, error: 'Page not found' };
            }

            const result = await page.evaluate(script, ...(args || []));
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

module.exports = pageRoutes;
