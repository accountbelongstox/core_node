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

// CREATED BY: AI Assistant for unified Provider architecture
// NOTE FOR OTHER AIs: This provider only provides basic key-value state management
// Apps should extend this for their specific needs, not add business logic here

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Base Provider for key-value state management
/// Provides basic state management functionality that apps can extend
/// Does NOT contain business logic like bookmarks, user data, etc.
class BaseProvider extends ChangeNotifier {
  final SharedPreferences _prefs;
  final String _keyPrefix;
  
  // Internal state storage
  final Map<String, dynamic> _state = {};
  bool _isLoading = false;
  String? _errorMessage;

  // Basic getters
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Map<String, dynamic> get state => Map.from(_state);

  BaseProvider(this._prefs, {String keyPrefix = ''}) : _keyPrefix = keyPrefix {
    _loadStateFromPrefs();
  }

  /// Load state from SharedPreferences
  void _loadStateFromPrefs() {
    try {
      final keys = _prefs.getKeys().where((key) => key.startsWith(_keyPrefix));
      for (final key in keys) {
        final cleanKey = key.replaceFirst(_keyPrefix, '');
        final value = _prefs.get(key);
        _state[cleanKey] = value;
      }
    } catch (e) {
      _errorMessage = 'Failed to load state: ${e.toString()}';
    }
  }

  /// Get value by key with type safety
  T? getValue<T>(String key, [T? defaultValue]) {
    final value = _state[key];
    if (value is T) {
      return value;
    }
    return defaultValue;
  }

  /// Set value by key (synchronous)
  void setValue<T>(String key, T value) {
    _state[key] = value;
    _saveToPrefs(key, value);
    notifyListeners();
  }

  /// Set value by key (asynchronous)
  Future<void> setValueAsync<T>(String key, T value) async {
    _isLoading = true;
    notifyListeners();

    try {
      _state[key] = value;
      await _saveToPrefsAsync(key, value);
      _errorMessage = null;
    } catch (e) {
      _errorMessage = 'Failed to save $key: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Remove value by key
  void removeValue(String key) {
    _state.remove(key);
    _prefs.remove('$_keyPrefix$key');
    notifyListeners();
  }

  /// Clear all values
  Future<void> clearAll() async {
    _isLoading = true;
    notifyListeners();

    try {
      final keys = _prefs.getKeys().where((key) => key.startsWith(_keyPrefix));
      for (final key in keys) {
        await _prefs.remove(key);
      }
      _state.clear();
      _errorMessage = null;
    } catch (e) {
      _errorMessage = 'Failed to clear state: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Check if key exists
  bool hasKey(String key) {
    return _state.containsKey(key);
  }

  /// Get all keys
  List<String> getKeys() {
    return _state.keys.toList();
  }

  /// Save to SharedPreferences (synchronous)
  void _saveToPrefs<T>(String key, T value) {
    final prefKey = '$_keyPrefix$key';
    try {
      if (value is String) {
        _prefs.setString(prefKey, value);
      } else if (value is int) {
        _prefs.setInt(prefKey, value);
      } else if (value is double) {
        _prefs.setDouble(prefKey, value);
      } else if (value is bool) {
        _prefs.setBool(prefKey, value);
      } else if (value is List<String>) {
        _prefs.setStringList(prefKey, value);
      } else {
        // For complex objects, convert to string
        _prefs.setString(prefKey, value.toString());
      }
    } catch (e) {
      _errorMessage = 'Failed to save $key: ${e.toString()}';
    }
  }

  /// Save to SharedPreferences (asynchronous)
  Future<void> _saveToPrefsAsync<T>(String key, T value) async {
    final prefKey = '$_keyPrefix$key';
    if (value is String) {
      await _prefs.setString(prefKey, value);
    } else if (value is int) {
      await _prefs.setInt(prefKey, value);
    } else if (value is double) {
      await _prefs.setDouble(prefKey, value);
    } else if (value is bool) {
      await _prefs.setBool(prefKey, value);
    } else if (value is List<String>) {
      await _prefs.setStringList(prefKey, value);
    } else {
      // For complex objects, convert to string
      await _prefs.setString(prefKey, value.toString());
    }
  }

  /// Clear error message
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Batch update multiple values
  Future<void> batchUpdate(Map<String, dynamic> updates) async {
    _isLoading = true;
    notifyListeners();

    try {
      for (final entry in updates.entries) {
        _state[entry.key] = entry.value;
        await _saveToPrefsAsync(entry.key, entry.value);
      }
      _errorMessage = null;
    } catch (e) {
      _errorMessage = 'Failed to batch update: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Get values by pattern
  Map<String, dynamic> getValuesByPattern(String pattern) {
    final regex = RegExp(pattern);
    final result = <String, dynamic>{};
    for (final entry in _state.entries) {
      if (regex.hasMatch(entry.key)) {
        result[entry.key] = entry.value;
      }
    }
    return result;
  }

  /// Count values
  int get valueCount => _state.length;

  /// Check if empty
  bool get isEmpty => _state.isEmpty;

  /// Check if not empty
  bool get isNotEmpty => _state.isNotEmpty;

  /// Get state snapshot
  Map<String, dynamic> getSnapshot() {
    return Map.from(_state);
  }

  /// Restore from snapshot
  Future<void> restoreFromSnapshot(Map<String, dynamic> snapshot) async {
    await clearAll();
    await batchUpdate(snapshot);
  }

  /// Export state as JSON string
  String exportAsJson() {
    try {
      return _state.toString(); // Simple string representation
    } catch (e) {
      return '{}';
    }
  }

  /// Debug information
  Map<String, dynamic> getDebugInfo() {
    return {
      'keyPrefix': _keyPrefix,
      'valueCount': valueCount,
      'isLoading': isLoading,
      'hasError': errorMessage != null,
      'errorMessage': errorMessage,
      'keys': getKeys(),
    };
  }
}
