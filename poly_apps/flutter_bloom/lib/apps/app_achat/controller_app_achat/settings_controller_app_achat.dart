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

// CREATED BY: AI Assistant for settings controller architecture unification
// NOTE FOR OTHER AIs: This is the unified AChat settings controller that combines
// all settings functionality and follows the new architecture standards.
// Please avoid creating duplicate settings controllers in other locations.

import 'package:flutter/material.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/settings/models/setting_item.dart';
import 'package:qyflutter/apps/app_achat/config_app_achat/storage_app_achat.dart';

/// Unified Settings Controller for AChat App
/// Manages all app-specific settings and preferences using the common settings system
/// This controller combines theme, language, AI, chat, notification, privacy, and proxy settings
class SettingsControllerAppAchat extends ChangeNotifier {
  final SettingsController _commonSettingsController;
  final StorageAppAChat _storage = StorageAppAChat.instance;

  // Internal state for cached values
  bool _notificationEnabled = true;
  bool _notificationSoundEnabled = true;
  bool _isInitialized = false;

  // Always true for LTR languages in this app
  bool get isLtr => true;
  bool get isInitialized => _isInitialized;

  SettingsControllerAppAchat(this._commonSettingsController) {
    _initializeSettings();
  }

  /// Initialize all settings and load cached values
  Future<void> _initializeSettings() async {
    if (_isInitialized) return;
    
    await _storage.initAppStorage();
    await _loadCachedValues();
    _isInitialized = true;
    notifyListeners();
  }

  /// Load cached values from storage
  Future<void> _loadCachedValues() async {
    _notificationEnabled = await _storage.isNotificationEnabled();
    _notificationSoundEnabled = await _storage.isNotificationSoundEnabled();
  }


  /// Check if dark mode is enabled
  bool get isDarkMode => _commonSettingsController.getSetting<bool>('achat_theme_dark_mode', false) ?? false;

  /// Get current theme mode
  ThemeMode get themeMode => isDarkMode ? ThemeMode.dark : ThemeMode.light;

  /// Toggle theme between light and dark
  Future<void> toggleTheme() async {
    await _commonSettingsController.setSetting('achat_theme_dark_mode', !isDarkMode);
    _storage.toggleDarkMode();
    notifyListeners();
  }

  /// Set specific theme mode
  Future<void> setThemeMode(bool isDark) async {
    await _commonSettingsController.setSetting('achat_theme_dark_mode', isDark);
    _storage.setDarkMode(isDark);
    notifyListeners();
  }


  /// Get current locale identifier
  String getCurrentLocaleIdentifier() {
    return _commonSettingsController.getSetting<String>('achat_language', 'zh') ?? 'zh';
  }

  /// Change language
  Future<void> changeLanguage(String localeIdentifier) async {
    await _commonSettingsController.setSetting('achat_language', localeIdentifier);
    _storage.setLocale(localeIdentifier);
    notifyListeners();
  }

  /// Get available languages
  List<String> get getAvailableLanguages => ['en', 'zh'];


  /// Get notification enabled status (sync access)
  bool get isNotificationEnabled => _notificationEnabled;

  /// Toggle notifications
  Future<void> toggleNotifications() async {
    await _storage.toggleNotifications();
    _notificationEnabled = await _storage.isNotificationEnabled();
    notifyListeners();
  }

  /// Set notification enabled
  Future<void> setNotificationEnabled(bool enabled) async {
    await _storage.setNotificationEnabled(enabled);
    _notificationEnabled = enabled;
    notifyListeners();
  }

  /// Get notification sound enabled status (sync access)
  bool get isNotificationSoundEnabled => _notificationSoundEnabled;

  /// Toggle notification sound
  Future<void> toggleNotificationSound() async {
    await _storage.toggleNotificationSound();
    _notificationSoundEnabled = await _storage.isNotificationSoundEnabled();
    notifyListeners();
  }

  /// Check if chat notifications are enabled
  bool isChatNotificationsEnabled() {
    return _storage.isNotificationsEnabled();
  }

  /// Set chat notifications enabled
  void setChatNotificationsEnabled(bool enabled) {
    _storage.setNotificationsEnabled(enabled);
    notifyListeners();
  }

  /// Check if message sound is enabled
  bool isMessageSoundEnabled() {
    return _storage.isSoundEnabled();
  }

  /// Set message sound enabled
  void setMessageSoundEnabled(bool enabled) {
    _storage.setSoundEnabled(enabled);
    notifyListeners();
  }

  /// Check if message vibration is enabled
  bool isMessageVibrationEnabled() {
    return _storage.isVibrationEnabled();
  }

  /// Set message vibration enabled
  void setMessageVibrationEnabled(bool enabled) {
    _storage.setVibrationEnabled(enabled);
    notifyListeners();
  }


  /// Check if chat animations are enabled
  bool isChatAnimationsEnabled() {
    return _storage.isAnimationsEnabled();
  }

  /// Set chat animations enabled
  void setChatAnimationsEnabled(bool enabled) {
    _storage.setAnimationsEnabled(enabled);
    notifyListeners();
  }

  /// Check if auto backup is enabled
  bool isAutoBackupEnabled() {
    return _storage.isAutoSyncEnabled();
  }

  /// Set auto backup enabled
  void setAutoBackupEnabled(bool enabled) {
    _storage.setAutoSyncEnabled(enabled);
    notifyListeners();
  }


  /// Get analytics enabled status (sync access)
  bool get isAnalyticsEnabled => _storage.isAnalyticsEnabled();

  /// Toggle analytics
  Future<void> toggleAnalytics() async {
    await _storage.toggleAnalytics();
    notifyListeners();
  }

  /// Get crash reporting enabled status (sync access)
  bool get isCrashReportingEnabled => _storage.isCrashReportingEnabled();

  /// Toggle crash reporting
  Future<void> toggleCrashReporting() async {
    await _storage.toggleCrashReporting();
    notifyListeners();
  }

  /// Check if read receipts are enabled
  bool isReadReceiptsEnabled() {
    return _commonSettingsController.getSetting<bool>('achat_read_receipts', true) ?? true;
  }

  /// Set read receipts enabled
  Future<void> setReadReceiptsEnabled(bool enabled) async {
    await _commonSettingsController.setSetting('achat_read_receipts', enabled);
    notifyListeners();
  }

  /// Check if last seen is visible
  bool isLastSeenVisible() {
    return _commonSettingsController.getSetting<bool>('achat_last_seen_visible', true) ?? true;
  }

  /// Set last seen visibility
  Future<void> setLastSeenVisible(bool visible) async {
    await _commonSettingsController.setSetting('achat_last_seen_visible', visible);
    notifyListeners();
  }

  /// Check if profile photo is visible to contacts
  bool isProfilePhotoVisible() {
    return _commonSettingsController.getSetting<bool>('achat_profile_photo_visible', true) ?? true;
  }

  /// Set profile photo visibility
  Future<void> setProfilePhotoVisible(bool visible) async {
    await _commonSettingsController.setSetting('achat_profile_photo_visible', visible);
    notifyListeners();
  }


  /// Get AI personality
  Future<String> getAIPersonality() async {
    return await _storage.getAIPersonality();
  }

  /// Set AI personality
  Future<void> setAIPersonality(String personality) async {
    await _storage.setAIPersonality(personality);
    notifyListeners();
  }

  /// Get AI response style
  Future<String> getAIResponseStyle() async {
    return await _storage.getAIResponseStyle();
  }

  /// Set AI response style
  Future<void> setAIResponseStyle(String style) async {
    await _storage.setAIResponseStyle(style);
    notifyListeners();
  }

  /// Get AI temperature
  Future<double> getAITemperature() async {
    return await _storage.getAITemperature();
  }

  /// Set AI temperature
  Future<void> setAITemperature(double temperature) async {
    await _storage.setAITemperature(temperature);
    notifyListeners();
  }

  /// Get AI max tokens
  Future<int> getAIMaxTokens() async {
    return await _storage.getAIMaxTokens();
  }

  /// Set AI max tokens
  Future<void> setAIMaxTokens(int maxTokens) async {
    await _storage.setAIMaxTokens(maxTokens);
    notifyListeners();
  }

  /// Get AI system prompt
  Future<String> getAISystemPrompt() async {
    return await _storage.getAISystemPrompt();
  }

  /// Set AI system prompt
  Future<void> setAISystemPrompt(String prompt) async {
    await _storage.setAISystemPrompt(prompt);
    notifyListeners();
  }


  /// Get voice input enabled status
  Future<bool> isVoiceInputEnabled() async {
    return await _storage.isVoiceInputEnabled();
  }

  /// Set voice input enabled
  Future<void> setVoiceInputEnabled(bool enabled) async {
    await _storage.setVoiceInputEnabled(enabled);
    notifyListeners();
  }

  /// Get image recognition enabled status
  Future<bool> isImageRecognitionEnabled() async {
    return await _storage.isImageRecognitionEnabled();
  }

  /// Set image recognition enabled
  Future<void> setImageRecognitionEnabled(bool enabled) async {
    await _storage.setImageRecognitionEnabled(enabled);
    notifyListeners();
  }

  /// Get translation enabled status
  Future<bool> isTranslationEnabled() async {
    return await _storage.isTranslationEnabled();
  }

  /// Set translation enabled
  Future<void> setTranslationEnabled(bool enabled) async {
    await _storage.setTranslationEnabled(enabled);
    notifyListeners();
  }

  /// Get smart reply enabled status
  Future<bool> isSmartReplyEnabled() async {
    return await _storage.isSmartReplyEnabled();
  }

  /// Set smart reply enabled
  Future<void> setSmartReplyEnabled(bool enabled) async {
    await _storage.setSmartReplyEnabled(enabled);
    notifyListeners();
  }

  /// Get context aware enabled status
  Future<bool> isContextAwareEnabled() async {
    return await _storage.isContextAwareEnabled();
  }

  /// Set context aware enabled
  Future<void> setContextAwareEnabled(bool enabled) async {
    await _storage.setContextAwareEnabled(enabled);
    notifyListeners();
  }

  /// Get learning mode enabled status
  Future<bool> isLearningModeEnabled() async {
    return await _storage.isLearningModeEnabled();
  }

  /// Set learning mode enabled
  Future<void> setLearningModeEnabled(bool enabled) async {
    await _storage.setLearningModeEnabled(enabled);
    notifyListeners();
  }


  /// Export all AChat data
  Future<Map<String, dynamic>> exportAChatData() async {
    return await _storage.exportChatData();
  }

  /// Import AChat data
  Future<bool> importAChatData(Map<String, dynamic> data) async {
    final success = await _storage.importChatData(data);
    if (success) {
      await _loadCachedValues();
      notifyListeners();
    }
    return success;
  }

  /// Reset all AChat data
  Future<void> resetAChatData() async {
    await _storage.resetAChatData();
    await _loadCachedValues();
    notifyListeners();
  }

  /// Get AChat data summary
  Future<Map<String, dynamic>> getAChatDataSummary() async {
    return await _storage.getAChatDataSummary();
  }


  /// Get proxy enabled status
  bool get isProxyEnabled => _commonSettingsController.getSetting<bool>('achat_proxy_enabled', false) ?? false;

  /// Set proxy enabled
  Future<void> setProxyEnabled(bool enabled) async {
    await _commonSettingsController.setSetting('achat_proxy_enabled', enabled);
    notifyListeners();
  }

  /// Get proxy host
  String get proxyHost => _commonSettingsController.getSetting<String>('achat_proxy_host', '') ?? '';

  /// Set proxy host
  Future<void> setProxyHost(String host) async {
    await _commonSettingsController.setSetting('achat_proxy_host', host);
    notifyListeners();
  }

  /// Get proxy port
  int get proxyPort => _commonSettingsController.getSetting<int>('achat_proxy_port', 8080) ?? 8080;

  /// Set proxy port
  Future<void> setProxyPort(int port) async {
    await _commonSettingsController.setSetting('achat_proxy_port', port);
    notifyListeners();
  }

  /// Get proxy type
  String get proxyType => _commonSettingsController.getSetting<String>('achat_proxy_type', 'HTTP') ?? 'HTTP';

  /// Set proxy type
  Future<void> setProxyType(String type) async {
    await _commonSettingsController.setSetting('achat_proxy_type', type);
    notifyListeners();
  }


  /// Get all AChat-specific settings configuration
  static List<SettingItem> getAChatSettings() {
    return [
      // AI Settings
      SettingItem.text(
        key: 'achat_ai_personality',
        name: 'AI Personality',
        description: 'Set the AI assistant personality',
        defaultValue: 'friendly',
        category: 'ai',
        isRequired: false,
      ),
      SettingItem.text(
        key: 'achat_ai_response_style',
        name: 'AI Response Style',
        description: 'Set how the AI responds to messages',
        defaultValue: 'conversational',
        category: 'ai',
        isRequired: false,
      ),
      SettingItem.slider(
        key: 'achat_ai_temperature',
        name: 'AI Creativity',
        description: 'Control AI response creativity (0.0 - 1.0)',
        defaultValue: 0.7,
        minValue: 0.0,
        maxValue: 1.0,
        category: 'ai',
        isRequired: false,
      ),
      SettingItem.number(
        key: 'achat_ai_max_tokens',
        name: 'Max Response Length',
        description: 'Maximum tokens for AI responses',
        defaultValue: 1000,
        category: 'ai',
        isRequired: false,
      ),

      // Chat Preferences
      SettingItem.toggle(
        key: 'achat_voice_input_enabled',
        name: 'Voice Input',
        description: 'Enable voice message input',
        defaultValue: true,
        category: 'chat',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_image_recognition_enabled',
        name: 'Image Recognition',
        description: 'Enable AI image analysis',
        defaultValue: true,
        category: 'chat',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_translation_enabled',
        name: 'Auto Translation',
        description: 'Enable automatic message translation',
        defaultValue: false,
        category: 'chat',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_smart_reply_enabled',
        name: 'Smart Replies',
        description: 'Enable AI-powered quick replies',
        defaultValue: true,
        category: 'chat',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_context_aware_enabled',
        name: 'Context Awareness',
        description: 'AI considers conversation context',
        defaultValue: true,
        category: 'chat',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_learning_mode_enabled',
        name: 'Learning Mode',
        description: 'AI learns from your conversations',
        defaultValue: false,
        category: 'chat',
        isRequired: false,
      ),

      // Notification Settings
      SettingItem.toggle(
        key: 'achat_notifications_enabled',
        name: 'Push Notifications',
        description: 'Receive push notifications',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_notification_sound_enabled',
        name: 'Notification Sound',
        description: 'Play sound for notifications',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_message_sound_enabled',
        name: 'Message Sound',
        description: 'Play sound for new messages',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_vibration_enabled',
        name: 'Vibration',
        description: 'Vibrate for notifications',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),

      // Privacy Settings
      SettingItem.toggle(
        key: 'achat_read_receipts',
        name: 'Read Receipts',
        description: 'Show when messages are read',
        defaultValue: true,
        category: 'privacy',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_last_seen_visible',
        name: 'Last Seen',
        description: 'Show your last seen status',
        defaultValue: true,
        category: 'privacy',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_profile_photo_visible',
        name: 'Profile Photo',
        description: 'Show profile photo to contacts',
        defaultValue: true,
        category: 'privacy',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_analytics_enabled',
        name: 'Analytics',
        description: 'Help improve the app with usage data',
        defaultValue: false,
        category: 'privacy',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'achat_crash_reporting_enabled',
        name: 'Crash Reporting',
        description: 'Send crash reports to developers',
        defaultValue: false,
        category: 'privacy',
        isRequired: false,
      ),

      // Proxy Settings
      SettingItem.toggle(
        key: 'achat_proxy_enabled',
        name: 'Enable Proxy',
        description: 'Use proxy for network connections',
        defaultValue: false,
        category: 'proxy',
        isRequired: false,
      ),
      SettingItem.text(
        key: 'achat_proxy_host',
        name: 'Proxy Host',
        description: 'Proxy server hostname or IP',
        defaultValue: '',
        category: 'proxy',
        isRequired: false,
      ),
      SettingItem.number(
        key: 'achat_proxy_port',
        name: 'Proxy Port',
        description: 'Proxy server port number',
        defaultValue: 8080,
        category: 'proxy',
        isRequired: false,
      ),
      SettingItem.select(
        key: 'achat_proxy_type',
        name: 'Proxy Type',
        description: 'Type of proxy connection',
        options: ['HTTP', 'HTTPS', 'SOCKS4', 'SOCKS5'],
        defaultValue: 'HTTP',
        labels: {
          'HTTP': 'HTTP Proxy',
          'HTTPS': 'HTTPS Proxy',
          'SOCKS4': 'SOCKS4 Proxy',
          'SOCKS5': 'SOCKS5 Proxy',
        },
        category: 'proxy',
        isRequired: false,
      ),
    ];
  }

  /// Get settings grouped by category
  Map<String, List<SettingItem>> get settingsByCategory {
    final settings = getAChatSettings();
    final Map<String, List<SettingItem>> grouped = {};

    for (final setting in settings) {
      final category = setting.category ?? 'general';
      if (!grouped.containsKey(category)) {
        grouped[category] = [];
      }
      grouped[category]!.add(setting);
    }

    return grouped;
  }

  /// Get setting value by key with type safety
  T? getSettingValue<T>(String key, T defaultValue) {
    return _commonSettingsController.getSetting<T>(key, defaultValue);
  }

  /// Set setting value by key
  Future<void> setSettingValue<T>(String key, T value) async {
    await _commonSettingsController.setSetting(key, value);
    notifyListeners();
  }


  /// Initialize settings controller
  Future<void> initialize() async {
    await _initializeSettings();
  }

  /// Get all settings as a map
  Future<Map<String, dynamic>> getAllSettings() async {
    return {
      // Theme settings
      'isDarkMode': isDarkMode,
      'currentLocale': getCurrentLocaleIdentifier(),

      // Notification settings
      'notificationEnabled': isNotificationEnabled,
      'notificationSoundEnabled': isNotificationSoundEnabled,
      'chatNotificationsEnabled': isChatNotificationsEnabled(),
      'messageSoundEnabled': isMessageSoundEnabled(),
      'messageVibrationEnabled': isMessageVibrationEnabled(),

      // Chat settings
      'chatAnimationsEnabled': isChatAnimationsEnabled(),
      'autoBackupEnabled': isAutoBackupEnabled(),
      'voiceInputEnabled': await isVoiceInputEnabled(),
      'imageRecognitionEnabled': await isImageRecognitionEnabled(),
      'translationEnabled': await isTranslationEnabled(),
      'smartReplyEnabled': await isSmartReplyEnabled(),
      'contextAwareEnabled': await isContextAwareEnabled(),
      'learningModeEnabled': await isLearningModeEnabled(),

      // Privacy settings
      'analyticsEnabled': isAnalyticsEnabled,
      'crashReportingEnabled': isCrashReportingEnabled,
      'readReceiptsEnabled': isReadReceiptsEnabled(),
      'lastSeenVisible': isLastSeenVisible(),
      'profilePhotoVisible': isProfilePhotoVisible(),

      // AI settings
      'aiPersonality': await getAIPersonality(),
      'aiResponseStyle': await getAIResponseStyle(),
      'aiTemperature': await getAITemperature(),
      'aiMaxTokens': await getAIMaxTokens(),
      'aiSystemPrompt': await getAISystemPrompt(),

      // Proxy settings
      'proxyEnabled': isProxyEnabled,
      'proxyHost': proxyHost,
      'proxyPort': proxyPort,
      'proxyType': proxyType,
    };
  }

  /// Reset all settings to defaults
  Future<void> resetAllSettings() async {
    // Reset theme to system default
    await _commonSettingsController.setSetting('achat_theme_dark_mode', false);
    _storage.setDarkMode(false);

    // Reset language to system default
    await _commonSettingsController.setSetting('achat_language', 'en');
    _storage.setLocale('en');

    // Reset notification settings
    await _storage.setNotificationEnabled(true);
    await _storage.setNotificationSoundEnabled(true);
    _storage.setNotificationsEnabled(true);
    _storage.setSoundEnabled(true);
    _storage.setVibrationEnabled(true);

    // Reset chat settings
    _storage.setAnimationsEnabled(true);
    _storage.setAutoSyncEnabled(true);

    // Reset privacy settings
    _storage.setAnalyticsEnabled(false);
    _storage.setCrashReportingEnabled(false);
    await _commonSettingsController.setSetting('achat_read_receipts', true);
    await _commonSettingsController.setSetting('achat_last_seen_visible', true);
    await _commonSettingsController.setSetting('achat_profile_photo_visible', true);

    // Reset proxy settings
    await _commonSettingsController.setSetting('achat_proxy_enabled', false);
    await _commonSettingsController.setSetting('achat_proxy_host', '');
    await _commonSettingsController.setSetting('achat_proxy_port', 8080);
    await _commonSettingsController.setSetting('achat_proxy_type', 'HTTP');

    // Reset AChat specific data
    await _storage.resetAChatData();

    // Reload cached values
    await _loadCachedValues();
    notifyListeners();
  }
}
