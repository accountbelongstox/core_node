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

/// AChat App Settings
/// Provides app-specific settings following the unified architecture
/// All setting keys must have 'achat_' prefix as per specification
class AChatAppSettings {
  static const String appId = 'achat';
  
  // Category constants
  static const String categoryGeneral = 'achat_general';
  static const String categoryChat = 'achat_chat';
  static const String categoryProxy = 'achat_proxy';
  static const String categoryPrivacy = 'achat_privacy';
  static const String categoryPerformance = 'achat_performance';
  static const String categoryNotifications = 'achat_notifications';
  
  /// Get all AChat app settings
  static List<SettingItem> getAChatSettings() {
    return [
      SettingItem.toggle(
        key: 'achat_enable_analytics',
        name: 'Enable Analytics',
        description: 'Allow anonymous usage analytics to improve the app',
        defaultValue: true,
        category: categoryGeneral,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_enable_crash_reporting',
        name: 'Enable Crash Reporting',
        description: 'Automatically send crash reports to help improve stability',
        defaultValue: true,
        category: categoryGeneral,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_enable_offline_mode',
        name: 'Enable Offline Mode',
        description: 'Allow the app to work without internet connection',
        defaultValue: true,
        category: categoryGeneral,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_enable_biometric_auth',
        name: 'Enable Biometric Authentication',
        description: 'Use fingerprint or face recognition for app access',
        defaultValue: false,
        category: categoryGeneral,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'achat_default_chat_model',
        name: 'Default Chat Model',
        description: 'Choose the default AI model for conversations',
        options: ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-pro'],
        defaultValue: 'gpt-3.5-turbo',
        labels: {
          'gpt-4': 'GPT-4 (Most Capable)',
          'gpt-3.5-turbo': 'GPT-3.5 Turbo (Balanced)',
          'claude-3': 'Claude 3 (Creative)',
          'gemini-pro': 'Gemini Pro (Fast)',
        },
        category: categoryChat,
        appId: appId,
      ),
      
      SettingItem.slider(
        key: 'achat_max_message_length',
        name: 'Maximum Message Length',
        description: 'Set the maximum length for chat messages',
        defaultValue: 1000.0,
        minValue: 100.0,
        maxValue: 5000.0,
        category: categoryChat,
        appId: appId,
      ),
      
      SettingItem.slider(
        key: 'achat_max_history_items',
        name: 'Chat History Limit',
        description: 'Maximum number of chat history items to keep',
        defaultValue: 100.0,
        minValue: 10.0,
        maxValue: 1000.0,
        category: categoryChat,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_enable_voice_input',
        name: 'Enable Voice Input',
        description: 'Allow voice-to-text input for chat messages',
        defaultValue: true,
        category: categoryChat,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_enable_image_generation',
        name: 'Enable Image Generation',
        description: 'Allow AI-powered image generation features',
        defaultValue: false,
        category: categoryChat,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'achat_typing_indicator_delay',
        name: 'Typing Indicator Delay',
        description: 'Delay before showing typing indicator',
        options: ['0', '300', '500', '1000'],
        defaultValue: '500',
        labels: {
          '0': 'Immediate',
          '300': '300ms',
          '500': '500ms',
          '1000': '1 second',
        },
        category: categoryChat,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'send_message_enabled',
        name: 'Enable Send Message',
        description: 'Enable send message button functionality in chat details',
        defaultValue: false,
        category: categoryChat,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_proxy_enabled',
        name: 'Enable Proxy',
        description: 'Use proxy server for network connections',
        defaultValue: false,
        category: categoryProxy,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_proxy_call_enabled',
        name: 'Enable Proxy for Calls',
        description: 'Use proxy server for voice and video calls',
        defaultValue: false,
        category: categoryProxy,
        appId: appId,
      ),
      
      SettingItem.text(
        key: 'achat_proxy_host',
        name: 'Proxy Host',
        description: 'Proxy server hostname or IP address',
        defaultValue: '',
        category: categoryProxy,
        placeholder: 'Enter proxy host (e.g., 192.168.1.100)',
        appId: appId,
      ),
      
      SettingItem.number(
        key: 'achat_proxy_port',
        name: 'Proxy Port',
        description: 'Proxy server port number',
        defaultValue: 8080,
        category: categoryProxy,
        minIntValue: 1,
        maxIntValue: 65535,
        placeholder: 'Enter port number',
        appId: appId,
      ),
      
      SettingItem.text(
        key: 'achat_proxy_username',
        name: 'Proxy Username',
        description: 'Username for proxy authentication (if required)',
        defaultValue: '',
        category: categoryProxy,
        placeholder: 'Enter proxy username',
        appId: appId,
      ),
      
      SettingItem.text(
        key: 'achat_proxy_password',
        name: 'Proxy Password',
        description: 'Password for proxy authentication (if required)',
        defaultValue: '',
        category: categoryProxy,
        placeholder: 'Enter proxy password',
        appId: appId,
        disableCache: true, // Don't cache passwords for security
      ),
      
      SettingItem.select(
        key: 'achat_proxy_type',
        name: 'Proxy Type',
        description: 'Type of proxy server',
        options: ['HTTP', 'HTTPS', 'SOCKS4', 'SOCKS5'],
        defaultValue: 'HTTP',
        labels: {
          'HTTP': 'HTTP Proxy',
          'HTTPS': 'HTTPS Proxy',
          'SOCKS4': 'SOCKS4 Proxy',
          'SOCKS5': 'SOCKS5 Proxy',
        },
        category: categoryProxy,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_enable_chat_encryption',
        name: 'Enable Chat Encryption',
        description: 'Encrypt chat messages for enhanced privacy',
        defaultValue: true,
        category: categoryPrivacy,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_auto_delete_messages',
        name: 'Auto Delete Messages',
        description: 'Automatically delete old chat messages',
        defaultValue: false,
        category: categoryPrivacy,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'achat_message_retention_days',
        name: 'Message Retention Period',
        description: 'Number of days to keep chat messages',
        options: ['1', '7', '30', '90', '365'],
        defaultValue: '30',
        labels: {
          '1': '1 day',
          '7': '1 week',
          '30': '1 month',
          '90': '3 months',
          '365': '1 year',
        },
        category: categoryPrivacy,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_share_usage_data',
        name: 'Share Usage Data',
        description: 'Share anonymous usage data to improve AI responses',
        defaultValue: true,
        category: categoryPrivacy,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_high_performance_mode',
        name: 'High Performance Mode',
        description: 'Enable high performance rendering and processing',
        defaultValue: false,
        category: categoryPerformance,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'achat_cache_size_limit',
        name: 'Cache Size Limit',
        description: 'Maximum cache size for the app',
        options: ['50MB', '100MB', '200MB', '500MB', '1GB'],
        defaultValue: '200MB',
        category: categoryPerformance,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_enable_background_processing',
        name: 'Enable Background Processing',
        description: 'Allow AI processing to continue in background',
        defaultValue: true,
        category: categoryPerformance,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'achat_network_timeout',
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
      
      SettingItem.toggle(
        key: 'achat_enable_push_notifications',
        name: 'Enable Push Notifications',
        description: 'Receive push notifications for new messages',
        defaultValue: true,
        category: categoryNotifications,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_enable_sound_notifications',
        name: 'Enable Sound Notifications',
        description: 'Play sound for new message notifications',
        defaultValue: true,
        category: categoryNotifications,
        appId: appId,
      ),
      
      SettingItem.toggle(
        key: 'achat_enable_vibration_notifications',
        name: 'Enable Vibration Notifications',
        description: 'Vibrate device for new message notifications',
        defaultValue: true,
        category: categoryNotifications,
        appId: appId,
      ),
      
      SettingItem.select(
        key: 'achat_notification_sound',
        name: 'Notification Sound',
        description: 'Choose notification sound',
        options: ['default', 'chime', 'bell', 'ding', 'none'],
        defaultValue: 'default',
        labels: {
          'default': 'Default',
          'chime': 'Chime',
          'bell': 'Bell',
          'ding': 'Ding',
          'none': 'No Sound',
        },
        category: categoryNotifications,
        appId: appId,
      ),
    ];
  }
  
  /// Get AChat settings grouped by category
  static Map<String, List<SettingItem>> getAChatSettingsByCategory() {
    final settings = getAChatSettings();
    final Map<String, List<SettingItem>> grouped = {};

    for (final setting in settings) {
      final category = setting.category ?? 'other';
      grouped.putIfAbsent(category, () => []);
      grouped[category]!.add(setting);
    }

    return grouped;
  }
  
  /// Get AChat setting by key
  static SettingItem? getAChatSetting(String key) {
    return getAChatSettings().firstWhere(
      (setting) => setting.key == key,
      orElse: () => throw ArgumentError('AChat setting with key "$key" not found'),
    );
  }
  
  /// Check if a key is an AChat setting
  static bool isAChatSetting(String key) {
    return getAChatSettings().any((setting) => setting.key == key);
  }
  
  /// Get all AChat setting keys
  static List<String> getAChatSettingKeys() {
    return getAChatSettings().map((setting) => setting.key).toList();
  }
  
  /// Get default values for all AChat settings
  static Map<String, dynamic> getAChatDefaults() {
    final Map<String, dynamic> defaults = {};
    for (final setting in getAChatSettings()) {
      defaults[setting.key] = setting.defaultValue;
    }
    return defaults;
  }
  
  /// Get proxy-specific settings
  static List<SettingItem> getProxySettings() {
    return getAChatSettings().where((setting) => 
      setting.category == categoryProxy
    ).toList();
  }
  
  /// Get chat-specific settings
  static List<SettingItem> getChatSettings() {
    return getAChatSettings().where((setting) => 
      setting.category == categoryChat
    ).toList();
  }
  
  /// Get privacy-specific settings
  static List<SettingItem> getPrivacySettings() {
    return getAChatSettings().where((setting) => 
      setting.category == categoryPrivacy
    ).toList();
  }
}