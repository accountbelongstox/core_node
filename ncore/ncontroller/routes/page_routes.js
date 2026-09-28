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
