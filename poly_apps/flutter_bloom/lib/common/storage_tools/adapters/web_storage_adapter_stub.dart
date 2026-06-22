// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
