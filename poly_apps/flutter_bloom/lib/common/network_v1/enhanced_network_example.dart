import 'dart:async';
import 'package:flutter/material.dart';
import 'core/network_service_locator.dart';
import 'core/unified_network_client.dart';

/// Enhanced Network Usage Example
/// Shows how to use the new robust network framework
class EnhancedNetworkExample {

  /// Example: Initialize the framework in main()
  static Future<void> initializeExample() async {
    // Initialize with production config
    await NetworkFramework.initialize(
      config: NetworkConfig.production(
        baseUrl: 'https://api.myapp.com',
      ),
    );

    print('Network framework initialized successfully');
    print('Queue stats: ${NetworkFramework.queueStats}');
    print('Cache stats: ${NetworkFramework.cacheStats}');
  }

  /// Example: Basic API calls with automatic retries and caching
  static Future<void> basicUsageExample() async {
    final client = NetworkFramework.client;

    try {
      // GET request with automatic caching
      final userResponse = await client.request<Map<String, dynamic>>(
        NetworkRequest(
          endpoint: '/api/users/123',
          method: 'GET',
          enableCache: true,
          cacheStaleTime: Duration(minutes: 10),
          priority: RequestPriority.high,
        ),
      );

      if (userResponse.isSuccess) {
        print('User data: ${userResponse.data}');
        if (userResponse.isFromCache) {
          print('Data served from cache');
        }
      }

    } catch (e) {
      print('Request failed: $e');
    }
  }

  /// Example: POST request with offline support
  static Future<void> postWithOfflineExample() async {
    final client = NetworkFramework.client;

    try {
      final response = await client.request<Map<String, dynamic>>(
        NetworkRequest(
          endpoint: '/api/posts',
          method: 'POST',
          body: {
            'title': 'My Post',
            'content': 'Post content...',
          },
          allowOffline: true,
          priority: RequestPriority.normal,
          maxRetries: 5,
        ),
      );

      if (response.isOffline) {
        print('Request queued for offline sync');
      } else if (response.isSuccess) {
        print('Post created: ${response.data}');
      }

    } catch (e) {
      print('Post creation failed: $e');
    }
  }

  /// Example: High-priority critical request
  static Future<void> criticalRequestExample() async {
    final client = NetworkFramework.client;

    try {
      final response = await client.request<Map<String, dynamic>>(
        NetworkRequest(
          endpoint: '/api/emergency/alert',
          method: 'POST',
          body: {'type': 'critical', 'message': 'Emergency situation'},
          priority: RequestPriority.critical,
          allowOffline: false, // Must succeed immediately
          enableCache: false,  // Always fresh data
          timeout: Duration(seconds: 5),
          maxRetries: 2,
        ),
      );

      if (response.isSuccess) {
        print('Emergency alert sent successfully');
      }

    } catch (e) {
      print('Critical request failed: $e');
      // Handle emergency failure
    }
  }

  /// Example: Batch requests with different priorities
  static Future<void> batchRequestExample() async {
    final client = NetworkFramework.client;

    // Execute multiple requests concurrently
    final futures = <Future<NetworkResponse>>[];

    // High priority: user profile
    futures.add(client.request(NetworkRequest(
      endpoint: '/api/user/profile',
      priority: RequestPriority.high,
    )));

    // Normal priority: user posts
    futures.add(client.request(NetworkRequest(
      endpoint: '/api/user/posts',
      priority: RequestPriority.normal,
    )));

    // Low priority: user statistics
    futures.add(client.request(NetworkRequest(
      endpoint: '/api/user/stats',
      priority: RequestPriority.low,
    )));

    try {
      final results = await Future.wait(futures);
      print('All requests completed: ${results.length} responses');

      for (int i = 0; i < results.length; i++) {
        final result = results[i];
        print('Request $i: ${result.isSuccess ? "Success" : "Failed"}');
      }

    } catch (e) {
      print('Batch request failed: $e');
    }
  }

  /// Example: Custom service class using the framework
  static void customServiceExample() {
    final userService = UserService();

    // Usage remains simple despite complex underlying infrastructure
    userService.getUser(123).then((user) {
      print('Got user: ${user.name}');
    }).catchError((e) {
      print('Failed to get user: $e');
    });
  }

  /// Example: Monitoring network performance
  static void monitoringExample() {
    Timer.periodic(Duration(seconds: 30), (timer) {
      final queueStats = NetworkFramework.queueStats;
      final cacheStats = NetworkFramework.cacheStats;
      final offlineStats = NetworkFramework.offlineStats;

      print('=== Network Performance Report ===');
      print('Queue: $queueStats');
      print('Cache: $cacheStats');
      print('Offline: $offlineStats');
      print('===============================');

      // Alert if queue is backing up
      if (queueStats.totalQueued > 50) {
        print('WARNING: Request queue backing up!');
      }

      // Alert if cache hit rate is low
      if (cacheStats.hitRate < 50.0) {
        print('INFO: Low cache hit rate, consider adjusting cache strategy');
      }
    });
  }

  /// Example: Cleanup when app is closing
  static Future<void> disposeExample() async {
    print('Disposing network framework...');
    await NetworkFramework.dispose();
    print('Network framework disposed successfully');
  }
}

/// Example custom service using the enhanced framework
class UserService {
  final NetworkClient _client = NetworkFramework.client;

  Future<User> getUser(int userId) async {
    final response = await _client.request<Map<String, dynamic>>(
      NetworkRequest(
        endpoint: '/api/users/$userId',
        enableCache: true,
        cacheStaleTime: Duration(minutes: 5),
      ),
    );

    if (response.isSuccess && response.data != null) {
      return User.fromJson(response.data!);
    }

    throw Exception('Failed to get user: ${response.error}');
  }

  Future<List<User>> getUsers({int page = 1, int limit = 20}) async {
    final response = await _client.request<Map<String, dynamic>>(
      NetworkRequest(
        endpoint: '/api/users',
        parameters: {'page': page, 'limit': limit},
        enableCache: true,
        cacheStaleTime: Duration(minutes: 2),
      ),
    );

    if (response.isSuccess && response.data != null) {
      final List<dynamic> usersJson = response.data!['users'] ?? [];
      return usersJson.map((json) => User.fromJson(json)).toList();
    }

    throw Exception('Failed to get users: ${response.error}');
  }

  Future<User> createUser(Map<String, dynamic> userData) async {
    final response = await _client.request<Map<String, dynamic>>(
      NetworkRequest(
        endpoint: '/api/users',
        method: 'POST',
        body: userData,
        allowOffline: true,
        priority: RequestPriority.high,
      ),
    );

    if (response.isOffline) {
      throw OfflineException('User creation queued for when network is available');
    }

    if (response.isSuccess && response.data != null) {
      return User.fromJson(response.data!);
    }

    throw Exception('Failed to create user: ${response.error}');
  }
}

/// Example model class
class User {
  final int id;
  final String name;
  final String email;

  const User({
    required this.id,
    required this.name,
    required this.email,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      name: json['name'],
      email: json['email'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
    };
  }
}

/// Custom offline exception
class OfflineException implements Exception {
  final String message;
  const OfflineException(this.message);

  @override
  String toString() => 'OfflineException: $message';
}

/// Widget example showing integration with Flutter UI
class NetworkAwareWidget extends StatefulWidget {
  @override
  _NetworkAwareWidgetState createState() => _NetworkAwareWidgetState();
}

class _NetworkAwareWidgetState extends State<NetworkAwareWidget> {
  final UserService _userService = UserService();
  List<User> _users = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  Future<void> _loadUsers() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final users = await _userService.getUsers();
      setState(() {
        _users = users;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Network Aware Example')),
      body: _buildBody(),
      floatingActionButton: FloatingActionButton(
        onPressed: _loadUsers,
        child: Icon(Icons.refresh),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error, size: 64, color: Colors.red),
            SizedBox(height: 16),
            Text('Error: $_error'),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadUsers,
              child: Text('Retry'),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: _users.length,
      itemBuilder: (context, index) {
        final user = _users[index];
        return ListTile(
          title: Text(user.name),
          subtitle: Text(user.email),
          leading: CircleAvatar(child: Text(user.id.toString())),
        );
      },
    );
  }
}