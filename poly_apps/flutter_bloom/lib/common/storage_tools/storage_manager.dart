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


