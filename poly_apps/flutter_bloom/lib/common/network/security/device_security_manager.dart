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

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/foundation.dart';
// FIXED: Removed unused 'package:flutter/services.dart' import
import 'package:crypto/crypto.dart';
import '../../storage_tools/unified_storage.dart';

class DeviceSecurityManager {
  static DeviceSecurityManager? _instance;
  static DeviceSecurityManager get instance => _instance ??= DeviceSecurityManager._();
  
  DeviceSecurityManager._();
  
  // FIXED: UnifiedStorage is abstract class with static methods, removed instance field
  String? _deviceId;
  String? _appSignature;
  bool _isLocked = false;
  Timer? _lockCheckTimer;
  
  static const String _deviceIdKey = 'device_security_id';
  static const String _appSignatureKey = 'app_security_signature';
  static const String _lockStatusKey = 'device_lock_status';
  static const String _lockTimestampKey = 'device_lock_timestamp';
  
  Future<void> initialize() async {
    // FIXED: UnifiedStorage.init() is static method, call directly on class
    await UnifiedStorage.init();
    await _loadDeviceInfo();
    await _checkLockStatus();
    _startLockMonitoring();
  }

  Future<String> getDeviceId() async {
    if (_deviceId != null) return _deviceId!;
    
    // FIXED: UnifiedStorage uses generic get<T> method instead of getString
    _deviceId = await UnifiedStorage.get<String>(_deviceIdKey);
    
    if (_deviceId == null) {
      _deviceId = await _generateDeviceId();
      // FIXED: UnifiedStorage uses generic set<T> method instead of setString
      await UnifiedStorage.set<String>(_deviceIdKey, _deviceId!);
    }
    
    return _deviceId!;
  }

  Future<String> getAppSignature() async {
    if (_appSignature != null) return _appSignature!;
    
    // FIXED: UnifiedStorage uses generic get<T> method instead of getString
    _appSignature = await UnifiedStorage.get<String>(_appSignatureKey);
    
    if (_appSignature == null) {
      _appSignature = await _generateAppSignature();
      // FIXED: UnifiedStorage uses generic set<T> method instead of setString
      await UnifiedStorage.set<String>(_appSignatureKey, _appSignature!);
    }
    
    return _appSignature!;
  }

  Future<Map<String, String>> getSecurityHeaders() async {
    final deviceId = await getDeviceId();
    final appSignature = await getAppSignature();
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    final nonce = _generateNonce();
    
    return {
      'X-Device-ID': deviceId,
      'X-App-Signature': appSignature,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Platform': _getPlatformInfo(),
      'X-App-Version': await _getAppVersion(),
    };
  }

  bool get isDeviceLocked => _isLocked;

  Future<void> lockDevice(String reason) async {
    _isLocked = true;
    // FIXED: UnifiedStorage uses generic set<T> method instead of setBool/setString
    await UnifiedStorage.set<bool>(_lockStatusKey, true);
    await UnifiedStorage.set<String>(_lockTimestampKey, DateTime.now().toIso8601String());
    
    if (kDebugMode) {
      print('Device locked: $reason');
    }
    
    // Notify app about lock status
    _notifyLockStatusChanged(true, reason);
  }

  Future<void> unlockDevice() async {
    _isLocked = false;
    // FIXED: UnifiedStorage uses generic set<T> method instead of setBool
    await UnifiedStorage.set<bool>(_lockStatusKey, false);
    await UnifiedStorage.remove(_lockTimestampKey);
    
    if (kDebugMode) {
      print('Device unlocked');
    }
    
    _notifyLockStatusChanged(false, 'Device unlocked');
  }

  Future<bool> validateServerResponse(Map<String, dynamic> response) async {
    // Check for lock command from server
    if (response.containsKey('device_lock') && response['device_lock'] == true) {
      final reason = response['lock_reason'] ?? 'Server security lock';
      await lockDevice(reason);
      return false;
    }
    
    // Check for security validation
    if (response.containsKey('security_check')) {
      final serverDeviceId = response['security_check']['device_id'];
      final currentDeviceId = await getDeviceId();
      
      if (serverDeviceId != null && serverDeviceId != currentDeviceId) {
        await lockDevice('Device ID mismatch');
        return false;
      }
    }
    
    return true;
  }

  Future<String> _generateDeviceId() async {
    final deviceInfo = await _collectDeviceInfo();
    final combined = deviceInfo.values.join('|');
    final bytes = utf8.encode(combined);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  Future<String> _generateAppSignature() async {
    final deviceId = await getDeviceId();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = Random().nextInt(999999);
    final combined = '$deviceId|$timestamp|$random';
    final bytes = utf8.encode(combined);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  Future<Map<String, String>> _collectDeviceInfo() async {
    final info = <String, String>{};
    
    try {
      if (kIsWeb) {
        info['platform'] = 'web';
        info['userAgent'] = 'flutter_web';
      } else if (Platform.isAndroid) {
        info['platform'] = 'android';
        info['version'] = Platform.version;
      } else if (Platform.isIOS) {
        info['platform'] = 'ios';
        info['version'] = Platform.version;
      } else if (Platform.isWindows) {
        info['platform'] = 'windows';
        info['version'] = Platform.version;
      } else if (Platform.isMacOS) {
        info['platform'] = 'macos';
        info['version'] = Platform.version;
      } else if (Platform.isLinux) {
        info['platform'] = 'linux';
        info['version'] = Platform.version;
      }
      
      info['locale'] = Platform.localeName;
    } catch (e) {
      if (kDebugMode) {
        print('Error collecting device info: $e');
      }
      info['platform'] = 'unknown';
    }
    
    return info;
  }

  String _generateNonce() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (i) => random.nextInt(256));
    return base64Encode(bytes);
  }

  String _getPlatformInfo() {
    if (kIsWeb) return 'web';
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    if (Platform.isWindows) return 'windows';
    if (Platform.isMacOS) return 'macos';
    if (Platform.isLinux) return 'linux';
    return 'unknown';
  }

  Future<String> _getAppVersion() async {
    try {
      // This would typically come from package_info_plus
      return '1.0.0';
    } catch (e) {
      return 'unknown';
    }
  }

  Future<void> _loadDeviceInfo() async {
    // FIXED: UnifiedStorage uses generic get<T> method instead of getString
    _deviceId = await UnifiedStorage.get<String>(_deviceIdKey);
    _appSignature = await UnifiedStorage.get<String>(_appSignatureKey);
  }

  Future<void> _checkLockStatus() async {
    // FIXED: UnifiedStorage uses generic get<T> method instead of getBool
    _isLocked = await UnifiedStorage.get<bool>(_lockStatusKey) ?? false;
    
    if (_isLocked) {
      // FIXED: UnifiedStorage uses generic get<T> method instead of getString
      final lockTimestamp = await UnifiedStorage.get<String>(_lockTimestampKey);
      if (lockTimestamp != null) {
        final lockTime = DateTime.parse(lockTimestamp);
        final now = DateTime.now();
        
        // Auto-unlock after 24 hours (configurable)
        if (now.difference(lockTime).inHours > 24) {
          await unlockDevice();
        }
      }
    }
  }

  void _startLockMonitoring() {
    _lockCheckTimer?.cancel();
    _lockCheckTimer = Timer.periodic(
      const Duration(minutes: 5),
      (timer) => _checkLockStatus(),
    );
  }

  void _notifyLockStatusChanged(bool isLocked, String reason) {
    // This could be expanded to use a stream controller or callback system
    if (kDebugMode) {
      print('Lock status changed: $isLocked, reason: $reason');
    }
  }

  Future<void> clearSecurityData() async {
    // FIXED: Call static methods directly on UnifiedStorage class
    await UnifiedStorage.remove(_deviceIdKey);
    await UnifiedStorage.remove(_appSignatureKey);
    await UnifiedStorage.remove(_lockStatusKey);
    await UnifiedStorage.remove(_lockTimestampKey);
    
    _deviceId = null;
    _appSignature = null;
    _isLocked = false;
  }

  void dispose() {
    _lockCheckTimer?.cancel();
  }
}

class SecurityException implements Exception {
  final String message;
  final String? code;
  final Map<String, dynamic>? details;

  const SecurityException({
    required this.message,
    this.code,
    this.details,
  });

  @override
  String toString() {
    return 'SecurityException: $message${code != null ? ' (Code: $code)' : ''}';
  }
}
