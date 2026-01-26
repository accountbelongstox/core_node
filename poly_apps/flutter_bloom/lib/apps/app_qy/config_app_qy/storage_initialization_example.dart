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

import 'dart:developer';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:qyflutter/common/storage_tools/storage_migration_tool.dart';
import 'storage_app_qy.dart';

/// QY app specific storage initialization and migration
class StorageInitializationQY {
  
  /// Initialize QY app storage
  static Future<void> initializeQyAppStorage() async {
    final storage = StorageAppQy.instance;
    await storage.initAppStorage();
    
    // Perform app-specific migration if needed
    await _performQyAppMigration();
    
    log('QY app storage initialized successfully');
  }
  
  /// Perform QY app specific data migration
  static Future<void> _performQyAppMigration() async {
    try {
      // Use the custom migration function from StorageMigrationTool
      final result = await StorageMigrationTool.performCustomMigration(
        _migrateQyAppData,
      );
      
      if (result.success) {
        log('QY app migration completed: ${result.migratedItems} items migrated');
      } else {
        log('QY app migration failed: ${result.message}');
      }
    } catch (e) {
      log('QY app migration error: $e');
    }
  }
  
  /// Custom migration function for QY app data
  static Future<void> _migrateQyAppData(
    SharedPreferences prefs,
    MigrationResult result,
  ) async {
    final storage = StorageAppQy.instance;
    
    // Migrate bookmarks
    await StorageMigrationTool.migrateString(
      prefs,
      'qy_bookmarks',
      (bookmarksString) async {
        final bookmarks = bookmarksString.split(',').where((s) => s.isNotEmpty).toList();
        for (final bookmark in bookmarks) {
          await storage.addBookmark(bookmark);
        }
      },
      result,
    );
    
    // Migrate user preferences
    await StorageMigrationTool.migrateBool(
      prefs,
      'qy_auto_sync',
      (autoSync) async {
        await storage.updateAppSettings({'auto_sync': autoSync});
      },
      result,
    );
    
    // Migrate search history
    await StorageMigrationTool.migrateString(
      prefs,
      'qy_search_history',
      (searchHistoryString) async {
        final searchHistory = searchHistoryString.split(',').where((s) => s.isNotEmpty).toList();
        for (final query in searchHistory) {
          await storage.addToSearchHistory(query);
        }
      },
      result,
    );
    
    // Migrate offline mode setting
    await StorageMigrationTool.migrateBool(
      prefs,
      'qy_offline_mode',
      (offlineMode) async {
        await storage.updateAppSettings({'offline_mode': offlineMode});
      },
      result,
    );
    
    // Migrate data saver setting
    await StorageMigrationTool.migrateBool(
      prefs,
      'qy_data_saver',
      (dataSaver) async {
        await storage.updateAppSettings({'data_saver': dataSaver});
      },
      result,
    );
    
    // Migrate favorite categories
    await StorageMigrationTool.migrateString(
      prefs,
      'qy_favorite_categories',
      (categoriesString) async {
        final categories = categoriesString.split(',').where((s) => s.isNotEmpty).toList();
        await storage.setFavoriteCategories(categories);
      },
      result,
    );
    
    // Migrate notification settings
    await StorageMigrationTool.migrateBool(
      prefs,
      'qy_push_notifications',
      (pushNotifications) async {
        final settings = await storage.getNotificationSettings();
        settings['push_notifications'] = pushNotifications;
        await storage.setNotificationSettings(settings);
      },
      result,
    );
    
    await StorageMigrationTool.migrateBool(
      prefs,
      'qy_email_notifications',
      (emailNotifications) async {
        final settings = await storage.getNotificationSettings();
        settings['email_notifications'] = emailNotifications;
        await storage.setNotificationSettings(settings);
      },
      result,
    );
    
    // Migrate user progress
    await StorageMigrationTool.migrateInt(
      prefs,
      'qy_user_level',
      (level) async {
        await storage.updateUserProgress({'level': level});
      },
      result,
    );
    
    await StorageMigrationTool.migrateInt(
      prefs,
      'qy_user_experience',
      (experience) async {
        await storage.updateUserProgress({'experience': experience});
      },
      result,
    );
    
    // Migrate achievements
    await StorageMigrationTool.migrateString(
      prefs,
      'qy_achievements',
      (achievementsString) async {
        final achievements = achievementsString.split(',').where((s) => s.isNotEmpty).toList();
        await storage.updateUserProgress({'achievements': achievements});
      },
      result,
    );
  }
  
  /// Get QY app storage statistics
  static Future<Map<String, dynamic>> getQyAppStorageStats() async {
    final storage = StorageAppQy.instance;
    return await storage.getAppDataSummary();
  }
  
  /// Reset QY app storage (for testing or user reset)
  static Future<void> resetQyAppStorage() async {
    final storage = StorageAppQy.instance;
    await storage.resetAppData();
    log('QY app storage reset completed');
  }
  
  /// Backup QY app data
  static Future<Map<String, dynamic>> backupQyAppData() async {
    final storage = StorageAppQy.instance;
    return await storage.backupAppData();
  }
  
  /// Restore QY app data from backup
  static Future<bool> restoreQyAppData(Map<String, dynamic> backup) async {
    final storage = StorageAppQy.instance;
    final success = await storage.restoreAppData(backup);
    if (success) {
      log('QY app data restored successfully');
    } else {
      log('QY app data restore failed');
    }
    return success;
  }
}

/// Usage examples for QY app storage
class QyAppStorageUsage {
  
  /// QY of how to use QY app storage in a page
  static void basicUsageQy() async {
    final storage = StorageAppQy.instance;
    
    // Synchronous access to common settings
    final isFirstLaunch = storage.isFirstLaunch();
    final isDarkMode = storage.isDarkMode();
    final locale = storage.getLocale();
    
    // Use the data
    if (isFirstLaunch) {
      // Show onboarding
    }
    
    if (isDarkMode) {
      // Apply dark theme
    }
    
    // Asynchronous access to app-specific data
    final bookmarks = await storage.getBookmarks();
    final userPreferences = await storage.getUserPreferences();
    final readingHistory = await storage.getReadingHistory();
    
    // Use app-specific data
    if (bookmarks.isNotEmpty) {
      // Show bookmarks
    }
    
    if (userPreferences.isNotEmpty) {
      // Apply user preferences
    }
    
    // Update data
    storage.setDarkMode(true);
    storage.setLocale('en');
    await storage.addBookmark('new_item');
    await storage.setUserPreferences({'theme': 'dark'});
  }
  
  /// QY of cache usage
  static void cacheUsageQy() {
    final storage = StorageAppQy.instance;
    
    // Cache temporary data
    storage.setCache('temp_user_data', {'id': '123', 'name': 'John'});
    
    // Get cached data
    final cachedUser = storage.getCache<Map<String, dynamic>>('temp_user_data');
    
    // Cache user preferences for quick access
    storage.cacheUserPreferences({'theme': 'dark', 'language': 'en'});
    
    // Get cached preferences
    final cachedPrefs = storage.getCachedUserPreferences();
    
    if (cachedUser != null && cachedPrefs != null) {
      // Use cached data
    }
  }
  
  /// QY of data management
  static void dataManagementQy() async {
    final storage = StorageAppQy.instance;
    
    // Get app data summary
    final summary = await storage.getAppDataSummary();
    
    // Backup data
    final backup = await storage.backupAppData();
    
    // Reset data (for logout or factory reset)
    await storage.resetAppData();
    
    // Restore data
    final restored = await storage.restoreAppData(backup);
    
    if (restored) {
      // Data restored successfully
    }
    
    // Get storage statistics
    final stats = await storage.getAppStats();
    
    // Use summary and stats for monitoring
    if (summary.isNotEmpty && stats.isNotEmpty) {
      // Process data for analytics or debugging
    }
  }
}
