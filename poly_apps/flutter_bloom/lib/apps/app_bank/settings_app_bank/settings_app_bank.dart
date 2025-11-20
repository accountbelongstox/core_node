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

import '../../../common/settings/models/setting_item.dart';

/// Bank App Settings
/// Provides app-specific settings following the unified architecture
/// All setting keys must have 'bank_' prefix as per specification
class BankAppSettings {
  static const String appId = 'bank';
  
  // Category constants
  static const String categoryGeneral = 'bank_general';
  static const String categorySecurity = 'bank_security';
  static const String categoryTransactions = 'bank_transactions';
  static const String categoryNotifications = 'bank_notifications';
  static const String categoryInvestment = 'bank_investment';
  static const String categoryLoan = 'bank_loan';
  static const String categoryPrivacy = 'bank_privacy';
  static const String categoryPerformance = 'bank_performance';
  
  /// Get all Bank app settings
  static List<SettingItem> getBankSettings() {
    return [
      SettingItem.toggle(
        key: 'bank_enable_biometric_auth',
        name: 'Enable Biometric Authentication',
        description: 'Use fingerprint or face recognition for app access',
        defaultValue: true,
        category: categoryGeneral,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_dark_mode',
        name: 'Enable Dark Mode',
        description: 'Use dark theme for better viewing in low light',
        defaultValue: true,
        category: categoryGeneral,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_push_notifications',
        name: 'Enable Push Notifications',
        description: 'Receive notifications for account activities',
        defaultValue: true,
        category: categoryGeneral,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_analytics',
        name: 'Enable Analytics',
        description: 'Allow anonymous usage analytics to improve the app',
        defaultValue: true,
        category: categoryGeneral,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_crash_reporting',
        name: 'Enable Crash Reporting',
        description: 'Automatically send crash reports to help improve stability',
        defaultValue: true,
        category: categoryGeneral,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_require_pin_for_transactions',
        name: 'Require PIN for Transactions',
        description: 'Require PIN confirmation for all financial transactions',
        defaultValue: true,
        category: categorySecurity,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_two_factor_auth',
        name: 'Enable Two-Factor Authentication',
        description: 'Add an extra layer of security with 2FA',
        defaultValue: false,
        category: categorySecurity,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'bank_session_timeout',
        name: 'Session Timeout',
        description: 'Automatically log out after period of inactivity',
        options: ['5', '15', '30', '60'],
        defaultValue: '15',
        labels: {
          '5': '5 minutes',
          '15': '15 minutes',
          '30': '30 minutes',
          '60': '1 hour',
        },
        category: categorySecurity,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_transaction_alerts',
        name: 'Enable Transaction Alerts',
        description: 'Get notified for all account transactions',
        defaultValue: true,
        category: categoryTransactions,
        appId: appId,
      ),
      
      SettingItem.slider(
        key: 'bank_daily_transfer_limit',
        name: 'Daily Transfer Limit',
        description: 'Set maximum amount for daily transfers',
        defaultValue: 10000.0,
        minValue: 1000.0,
        maxValue: 50000.0,
        category: categoryTransactions,
        appId: appId,
      ),
      
      SettingItem.slider(
        key: 'bank_max_single_transfer',
        name: 'Max Single Transfer',
        description: 'Maximum amount for a single transfer',
        defaultValue: 5000.0,
        minValue: 100.0,
        maxValue: 25000.0,
        category: categoryTransactions,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_quick_transfer',
        name: 'Enable Quick Transfer',
        description: 'Allow quick transfer to frequent recipients',
        defaultValue: true,
        category: categoryTransactions,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_sound_notifications',
        name: 'Enable Sound Notifications',
        description: 'Play sound for transaction notifications',
        defaultValue: true,
        category: categoryNotifications,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_vibration_notifications',
        name: 'Enable Vibration Notifications',
        description: 'Vibrate device for important notifications',
        defaultValue: true,
        category: categoryNotifications,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'bank_notification_frequency',
        name: 'Notification Frequency',
        description: 'How often to receive notifications',
        options: ['immediate', 'hourly', 'daily', 'weekly'],
        defaultValue: 'immediate',
        labels: {
          'immediate': 'Immediate',
          'hourly': 'Hourly Summary',
          'daily': 'Daily Summary',
          'weekly': 'Weekly Summary',
        },
        category: categoryNotifications,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_investment_features',
        name: 'Enable Investment Features',
        description: 'Access to investment and trading features',
        defaultValue: true,
        category: categoryInvestment,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_loan_services',
        name: 'Enable Loan Services',
        description: 'Access to loan application and management',
        defaultValue: true,
        category: categoryLoan,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_enable_chat_encryption',
        name: 'Enable Chat Encryption',
        description: 'Encrypt customer support chat messages',
        defaultValue: true,
        category: categoryPrivacy,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_share_usage_data',
        name: 'Share Usage Data',
        description: 'Share anonymous usage data to improve services',
        defaultValue: true,
        category: categoryPrivacy,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'bank_high_performance_mode',
        name: 'High Performance Mode',
        description: 'Enable high performance rendering and processing',
        defaultValue: false,
        category: categoryPerformance,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'bank_cache_size_limit',
        name: 'Cache Size Limit',
        description: 'Maximum cache size for the app',
        options: ['50MB', '100MB', '200MB', '500MB', '1GB'],
        defaultValue: '200MB',
        category: categoryPerformance,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'bank_network_timeout',
        name: 'Network Timeout',
        description: 'Timeout for network requests',
        options: ['15', '30', '60', '120'],
        defaultValue: '30',
        labels: {
          '15': '15 seconds',
          '30': '30 seconds',
          '60': '1 minute',
          '120': '2 minutes',
        },
        category: categoryPerformance,
        appId: appId,
      ),
    ];
  }
  
  /// Get Bank settings grouped by category
  static Map<String, List<SettingItem>> getBankSettingsByCategory() {
    final settings = getBankSettings();
    final Map<String, List<SettingItem>> grouped = {};

    for (final setting in settings) {
      final category = setting.category ?? 'other';
      grouped.putIfAbsent(category, () => []);
      grouped[category]!.add(setting);
    }

    return grouped;
  }
  
  /// Get Bank setting by key
  static SettingItem? getBankSetting(String key) {
    return getBankSettings().firstWhere(
      (setting) => setting.key == key,
      orElse: () => throw ArgumentError('Bank setting with key "$key" not found'),
    );
  }
  
  /// Check if a key is a Bank setting
  static bool isBankSetting(String key) {
    return getBankSettings().any((setting) => setting.key == key);
  }
  
  /// Get all Bank setting keys
  static List<String> getBankSettingKeys() {
    return getBankSettings().map((setting) => setting.key).toList();
  }
  
  /// Get default values for all Bank settings
  static Map<String, dynamic> getBankDefaults() {
    final Map<String, dynamic> defaults = {};
    for (final setting in getBankSettings()) {
      defaults[setting.key] = setting.defaultValue;
    }
    return defaults;
  }
  
  /// Get security-specific settings
  static List<SettingItem> getSecuritySettings() {
    return getBankSettings().where((setting) => 
      setting.category == categorySecurity
    ).toList();
  }
  
  /// Get transaction-specific settings
  static List<SettingItem> getTransactionSettings() {
    return getBankSettings().where((setting) => 
      setting.category == categoryTransactions
    ).toList();
  }
  
  /// Get notification-specific settings
  static List<SettingItem> getNotificationSettings() {
    return getBankSettings().where((setting) => 
      setting.category == categoryNotifications
    ).toList();
  }
  
  /// Get investment-specific settings
  static List<SettingItem> getInvestmentSettings() {
    return getBankSettings().where((setting) => 
      setting.category == categoryInvestment
    ).toList();
  }
  
  /// Get loan-specific settings
  static List<SettingItem> getLoanSettings() {
    return getBankSettings().where((setting) => 
      setting.category == categoryLoan
    ).toList();
  }
}
