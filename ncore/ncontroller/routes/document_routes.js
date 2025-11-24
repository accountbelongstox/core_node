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
