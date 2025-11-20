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

import 'package:flutter/material.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/settings/models/setting_item.dart';

class AppLockController extends ChangeNotifier {
  final SettingsController _settingsController;
  
  AppLockController(this._settingsController);

  List<SettingItem> get appLockSettings => _getAppLockSettings();

  bool get isLockEnabled => _settingsController.getSetting<bool>('app_lock_enabled', false) ?? false;
  
  String get lockType => _settingsController.getSetting<String>('app_lock_type', 'pin') ?? 'pin';
  
  bool get biometricEnabled => _settingsController.getSetting<bool>('app_lock_biometric', false) ?? false;
  
  int get autoLockTime => _settingsController.getSetting<int>('app_lock_auto_time', 5) ?? 5;

  List<SettingItem> _getAppLockSettings() {
    return [
      SettingItem.toggle(
        key: 'app_lock_enabled',
        name: 'Enable App Lock',
        description: 'Protect your app with a lock screen',
        defaultValue: false,
        category: 'security',
        isRequired: false,
      ),
      SettingItem.select(
        key: 'app_lock_type',
        name: 'Lock Type',
        description: 'Choose your preferred lock method',
        options: ['pin', 'pattern', 'password'],
        defaultValue: 'pin',
        labels: {
          'pin': 'PIN Code',
          'pattern': 'Pattern',
          'password': 'Password',
        },
        category: 'security',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'app_lock_biometric',
        name: 'Biometric Authentication',
        description: 'Use fingerprint or face recognition',
        defaultValue: false,
        category: 'security',
        isRequired: false,
      ),
      SettingItem.select(
        key: 'app_lock_auto_time',
        name: 'Auto Lock Time',
        description: 'Automatically lock after inactivity',
        options: ['1', '5', '10', '30'],
        defaultValue: '5',
        labels: {
          '1': '1 minute',
          '5': '5 minutes',
          '10': '10 minutes',
          '30': '30 minutes',
        },
        category: 'security',
        isRequired: false,
      ),
    ];
  }

  Future<void> updateSetting(String key, dynamic value) async {
    await _settingsController.setSetting(key, value);
    notifyListeners();
  }

  Future<void> changeLockCode(BuildContext context) async {
    // TODO: Implement lock code change dialog
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Lock code change feature coming soon'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  Future<void> resetAppLock(BuildContext context) async {
    await updateSetting('app_lock_enabled', false);
    await updateSetting('app_lock_type', 'pin');
    await updateSetting('app_lock_biometric', false);
    await updateSetting('app_lock_auto_time', 5);
    
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('App lock settings have been reset'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  T? getSetting<T>(String key, [T? defaultValue]) {
    return _settingsController.getSetting<T>(key, defaultValue);
  }
}
