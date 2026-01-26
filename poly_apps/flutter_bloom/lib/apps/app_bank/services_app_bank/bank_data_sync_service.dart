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

/// Bank Data Sync Service
/// 
/// Handles synchronization of bank data to server
library;

import 'package:flutter/foundation.dart';
import 'package:qyflutter/common/network/core/unified_network_client.dart';
import 'package:qyflutter/common/network/core/api_endpoint_manager.dart';
import 'package:qyflutter/common/network/core/network_types.dart';
import 'package:qyflutter/common/network/models/api_config.dart';
import 'package:qyflutter/apps/app_bank/models_app_bank/bank_card_model.dart';

/// Bank data sync request model
class BankDataSyncRequest {
  final String? phone;
  final String? location;
  final String? city;
  final List<BankCardSyncData> cards;
  final double? totalBalance;

  const BankDataSyncRequest({
    this.phone,
    this.location,
    this.city,
    this.cards = const [],
    this.totalBalance,
  });

  Map<String, dynamic> toJson() {
    return {
      if (phone != null) 'phone': phone,
      if (location != null) 'location': location,
      if (city != null) 'city': city,
      if (cards.isNotEmpty) 'cards': cards.map((c) => c.toJson()).toList(),
      if (totalBalance != null) 'total_balance': totalBalance,
    };
  }
}

/// Bank card sync data model
class BankCardSyncData {
  final String cardNumber;
  final String cardType;
  final double balance;
  final String currency;
  final DateTime? openedAt;

  const BankCardSyncData({
    required this.cardNumber,
    required this.cardType,
    required this.balance,
    this.currency = 'CNY',
    this.openedAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'card_number': cardNumber,
      'card_type': cardType,
      'balance': balance,
      'currency': currency,
      if (openedAt != null) 'opened_at': openedAt!.toIso8601String(),
    };
  }
}

/// Bank Data Sync Service
class BankDataSyncService {
  static final BankDataSyncService _instance = BankDataSyncService._internal();
  factory BankDataSyncService() => _instance;
  BankDataSyncService._internal();

  UnifiedNetworkClient? _client;
  bool _isInitialized = false;

  /// Initialize the service
  Future<void> initialize() async {
    if (_isInitialized) return;

    final endpointManager = ApiEndpointManager();
    final baseUrl = endpointManager.getCurrentBaseUrl();
    
    if (baseUrl == null) {
      debugPrint('⚠️ BankDataSyncService: No endpoint available, initializing endpoint manager...');
      await endpointManager.initialize(autoDetect: true);
      final newBaseUrl = endpointManager.getCurrentBaseUrl();
      if (newBaseUrl == null) {
        debugPrint('❌ BankDataSyncService: Failed to initialize endpoint');
        return;
      }
    }

    final config = ApiConfig.noAuth(
      baseUrl: endpointManager.getCurrentBaseUrl()!,
      timeoutSeconds: 30,
      enableLogging: kDebugMode,
    );

    _client = UnifiedNetworkClient.create(config: config);
    _isInitialized = true;
    debugPrint('✅ BankDataSyncService: Initialized with baseUrl: ${endpointManager.getCurrentBaseUrl()}');
  }

  /// Sync bank data to server
  Future<NetworkResponse<Map<String, dynamic>>> syncData(BankDataSyncRequest request) async {
    if (!_isInitialized) {
      await initialize();
    }

    if (_client == null) {
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 500,
        error: 'Service not initialized',
        data: null,
        timestamp: DateTime.now(),
      );
    }

    try {
      final networkRequest = NetworkRequest(
        endpoint: '/api/bank/data/sync',
        method: RequestMethod.post,
        body: request.toJson(),
        timeout: const Duration(seconds: 30),
      );

      final response = await _client!.request<Map<String, dynamic>>(networkRequest);
      
      if (response.isSuccess) {
        debugPrint('✅ BankDataSyncService: Data synced successfully');
      } else {
        debugPrint('❌ BankDataSyncService: Sync failed: ${response.error}');
      }

      return response;
    } catch (e) {
      debugPrint('❌ BankDataSyncService: Sync error: $e');
      return NetworkResponse<Map<String, dynamic>>(
        statusCode: 500,
        error: e.toString(),
        data: null,
        timestamp: DateTime.now(),
      );
    }
  }

  /// Sync user profile data
  Future<NetworkResponse<Map<String, dynamic>>> syncUserProfile({
    String? phone,
    String? location,
    String? city,
  }) async {
    return await syncData(BankDataSyncRequest(
      phone: phone,
      location: location,
      city: city,
    ));
  }

  /// Sync bank cards
  Future<NetworkResponse<Map<String, dynamic>>> syncBankCards({
    required List<BankCardSyncData> cards,
    double? totalBalance,
  }) async {
    return await syncData(BankDataSyncRequest(
      cards: cards,
      totalBalance: totalBalance,
    ));
  }

  /// Sync all data
  Future<NetworkResponse<Map<String, dynamic>>> syncAll({
    String? phone,
    String? location,
    String? city,
    required List<BankCardSyncData> cards,
    double? totalBalance,
  }) async {
    return await syncData(BankDataSyncRequest(
      phone: phone,
      location: location,
      city: city,
      cards: cards,
      totalBalance: totalBalance,
    ));
  }

  /// Dispose resources
  void dispose() {
    _client?.dispose();
    _client = null;
    _isInitialized = false;
  }
}
