import 'package:flutter/foundation.dart';
import '../services_app_bank/bank_auth_api_service.dart';
// FIX: Use unified BankUser model from user_model_app_bank.dart
import '../models_app_bank/user_model_app_bank.dart';
import '../../../common/network/security/device_security_manager.dart';

class UserManager extends ChangeNotifier {
  static final UserManager _instance = UserManager._internal();
  factory UserManager() => _instance;
  UserManager._internal();

  final BankAuthApiService _authService = BankAuthApiService.instance;
  final DeviceSecurityManager _securityManager = DeviceSecurityManager.instance;

  BankUser? _currentUser;
  String? _authToken;
  String? _refreshToken;
  bool _isLoggedIn = false;
  bool _isLoading = false;

  // Getters
  BankUser? get currentUser => _currentUser;
  String? get authToken => _authToken;
  bool get isLoggedIn => _isLoggedIn;
  bool get isLoading => _isLoading;

  /// Initialize user manager
  Future<void> initialize() async {
    try {
      await _securityManager.initialize();
      // Check if user has saved credentials
      await _loadSavedCredentials();
    } catch (e) {
      debugPrint('Failed to initialize UserManager: $e');
    }
  }

  /// Login user with username and password
  Future<LoginResult> login(String username, String password) async {
    _setLoading(true);
    
    try {
      final response = await _authService.login(
        username: username,
        password: password,
      );

      // FIX: Use response.isSuccess and loginData.user is already BankUser
      if (response.isSuccess && response.data != null) {
        final loginData = response.data!;
        
        _authToken = loginData.token;
        _refreshToken = loginData.refreshToken;
        _currentUser = loginData.user; // Already BankUser type
        _isLoggedIn = true;
        
        // Save credentials for auto-login
        await _saveCredentials();
        
        notifyListeners();
        
        return LoginResult(
          success: true,
          message: response.message ?? 'Login successful',
          user: _currentUser,
        );
      } else {
        return LoginResult(
          success: false,
          message: response.message ?? 'Login failed',
          errorCode: response.error,
        );
      }
    } catch (e) {
      debugPrint('Login error: $e');
      return LoginResult(
        success: false,
        message: 'Login failed: $e',
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Register new user
  Future<RegisterResult> register({
    required String username,
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    _setLoading(true);
    
    try {
      final response = await _authService.register(
        username: username,
        email: email,
        password: password,
        fullName: fullName,
        phone: phone,
      );

      // FIX: Use response.isSuccess, response.data is LoginResponseAppBank
      if (response.isSuccess && response.data != null) {
        return RegisterResult(
          success: true,
          message: response.message ?? 'Registration successful',
          userId: response.data!.user.id,
        );
      } else {
        return RegisterResult(
          success: false,
          message: response.message ?? 'Registration failed',
          errorCode: response.error,
        );
      }
    } catch (e) {
      debugPrint('Registration error: $e');
      return RegisterResult(
        success: false,
        message: 'Registration failed: $e',
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Logout user
  Future<void> logout() async {
    try {
      if (_authToken != null) {
        await _authService.logout();
      }
    } catch (e) {
      debugPrint('Logout error: $e');
    } finally {
      await _clearCredentials();
      _currentUser = null;
      _authToken = null;
      _refreshToken = null;
      _isLoggedIn = false;
      notifyListeners();
    }
  }

  /// Update user profile
  Future<UpdateProfileResult> updateProfile({
    String? fullName,
    String? email,
    String? phone,
    String? dateOfBirth,
    String? gender,
  }) async {
    if (!_isLoggedIn) {
      return UpdateProfileResult(
        success: false,
        message: 'User not logged in',
      );
    }

    _setLoading(true);
    
    try {
      final response = await _authService.updateProfile(
        fullName: fullName,
        email: email,
        phone: phone,
        dateOfBirth: dateOfBirth,
        gender: gender,
      );

      // FIX: Use response.isSuccess and response.data is already BankUser
      if (response.isSuccess && response.data != null) {
        _currentUser = response.data; // Already BankUser type
        await _saveCredentials();
        notifyListeners();
        
        return UpdateProfileResult(
          success: true,
          message: response.message ?? 'Profile updated successfully',
          user: _currentUser,
        );
      } else {
        return UpdateProfileResult(
          success: false,
          message: response.message ?? 'Profile update failed',
          errorCode: response.error,
        );
      }
    } catch (e) {
      debugPrint('Update profile error: $e');
      return UpdateProfileResult(
        success: false,
        message: 'Profile update failed: $e',
      );
    } finally {
      _setLoading(false);
    }
  }

  /// Update user balance
  /// FIX: BankAuthApiService doesn't have updateBalance method - feature not implemented
  Future<UpdateBalanceResult> updateBalance({
    required double newBalance,
    String? reason,
    String? transactionType,
  }) async {
    if (!_isLoggedIn) {
      return UpdateBalanceResult(
        success: false,
        message: 'User not logged in',
      );
    }

    // TODO: Implement when BankAuthApiService.updateBalance is available
    return UpdateBalanceResult(
      success: false,
      message: 'Balance update feature not implemented',
    );
  }

  /// Update user address
  /// FIX: BankAuthApiService doesn't have updateAddress method - feature not implemented
  Future<UpdateAddressResult> updateAddress({
    String? street,
    String? city,
    String? state,
    String? zipCode,
    String? country,
  }) async {
    if (!_isLoggedIn) {
      return UpdateAddressResult(
        success: false,
        message: 'User not logged in',
      );
    }

    // TODO: Implement when BankAuthApiService.updateAddress is available
    return UpdateAddressResult(
      success: false,
      message: 'Address update feature not implemented',
    );
  }

  /// Apply registration code (method not available in BankAuthApiService)
  Future<RegistrationCodeResult> applyRegistrationCode({
    required String registrationCode,
    String? referralSource,
  }) async {
    if (!_isLoggedIn) {
      return RegistrationCodeResult(
        success: false,
        message: 'User not logged in',
      );
    }

    // TODO: Implement when BankAuthApiService.applyRegistrationCode is available
    return RegistrationCodeResult(
      success: false,
      message: 'Registration code feature not implemented',
    );
  }

  /// Refresh authentication token (method not available in BankAuthApiService)
  Future<bool> refreshToken() async {
    if (_refreshToken == null) return false;
    
    // TODO: Implement when BankAuthApiService.refreshToken is available
    debugPrint('Token refresh not implemented');
    return false;
  }

  /// Set loading state
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  /// Save credentials to secure storage
  Future<void> _saveCredentials() async {
    // Implement secure storage for credentials
    // This is a placeholder - you should use flutter_secure_storage or similar
    debugPrint('Saving credentials (placeholder)');
  }

  /// Load saved credentials
  Future<void> _loadSavedCredentials() async {
    // Implement loading credentials from secure storage
    // This is a placeholder
    debugPrint('Loading saved credentials (placeholder)');
  }

  /// Clear saved credentials
  Future<void> _clearCredentials() async {
    // Implement clearing credentials from secure storage
    // This is a placeholder
    debugPrint('Clearing credentials (placeholder)');
  }
}

// Result classes
// FIX: Use BankUser (unified model) instead of BankUserModel
class LoginResult {
  final bool success;
  final String message;
  final BankUser? user;
  final String? errorCode;

  LoginResult({
    required this.success,
    required this.message,
    this.user,
    this.errorCode,
  });
}

class RegisterResult {
  final bool success;
  final String message;
  final String? userId;
  final String? errorCode;

  RegisterResult({
    required this.success,
    required this.message,
    this.userId,
    this.errorCode,
  });
}

// FIX: Use BankUser (unified model) instead of BankUserModel
class UpdateProfileResult {
  final bool success;
  final String message;
  final BankUser? user;
  final String? errorCode;

  UpdateProfileResult({
    required this.success,
    required this.message,
    this.user,
    this.errorCode,
  });
}

class UpdateBalanceResult {
  final bool success;
  final String message;
  final double? oldBalance;
  final double? newBalance;
  final String? transactionId;
  final String? errorCode;

  UpdateBalanceResult({
    required this.success,
    required this.message,
    this.oldBalance,
    this.newBalance,
    this.transactionId,
    this.errorCode,
  });
}

// Fix: Use Map<String, dynamic> instead of AddressData (type not defined)
class UpdateAddressResult {
  final bool success;
  final String message;
  final Map<String, dynamic>? address;
  final String? errorCode;

  UpdateAddressResult({
    required this.success,
    required this.message,
    this.address,
    this.errorCode,
  });
}

class RegistrationCodeResult {
  final bool success;
  final String message;
  final bool? codeValid;
  final List<dynamic>? benefits;
  final String? errorCode;

  RegistrationCodeResult({
    required this.success,
    required this.message,
    this.codeValid,
    this.benefits,
    this.errorCode,
  });
}
