import 'dart:async';
import '../interfaces/storage_interface.dart';
import '../models/storage_models.dart';

/// Stub implementation of WebStorageAdapter for non-web platforms
/// This is a no-op implementation that throws UnsupportedError
/// The actual WebStorageAdapter is only available on web platform
class WebStorageAdapter implements KeyValueStorageInterface {
  static WebStorageAdapter? _instance;
  static WebStorageAdapter get instance =>
      _instance ??= WebStorageAdapter._internal();

  WebStorageAdapter._internal();

  @override
  Future<void> init({String? appName, String? subDirectory}) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform. Use UnifiedSQLiteStorageAdapter instead.');
  }

  @override
  Future<void> openBox(String boxName) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  bool isBoxOpen(String boxName) {
    return false;
  }

  @override
  Future<void> closeBox(String boxName) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  Future<void> deleteBox(String boxName) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  Future<void> clearBox(String boxName) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  Future<T?> getValue<T>(String boxName, String key, {T? defaultValue}) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  Future<void> putValue<T>(String boxName, String key, T value) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  Future<void> deleteKey(String boxName, String key) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  Future<bool> containsKey(String boxName, String key) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  Future<Iterable<dynamic>> getKeys(String boxName) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  Future<Map<String, dynamic>> getAllFromBox(String boxName) async {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }

  @override
  Stream<StorageChange> watchBox(String boxName, {String? key}) {
    throw UnsupportedError(
        'WebStorageAdapter is not available on this platform.');
  }
}
