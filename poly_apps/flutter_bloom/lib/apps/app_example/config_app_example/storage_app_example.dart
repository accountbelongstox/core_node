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

import 'package:qyflutter/common/storage_tools/app_storage_base.dart';
import 'package:qyflutter/common/storage_tools/unified_storage.dart';

/// Example app specific storage implementation
/// Extends the base storage with app-specific keys and methods
class StorageAppExample extends AppStorageBaseImpl {
  static final StorageAppExample _instance = StorageAppExample._internal();
  factory StorageAppExample() => _instance;
  StorageAppExample._internal();

  /// Singleton instance
  static StorageAppExample get instance => _instance;

  @override
  String get appBox => 'app_example_storage';

  @override
  String get cacheNamespace => 'example';

  /// Example app specific storage keys
  static const String keyUserPreferences = 'user_preferences';
  static const String keyBookmarks = 'bookmarks';
  static const String keyReadingHistory = 'reading_history';
  static const String keyFavoriteCategories = 'favorite_categories';
  static const String keyNotificationSettings = 'notification_settings';
  static const String keySearchHistory = 'search_history';
  static const String keyOfflineContent = 'offline_content';
  static const String keyUserProgress = 'user_progress';
  static const String keyCustomThemes = 'custom_themes';
  static const String keyAppSettings = 'app_settings';

  // Word Card specific keys
  static const String keyWordList = 'word_list';
  static const String keyLearningStats = 'learning_stats';
  static const String keyWordProgress = 'word_progress';
  static const String keyStudySessions = 'study_sessions';

  /// Check if item is bookmarked
  Future<bool> isBookmarked(String item) async {
    final bookmarks = await getBookmarks();
    return bookmarks.contains(item);
  }

  /// Get favorite categories
  Future<List<String>> getFavoriteCategories() async {
    final categories = await getApp<List<dynamic>>(keyFavoriteCategories);
    return categories?.cast<String>() ?? [];
  }

  /// Set favorite categories
  Future<void> setFavoriteCategories(List<String> categories) async {
    await setApp<List<String>>(keyFavoriteCategories, categories);
  }

  /// Get notification settings
  Future<Map<String, bool>> getNotificationSettings() async {
    final settings =
        await getApp<Map<String, dynamic>>(keyNotificationSettings);
    return settings?.cast<String, bool>() ??
        {
          'push_notifications': true,
          'email_notifications': false,
          'sound_enabled': true,
          'vibration_enabled': true,
        };
  }

  /// Set notification settings
  Future<void> setNotificationSettings(Map<String, bool> settings) async {
    await setApp<Map<String, bool>>(keyNotificationSettings, settings);
  }

  /// Get search history
  Future<List<String>> getSearchHistory() async {
    final history = await getApp<List<dynamic>>(keySearchHistory);
    return history?.cast<String>() ?? [];
  }

  /// Add to search history
  Future<void> addToSearchHistory(String query) async {
    if (query.trim().isEmpty) return;

    final history = await getSearchHistory();

    // Remove if already exists
    history.remove(query);

    // Add to beginning
    history.insert(0, query);

    // Keep only last 20 searches
    if (history.length > 20) {
      history.removeRange(20, history.length);
    }

    await setApp<List<String>>(keySearchHistory, history);
  }

  /// Clear search history
  Future<void> clearSearchHistory() async {
    await removeApp(keySearchHistory);
  }

  /// Get user progress
  Future<Map<String, dynamic>> getUserProgress() async {
    return await getApp<Map<String, dynamic>>(keyUserProgress) ??
        {
          'level': 1,
          'experience': 0,
          'achievements': <String>[],
          'completed_tasks': <String>[],
        };
  }

  /// Update user progress
  Future<void> updateUserProgress(Map<String, dynamic> progress) async {
    final currentProgress = await getUserProgress();
    currentProgress.addAll(progress);
    await setApp<Map<String, dynamic>>(keyUserProgress, currentProgress);
  }

  /// Get app settings
  Future<Map<String, dynamic>> getAppSettings() async {
    return await getApp<Map<String, dynamic>>(keyAppSettings) ??
        {
          'auto_sync': true,
          'offline_mode': false,
          'data_saver': false,
          'analytics_enabled': true,
          'crash_reporting': true,
        };
  }

  /// Update app settings
  Future<void> updateAppSettings(Map<String, dynamic> settings) async {
    final currentSettings = await getAppSettings();
    currentSettings.addAll(settings);
    await setApp<Map<String, dynamic>>(keyAppSettings, currentSettings);
  }

  /// Cache user preferences for quick access
  void cacheUserPreferences(Map<String, dynamic> preferences) {
    setCache('user_preferences', preferences, expiry: const Duration(hours: 1));
  }

  /// Get cached user preferences
  Map<String, dynamic>? getCachedUserPreferences() {
    return getCache<Map<String, dynamic>>('user_preferences');
  }

  /// Cache recent bookmarks for quick access
  void cacheRecentBookmarks(List<String> bookmarks) {
    setCache('recent_bookmarks', bookmarks,
        expiry: const Duration(minutes: 30));
  }

  /// Get cached recent bookmarks
  List<String>? getCachedRecentBookmarks() {
    final bookmarks = getCache<List<dynamic>>('recent_bookmarks');
    return bookmarks?.cast<String>();
  }

  /// Initialize example app storage
  @override
  Future<void> initAppStorage() async {
    // Initialize app-specific storage box
    await UnifiedStorage.init();

    // Load frequently accessed data into cache
    final preferences = await getUserPreferences();
    if (preferences.isNotEmpty) {
      cacheUserPreferences(preferences);
    }

    final bookmarks = await getBookmarks();
    if (bookmarks.isNotEmpty) {
      cacheRecentBookmarks(bookmarks.take(10).cast<String>().toList());
    }
  }

  /// Get complete app data summary
  Future<Map<String, dynamic>> getAppDataSummary() async {
    return {
      'user_preferences': await getUserPreferences(),
      'bookmarks_count': (await getBookmarks()).length,
      'reading_history_count': (await getReadingHistory()).length,
      'favorite_categories': await getFavoriteCategories(),
      'notification_settings': await getNotificationSettings(),
      'search_history_count': (await getSearchHistory()).length,
      'user_progress': await getUserProgress(),
      'app_settings': await getAppSettings(),
      'is_first_launch': isFirstLaunch(),
      'is_authenticated': isAuthenticated(),
      'locale': getLocale(),
      'theme_mode': getThemeMode(),
    };
  }

  /// Reset all app data (for logout or reset)
  Future<void> resetAppData() async {
    await clearAppStorage();
    await clearUserStorage();
    clearAppCache();

    // Keep common settings like locale and theme
    // but clear authentication and user-specific data
    await clearAuth();
  }

  /// Backup app data
  Future<Map<String, dynamic>> backupAppData() async {
    return {
      'app_name': 'example',
      'backup_version': '1.0',
      'backup_time': DateTime.now().toIso8601String(),
      'data': await exportAppData(),
    };
  }

  /// Restore app data from backup
  Future<bool> restoreAppData(Map<String, dynamic> backup) async {
    try {
      final data = backup['data'] as Map<String, dynamic>?;
      if (data != null) {
        await importAppData(data);
        await refreshCache();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /// Save word learning status
  Future<void> setWordStatus(String word, bool isKnown) async {
    await setApp<bool>('word_${word}_known', isKnown);
  }

  /// Get word learning status
  Future<bool?> getWordStatus(String word) async {
    return await getApp<bool>('word_${word}_known');
  }

  /// Save word list
  Future<void> saveWordList(List<Map<String, dynamic>> words) async {
    await setApp<List<Map<String, dynamic>>>(keyWordList, words);
  }

  /// Get word list
  Future<List<Map<String, dynamic>>> getWordList() async {
    return await getApp<List<Map<String, dynamic>>>(keyWordList) ?? [];
  }

  /// Save learning statistics
  Future<void> saveLearningStats(Map<String, dynamic> stats) async {
    await setApp<Map<String, dynamic>>(keyLearningStats, stats);
  }

  /// Get learning statistics
  Future<Map<String, dynamic>> getLearningStats() async {
    return await getApp<Map<String, dynamic>>(keyLearningStats) ??
        <String, dynamic>{
          'total_words': 0,
          'known_words': 0,
          'unknown_words': 0,
          'last_study_date': null,
          'study_streak': 0,
          'total_study_time': 0,
        };
  }

  /// Record study session
  Future<void> recordStudySession(Map<String, dynamic> session) async {
    final sessions =
        await getApp<List<Map<String, dynamic>>>(keyStudySessions) ?? [];
    sessions.add(session);

    // Keep only last 100 sessions to avoid storage bloat
    if (sessions.length > 100) {
      sessions.removeRange(0, sessions.length - 100);
    }

    await setApp<List<Map<String, dynamic>>>(keyStudySessions, sessions);
  }

  /// Get study sessions
  Future<List<Map<String, dynamic>>> getStudySessions() async {
    return await getApp<List<Map<String, dynamic>>>(keyStudySessions) ?? [];
  }

  /// Get study streak (consecutive days)
  Future<int> getStudyStreak() async {
    final sessions = await getStudySessions();
    if (sessions.isEmpty) return 0;

    final today = DateTime.now();
    int streak = 0;

    // Sort sessions by date (newest first)
    sessions.sort((a, b) {
      final dateA = DateTime.parse(a['date'] ?? '');
      final dateB = DateTime.parse(b['date'] ?? '');
      return dateB.compareTo(dateA);
    });

    DateTime? lastDate;
    for (final session in sessions) {
      final sessionDate = DateTime.parse(session['date'] ?? '');
      final daysDiff = lastDate?.difference(sessionDate).inDays ??
          today.difference(sessionDate).inDays;

      if (daysDiff <= 1) {
        streak++;
        lastDate = sessionDate;
      } else {
        break;
      }
    }

    return streak;
  }

  /// Reset all word learning data
  Future<void> resetWordLearningData() async {
    // Get all keys that start with 'word_' and end with '_known'
    final wordList = await getWordList();
    for (final wordData in wordList) {
      final word = wordData['word'] as String?;
      if (word != null) {
        await removeApp('word_${word}_known');
      }
    }

    // Reset statistics
    await saveLearningStats({
      'total_words': 0,
      'known_words': 0,
      'unknown_words': 0,
      'last_study_date': DateTime.now().toIso8601String(),
      'study_streak': 0,
      'total_study_time': 0,
    });

    // Clear study sessions
    await setApp<List<Map<String, dynamic>>>(keyStudySessions, []);
  }

  /// Export word learning data
  Future<Map<String, dynamic>> exportWordLearningData() async {
    final wordList = await getWordList();
    final stats = await getLearningStats();
    final sessions = await getStudySessions();

    // Get all word statuses
    final wordStatuses = <String, bool>{};
    for (final wordData in wordList) {
      final word = wordData['word'] as String?;
      if (word != null) {
        final status = await getWordStatus(word);
        if (status != null) {
          wordStatuses[word] = status;
        }
      }
    }

    return {
      'word_list': wordList,
      'word_statuses': wordStatuses,
      'learning_stats': stats,
      'study_sessions': sessions,
      'export_date': DateTime.now().toIso8601String(),
      'version': '1.0',
    };
  }

  /// Import word learning data
  Future<bool> importWordLearningData(Map<String, dynamic> data) async {
    try {
      // Import word list
      if (data['word_list'] != null) {
        await saveWordList(List<Map<String, dynamic>>.from(data['word_list']));
      }

      // Import word statuses
      if (data['word_statuses'] != null) {
        final statuses = Map<String, bool>.from(data['word_statuses']);
        for (final entry in statuses.entries) {
          await setWordStatus(entry.key, entry.value);
        }
      }

      // Import learning stats
      if (data['learning_stats'] != null) {
        await saveLearningStats(
            Map<String, dynamic>.from(data['learning_stats']));
      }

      // Import study sessions
      if (data['study_sessions'] != null) {
        await setApp<List<Map<String, dynamic>>>(keyStudySessions,
            List<Map<String, dynamic>>.from(data['study_sessions']));
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /// Get app statistics
  Future<Map<String, dynamic>> getAppStats() async {
    return {
      'launch_count': await getApp<int>('launch_count') ?? 0,
      'last_open_time': await getApp<int>('last_open_time'),
      'app_version': await getApp<String>('app_version'),
      'total_bookmarks': (await getBookmarks()).length,
      'total_search_history': (await getSearchHistory()).length,
      'total_study_sessions': (await getStudySessions()).length,
      'learning_stats': await getLearningStats(),
    };
  }

  /// Get launch count
  Future<int> getLaunchCount() async {
    return await getApp<int>('launch_count') ?? 0;
  }

  /// Set launch count
  Future<void> setLaunchCount(int count) async {
    await setApp<int>('launch_count', count);
  }

  /// Get last open time
  Future<DateTime?> getLastOpenTime() async {
    final timestamp = await getApp<int>('last_open_time');
    return timestamp != null ? DateTime.fromMillisecondsSinceEpoch(timestamp) : null;
  }

  /// Set last open time
  Future<void> setLastOpenTime(DateTime time) async {
    await setApp<int>('last_open_time', time.millisecondsSinceEpoch);
  }

  /// Get user ID
  Future<String?> getUserId() async {
    return await getApp<String>('user_id');
  }

  /// Get user email
  Future<String?> getUserEmail() async {
    return await getApp<String>('user_email');
  }

  /// Get username
  Future<String?> getUsername() async {
    return await getApp<String>('username');
  }

  /// Get last login time
  Future<DateTime?> getLastLoginTime() async {
    final timestamp = await getApp<int>('last_login_time');
    return timestamp != null ? DateTime.fromMillisecondsSinceEpoch(timestamp) : null;
  }

  /// Get app version
  Future<String?> getAppVersion() async {
    return await getApp<String>('app_version');
  }

  /// Set app version
  Future<void> setAppVersion(String version) async {
    await setApp<String>('app_version', version);
  }

  /// Check if offline mode is enabled
  Future<bool> isOfflineModeEnabled() async {
    final settings = await getAppSettings();
    return settings['offline_mode'] as bool? ?? false;
  }
}
