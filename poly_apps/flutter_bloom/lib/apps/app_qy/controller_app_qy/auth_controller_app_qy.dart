import 'package:flutter/foundation.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/auth_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/models_app_qy/user_model_app_qy.dart';

class AuthControllerAppQy extends ChangeNotifier {
  final AuthServiceAppQy _authService;
  
  AuthControllerAppQy({
    AuthServiceAppQy? authService,
  }) : _authService = authService ?? AuthServiceAppQy() {
    _authService.addListener(_onAuthChanged);
  }
  
  @override
  void dispose() {
    _authService.removeListener(_onAuthChanged);
    super.dispose();
  }
  
  void _onAuthChanged() {
    notifyListeners();
  }
  
  UserModelAppQy? get currentUser => _authService.currentUser;
  bool get isAuthenticated => _authService.isAuthenticated;
  bool get isLoading => _authService.isLoading;
  String? get error => _authService.error;
  
  Future<void> initialize() async {
    await _authService.initialize();
  }
  
  Future<bool> login({
    String? username,
    String? password,
    String? phoneNumber,
    String? verificationCode,
    String? userAuthToken,
  }) async {
    final success = await _authService.login(
      username: username,
      password: password,
      phoneNumber: phoneNumber,
      verificationCode: verificationCode,
      userAuthToken: userAuthToken,
    );
    
    if (success && isAuthenticated) {
      await _authService.syncUserData();
    }
    
    return success;
  }
  
  Future<bool> sendVerificationCode(String phoneNumber) async {
    return await _authService.sendVerificationCode(phoneNumber);
  }
  
  Future<bool> logout() async {
    return await _authService.logout();
  }
  
  Future<bool> refreshUser() async {
    return await _authService.refreshUser();
  }
  
  void clearError() {
    _authService.clearError();
  }
}
