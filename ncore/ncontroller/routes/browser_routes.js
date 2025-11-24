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
 * Browser Routes - RPC handlers for browser operations
 */

const { ncoreController } = require('../controller');

const browserRoutes = {
    /**
     * Get browser status
     */
    'browser/status': async (params) => {
        return ncoreController.browserManager.getStatus();
    },

    /**
     * Launch browser
     */
    'browser/launch': async (params) => {
        const options = params || {};
        return ncoreController.browserManager.launch(options);
    },

    /**
     * Close browser
     */
    'browser/close': async (params) => {
        return ncoreController.browserManager.close();
    },

    /**
     * Restart browser
     */
    'browser/restart': async (params) => {
        return ncoreController.restartBrowser();
    },

    /**
     * Check browser health
     */
    'browser/health': async (params) => {
        const isHealthy = await ncoreController.browserManager.isHealthy();
        return { healthy: isHealthy };
    },

    /**
     * Get platform info
     */
    'browser/platform': async (params) => {
        return ncoreController.platformDetector.getInfo();
    },

    /**
     * Open URL in browser
     * params: {
     *   url: string,
     *   newTab?: boolean,
     *   waitUntil?: string,
     *   timeout?: number,
     *   screenshot?: boolean (default: true),
     *   screenshotOptions?: object,
     *   consoleLogs?: boolean (default: true),
     *   htmlContent?: boolean (default: false),
     *   resources?: boolean|array (default: false, or ['stylesheet', 'script', 'image', 'font'])
     * }
     * Returns: {
     *   success: boolean,
     *   pageId: string,
     *   url: string,
     *   title: string,
     *   screenshot: string (local path),
     *   consoleLogs: array,
     *   htmlContent?: string,
     *   downloadedResources?: object
     * }
     */
    'browser/openUrl': async (params) => {
        if (!params || !params.url) {
            return { success: false, error: 'URL is required' };
        }
        return ncoreController.browserManager.openUrl(params.url, params);
    },

    /**
     * Inject API request in page
     * params: {
     *   pageId: string,
     *   apiUrl: string,
     *   method?: string,
     *   headers?: object,
     *   body?: any,
     *   responseType?: 'json'|'text'|'binary'
     * }
     */
    'browser/injectAPIRequest': async (params) => {
        const { pageId, apiUrl, ...options } = params || {};
        if (!pageId || !apiUrl) {
            return { success: false, error: 'pageId and apiUrl are required' };
        }
        return ncoreController.browserManager.injectAPIRequest(pageId, apiUrl, options);
    },

    /**
     * Inject batch API requests in page (concurrent)
     * params: {
     *   pageId: string,
     *   apiUrls: string[],
     *   method?: string,
     *   headers?: object,
     *   responseType?: 'json'|'text'|'binary',
     *   concurrency?: number (default: 10)
     * }
     */
    'browser/injectBatchAPIRequests': async (params) => {
        const { pageId, apiUrls, ...options } = params || {};
        if (!pageId || !apiUrls || !Array.isArray(apiUrls)) {
            return { success: false, error: 'pageId and apiUrls (array) are required' };
        }
        return ncoreController.browserManager.injectBatchAPIRequests(pageId, apiUrls, options);
    },

    /**
     * Inject batch API requests and merge results
     * params: {
     *   pageId: string,
     *   apiUrls: string[],
     *   method?: string,
     *   headers?: object,
     *   responseType?: 'json'|'text'|'binary',
     *   concurrency?: number (default: 10)
     * }
     */
    'browser/injectBatchAPIRequestsAndMerge': async (params) => {
        const { pageId, apiUrls, ...options } = params || {};
        if (!pageId || !apiUrls || !Array.isArray(apiUrls)) {
            return { success: false, error: 'pageId and apiUrls (array) are required' };
        }
        return ncoreController.browserManager.injectBatchAPIRequestsAndMerge(pageId, apiUrls, options);
    },

    /**
     * Close tab by URL
     * params: { url: string }
     */
    'browser/closeTab': async (params) => {
        if (!params || !params.url) {
            return { success: false, error: 'URL is required' };
        }
        return ncoreController.browserManager.closeTabByUrl(params.url);
    },

    /**
     * Get all tabs
     */
    'browser/tabs': async (params) => {
        return ncoreController.browserManager.getAllTabs();
    },

    /**
     * Open URL in mobile mode
     * params: { url: string, device?: string, waitUntil?: string, timeout?: number }
     * device: 'iphone12', 'iphone14', 'pixel5', 'galaxys21', 'ipad'
     */
    'browser/openMobile': async (params) => {
        if (!params || !params.url) {
            return { success: false, error: 'URL is required' };
        }
        return ncoreController.browserManager.openMobilePage(params.url, params);
    },

    /**
     * Switch current page to mobile mode
     * params: { device?: string, pageIndex?: number, reload?: boolean }
     * device: 'iphone12', 'iphone14', 'pixel5', 'galaxys21', 'ipad'
     */
    'browser/switchToMobile': async (params) => {
        return ncoreController.browserManager.switchToMobile(params || {});
    },

    /**
     * Switch current page to desktop mode
     * params: { pageIndex?: number, reload?: boolean }
     */
    'browser/switchToDesktop': async (params) => {
        return ncoreController.browserManager.switchToDesktop(params || {});
    },

    /**
     * Get intercepted API URLs for a page
     * params: { pageId: string, clearAfterGet?: boolean }
     */
    'browser/getInterceptedApiUrls': async (params) => {
        const { pageId, clearAfterGet, requestId } = params || {};
        if (!pageId) {
            return { success: false, error: 'pageId is required' };
        }

        const logger = require('#@logger');
        const reqTag = requestId ? `[REQ-${requestId}]` : '';
        logger.info(`[RPC] ${reqTag} getInterceptedApiUrls called with pageId="${pageId}", clearAfterGet=${clearAfterGet}`);

        const urls = ncoreController.browserManager.pageCollector.getInterceptedApiUrls(pageId, clearAfterGet);

        logger.info(`[RPC] ${reqTag} Found ${urls.length} intercepted URLs for pageId="${pageId}"`);

        if (urls.length > 0) {
            logger.info(`[RPC] ${reqTag} Sample URL: ${urls[0].url ? urls[0].url.substring(0, 120) : 'N/A'}`);
        } else {
            logger.warn(`[RPC] ${reqTag} ⚠️ No URLs found in backend storage!`);
        }

        const response = {
            success: true,
            pageId: pageId,
            urls: urls,
            count: urls.length,
            requestId: requestId
        };

        logger.info(`[RPC] ${reqTag} Returning response with ${response.urls.length} URLs, count=${response.count}`);

        return response;
    }
};

module.exports = browserRoutes;
