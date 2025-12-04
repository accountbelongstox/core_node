// English translations for app_ittools
export default {
  app: {
    name: 'Laravel Web Panel',
    title: 'Laravel Development & Debugging Tools'
  },

  modules: {
    apiTesting: {
      name: 'API Testing',
      description: 'Test and debug API endpoints',
      icon: 'rocket'
    },
    devTools: {
      name: 'Development Tools',
      description: 'IT Tools collection',
      icon: 'tools'
    },
    systemInfo: {
      name: 'System Information',
      description: 'Server and system monitoring',
      icon: 'server'
    },
    vocabulary: {
      name: 'Vocabulary Learning',
      description: 'Language learning tools',
      icon: 'book'
    },
    codeBrowser: {
      name: 'Code Browser',
      description: 'Browse and search code',
      icon: 'code'
    },
    staticResources: {
      name: 'Static Resources',
      description: 'Manage static files',
      icon: 'photo-video'
    },
    mcpManager: {
      name: 'MCP Manager',
      description: 'Model Context Protocol management',
      icon: 'camera'
    },
    octaneTasks: {
      name: 'Octane Timer Tasks',
      description: 'Laravel Octane task scheduler',
      icon: 'clock'
    }
  },

  common: {
    search: 'Search',
    settings: 'Settings',
    profile: 'Profile',
    logout: 'Logout',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    submit: 'Submit',
    reset: 'Reset',
    connected: 'Connected',
    disconnected: 'Disconnected',
    checking: 'Checking...',
    reconnect: 'Reconnect',
    connectionStatus: 'Connection Status',
    backendStatus: 'Backend Status',
    noData: 'No data available',
    upload: 'Upload',
    download: 'Download',
    dragDrop: 'Drag and drop files here',
    selectFiles: 'Select Files'
  },

  sidebar: {
    collapse: 'Collapse',
    expand: 'Expand'
  },

  errors: {
    networkError: 'Network error occurred',
    unauthorized: 'Unauthorized access',
    notFound: 'Resource not found',
    serverError: 'Server error',
    validationError: 'Validation error',
    unknownError: 'Unknown error occurred',
    connectionFailed: 'Connection to backend failed',
    uploadFailed: 'Upload failed'
  },

  // API Testing Module
  apiTesting: {
    title: 'API Testing Dashboard',
    requestBuilder: 'Request Builder',
    response: 'Response',
    history: 'History',
    method: 'Method',
    url: 'URL',
    headers: 'Headers',
    body: 'Body',
    params: 'Parameters',
    send: 'Send Request',
    clear: 'Clear',
    addHeader: 'Add Header',
    addParam: 'Add Parameter',
    statusCode: 'Status Code',
    responseTime: 'Response Time',
    size: 'Size',
    copyResponse: 'Copy Response',
    downloadResponse: 'Download',
    formatJson: 'Format JSON',
    rawView: 'Raw',
    prettyView: 'Pretty',
    previewView: 'Preview',
    apiReference: 'API Reference',
    endpoints: 'endpoints',
    authRequired: 'Auth Required',
    noAuth: 'No Auth',
    apiInfo: 'API Information'
  },

  // System Information Module
  systemInfo: {
    title: 'System Information',
    phpInfo: 'PHP Information',
    laravelInfo: 'Laravel Information',
    serverInfo: 'Server Information',
    databaseInfo: 'Database Information',
    version: 'Version',
    environment: 'Environment',
    debug: 'Debug Mode',
    timezone: 'Timezone',
    memory: 'Memory',
    uptime: 'Uptime',
    loadAverage: 'Load Average',
    diskSpace: 'Disk Space',
    refresh: 'Refresh',
    connection: 'Connection',
    driver: 'Driver'
  },

  // Development Tools Module
  devTools: {
    title: 'Development Tools',
    ittools: 'IT Tools Collection',
    selectTool: 'Select a tool',
    favorites: 'Favorites',
    recent: 'Recent',
    allTools: 'All Tools',
    search: 'Search tools...',
    categories: {
      crypto: 'Cryptography',
      converter: 'Converters',
      web: 'Web',
      text: 'Text',
      math: 'Math',
      network: 'Network',
      media: 'Media',
      development: 'Development',
      measurement: 'Measurement',
      data: 'Data'
    }
  },

  // Code Browser Module
  codeBrowser: {
    title: 'Code Browser',
    fileTree: 'File Tree',
    search: 'Search files...',
    openFile: 'Open File',
    lineNumber: 'Line',
    download: 'Download',
    copy: 'Copy Code'
  },

  // Vocabulary Module
  vocabulary: {
    title: 'Vocabulary Learning',
    wordList: 'Word List',
    addWord: 'Add Word',
    practice: 'Practice',
    progress: 'Progress',
    mastered: 'Mastered',
    learning: 'Learning',
    newWord: 'New'
  },

  // Static Resources Module
  staticResources: {
    title: 'Static Resources',
    images: 'Images',
    videos: 'Videos',
    documents: 'Documents',
    upload: 'Upload',
    preview: 'Preview',
    download: 'Download'
  },

  // MCP Manager Module
  mcpManager: {
    title: 'MCP Manager',
    servers: 'Servers',
    status: 'Status',
    config: 'Configuration',
    tools: 'Tools',
    connected: 'Connected',
    disconnected: 'Disconnected',
    connect: 'Connect',
    disconnect: 'Disconnect'
  },

  // Octane Tasks Module
  octaneTasks: {
    title: 'Octane Timer Tasks',
    taskList: 'Task List',
    addTask: 'Add Task',
    editTask: 'Edit Task',
    deleteTask: 'Delete Task',
    executeNow: 'Execute Now',
    schedule: 'Schedule',
    lastRun: 'Last Run',
    nextRun: 'Next Run',
    logs: 'Execution Logs',
    active: 'Active',
    inactive: 'Inactive'
  }
}
