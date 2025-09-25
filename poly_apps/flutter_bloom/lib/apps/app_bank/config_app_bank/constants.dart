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

/// Bank application constants
/// Defines app-specific constants and configuration values
class BankConstants {
  const BankConstants();
  
  // App information
  static const String appName = 'Bank';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'Professional banking application with comprehensive financial services';
  
  // API configuration
  static const String baseUrl = 'https://api.bank.example.com';
  static const String apiVersion = 'v1';
  static const int timeoutSeconds = 30;
  
  // Feature flags
  static const bool enableBiometricAuth = true;
  static const bool enablePushNotifications = true;
  static const bool enableDarkMode = true;
  static const bool enableInvestmentFeatures = true;
  static const bool enableLoanServices = true;
  
  // Security configurations
  static const int sessionTimeoutMinutes = 15;
  static const int maxLoginAttempts = 3;
  static const bool requireStrongPassword = true;
  
  // Business configurations
  static const double dailyTransferLimit = 10000.0;
  static const double maxSingleTransferAmount = 5000.0;
  static const List<String> supportedCurrencies = ['USD', 'EUR', 'GBP', 'CNY'];
  
  // UI configurations
  static const int animationDurationMs = 300;
  static const double borderRadius = 12.0;
  static const double cardElevation = 4.0;
  
  // Storage keys
  static const String userPreferencesKey = 'bank_user_preferences';
  static const String accountDataKey = 'bank_account_data';
  static const String transactionHistoryKey = 'bank_transaction_history';
  static const String cardDataKey = 'bank_card_data';
  static const String investmentDataKey = 'bank_investment_data';
  static const String loanDataKey = 'bank_loan_data';
  static const String securitySettingsKey = 'bank_security_settings';
  static const String notificationSettingsKey = 'bank_notification_settings';
  static const String themeSettingsKey = 'bank_theme_settings';
  static const String languageSettingsKey = 'bank_language_settings';
  
  // Error messages
  static const String networkErrorMessage = 'Network connection error';
  static const String serverErrorMessage = 'Server error occurred';
  static const String unknownErrorMessage = 'An unknown error occurred';
  static const String authenticationErrorMessage = 'Authentication failed';
  static const String insufficientFundsErrorMessage = 'Insufficient funds';
  static const String transactionLimitErrorMessage = 'Transaction limit exceeded';

  // SharedPreferences configuration
  static const String prefsPrefix = 'bank_';
  static const String prefsName = 'bank_prefs';
  
  // Route constants
  static const String routeSplash = '/bank/splash';
  static const String routeOnboarding = '/bank/onboarding';
  static const String routeAuthentication = '/bank/authentication';
  static const String routeDashboard = '/bank/dashboard';
  static const String routeAccountOverview = '/bank/account_overview';
  static const String routeTransfer = '/bank/transfer';
  static const String routePayment = '/bank/payment';
  static const String routeTransactionHistory = '/bank/transaction_history';
  static const String routeCardManagement = '/bank/card_management';
  static const String routeInvestment = '/bank/investment';
  static const String routeLoan = '/bank/loan';
  static const String routeSecurity = '/bank/security';
  static const String routeProfile = '/bank/profile';
  static const String routeHelp = '/bank/help';
  static const String routeScan = '/bank/scan';
  static const String routeLife = '/bank/life';
  static const String routeSettings = '/bank/settings';
  static const String routeExclusiveCustomer = '/bank/exclusive_customer';
  static const String routeDebugSettings = '/bank/debug_settings';
  static const String routeDeveloperFeedback = '/bank/developer_feedback';
  static const String routeDeveloperTools = '/bank/developer_tools';
}