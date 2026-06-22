// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import '../models/storage_result.dart';
import '../models/storage_entity.dart';

/// Repository interface for storage operations
/// Uses StorageResult for functional error handling
abstract class StorageRepository<T extends StorageEntity> {
  /// Initialize the repository
  Future<StorageResult<void>> initialize();
  
  /// Save entity (create or update)
  Future<StorageResult<T>> save(T entity);
  
  /// Get entity by id
  Future<StorageResult<T?>> getById(String id);
  
  /// Get all entities
  Future<StorageResult<List<T>>> getAll();
  
  /// Update entity
  Future<StorageResult<T>> update(T entity);
  
  /// Delete entity by id
  Future<StorageResult<void>> deleteById(String id);
  
  /// Delete all entities
  Future<StorageResult<void>> deleteAll();
  
  /// Check if entity exists
  Future<StorageResult<bool>> exists(String id);
  
  /// Get entities by criteria
  Future<StorageResult<List<T>>> getByCriteria(Map<String, dynamic> criteria);
  
  /// Get entities by criteria with pagination
  Future<StorageResult<PaginatedResult<T>>> getByCriteriaPaginated(
    Map<String, dynamic> criteria, {
    int page = 1,
    int limit = 20,
    String? sortBy,
    bool ascending = true,
  });
  
  /// Batch operations
  Future<StorageResult<List<T>>> saveBatch(List<T> entities);
  Future<StorageResult<void>> deleteBatch(List<String> ids);
  
  /// Transaction support
  Future<StorageResult<R>> transaction<R>(
    Future<StorageResult<R>> Function() operation,
  );
  
  /// Watch for changes
  Stream<StorageResult<StorageChange<T>>> watch({String? id});
  
  /// Get repository statistics
  Future<StorageResult<RepositoryStats>> getStats();
  
  /// Close repository
  Future<StorageResult<void>> close();
}

/// Paginated result for queries
class PaginatedResult<T> {
  final List<T> data;
  final int currentPage;
  final int totalPages;
  final int totalCount;
  final bool hasNextPage;
  final bool hasPreviousPage;
  
  const PaginatedResult({
    required this.data,
    required this.currentPage,
    required this.totalPages,
    required this.totalCount,
    required this.hasNextPage,
    required this.hasPreviousPage,
  });
  
  /// Current page is first
  bool get isFirst => currentPage == 1;
  
  /// Current page is last
  bool get isLast => currentPage == totalPages;
  
  @override
  String toString() => 'PaginatedResult(page: $currentPage/$totalPages, total: $totalCount)';
}

/// Repository statistics
class RepositoryStats {
  final String entityType;
  final int totalEntities;
  final int totalSize;
  final DateTime lastUpdated;
  final Map<String, dynamic> customStats;
  
  const RepositoryStats({
    required this.entityType,
    required this.totalEntities,
    required this.totalSize,
    required this.lastUpdated,
    this.customStats = const {},
  });
  
  @override
  String toString() => 'RepositoryStats(type: $entityType, total: $totalEntities, size: $totalSize)';
}
