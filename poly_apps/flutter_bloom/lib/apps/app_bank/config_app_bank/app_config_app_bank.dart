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

/// Bank App Configuration
/// Contains all configuration constants and settings for the Bank application
class BankAppConfig {
  static const String appName = 'Bank';
  static const String appId = 'bank';
  static const String packageName = 'com.flutter.bloom.bank';
  static const String appVersion = '1.0.0';
  static const String buildNumber = '1';

  // App specific configurations
  static const String appDisplayName = 'Flutter Bank';
  static const String appDescription = 'Professional banking application with comprehensive financial services';

  // Feature flags
  static const bool enableBiometricAuth = true;
  static const bool enablePushNotifications = true;
  static const bool enableDarkMode = true;
  static const bool enableInvestmentFeatures = true;
  static const bool enableLoanServices = true;

  // API configurations
  static const String apiBaseUrl = 'https://api.bank.example.com';
  static const String apiVersion = 'v1';
  static const int apiTimeout = 30000; // milliseconds

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

  /// Get app configuration map
  static Map<String, dynamic> getConfig() {
    return {
      'appId': appId,
      'appTitle': appName,
      'appVersion': appVersion,
      'packageName': packageName,
      'buildNumber': buildNumber,
      'appDisplayName': appDisplayName,
      'appDescription': appDescription,
      'enableFeatures': [
        if (enableBiometricAuth) 'biometricAuth',
        if (enablePushNotifications) 'pushNotifications',
        if (enableDarkMode) 'darkMode',
        if (enableInvestmentFeatures) 'investmentFeatures',
        if (enableLoanServices) 'loanServices',
      ],
      'apiConfig': {
        'baseUrl': apiBaseUrl,
        'version': apiVersion,
        'timeout': apiTimeout,
      },
      'securityConfig': {
        'sessionTimeoutMinutes': sessionTimeoutMinutes,
        'maxLoginAttempts': maxLoginAttempts,
        'requireStrongPassword': requireStrongPassword,
      },
      'businessConfig': {
        'dailyTransferLimit': dailyTransferLimit,
        'maxSingleTransferAmount': maxSingleTransferAmount,
        'supportedCurrencies': supportedCurrencies,
      },
      'uiConfig': {
        'animationDurationMs': animationDurationMs,
        'borderRadius': borderRadius,
        'cardElevation': cardElevation,
      },
    };
  }
}