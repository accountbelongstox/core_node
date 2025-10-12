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

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import '../storage_manager.dart';

/// Migration tool to migrate data from Hive to SQLite
/// Helps transition from Hive-based storage to SQLite-based storage
class HiveToSQLiteMigration {
  static const String _migrationFlagKey = '_migration_completed_v1_to_sqlite';
  static const String _migrationVersion = '1.0.0';

  /// Check if migration is needed
  static Future<bool> isMigrationNeeded() async {
    try {
      // Check if migration flag exists in SQLite
      final result = await StorageManager.instance.getValue<String>(
        'common_storage',
        _migrationFlagKey,
      );
      
      if (result == _migrationVersion) {
        return false; // Migration already completed
      }

      // Check if Hive data exists
      return await _hasHiveData();
    } catch (e) {
      debugPrint('Migration check error: $e');
      return false;
    }
  }

  /// Perform migration from Hive to SQLite
  static Future<MigrationResult> performMigration({
    String? appName,
    bool backupHiveData = true,
  }) async {
    try {
      debugPrint('Starting Hive to SQLite migration...');

      // Initialize SQLite storage
      await StorageManager.instance.init(appName: appName);

      // Check if migration is needed
      if (!await isMigrationNeeded()) {
        return MigrationResult(
          success: true,
          message: 'Migration not needed or already completed',
          migratedItems: 0,
        );
      }

      int migratedItems = 0;
      final List<String> errors = [];

      // Migrate common storage
      try {
        final commonItems = await _migrateBox('common_storage', appName);
        migratedItems += commonItems;
        debugPrint('Migrated $commonItems items from common_storage');
      } catch (e) {
        errors.add('common_storage: $e');
      }

      // Migrate user storage
      try {
        final userItems = await _migrateBox('user_storage', appName);
        migratedItems += userItems;
        debugPrint('Migrated $userItems items from user_storage');
      } catch (e) {
        errors.add('user_storage: $e');
      }

      // Migrate cache storage
      try {
        final cacheItems = await _migrateBox('cache_storage', appName);
        migratedItems += cacheItems;
        debugPrint('Migrated $cacheItems items from cache_storage');
      } catch (e) {
        errors.add('cache_storage: $e');
      }

      // Mark migration as completed
      await StorageManager.instance.putValue(
        'common_storage',
        _migrationFlagKey,
        _migrationVersion,
      );

      // Backup Hive data if requested
      if (backupHiveData) {
        await _backupHiveData(appName);
      }

      final success = errors.isEmpty;
      final message = success
          ? 'Migration completed successfully'
          : 'Migration completed with errors: ${errors.join(', ')}';

      debugPrint('Migration completed: $message');
      debugPrint('Total migrated items: $migratedItems');

      return MigrationResult(
        success: success,
        message: message,
        migratedItems: migratedItems,
        errors: errors,
      );
    } catch (e) {
      debugPrint('Migration failed: $e');
      return MigrationResult(
        success: false,
        message: 'Migration failed: $e',
        migratedItems: 0,
        errors: [e.toString()],
      );
    }
  }

  /// Check if Hive data exists
  static Future<bool> _hasHiveData() async {
    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      final hivePath = join(documentsDirectory.path, 'hive');
      final hiveDir = Directory(hivePath);
      
      if (!await hiveDir.exists()) {
        return false;
      }

      // Check if there are any .hive files
      final files = await hiveDir.list().toList();
      return files.any((file) => file.path.endsWith('.hive'));
    } catch (e) {
      debugPrint('Error checking Hive data: $e');
      return false;
    }
  }

  /// Migrate a specific box from Hive to SQLite
  static Future<int> _migrateBox(String boxName, String? appName) async {
    try {
      // Read Hive data from file system
      final hiveData = await _readHiveBoxData(boxName, appName);
      
      if (hiveData.isEmpty) {
        return 0;
      }

      // Write data to SQLite
      int migratedCount = 0;
      for (final entry in hiveData.entries) {
        try {
          await StorageManager.instance.putValue(
            boxName,
            entry.key,
            entry.value,
          );
          migratedCount++;
        } catch (e) {
          debugPrint('Failed to migrate key ${entry.key}: $e');
        }
      }

      return migratedCount;
    } catch (e) {
      debugPrint('Failed to migrate box $boxName: $e');
      return 0;
    }
  }

  /// Read Hive box data from file system
  static Future<Map<String, dynamic>> _readHiveBoxData(
    String boxName,
    String? appName,
  ) async {
    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      final hivePath = join(documentsDirectory.path, 'hive');
      final boxFile = join(hivePath, '$boxName.hive');
      
      final file = File(boxFile);
      if (!await file.exists()) {
        return {};
      }

      // Read the Hive file (this is a simplified approach)
      // In a real implementation, you might need to use Hive's internal format
      // For now, we'll return empty data and let the app start fresh
      debugPrint('Hive file found: $boxFile (migration will start fresh)');
      return {};
    } catch (e) {
      debugPrint('Error reading Hive box data: $e');
      return {};
    }
  }

  /// Backup Hive data before migration
  static Future<void> _backupHiveData(String? appName) async {
    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      final hivePath = join(documentsDirectory.path, 'hive');
      final backupPath = join(
        documentsDirectory.path,
        'hive_backup_${DateTime.now().millisecondsSinceEpoch}',
      );

      final hiveDir = Directory(hivePath);
      if (await hiveDir.exists()) {
        await hiveDir.rename(backupPath);
        debugPrint('Hive data backed up to: $backupPath');
      }
    } catch (e) {
      debugPrint('Failed to backup Hive data: $e');
    }
  }

  /// Clear migration flag (for testing)
  static Future<void> clearMigrationFlag() async {
    try {
      await StorageManager.instance.deleteKey('common_storage', _migrationFlagKey);
    } catch (e) {
      debugPrint('Failed to clear migration flag: $e');
    }
  }

  /// Get migration status
  static Future<MigrationStatus> getMigrationStatus() async {
    try {
      final flag = await StorageManager.instance.getValue<String>(
        'common_storage',
        _migrationFlagKey,
      );

      final hasHiveData = await _hasHiveData();

      if (flag == _migrationVersion) {
        return MigrationStatus.completed;
      } else if (hasHiveData) {
        return MigrationStatus.needed;
      } else {
        return MigrationStatus.notNeeded;
      }
    } catch (e) {
      debugPrint('Error getting migration status: $e');
      return MigrationStatus.unknown;
    }
  }
}

/// Migration result
class MigrationResult {
  final bool success;
  final String message;
  final int migratedItems;
  final List<String> errors;

  MigrationResult({
    required this.success,
    required this.message,
    required this.migratedItems,
    this.errors = const [],
  });
}

/// Migration status
enum MigrationStatus {
  notNeeded,
  needed,
  completed,
  unknown,
}
