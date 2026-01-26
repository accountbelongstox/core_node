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

/// Endpoint Storage Implementation for Bank App
/// 
/// Uses PrefsAppBank for persistent storage
library;

import 'package:qyflutter/common/network/core/api_endpoint_manager.dart';
import 'prefs_app_bank.dart';

/// Endpoint storage adapter for Bank app
class EndpointStorageAppBank implements EndpointStorage {
  final PrefsAppBank _prefs;

  EndpointStorageAppBank(this._prefs);

  @override
  Future<String?> getCurrentEndpointId() async {
    if (!_prefs.isInitialized) {
      await _prefs.initSharedPreferences();
    }
    return _prefs.getString('api_current_endpoint');
  }

  @override
  Future<String?> getAutoDetectedEndpointId() async {
    if (!_prefs.isInitialized) {
      await _prefs.initSharedPreferences();
    }
    return _prefs.getString('api_auto_detected');
  }

  @override
  Future<String?> getUserModifiedEndpointId() async {
    if (!_prefs.isInitialized) {
      await _prefs.initSharedPreferences();
    }
    return _prefs.getString('api_user_modified');
  }

  @override
  Future<void> setCurrentEndpointId(String id) async {
    if (!_prefs.isInitialized) {
      await _prefs.initSharedPreferences();
    }
    await _prefs.setString('api_current_endpoint', id);
  }

  @override
  Future<void> setAutoDetectedEndpointId(String id) async {
    if (!_prefs.isInitialized) {
      await _prefs.initSharedPreferences();
    }
    await _prefs.setString('api_auto_detected', id);
  }

  @override
  Future<void> setUserModifiedEndpointId(String id) async {
    if (!_prefs.isInitialized) {
      await _prefs.initSharedPreferences();
    }
    await _prefs.setString('api_user_modified', id);
  }

  @override
  Future<void> clearAll() async {
    if (!_prefs.isInitialized) {
      await _prefs.initSharedPreferences();
    }
    await _prefs.remove('api_current_endpoint');
    await _prefs.remove('api_auto_detected');
    await _prefs.remove('api_user_modified');
  }
}
