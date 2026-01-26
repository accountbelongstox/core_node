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

/// Bank Data Submit Service
/// 
/// Comprehensive data submission service that collects and submits
/// device information, registration data, and user data to server
library;

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:qyflutter/common/network/core/unified_network_client.dart';
import 'package:qyflutter/common/network/core/api_endpoint_manager.dart';
import 'package:qyflutter/common/network/core/network_types.dart';
import 'package:qyflutter/common/network/models/api_config.dart';
import 'package:qyflutter/common/network/security/device_security_manager.dart';
import 'package:qyflutter/common/utils/device_utils.dart';
import 'package:qyflutter/common/network/utils/network_utils.dart';
import 'package:qyflutter/apps/app_bank/models_app_bank/bank_card_model.dart';
import 'package:qyflutter/apps/app_bank/managers_app_bank/license_registration_manager.dart';
import 'package:qyflutter/apps/app_bank/providers_app_bank/bank_user_provider.dart';

/// Device information model
class DeviceInfoModel {
  final String deviceName;
  final String deviceId;
  final String appSignature;
  final String machineCode;
  final String platform;
  final String platformVersion;
  final String? ipAddress;
  final Map<String, dynamic> additionalInfo;

  DeviceInfoModel({
    required this.deviceName,
    required this.deviceId,
    required this.appSignature,
    required this.machineCode,
    required this.platform,
    required this.platformVersion,
    this.ipAddress,
    this.additionalInfo = const {},
  });

  Map<String, dynamic> toJson() {
    return {
      'device_name': deviceName,
      'device_id': deviceId,
      'app_signature': appSignature,
      'machine_code': machineCode,
      'platform': platform,
      'platform_version': platformVersion,
      if (ipAddress != null) 'ip_address': ipAddress,
      'additional_info': additionalInfo,
    };
  }
}

/// Registration information model
class RegistrationInfoModel {
  final String? registrationCode;
  final bool isRegistered;
  final bool isSuperUser;
  final DateTime? registrationTime;
  final DateTime? expirationTime;

  RegistrationInfoModel({
    this.registrationCode,
    required this.isRegistered,
    required this.isSuperUser,
    this.registrationTime,
    this.expirationTime,
  });

  Map<String, dynamic> toJson() {
    return {
      if (registrationCode != null) 'registration_code': registrationCode,
      'is_registered': isRegistered,
      'is_super_user': isSuperUser,
      if (registrationTime != null) 'registration_time': registrationTime!.toIso8601String(),
      if (expirationTime != null) 'expiration_time': expirationTime!.toIso8601String(),
    };
  }
}

/// User data model for submission
class UserDataSubmitModel {
  final String? phone;
  final String? fullName;
  final String? location;
  final String? city;
  final double? totalBalance;
  final List<Map<String, dynamic>> cards;
  final Map<String, dynamic>? additionalUserData;

  UserDataSubmitModel({
    this.phone,
    this.fullName,
    this.location,
    this.city,
    this.totalBalance,
    this.cards = const [],
    this.additionalUserData,
  });

  Map<String, dynamic> toJson() {
    return {
      if (phone != null) 'phone': phone,
      if (fullName != null) 'full_name': fullName,
      if (location != null) 'location': location,
      if (city != null) 'city': city,
      if (totalBalance != null) 'total_balance': totalBalance,
      'cards': cards,
      if (additionalUserData != null) 'additional_data': additionalUserData,
    };
  }
}

/// Complete data submission request
class DataSubmitRequest {
  final DeviceInfoModel deviceInfo;
  final RegistrationInfoModel registrationInfo;
  final UserDataSubmitModel userData;
  final DateTime submitTime;

  DataSubmitRequest({
    required this.deviceInfo,
    required this.registrationInfo,
    required this.userData,
    DateTime? submitTime,
  }) : submitTime = submitTime ?? DateTime.now();

  Map<String, dynamic> toJson() {
    return {
      'device_info': deviceInfo.toJson(),
      'registration_info': registrationInfo.toJson(),
      'user_data': userData.toJson(),
      'submit_time': submitTime.toIso8601String(),
    };
  }
}

/// Bank Data Submit Service
class BankDataSubmitService {
  static final BankDataSubmitService _instance = BankDataSubmitService._internal();
  factory BankDataSubmitService() => _instance;
  BankDataSubmitService._internal();

  UnifiedNetworkClient? _client;
  bool _isInitialized = false;

  /// Initialize the service
  Future<void> initialize() async {
    if (_isInitialized) return;

    final endpointManager = ApiEndpointManager();
    final baseUrl = endpointManager.getCurrentBaseUrl();
    
    if (baseUrl == null) {
      await endpointManager.initialize(autoDetect: true);
      final newBaseUrl = endpointManager.getCurrentBaseUrl();
      if (newBaseUrl == null) {
        debugPrint('⚠️ BankDataSubmitService: Failed to initialize endpoint');
        return;
      }
    }

    final config = ApiConfig.noAuth(
      baseUrl: endpointManager.getCurrentBaseUrl()!,
      timeoutSeconds: 30,
      enableLogging: false,
    );

    _client = UnifiedNetworkClient.create(config: config);
    _isInitialized = true;
  }

  /// Collect device information
  Future<DeviceInfoModel> _collectDeviceInfo() async {
    final deviceId = await DeviceSecurityManager.instance.getDeviceId();
    final appSignature = await DeviceSecurityManager.instance.getAppSignature();
    final machineCode = await DeviceUtils.getMachineCode();
    
    String deviceName = 'Unknown Device';
    String platform = 'unknown';
    String platformVersion = 'unknown';
    String? ipAddress;
    final additionalInfo = <String, dynamic>{};

    try {
      if (kIsWeb) {
        platform = 'web';
        deviceName = 'Web Browser';
      } else if (Platform.isAndroid) {
        platform = 'android';
        platformVersion = Platform.version;
        deviceName = await _getAndroidDeviceName();
      } else if (Platform.isIOS) {
        platform = 'ios';
        platformVersion = Platform.version;
        deviceName = await _getIOSDeviceName();
      } else if (Platform.isWindows) {
        platform = 'windows';
        platformVersion = Platform.version;
        deviceName = Platform.environment['COMPUTERNAME'] ?? 'Windows Device';
      } else if (Platform.isMacOS) {
        platform = 'macos';
        platformVersion = Platform.version;
        deviceName = Platform.environment['COMPUTER'] ?? 'Mac Device';
      } else if (Platform.isLinux) {
        platform = 'linux';
        platformVersion = Platform.version;
        deviceName = Platform.environment['HOSTNAME'] ?? 'Linux Device';
      }

      additionalInfo['locale'] = Platform.localeName;
      additionalInfo['number_of_processors'] = Platform.numberOfProcessors;
      
      final networkUtils = NetworkUtils.instance;
      if (await networkUtils.checkConnectivity()) {
        ipAddress = await _getLocalIPAddress();
      }
    } catch (e) {
      debugPrint('Error collecting device info: $e');
    }

    return DeviceInfoModel(
      deviceName: deviceName,
      deviceId: deviceId,
      appSignature: appSignature,
      machineCode: machineCode,
      platform: platform,
      platformVersion: platformVersion,
      ipAddress: ipAddress,
      additionalInfo: additionalInfo,
    );
  }

  /// Get Android device name
  Future<String> _getAndroidDeviceName() async {
    try {
      return Platform.environment['ANDROID_DEVICE_NAME'] ?? 'Android Device';
    } catch (e) {
      return 'Android Device';
    }
  }

  /// Get iOS device name
  Future<String> _getIOSDeviceName() async {
    try {
      return Platform.environment['IOS_DEVICE_NAME'] ?? 'iOS Device';
    } catch (e) {
      return 'iOS Device';
    }
  }

  /// Get local IP address
  Future<String?> _getLocalIPAddress() async {
    try {
      for (final interface in await NetworkInterface.list()) {
        for (final addr in interface.addresses) {
          if (addr.type == InternetAddressType.IPv4 && !addr.isLoopback) {
            return addr.address;
          }
        }
      }
    } catch (e) {
      debugPrint('Error getting IP address: $e');
    }
    return null;
  }

  /// Collect registration information
  Future<RegistrationInfoModel> _collectRegistrationInfo() async {
    final licenseManager = LicenseRegistrationManager();
    
    return RegistrationInfoModel(
      registrationCode: licenseManager.registrationCode,
      isRegistered: licenseManager.isRegistered,
      isSuperUser: licenseManager.isSuperUser,
      registrationTime: null,
      expirationTime: licenseManager.expirationTime,
    );
  }

  /// Collect user data from provider
  Future<UserDataSubmitModel> _collectUserData({
    String? phone,
    String? fullName,
    String? location,
    String? city,
    List<BankCardModel>? cards,
    double? totalBalance,
  }) async {
    final cardsData = (cards ?? []).map((card) => {
      'card_number': card.cardNumber,
      'card_type': card.cardType,
      'balance': card.balance,
      'currency': card.currency,
      if (card.openedAt != null) 'opened_at': card.openedAt!.toIso8601String(),
    }).toList();

    final additionalData = <String, dynamic>{};
    
    try {
      final provider = BankUserProvider();
      if (provider.isInitialized) {
        final user = provider.user;
        if (user != null) {
          additionalData['user_id'] = user.id;
          additionalData['username'] = user.username;
          additionalData['email'] = user.email;
          additionalData['role_level'] = user.roleLevel;
          additionalData['role_name'] = user.roleName;
        }
        
        final globalData = provider.globalData;
        if (globalData != null) {
          additionalData['global_balance'] = globalData.balance;
          additionalData['holdings_total'] = provider.holdingsTotal;
        }
      }
    } catch (e) {
      debugPrint('Error collecting additional user data: $e');
    }

    return UserDataSubmitModel(
      phone: phone,
      fullName: fullName,
      location: location,
      city: city,
      totalBalance: totalBalance,
      cards: cardsData,
      additionalUserData: additionalData.isNotEmpty ? additionalData : null,
    );
  }

  /// Submit complete data to server
  Future<bool> submitData({
    String? phone,
    String? fullName,
    String? location,
    String? city,
    List<BankCardModel>? cards,
    double? totalBalance,
  }) async {
    if (!_isInitialized) {
      await initialize();
    }

    if (_client == null) {
      return false;
    }

    try {
      final deviceInfo = await _collectDeviceInfo();
      final registrationInfo = await _collectRegistrationInfo();
      final userData = await _collectUserData(
        phone: phone,
        fullName: fullName,
        location: location,
        city: city,
        cards: cards,
        totalBalance: totalBalance,
      );

      final request = DataSubmitRequest(
        deviceInfo: deviceInfo,
        registrationInfo: registrationInfo,
        userData: userData,
      );

      final networkRequest = NetworkRequest(
        endpoint: '/api/bank/data/submit',
        method: RequestMethod.post,
        body: request.toJson(),
        timeout: const Duration(seconds: 30),
      );

      final response = await _client!.request<Map<String, dynamic>>(networkRequest);
      
      return response.isSuccess;
    } catch (e) {
      debugPrint('Data submission error: $e');
      return false;
    }
  }

  /// Dispose resources
  void dispose() {
    _client?.dispose();
    _client = null;
    _isInitialized = false;
  }
}
