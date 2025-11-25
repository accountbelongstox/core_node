// IT Tools App - Centralized Exports
// Per NUXT_MULTI_APP_ARCHITECTURE.md - Single entry point for app imports

// Types
export * from './types_app_ittools';

// Store
export { useItToolsStore } from './stores_app_ittools/ittools-store';

// API Service (using common httpClient)
export { itToolsApi } from './services_app_ittools/ittools-api';
export { itToolsApiConfig, buildEndpoint, getEndpointUrl } from './config_app_ittools/api-config';

// Legacy API (for backward compatibility)
export { itToolsAPI, ItToolsMainAPI } from './services_app_ittools/ittools-main-api';

// Constants - All 88+ Tools
export {
  ALL_TOOLS,
  TOOLS_BY_CATEGORY,
  CRYPTO_TOOLS,
  CONVERTER_TOOLS,
  WEB_TOOLS,
  TEXT_TOOLS,
  MATH_TOOLS,
  NETWORK_TOOLS,
  MEDIA_TOOLS,
  DEVELOPMENT_TOOLS,
  MEASUREMENT_TOOLS,
  DATA_TOOLS,
  getToolById,
  getToolsByCategory,
  searchTools,
  getRandomTools,
  type ToolCategory
} from './constants_app_ittools/complete-tools';

// Logger
export { appLogger, type LogEntry, type LogLevel } from './services_app_ittools/logger';

// Composables
export { useApiClient, useGlobalApiClient } from './composables_app_ittools/useApiClient';
export { useItTools } from './composables_app_ittools/useItTools';

// Tool Registry
export { getToolComponent } from './components_app_ittools/tools/tool-registry';

// Tool Params Configuration
export { TOOL_PARAMS, type ToolParam } from './config_app_ittools/tool-params';

