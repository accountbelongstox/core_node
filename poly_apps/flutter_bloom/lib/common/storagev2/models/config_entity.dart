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

import 'storage_entity.dart';
import 'storage_result.dart';

/// Configuration entity for storing application settings
class ConfigEntity extends BaseStorageEntity {
  final String key;
  final dynamic value;
  final String? description;
  final bool isEncrypted;
  final String? category;
  final bool isReadOnly;
  final Map<String, dynamic> metadata;
  
  const ConfigEntity({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.version = 1,
    required this.key,
    required this.value,
    this.description,
    this.isEncrypted = false,
    this.category,
    this.isReadOnly = false,
    this.metadata = const {},
  });
  
  @override
  String get entityType => 'config';
  
  @override
  bool validate() {
    return super.validate() &&
           key.isNotEmpty &&
           value != null;
  }
  
  @override
  Map<String, dynamic> toMap() {
    return {
      ...super.toMap(),
      'key': key,
      'value': value,
      'description': description,
      'isEncrypted': isEncrypted,
      'category': category,
      'isReadOnly': isReadOnly,
      'metadata': metadata,
    };
  }
  
  static ConfigEntity fromMap(Map<String, dynamic> map) {
    return ConfigEntity(
      id: map['id'] as String,
      createdAt: DateTime.parse(map['createdAt'] as String),
      updatedAt: DateTime.parse(map['updatedAt'] as String),
      version: map['version'] as int? ?? 1,
      key: map['key'] as String,
      value: map['value'],
      description: map['description'] as String?,
      isEncrypted: map['isEncrypted'] as bool? ?? false,
      category: map['category'] as String?,
      isReadOnly: map['isReadOnly'] as bool? ?? false,
      metadata: Map<String, dynamic>.from(map['metadata'] ?? {}),
    );
  }
  
  @override
  StorageEntity copyWithUpdatedAt(DateTime updatedAt) {
    return copyWith(updatedAt: updatedAt);
  }
  
  @override
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
  
  ConfigEntity copyWith({
    String? id,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
    String? key,
    dynamic value,
    String? description,
    bool? isEncrypted,
    String? category,
    bool? isReadOnly,
    Map<String, dynamic>? metadata,
  }) {
    return ConfigEntity(
      id: id ?? this.id,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
      key: key ?? this.key,
      value: value ?? this.value,
      description: description ?? this.description,
      isEncrypted: isEncrypted ?? this.isEncrypted,
      category: category ?? this.category,
      isReadOnly: isReadOnly ?? this.isReadOnly,
      metadata: metadata ?? this.metadata,
    );
  }
  
  /// Create a new config entity
  factory ConfigEntity.create({
    required String key,
    required dynamic value,
    String? description,
    bool isEncrypted = false,
    String? category,
    bool isReadOnly = false,
    Map<String, dynamic>? metadata,
  }) {
    final now = DateTime.now();
    return ConfigEntity(
      id: key, // Use key as ID for easy lookup
      createdAt: now,
      updatedAt: now,
      key: key,
      value: value,
      description: description,
      isEncrypted: isEncrypted,
      category: category,
      isReadOnly: isReadOnly,
      metadata: metadata ?? {},
    );
  }
  
  /// Update config value
  ConfigEntity updateValue(dynamic newValue) {
    if (isReadOnly) {
      throw StateError('Cannot update read-only config: $key');
    }
    
    return copyWith(
      value: newValue,
      updatedAt: DateTime.now(),
    );
  }
  
  /// Mark as encrypted
  ConfigEntity markAsEncrypted() {
    return copyWith(
      isEncrypted: true,
      updatedAt: DateTime.now(),
    );
  }
  
  /// Mark as read-only
  ConfigEntity markAsReadOnly() {
    return copyWith(
      isReadOnly: true,
      updatedAt: DateTime.now(),
    );
  }
  
  /// Get typed value
  T? getValueAs<T>() {
    if (value is T) {
      return value as T;
    }
    return null;
  }
  
  /// Get string value
  String? getStringValue() => getValueAs<String>();
  
  /// Get int value
  int? getIntValue() => getValueAs<int>();
  
  /// Get double value
  double? getDoubleValue() => getValueAs<double>();
  
  /// Get bool value
  bool? getBoolValue() => getValueAs<bool>();
  
  /// Get map value
  Map<String, dynamic>? getMapValue() => getValueAs<Map<String, dynamic>>();
  
  /// Get list value
  List<dynamic>? getListValue() => getValueAs<List<dynamic>>();
  
  @override
  String toString() => 'ConfigEntity(key: $key, value: $value, isEncrypted: $isEncrypted)';
  
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ConfigEntity &&
          super == other &&
          other.key == key &&
          other.value == value);
  
  @override
  int get hashCode => Object.hash(super.hashCode, key, value);
}
