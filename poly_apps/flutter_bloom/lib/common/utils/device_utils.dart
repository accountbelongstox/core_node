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

class DeviceUtils {
  static String? _cachedMachineCode;
  
  /// Generate a unique machine code based on device characteristics
  static Future<String> getMachineCode() async {
    if (_cachedMachineCode != null) {
      return _cachedMachineCode!;
    }
    
    String deviceInfo = '';
    
    try {
      if (kIsWeb) {
        // For web, use browser characteristics
        deviceInfo = _getWebDeviceInfo();
      } else if (Platform.isAndroid || Platform.isIOS) {
        // For mobile, use platform characteristics
        deviceInfo = await _getMobileDeviceInfo();
      } else {
        // For desktop, use system characteristics
        deviceInfo = await _getDesktopDeviceInfo();
      }
    } catch (e) {
      // Fallback to random but persistent identifier
      deviceInfo = 'fallback_${DateTime.now().millisecondsSinceEpoch}';
    }
    
    // Generate machine code from device info
    final bytes = utf8.encode(deviceInfo);
    final digest = sha256.convert(bytes);
    final machineCode = digest.toString().substring(0, 16).toUpperCase();
    
    _cachedMachineCode = machineCode;
    return machineCode;
  }
  
  /// Generate registration code from machine code
  static String generateRegistrationCode(String machineCode) {
    // Use a complex algorithm to generate registration code
    final key = 'BankApp2024SecretKey';
    final combined = '$machineCode$key';
    final bytes = utf8.encode(combined);
    final digest = sha256.convert(bytes);
    
    // Format as XXXX-XXXX-XXXX-XXXX
    final code = digest.toString().substring(0, 16).toUpperCase();
    return '${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8, 12)}-${code.substring(12, 16)}';
  }
  
  /// Validate registration code against machine code
  static bool validateRegistrationCode(String machineCode, String registrationCode) {
    final expectedCode = generateRegistrationCode(machineCode);
    return expectedCode == registrationCode.toUpperCase();
  }
  
  static String _getWebDeviceInfo() {
    // For web, use a combination of available browser info
    final userAgent = 'WebBrowser';
    final screenInfo = '${1920}x${1080}'; // Default screen resolution
    final timezone = DateTime.now().timeZoneOffset.inHours;
    return '$userAgent-$screenInfo-$timezone';
  }
  
  static Future<String> _getMobileDeviceInfo() async {
    // For mobile, use platform-specific info
    final platform = Platform.operatingSystem;
    final version = Platform.operatingSystemVersion;
    final locale = Platform.localeName;
    return '$platform-$version-$locale';
  }
  
  static Future<String> _getDesktopDeviceInfo() async {
    // For desktop, use system info
    final platform = Platform.operatingSystem;
    final version = Platform.operatingSystemVersion;
    final hostname = Platform.localHostname;
    final processors = Platform.numberOfProcessors;
    return '$platform-$version-$hostname-$processors';
  }
  
  /// Generate developer password components (split for security)
  static String getDeveloperPasswordPart1() => 'games';
  static String getDeveloperPasswordPart2() => '123';
  static String getDeveloperPasswordPart3() => '456';
  
  /// Get complete developer password
  static String getDeveloperPassword() {
    return getDeveloperPasswordPart1() + getDeveloperPasswordPart2() + getDeveloperPasswordPart3();
  }
  
  /// Validate developer password
  static bool validateDeveloperPassword(String password) {
    return password == getDeveloperPassword();
  }
}
