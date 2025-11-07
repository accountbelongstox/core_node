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

import 'package:shared_preferences/shared_preferences.dart';
import 'unified_storage.dart';
import 'migration/hive_to_sqlite_migration.dart';
import 'cleanup/storage_cleanup_tool.dart';

/// Tool for migrating data from old storage systems to unified storage
class StorageMigrationTool {
  static const String _migrationVersionKey = 'storage_migration_version';
  static const int _currentMigrationVersion = 1;
  
  /// Check if migration is needed
  static Future<bool> isMigrationNeeded() async {
    final prefs = await SharedPreferences.getInstance();
    final currentVersion = prefs.getInt(_migrationVersionKey) ?? 0;
    
    // Check SharedPreferences migration, Hive to SQLite migration, and cleanup
    final sharedPrefsMigrationNeeded = currentVersion < _currentMigrationVersion;
    final hiveToSQLiteMigrationNeeded = await HiveToSQLiteMigration.isMigrationNeeded();
    final cleanupNeeded = await StorageCleanupTool.isCleanupNeeded();
    
    return sharedPrefsMigrationNeeded || hiveToSQLiteMigrationNeeded || cleanupNeeded;
  }
  
  /// Perform migration of common settings from SharedPreferences to unified storage
  static Future<MigrationResult> performCommonMigration() async {
    final result = MigrationResult();

    try {
      // Initialize unified storage
      await UnifiedStorage.init();

      // Perform Hive to SQLite migration first
      final hiveMigrationResult = await HiveToSQLiteMigration.performMigration();
      if (hiveMigrationResult.success) {
        result.migratedItems += hiveMigrationResult.migratedItems;
        result.message = 'Hive to SQLite migration completed: ${hiveMigrationResult.migratedItems} items migrated';
      } else {
        result.message = 'Hive to SQLite migration failed: ${hiveMigrationResult.message}';
      }

      // Perform storage cleanup
      final cleanupResult = await StorageCleanupTool.performCleanup();
      if (cleanupResult.success) {
        result.migratedItems += cleanupResult.cleanedItems;
        if (result.message.isNotEmpty) {
          result.message += '; Storage cleanup completed: ${cleanupResult.cleanedItems} items cleaned';
        } else {
          result.message = 'Storage cleanup completed: ${cleanupResult.cleanedItems} items cleaned';
        }
      } else {
        if (result.message.isNotEmpty) {
          result.message += '; Storage cleanup failed: ${cleanupResult.message}';
        } else {
          result.message = 'Storage cleanup failed: ${cleanupResult.message}';
        }
      }

      // Get SharedPreferences instance
      final prefs = await SharedPreferences.getInstance();

      // Migrate common settings only
      await _migrateCommonSettings(prefs, result);

      // Mark migration as complete
      await prefs.setInt(_migrationVersionKey, _currentMigrationVersion);

      result.success = true;
      if (result.message.isEmpty) {
        result.message = 'Common settings migration completed successfully';
      } else {
        result.message += '; Common settings migration completed successfully';
      }

    } catch (e) {
      result.success = false;
      result.message = 'Migration failed: $e';
      result.errors.add(e.toString());
    }

    return result;
  }

  /// Perform custom migration with provided migration function
  static Future<MigrationResult> performCustomMigration(
    Future<void> Function(SharedPreferences prefs, MigrationResult result) customMigration,
  ) async {
    final result = MigrationResult();

    try {
      // Initialize unified storage
      await UnifiedStorage.init();

      // Get SharedPreferences instance
      final prefs = await SharedPreferences.getInstance();

      // Migrate common settings
      await _migrateCommonSettings(prefs, result);

      // Perform custom migration
      await customMigration(prefs, result);

      // Mark migration as complete
      await prefs.setInt(_migrationVersionKey, _currentMigrationVersion);

      result.success = true;
      result.message = 'Custom migration completed successfully';

    } catch (e) {
      result.success = false;
      result.message = 'Migration failed: $e';
      result.errors.add(e.toString());
    }

    return result;
  }
  
  /// Migrate common settings used across all apps
  static Future<void> _migrateCommonSettings(
    SharedPreferences prefs, 
    MigrationResult result,
  ) async {
    final migratedKeys = <String>[];
    
    try {
      // Migrate theme settings
      final isDarkMode = prefs.getBool('theme');
      if (isDarkMode != null) {
        await UnifiedStorage.set(CommonKeys.isDarkMode, isDarkMode);
        await UnifiedStorage.set(CommonKeys.themeMode, isDarkMode ? 'dark' : 'light');
        migratedKeys.add('theme');
        result.migratedItems++;
      }
      
      // Migrate language settings
      final language = prefs.getString('language');
      if (language != null) {
        await UnifiedStorage.set(CommonKeys.locale, language);
        migratedKeys.add('language');
        result.migratedItems++;
      }
      
      // Migrate first launch flag
      final isFirstLaunch = prefs.getBool('is_first_launch');
      if (isFirstLaunch != null) {
        await UnifiedStorage.set(CommonKeys.isFirstLaunch, isFirstLaunch);
        migratedKeys.add('is_first_launch');
        result.migratedItems++;
      }
      
      // Migrate app version
      final appVersion = prefs.getString('app_version');
      if (appVersion != null) {
        await UnifiedStorage.set(CommonKeys.appVersion, appVersion);
        migratedKeys.add('app_version');
        result.migratedItems++;
      }
      
      // Migrate notification settings
      final notificationsEnabled = prefs.getBool('notifications_enabled');
      if (notificationsEnabled != null) {
        await UnifiedStorage.set(CommonKeys.notificationsEnabled, notificationsEnabled);
        migratedKeys.add('notifications_enabled');
        result.migratedItems++;
      }
      
      final soundEnabled = prefs.getBool('sound_enabled');
      if (soundEnabled != null) {
        await UnifiedStorage.set(CommonKeys.soundEnabled, soundEnabled);
        migratedKeys.add('sound_enabled');
        result.migratedItems++;
      }
      
      final vibrationEnabled = prefs.getBool('vibration_enabled');
      if (vibrationEnabled != null) {
        await UnifiedStorage.set(CommonKeys.vibrationEnabled, vibrationEnabled);
        migratedKeys.add('vibration_enabled');
        result.migratedItems++;
      }
      
      // Migrate font settings
      final fontSize = prefs.getDouble('font_size');
      if (fontSize != null) {
        await UnifiedStorage.set(CommonKeys.fontSize, fontSize);
        migratedKeys.add('font_size');
        result.migratedItems++;
      }
      
      final fontFamily = prefs.getString('font_family');
      if (fontFamily != null) {
        await UnifiedStorage.set(CommonKeys.fontFamily, fontFamily);
        migratedKeys.add('font_family');
        result.migratedItems++;
      }
      
      // Migrate authentication data
      final authToken = prefs.getString('auth_token');
      if (authToken != null) {
        await UnifiedStorage.set(CommonKeys.authToken, authToken);
        migratedKeys.add('auth_token');
        result.migratedItems++;
      }
      
      final userId = prefs.getString('user_id');
      if (userId != null) {
        await UnifiedStorage.set(CommonKeys.userId, userId);
        migratedKeys.add('user_id');
        result.migratedItems++;
      }
      
      final userEmail = prefs.getString('user_email');
      if (userEmail != null) {
        await UnifiedStorage.set(CommonKeys.userEmail, userEmail);
        migratedKeys.add('user_email');
        result.migratedItems++;
      }
      
      // Remove migrated keys from SharedPreferences
      for (final key in migratedKeys) {
        await prefs.remove(key);
      }
      
      result.migratedKeys.addAll(migratedKeys);
      
    } catch (e) {
      result.errors.add('Common settings migration error: $e');
    }
  }
  
  /// Helper method to migrate a string list from SharedPreferences
  static Future<void> migrateStringList(
    SharedPreferences prefs,
    String key,
    Future<void> Function(List<String>) processor,
    MigrationResult result,
  ) async {
    try {
      final stringValue = prefs.getString(key);
      if (stringValue != null) {
        final list = stringValue.split(',').where((s) => s.isNotEmpty).toList();
        await processor(list);
        await prefs.remove(key);
        result.migratedKeys.add(key);
        result.migratedItems++;
      }
    } catch (e) {
      result.errors.add('Error migrating $key: $e');
    }
  }

  /// Helper method to migrate a boolean value from SharedPreferences
  static Future<void> migrateBool(
    SharedPreferences prefs,
    String key,
    Future<void> Function(bool) processor,
    MigrationResult result,
  ) async {
    try {
      final value = prefs.getBool(key);
      if (value != null) {
        await processor(value);
        await prefs.remove(key);
        result.migratedKeys.add(key);
        result.migratedItems++;
      }
    } catch (e) {
      result.errors.add('Error migrating $key: $e');
    }
  }

  /// Helper method to migrate an integer value from SharedPreferences
  static Future<void> migrateInt(
    SharedPreferences prefs,
    String key,
    Future<void> Function(int) processor,
    MigrationResult result,
  ) async {
    try {
      final value = prefs.getInt(key);
      if (value != null) {
        await processor(value);
        await prefs.remove(key);
        result.migratedKeys.add(key);
        result.migratedItems++;
      }
    } catch (e) {
      result.errors.add('Error migrating $key: $e');
    }
  }

  /// Helper method to migrate a string value from SharedPreferences
  static Future<void> migrateString(
    SharedPreferences prefs,
    String key,
    Future<void> Function(String) processor,
    MigrationResult result,
  ) async {
    try {
      final value = prefs.getString(key);
      if (value != null) {
        await processor(value);
        await prefs.remove(key);
        result.migratedKeys.add(key);
        result.migratedItems++;
      }
    } catch (e) {
      result.errors.add('Error migrating $key: $e');
    }
  }
  
  /// Get migration status
  static Future<MigrationStatus> getMigrationStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final currentVersion = prefs.getInt(_migrationVersionKey) ?? 0;
    
    return MigrationStatus(
      currentVersion: currentVersion,
      targetVersion: _currentMigrationVersion,
      isCompleted: currentVersion >= _currentMigrationVersion,
      needsMigration: currentVersion < _currentMigrationVersion,
    );
  }
  
  /// Reset migration (for testing purposes)
  static Future<void> resetMigration() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_migrationVersionKey);
  }
}

/// Result of migration operation
class MigrationResult {
  bool success = false;
  String message = '';
  int migratedItems = 0;
  List<String> migratedKeys = [];
  List<String> errors = [];
  
  @override
  String toString() {
    return 'MigrationResult(success: $success, message: $message, '
           'migratedItems: $migratedItems, errors: ${errors.length})';
  }
}

/// Status of migration
class MigrationStatus {
  final int currentVersion;
  final int targetVersion;
  final bool isCompleted;
  final bool needsMigration;
  
  const MigrationStatus({
    required this.currentVersion,
    required this.targetVersion,
    required this.isCompleted,
    required this.needsMigration,
  });
  
  @override
  String toString() {
    return 'MigrationStatus(current: $currentVersion, target: $targetVersion, '
           'completed: $isCompleted, needsMigration: $needsMigration)';
  }
}
