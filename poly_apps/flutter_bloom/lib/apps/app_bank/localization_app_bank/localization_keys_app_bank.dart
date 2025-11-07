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

/// Bank App Localization Keys
/// Contains all text keys used in the Bank application with bank_ prefix
class BankLocalizationKeys {
  // App Title and Branding
  static const String bankAppName = 'bank_app_name';
  static const String bankAppTagline = 'bank_app_tagline';
  static const String bankWelcomeMessage = 'bank_welcome_message';

  // Authentication
  static const String bankLogin = 'bank_login';
  static const String bankRegister = 'bank_register';
  static const String bankEmail = 'bank_email';
  static const String bankPassword = 'bank_password';
  static const String bankConfirmPassword = 'bank_confirm_password';
  static const String bankFirstName = 'bank_first_name';
  static const String bankLastName = 'bank_last_name';
  static const String bankForgotPassword = 'bank_forgot_password';
  static const String bankBiometricLogin = 'bank_biometric_login';

  // Dashboard
  static const String bankDashboard = 'bank_dashboard';
  static const String bankTotalBalance = 'bank_total_balance';
  static const String bankChecking = 'bank_checking';
  static const String bankSavings = 'bank_savings';
  static const String bankQuickActions = 'bank_quick_actions';
  static const String bankRecentTransactions = 'bank_recent_transactions';

  // Navigation
  static const String bankHome = 'bank_home';
  static const String bankAccounts = 'bank_accounts';
  static const String bankTransfer = 'bank_transfer';
  static const String bankPayment = 'bank_payment';
  static const String bankCards = 'bank_cards';
  static const String bankInvestment = 'bank_investment';
  static const String bankLoan = 'bank_loan';
  static const String bankSecurity = 'bank_security';
  static const String bankProfile = 'bank_profile';
  static const String bankHelp = 'bank_help';
  static const String bankHistory = 'bank_history';

  // Transaction Types
  static const String bankTransactionTypeCredit = 'bank_transaction_type_credit';
  static const String bankTransactionTypeDebit = 'bank_transaction_type_debit';
  static const String bankTransactionTypeTransfer = 'bank_transaction_type_transfer';
  static const String bankTransactionTypePayment = 'bank_transaction_type_payment';

  // Common Actions
  static const String bankSend = 'bank_send';
  static const String bankReceive = 'bank_receive';
  static const String bankNext = 'bank_next';
  static const String bankBack = 'bank_back';
  static const String bankCancel = 'bank_cancel';
  static const String bankConfirm = 'bank_confirm';
  static const String bankSave = 'bank_save';
  static const String bankEdit = 'bank_edit';
  static const String bankDelete = 'bank_delete';
  static const String bankDone = 'bank_done';
  static const String bankContinue = 'bank_continue';
  static const String bankSkip = 'bank_skip';
  static const String bankGetStarted = 'bank_get_started';

  // Status Messages
  static const String bankSuccess = 'bank_success';
  static const String bankError = 'bank_error';
  static const String bankLoading = 'bank_loading';
  static const String bankNoData = 'bank_no_data';
  static const String bankNetworkError = 'bank_network_error';
  static const String bankSessionExpired = 'bank_session_expired';

  // Security Features
  static const String bankSecureBanking = 'bank_secure_banking';
  static const String bankQuickTransfers = 'bank_quick_transfers';
  static const String bankSmartInvestments = 'bank_smart_investments';
  static const String bankDigitalCards = 'bank_digital_cards';

  // Amounts and Currency
  static const String bankAmount = 'bank_amount';
  static const String bankBalance = 'bank_balance';
  static const String bankCurrency = 'bank_currency';
  static const String bankLimit = 'bank_limit';
  static const String bankFee = 'bank_fee';

  // Time and Dates
  static const String bankToday = 'bank_today';
  static const String bankYesterday = 'bank_yesterday';
  static const String bankThisWeek = 'bank_this_week';
  static const String bankThisMonth = 'bank_this_month';
  static const String bankLastMonth = 'bank_last_month';

  // Settings and Preferences
  static const String bankSettings = 'bank_settings';
  static const String bankNotifications = 'bank_notifications';
  static const String bankLanguage = 'bank_language';
  static const String bankTheme = 'bank_theme';
  static const String bankPrivacy = 'bank_privacy';
  static const String bankTermsOfService = 'bank_terms_of_service';
  static const String bankAccountManagement = 'bank_account_management';
  static const String bankAccountManagementDesc = 'bank_account_management_desc';
  static const String bankSecuritySettings = 'bank_security_settings';
  static const String bankSecuritySettingsDesc = 'bank_security_settings_desc';
  static const String bankNotificationSettings = 'bank_notification_settings';
  static const String bankNotificationSettingsDesc = 'bank_notification_settings_desc';
  static const String bankLanguageSettings = 'bank_language_settings';
  static const String bankHelpCenter = 'bank_help_center';
  static const String bankHelpCenterDesc = 'bank_help_center_desc';
  static const String bankAboutApp = 'bank_about_app';
  static const String bankAboutAppDesc = 'bank_about_app_desc';
  static const String bankPrivacyPolicy = 'bank_privacy_policy';
  static const String bankPrivacyPolicyDesc = 'bank_privacy_policy_desc';
  static const String bankUnknownUser = 'bank_unknown_user';
  static const String bankUnknownLocation = 'bank_unknown_location';
  static const String bankLastLogin = 'bank_last_login';

  // Debug Features
  static const String bankDebugExclusiveCustomer = 'bank_debug_exclusive_customer';
  static const String bankDebugMyExclusiveCustomer = 'bank_debug_my_exclusive_customer';
  static const String bankDebugExclusiveServiceDesc = 'bank_debug_exclusive_service_desc';
  static const String bankDebugVipService = 'bank_debug_vip_service';
  static const String bankDebugVipDescription = 'bank_debug_vip_description';
  static const String bankDebugVipBenefits = 'bank_debug_vip_benefits';
  static const String bankDebugDedicatedManager = 'bank_debug_dedicated_manager';
  static const String bankDebugDedicatedManagerDesc = 'bank_debug_dedicated_manager_desc';
  static const String bankDebugHigherReturns = 'bank_debug_higher_returns';
  static const String bankDebugHigherReturnsDesc = 'bank_debug_higher_returns_desc';
  static const String bankDebugPriorityProcessing = 'bank_debug_priority_processing';
  static const String bankDebugPriorityProcessingDesc = 'bank_debug_priority_processing_desc';
  static const String bankDebugExclusiveOffers = 'bank_debug_exclusive_offers';
  static const String bankDebugExclusiveOffersDesc = 'bank_debug_exclusive_offers_desc';
  static const String bankDebugContactService = 'bank_debug_contact_service';
  static const String bankDebugVipHotline = 'bank_debug_vip_hotline';
  static const String bankDebugSettings = 'bank_debug_settings';
  static const String bankDebugWarning = 'bank_debug_warning';
  static const String bankDebugGeneralSettings = 'bank_debug_general_settings';
  static const String bankDebugEnableDebugMode = 'bank_debug_enable_debug_mode';
  static const String bankDebugEnableDebugModeDesc = 'bank_debug_enable_debug_mode_desc';
  static const String bankDebugShowPerformance = 'bank_debug_show_performance';
  static const String bankDebugShowPerformanceDesc = 'bank_debug_show_performance_desc';
  static const String bankDebugNetworkSettings = 'bank_debug_network_settings';
  static const String bankDebugEnableNetworkLogging = 'bank_debug_enable_network_logging';
  static const String bankDebugEnableNetworkLoggingDesc = 'bank_debug_enable_network_logging_desc';
  static const String bankDebugEnableMockData = 'bank_debug_enable_mock_data';
  static const String bankDebugEnableMockDataDesc = 'bank_debug_enable_mock_data_desc';
  static const String bankDebugSettingsSaved = 'bank_debug_settings_saved';
  static const String bankDebugResetDefaults = 'bank_debug_reset_defaults';
  static const String bankDebugDeveloperFeedback = 'bank_debug_developer_feedback';
  static const String bankDebugFeedbackInfo = 'bank_debug_feedback_info';
  static const String bankDebugFeedbackCategory = 'bank_debug_feedback_category';
  static const String bankDebugCategoryBug = 'bank_debug_category_bug';
  static const String bankDebugCategoryFeature = 'bank_debug_category_feature';
  static const String bankDebugCategoryImprovement = 'bank_debug_category_improvement';
  static const String bankDebugCategoryOther = 'bank_debug_category_other';
  static const String bankDebugYourEmail = 'bank_debug_your_email';
  static const String bankDebugEmailPlaceholder = 'bank_debug_email_placeholder';
  static const String bankDebugYourFeedback = 'bank_debug_your_feedback';
  static const String bankDebugFeedbackPlaceholder = 'bank_debug_feedback_placeholder';
  static const String bankDebugSubmitFeedback = 'bank_debug_submit_feedback';
  static const String bankDebugFeedbackRequired = 'bank_debug_feedback_required';
  static const String bankDebugFeedbackSubmitted = 'bank_debug_feedback_submitted';
  static const String bankDebugDeveloperTools = 'bank_debug_developer_tools';
  static const String bankDebugAppInfo = 'bank_debug_app_info';
  static const String bankDebugAppVersion = 'bank_debug_app_version';
  static const String bankDebugBuildMode = 'bank_debug_build_mode';
  static const String bankDebugCurrentLanguage = 'bank_debug_current_language';
  static const String bankDebugDevActions = 'bank_debug_dev_actions';
  static const String bankDebugShowLogs = 'bank_debug_show_logs';
  static const String bankDebugShowLogsDesc = 'bank_debug_show_logs_desc';
  static const String bankDebugClearCache = 'bank_debug_clear_cache';
  static const String bankDebugClearCacheDesc = 'bank_debug_clear_cache_desc';
  static const String bankDebugResetApp = 'bank_debug_reset_app';
  static const String bankDebugResetAppDesc = 'bank_debug_reset_app_desc';
  static const String bankDebugNetworkInfo = 'bank_debug_network_info';
  static const String bankDebugApiEndpoint = 'bank_debug_api_endpoint';
  static const String bankDebugApiVersion = 'bank_debug_api_version';
  static const String bankDebugTimeout = 'bank_debug_timeout';
  static const String bankDebugApplicationLogs = 'bank_debug_application_logs';
  static const String bankDebugClearCacheConfirm = 'bank_debug_clear_cache_confirm';
  static const String bankDebugCacheCleared = 'bank_debug_cache_cleared';
  static const String bankDebugResetAppConfirm = 'bank_debug_reset_app_confirm';
  static const String bankDebugAppReset = 'bank_debug_app_reset';
  static const String bankDebugReset = 'bank_debug_reset';
}