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
