/**
 * Chrome Extension i18n utility
 * Provides safe access to chrome.i18n.getMessage with fallbacks
 */

// Fallback messages for when Chrome APIs aren't available (English)
const fallbackMessages: Record<string, string> = {
  // Extension metadata
  extensionName: 'chrome-mcp-server',
  extensionDescription: 'Exposes browser capabilities with your own chrome',

  // Section headers
  nativeServerConfigLabel: 'Native Server Configuration',
  semanticEngineLabel: 'Semantic Engine',
  embeddingModelLabel: 'Embedding Model',
  indexDataManagementLabel: 'Index Data Management',
  modelCacheManagementLabel: 'Model Cache Management',

  // Status labels
  statusLabel: 'Status',
  runningStatusLabel: 'Running Status',
  connectionStatusLabel: 'Connection Status',
  lastUpdatedLabel: 'Last Updated:',

  // Connection states
  connectButton: 'Connect',
  disconnectButton: 'Disconnect',
  connectingStatus: 'Connecting...',
  connectedStatus: 'Connected',
  disconnectedStatus: 'Disconnected',
  detectingStatus: 'Detecting...',

  // Server states
  serviceRunningStatus: 'Service Running (Port: {0})',
  serviceNotConnectedStatus: 'Service Not Connected',
  connectedServiceNotStartedStatus: 'Connected, Service Not Started',

  // Configuration labels
  mcpServerConfigLabel: 'MCP Server Configuration',
  connectionPortLabel: 'Connection Port',
  refreshStatusButton: 'Refresh Status',
  copyConfigButton: 'Copy Configuration',

  // Action buttons
  retryButton: 'Retry',
  cancelButton: 'Cancel',
  confirmButton: 'Confirm',
  saveButton: 'Save',
  closeButton: 'Close',
  resetButton: 'Reset',

  // Progress states
  initializingStatus: 'Initializing...',
  processingStatus: 'Processing...',
  loadingStatus: 'Loading...',
  clearingStatus: 'Clearing...',
  cleaningStatus: 'Cleaning...',
  downloadingStatus: 'Downloading...',

  // Semantic engine states
  semanticEngineReadyStatus: 'Semantic Engine Ready',
  semanticEngineInitializingStatus: 'Semantic Engine Initializing...',
  semanticEngineInitFailedStatus: 'Semantic Engine Initialization Failed',
  semanticEngineNotInitStatus: 'Semantic Engine Not Initialized',
  initSemanticEngineButton: 'Initialize Semantic Engine',
  reinitializeButton: 'Reinitialize',

  // Model states
  downloadingModelStatus: 'Downloading Model... {0}%',
  switchingModelStatus: 'Switching Model...',
  modelLoadedStatus: 'Model Loaded',
  modelFailedStatus: 'Model Failed to Load',

  // Model descriptions
  lightweightModelDescription: 'Lightweight Multilingual Model',
  betterThanSmallDescription: 'Slightly larger than e5-small, but better performance',
  multilingualModelDescription: 'Multilingual Semantic Model',

  // Performance levels
  fastPerformance: 'Fast',
  balancedPerformance: 'Balanced',
  accuratePerformance: 'Accurate',

  // Error messages
  networkErrorMessage: 'Network connection error, please check network and retry',
  modelCorruptedErrorMessage: 'Model file corrupted or incomplete, please retry download',
  unknownErrorMessage: 'Unknown error, please check if your network can access HuggingFace',
  permissionDeniedErrorMessage: 'Permission denied',
  timeoutErrorMessage: 'Operation timed out',

  // Data statistics
  indexedPagesLabel: 'Indexed Pages',
  indexSizeLabel: 'Index Size',
  activeTabsLabel: 'Active Tabs',
  vectorDocumentsLabel: 'Vector Documents',
  cacheSizeLabel: 'Cache Size',
  cacheEntriesLabel: 'Cache Entries',

  // Data management
  clearAllDataButton: 'Clear All Data',
  clearAllCacheButton: 'Clear All Cache',
  cleanExpiredCacheButton: 'Clean Expired Cache',
  exportDataButton: 'Export Data',
  importDataButton: 'Import Data',

  // Dialog titles
  confirmClearDataTitle: 'Confirm Clear Data',
  settingsTitle: 'Settings',
  aboutTitle: 'About',
  helpTitle: 'Help',

  // Dialog messages
  clearDataWarningMessage:
    'This operation will clear all indexed webpage content and vector data, including:',
  clearDataList1: 'All webpage text content index',
  clearDataList2: 'Vector embedding data',
  clearDataList3: 'Search history and cache',
  clearDataIrreversibleWarning:
    'This operation is irreversible! After clearing, you need to browse webpages again to rebuild the index.',
  confirmClearButton: 'Confirm Clear',

  // Cache states
  cacheDetailsLabel: 'Cache Details',
  noCacheDataMessage: 'No cache data',
  loadingCacheInfoStatus: 'Loading cache information...',
  processingCacheStatus: 'Processing cache...',
  expiredLabel: 'Expired',

  // Browser integration
  bookmarksBarLabel: 'Bookmarks Bar',
  newTabLabel: 'New Tab',
  currentPageLabel: 'Current Page',

  // Accessibility
  menuLabel: 'Menu',
  navigationLabel: 'Navigation',
  mainContentLabel: 'Main Content',

  // Future features
  languageSelectorLabel: 'Language',
  themeLabel: 'Theme',
  lightTheme: 'Light',
  darkTheme: 'Dark',
  autoTheme: 'Auto',
  advancedSettingsLabel: 'Advanced Settings',
  debugModeLabel: 'Debug Mode',
  verboseLoggingLabel: 'Verbose Logging',

  // Notifications
  successNotification: 'Operation completed successfully',
  warningNotification: 'Warning: Please review before proceeding',
  infoNotification: 'Information',
  configCopiedNotification: 'Configuration copied to clipboard',
  dataClearedNotification: 'Data cleared successfully',

  // Units
  bytesUnit: 'bytes',
  kilobytesUnit: 'KB',
  megabytesUnit: 'MB',
  gigabytesUnit: 'GB',
  itemsUnit: 'items',
  pagesUnit: 'pages',

  // Bing Translation Assist panel
  bingAssistTitle: 'Bing Translation Assist',
  bingAssistEndpointLabel: 'laravel_main Endpoint:',
  bingAssistTest: 'Test',
  bingAssistAdd: 'Add',
  bingAssistDel: 'Del',
  bingAssistPollInterval: 'Poll Interval (seconds):',
  bingAssistBatchSize: 'Batch Size (tasks):',
  bingAssistParallelTabs: 'Parallel Bing Tabs:',
  bingAssistTargetLang: 'Target Language:',
  bingAssistStopToChange: 'Stop the service to change settings.',
  bingAssistSettingsLive: 'Settings apply live — no need to stop the service.',
  bingAssistScrapeLabel: 'Bing scrape test (space/comma separated):',
  bingAssistScrape: 'Scrape',
  bingAssistTranslatingLabel: 'Translating:',
  bingAssistQueueTotal: 'Queue Total',
  bingAssistNewTasks: 'New Tasks',
  bingAssistDuplicates: 'Duplicates',
  bingAssistPending: 'Pending:',
  bingAssistTranslated: 'Translated:',
  bingAssistFailed: 'Failed:',
  bingAssistInvalid: 'Invalid:',
  bingAssistActiveTabs: 'Active Tabs:',
  bingAssistLastRun: 'Last Run:',
  bingAssistWorkerId: 'Worker ID:',
  bingAssistStatusLabel: 'Status:',
  bingAssistInvalidNoEntry: 'invalid (no Bing entry)',

  // NotebookLM automation panel
  notebooklmTitle: 'NotebookLM Automation',
  notebooklmQuestionLabel: 'Question:',
  notebooklmAsk: 'Ask',
  notebooklmNotebookUrl: 'Notebook URL (optional):',
  notebooklmAnswerLabel: 'Answer:',
  notebooklmHint: 'Open a NotebookLM notebook first, then ask. Requires sign-in.',
  notebooklmAsking: 'Asking…',

  // Legacy keys for backwards compatibility
  nativeServerConfig: 'Native Server Configuration',
  runningStatus: 'Running Status',
  refreshStatus: 'Refresh Status',
  lastUpdated: 'Last Updated:',
  mcpServerConfig: 'MCP Server Configuration',
  connectionPort: 'Connection Port',
  connecting: 'Connecting...',
  disconnect: 'Disconnect',
  connect: 'Connect',
  semanticEngine: 'Semantic Engine',
  embeddingModel: 'Embedding Model',
  retry: 'Retry',
  indexDataManagement: 'Index Data Management',
  clearing: 'Clearing...',
  clearAllData: 'Clear All Data',
  copyConfig: 'Copy Configuration',
  serviceRunning: 'Service Running (Port: {0})',
  connectedServiceNotStarted: 'Connected, Service Not Started',
  serviceNotConnected: 'Service Not Connected',
  detecting: 'Detecting...',
  lightweightModel: 'Lightweight Multilingual Model',
  betterThanSmall: 'Slightly larger than e5-small, but better performance',
  multilingualModel: 'Multilingual Semantic Model',
  fast: 'Fast',
  balanced: 'Balanced',
  accurate: 'Accurate',
  semanticEngineReady: 'Semantic Engine Ready',
  semanticEngineInitializing: 'Semantic Engine Initializing...',
  semanticEngineInitFailed: 'Semantic Engine Initialization Failed',
  semanticEngineNotInit: 'Semantic Engine Not Initialized',
  downloadingModel: 'Downloading Model... {0}%',
  switchingModel: 'Switching Model...',
  networkError: 'Network connection error, please check network and retry',
  modelCorrupted: 'Model file corrupted or incomplete, please retry download',
  unknownError: 'Unknown error, please check if your network can access HuggingFace',
  reinitialize: 'Reinitialize',
  initializing: 'Initializing...',
  initSemanticEngine: 'Initialize Semantic Engine',
  indexedPages: 'Indexed Pages',
  indexSize: 'Index Size',
  activeTabs: 'Active Tabs',
  vectorDocuments: 'Vector Documents',
  confirmClearData: 'Confirm Clear Data',
  clearDataWarning:
    'This operation will clear all indexed webpage content and vector data, including:',
  clearDataIrreversible:
    'This operation is irreversible! After clearing, you need to browse webpages again to rebuild the index.',
  confirmClear: 'Confirm Clear',
  cancel: 'Cancel',
  confirm: 'Confirm',
  processing: 'Processing...',
  modelCacheManagement: 'Model Cache Management',
  cacheSize: 'Cache Size',
  cacheEntries: 'Cache Entries',
  cacheDetails: 'Cache Details',
  noCacheData: 'No cache data',
  loadingCacheInfo: 'Loading cache information...',
  processingCache: 'Processing cache...',
  cleaning: 'Cleaning...',
  cleanExpiredCache: 'Clean Expired Cache',
  clearAllCache: 'Clear All Cache',
  expired: 'Expired',
  bookmarksBar: 'Bookmarks Bar',
};

// ---------------------------------------------------------------------------
// User-selected locale (in-app language switcher support)
//
// chrome.i18n.getMessage is locked to the BROWSER UI locale and ignores the
// in-app `userLanguage` preference, so the popup's LanguageSelector could not
// actually re-translate the UI. We load the chosen locale's messages.json
// ourselves at popup startup and consult it FIRST, which makes every existing
// getMessage() call across the whole popup honor the selected language.
// ---------------------------------------------------------------------------
let userMessages: Record<string, string> = {};
let userLocale = '';

function applySubstitutions(text: string, substitutions?: string[]): string {
  if (!substitutions || substitutions.length === 0) return text;
  let out = text;
  substitutions.forEach((value, index) => {
    out = out.split(`{${index}}`).join(value); // fallback {0} style
    out = out.split(`$${index + 1}`).join(value); // chrome $1 style
  });
  return out;
}

/**
 * Load the user-selected locale's messages.json into memory. Call once before
 * mounting the popup so synchronous getMessage() renders in the chosen language.
 */
export async function loadUserLocale(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['userLanguage']);
    const lang = result.userLanguage || 'en';
    userLocale = lang;
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const resp = await fetch(url);
    if (!resp.ok) {
      userMessages = {};
      return;
    }
    const json = await resp.json();
    const flat: Record<string, string> = {};
    for (const key of Object.keys(json)) {
      const entry = json[key];
      if (entry && typeof entry.message === 'string') {
        flat[key] = entry.message;
      }
    }
    userMessages = flat;
  } catch (error) {
    console.warn('Failed to load user locale:', error);
    userMessages = {};
  }
}

export function getCurrentLocale(): string {
  return userLocale;
}

/**
 * Safe i18n message getter with fallback support
 * @param key Message key
 * @param substitutions Optional substitution values
 * @returns Localized message or fallback
 */
export function getMessage(key: string, substitutions?: string[]): string {
  // 1. User-selected locale (honors the in-app language switcher).
  if (userMessages[key]) {
    return applySubstitutions(userMessages[key], substitutions);
  }

  try {
    // 2. Chrome extension i18n (browser UI locale).
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key, substitutions);
      if (message) {
        return message;
      }
    }
  } catch (error) {
    console.warn(`Failed to get i18n message for key "${key}":`, error);
  }

  // 3. Fallback to the bundled English messages.
  let fallback = fallbackMessages[key] || key;
  if (substitutions && substitutions.length > 0) {
    substitutions.forEach((value, index) => {
      fallback = fallback.replace(`{${index}}`, value);
    });
  }

  return fallback;
}

/**
 * Check if Chrome extension i18n APIs are available
 */
export function isI18nAvailable(): boolean {
  try {
    return (
      typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function'
    );
  } catch {
    return false;
  }
}
