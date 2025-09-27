import 'package:flutter/foundation.dart';
import '../../../common/provider_status/user_provider.dart';
import '../../../common/storage/storage_manager.dart';
import '../../../common/cache_manager/cache_manager.dart';
import '../models_app_bank/bank_user_model.dart';
import '../models_app_bank/bank_global_data.dart';

/// Bank User Provider extending the base user provider
/// Manages bank user data with persistent storage, caching, and authentication metadata
class BankUserProvider extends BaseUserProvider {
  static const String _boxName = 'bank_user_data';
  static const String _userKey = 'user_profile';
  static const String _globalDataKey = 'global_data';
  static const String _debugModeKey = 'debug_mode';
  static const String _authMetadataKey = 'auth_metadata';

  BankUserModel? _user;
  BankGlobalData? _globalData;
  bool _isDebugMode = false;
  bool _isDashboardBalanceVisible = false;
  bool _isProfileBalanceVisible = false;
  bool _isInitialized = false;
  AuthMetadata _authMetadata = const AuthMetadata();

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
  bool get isAuthenticated => _authMetadata.isAuthenticated || _user != null;

  @override
  String? get token => _authMetadata.jwtToken;

  @override
  String? get userToken => _user?.userToken;

  @override
  String? get tokenType => _authMetadata.authType == AuthType.jwt ? 'Bearer' : null;

  @override
  AuthMetadata get authMetadata => _authMetadata;

  @override
  bool get needsAuthRefresh => _authMetadata.needsRefresh;

  /// Initialize the provider
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize storage
      await _storage.init(appName: 'bank_app');
      await _storage.openBox(_boxName);

      // Load data
      await _loadUserData();
      await _loadGlobalData();
      await _loadDebugMode();
      await _loadAuthMetadata();

      // Update session data
      await _updateSessionData();

      _isInitialized = true;
      notifyListeners();
    } catch (e) {
      debugPrint('BankUserProvider initialization error: $e');
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

  /// Load authentication metadata
  Future<void> _loadAuthMetadata() async {
    try {
      final authData = await _storage.getValue<Map<String, dynamic>>(_boxName, _authMetadataKey);
      if (authData != null) {
        _authMetadata = AuthMetadata.fromMap(authData);
      }
    } catch (e) {
      debugPrint('Error loading auth metadata: $e');
      _authMetadata = const AuthMetadata();
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
    _authMetadata = const AuthMetadata();

    await _saveUserData();
    await _saveGlobalData();
    await _saveDebugMode();
    await _saveAuthMetadata();
  }

  /// Save user data to storage
  Future<void> _saveUserData() async {
    if (_user == null) return;
    try {
      await _storage.putValue(_boxName, _userKey, _user!.toJsonString());
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

  /// Save authentication metadata
  Future<void> _saveAuthMetadata() async {
    try {
      await _storage.putValue(_boxName, _authMetadataKey, _authMetadata.toMap());
    } catch (e) {
      debugPrint('Error saving auth metadata: $e');
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
    String? fullName,
    String? phone,
    String? street,
    String? city,
    String? state,
    String? zipCode,
    String? country,
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
      fullName: fullName,
      phone: phone,
      street: street,
      city: city,
      state: state,
      zipCode: zipCode,
      country: country,
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
  void setUser(BaseUserModel user) {
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
    _authMetadata = const AuthMetadata();
    notifyListeners();
  }

  @override
  void updateToken(String? token, {String? tokenType}) {
    if (token != null) {
      _authMetadata = _authMetadata.copyWith(
        authType: AuthType.jwt,
        jwtToken: token,
        isAuthenticated: true,
        authenticatedAt: DateTime.now(),
      );
      _saveAuthMetadata();
      notifyListeners();
    }
  }

  @override
  void setAuthMetadata(AuthMetadata metadata) {
    _authMetadata = metadata;
    _saveAuthMetadata();
    notifyListeners();
  }

  @override
  void updateAuthMetadata({
    AuthType? authType,
    Map<String, dynamic>? data,
    DateTime? authenticatedAt,
    DateTime? expiresAt,
    bool? isAuthenticated,
    String? clientId,
    String? headerKey,
    String? headerValue,
    String? jwtToken,
    String? refreshToken,
    String? sessionId,
    Map<String, String>? customHeaders,
  }) {
    _authMetadata = _authMetadata.copyWith(
      authType: authType,
      data: data,
      authenticatedAt: authenticatedAt,
      expiresAt: expiresAt,
      isAuthenticated: isAuthenticated,
      clientId: clientId,
      headerKey: headerKey,
      headerValue: headerValue,
      jwtToken: jwtToken,
      refreshToken: refreshToken,
      sessionId: sessionId,
      customHeaders: customHeaders,
    );
    _saveAuthMetadata();
    notifyListeners();
  }

  @override
  Map<String, String> getAuthHeaders() {
    return _authMetadata.getAuthHeaders();
  }

  @override
  bool hasPermission(String permission) {
    if (_user == null) return false;
    
    // Bank-specific permission logic
    switch (permission) {
      case 'transfer':
        return _user!.isAccountActive && _user!.canTransact;
      case 'view_balance':
        return _user!.isAccountActive;
      case 'admin':
        return _user!.roleLevel != null && _user!.roleLevel! >= 10;
      default:
        return _user!.roleLevel != null && _user!.roleLevel! > 0;
    }
  }

  @override
  bool hasRole(String role) {
    return _user?.roleName == role;
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
