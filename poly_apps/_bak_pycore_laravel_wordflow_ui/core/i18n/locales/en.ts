/**
 * Translation Dictionary Type
 */
export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

/**
 * English Translations (Default)
 */
export const en: TranslationDictionary = {
  // Common UI
  common: {
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Information',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    update: 'Update',
    search: 'Search',
    filter: 'Filter',
    reset: 'Reset',
    apply: 'Apply',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    submit: 'Submit',
    clear: 'Clear',
    refresh: 'Refresh',
    download: 'Download',
    upload: 'Upload',
    copy: 'Copy',
    paste: 'Paste',
    cut: 'Cut',
    select: 'Select',
    selectAll: 'Select All',
    deselect: 'Deselect',
    expand: 'Expand',
    collapse: 'Collapse',
    view: 'View',
    preview: 'Preview',
    print: 'Print',
    export: 'Export',
    import: 'Import'
  },

  // Navigation
  nav: {
    dashboard: 'Dashboard',
    home: 'Home',
    tools: 'Tools',
    settings: 'Settings',
    profile: 'Profile',
    logout: 'Logout',
    login: 'Login',
    register: 'Register'
  },

  // Tool Categories
  categories: {
    aiTools: 'AI Tools',
    vocabulary: 'Vocabulary',
    serverManager: 'Server Manager',
    cryptoSecurity: 'Crypto & Security',
    converters: 'Converters',
    webDevelopment: 'Web Development',
    textProcessing: 'Text Processing',
    networkTools: 'Network Tools',
    mediaTools: 'Media Tools'
  },

  // AI Tools
  aiTools: {
    translation: 'Translation',
    tts: 'Text-to-Speech',
    ocr: 'OCR (Image to Text)',
    promptManager: 'Prompt Manager',
    imageGeneration: 'Image Generation',
    speechToText: 'Speech-to-Text',
    translationDesc: 'Translate text between languages using AI',
    ttsDesc: 'Convert text to natural speech audio',
    ocrDesc: 'Extract text from images using OCR'
  },

  // Server Manager
  serverManager: {
    systemInfo: 'System Information',
    fileManager: 'File Manager',
    nginxManager: 'Nginx Manager',
    sslManager: 'SSL Certificate Manager',
    codeExecutor: 'Code Executor',
    systemInfoDesc: 'View system information, processes, and services',
    fileManagerDesc: 'Browse and manage server files',
    nginxManagerDesc: 'Manage Nginx sites and configurations',
    sslManagerDesc: "Manage SSL certificates with Let's Encrypt",
    codeExecutorDesc: 'Execute server-side scripts and commands'
  },

  // IT Tools
  itTools: {
    hashGenerator: 'Hash Generator',
    uuidGenerator: 'UUID Generator',
    base64Converter: 'Base64 Encoder/Decoder',
    jsonFormatter: 'JSON Formatter',
    colorConverter: 'Color Converter',
    qrCodeGenerator: 'QR Code Generator',
    ipCalculator: 'IP Subnet Calculator',
    regexTester: 'Regex Tester',
    bcryptGenerator: 'Bcrypt Hash Generator',
    textStatistics: 'Text Statistics'
  },

  // Forms
  form: {
    inputText: 'Enter text',
    selectLanguage: 'Select language',
    selectVoice: 'Select voice',
    uploadFile: 'Upload file',
    dragDropFile: 'Drag and drop file here',
    required: 'This field is required',
    invalidFormat: 'Invalid format',
    invalidEmail: 'Invalid email address',
    passwordTooShort: 'Password is too short',
    passwordMismatch: 'Passwords do not match',
    minLength: 'Minimum length: {{min}}',
    maxLength: 'Maximum length: {{max}}',
    minValue: 'Minimum value: {{min}}',
    maxValue: 'Maximum value: {{max}}'
  },

  // Messages
  messages: {
    saveSuccess: 'Saved successfully',
    saveError: 'Failed to save',
    deleteSuccess: 'Deleted successfully',
    deleteError: 'Failed to delete',
    copySuccess: 'Copied to clipboard',
    copyError: 'Failed to copy',
    uploadSuccess: 'Uploaded successfully',
    uploadError: 'Failed to upload',
    networkError: 'Network error, please try again',
    unauthorized: 'Unauthorized, please login',
    forbidden: 'You do not have permission',
    notFound: 'Resource not found',
    serverError: 'Server error, please try again later',
    confirmDelete: 'Are you sure you want to delete?',
    unsavedChanges: 'You have unsaved changes'
  },

  // History & Favorites
  history: {
    title: 'History',
    empty: 'No history yet',
    clear: 'Clear history',
    clearConfirm: 'Clear all history?',
    viewAll: 'View all',
    recent: 'Recent'
  },

  favorites: {
    title: 'Favorites',
    empty: 'No favorites yet',
    add: 'Add to favorites',
    remove: 'Remove from favorites'
  },

  // User
  user: {
    profile: 'Profile',
    settings: 'Settings',
    preferences: 'Preferences',
    language: 'Language',
    theme: 'Theme',
    notifications: 'Notifications',
    privacy: 'Privacy',
    security: 'Security',
    account: 'Account',
    changePassword: 'Change Password',
    logout: 'Logout',
    login: 'Login',
    register: 'Register',
    forgotPassword: 'Forgot Password',
    resetPassword: 'Reset Password'
  },

  // Time
  time: {
    justNow: 'Just now',
    minutesAgo: '{{count}} minutes ago',
    hoursAgo: '{{count}} hours ago',
    daysAgo: '{{count}} days ago',
    weeksAgo: '{{count}} weeks ago',
    monthsAgo: '{{count}} months ago',
    yearsAgo: '{{count}} years ago'
  }
};
