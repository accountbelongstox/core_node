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

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'interfaces/database_interface.dart';
import 'sqlite/sqlite_service.dart';
import 'idb/idb_service.dart';

class DatabaseManager {
  static DatabaseManager? _instance;
  static DatabaseManager get instance => _instance ??= DatabaseManager._internal();
  
  DatabaseManager._internal();

  DatabaseInterface? _database;
  DatabaseType _currentType = DatabaseType.sqlite;
  final List<DatabaseMigrationInterface> _migrations = [];
  bool _isInitialized = false;

  DatabaseInterface? get database => _database;
  DatabaseType get currentType => _currentType;
  bool get isInitialized => _isInitialized;

  /// Initialize database with specified type and configuration
  Future<void> initialize({
    DatabaseType type = DatabaseType.sqlite,
    String? databaseName,
    String? databasePath,
    int version = 1,
    List<DatabaseMigrationInterface>? migrations,
  }) async {
    if (_isInitialized) {
      if (kDebugMode) {
        print('Database already initialized');
      }
      return;
    }

    try {
      _currentType = type;
      
      // Add migrations if provided
      if (migrations != null) {
        _migrations.addAll(migrations);
      }

      // Create appropriate database service
      switch (type) {
        case DatabaseType.sqlite:
          _database = SQLiteService.instance;
          break;
        case DatabaseType.indexedDB:
          _database = IndexedDBService.instance;
          break;
        case DatabaseType.memory:
          _database = _createMemoryDatabase();
          break;
      }

      // Initialize the database
      await _database!.initialize();

      // Run migrations
      await _runMigrations(version);

      _isInitialized = true;

      if (kDebugMode) {
        print('Database manager initialized with type: ${type.name}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to initialize database manager: $e');
      }
      throw DatabaseException('Failed to initialize database manager', originalError: e);
    }
  }

  /// Close database connection
  Future<void> close() async {
    if (!_isInitialized) return;

    try {
      await _database?.close();
      _database = null;
      _migrations.clear();
      _isInitialized = false;

      if (kDebugMode) {
        print('Database manager closed');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error closing database manager: $e');
      }
      throw DatabaseException('Failed to close database manager', originalError: e);
    }
  }

  /// Get SQLite service (if current database is SQLite)
  SQLiteService? get sqlite {
    if (_currentType == DatabaseType.sqlite && _database is SQLiteService) {
      return _database as SQLiteService;
    }
    return null;
  }

  /// Get IndexedDB service (if current database is IndexedDB)
  IndexedDBService? get indexedDB {
    if (_currentType == DatabaseType.indexedDB && _database is IndexedDBService) {
      return _database as IndexedDBService;
    }
    return null;
  }

  /// Add migration
  void addMigration(DatabaseMigrationInterface migration) {
    _migrations.add(migration);
    _migrations.sort((a, b) => a.version.compareTo(b.version));
  }

  /// Run migrations up to specified version
  Future<void> _runMigrations(int targetVersion) async {
    if (_database == null) return;

    try {
      final currentVersion = await _database!.getDatabaseVersion();
      
      if (kDebugMode) {
        print('Current database version: $currentVersion');
        print('Target database version: $targetVersion');
      }

      if (currentVersion >= targetVersion) {
        if (kDebugMode) {
          print('Database is already up to date');
        }
        return;
      }

      // Run migrations in order
      for (final migration in _migrations) {
        if (migration.version > currentVersion && migration.version <= targetVersion) {
          if (kDebugMode) {
            print('Running migration ${migration.version}: ${migration.description}');
          }
          
          await migration.up(_database!);
          
          if (kDebugMode) {
            print('Migration ${migration.version} completed');
          }
        }
      }

      if (kDebugMode) {
        print('All migrations completed successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Migration failed: $e');
      }
      throw DatabaseException('Migration failed', originalError: e);
    }
  }

  /// Rollback migrations to specified version
  Future<void> rollbackMigrations(int targetVersion) async {
    if (_database == null) {
      throw DatabaseException('Database not initialized');
    }

    try {
      final currentVersion = await _database!.getDatabaseVersion();
      
      if (kDebugMode) {
        print('Rolling back from version $currentVersion to $targetVersion');
      }

      if (currentVersion <= targetVersion) {
        if (kDebugMode) {
          print('No rollback needed');
        }
        return;
      }

      // Run rollbacks in reverse order
      final reversedMigrations = _migrations.reversed.toList();
      for (final migration in reversedMigrations) {
        if (migration.version <= currentVersion && migration.version > targetVersion) {
          if (kDebugMode) {
            print('Rolling back migration ${migration.version}: ${migration.description}');
          }
          
          await migration.down(_database!);
          
          if (kDebugMode) {
            print('Migration ${migration.version} rolled back');
          }
        }
      }

      if (kDebugMode) {
        print('Rollback completed successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Rollback failed: $e');
      }
      throw DatabaseException('Rollback failed', originalError: e);
    }
  }

  /// Execute operation within a transaction
  Future<T> transaction<T>(Future<T> Function() operation) async {
    if (_database == null) {
      throw DatabaseException('Database not initialized');
    }

    if (_database is DatabaseTransactionInterface) {
      return await (_database as DatabaseTransactionInterface).execute(operation);
    } else {
      // Fallback for databases that don't support transactions
      return await operation();
    }
  }

  /// Clear all data from database
  Future<void> clearAllData() async {
    if (_database == null) {
      throw DatabaseException('Database not initialized');
    }

    await _database!.clearDatabase();
    
    if (kDebugMode) {
      print('All database data cleared');
    }
  }

  /// Backup database to specified path
  Future<void> backup(String backupPath) async {
    if (_database == null) {
      throw DatabaseException('Database not initialized');
    }

    await _database!.backup(backupPath);
    
    if (kDebugMode) {
      print('Database backed up to: $backupPath');
    }
  }

  /// Restore database from backup
  Future<void> restore(String backupPath) async {
    if (_database == null) {
      throw DatabaseException('Database not initialized');
    }

    await _database!.restore(backupPath);
    
    if (kDebugMode) {
      print('Database restored from: $backupPath');
    }
  }

  /// Get database statistics
  Future<DatabaseStats> getStats() async {
    if (_database == null) {
      throw DatabaseException('Database not initialized');
    }

    try {
      final version = await _database!.getDatabaseVersion();
      
      // Get table/store names based on database type
      List<String> tableNames = [];
      if (_database is SQLiteService) {
        tableNames = await (_database as SQLiteService).getTableNames();
      } else if (_database is IndexedDBService) {
        tableNames = await (_database as IndexedDBService).getStoreNames();
      }

      return DatabaseStats(
        type: _currentType,
        version: version,
        tableCount: tableNames.length,
        tableNames: tableNames,
        isInitialized: _isInitialized,
      );
    } catch (e) {
      throw DatabaseException('Failed to get database stats', originalError: e);
    }
  }

  /// Create memory database (mock implementation)
  DatabaseInterface _createMemoryDatabase() {
    return _MemoryDatabase();
  }

  /// Check database health
  Future<bool> checkHealth() async {
    try {
      if (_database == null) return false;
      return await _database!.isInitialized();
    } catch (e) {
      if (kDebugMode) {
        print('Database health check failed: $e');
      }
      return false;
    }
  }

  /// Get recommended database type for current platform
  static DatabaseType getRecommendedType() {
    if (kIsWeb) {
      return DatabaseType.indexedDB;
    } else {
      return DatabaseType.sqlite;
    }
  }
}

/// Database statistics
class DatabaseStats {
  final DatabaseType type;
  final int version;
  final int tableCount;
  final List<String> tableNames;
  final bool isInitialized;

  const DatabaseStats({
    required this.type,
    required this.version,
    required this.tableCount,
    required this.tableNames,
    required this.isInitialized,
  });

  @override
  String toString() {
    return 'DatabaseStats(type: ${type.name}, version: $version, tableCount: $tableCount, isInitialized: $isInitialized)';
  }
}

/// Simple memory database implementation for testing
class _MemoryDatabase implements DatabaseInterface {
  final Map<String, List<Map<String, dynamic>>> _tables = {};
  bool _isInitialized = false;

  @override
  Future<void> initialize() async {
    _isInitialized = true;
  }

  @override
  Future<void> close() async {
    _tables.clear();
    _isInitialized = false;
  }

  @override
  Future<bool> isInitialized() async => _isInitialized;

  @override
  Future<void> clearDatabase() async {
    _tables.clear();
  }

  @override
  Future<int> getDatabaseVersion() async => 1;

  @override
  Future<void> backup(String path) async {
    // Mock implementation
  }

  @override
  Future<void> restore(String path) async {
    // Mock implementation
  }
}
