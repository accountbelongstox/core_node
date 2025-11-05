import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/user_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_auth_api_service.dart';
import 'package:qyflutter/apps/app_vipclub/provider_app_vipclub/user_provider_app_vipclub.dart';

class VipClubAuthController extends ChangeNotifier {
  final VipClubAuthApiService _authApi;
  final VipClubUserProvider _userProvider;

  bool _isLoading = false;
  String? _errorMessage;

  VipClubAuthController(this._authApi, this._userProvider);

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  VipClubUserModel? get currentUser => _userProvider.user;
  bool get isLoggedIn => _userProvider.isAuthenticated;

  Future<bool> login({
    required String email,
    required String password,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _userProvider.ensureInitialized();

      final result = await _authApi.login(
        email: email,
        password: password,
      );

      if (result['success']) {
        final user = result['user'] as VipClubUserModel;
        _userProvider.setUser(user);

        if (result['token'] != null) {
          _userProvider.updateToken(result['token'] as String);
        }

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = result['error'] as String;
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Login failed: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String fullName,
    required String phone,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _userProvider.ensureInitialized();

      final result = await _authApi.register(
        email: email,
        password: password,
        fullName: fullName,
        phone: phone,
      );

      if (result['success']) {
        final user = result['user'] as VipClubUserModel;
        _userProvider.setUser(user);

        if (result['token'] != null) {
          _userProvider.updateToken(result['token'] as String);
        }

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = result['error'] as String;
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Registration failed: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> mockDebugLogin(String username) async {
    _isLoading = true;
    notifyListeners();

    await _userProvider.ensureInitialized();

    final mockUser = VipClubUserModel(
      id: 'debug_user_123',
      email: '$username@debug.com',
      name: username.toUpperCase(),
      phone: '+1234567890',
      memberType: 'gold',
      isVipMember: true,
      vipPoints: 50000,
      discountRate: 0.15,
      memberSince: DateTime.now().subtract(const Duration(days: 365)),
      memberExpiry: DateTime.now().add(const Duration(days: 365)),
    );

    _userProvider.setUser(mockUser);
    _userProvider.updateToken('debug_token_${DateTime.now().millisecondsSinceEpoch}');

    _isLoading = false;
    notifyListeners();
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _authApi.logout();
      _userProvider.clearUser();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> checkLoginStatus() async {
    await _userProvider.ensureInitialized();

    final isLoggedIn = await _authApi.isLoggedIn();
    if (isLoggedIn && _userProvider.user != null) {
      notifyListeners();
      return;
    }

    if (isLoggedIn) {
      final user = await _authApi.getUserInfo();
      if (user != null) {
        _userProvider.setUser(user);
        notifyListeners();
      }
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
