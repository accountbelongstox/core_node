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

import 'package:flutter/foundation.dart';
import '../../../common/model/bank_user_model.dart';
import '../../../common/storage/storage_manager.dart';
import '../../../common/cache_manager/cache_manager.dart';
import '../../../common/provider_status/user_provider.dart';

/// Bank User Provider
/// Manages bank user data with persistent storage and caching
class BankUserProvider extends BaseUserProvider {
  static const String _boxName = 'bank_user_data';
  static const String _userKey = 'user_profile';
  static const String _globalDataKey = 'global_data';
  static const String _debugModeKey = 'debug_mode';

  BankUserModel? _user;
  BankGlobalData? _globalData;
  bool _isDebugMode = false;
  bool _isDashboardBalanceVisible = false; // Dashboard page balance visibility
  bool _isProfileBalanceVisible = false; // Profile page balance visibility
  bool _isInitialized = false;

  final StorageManager _storage = StorageManager.instance;
  final CacheManager _cache = CacheManager.instance;

  /// Get current user
  @override
  BankUserModel? get user => _user;

  /// Get global data
  BankGlobalData? get globalData => _globalData;

  /// Check if debug mode is enabled
  bool get isDebugMode => _isDebugMode;

  /// Check if dashboard balance is visible
  bool get isDashboardBalanceVisible => _isDashboardBalanceVisible;

  /// Check if profile balance is visible
  bool get isProfileBalanceVisible => _isProfileBalanceVisible;

  /// Check if provider is initialized
  bool get isInitialized => _isInitialized;

  @override
  bool get isAuthenticated => _user != null;

  @override
  String? get token => null; // Bank app doesn't use tokens

  @override
  String? get userToken => null;

  @override
  String? get tokenType => null;

  /// Initialize the provider
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize storage
      await _storage.init(appName: 'bank_app');
      await _storage.openBox(_boxName);

      // Load user data
      await _loadUserData();
      await _loadGlobalData();
      await _loadDebugMode();

      // Update session data
      await _updateSessionData();

      _isInitialized = true;
      notifyListeners();
    } catch (e) {
      debugPrint('BankUserProvider initialization error: $e');
      // Create default data if loading fails
      await _createDefaultData();
      _isInitialized = true;
      notifyListeners();
    }
  }

  /// Load user data from storage
  Future<void> _loadUserData() async {
    try {
      final userData = await _storage.getValue<String>(_boxName, _userKey);
      if (userData != null) {
        _user = BankUserModel.fromJsonString(userData);
      } else {
        _user = BankUserModel.defaultUser();
        await _saveUserData();
      }
    } catch (e) {
      debugPrint('Error loading user data: $e');
      _user = BankUserModel.defaultUser();
      await _saveUserData();
    }
  }

  /// Load global data from storage
  Future<void> _loadGlobalData() async {
    try {
      final globalDataString = await _storage.getValue<String>(_boxName, _globalDataKey);
      if (globalDataString != null) {
        _globalData = BankGlobalData.fromJsonString(globalDataString);
      } else {
        _globalData = BankGlobalData.defaultData();
        await _saveGlobalData();
      }
    } catch (e) {
      debugPrint('Error loading global data: $e');
      _globalData = BankGlobalData.defaultData();
      await _saveGlobalData();
    }
  }

  /// Load debug mode setting
  Future<void> _loadDebugMode() async {
    try {
      _isDebugMode = await _storage.getValue<bool>(_boxName, _debugModeKey) ?? false;
    } catch (e) {
      debugPrint('Error loading debug mode: $e');
      _isDebugMode = false;
    }
  }

  /// Update session data
  Future<void> _updateSessionData() async {
    if (_globalData == null) return;

    final now = DateTime.now();
    _globalData = _globalData!.copyWith(
      lastActiveTime: now,
      sessionCount: _globalData!.sessionCount + 1,
    );

    await _saveGlobalData();
  }

  /// Create default data
  Future<void> _createDefaultData() async {
    _user = BankUserModel.defaultUser();
    _globalData = BankGlobalData.defaultData();
    _isDebugMode = false;

    await _saveUserData();
    await _saveGlobalData();
    await _saveDebugMode();
  }

  /// Save user data to storage
  Future<void> _saveUserData() async {
    if (_user == null) return;
    try {
      await _storage.putValue(_boxName, _userKey, _user!.toJsonString());
      // Cache the data for quick access
      await _cache.put('bank_user', 'user_data', _user!, ttl: const Duration(hours: 24));
    } catch (e) {
      debugPrint('Error saving user data: $e');
    }
  }

  /// Save global data to storage
  Future<void> _saveGlobalData() async {
    if (_globalData == null) return;
    try {
      await _storage.putValue(_boxName, _globalDataKey, _globalData!.toJsonString());
    } catch (e) {
      debugPrint('Error saving global data: $e');
    }
  }

  /// Save debug mode setting
  Future<void> _saveDebugMode() async {
    try {
      await _storage.putValue(_boxName, _debugModeKey, _isDebugMode);
    } catch (e) {
      debugPrint('Error saving debug mode: $e');
    }
  }

  /// Update user data
  Future<void> updateUser({
    String? name,
    String? location,
    double? balance,
    int? cardCount,
    int? points,
    int? coupons,
    String? creditCardLevel,
  }) async {
    if (_user == null) return;

    _user = _user!.copyWith(
      name: name,
      location: location,
      balance: balance,
      cardCount: cardCount,
      points: points,
      coupons: coupons,
      creditCardLevel: creditCardLevel,
    );

    await _saveUserData();
    notifyListeners();
  }

  /// Set debug mode
  Future<void> setDebugMode(bool enabled) async {
    _isDebugMode = enabled;
    await _saveDebugMode();
    notifyListeners();
  }

  /// Toggle dashboard balance visibility
  void toggleDashboardBalanceVisibility() {
    _isDashboardBalanceVisible = !_isDashboardBalanceVisible;
    notifyListeners();
  }

  /// Toggle profile balance visibility
  void toggleProfileBalanceVisibility() {
    _isProfileBalanceVisible = !_isProfileBalanceVisible;
    notifyListeners();
  }

  /// Set dashboard balance visibility
  void setDashboardBalanceVisibility(bool visible) {
    _isDashboardBalanceVisible = visible;
    notifyListeners();
  }

  /// Set profile balance visibility
  void setProfileBalanceVisibility(bool visible) {
    _isProfileBalanceVisible = visible;
    notifyListeners();
  }

  /// Reset to default data
  Future<void> resetToDefault() async {
    await _createDefaultData();
    notifyListeners();
  }

  /// Update last active time
  Future<void> updateLastActiveTime() async {
    if (_globalData == null) return;

    _globalData = _globalData!.copyWith(
      lastActiveTime: DateTime.now(),
    );

    await _saveGlobalData();
    notifyListeners();
  }

  @override
  void setUser(dynamic user) {
    if (user is BankUserModel) {
      _user = user;
      _saveUserData();
      notifyListeners();
    }
  }

  @override
  void clearUser() {
    _user = null;
    _globalData = null;
    _isDebugMode = false;
    notifyListeners();
  }

  @override
  void updateToken(String? token, {String? tokenType}) {
    // Bank app doesn't use tokens, so this is a no-op
  }

  /// Get formatted last login time
  String get formattedLastLoginTime {
    if (_globalData?.lastActiveTime == null) return '';

    final lastLogin = _globalData!.lastActiveTime;
    final now = DateTime.now();
    final difference = now.difference(lastLogin);

    if (difference.inMinutes < 1) {
      return '刚刚';
    } else if (difference.inHours < 1) {
      return '${difference.inMinutes}分钟前';
    } else if (difference.inDays < 1) {
      return '${difference.inHours}小时前';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}天前';
    } else {
      return '${lastLogin.month}月${lastLogin.day}日';
    }
  }

  /// Get dashboard display balance (hidden or visible)
  String get dashboardDisplayBalance {
    if (_user == null) return '¥ 0.00';
    if (_isDashboardBalanceVisible) {
      return _user!.formattedBalance;
    } else {
      return '¥ ****';
    }
  }

  /// Get profile display balance (for assets section)
  String get profileDisplayBalance {
    if (_user == null) return '¥ 0.00';
    if (_isProfileBalanceVisible) {
      return _user!.exactFormattedBalance;
    } else {
      return '¥ ****';
    }
  }

  /// Dispose resources
  @override
  void dispose() {
    super.dispose();
  }
}
