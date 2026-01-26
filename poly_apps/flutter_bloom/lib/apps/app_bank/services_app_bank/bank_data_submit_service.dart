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

  /// Collect device information with error tolerance
  Future<DeviceInfoModel> _collectDeviceInfo() async {
    String deviceId = 'unknown';
    String appSignature = 'unknown';
    String machineCode = 'unknown';
    String deviceName = 'Unknown Device';
    String platform = 'unknown';
    String platformVersion = 'unknown';
    String? ipAddress;
    final additionalInfo = <String, dynamic>{};

    try {
      deviceId = await DeviceSecurityManager.instance.getDeviceId();
    } catch (e) {
      debugPrint('Error getting device ID: $e');
    }

    try {
      appSignature = await DeviceSecurityManager.instance.getAppSignature();
    } catch (e) {
      debugPrint('Error getting app signature: $e');
    }

    try {
      machineCode = await DeviceUtils.getMachineCode();
    } catch (e) {
      debugPrint('Error getting machine code: $e');
    }

    try {
      if (kIsWeb) {
        platform = 'web';
        deviceName = 'Web Browser';
      } else if (Platform.isAndroid) {
        platform = 'android';
        try {
          platformVersion = Platform.version;
        } catch (e) {
          platformVersion = 'unknown';
        }
        try {
          deviceName = await _getAndroidDeviceName();
        } catch (e) {
          deviceName = 'Android Device';
        }
      } else if (Platform.isIOS) {
        platform = 'ios';
        try {
          platformVersion = Platform.version;
        } catch (e) {
          platformVersion = 'unknown';
        }
        try {
          deviceName = await _getIOSDeviceName();
        } catch (e) {
          deviceName = 'iOS Device';
        }
      } else if (Platform.isWindows) {
        platform = 'windows';
        try {
          platformVersion = Platform.version;
        } catch (e) {
          platformVersion = 'unknown';
        }
        try {
          deviceName = Platform.environment['COMPUTERNAME'] ?? 'Windows Device';
        } catch (e) {
          deviceName = 'Windows Device';
        }
      } else if (Platform.isMacOS) {
        platform = 'macos';
        try {
          platformVersion = Platform.version;
        } catch (e) {
          platformVersion = 'unknown';
        }
        try {
          deviceName = Platform.environment['COMPUTER'] ?? 'Mac Device';
        } catch (e) {
          deviceName = 'Mac Device';
        }
      } else if (Platform.isLinux) {
        platform = 'linux';
        try {
          platformVersion = Platform.version;
        } catch (e) {
          platformVersion = 'unknown';
        }
        try {
          deviceName = Platform.environment['HOSTNAME'] ?? 'Linux Device';
        } catch (e) {
          deviceName = 'Linux Device';
        }
      }
    } catch (e) {
      debugPrint('Error detecting platform: $e');
    }

    try {
      additionalInfo['locale'] = Platform.localeName;
    } catch (e) {
      debugPrint('Error getting locale: $e');
    }

    try {
      additionalInfo['number_of_processors'] = Platform.numberOfProcessors;
    } catch (e) {
      debugPrint('Error getting processors: $e');
    }
    
    try {
      final networkUtils = NetworkUtils.instance;
      if (await networkUtils.checkConnectivity()) {
        ipAddress = await _getLocalIPAddress();
      }
    } catch (e) {
      debugPrint('Error getting IP address: $e');
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

  /// Collect registration information with error tolerance
  Future<RegistrationInfoModel> _collectRegistrationInfo() async {
    String? registrationCode;
    bool isRegistered = false;
    bool isSuperUser = false;
    DateTime? expirationTime;

    try {
      final licenseManager = LicenseRegistrationManager();
      registrationCode = licenseManager.registrationCode;
      isRegistered = licenseManager.isRegistered;
      isSuperUser = licenseManager.isSuperUser;
      expirationTime = licenseManager.expirationTime;
    } catch (e) {
      debugPrint('Error collecting registration info: $e');
    }
    
    return RegistrationInfoModel(
      registrationCode: registrationCode,
      isRegistered: isRegistered,
      isSuperUser: isSuperUser,
      registrationTime: null,
      expirationTime: expirationTime,
    );
  }

  /// Collect user data from provider with error tolerance
  Future<UserDataSubmitModel> _collectUserData({
    String? phone,
    String? fullName,
    String? location,
    String? city,
    List<BankCardModel>? cards,
    double? totalBalance,
  }) async {
    final cardsData = <Map<String, dynamic>>[];
    
    try {
      if (cards != null && cards.isNotEmpty) {
        for (final card in cards) {
          try {
            cardsData.add({
              'card_number': card.cardNumber,
              'card_type': card.cardType,
              'balance': card.balance,
              'currency': card.currency,
              if (card.openedAt != null) 'opened_at': card.openedAt!.toIso8601String(),
            });
          } catch (e) {
            debugPrint('Error processing card data: $e');
          }
        }
      }
    } catch (e) {
      debugPrint('Error collecting cards data: $e');
    }

    final additionalData = <String, dynamic>{};
    
    try {
      final provider = BankUserProvider();
      if (provider.isInitialized) {
        try {
          final user = provider.user;
          if (user != null) {
            try {
              additionalData['user_id'] = user.id;
            } catch (e) {
              debugPrint('Error getting user_id: $e');
            }
            try {
              additionalData['username'] = user.username;
            } catch (e) {
              debugPrint('Error getting username: $e');
            }
            try {
              additionalData['email'] = user.email;
            } catch (e) {
              debugPrint('Error getting email: $e');
            }
            try {
              additionalData['role_level'] = user.roleLevel;
            } catch (e) {
              debugPrint('Error getting role_level: $e');
            }
            try {
              additionalData['role_name'] = user.roleName;
            } catch (e) {
              debugPrint('Error getting role_name: $e');
            }
          }
        } catch (e) {
          debugPrint('Error getting user data: $e');
        }
        
        try {
          final globalData = provider.globalData;
          if (globalData != null) {
            try {
              additionalData['global_balance'] = globalData.balance;
            } catch (e) {
              debugPrint('Error getting global_balance: $e');
            }
            try {
              additionalData['holdings_total'] = provider.holdingsTotal;
            } catch (e) {
              debugPrint('Error getting holdings_total: $e');
            }
          }
        } catch (e) {
          debugPrint('Error getting global data: $e');
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

  /// Submit complete data to server with error tolerance
  Future<bool> submitData({
    String? phone,
    String? fullName,
    String? location,
    String? city,
    List<BankCardModel>? cards,
    double? totalBalance,
  }) async {
    try {
      if (!_isInitialized) {
        try {
          await initialize();
        } catch (e) {
          debugPrint('Error initializing submit service: $e');
          return false;
        }
      }

      if (_client == null) {
        debugPrint('Client not initialized');
        return false;
      }

      DeviceInfoModel deviceInfo;
      try {
        deviceInfo = await _collectDeviceInfo();
      } catch (e) {
        debugPrint('Error collecting device info, using defaults: $e');
        deviceInfo = DeviceInfoModel(
          deviceName: 'Unknown Device',
          deviceId: 'unknown',
          appSignature: 'unknown',
          machineCode: 'unknown',
          platform: 'unknown',
          platformVersion: 'unknown',
        );
      }

      RegistrationInfoModel registrationInfo;
      try {
        registrationInfo = await _collectRegistrationInfo();
      } catch (e) {
        debugPrint('Error collecting registration info, using defaults: $e');
        registrationInfo = RegistrationInfoModel(
          isRegistered: false,
          isSuperUser: false,
        );
      }

      UserDataSubmitModel userData;
      try {
        userData = await _collectUserData(
          phone: phone,
          fullName: fullName,
          location: location,
          city: city,
          cards: cards,
          totalBalance: totalBalance,
        );
      } catch (e) {
        debugPrint('Error collecting user data, using minimal data: $e');
        userData = UserDataSubmitModel(
          phone: phone,
          fullName: fullName,
          location: location,
          city: city,
          totalBalance: totalBalance,
          cards: [],
        );
      }

      DataSubmitRequest request;
      try {
        request = DataSubmitRequest(
          deviceInfo: deviceInfo,
          registrationInfo: registrationInfo,
          userData: userData,
        );
      } catch (e) {
        debugPrint('Error creating request: $e');
        return false;
      }

      Map<String, dynamic> requestBody;
      try {
        requestBody = request.toJson();
      } catch (e) {
        debugPrint('Error serializing request: $e');
        return false;
      }

      NetworkRequest networkRequest;
      try {
        networkRequest = NetworkRequest(
          endpoint: '/api/bank/data/submit',
          method: RequestMethod.post,
          body: requestBody,
          timeout: const Duration(seconds: 30),
        );
      } catch (e) {
        debugPrint('Error creating network request: $e');
        return false;
      }

      NetworkResponse<Map<String, dynamic>> response;
      try {
        response = await _client!.request<Map<String, dynamic>>(networkRequest);
      } catch (e) {
        debugPrint('Error sending request: $e');
        return false;
      }
      
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
