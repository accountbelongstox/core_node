/// Bank Network V3 Service - Complete integration example
///
/// This file demonstrates how to use the Network V3 framework
/// in a banking application with proper authentication, caching,
/// retry mechanisms, and loading states.

import 'package:flutter/foundation.dart';
import '../../../common/network_v3/network_v3.dart';

/// Main bank service using Network V3 framework
class BankNetworkV3Service {
  static BankNetworkV3Service? _instance;
  static BankNetworkV3Service get instance => _instance ??= BankNetworkV3Service._();
  BankNetworkV3Service._();

  bool _isInitialized = false;

  /// Initialize the bank network service
  static Future<void> initialize({
    required String baseUrl,
    required String clientId,
    String? clientSecret,
  }) async {
    final service = instance;
    if (service._isInitialized) return;

    // Configure Network V3 for banking
    final config = NetworkV3Config.bankingConfig(
      baseUrl: baseUrl,
      clientId: clientId,
      clientSecret: clientSecret,
    );

    // Initialize the framework
    await NetworkV3.initialize(config: config);

    // Setup authentication groups
    await _setupAuthGroups();

    service._isInitialized = true;
    debugPrint('🏦 Bank Network V3 Service initialized');
  }

  /// Setup authentication groups for different endpoint categories
  static Future<void> _setupAuthGroups() async {
    // Group 1: Public endpoints (no auth required)
    await AuthManager.setAuth(
      type: AuthType.none,
      credentials: {},
      groupId: 'public',
    );

    // Group 2: Client authenticated endpoints
    await AuthManager.setAuth(
      type: AuthType.clientId,
      credentials: {
        'clientId': 'bank_app_client',
        'fieldName': 'client_id',
      },
      groupId: 'client_auth',
    );

    debugPrint('🔐 Auth groups configured');
  }

  /// Login user and setup session authentication
  static Future<NetworkResult<Map<String, dynamic>>> login({
    required String username,
    required String password,
    String? deviceId,
  }) async {
    try {
      // Login request with client authentication
      final result = await NetworkClient.post<Map<String, dynamic>>(
        '/auth/login',
        data: {
          'username': username,
          'password': password,
          if (deviceId != null) 'device_id': deviceId,
        },
        authConfig: AuthConfig.clientId(
          clientId: 'bank_app_client',
          fieldName: 'client_id',
        ),
        cacheConfig: CacheConfig.disabled, // Don't cache login requests
        loadingContext: 'login',
        callbacks: {
          'onSuccess': (result) => debugPrint('✅ Login successful'),
          'onError': (error) => debugPrint('❌ Login failed: $error'),
          'onRetry': (data) => debugPrint('🔄 Retrying login...'),
        },
      );

      if (result.isSuccess && result.data != null) {
        final loginData = result.data!;

        // Setup JWT authentication for authenticated endpoints
        if (loginData.containsKey('access_token')) {
          await AuthManager.setAuth(
            type: AuthType.jwt,
            credentials: {
              'token': loginData['access_token'],
              'refreshToken': loginData['refresh_token'] ?? '',
              'headerName': 'Authorization',
              'prefix': 'Bearer',
            },
            groupId: 'user_auth',
          );
        }

        // Setup session authentication if available
        if (loginData.containsKey('session_id')) {
          await AuthManager.setAuth(
            type: AuthType.session,
            credentials: {
              'sessionId': loginData['session_id'],
              'headerName': 'X-Session-ID',
            },
            groupId: 'session_auth',
          );
        }

        // Cache user profile data
        if (loginData.containsKey('user')) {
          await CacheManager.store(
            'user_profile',
            loginData['user'],
            config: CacheConfig.longLived(
              ttl: const Duration(hours: 8),
              tags: ['user', 'profile'],
            ),
          );
        }
      }

      return result;

    } catch (error) {
      return NetworkResult.failure(
        error: NetworkError.authError(
          message: 'Login failed: $error',
        ),
      );
    }
  }

  /// Get account balance with intelligent caching
  static Future<NetworkResult<Map<String, dynamic>>> getAccountBalance({
    required String accountId,
    bool forceRefresh = false,
  }) async {
    return NetworkClient.get<Map<String, dynamic>>(
      '/accounts/$accountId/balance',
      authConfig: AuthConfig.jwt(), // Use JWT authentication
      cacheConfig: forceRefresh
          ? CacheConfig.forceRefresh()
          : CacheConfig.shortLived(
              ttl: const Duration(minutes: 5),
              tags: ['balance', 'account_$accountId'],
            ),
      loadingContext: 'account_balance',
      callbacks: {
        'onCacheHit': (data) => debugPrint('💾 Balance loaded from cache'),
        'onSuccess': (result) => debugPrint('✅ Balance loaded: \${result.data}'),
        'onRetry': (data) => debugPrint('🔄 Retrying balance request...'),
      },
    );
  }

  /// Get transaction history with pagination and caching
  static Future<NetworkResult<List<Map<String, dynamic>>>> getTransactionHistory({
    required String accountId,
    int page = 1,
    int limit = 20,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final queryParams = {
      'page': page.toString(),
      'limit': limit.toString(),
      if (startDate != null) 'start_date': startDate.toIso8601String(),
      if (endDate != null) 'end_date': endDate.toIso8601String(),
    };

    final result = await NetworkClient.get<Map<String, dynamic>>(
      '/accounts/$accountId/transactions',
      queryParameters: queryParams,
      authConfig: AuthConfig.jwt(),
      cacheConfig: CacheConfig.shortLived(
        ttl: const Duration(minutes: 10),
        tags: ['transactions', 'account_$accountId', 'page_$page'],
      ),
      loadingContext: 'transaction_history',
    );

    // Extract transaction list from response
    return result.map<List<Map<String, dynamic>>>((data) {
      if (data is Map<String, dynamic> && data.containsKey('transactions')) {
        return List<Map<String, dynamic>>.from(data['transactions']);
      }
      return [];
    });
  }

  /// Transfer money between accounts
  static Future<NetworkResult<Map<String, dynamic>>> transferMoney({
    required String fromAccountId,
    required String toAccountId,
    required double amount,
    String? description,
    String? reference,
  }) async {
    final transferData = {
      'from_account_id': fromAccountId,
      'to_account_id': toAccountId,
      'amount': amount,
      if (description != null) 'description': description,
      if (reference != null) 'reference': reference,
    };

    final result = await NetworkClient.post<Map<String, dynamic>>(
      '/transfers',
      data: transferData,
      authConfig: AuthConfig.jwt(),
      cacheConfig: CacheConfig.disabled, // Never cache transfer requests
      retryConfig: RetryConfig.conservative(), // Be careful with money transfers
      loadingContext: 'money_transfer',
      callbacks: {
        'onSuccess': (result) {
          debugPrint('✅ Transfer successful: ${result.data}');
          // Invalidate related cache entries
          CacheManager.invalidate(tags: [
            'balance',
            'account_$fromAccountId',
            'account_$toAccountId',
            'transactions',
          ]);
        },
        'onError': (error) => debugPrint('❌ Transfer failed: $error'),
        'onRetry': (data) => debugPrint('🔄 Retrying transfer...'),
      },
    );

    return result;
  }

  /// Upload document with progress tracking
  static Future<NetworkResult<Map<String, dynamic>>> uploadDocument({
    required String accountId,
    required File document,
    required String documentType,
    String? description,
    Function(int sent, int total)? onProgress,
  }) async {
    return NetworkClient.upload<Map<String, dynamic>>(
      '/accounts/$accountId/documents',
      files: [document],
      data: {
        'document_type': documentType,
        if (description != null) 'description': description,
      },
      authConfig: AuthConfig.jwt(),
      loadingContext: 'document_upload',
      onProgress: onProgress,
      callbacks: {
        'onSuccess': (result) {
          debugPrint('✅ Document uploaded: ${result.data}');
          // Invalidate documents cache
          CacheManager.invalidate(tags: ['documents', 'account_$accountId']);
        },
        'onError': (error) => debugPrint('❌ Upload failed: $error'),
      },
    );
  }

  /// Get user profile with smart caching
  static Future<NetworkResult<Map<String, dynamic>>> getUserProfile({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh) {
      // Try cache first
      final cached = await CacheManager.get<Map<String, dynamic>>('user_profile');
      if (cached.isHit) {
        return NetworkResult.success(
          data: cached.data!,
          source: DataSource.cache,
        );
      }
    }

    return NetworkClient.get<Map<String, dynamic>>(
      '/user/profile',
      authConfig: AuthConfig.jwt(),
      cacheConfig: CacheConfig.longLived(
        ttl: const Duration(hours: 4),
        tags: ['user', 'profile'],
      ),
      loadingContext: 'user_profile',
    );
  }

  /// Logout and clean up authentication
  static Future<void> logout() async {
    try {
      // Make logout request
      await NetworkClient.post(
        '/auth/logout',
        authConfig: AuthConfig.jwt(),
        cacheConfig: CacheConfig.disabled,
      );
    } catch (error) {
      debugPrint('❌ Logout request failed: $error');
    } finally {
      // Clear all authentication
      await AuthManager.clearAuth();

      // Clear user-related cache
      await CacheManager.invalidate(tags: ['user', 'profile', 'balance', 'transactions']);

      debugPrint('🔓 User logged out and cache cleared');
    }
  }

  /// Get comprehensive service status
  static Future<Map<String, dynamic>> getServiceStatus() async {
    return {
      'networkV3': await NetworkV3.getStatus(),
      'bankService': {
        'initialized': instance._isInitialized,
        'authStatus': await AuthManager.getStatus(),
        'cacheStatus': await CacheManager.getStatus(),
      },
    };
  }

  /// Preload critical data for better user experience
  static Future<void> preloadCriticalData() async {
    try {
      // Preload user profile
      await getUserProfile();

      // If we have cached accounts, preload their balances
      final userProfile = await CacheManager.get<Map<String, dynamic>>('user_profile');
      if (userProfile.isHit && userProfile.data!.containsKey('accounts')) {
        final accounts = userProfile.data!['accounts'] as List;

        for (final account in accounts) {
          if (account is Map<String, dynamic> && account.containsKey('id')) {
            // Preload balance for each account (fire and forget)
            getAccountBalance(accountId: account['id']).catchError((error) {
              debugPrint('⚠️ Failed to preload balance for ${account['id']}: $error');
            });
          }
        }
      }

      debugPrint('📦 Critical data preloaded');
    } catch (error) {
      debugPrint('❌ Failed to preload critical data: $error');
    }
  }
}

/// Usage example in a banking app widget
class BankingAppExample {
  static Future<void> demonstrateUsage() async {
    // 1. Initialize the service
    await BankNetworkV3Service.initialize(
      baseUrl: 'https://api.bankapp.com/v1',
      clientId: 'bank_mobile_app',
      clientSecret: 'secret_key_here',
    );

    // 2. Login user
    final loginResult = await BankNetworkV3Service.login(
      username: 'user@example.com',
      password: 'password123',
      deviceId: 'device_unique_id',
    );

    if (loginResult.isSuccess) {
      print('✅ Login successful');

      // 3. Preload critical data
      await BankNetworkV3Service.preloadCriticalData();

      // 4. Get account balance (will use cache if available)
      final balanceResult = await BankNetworkV3Service.getAccountBalance(
        accountId: 'account_123',
      );

      if (balanceResult.isSuccess) {
        print('Balance: \${balanceResult.data!['balance']}');
      }

      // 5. Get transaction history
      final transactionsResult = await BankNetworkV3Service.getTransactionHistory(
        accountId: 'account_123',
        page: 1,
        limit: 20,
      );

      if (transactionsResult.isSuccess) {
        print('Found ${transactionsResult.data!.length} transactions');
      }

      // 6. Transfer money
      final transferResult = await BankNetworkV3Service.transferMoney(
        fromAccountId: 'account_123',
        toAccountId: 'account_456',
        amount: 100.0,
        description: 'Payment for services',
      );

      if (transferResult.isSuccess) {
        print('✅ Transfer completed');
      }

    } else {
      print('❌ Login failed: ${loginResult.error?.message}');
    }
  }
}

/// Widget integration example
/*
class BankAccountWidget extends StatefulWidget {
  final String accountId;

  const BankAccountWidget({Key? key, required this.accountId}) : super(key: key);

  @override
  State<BankAccountWidget> createState() => _BankAccountWidgetState();
}

class _BankAccountWidgetState extends State<BankAccountWidget> {
  NetworkResult<Map<String, dynamic>>? balanceResult;

  @override
  void initState() {
    super.initState();
    _loadBalance();
  }

  Future<void> _loadBalance() async {
    final result = await BankNetworkV3Service.getAccountBalance(
      accountId: widget.accountId,
    );

    setState(() {
      balanceResult = result;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Account ${widget.accountId}'),
            const SizedBox(height: 8),

            // Use NetworkStateBuilder for loading states
            NetworkStateBuilder<Map<String, dynamic>>(
              result: balanceResult,
              builder: (context, data) {
                return Text(
                  'Balance: \${data['balance']}',
                  style: Theme.of(context).textTheme.headlineSmall,
                );
              },
              loadingBuilder: (context) => const CircularProgressIndicator(),
              errorBuilder: (context, error) => Text(
                'Error: ${error.userMessage}',
                style: TextStyle(color: Colors.red),
              ),
            ),

            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _loadBalance(),
              child: const Text('Refresh'),
            ),
          ],
        ),
      ),
    );
  }
}
*/