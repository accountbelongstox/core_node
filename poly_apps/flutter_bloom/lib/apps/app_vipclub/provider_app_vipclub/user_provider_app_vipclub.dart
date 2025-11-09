import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:qyflutter/common/provider_status/user_provider.dart';
import 'package:qyflutter/common/network/core/network_types.dart' show AuthType;
import 'package:qyflutter/common/storage/storage_manager.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/user_model_app_vipclub.dart';

class VipClubUserProvider extends BaseUserProvider {
  final StorageManager _storageManager;
  static const String _storageBoxName = 'vipclub_user_provider';
  static const String _userStorageKey = 'user_model';
  static const String _authStorageKey = 'auth_metadata';
  static const String _tokenStorageKey = 'token';

  VipClubUserModel? _user;
  String? _token;
  String? _tokenType;
  AuthMetadata _authMetadata;
  bool _initialized;

  VipClubUserProvider({StorageManager? storageManager})
      : _storageManager = storageManager ?? StorageManager.instance,
        _user = null,
        _token = null,
        _tokenType = null,
        _authMetadata = const AuthMetadata(),
        _initialized = false;

  bool get isInitialized => _initialized;

  Future<void> ensureInitialized() async {
    if (_initialized) return;

    await _storageManager.init(appName: 'vipclub');
    await _storageManager.openBox(_storageBoxName);
    await _loadUser();
    await _loadAuthMetadata();
    await _loadToken();
    _initialized = true;
  }

  @override
  bool get isAuthenticated {
    return _authMetadata.isAuthenticated ||
        (_user != null && _user!.userToken != null) ||
        (_token != null);
  }

  @override
  String? get token {
    if (_authMetadata.jwtToken != null && _authMetadata.jwtToken!.isNotEmpty) {
      return _authMetadata.jwtToken;
    }
    return _token ?? _user?.userToken;
  }

  @override
  String? get userToken {
    return _user?.userToken ?? _authMetadata.sessionId ?? _authMetadata.jwtToken;
  }

  @override
  String? get tokenType {
    if (_tokenType != null) return _tokenType;
    if (_authMetadata.authType == AuthType.jwt) {
      return 'Bearer';
    }
    return null;
  }

  @override
  VipClubUserModel? get user => _user;

  @override
  AuthMetadata get authMetadata => _authMetadata;

  @override
  bool get needsAuthRefresh => _authMetadata.needsRefresh;

  @override
  void setUser(BaseUserModel user) {
    if (user is VipClubUserModel) {
      _user = user;
      _authMetadata = user.authMetadata;
      _persistUser();
      _persistAuthMetadata();
      notifyListeners();
    }
  }

  @override
  void clearUser() {
    _user = null;
    _token = null;
    _tokenType = null;
    _authMetadata = const AuthMetadata();

    _persistUser();
    _persistAuthMetadata();
    _persistToken();
    notifyListeners();
  }

  @override
  void updateToken(String? token, {String? tokenType}) {
    _token = token;
    _tokenType = tokenType ?? "Bearer";

    final AuthMetadata nextMetadata = _authMetadata.copyWith(
      jwtToken: token ?? _authMetadata.jwtToken,
      headerValue: tokenType ?? _authMetadata.headerValue,
      data: <String, dynamic>{
        ..._authMetadata.data,
        if (tokenType != null) 'tokenType': tokenType,
      },
    );

    if (token != null && (_tokenType?.toLowerCase().contains('bearer') ?? false)) {
      _authMetadata = nextMetadata.copyWith(
        authType: AuthType.jwt,
        isAuthenticated: true,
        authenticatedAt: DateTime.now(),
      );
    } else {
      _authMetadata = nextMetadata;
    }

    _persistToken();
    _persistAuthMetadata();
    notifyListeners();
  }

  @override
  void setAuthMetadata(AuthMetadata metadata) {
    _authMetadata = metadata;
    _persistAuthMetadata();
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
    final AuthMetadata next = _authMetadata.copyWith(
      authType: authType,
      data: data != null
          ? <String, dynamic>{
              ..._authMetadata.data,
              ...data,
            }
          : _authMetadata.data,
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
    setAuthMetadata(next);
  }

  @override
  Map<String, String> getAuthHeaders() {
    return _authMetadata.getAuthHeaders();
  }

  @override
  bool hasPermission(String permission) {
    return _user?.isActive ?? false;
  }

  @override
  bool hasRole(String role) {
    if (_user == null) return false;

    switch (role) {
      case 'vip':
        return _user!.isVipMember;
      case 'gold':
        return _user!.isGoldMember;
      case 'platinum':
        return _user!.isPlatinumMember;
      case 'diamond':
        return _user!.isDiamondMember;
      default:
        return false;
    }
  }

  Future<void> _loadUser() async {
    final String? rawUser = await _storageManager.getValue<String>(
      _storageBoxName,
      _userStorageKey,
    );
    if (rawUser == null || rawUser.isEmpty) {
      _user = null;
      return;
    }
    try {
      final Map<String, dynamic> data =
          Map<String, dynamic>.from(jsonDecode(rawUser) as Map);
      _user = VipClubUserModel.fromMap(data);
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Failed to decode stored user: ${error.toString()}');
      }
      _user = null;
    }
  }

  Future<void> _loadAuthMetadata() async {
    final Map<String, dynamic>? raw =
        await _storageManager.getValue<Map<String, dynamic>>(
      _storageBoxName,
      _authStorageKey,
    );
    if (raw != null) {
      _authMetadata = AuthMetadata.fromMap(raw);
    }
  }

  Future<void> _loadToken() async {
    _token = await _storageManager.getValue<String>(
      _storageBoxName,
      _tokenStorageKey,
    );
  }

  Future<void> _persistUser() async {
    if (_user == null) {
      await _storageManager.deleteKey(_storageBoxName, _userStorageKey);
      return;
    }
    final String payload = jsonEncode(_user!.toMap());
    await _storageManager.putValue<String>(
      _storageBoxName,
      _userStorageKey,
      payload,
    );
  }

  Future<void> _persistAuthMetadata() async {
    await _storageManager.putValue<Map<String, dynamic>>(
      _storageBoxName,
      _authStorageKey,
      _authMetadata.toMap(),
    );
  }

  Future<void> _persistToken() async {
    if (_token == null) {
      await _storageManager.deleteKey(_storageBoxName, _tokenStorageKey);
      return;
    }
    await _storageManager.putValue<String>(
      _storageBoxName,
      _tokenStorageKey,
      _token!,
    );
  }
}
