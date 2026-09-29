const { ncoreController } = require('../controller');

const documentRoutes = {
    /**
     * Download documentation (clean content, no CSS/JS/resources)
     * params: {
     *   url: string (required),
     *   maxDepth?: number (default: 3),
     *   scopePath?: boolean (default: true)
     * }
     */
    'document/downloadDocs': async (params) => {
        if (!params || !params.url) {
            return { success: false, error: 'URL is required' };
        }

        const documentController = ncoreController.getDocumentController();
        if (!documentController) {
            return { success: false, error: 'DocumentController not available' };
        }

        return documentController.downloadDocumentation(params.url, params);
    },

    /**
     * Download entire site (with CSS/JS/resources)
     * params: {
     *   url: string (required),
     *   maxDepth?: number (default: 3),
     *   scopePath?: boolean (default: true),
     *   downloadResources?: boolean (default: true)
     * }
     */
    'document/downloadSite': async (params) => {
        if (!params || !params.url) {
            return { success: false, error: 'URL is required' };
        }

        const documentController = ncoreController.getDocumentController();
        if (!documentController) {
            return { success: false, error: 'DocumentController not available' };
        }

        return documentController.downloadSite(params.url, params);
    },

    /**
     * Get document controller status
     */
    'document/status': async (params) => {
        const documentController = ncoreController.getDocumentController();
        if (!documentController) {
            return { success: false, error: 'DocumentController not available' };
        }

        return documentController.getStatus();
    }
};

module.exports = documentRoutes;
