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

import 'interfaces/storage_interface.dart';
import 'adapters/storage_adapter_factory.dart';
import 'models/storage_models.dart';

/// Facade manager that exposes a simple and unified API for storage access.
/// Platform-aware: uses SQLite on mobile/desktop, localStorage on web.
class StorageManager implements KeyValueStorageInterface {
  static StorageManager? _instance;
  static StorageManager get instance => _instance ??= StorageManager._internal();

  StorageManager._internal();

  final KeyValueStorageInterface _backend = StorageAdapterFactory.getAdapter();

  @override
  Future<void> init({String? appName, String? subDirectory}) {
    return _backend.init(appName: appName, subDirectory: subDirectory);
  }

  @override
  Future<void> openBox(String boxName) => _backend.openBox(boxName);

  @override
  bool isBoxOpen(String boxName) => _backend.isBoxOpen(boxName);

  @override
  Future<void> closeBox(String boxName) => _backend.closeBox(boxName);

  @override
  Future<void> deleteBox(String boxName) => _backend.deleteBox(boxName);

  @override
  Future<void> clearBox(String boxName) => _backend.clearBox(boxName);

  @override
  Future<T?> getValue<T>(String boxName, String key, {T? defaultValue}) {
    return _backend.getValue<T>(boxName, key, defaultValue: defaultValue);
  }

  @override
  Future<void> putValue<T>(String boxName, String key, T value) {
    return _backend.putValue<T>(boxName, key, value);
  }

  @override
  Future<void> deleteKey(String boxName, String key) {
    return _backend.deleteKey(boxName, key);
  }

  @override
  Future<bool> containsKey(String boxName, String key) {
    return _backend.containsKey(boxName, key);
  }

  @override
  Future<Iterable<dynamic>> getKeys(String boxName) {
    return _backend.getKeys(boxName);
  }

  @override
  Future<Map<String, dynamic>> getAllFromBox(String boxName) {
    return _backend.getAllFromBox(boxName);
  }

  @override
  Stream<StorageChange> watchBox(String boxName, {String? key}) {
    return _backend.watchBox(boxName, key: key);
  }
}


