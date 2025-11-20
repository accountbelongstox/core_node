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

import 'localization_keys_app_bank.dart';

/// English localization for Bank App
class EnAppBank {
  static const Map<String, String> locales = {
    // App Title and Branding
    BankLocalizationKeys.bankAppName: 'Flutter Bank',
    BankLocalizationKeys.bankAppTagline: 'Your Trusted Financial Partner',
    BankLocalizationKeys.bankWelcomeMessage: 'Good Morning',

    // Authentication
    BankLocalizationKeys.bankLogin: 'Login',
    BankLocalizationKeys.bankRegister: 'Register',
    BankLocalizationKeys.bankEmail: 'Email',
    BankLocalizationKeys.bankPassword: 'Password',
    BankLocalizationKeys.bankConfirmPassword: 'Confirm Password',
    BankLocalizationKeys.bankFirstName: 'First Name',
    BankLocalizationKeys.bankLastName: 'Last Name',
    BankLocalizationKeys.bankForgotPassword: 'Forgot Password?',
    BankLocalizationKeys.bankBiometricLogin: 'Login with Biometrics',

    // Dashboard
    BankLocalizationKeys.bankDashboard: 'Dashboard',
    BankLocalizationKeys.bankTotalBalance: 'Total Balance',
    BankLocalizationKeys.bankChecking: 'Checking',
    BankLocalizationKeys.bankSavings: 'Savings',
    BankLocalizationKeys.bankQuickActions: 'Quick Actions',
    BankLocalizationKeys.bankRecentTransactions: 'Recent Transactions',

    // Navigation
    BankLocalizationKeys.bankHome: 'Home',
    BankLocalizationKeys.bankAccounts: 'Accounts',
    BankLocalizationKeys.bankTransfer: 'Transfer',
    BankLocalizationKeys.bankPayment: 'Pay Bills',
    BankLocalizationKeys.bankCards: 'Cards',
    BankLocalizationKeys.bankInvestment: 'Invest',
    BankLocalizationKeys.bankLoan: 'Loans',
    BankLocalizationKeys.bankSecurity: 'Security',
    BankLocalizationKeys.bankProfile: 'Profile',
    BankLocalizationKeys.bankHelp: 'Help',
    BankLocalizationKeys.bankHistory: 'History',

    // Transaction Types
    BankLocalizationKeys.bankTransactionTypeCredit: 'Credit',
    BankLocalizationKeys.bankTransactionTypeDebit: 'Debit',
    BankLocalizationKeys.bankTransactionTypeTransfer: 'Transfer',
    BankLocalizationKeys.bankTransactionTypePayment: 'Payment',

    // Common Actions
    BankLocalizationKeys.bankSend: 'Send',
    BankLocalizationKeys.bankReceive: 'Receive',
    BankLocalizationKeys.bankNext: 'Next',
    BankLocalizationKeys.bankBack: 'Back',
    BankLocalizationKeys.bankCancel: 'Cancel',
    BankLocalizationKeys.bankConfirm: 'Confirm',
    BankLocalizationKeys.bankSave: 'Save',
    BankLocalizationKeys.bankEdit: 'Edit',
    BankLocalizationKeys.bankDelete: 'Delete',
    BankLocalizationKeys.bankDone: 'Done',
    BankLocalizationKeys.bankContinue: 'Continue',
    BankLocalizationKeys.bankSkip: 'Skip',
    BankLocalizationKeys.bankGetStarted: 'Get Started',

    // Status Messages
    BankLocalizationKeys.bankSuccess: 'Success',
    BankLocalizationKeys.bankError: 'Error',
    BankLocalizationKeys.bankLoading: 'Loading...',
    BankLocalizationKeys.bankNoData: 'No data available',
    BankLocalizationKeys.bankNetworkError: 'Network connection error',
    BankLocalizationKeys.bankSessionExpired: 'Session expired',

    // Security Features
    BankLocalizationKeys.bankSecureBanking: 'Secure Banking',
    BankLocalizationKeys.bankQuickTransfers: 'Quick Transfers',
    BankLocalizationKeys.bankSmartInvestments: 'Smart Investments',
    BankLocalizationKeys.bankDigitalCards: 'Digital Cards',

    // Amounts and Currency
    BankLocalizationKeys.bankAmount: 'Amount',
    BankLocalizationKeys.bankBalance: 'Balance',
    BankLocalizationKeys.bankCurrency: 'Currency',
    BankLocalizationKeys.bankLimit: 'Limit',
    BankLocalizationKeys.bankFee: 'Fee',

    // Time and Dates
    BankLocalizationKeys.bankToday: 'Today',
    BankLocalizationKeys.bankYesterday: 'Yesterday',
    BankLocalizationKeys.bankThisWeek: 'This Week',
    BankLocalizationKeys.bankThisMonth: 'This Month',
    BankLocalizationKeys.bankLastMonth: 'Last Month',

    // Settings and Preferences
    BankLocalizationKeys.bankSettings: 'Settings',
    BankLocalizationKeys.bankNotifications: 'Notifications',
    BankLocalizationKeys.bankLanguage: 'Language',
    BankLocalizationKeys.bankTheme: 'Theme',
    BankLocalizationKeys.bankPrivacy: 'Privacy',
    BankLocalizationKeys.bankTermsOfService: 'Terms of Service',
    BankLocalizationKeys.bankAccountManagement: 'Account Management',
    BankLocalizationKeys.bankAccountManagementDesc: 'Modify personal information',
    BankLocalizationKeys.bankSecuritySettings: 'Security Settings',
    BankLocalizationKeys.bankSecuritySettingsDesc: 'Password, fingerprint, face recognition',
    BankLocalizationKeys.bankNotificationSettings: 'Message Notifications',
    BankLocalizationKeys.bankNotificationSettingsDesc: 'Push, SMS, email notifications',
    BankLocalizationKeys.bankLanguageSettings: 'Simplified Chinese',
    BankLocalizationKeys.bankHelpCenter: 'Help Center',
    BankLocalizationKeys.bankHelpCenterDesc: 'FAQ and customer service',
    BankLocalizationKeys.bankAboutApp: 'About Bank App',
    BankLocalizationKeys.bankAboutAppDesc: 'Version 1.0.0 · Developer Test',
    BankLocalizationKeys.bankPrivacyPolicy: 'Privacy Policy',
    BankLocalizationKeys.bankPrivacyPolicyDesc: 'User agreement and privacy terms',
    BankLocalizationKeys.bankUnknownUser: 'Unknown User',
    BankLocalizationKeys.bankUnknownLocation: 'Unknown Location',
    BankLocalizationKeys.bankLastLogin: 'Last Login',

    // Debug Features
    BankLocalizationKeys.bankDebugExclusiveCustomer: 'Exclusive Customer',
    BankLocalizationKeys.bankDebugMyExclusiveCustomer: 'My Exclusive Customer',
    BankLocalizationKeys.bankDebugExclusiveServiceDesc: 'Exclusive service and privileges',
    BankLocalizationKeys.bankDebugVipService: 'VIP Exclusive Service',
    BankLocalizationKeys.bankDebugVipDescription: 'Enjoy premium benefits and personalized service',
    BankLocalizationKeys.bankDebugVipBenefits: 'VIP Benefits',
    BankLocalizationKeys.bankDebugDedicatedManager: 'Dedicated Account Manager',
    BankLocalizationKeys.bankDebugDedicatedManagerDesc: '24/7 personal banking advisor',
    BankLocalizationKeys.bankDebugHigherReturns: 'Higher Investment Returns',
    BankLocalizationKeys.bankDebugHigherReturnsDesc: 'Access to premium investment products',
    BankLocalizationKeys.bankDebugPriorityProcessing: 'Priority Processing',
    BankLocalizationKeys.bankDebugPriorityProcessingDesc: 'Fast-track transaction handling',
    BankLocalizationKeys.bankDebugExclusiveOffers: 'Exclusive Offers',
    BankLocalizationKeys.bankDebugExclusiveOffersDesc: 'Special rates and promotions',
    BankLocalizationKeys.bankDebugContactService: 'Contact Service',
    BankLocalizationKeys.bankDebugVipHotline: 'VIP Hotline',
    BankLocalizationKeys.bankDebugSettings: 'Debug Settings',
    BankLocalizationKeys.bankDebugWarning: 'Debug settings are for development only',
    BankLocalizationKeys.bankDebugGeneralSettings: 'General Settings',
    BankLocalizationKeys.bankDebugEnableDebugMode: 'Enable Debug Mode',
    BankLocalizationKeys.bankDebugEnableDebugModeDesc: 'Show debug information',
    BankLocalizationKeys.bankDebugShowPerformance: 'Show Performance Overlay',
    BankLocalizationKeys.bankDebugShowPerformanceDesc: 'Display FPS and frame time',
    BankLocalizationKeys.bankDebugNetworkSettings: 'Network Settings',
    BankLocalizationKeys.bankDebugEnableNetworkLogging: 'Enable Network Logging',
    BankLocalizationKeys.bankDebugEnableNetworkLoggingDesc: 'Log all network requests',
    BankLocalizationKeys.bankDebugEnableMockData: 'Enable Mock Data',
    BankLocalizationKeys.bankDebugEnableMockDataDesc: 'Use mock data instead of real API',
    BankLocalizationKeys.bankDebugSettingsSaved: 'Debug settings saved',
    BankLocalizationKeys.bankDebugResetDefaults: 'Reset to Defaults',
    BankLocalizationKeys.bankDebugDeveloperFeedback: 'Developer Feedback',
    BankLocalizationKeys.bankDebugFeedbackInfo: 'Your feedback helps us improve the app',
    BankLocalizationKeys.bankDebugFeedbackCategory: 'Feedback Category',
    BankLocalizationKeys.bankDebugCategoryBug: 'Bug Report',
    BankLocalizationKeys.bankDebugCategoryFeature: 'Feature Request',
    BankLocalizationKeys.bankDebugCategoryImprovement: 'Improvement',
    BankLocalizationKeys.bankDebugCategoryOther: 'Other',
    BankLocalizationKeys.bankDebugYourEmail: 'Your Email (Optional)',
    BankLocalizationKeys.bankDebugEmailPlaceholder: 'your@email.com',
    BankLocalizationKeys.bankDebugYourFeedback: 'Your Feedback',
    BankLocalizationKeys.bankDebugFeedbackPlaceholder: 'Please describe your feedback in detail...',
    BankLocalizationKeys.bankDebugSubmitFeedback: 'Submit Feedback',
    BankLocalizationKeys.bankDebugFeedbackRequired: 'Please enter your feedback',
    BankLocalizationKeys.bankDebugFeedbackSubmitted: 'Thank you for your feedback!',
    BankLocalizationKeys.bankDebugDeveloperTools: 'Developer Tools',
    BankLocalizationKeys.bankDebugAppInfo: 'App Information',
    BankLocalizationKeys.bankDebugAppVersion: 'Version',
    BankLocalizationKeys.bankDebugBuildMode: 'Build Mode',
    BankLocalizationKeys.bankDebugCurrentLanguage: 'Language',
    BankLocalizationKeys.bankDebugDevActions: 'Developer Actions',
    BankLocalizationKeys.bankDebugShowLogs: 'Show Logs',
    BankLocalizationKeys.bankDebugShowLogsDesc: 'View application logs',
    BankLocalizationKeys.bankDebugClearCache: 'Clear Cache',
    BankLocalizationKeys.bankDebugClearCacheDesc: 'Remove cached data',
    BankLocalizationKeys.bankDebugResetApp: 'Reset App Data',
    BankLocalizationKeys.bankDebugResetAppDesc: 'Clear all app data',
    BankLocalizationKeys.bankDebugNetworkInfo: 'Network Information',
    BankLocalizationKeys.bankDebugApiEndpoint: 'API Endpoint',
    BankLocalizationKeys.bankDebugApiVersion: 'API Version',
    BankLocalizationKeys.bankDebugTimeout: 'Timeout',
    BankLocalizationKeys.bankDebugApplicationLogs: 'Application Logs',
    BankLocalizationKeys.bankDebugClearCacheConfirm: 'Are you sure you want to clear the cache?',
    BankLocalizationKeys.bankDebugCacheCleared: 'Cache cleared successfully',
    BankLocalizationKeys.bankDebugResetAppConfirm: 'This will delete all app data. This action cannot be undone.',
    BankLocalizationKeys.bankDebugAppReset: 'App data reset successfully',
    BankLocalizationKeys.bankDebugReset: 'Reset',
  };
}