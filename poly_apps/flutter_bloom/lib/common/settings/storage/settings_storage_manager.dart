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

import 'dart:convert';
import '../models/setting_item.dart';
import '../../storage_tools/storage_manager.dart';

/// Settings Storage Manager
/// Handles persistent storage of settings using the common storage system
class SettingsStorageManager {
  static const String _settingsBoxName = 'app_settings';
  static const String _settingsPrefix = 'setting_';
  
  final StorageManager _storageManager;
  
  SettingsStorageManager(this._storageManager);

  /// Initialize the settings storage
  Future<void> initialize() async {
    await _storageManager.init(appName: 'flutter_bloom', subDirectory: 'settings');
    await _storageManager.openBox(_settingsBoxName);
  }

  /// Save a setting value to persistent storage
  Future<void> saveSetting(SettingItem setting, dynamic value) async {
    // Skip caching if disabled for this setting
    if (setting.disableCache) {
      return;
    }

    final key = _getStorageKey(setting);
    
    try {
      // Convert value based on setting type
      final serializedValue = _serializeValue(setting, value);
      
      await _storageManager.putValue(_settingsBoxName, key, serializedValue);
    } catch (e) {
      throw SettingsStorageException('Failed to save setting ${setting.key}: $e');
    }
  }

  /// Load a setting value from persistent storage
  Future<T?> loadSetting<T>(SettingItem setting) async {
    // Skip loading if caching is disabled for this setting
    if (setting.disableCache) {
      return setting.defaultValue as T?;
    }

    final key = _getStorageKey(setting);
    
    try {
      final serializedValue = await _storageManager.getValue(_settingsBoxName, key);
      
      if (serializedValue == null) {
        return setting.defaultValue as T?;
      }
      
      // Deserialize value based on setting type
      return _deserializeValue<T>(setting, serializedValue);
    } catch (e) {
      // Return default value if loading fails
      return setting.defaultValue as T?;
    }
  }

  /// Load all settings for a list of setting items
  Future<Map<String, dynamic>> loadAllSettings(List<SettingItem> settings) async {
    final Map<String, dynamic> loadedSettings = {};
    
    for (final setting in settings) {
      final value = await loadSetting(setting);
      loadedSettings[setting.key] = value ?? setting.defaultValue;
    }
    
    return loadedSettings;
  }

  /// Save multiple settings at once
  Future<void> saveAllSettings(Map<SettingItem, dynamic> settingsMap) async {
    final List<Future<void>> saveTasks = [];
    
    for (final entry in settingsMap.entries) {
      saveTasks.add(saveSetting(entry.key, entry.value));
    }
    
    await Future.wait(saveTasks);
  }

  /// Remove a setting from storage
  Future<void> removeSetting(SettingItem setting) async {
    final key = _getStorageKey(setting);
    
    try {
      await _storageManager.deleteKey(_settingsBoxName, key);
    } catch (e) {
      throw SettingsStorageException('Failed to remove setting ${setting.key}: $e');
    }
  }

  /// Clear all settings from storage
  Future<void> clearAllSettings() async {
    try {
      await _storageManager.clearBox(_settingsBoxName);
    } catch (e) {
      throw SettingsStorageException('Failed to clear all settings: $e');
    }
  }

  /// Check if a setting exists in storage
  Future<bool> hasSetting(SettingItem setting) async {
    if (setting.disableCache) {
      return false;
    }
    
    final key = _getStorageKey(setting);
    return await _storageManager.containsKey(_settingsBoxName, key);
  }

  /// Get storage statistics
  Future<Map<String, dynamic>> getStorageStats() async {
    try {
      final keys = await _storageManager.getKeys(_settingsBoxName);
      final settingKeys = keys.where((key) => key.startsWith(_settingsPrefix)).toList();
      
      return {
        'totalSettings': settingKeys.length,
        'storageKeys': settingKeys,
        'boxName': _settingsBoxName,
      };
    } catch (e) {
      return {
        'totalSettings': 0,
        'storageKeys': <String>[],
        'boxName': _settingsBoxName,
        'error': e.toString(),
      };
    }
  }

  /// Generate storage key for a setting
  String _getStorageKey(SettingItem setting) {
    if (setting.appId != null) {
      return '$_settingsPrefix${setting.appId}_${setting.key}';
    }
    return '$_settingsPrefix${setting.key}';
  }

  /// Serialize value based on setting type
  dynamic _serializeValue(SettingItem setting, dynamic value) {
    switch (setting.type) {
      case SettingType.toggle:
        return value as bool;
      
      case SettingType.select:
      case SettingType.textInput:
        return value.toString();
      
      case SettingType.checkbox:
        // Store as JSON string for list values
        if (value is List) {
          return jsonEncode(value.map((e) => e.toString()).toList());
        }
        return jsonEncode([]);
      
      case SettingType.slider:
        return value as double;
      
      case SettingType.colorPicker:
        // Store color as hex string
        return value.toString();
      
      case SettingType.number:
        return value as int;
      
      case SettingType.custom:
        // For custom types, try to serialize as JSON
        try {
          return jsonEncode(value);
        } catch (e) {
          return value.toString();
        }
      
      default:
        return value.toString();
    }
  }

  /// Deserialize value based on setting type
  T? _deserializeValue<T>(SettingItem setting, dynamic serializedValue) {
    try {
      switch (setting.type) {
        case SettingType.toggle:
          if (serializedValue is bool) {
            return serializedValue as T;
          }
          return bool.parse(serializedValue.toString()) as T;
        
        case SettingType.select:
        case SettingType.textInput:
          return serializedValue.toString() as T;
        
        case SettingType.checkbox:
          if (serializedValue is String) {
            final List<dynamic> decoded = jsonDecode(serializedValue);
            return decoded.cast<String>() as T;
          }
          return serializedValue as T;
        
        case SettingType.slider:
          if (serializedValue is double) {
            return serializedValue as T;
          }
          return double.parse(serializedValue.toString()) as T;
        
        case SettingType.colorPicker:
          return serializedValue.toString() as T;
        
        case SettingType.number:
          if (serializedValue is int) {
            return serializedValue as T;
          }
          return int.parse(serializedValue.toString()) as T;
        
        case SettingType.custom:
          // Try to deserialize from JSON
          try {
            return jsonDecode(serializedValue.toString()) as T;
          } catch (e) {
            return serializedValue as T;
          }
        
        default:
          return serializedValue as T;
      }
    } catch (e) {
      // Return default value if deserialization fails
      return setting.defaultValue as T;
    }
  }

  /// Dispose resources
  Future<void> dispose() async {
    // Storage manager disposal is handled by the main app
  }
}

/// Settings storage exception
class SettingsStorageException implements Exception {
  final String message;
  
  const SettingsStorageException(this.message);
  
  @override
  String toString() => 'SettingsStorageException: $message';
}
