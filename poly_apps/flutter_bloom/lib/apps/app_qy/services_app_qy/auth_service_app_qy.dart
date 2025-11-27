import 'package:flutter/foundation.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/api_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/models_app_qy/user_model_app_qy.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/api_endpoints_app_qy.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';

class AuthServiceAppQy extends ChangeNotifier {
  static final AuthServiceAppQy _instance = AuthServiceAppQy._internal();
  factory AuthServiceAppQy() => _instance;
  
  final ApiServiceAppQy _apiService;
  final StorageAppQy _storage;
  
  UserModelAppQy? _currentUser;
  String? _accessToken;
  String? _userToken;
  DateTime? _tokenExpiresAt;
  bool _isLoading = false;
  String? _error;
  
  AuthServiceAppQy._internal() 
      : _apiService = ApiServiceAppQy(),
        _storage = StorageAppQy.instance;
  
  UserModelAppQy? get currentUser => _currentUser;
  String? get accessToken => _accessToken;
  String? get userToken => _userToken;
  DateTime? get tokenExpiresAt => _tokenExpiresAt;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _currentUser != null && _accessToken != null;
  
  Future<void> initialize() async {
    await _loadStoredAuth();
  }
  
  Future<bool> login({
    String? username,
    String? password,
    String? phoneNumber,
    String? verificationCode,
    String? userAuthToken,
  }) async {
    _setLoading(true);
    _setError(null);
    
    try {
      Map<String, dynamic> response;
      
      if (phoneNumber != null && verificationCode != null) {
        response = await _apiService.post(
          ApiEndpointsAppQy.authVerifyCode,
          data: {
            'phoneNumber': phoneNumber,
            'verificationCode': verificationCode,
          },
        );
      } else if (username != null && password != null) {
        response = await _apiService.post(
          ApiEndpointsAppQy.authLogin,
          data: {
            'username': username,
            'password': password,
          },
        );
      } else if (userAuthToken != null) {
        response = await _apiService.post(
          ApiEndpointsAppQy.authLogin,
          headers: {
            'user-auth-token': userAuthToken,
          },
        );
      } else {
        _setError('Invalid login credentials');
        _setLoading(false);
        return false;
      }
      
      if (response['success'] == true) {
        final data = response['data'] ?? response;
        
        _accessToken = data['login_token'] ?? data['token']?['accessToken'];
        _userToken = data['user_token'] ?? data['token']?['refreshToken'];
        
        if (data['user_token_expires_at'] != null) {
          _tokenExpiresAt = DateTime.tryParse(data['user_token_expires_at']);
        } else if (data['token']?['expiresIn'] != null) {
          final expiresIn = data['token']!['expiresIn'] as int;
          _tokenExpiresAt = DateTime.now().add(Duration(seconds: expiresIn));
        }
        
        _currentUser = UserModelAppQy.fromJson(data);
        
        if (_accessToken != null) {
          _apiService.setAuthToken(_accessToken);
        }
        
        await _saveAuthData();
        _setLoading(false);
        notifyListeners();
        return true;
      } else {
        _setError(response['error']?.toString() ?? 
                  response['message']?.toString() ?? 
                  'Login failed');
        _setLoading(false);
        return false;
      }
    } catch (e) {
      _setError(e.toString());
      _setLoading(false);
      return false;
    }
  }
  
  Future<bool> sendVerificationCode(String phoneNumber) async {
    _setLoading(true);
    
    final response = await _apiService.post(
      ApiEndpointsAppQy.authSendCode,
      data: {
        'phoneNumber': phoneNumber,
      },
    );
    
    _setLoading(false);
    
    if (response['success'] == true) {
      return true;
    } else {
      _setError(response['error']?.toString() ?? 'Failed to send code');
      return false;
    }
  }
  
  Future<bool> logout() async {
    try {
      if (_accessToken != null) {
        await _apiService.post(ApiEndpointsAppQy.authLogout);
      }
    } catch (e) {
    }
    
    _currentUser = null;
    _accessToken = null;
    _userToken = null;
    _tokenExpiresAt = null;
    _apiService.setAuthToken(null);
    
    await _clearAuthData();
    notifyListeners();
    return true;
  }
  
  Future<bool> refreshUser() async {
    if (!isAuthenticated) return false;
    
    try {
      final response = await _apiService.getUserProfile();
      
      if (response['success'] == true) {
        final userData = response['data'] ?? response;
        _currentUser = UserModelAppQy.fromJson(userData);
        await _saveAuthData();
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
  
  Future<void> syncUserData() async {
    if (!isAuthenticated) return;
    
    try {
      await Future.wait([
        _loadUserLanguages(),
        _loadUserStats(),
      ]);
    } catch (e) {
    }
  }
  
  Future<void> _loadUserLanguages() async {
    try {
      final response = await _apiService.getUserLanguages();
      if (response['success'] == true) {
        final data = response['data'] ?? response;
        final learningLanguages = data['learning_languages'] as List<dynamic>?;
        final nativeLanguage = data['native_language'] as String?;
        
        if (_currentUser != null) {
          _currentUser = _currentUser!.copyWith(
            learningLanguages: learningLanguages?.map((e) => e.toString()).toList() ?? ['en'],
            nativeLanguage: nativeLanguage ?? 'zh',
          );
          await _saveAuthData();
          notifyListeners();
        }
      }
    } catch (e) {
    }
  }
  
  Future<void> _loadUserStats() async {
    try {
      final response = await _apiService.getLearningStats();
      if (response['success'] == true) {
        final stats = response['data'] ?? response;
        if (_currentUser != null) {
          _currentUser = _currentUser!.copyWith(
            learningStats: stats is Map ? Map<String, dynamic>.from(stats) : null,
          );
          await _saveAuthData();
          notifyListeners();
        }
      }
    } catch (e) {
    }
  }
  
  Future<void> _loadStoredAuth() async {
    try {
      final storedToken = await _storage.getApp<String>('auth_access_token');
      final storedUserToken = await _storage.getApp<String>('auth_user_token');
      final storedUserData = await _storage.getApp<Map<String, dynamic>>('auth_user_data');
      
      if (storedToken != null && storedUserData != null) {
        _accessToken = storedToken;
        _userToken = storedUserToken;
        _currentUser = UserModelAppQy.fromJson(storedUserData);
        _apiService.setAuthToken(_accessToken);
        notifyListeners();
      }
    } catch (e) {
    }
  }
  
  Future<void> _saveAuthData() async {
    try {
      if (_accessToken != null) {
        await _storage.setApp<String>('auth_access_token', _accessToken!);
      }
      if (_userToken != null) {
        await _storage.setApp<String>('auth_user_token', _userToken!);
      }
      if (_currentUser != null) {
        await _storage.setApp<Map<String, dynamic>>('auth_user_data', _currentUser!.toJson());
      }
    } catch (e) {
    }
  }
  
  Future<void> _clearAuthData() async {
    try {
      await _storage.removeApp('auth_access_token');
      await _storage.removeApp('auth_user_token');
      await _storage.removeApp('auth_user_data');
    } catch (e) {
    }
  }
  
  void _setLoading(bool value) {
    _isLoading = value;
    _error = null;
    notifyListeners();
  }
  
  void _setError(String? message) {
    _error = message;
    notifyListeners();
  }
  
  void clearError() {
    _error = null;
    notifyListeners();
  }
}

