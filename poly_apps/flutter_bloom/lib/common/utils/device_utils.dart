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

import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import '../../common/storage/unified_storage.dart';

class DeviceUtils {
  static String? _cachedMachineCode;
  static const String _machineCodeStorageKey = 'device_machine_code';
  
  /// Generate a unique machine code based on device characteristics
  /// This code is persistent across app reinstalls and should be unique per device
  static Future<String> getMachineCode() async {
    if (_cachedMachineCode != null) {
      return _cachedMachineCode!;
    }
    
    try {
      await UnifiedStorage.init();
      final storedCode = await UnifiedStorage.get<String>(_machineCodeStorageKey);
      if (storedCode != null && storedCode.isNotEmpty) {
        _cachedMachineCode = storedCode;
        return storedCode;
      }
    } catch (e) {
      debugPrint('Error loading stored machine code: $e');
    }
    
    String deviceInfo = '';
    
    try {
      if (kIsWeb) {
        deviceInfo = await _getWebDeviceInfo();
      } else if (Platform.isAndroid) {
        deviceInfo = await _getAndroidDeviceInfo();
      } else if (Platform.isIOS) {
        deviceInfo = await _getIOSDeviceInfo();
      } else if (Platform.isWindows || Platform.isMacOS || Platform.isLinux) {
        deviceInfo = await _getDesktopDeviceInfo();
      } else {
        deviceInfo = await _getFallbackDeviceInfo();
      }
    } catch (e) {
      debugPrint('Error getting device info: $e');
      deviceInfo = await _getFallbackDeviceInfo();
    }
    
    final machineCode = _generateMachineCodeFromInfo(deviceInfo);
    
    try {
      await UnifiedStorage.set<String>(_machineCodeStorageKey, machineCode);
      _cachedMachineCode = machineCode;
    } catch (e) {
      debugPrint('Error storing machine code: $e');
      _cachedMachineCode = machineCode;
    }
    
    return machineCode;
  }
  
  static String _generateMachineCodeFromInfo(String deviceInfo) {
    final bytes = utf8.encode(deviceInfo);
    final digest = sha256.convert(bytes);
    final machineCode = digest.toString().substring(0, 16).toUpperCase();
    return machineCode;
  }
  
  static Future<String> _getFallbackDeviceInfo() async {
    final random = Random.secure();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final randomValue = random.nextInt(999999);
    return 'fallback_${Platform.operatingSystem}_${timestamp}_$randomValue';
  }
  
  /// Generate registration code from machine code
  /// Uses a multi-layer hash with app-specific salt for security
  /// @deprecated Use generateRegistrationCodeWithTime instead
  static String generateRegistrationCode(String machineCode) {
    final appId = 'BankApp';
    final appVersion = '2026';
    final salt1 = _generateSalt(machineCode, appId);
    final salt2 = _generateSalt(machineCode, appVersion);
    
    final combined = '$machineCode$salt1$salt2';
    final bytes = utf8.encode(combined);
    final digest = sha256.convert(bytes);
    
    final code = digest.toString().substring(0, 16).toUpperCase();
    return '${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8, 12)}-${code.substring(12, 16)}';
  }
  
  /// Generate registration code with registration time and duration
  /// Format: Base64(machineCodeHash|timestamp|durationType|checksum)
  /// durationType: 'Y' for year, 'L' for lifetime
  static String generateRegistrationCodeWithTime(String machineCode, DateTime registrationTime, String durationType) {
    final appId = 'BankApp';
    final appVersion = '2026';
    final salt1 = _generateSalt(machineCode, appId);
    final salt2 = _generateSalt(machineCode, appVersion);
    
    final machineCodeHash = _generateMachineCodeHash(machineCode, salt1, salt2);
    final timestamp = registrationTime.millisecondsSinceEpoch.toString();
    final dataString = '$machineCodeHash|$timestamp|$durationType';
    
    final checksum = _generateChecksum(dataString);
    final fullData = '$dataString|$checksum';
    
    final encoded = base64Encode(utf8.encode(fullData));
    return encoded;
  }
  
  static String _generateMachineCodeHash(String machineCode, String salt1, String salt2) {
    final combined = '$machineCode$salt1$salt2';
    final bytes = utf8.encode(combined);
    final digest = sha256.convert(bytes);
    return digest.toString().substring(0, 16).toUpperCase();
  }
  
  static String _generateChecksum(String data) {
    final bytes = utf8.encode(data);
    final digest = sha256.convert(bytes);
    return digest.toString().substring(0, 8).toUpperCase();
  }
  
  static String _generateSalt(String input, String seed) {
    final combined = '$input$seed';
    final bytes = utf8.encode(combined);
    final digest = sha256.convert(bytes);
    return digest.toString().substring(0, 8);
  }
  
  /// Parse registration code and extract registration info
  /// Returns Map with 'registrationTime', 'durationType', 'isValid'
  static Map<String, dynamic>? parseRegistrationCode(String machineCode, String registrationCode) {
    try {
      final decoded = utf8.decode(base64Decode(registrationCode));
      final parts = decoded.split('|');
      
      if (parts.length != 4) {
        return null;
      }
      
      final machineCodeHash = parts[0];
      final timestampStr = parts[1];
      final durationType = parts[2];
      final checksum = parts[3];
      
      final dataString = '$machineCodeHash|$timestampStr|$durationType';
      final expectedChecksum = _generateChecksum(dataString);
      
      if (checksum != expectedChecksum) {
        return null;
      }
      
      final appId = 'BankApp';
      final appVersion = '2026';
      final salt1 = _generateSalt(machineCode, appId);
      final salt2 = _generateSalt(machineCode, appVersion);
      final expectedHash = _generateMachineCodeHash(machineCode, salt1, salt2);
      
      if (machineCodeHash != expectedHash) {
        return null;
      }
      
      final timestamp = int.tryParse(timestampStr);
      if (timestamp == null) {
        return null;
      }
      
      final registrationTime = DateTime.fromMillisecondsSinceEpoch(timestamp);
      
      return {
        'registrationTime': registrationTime,
        'durationType': durationType,
        'isValid': true,
      };
    } catch (e) {
      debugPrint('Error parsing registration code: $e');
      return null;
    }
  }
  
  /// Validate registration code against machine code
  /// Supports both old format and new format with time
  static bool validateRegistrationCode(String machineCode, String registrationCode) {
    final parsed = parseRegistrationCode(machineCode, registrationCode);
    if (parsed != null && parsed['isValid'] == true) {
      return true;
    }
    
    final expectedCode = generateRegistrationCode(machineCode);
    return expectedCode == registrationCode.toUpperCase();
  }
  
  static Future<String> _getWebDeviceInfo() async {
    try {
      final timezone = DateTime.now().timeZoneOffset.inHours;
      final locale = Platform.localeName;
      final platform = Platform.operatingSystem;
      final version = Platform.operatingSystemVersion;
      return 'web_${platform}_${version}_${locale}_${timezone}';
    } catch (e) {
      return await _getFallbackDeviceInfo();
    }
  }
  
  static Future<String> _getAndroidDeviceInfo() async {
    try {
      final platform = Platform.operatingSystem;
      final version = Platform.operatingSystemVersion;
      final locale = Platform.localeName;
      final hostname = Platform.localHostname;
      final processors = Platform.numberOfProcessors;
      final environment = Platform.environment;
      final pathSeparator = Platform.pathSeparator;
      final resolvedExecutable = Platform.resolvedExecutable;
      
      final combined = '$platform|$version|$locale|$hostname|$processors|$pathSeparator|${resolvedExecutable.hashCode}|${environment.length}';
      return combined;
    } catch (e) {
      debugPrint('Error getting Android device info: $e');
      return await _getFallbackDeviceInfo();
    }
  }
  
  static Future<String> _getIOSDeviceInfo() async {
    try {
      final platform = Platform.operatingSystem;
      final version = Platform.operatingSystemVersion;
      final locale = Platform.localeName;
      final hostname = Platform.localHostname;
      final processors = Platform.numberOfProcessors;
      final resolvedExecutable = Platform.resolvedExecutable;
      
      final combined = '$platform|$version|$locale|$hostname|$processors|${resolvedExecutable.hashCode}';
      return combined;
    } catch (e) {
      debugPrint('Error getting iOS device info: $e');
      return await _getFallbackDeviceInfo();
    }
  }
  
  static Future<String> _getDesktopDeviceInfo() async {
    try {
      final platform = Platform.operatingSystem;
      final version = Platform.operatingSystemVersion;
      final hostname = Platform.localHostname;
      final processors = Platform.numberOfProcessors;
      final locale = Platform.localeName;
      final resolvedExecutable = Platform.resolvedExecutable;
      final pathSeparator = Platform.pathSeparator;
      
      final combined = '$platform|$version|$hostname|$processors|$locale|${resolvedExecutable.hashCode}|$pathSeparator';
      return combined;
    } catch (e) {
      debugPrint('Error getting desktop device info: $e');
      return await _getFallbackDeviceInfo();
    }
  }
  
  /// Generate developer password components (split for security)
  static String getDeveloperPasswordPart1() => 'CCBC';
  
  /// Get base developer password (without date)
  static String getBaseDeveloperPassword() {
    return getDeveloperPasswordPart1();
  }
  
  /// Get complete developer password with current date (YYYYMMDD format)
  /// Uses local system time, not internet time
  static String getDeveloperPassword() {
    final now = DateTime.now();
    final dateStr = '${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
    return getBaseDeveloperPassword() + dateStr;
  }
  
  /// Validate developer password
  /// Automatically validates against base password + current date (YYYYMMDD)
  /// Uses local system time for date comparison
  /// Case-insensitive comparison
  static bool validateDeveloperPassword(String password) {
    final basePassword = getBaseDeveloperPassword();
    final now = DateTime.now();
    final dateStr = '${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
    final expectedPassword = basePassword + dateStr;
    return password.toUpperCase() == expectedPassword.toUpperCase();
  }
  
  /// Validate developer password automatically (no input required)
  /// Always returns true - password validation is automatic based on current date
  static bool validateDeveloperPasswordAuto() {
    return true;
  }
}
