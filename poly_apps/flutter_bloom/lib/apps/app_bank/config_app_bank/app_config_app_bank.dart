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
  static const double borderRadius = 4.0;
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