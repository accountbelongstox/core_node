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

const deepseekChatRoutes = {
    /**
     * Check if user is logged in
     * params: {}
     */
    'deepseek/checkLogin': async (params) => {
        const deepseekController = ncoreController.getDeepSeekChatController();
        if (!deepseekController) {
            return { success: false, error: 'DeepSeekChatController not available' };
        }

        return deepseekController.checkLogin();
    },

    /**
     * Prompt user to login
     * params: {}
     */
    'deepseek/promptLogin': async (params) => {
        const deepseekController = ncoreController.getDeepSeekChatController();
        if (!deepseekController) {
            return { success: false, error: 'DeepSeekChatController not available' };
        }

        return deepseekController.promptLogin();
    },

    /**
     * Locate chat window
     * params: {}
     */
    'deepseek/locateChatWindow': async (params) => {
        const deepseekController = ncoreController.getDeepSeekChatController();
        if (!deepseekController) {
            return { success: false, error: 'DeepSeekChatController not available' };
        }

        return deepseekController.locateChatWindow();
    },

    /**
     * Send message to chat
     * params: {
     *   message: string (required)
     * }
     */
    'deepseek/sendMessage': async (params) => {
        if (!params || !params.message) {
            return { success: false, error: 'Message is required' };
        }

        const deepseekController = ncoreController.getDeepSeekChatController();
        if (!deepseekController) {
            return { success: false, error: 'DeepSeekChatController not available' };
        }

        return deepseekController.sendMessage(params.message);
    },

    /**
     * Get response from chat
     * params: {}
     */
    'deepseek/getResponse': async (params) => {
        const deepseekController = ncoreController.getDeepSeekChatController();
        if (!deepseekController) {
            return { success: false, error: 'DeepSeekChatController not available' };
        }

        return deepseekController.getResponse();
    },

    /**
     * Complete chat flow: send message and get response
     * params: {
     *   message: string (required),
     *   waitForResponse?: boolean (default: true),
     *   timeout?: number (default: 60000)
     * }
     */
    'deepseek/chat': async (params) => {
        if (!params || !params.message) {
            return { success: false, error: 'Message is required' };
        }

        const deepseekController = ncoreController.getDeepSeekChatController();
        if (!deepseekController) {
            return { success: false, error: 'DeepSeekChatController not available' };
        }

        return deepseekController.chat(params.message, params);
    },

    /**
     * Get controller status
     */
    'deepseek/status': async (params) => {
        const deepseekController = ncoreController.getDeepSeekChatController();
        if (!deepseekController) {
            return { success: false, error: 'DeepSeekChatController not available' };
        }

        return deepseekController.getStatus();
    },

    /**
     * Close current page
     */
    'deepseek/closePage': async (params) => {
        const deepseekController = ncoreController.getDeepSeekChatController();
        if (!deepseekController) {
            return { success: false, error: 'DeepSeekChatController not available' };
        }

        return deepseekController.closePage();
    },

    /**
     * Analyze DOM structure (for debugging)
     */
    'deepseek/analyzeDom': async (params) => {
        const deepseekController = ncoreController.getDeepSeekChatController();
        if (!deepseekController) {
            return { success: false, error: 'DeepSeekChatController not available' };
        }

        return deepseekController.analyzeDom();
    }
};

module.exports = deepseekChatRoutes;
