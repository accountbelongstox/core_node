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
import '../interfaces/database_interface.dart';

class SQLiteService implements DatabaseInterface, DatabaseTransactionInterface {
  static SQLiteService? _instance;
  static SQLiteService get instance => _instance ??= SQLiteService._internal();
  
  SQLiteService._internal();

  DatabaseConnectionInfo? _connectionInfo;
  bool _isInitialized = false;
  bool _isInTransaction = false;
  final Map<String, SQLiteTable> _tables = {};

  // Mock database storage for demonstration
  final Map<String, List<Map<String, dynamic>>> _mockTables = {};
  final int _mockVersion = 1;

  @override
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      if (kIsWeb) {
        await _initializeWeb();
      } else {
        await _initializeNative();
      }

      _isInitialized = true;
      if (kDebugMode) {
        print('SQLite database initialized successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to initialize SQLite database: $e');
      }
      throw DatabaseException('Failed to initialize database', originalError: e);
    }
  }

  @override
  Future<void> close() async {
    if (!_isInitialized) return;

    try {
      if (_isInTransaction) {
        await rollback();
      }

      _tables.clear();
      _mockTables.clear();
      _isInitialized = false;

      if (kDebugMode) {
        print('SQLite database closed');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error closing database: $e');
      }
      throw DatabaseException('Failed to close database', originalError: e);
    }
  }

  @override
  Future<bool> isInitialized() async {
    return _isInitialized;
  }

  @override
  Future<void> clearDatabase() async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    try {
      _mockTables.clear();
      if (kDebugMode) {
        print('Database cleared');
      }
    } catch (e) {
      throw DatabaseException('Failed to clear database', originalError: e);
    }
  }

  @override
  Future<int> getDatabaseVersion() async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }
    return _mockVersion;
  }

  @override
  Future<void> backup(String backupPath) async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    try {
      // Mock backup implementation
      if (kDebugMode) {
        print('Database backed up to: $backupPath');
      }
    } catch (e) {
      throw DatabaseException('Failed to backup database', originalError: e);
    }
  }

  @override
  Future<void> restore(String backupPath) async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    try {
      // Mock restore implementation
      if (kDebugMode) {
        print('Database restored from: $backupPath');
      }
    } catch (e) {
      throw DatabaseException('Failed to restore database', originalError: e);
    }
  }

  // Transaction methods
  @override
  Future<void> begin() async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    if (_isInTransaction) {
      throw DatabaseException('Transaction already in progress');
    }

    _isInTransaction = true;
    if (kDebugMode) {
      print('Transaction started');
    }
  }

  @override
  Future<void> commit() async {
    if (!_isInTransaction) {
      throw DatabaseException('No transaction in progress');
    }

    _isInTransaction = false;
    if (kDebugMode) {
      print('Transaction committed');
    }
  }

  @override
  Future<void> rollback() async {
    if (!_isInTransaction) {
      throw DatabaseException('No transaction in progress');
    }

    _isInTransaction = false;
    if (kDebugMode) {
      print('Transaction rolled back');
    }
  }

  @override
  Future<T> execute<T>(Future<T> Function() operation) async {
    await begin();
    try {
      final result = await operation();
      await commit();
      return result;
    } catch (e) {
      await rollback();
      rethrow;
    }
  }

  // Table management
  Future<void> createTable(DatabaseTable table) async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    try {
      _mockTables[table.name] = [];
      _tables[table.name] = SQLiteTable(table.name, this);

      if (kDebugMode) {
        print('Table created: ${table.name}');
        print('SQL: ${table.createTableSql}');
      }
    } catch (e) {
      throw DatabaseException(
        'Failed to create table: ${table.name}',
        originalError: e,
      );
    }
  }

  Future<void> dropTable(String tableName) async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    try {
      _mockTables.remove(tableName);
      _tables.remove(tableName);

      if (kDebugMode) {
        print('Table dropped: $tableName');
      }
    } catch (e) {
      throw DatabaseException(
        'Failed to drop table: $tableName',
        originalError: e,
      );
    }
  }

  Future<bool> tableExists(String tableName) async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    return _mockTables.containsKey(tableName);
  }

  Future<List<String>> getTableNames() async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    return _mockTables.keys.toList();
  }

  // Query execution
  Future<List<Map<String, dynamic>>> query(DatabaseQuery query) async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    try {
      if (kDebugMode) {
        print('Executing query: ${query.sql}');
        if (query.parameters.isNotEmpty) {
          print('Parameters: ${query.parameters}');
        }
      }

      // Mock query execution
      return _mockQueryExecution(query);
    } catch (e) {
      throw DatabaseException(
        'Query execution failed',
        query: query.sql,
        parameters: query.parameters,
        originalError: e,
      );
    }
  }

  Future<int> executeQuery(DatabaseQuery query) async {
    if (!_isInitialized) {
      throw DatabaseException('Database not initialized');
    }

    try {
      if (kDebugMode) {
        print('Executing command: ${query.sql}');
        if (query.parameters.isNotEmpty) {
          print('Parameters: ${query.parameters}');
        }
      }

      // Mock command execution
      return _mockCommandExecution(query);
    } catch (e) {
      throw DatabaseException(
        'Command execution failed',
        query: query.sql,
        parameters: query.parameters,
        originalError: e,
      );
    }
  }

  SQLiteTable<T> table<T extends DatabaseModelInterface>(String tableName) {
    if (!_tables.containsKey(tableName)) {
      _tables[tableName] = SQLiteTable<T>(tableName, this);
    }
    return _tables[tableName] as SQLiteTable<T>;
  }

  Future<void> _initializeWeb() async {
    // Web-specific SQLite initialization (using sql.js or similar)
    if (kDebugMode) {
      print('Initializing SQLite for web platform');
    }
    await Future.delayed(Duration(milliseconds: 500));
  }

  Future<void> _initializeNative() async {
    // Native platform SQLite initialization
    if (kDebugMode) {
      print('Initializing SQLite for native platform');
    }
    await Future.delayed(Duration(milliseconds: 500));
  }

  List<Map<String, dynamic>> _mockQueryExecution(DatabaseQuery query) {
    // Mock implementation for demonstration
    final sql = query.sql.toLowerCase();
    
    if (sql.contains('select')) {
      // Mock SELECT query
      final tableName = _extractTableName(sql);
      if (tableName != null && _mockTables.containsKey(tableName)) {
        return List<Map<String, dynamic>>.from(_mockTables[tableName]!);
      }
      return [];
    }
    
    return [];
  }

  int _mockCommandExecution(DatabaseQuery query) {
    // Mock implementation for demonstration
    final sql = query.sql.toLowerCase();
    
    if (sql.contains('insert')) {
      final tableName = _extractTableName(sql);
      if (tableName != null) {
        _mockTables.putIfAbsent(tableName, () => []);
        final mockData = <String, dynamic>{
          'id': DateTime.now().millisecondsSinceEpoch,
          'created_at': DateTime.now().toIso8601String(),
        };
        _mockTables[tableName]!.add(mockData);
        return 1; // Affected rows
      }
    } else if (sql.contains('update')) {
      return 1; // Mock affected rows
    } else if (sql.contains('delete')) {
      return 1; // Mock affected rows
    }
    
    return 0;
  }

  String? _extractTableName(String sql) {
    // Simple table name extraction for mock purposes
    final patterns = [
      RegExp(r'from\s+(\w+)', caseSensitive: false),
      RegExp(r'into\s+(\w+)', caseSensitive: false),
      RegExp(r'update\s+(\w+)', caseSensitive: false),
    ];
    
    for (final pattern in patterns) {
      final match = pattern.firstMatch(sql);
      if (match != null) {
        return match.group(1);
      }
    }
    
    return null;
  }
}

class SQLiteTable<T extends DatabaseModelInterface> implements DatabaseTableInterface<T> {
  final String tableName;
  final SQLiteService _database;

  SQLiteTable(this.tableName, this._database);

  @override
  Future<int> insert(T item) async {
    final query = DatabaseQuery(
      'INSERT INTO $tableName (${item.toMap().keys.join(', ')}) VALUES (${item.toMap().keys.map((_) => '?').join(', ')})',
      item.toMap().values.toList(),
    );
    return await _database.executeQuery(query);
  }

  @override
  Future<List<int>> insertBatch(List<T> items) async {
    final results = <int>[];
    for (final item in items) {
      results.add(await insert(item));
    }
    return results;
  }

  @override
  Future<T?> findById(dynamic id) async {
    final results = await findWhere('id = ?', [id]);
    return results.isNotEmpty ? results.first : null;
  }

  @override
  Future<List<T>> findAll() async {
    final query = DatabaseQuery('SELECT * FROM $tableName');
    final results = await _database.query(query);
    return _mapResults(results);
  }

  @override
  Future<List<T>> findWhere(String condition, [List<dynamic>? args]) async {
    final query = DatabaseQuery('SELECT * FROM $tableName WHERE $condition', args ?? []);
    final results = await _database.query(query);
    return _mapResults(results);
  }

  @override
  Future<T?> findFirst(String condition, [List<dynamic>? args]) async {
    final results = await findWhere(condition, args);
    return results.isNotEmpty ? results.first : null;
  }

  @override
  Future<int> update(T item) async {
    final map = item.toMap();
    final id = item.primaryKey;
    map.remove('id'); // Don't update ID
    
    final query = DatabaseQuery(
      'UPDATE $tableName SET ${map.keys.map((key) => '$key = ?').join(', ')} WHERE id = ?',
      [...map.values, id],
    );
    return await _database.executeQuery(query);
  }

  @override
  Future<int> updateBatch(List<T> items) async {
    int totalAffected = 0;
    for (final item in items) {
      totalAffected += await update(item);
    }
    return totalAffected;
  }

  @override
  Future<int> updateWhere(Map<String, dynamic> values, String condition, [List<dynamic>? args]) async {
    final query = DatabaseQuery(
      'UPDATE $tableName SET ${values.keys.map((key) => '$key = ?').join(', ')} WHERE $condition',
      [...values.values, ...?args],
    );
    return await _database.executeQuery(query);
  }

  @override
  Future<int> delete(dynamic id) async {
    final query = DatabaseQuery('DELETE FROM $tableName WHERE id = ?', [id]);
    return await _database.executeQuery(query);
  }

  @override
  Future<int> deleteBatch(List<dynamic> ids) async {
    if (ids.isEmpty) return 0;
    final placeholders = ids.map((_) => '?').join(', ');
    final query = DatabaseQuery('DELETE FROM $tableName WHERE id IN ($placeholders)', ids);
    return await _database.executeQuery(query);
  }

  @override
  Future<int> deleteWhere(String condition, [List<dynamic>? args]) async {
    final query = DatabaseQuery('DELETE FROM $tableName WHERE $condition', args ?? []);
    return await _database.executeQuery(query);
  }

  @override
  Future<int> count() async {
    final query = DatabaseQuery('SELECT COUNT(*) as count FROM $tableName');
    final results = await _database.query(query);
    return results.isNotEmpty ? results.first['count'] as int : 0;
  }

  @override
  Future<int> countWhere(String condition, [List<dynamic>? args]) async {
    final query = DatabaseQuery('SELECT COUNT(*) as count FROM $tableName WHERE $condition', args ?? []);
    final results = await _database.query(query);
    return results.isNotEmpty ? results.first['count'] as int : 0;
  }

  @override
  Future<bool> exists(dynamic id) async {
    final count = await countWhere('id = ?', [id]);
    return count > 0;
  }

  @override
  Future<List<T>> paginate(int page, int pageSize, {String? orderBy}) async {
    final offset = (page - 1) * pageSize;
    final orderClause = orderBy != null ? ' ORDER BY $orderBy' : '';
    final query = DatabaseQuery('SELECT * FROM $tableName$orderClause LIMIT ? OFFSET ?', [pageSize, offset]);
    final results = await _database.query(query);
    return _mapResults(results);
  }

  @override
  Future<void> truncate() async {
    final query = DatabaseQuery('DELETE FROM $tableName');
    await _database.executeQuery(query);
  }

  List<T> _mapResults(List<Map<String, dynamic>> results) {
    // This would need to be implemented based on the specific model type
    // For now, return empty list as this is a mock implementation
    return [];
  }
}
