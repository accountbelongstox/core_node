const { ALL_TOOLS } = require('./tools_definitions');

class UnifiedMCPBackendInterface {
    constructor() {
        this.tools = ALL_TOOLS;
        this.backendType = 'pycore';
    }

    async callBackend(toolName, params) {
        throw new Error('Backend implementation required: callBackend must be implemented by subclass');
    }

    async backendInfo() {
        throw new Error('Backend implementation required: backendInfo must be implemented by subclass');
    }

    async backendState() {
        throw new Error('Backend implementation required: backendState must be implemented by subclass');
    }

    async toolsList() {
        throw new Error('Backend implementation required: toolsList must be implemented by subclass');
    }

    async getFileInfo(params) {
        return this.callBackend('get_file_info', params);
    }

    async generatePlaceholderImage(params) {
        return this.callBackend('generate_placeholder_image', params);
    }

    async queryFileProcessingHistory(params) {
        return this.callBackend('query_file_processing_history', params);
    }

    async clearFileCache(params) {
        return this.callBackend('clear_file_cache', params);
    }

    async databaseNamespaceNegotiation(params) {
        return this.callBackend('database_namespace_negotiation', params);
    }

    async databaseRegisterAndConnect(params) {
        return this.callBackend('database_register_and_connect', params);
    }

    async databaseExecuteQuery(params) {
        return this.callBackend('database_execute_query', params);
    }

    async databaseBatchOperations(params) {
        return this.callBackend('database_batch_operations', params);
    }

    async databaseSchemaInspection(params) {
        return this.callBackend('database_schema_inspection', params);
    }

    async databaseGetStatistics(params) {
        return this.callBackend('database_get_statistics', params);
    }

    async databaseHealthCheck() {
        return this.callBackend('database_health_check', {});
    }

    async codebaseGetDirectoryTree(params) {
        return this.callBackend('codebase_get_directory_tree', params);
    }

    async codebaseFindFilesByPattern(params) {
        return this.callBackend('codebase_find_files_by_pattern', params);
    }

    async codebaseSearchContent(params) {
        return this.callBackend('codebase_search_content', params);
    }

    async codebaseGetFileContent(params) {
        return this.callBackend('codebase_get_file_content', params);
    }

    async codebaseAnalyzeStatistics(params) {
        return this.callBackend('codebase_analyze_statistics', params);
    }

    async codebaseDescribeDirectory(params) {
        return this.callBackend('codebase_describe_directory', params);
    }

    async codebaseScanFrameworkApps(params) {
        return this.callBackend('codebase_scan_framework_apps', params);
    }

    async codebaseHealthCheck() {
        return this.callBackend('codebase_health_check', {});
    }

    getToolDefinition(toolName) {
        return this.tools[toolName];
    }

    getAllToolNames() {
        return Object.keys(this.tools);
    }

    getToolsByCategory(category) {
        const { TOOL_CATEGORIES } = require('./tools_definitions');
        const toolNames = TOOL_CATEGORIES[category] || [];
        const tools = {};
        toolNames.forEach(name => {
            tools[name] = this.tools[name];
        });
        return tools;
    }

    validateParams(toolName, params) {
        const tool = this.getToolDefinition(toolName);
        if (!tool) {
            throw new Error(`Unknown tool: ${toolName}`);
        }

        const errors = [];
        const toolParams = tool.parameters || {};

        for (const [paramName, paramDef] of Object.entries(toolParams)) {
            if (paramDef.required && !(paramName in params)) {
                errors.push(`Missing required parameter: ${paramName}`);
            }

            if (paramName in params) {
                const paramValue = params[paramName];
                const expectedType = paramDef.type;

                if (expectedType === 'string' && typeof paramValue !== 'string') {
                    errors.push(`Parameter ${paramName} must be a string`);
                } else if (expectedType === 'number' && typeof paramValue !== 'number') {
                    errors.push(`Parameter ${paramName} must be a number`);
                } else if (expectedType === 'boolean' && typeof paramValue !== 'boolean') {
                    errors.push(`Parameter ${paramName} must be a boolean`);
                } else if (expectedType === 'array' && !Array.isArray(paramValue)) {
                    errors.push(`Parameter ${paramName} must be an array`);
                } else if (expectedType === 'object' && (typeof paramValue !== 'object' || Array.isArray(paramValue))) {
                    errors.push(`Parameter ${paramName} must be an object`);
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`Parameter validation failed: ${errors.join(', ')}`);
        }

        return true;
    }

    async callTool(toolName, params) {
        this.validateParams(toolName, params);

        const methodMap = {
            'backend_info': 'backendInfo',
            'backend_state': 'backendState',
            'tools_list': 'toolsList',
            'get_file_info': 'getFileInfo',
            'generate_placeholder_image': 'generatePlaceholderImage',
            'query_file_processing_history': 'queryFileProcessingHistory',
            'clear_file_cache': 'clearFileCache',
            'database_namespace_negotiation': 'databaseNamespaceNegotiation',
            'database_register_and_connect': 'databaseRegisterAndConnect',
            'database_execute_query': 'databaseExecuteQuery',
            'database_batch_operations': 'databaseBatchOperations',
            'database_schema_inspection': 'databaseSchemaInspection',
            'database_get_statistics': 'databaseGetStatistics',
            'database_health_check': 'databaseHealthCheck',
            'codebase_get_directory_tree': 'codebaseGetDirectoryTree',
            'codebase_find_files_by_pattern': 'codebaseFindFilesByPattern',
            'codebase_search_content': 'codebaseSearchContent',
            'codebase_get_file_content': 'codebaseGetFileContent',
            'codebase_analyze_statistics': 'codebaseAnalyzeStatistics',
            'codebase_describe_directory': 'codebaseDescribeDirectory',
            'codebase_scan_framework_apps': 'codebaseScanFrameworkApps',
            'codebase_health_check': 'codebaseHealthCheck'
        };

        const methodName = methodMap[toolName];
        if (!methodName || typeof this[methodName] !== 'function') {
            throw new Error(`Tool not implemented: ${toolName}`);
        }

        return await this[methodName](params);
    }
}

module.exports = { UnifiedMCPBackendInterface };
