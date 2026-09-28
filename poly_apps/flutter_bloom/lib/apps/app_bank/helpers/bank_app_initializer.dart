/// Bank App Initializer
/// Simplified initialization helper for the bank application
library;

import 'package:flutter/foundation.dart';
import 'package:qyflutter/apps/app_bank/models_app_bank/bank_user_model.dart';
import '../providers_app_bank/bank_user_provider.dart';
import '../services_app_bank/bank_network_service.dart';
import '../managers_app_bank/app_lifecycle_manager.dart';
import '../managers_app_bank/user_manager.dart';
import '../managers_app_bank/license_registration_manager.dart';
import '../../../common/network/integration/network_user_integration.dart';
import '../../../common/network/core/api_endpoint_manager.dart';
import '../../../common/network/interceptors/network_interceptors.dart';
import '../config_app_bank/api_endpoints_app_bank.dart';
import '../config_app_bank/endpoint_storage_app_bank.dart';
import '../config_app_bank/prefs_app_bank.dart';
import '../services_app_bank/bank_network_log_interceptor.dart';

class BankAppInitializer {
  static BankAppInitializer? _instance;
  static BankAppInitializer get instance => _instance ??= BankAppInitializer._();
  BankAppInitializer._();

  bool _isInitialized = false;
  BankUserProvider? _userProvider;

  /// Initialize the entire bank application
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      debugPrint('🏦 Initializing Bank Application...');

      // 0. Initialize API endpoint manager
      debugPrint('🔗 Initializing API endpoint manager...');
      ApiEndpointsAppBank.configure();
      final endpointManager = ApiEndpointManager();
      final prefs = PrefsAppBank();
      if (!prefs.isInitialized) {
        await prefs.initSharedPreferences();
      }
      endpointManager.setStorage(EndpointStorageAppBank(prefs));
      await endpointManager.initialize(autoDetect: true, timeout: const Duration(seconds: 1));
      debugPrint('✅ API endpoint manager initialized: ${endpointManager.getCurrentBaseUrl()}');

      // 1. Initialize network log interceptors FIRST (before any network service)
      debugPrint('📝 Initializing network log interceptors...');
      final networkInterceptors = NetworkInterceptors.instance;
      await networkInterceptors.initialize();
      networkInterceptors.addRequestInterceptor(BankNetworkLogRequestInterceptor());
      networkInterceptors.addResponseInterceptor(BankNetworkLogResponseInterceptor());
      debugPrint('✅ Network log interceptors initialized');

      // 2. Initialize user provider
      debugPrint('📱 Initializing user provider...');
      _userProvider = BankUserProvider();
      await _userProvider!.initialize();

      // 3. Initialize network service with user provider integration
      debugPrint('🌐 Initializing network service...');
      await BankNetworkService.instance.initializeWithUserProvider(_userProvider!);

      // 3. Initialize app lifecycle manager (with user provider for data submission)
      debugPrint('🔄 Initializing app lifecycle manager...');
      await AppLifecycleManager().initialize(userProvider: _userProvider);

      // 4. Initialize user manager
      debugPrint('👤 Initializing user manager...');
      await UserManager().initialize();

      // 5. Initialize license registration manager
      debugPrint('🔐 Initializing license registration manager...');
      await LicenseRegistrationManager().initialize(
        onLicenseExpired: () {
          debugPrint('⚠️ License expired - redirecting to authentication');
        },
      );
      
      final licenseValid = await LicenseRegistrationManager().checkLicenseValidity();
      if (!licenseValid) {
        debugPrint('⚠️ License check failed - user needs to register');
      }

      _isInitialized = true;
      debugPrint('✅ Bank Application initialized successfully!');

    } catch (e) {
      debugPrint('❌ Failed to initialize Bank Application: $e');
      rethrow;
    }
  }

  /// Quick setup for JWT authentication
  Future<bool> setupJwtAuth({
    required String username,
    required String password,
  }) async {
    if (!_isInitialized) await initialize();

    try {
      debugPrint('🔐 Setting up JWT authentication...');

      final loginResponse = await BankNetworkService.instance.login(
        username: username,
        password: password,
      );

      if (loginResponse.isSuccess && loginResponse.data?.token != null) {
        debugPrint('✅ JWT authentication successful');
        return true;
      } else {
        debugPrint('❌ JWT authentication failed: ${loginResponse.message}');
        return false;
      }
    } catch (e) {
      debugPrint('❌ JWT authentication error: $e');
      return false;
    }
  }

  /// Quick setup for Client ID authentication
  Future<bool> setupClientIdAuth({
    required String clientId,
    String? headerKey,
  }) async {
    if (!_isInitialized) await initialize();

    try {
      debugPrint('🔑 Setting up Client ID authentication...');

      await NetworkUserIntegration.instance.setClientIdAuth(
        clientId: clientId,
        headerKey: headerKey ?? 'X-Client-ID',
      );

      debugPrint('✅ Client ID authentication successful');
      return true;
    } catch (e) {
      debugPrint('❌ Client ID authentication error: $e');
      return false;
    }
  }

  /// Quick setup for API Key authentication
  Future<bool> setupApiKeyAuth({
    required String apiKey,
    String? headerKey,
  }) async {
    if (!_isInitialized) await initialize();

    try {
      debugPrint('🗝️ Setting up API Key authentication...');

      await NetworkUserIntegration.instance.setHeaderKeyAuth(
        headerKey: headerKey ?? 'X-API-Key',
        headerValue: apiKey,
      );

      debugPrint('✅ API Key authentication successful');
      return true;
    } catch (e) {
      debugPrint('❌ API Key authentication error: $e');
      return false;
    }
  }

  /// Check if user has specific permission
  bool hasPermission(String permission) {
    return _userProvider?.hasPermission(permission) ?? false;
  }

  /// Check if user has specific role
  bool hasRole(String role) {
    return _userProvider?.hasRole(role) ?? false;
  }

  /// Get current authentication status
  bool get isAuthenticated {
    return _userProvider?.isAuthenticated ?? false;
  }

  /// Get current user
  BankUserModel? get currentUser {
    return _userProvider?.user;
  }

  /// Get authentication type
  String get authType {
    return _userProvider?.authMetadata.authType.name ?? 'none';
  }

  /// Logout user
  Future<bool> logout() async {
    if (!_isInitialized) return false;

    try {
      debugPrint('🚪 Logging out user...');

      final logoutResponse = await BankNetworkService.instance.logout();
      
      if (logoutResponse.isSuccess) {
        debugPrint('✅ Logout successful');
        return true;
      } else {
        debugPrint('❌ Logout failed: ${logoutResponse.message}');
        return false;
      }
    } catch (e) {
      debugPrint('❌ Logout error: $e');
      return false;
    }
  }

  /// Get comprehensive status
  Map<String, dynamic> getStatus() {
    return {
      'isInitialized': _isInitialized,
      'isAuthenticated': isAuthenticated,
      'authType': authType,
      'currentUser': {
        'id': currentUser?.id,
        'username': currentUser?.username,
        'email': currentUser?.email,
        'roleLevel': currentUser?.roleLevel,
        'roleName': currentUser?.roleName,
      },
      'permissions': {
        'canTransfer': hasPermission('transfer'),
        'canUpdateBalance': hasPermission('update_balance'),
        'canViewProfile': hasPermission('view_profile'),
        'isAdmin': hasRole('admin'),
      },
      'networkIntegration': NetworkUserIntegration.instance.getStatus(),
    };
  }

  /// Print status for debugging
  void printStatus() {
    final status = getStatus();
    debugPrint('🏦 Bank App Status:');
    debugPrint('  📱 Initialized: ${status['isInitialized']}');
    debugPrint('  🔐 Authenticated: ${status['isAuthenticated']}');
    debugPrint('  🔑 Auth Type: ${status['authType']}');
    debugPrint('  👤 User: ${status['currentUser']['username']} (${status['currentUser']['roleName']})');
    debugPrint('  🛡️ Permissions:');
    debugPrint('    - Transfer: ${status['permissions']['canTransfer']}');
    debugPrint('    - Update Balance: ${status['permissions']['canUpdateBalance']}');
    debugPrint('    - View Profile: ${status['permissions']['canViewProfile']}');
    debugPrint('    - Admin: ${status['permissions']['isAdmin']}');
  }

  /// Dispose resources
  void dispose() {
    _userProvider?.dispose();
    NetworkUserIntegration.instance.dispose();
    _userProvider = null;
    _isInitialized = false;
    _instance = null;
  }
}

/// Quick usage examples:
/// 
/// ```dart
/// // Initialize the app
/// await BankAppInitializer.instance.initialize();
/// 
/// // Setup JWT authentication
/// final success = await BankAppInitializer.instance.setupJwtAuth(
///   username: 'user@example.com',
///   password: 'password123',
/// );
/// 
/// // Check status
/// BankAppInitializer.instance.printStatus();
/// 
/// // Check permissions
/// if (BankAppInitializer.instance.hasPermission('transfer')) {
///   // User can make transfers
/// }
/// 
/// // Logout
/// await BankAppInitializer.instance.logout();
/// ```
