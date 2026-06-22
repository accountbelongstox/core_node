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

abstract class DatabaseInterface {
  Future<void> initialize();
  Future<void> close();
  Future<bool> isInitialized();
  Future<void> clearDatabase();
  Future<int> getDatabaseVersion();
  Future<void> backup(String path);
  Future<void> restore(String path);
}

abstract class DatabaseTableInterface<T> {
  Future<int> insert(T item);
  Future<List<int>> insertBatch(List<T> items);
  Future<T?> findById(dynamic id);
  Future<List<T>> findAll();
  Future<List<T>> findWhere(String condition, [List<dynamic>? args]);
  Future<T?> findFirst(String condition, [List<dynamic>? args]);
  Future<int> update(T item);
  Future<int> updateBatch(List<T> items);
  Future<int> updateWhere(Map<String, dynamic> values, String condition, [List<dynamic>? args]);
  Future<int> delete(dynamic id);
  Future<int> deleteBatch(List<dynamic> ids);
  Future<int> deleteWhere(String condition, [List<dynamic>? args]);
  Future<int> count();
  Future<int> countWhere(String condition, [List<dynamic>? args]);
  Future<bool> exists(dynamic id);
  Future<List<T>> paginate(int page, int pageSize, {String? orderBy});
  Future<void> truncate();
}

abstract class DatabaseTransactionInterface {
  Future<void> begin();
  Future<void> commit();
  Future<void> rollback();
  Future<T> execute<T>(Future<T> Function() operation);
}

abstract class DatabaseMigrationInterface {
  int get version;
  String get description;
  Future<void> up(DatabaseInterface database);
  Future<void> down(DatabaseInterface database);
}

abstract class DatabaseModelInterface {
  Map<String, dynamic> toMap();
  void fromMap(Map<String, dynamic> map);
  dynamic get primaryKey;
  String get tableName;
  Map<String, String> get columnDefinitions;
  List<String> get indexes;
  Map<String, String> get foreignKeys;
}

enum DatabaseType {
  sqlite,
  indexedDB,
  memory
}

enum ColumnType {
  integer,
  text,
  real,
  blob,
  boolean,
  datetime
}

class DatabaseColumn {
  final String name;
  final ColumnType type;
  final bool isPrimaryKey;
  final bool isAutoIncrement;
  final bool isNotNull;
  final bool isUnique;
  final dynamic defaultValue;
  final String? foreignKeyTable;
  final String? foreignKeyColumn;

  const DatabaseColumn({
    required this.name,
    required this.type,
    this.isPrimaryKey = false,
    this.isAutoIncrement = false,
    this.isNotNull = false,
    this.isUnique = false,
    this.defaultValue,
    this.foreignKeyTable,
    this.foreignKeyColumn,
  });

  String get sqlDefinition {
    final buffer = StringBuffer();
    buffer.write('$name ');
    
    switch (type) {
      case ColumnType.integer:
        buffer.write('INTEGER');
        break;
      case ColumnType.text:
        buffer.write('TEXT');
        break;
      case ColumnType.real:
        buffer.write('REAL');
        break;
      case ColumnType.blob:
        buffer.write('BLOB');
        break;
      case ColumnType.boolean:
        buffer.write('INTEGER'); // SQLite doesn't have boolean
        break;
      case ColumnType.datetime:
        buffer.write('TEXT'); // Store as ISO string
        break;
    }

    if (isPrimaryKey) buffer.write(' PRIMARY KEY');
    if (isAutoIncrement) buffer.write(' AUTOINCREMENT');
    if (isNotNull) buffer.write(' NOT NULL');
    if (isUnique) buffer.write(' UNIQUE');
    if (defaultValue != null) {
      if (type == ColumnType.text || type == ColumnType.datetime) {
        buffer.write(' DEFAULT \'$defaultValue\'');
      } else {
        buffer.write(' DEFAULT $defaultValue');
      }
    }

    return buffer.toString();
  }
}

class DatabaseTable {
  final String name;
  final List<DatabaseColumn> columns;
  final List<String> indexes;
  final Map<String, String> foreignKeys;

  const DatabaseTable({
    required this.name,
    required this.columns,
    this.indexes = const [],
    this.foreignKeys = const {},
  });

  String get createTableSql {
    final buffer = StringBuffer();
    buffer.writeln('CREATE TABLE IF NOT EXISTS $name (');
    
    // Add columns
    final columnDefinitions = columns.map((col) => '  ${col.sqlDefinition}').toList();
    buffer.writeln(columnDefinitions.join(',\n'));
    
    // Add foreign keys
    if (foreignKeys.isNotEmpty) {
      for (final entry in foreignKeys.entries) {
        buffer.writeln(',  FOREIGN KEY (${entry.key}) REFERENCES ${entry.value}');
      }
    }
    
    buffer.writeln(');');
    
    // Add indexes
    for (final index in indexes) {
      buffer.writeln('CREATE INDEX IF NOT EXISTS idx_${name}_$index ON $name ($index);');
    }
    
    return buffer.toString();
  }

  String get dropTableSql => 'DROP TABLE IF EXISTS $name;';
}

class DatabaseQuery {
  final String sql;
  final List<dynamic> parameters;

  const DatabaseQuery(this.sql, [this.parameters = const []]);

  @override
  String toString() => 'DatabaseQuery(sql: $sql, parameters: $parameters)';
}

class DatabaseResult<T> {
  final List<T> data;
  final int totalCount;
  final bool hasMore;
  final int page;
  final int pageSize;

  const DatabaseResult({
    required this.data,
    required this.totalCount,
    this.hasMore = false,
    this.page = 1,
    this.pageSize = 10,
  });

  bool get isEmpty => data.isEmpty;
  bool get isNotEmpty => data.isNotEmpty;
  int get length => data.length;
  T? get first => data.isNotEmpty ? data.first : null;
  T? get last => data.isNotEmpty ? data.last : null;

  DatabaseResult<R> map<R>(R Function(T) transform) {
    return DatabaseResult<R>(
      data: data.map(transform).toList(),
      totalCount: totalCount,
      hasMore: hasMore,
      page: page,
      pageSize: pageSize,
    );
  }
}

class DatabaseException implements Exception {
  final String message;
  final String? query;
  final List<dynamic>? parameters;
  final dynamic originalError;

  const DatabaseException(
    this.message, {
    this.query,
    this.parameters,
    this.originalError,
  });

  @override
  String toString() {
    final buffer = StringBuffer();
    buffer.write('DatabaseException: $message');
    if (query != null) buffer.write('\nQuery: $query');
    if (parameters != null) buffer.write('\nParameters: $parameters');
    if (originalError != null) buffer.write('\nOriginal Error: $originalError');
    return buffer.toString();
  }
}

class DatabaseConnectionInfo {
  final String name;
  final String path;
  final int version;
  final DatabaseType type;
  final Map<String, dynamic> options;

  const DatabaseConnectionInfo({
    required this.name,
    required this.path,
    required this.version,
    required this.type,
    this.options = const {},
  });

  @override
  String toString() {
    return 'DatabaseConnectionInfo(name: $name, path: $path, version: $version, type: $type)';
  }
}
