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
import 'package:hive_flutter/hive_flutter.dart';
import '../interfaces/storage_interface.dart';
import '../models/storage_models.dart';

class HiveStorage implements KeyValueStorageInterface {
  static HiveStorage? _instance;
  static HiveStorage get instance => _instance ??= HiveStorage._internal();

  HiveStorage._internal();

  bool _isInitialized = false;
  final Map<String, StreamController<StorageChange>> _boxControllers = {};

  @override
  Future<void> init({String? appName, String? subDirectory}) async {
    if (_isInitialized) return;
    await Hive.initFlutter(subDirectory);
    _isInitialized = true;
  }

  @override
  Future<void> openBox(String boxName) async {
    if (!Hive.isBoxOpen(boxName)) {
      await Hive.openBox(boxName);
      _setupWatch(boxName);
    }
  }

  @override
  bool isBoxOpen(String boxName) {
    return Hive.isBoxOpen(boxName);
  }

  @override
  Future<void> closeBox(String boxName) async {
    if (Hive.isBoxOpen(boxName)) {
      await Hive.box(boxName).close();
    }
    _boxControllers.remove(boxName)?.close();
  }

  @override
  Future<void> deleteBox(String boxName) async {
    if (Hive.isBoxOpen(boxName)) {
      await Hive.box(boxName).deleteFromDisk();
    } else {
      await Hive.deleteBoxFromDisk(boxName);
    }
    _boxControllers.remove(boxName)?.close();
  }

  @override
  Future<void> clearBox(String boxName) async {
    if (!Hive.isBoxOpen(boxName)) {
      await openBox(boxName);
    }
    await Hive.box(boxName).clear();
  }

  @override
  Future<T?> getValue<T>(String boxName, String key, {T? defaultValue}) async {
    if (!Hive.isBoxOpen(boxName)) {
      await openBox(boxName);
    }
    final value = Hive.box(boxName).get(key, defaultValue: defaultValue);
    return value as T?;
  }

  @override
  Future<void> putValue<T>(String boxName, String key, T value) async {
    if (!Hive.isBoxOpen(boxName)) {
      await openBox(boxName);
    }
    await Hive.box(boxName).put(key, value);
  }

  @override
  Future<void> deleteKey(String boxName, String key) async {
    if (!Hive.isBoxOpen(boxName)) {
      await openBox(boxName);
    }
    await Hive.box(boxName).delete(key);
  }

  @override
  Future<bool> containsKey(String boxName, String key) async {
    if (!Hive.isBoxOpen(boxName)) {
      await openBox(boxName);
    }
    return Hive.box(boxName).containsKey(key);
  }

  @override
  Future<Iterable<dynamic>> getKeys(String boxName) async {
    if (!Hive.isBoxOpen(boxName)) {
      await openBox(boxName);
    }
    return Hive.box(boxName).keys;
  }

  @override
  Future<Map<String, dynamic>> getAllFromBox(String boxName) async {
    if (!Hive.isBoxOpen(boxName)) {
      await openBox(boxName);
    }
    final box = Hive.box(boxName);
    final result = <String, dynamic>{};
    for (final key in box.keys) {
      result[key.toString()] = box.get(key);
    }
    return result;
  }

  @override
  Stream<StorageChange> watchBox(String boxName, {String? key}) {
    _setupWatch(boxName);
    if (key != null) {
      return _boxControllers[boxName]!
          .stream
          .where((event) => event.key == key);
    }
    return _boxControllers[boxName]!.stream;
  }

  void _setupWatch(String boxName) {
    if (_boxControllers.containsKey(boxName)) return;
    _boxControllers[boxName] = StreamController<StorageChange>.broadcast();

    if (!Hive.isBoxOpen(boxName)) return;
    final box = Hive.box(boxName);
    box.watch().listen((event) {
      final change = StorageChange(
        key: event.key?.toString(),
        oldValue: null, // Hive doesn't provide old value
        newValue: event.value,
        type: event.deleted ? StorageChangeType.deleted : StorageChangeType.updated,
        timestamp: DateTime.now(),
      );
      _boxControllers[boxName]!.add(change);
      if (kDebugMode) {
        print('HiveStorage change => box: $boxName, key: ${event.key}, deleted: ${event.deleted}');
      }
    });
  }
}


