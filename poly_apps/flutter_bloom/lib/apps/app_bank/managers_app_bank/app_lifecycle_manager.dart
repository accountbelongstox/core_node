import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import '../services_app_bank/bank_public_api_service.dart';
import '../../../common/network/security/device_security_manager.dart';

class AppLifecycleManager {
  static final AppLifecycleManager _instance = AppLifecycleManager._internal();
  factory AppLifecycleManager() => _instance;
  AppLifecycleManager._internal();

  final BankPublicApiService _publicService = BankPublicApiService.instance;
  final DeviceSecurityManager _securityManager = DeviceSecurityManager.instance;
  
  bool _isInitialized = false;
  String? _sessionId;
  DateTime? _appOpenTime;

  /// Initialize the app lifecycle manager
  Future<void> initialize() async {
    if (_isInitialized) return;
    
    try {
      // Initialize device security manager
      await _securityManager.initialize();
      
      // Report app open event
      await _reportAppOpen();
      
      _isInitialized = true;
      debugPrint('AppLifecycleManager initialized successfully');
    } catch (e) {
      debugPrint('Failed to initialize AppLifecycleManager: $e');
    }
  }

  /// Report app open event to backend
  Future<void> _reportAppOpen() async {
    try {
      _appOpenTime = DateTime.now();
      
      final deviceId = await _securityManager.getDeviceId();
      final appSignature = await _securityManager.generateAppSignature();
      
      final response = await _publicService.reportAppOpen(
        deviceId: deviceId,
        appSignature: appSignature,
        timestamp: _appOpenTime!.millisecondsSinceEpoch ~/ 1000,
        eventType: 'app_open',
        appVersion: await _getAppVersion(),
        platform: await _getPlatform(),
      );

      if (response.isSuccess && response.data != null) {
        _sessionId = response.data!['session_id'];
        
        // Check if device is locked
        final deviceLocked = response.data!['device_locked'] ?? false;
        if (deviceLocked) {
          final lockReason = response.data!['lock_reason'] ?? 'Device is locked';
          await _handleDeviceLocked(lockReason);
        }
        
        debugPrint('App open event reported successfully. Session ID: $_sessionId');
      } else {
        debugPrint('Failed to report app open event: ${response.message}');
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
      final appSignature = await _securityManager.generateAppSignature();
      final sessionDuration = DateTime.now().difference(_appOpenTime!).inSeconds;
      
      final response = await _publicService.reportAppClose(
        deviceId: deviceId,
        appSignature: appSignature,
        timestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        eventType: 'app_close',
        sessionDuration: sessionDuration,
      );

      if (response.isSuccess) {
        debugPrint('App close event reported successfully');
      } else {
        debugPrint('Failed to report app close event: ${response.message}');
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
      final deviceId = await _securityManager.getDeviceId();
      final response = await _publicService.checkDeviceStatus(deviceId);
      
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
      final deviceId = await _securityManager.getDeviceId();
      final appSignature = await _securityManager.generateAppSignature();
      
      final response = await _publicService.registerDevice(
        deviceId: deviceId,
        appSignature: appSignature,
        registrationTimestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        deviceName: await _getDeviceName(),
        platform: await _getPlatform(),
        appVersion: await _getAppVersion(),
      );

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

  /// Get device name
  Future<String> _getDeviceName() async {
    try {
      // You can get this from device_info_plus or similar package
      return 'Flutter Device'; // Placeholder
    } catch (e) {
      return 'Unknown Device';
    }
  }

  /// Perform security check
  Future<bool> performSecurityCheck(String checkType) async {
    try {
      final deviceId = await _securityManager.getDeviceId();
      final appSignature = await _securityManager.generateAppSignature();
      
      final response = await _publicService.performSecurityCheck(
        deviceId: deviceId,
        appSignature: appSignature,
        timestamp: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        checkType: checkType,
      );

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
