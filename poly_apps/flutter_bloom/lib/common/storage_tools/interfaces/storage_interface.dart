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

import '../models/storage_models.dart';

/// Abstract key-value storage interface for app-wide usage.
/// This API is backend-agnostic. Default implementation uses Hive.
abstract class KeyValueStorageInterface {
  /// Initialize storage backend (idempotent).
  Future<void> init({String? appName, String? subDirectory});

  /// Open (or get) a box by name. Creates it if it does not exist.
  Future<void> openBox(String boxName);

  /// Whether a box is currently open.
  bool isBoxOpen(String boxName);

  /// Close a box.
  Future<void> closeBox(String boxName);

  /// Delete a box and all its data.
  Future<void> deleteBox(String boxName);

  /// Remove all entries from a box.
  Future<void> clearBox(String boxName);

  /// Get a value by key from a box.
  Future<T?> getValue<T>(String boxName, String key, {T? defaultValue});

  /// Put a value by key into a box.
  Future<void> putValue<T>(String boxName, String key, T value);

  /// Delete a key from a box.
  Future<void> deleteKey(String boxName, String key);

  /// Check if a key exists in a box.
  Future<bool> containsKey(String boxName, String key);

  /// All keys in a box.
  Future<Iterable<dynamic>> getKeys(String boxName);

  /// Get all key-value pairs from a box.
  Future<Map<String, dynamic>> getAllFromBox(String boxName);

  /// Watch changes from a box (optionally for a specific key).
  Stream<StorageChange> watchBox(String boxName, {String? key});
}


