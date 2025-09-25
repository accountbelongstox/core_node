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
}