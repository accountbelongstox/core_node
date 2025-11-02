import 'package:qyflutter/common/storage/unified_storage.dart';

/// Simple storage service wrapper for VIP Club
/// Provides getString/setString/remove methods wrapping UnifiedStorage
class VipClubStorageService {
  static const String _vipClubBox = 'vipclub_storage';

  /// Initialize storage
  Future<void> init() async {
    if (!UnifiedStorage.isInitialized) {
      await UnifiedStorage.init(appName: 'vipclub');
    }
  }

  /// Get string value
  Future<String?> getString(String key) async {
    return await UnifiedStorage.get<String>(key, box: _vipClubBox);
  }

  /// Set string value
  Future<void> setString(String key, String value) async {
    await UnifiedStorage.set<String>(key, value, box: _vipClubBox);
  }

  /// Remove value
  Future<void> remove(String key) async {
    await UnifiedStorage.remove(key, box: _vipClubBox);
  }

  /// Get bool value
  Future<bool?> getBool(String key) async {
    return await UnifiedStorage.get<bool>(key, box: _vipClubBox);
  }

  /// Set bool value
  Future<void> setBool(String key, bool value) async {
    await UnifiedStorage.set<bool>(key, value, box: _vipClubBox);
  }

  /// Get int value
  Future<int?> getInt(String key) async {
    return await UnifiedStorage.get<int>(key, box: _vipClubBox);
  }

  /// Set int value
  Future<void> setInt(String key, int value) async {
    await UnifiedStorage.set<int>(key, value, box: _vipClubBox);
  }

  /// Clear all VIP Club storage
  Future<void> clear() async {
    await UnifiedStorage.clearBox(_vipClubBox);
  }
}
