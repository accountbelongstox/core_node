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

import 'storage_result.dart';

/// Base interface for all storage entities
abstract class StorageEntity {
  /// Unique identifier
  String get id;
  
  /// Creation timestamp
  DateTime get createdAt;
  
  /// Last update timestamp
  DateTime get updatedAt;
  
  /// Convert to map for serialization
  Map<String, dynamic> toMap();
  
  /// Create from map for deserialization
  static T fromMap<T extends StorageEntity>(Map<String, dynamic> map) {
    throw UnimplementedError('fromMap must be implemented by concrete classes');
  }
  
  /// Validate entity data
  bool validate();
  
  /// Get entity type
  String get entityType;
  
  /// Get entity version for migration
  int get version;
  
  /// Check if entity is valid for storage
  StorageResult<void> validateForStorage() {
    if (!validate()) {
      return StorageError.withCode(
        'INVALID_ENTITY',
        'Entity validation failed',
        metadata: {'entityType': entityType, 'id': id},
      );
    }
    
    if (id.isEmpty) {
      return StorageError.withCode(
        'EMPTY_ID',
        'Entity ID cannot be empty',
        metadata: {'entityType': entityType},
      );
    }
    
    if (createdAt.isAfter(updatedAt)) {
      return StorageError.withCode(
        'INVALID_TIMESTAMPS',
        'CreatedAt cannot be after UpdatedAt',
        metadata: {'entityType': entityType, 'id': id},
      );
    }
    
    return const StorageSuccess(null);
  }
  
  /// Create a copy with updated timestamp
  StorageEntity copyWithUpdatedAt(DateTime updatedAt);
  
  @override
  String toString() => '$entityType(id: $id, createdAt: $createdAt, updatedAt: $updatedAt)';
  
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StorageEntity &&
          other.id == id &&
          other.entityType == entityType);
  
  @override
  int get hashCode => Object.hash(id, entityType);
}

/// Base implementation for storage entities
abstract class BaseStorageEntity implements StorageEntity {
  @override
  final String id;
  
  @override
  final DateTime createdAt;
  
  @override
  final DateTime updatedAt;
  
  @override
  final int version;
  
  const BaseStorageEntity({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.version = 1,
  });
  
  @override
  bool validate() {
    return id.isNotEmpty &&
           createdAt.isBefore(updatedAt) &&
           version > 0;
  }
  
  @override
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'version': version,
      'entityType': entityType,
    };
  }
  
  @override
  String toString() => '$entityType(id: $id, version: $version)';
  
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BaseStorageEntity &&
          other.id == id &&
          other.entityType == entityType &&
          other.version == version);
  
  @override
  int get hashCode => Object.hash(id, entityType, version);
}
