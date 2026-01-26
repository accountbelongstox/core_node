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
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../common/utils/device_utils.dart';
import '../../../common/network/utils/network_utils.dart';
import '../config_app_bank/prefs_app_bank.dart';
import '../../../common/storage/unified_storage.dart';

class LicenseRegistrationManager with WidgetsBindingObserver {
  static final LicenseRegistrationManager _instance = LicenseRegistrationManager._internal();
  factory LicenseRegistrationManager() => _instance;
  LicenseRegistrationManager._internal();

  static const String _registrationKey = 'license_registration_code';
  static const String _registrationTimeKey = 'license_registration_time';
  static const String _expirationTimeKey = 'license_expiration_time';
  static const String _isRegisteredKey = 'license_is_registered';
  static const String _isSuperUserKey = 'license_is_super_user';
  static const String _cachedNetworkTimeKey = 'license_cached_network_time';
  static const String _lastNetworkTimeRequestKey = 'license_last_network_time_request';
  
  static const String _timeServerUrl = 'http://worldtimeapi.org/api/timezone/Asia/Shanghai';
  static const int _licenseValidityDays = 365;
  static const int _networkTimeRequestIntervalMinutes = 10;
  
  bool _isInitialized = false;
  bool _isRegistered = false;
  bool _isSuperUser = false;
  String? _registrationCode;
  DateTime? _expirationTime;
  DateTime? _cachedNetworkTime;
  DateTime? _lastNetworkTimeRequest;
  Timer? _checkTimer;
  Function()? _onLicenseExpired;
  
  bool get isRegistered => _isRegistered;
  bool get isSuperUser => _isSuperUser;
  String? get registrationCode => _registrationCode;
  DateTime? get expirationTime => _expirationTime;

  Future<void> initialize({Function()? onLicenseExpired}) async {
    if (_isInitialized) return;
    
    _onLicenseExpired = onLicenseExpired;
    
    try {
      await _loadRegistrationState();
      
      // Ensure WidgetsBinding is initialized before adding observer
      // This is idempotent and safe to call multiple times
      WidgetsFlutterBinding.ensureInitialized();
      WidgetsBinding.instance.addObserver(this);
      
      _startPeriodicCheck();
      _isInitialized = true;
      debugPrint('LicenseRegistrationManager initialized. Registered: $_isRegistered');
    } catch (e) {
      debugPrint('Failed to initialize LicenseRegistrationManager: $e');
    }
  }

  Future<void> _loadRegistrationState() async {
    try {
      final prefs = PrefsAppBank();
      if (!prefs.isInitialized) {
        await prefs.initSharedPreferences();
      }
      
      _isRegistered = prefs.getBool(_isRegisteredKey) ?? false;
      _isSuperUser = prefs.getBool(_isSuperUserKey) ?? false;
      _registrationCode = prefs.getString(_registrationKey);
      
      final expTimeStr = prefs.getString(_expirationTimeKey);
      if (expTimeStr != null) {
        _expirationTime = DateTime.parse(expTimeStr);
      }
      
      final cachedTimeStr = prefs.getString(_cachedNetworkTimeKey);
      if (cachedTimeStr != null) {
        _cachedNetworkTime = DateTime.parse(cachedTimeStr);
      }
      
      final lastRequestStr = prefs.getString(_lastNetworkTimeRequestKey);
      if (lastRequestStr != null) {
        _lastNetworkTimeRequest = DateTime.parse(lastRequestStr);
      }
    } catch (e) {
      debugPrint('Error loading registration state: $e');
      _isRegistered = false;
      _isSuperUser = false;
    }
  }

  Future<bool> register(String registrationCode, {bool isSuperUser = false}) async {
    try {
      final machineCode = await DeviceUtils.getMachineCode();
      final isValid = DeviceUtils.validateRegistrationCode(machineCode, registrationCode);
      
      if (!isValid) {
        debugPrint('Invalid registration code');
        return false;
      }
      
      DateTime registrationTime;
      DateTime expiration;
      
      final parsed = DeviceUtils.parseRegistrationCode(machineCode, registrationCode);
      if (parsed != null && parsed['isValid'] == true) {
        registrationTime = parsed['registrationTime'] as DateTime;
        final durationType = parsed['durationType'] as String;
        
        if (durationType == 'L') {
          expiration = DateTime(2099, 12, 31);
        } else {
          expiration = registrationTime.add(Duration(days: _licenseValidityDays));
        }
      } else {
        final now = DateTime.now();
        registrationTime = DateTime(now.year, now.month, now.day, now.hour, now.minute);
        expiration = registrationTime.add(Duration(days: _licenseValidityDays));
      }
      
      final prefs = PrefsAppBank();
      if (!prefs.isInitialized) {
        await prefs.initSharedPreferences();
      }
      
      await prefs.setBool(_isRegisteredKey, true);
      await prefs.setBool(_isSuperUserKey, isSuperUser);
      await prefs.setString(_registrationKey, registrationCode);
      await prefs.setString(_registrationTimeKey, registrationTime.toIso8601String());
      await prefs.setString(_expirationTimeKey, expiration.toIso8601String());
      
      _isRegistered = true;
      _isSuperUser = isSuperUser;
      _registrationCode = registrationCode;
      _expirationTime = expiration;
      
      debugPrint('Registration successful. Registration time: $registrationTime, Expires: $_expirationTime, IsSuperUser: $isSuperUser');
      return true;
    } catch (e) {
      debugPrint('Error during registration: $e');
      return false;
    }
  }

  Future<bool> checkLicenseValidity() async {
    if (!_isRegistered) {
      return false;
    }
    
    try {
      final machineCode = await DeviceUtils.getMachineCode();
      final storedCode = _registrationCode;
      
      if (storedCode != null) {
        final isValidCode = DeviceUtils.validateRegistrationCode(machineCode, storedCode);
        if (!isValidCode) {
          debugPrint('Registration code mismatch - device changed or code invalid');
          await _handleLicenseExpired();
          return false;
        }
      }
      
      DateTime currentTime = await _getCurrentTimeForComparison();
      
      if (_expirationTime != null && currentTime.isAfter(_expirationTime!)) {
        debugPrint('License expired. Current: $currentTime, Expires: $_expirationTime');
        await _handleLicenseExpired();
        return false;
      }
      
      return true;
    } catch (e) {
      debugPrint('Error checking license validity: $e');
      return _isRegistered;
    }
  }
  
  Future<DateTime> _getCurrentTimeForComparison() async {
    final now = DateTime.now();
    final shouldRequestNetworkTime = _shouldRequestNetworkTime();
    
    if (shouldRequestNetworkTime) {
      final networkUtils = NetworkUtils.instance;
      final isConnected = await networkUtils.checkConnectivity();
      
      if (isConnected) {
        final networkTime = await _getNetworkTime();
        if (networkTime != null) {
          await _saveCachedNetworkTime(networkTime);
          return networkTime;
        }
      }
      await _saveCachedNetworkTime(now);
      return now;
    } else {
      final localTime = now;
      final cachedTime = _cachedNetworkTime;
      
      if (cachedTime != null) {
        return localTime.isAfter(cachedTime) ? localTime : cachedTime;
      } else {
        return localTime;
      }
    }
  }
  
  bool _shouldRequestNetworkTime() {
    if (_lastNetworkTimeRequest == null) {
      return true;
    }
    
    final now = DateTime.now();
    final difference = now.difference(_lastNetworkTimeRequest!);
    return difference.inMinutes >= _networkTimeRequestIntervalMinutes;
  }
  
  Future<void> _saveCachedNetworkTime(DateTime time) async {
    try {
      final prefs = PrefsAppBank();
      if (!prefs.isInitialized) {
        await prefs.initSharedPreferences();
      }
      
      _cachedNetworkTime = time;
      _lastNetworkTimeRequest = DateTime.now();
      
      await prefs.setString(_cachedNetworkTimeKey, time.toIso8601String());
      await prefs.setString(_lastNetworkTimeRequestKey, _lastNetworkTimeRequest!.toIso8601String());
    } catch (e) {
      debugPrint('Error saving cached network time: $e');
    }
  }

  Future<DateTime?> _getNetworkTime() async {
    try {
      final response = await http.get(Uri.parse(_timeServerUrl)).timeout(
        const Duration(seconds: 5),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final unixtime = data['unixtime'] as int;
        return DateTime.fromMillisecondsSinceEpoch(unixtime * 1000);
      }
    } catch (e) {
      debugPrint('Error getting network time: $e');
    }
    return null;
  }

  Future<void> unregister() async {
    try {
      final prefs = PrefsAppBank();
      if (!prefs.isInitialized) {
        await prefs.initSharedPreferences();
      }
      
      await prefs.remove(_isRegisteredKey);
      await prefs.remove(_isSuperUserKey);
      await prefs.remove(_registrationKey);
      await prefs.remove(_registrationTimeKey);
      await prefs.remove(_expirationTimeKey);
      
      _isRegistered = false;
      _isSuperUser = false;
      _registrationCode = null;
      _expirationTime = null;
      
      debugPrint('Registration cleared');
    } catch (e) {
      debugPrint('Error unregistering: $e');
    }
  }

  Future<void> _handleLicenseExpired() async {
    debugPrint('License expired. Clearing all data and logging out...');
    
    try {
      await _clearAllStorageData();
      
      _isRegistered = false;
      _isSuperUser = false;
      _registrationCode = null;
      _expirationTime = null;
      _cachedNetworkTime = null;
      _lastNetworkTimeRequest = null;
      
      if (_onLicenseExpired != null) {
        _onLicenseExpired!();
      }
    } catch (e) {
      debugPrint('Error handling license expiration: $e');
    }
  }

  Future<void> _clearAllStorageData() async {
    try {
      final prefs = PrefsAppBank();
      if (!prefs.isInitialized) {
        await prefs.initSharedPreferences();
      }
      
      // CRITICAL: Preserve registration information keys
      // Registration info should persist across logout and only be cleared on license expiration
      final registrationKeys = {
        _isRegisteredKey,
        _isSuperUserKey,
        _registrationKey,
        _registrationTimeKey,
        _expirationTimeKey,
        _cachedNetworkTimeKey,
        _lastNetworkTimeRequestKey,
      };
      
      final allKeys = prefs.getKeys();
      for (final key in allKeys) {
        // Skip registration-related keys - they should persist
        if (!registrationKeys.contains(key)) {
          await prefs.remove(key);
        }
      }
      
      try {
        await UnifiedStorage.clearAppStorage('bank_app');
        await UnifiedStorage.clearBox('bank_app_user');
        UnifiedStorage.clearCache();
      } catch (e) {
        debugPrint('Error clearing UnifiedStorage: $e');
      }
      
      debugPrint('All storage data cleared (registration info preserved)');
    } catch (e) {
      debugPrint('Error clearing storage data: $e');
    }
  }

  void _startPeriodicCheck() {
    _checkTimer?.cancel();
    _checkTimer = Timer.periodic(const Duration(minutes: 5), (timer) {
      checkLicenseValidity();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    switch (state) {
      case AppLifecycleState.resumed:
        debugPrint('App resumed - checking license validity');
        checkLicenseValidity();
        break;
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
        break;
      case AppLifecycleState.detached:
        debugPrint('App detached - checking license validity');
        checkLicenseValidity();
        break;
      case AppLifecycleState.hidden:
        break;
    }
  }

  void dispose() {
    _checkTimer?.cancel();
    try {
      WidgetsBinding.instance.removeObserver(this);
    } catch (e) {
      // Binding not initialized or already disposed, ignore
      debugPrint('Could not remove observer: $e');
    }
    _isInitialized = false;
  }
}
