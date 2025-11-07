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

import 'package:qyflutter/common/storage/app_storage_base.dart';

/// AChat app specific storage implementation
/// Extends AppStorageBaseImpl with AChat-specific functionality
class StorageAppAChat extends AppStorageBaseImpl {
  static final StorageAppAChat _instance = StorageAppAChat._internal();
  static StorageAppAChat get instance => _instance;

  StorageAppAChat._internal();

  @override
  String get appBox => 'achat_storage';

  @override
  String get cacheNamespace => 'achat';

  @override
  Future<void> initAppStorage() async {
    // AChat-specific initialization
    // Base class handles UnifiedStorage.init()
  }

  /// Chat history management
  Future<List<Map<String, dynamic>>> getChatHistory() async {
    return await getApp<List<Map<String, dynamic>>>('chat_history') ?? [];
  }

  Future<void> addChatMessage(Map<String, dynamic> message) async {
    final history = await getChatHistory();
    history.add(message);
    await setApp<List<Map<String, dynamic>>>('chat_history', history);
  }

  Future<void> clearChatHistory() async {
    await setApp<List<Map<String, dynamic>>>('chat_history', []);
  }

  Future<void> deleteChatMessage(String messageId) async {
    final history = await getChatHistory();
    history.removeWhere((message) => message['id'] == messageId);
    await setApp<List<Map<String, dynamic>>>('chat_history', history);
  }

  /// AI Assistant settings
  Future<String> getAIPersonality() async {
    return await getApp<String>('ai_personality') ?? 'helpful';
  }

  Future<void> setAIPersonality(String personality) async {
    await setApp<String>('ai_personality', personality);
  }

  Future<String> getAIResponseStyle() async {
    return await getApp<String>('ai_response_style') ?? 'conversational';
  }

  Future<void> setAIResponseStyle(String style) async {
    await setApp<String>('ai_response_style', style);
  }

  Future<double> getAITemperature() async {
    return await getApp<double>('ai_temperature') ?? 0.7;
  }

  Future<void> setAITemperature(double temperature) async {
    await setApp<double>('ai_temperature', temperature);
  }

  Future<int> getAIMaxTokens() async {
    return await getApp<int>('ai_max_tokens') ?? 2048;
  }

  Future<void> setAIMaxTokens(int maxTokens) async {
    await setApp<int>('ai_max_tokens', maxTokens);
  }

  Future<String> getAISystemPrompt() async {
    return await getApp<String>('ai_system_prompt') ??
        'You are a helpful AI assistant. Be concise and accurate.';
  }

  Future<void> setAISystemPrompt(String prompt) async {
    await setApp<String>('ai_system_prompt', prompt);
  }

  Future<List<String>> getAICustomInstructions() async {
    return await getApp<List<String>>('ai_custom_instructions') ?? [];
  }

  Future<void> setAICustomInstructions(List<String> instructions) async {
    await setApp<List<String>>('ai_custom_instructions', instructions);
  }

  /// Chat preferences
  Future<bool> isVoiceInputEnabled() async {
    return await getApp<bool>('voice_input_enabled') ?? true;
  }

  Future<void> setVoiceInputEnabled(bool enabled) async {
    await setApp<bool>('voice_input_enabled', enabled);
  }

  Future<bool> isImageRecognitionEnabled() async {
    return await getApp<bool>('image_recognition_enabled') ?? true;
  }

  Future<void> setImageRecognitionEnabled(bool enabled) async {
    await setApp<bool>('image_recognition_enabled', enabled);
  }

  Future<bool> isTranslationEnabled() async {
    return await getApp<bool>('translation_enabled') ?? false;
  }

  Future<void> setTranslationEnabled(bool enabled) async {
    await setApp<bool>('translation_enabled', enabled);
  }

  Future<bool> isSmartReplyEnabled() async {
    return await getApp<bool>('smart_reply_enabled') ?? true;
  }

  Future<void> setSmartReplyEnabled(bool enabled) async {
    await setApp<bool>('smart_reply_enabled', enabled);
  }

  Future<bool> isContextAwareEnabled() async {
    return await getApp<bool>('context_aware_enabled') ?? true;
  }

  Future<void> setContextAwareEnabled(bool enabled) async {
    await setApp<bool>('context_aware_enabled', enabled);
  }

  Future<bool> isLearningModeEnabled() async {
    return await getApp<bool>('learning_mode_enabled') ?? false;
  }

  Future<void> setLearningModeEnabled(bool enabled) async {
    await setApp<bool>('learning_mode_enabled', enabled);
  }

  /// Chat sessions management
  Future<List<Map<String, dynamic>>> getChatSessions() async {
    return await getApp<List<Map<String, dynamic>>>('chat_sessions') ?? [];
  }

  Future<void> addChatSession(Map<String, dynamic> session) async {
    final sessions = await getChatSessions();
    sessions.add(session);
    await setApp<List<Map<String, dynamic>>>('chat_sessions', sessions);
  }

  Future<void> deleteChatSession(String sessionId) async {
    final sessions = await getChatSessions();
    sessions.removeWhere((session) => session['id'] == sessionId);
    await setApp<List<Map<String, dynamic>>>('chat_sessions', sessions);
  }

  Future<void> updateChatSession(
      String sessionId, Map<String, dynamic> updates) async {
    final sessions = await getChatSessions();
    final index = sessions.indexWhere((session) => session['id'] == sessionId);
    if (index != -1) {
      sessions[index] = {...sessions[index], ...updates};
      await setApp<List<Map<String, dynamic>>>('chat_sessions', sessions);
    }
  }

  /// Favorites and bookmarks
  Future<List<String>> getFavoriteMessages() async {
    return await getApp<List<String>>('favorite_messages') ?? [];
  }

  Future<void> addFavoriteMessage(String messageId) async {
    final favorites = await getFavoriteMessages();
    if (!favorites.contains(messageId)) {
      favorites.add(messageId);
      await setApp<List<String>>('favorite_messages', favorites);
    }
  }

  Future<void> removeFavoriteMessage(String messageId) async {
    final favorites = await getFavoriteMessages();
    favorites.remove(messageId);
    await setApp<List<String>>('favorite_messages', favorites);
  }

  Future<bool> isFavoriteMessage(String messageId) async {
    final favorites = await getFavoriteMessages();
    return favorites.contains(messageId);
  }

  /// Export and import functionality
  Future<Map<String, dynamic>> exportChatData() async {
    return {
      'chat_history': await getChatHistory(),
      'chat_sessions': await getChatSessions(),
      'favorite_messages': await getFavoriteMessages(),
      'ai_settings': {
        'personality': await getAIPersonality(),
        'response_style': await getAIResponseStyle(),
        'temperature': await getAITemperature(),
        'max_tokens': await getAIMaxTokens(),
        'system_prompt': await getAISystemPrompt(),
        'custom_instructions': await getAICustomInstructions(),
      },
      'preferences': {
        'voice_input_enabled': await isVoiceInputEnabled(),
        'image_recognition_enabled': await isImageRecognitionEnabled(),
        'translation_enabled': await isTranslationEnabled(),
        'smart_reply_enabled': await isSmartReplyEnabled(),
        'context_aware_enabled': await isContextAwareEnabled(),
        'learning_mode_enabled': await isLearningModeEnabled(),
      },
      'export_time': DateTime.now().toIso8601String(),
    };
  }

  Future<bool> importChatData(Map<String, dynamic> data) async {
    try {
      if (data['chat_history'] != null) {
        await setApp<List<Map<String, dynamic>>>('chat_history',
            List<Map<String, dynamic>>.from(data['chat_history']));
      }

      if (data['chat_sessions'] != null) {
        await setApp<List<Map<String, dynamic>>>('chat_sessions',
            List<Map<String, dynamic>>.from(data['chat_sessions']));
      }

      if (data['favorite_messages'] != null) {
        await setApp<List<String>>(
            'favorite_messages', List<String>.from(data['favorite_messages']));
      }

      if (data['ai_settings'] != null) {
        final aiSettings = data['ai_settings'] as Map<String, dynamic>;
        if (aiSettings['personality'] != null) {
          await setAIPersonality(aiSettings['personality']);
        }
        if (aiSettings['response_style'] != null) {
          await setAIResponseStyle(aiSettings['response_style']);
        }
        if (aiSettings['temperature'] != null) {
          await setAITemperature(aiSettings['temperature'].toDouble());
        }
        if (aiSettings['max_tokens'] != null) {
          await setAIMaxTokens(aiSettings['max_tokens']);
        }
        if (aiSettings['system_prompt'] != null) {
          await setAISystemPrompt(aiSettings['system_prompt']);
        }
        if (aiSettings['custom_instructions'] != null) {
          await setAICustomInstructions(
              List<String>.from(aiSettings['custom_instructions']));
        }
      }

      if (data['preferences'] != null) {
        final preferences = data['preferences'] as Map<String, dynamic>;
        if (preferences['voice_input_enabled'] != null) {
          await setVoiceInputEnabled(preferences['voice_input_enabled']);
        }
        if (preferences['image_recognition_enabled'] != null) {
          await setImageRecognitionEnabled(
              preferences['image_recognition_enabled']);
        }
        if (preferences['translation_enabled'] != null) {
          await setTranslationEnabled(preferences['translation_enabled']);
        }
        if (preferences['smart_reply_enabled'] != null) {
          await setSmartReplyEnabled(preferences['smart_reply_enabled']);
        }
        if (preferences['context_aware_enabled'] != null) {
          await setContextAwareEnabled(preferences['context_aware_enabled']);
        }
        if (preferences['learning_mode_enabled'] != null) {
          await setLearningModeEnabled(preferences['learning_mode_enabled']);
        }
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /// Reset AChat specific data
  Future<void> resetAChatData() async {
    await clearChatHistory();
    await setApp<List<Map<String, dynamic>>>('chat_sessions', []);
    await setApp<List<String>>('favorite_messages', []);

    // Reset AI settings to defaults
    await setAIPersonality('helpful');
    await setAIResponseStyle('conversational');
    await setAITemperature(0.7);
    await setAIMaxTokens(2048);
    await setAISystemPrompt(
        'You are a helpful AI assistant. Be concise and accurate.');
    await setAICustomInstructions([]);

    // Reset preferences to defaults
    await setVoiceInputEnabled(true);
    await setImageRecognitionEnabled(true);
    await setTranslationEnabled(false);
    await setSmartReplyEnabled(true);
    await setContextAwareEnabled(true);
    await setLearningModeEnabled(false);
  }

  /// Get AChat data summary
  Future<Map<String, dynamic>> getAChatDataSummary() async {
    final chatHistory = await getChatHistory();
    final chatSessions = await getChatSessions();
    final favoriteMessages = await getFavoriteMessages();

    return {
      'total_messages': chatHistory.length,
      'total_sessions': chatSessions.length,
      'favorite_messages': favoriteMessages.length,
      'ai_personality': await getAIPersonality(),
      'ai_response_style': await getAIResponseStyle(),
      'voice_input_enabled': await isVoiceInputEnabled(),
      'image_recognition_enabled': await isImageRecognitionEnabled(),
      'translation_enabled': await isTranslationEnabled(),
      'smart_reply_enabled': await isSmartReplyEnabled(),
      'context_aware_enabled': await isContextAwareEnabled(),
      'learning_mode_enabled': await isLearningModeEnabled(),
    };
  }

  /// Notification settings
  Future<bool> isNotificationEnabled() async {
    return await getApp<bool>('notification_enabled') ?? true;
  }

  Future<void> setNotificationEnabled(bool enabled) async {
    await setApp<bool>('notification_enabled', enabled);
  }

  Future<void> toggleNotifications() async {
    final current = await isNotificationEnabled();
    await setNotificationEnabled(!current);
  }

  Future<bool> isNotificationSoundEnabled() async {
    return await getApp<bool>('notification_sound_enabled') ?? true;
  }

  Future<void> setNotificationSoundEnabled(bool enabled) async {
    await setApp<bool>('notification_sound_enabled', enabled);
  }

  Future<void> toggleNotificationSound() async {
    final current = await isNotificationSoundEnabled();
    await setNotificationSoundEnabled(!current);
  }

  /// Analytics and crash reporting
  Future<bool> isAnalyticsEnabled() async {
    return await getApp<bool>('analytics_enabled') ?? true;
  }

  Future<void> setAnalyticsEnabled(bool enabled) async {
    await setApp<bool>('analytics_enabled', enabled);
  }

  Future<void> toggleAnalytics() async {
    final current = await isAnalyticsEnabled();
    await setAnalyticsEnabled(!current);
  }

  Future<bool> isCrashReportingEnabled() async {
    return await getApp<bool>('crash_reporting_enabled') ?? true;
  }

  Future<void> setCrashReportingEnabled(bool enabled) async {
    await setApp<bool>('crash_reporting_enabled', enabled);
  }

  Future<void> toggleCrashReporting() async {
    final current = await isCrashReportingEnabled();
    await setCrashReportingEnabled(!current);
  }

  /// Locale settings
  Future<void> setCurrentLocaleIdentifier(String locale) async {
    await setApp<String>('current_locale', locale);
  }

  Future<String> getCurrentLocaleIdentifier() async {
    return await getApp<String>('current_locale') ?? 'zh';
  }

  // Note: Common methods like isDarkMode(), getLocale(), isAnalyticsEnabled(),
  // and isCrashReportingEnabled() are inherited from AppStorageBase
  // and use the common storage with sync access for better performance
}
