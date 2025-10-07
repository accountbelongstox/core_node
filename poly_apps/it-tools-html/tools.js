// Tools Data - Generated from CONFIG
// This file converts the centralized CONFIG.TOOLS object into the array format needed by the UI

function getToolsData() {
    // Convert CONFIG.TOOLS object to array format
    const toolsArray = Object.keys(CONFIG.TOOLS).map(toolId => {
        const tool = CONFIG.TOOLS[toolId];

        // Convert endpoint key reference to actual endpoint path
        let endpointPath = null;
        if (tool.endpoint) {
            const keys = tool.endpoint.split('.');
            let endpoint = CONFIG.ENDPOINTS;
            for (const key of keys) {
                endpoint = endpoint[key];
                if (!endpoint) break;
            }
            endpointPath = endpoint;
        }

        return {
            id: toolId,
            name: tool.name,
            description: tool.description,
            category: tool.category,
            icon: tool.icon,
            endpoint: endpointPath,
            keywords: tool.keywords || []
        };
    });

    return toolsArray;
}

// Additional helper to get tool configuration with parameters
function getToolConfig(toolId) {
    return CONFIG.getTool(toolId);
}

// Helper to get tool endpoint URL
function getToolEndpointUrl(toolId) {
    return CONFIG.getToolEndpoint(toolId);
}

// Helper to get tool parameters
function getToolParams(toolId) {
    return CONFIG.getToolParams(toolId);
}
