# Network Framework - User Guide

**Version**: 2.1 (AuthInterceptor Integrated) ✨  
**Status**: Production Ready  
**Last Updated**: 2025-01-07

## 🎉 What's New in v2.1

- ✅ **Automatic Authentication** - Auth headers auto-injected via `AuthInterceptor`
- ✅ **Smart Token Refresh** - Auto-refresh on expiry or before request
- ✅ **401 Auto-Retry** - Automatically retries requests after token refresh
- ✅ **Zero Manual Auth** - No more manual header management

📖 See [AUTH_INTERCEPTOR_INTEGRATION.md](doc/AUTH_INTERCEPTOR_INTEGRATION.md) for details

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Basic Usage](#basic-usage)
4. [Advanced Features](#advanced-features)
5. [Service Implementation](#service-implementation)
6. [Authentication](#authentication)
7. [Error Handling](#error-handling)
8. [Caching](#caching)
9. [Loading States](#loading-states)
10. [Best Practices](#best-practices)
11. [Migration Guide](#migration-guide)
12. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Initialize Framework

```dart
import 'package:qyflutter/common/network/network_framework.dart';

void main() async {
  // Initialize network framework
  await NetworkFramework.initialize(
    config: BaseNetworkConfig(
      baseUrl: 'https://api.example.com',
      authConfig: AuthConfig(
        authType: AuthType.jwt,
        tokenKey: 'Authorization',
        tokenPrefix: 'Bearer',
      ),
      enableCache: true,
      enableQueue: true,
      enableGlobalLoading: true,
    ),
  );
  
  runApp(MyApp());
}
```

### 2. Create a Service

```dart
import 'package:qyflutter/common/network/network_framework.dart';

class UserService extends AdvancedNetworkService {
  static final UserService instance = UserService._();
  UserService._();
  
  @override
  String get serviceName => 'UserService';
  
  @override
  EndpointConfig get endpointConfig => UserEndpointConfig();
  
  @override
  ApiConfig get apiConfig => ApiConfig(
    baseUrl: 'https://api.example.com',
    authenticationType: AuthenticationType.headerAuth,
    responseValidation: ResponseValidationConfig.standard(),
    timeoutSeconds: 30,
    enableLogging: true,
  );
  
  // Initialize before use
  Future<void> init() async {
    await initialize();
  }
  
  // API methods
  Future<NetworkResponse<UserModel>> getUser(String userId) async {
    return await get<UserModel>(
      'getUser',
      pathParams: {'userId': userId},
    );
  }
  
  Future<NetworkResponse<UserModel>> updateUser(String userId, Map<String, dynamic> data) async {
    return await post<UserModel>(
      'updateUser',
      pathParams: {'userId': userId},
      data: data,
    );
  }
}
```

### 3. Use the Service with Auto Authentication

```dart
// Initialize service
await UserService.instance.init();

// 🔐 Set authentication token (after login)
final client = UserService.instance._client;
client.setAuthTokens(
  accessToken: 'your-jwt-token',
  refreshToken: 'your-refresh-token',
  expiry: DateTime.now().add(Duration(hours: 1)),
);

// Make API call - Auth header automatically added!
final response = await UserService.instance.getUser('123');

if (response.isSuccess) {
  final user = response.data;
  print('User: ${user.name}');
} else {
  print('Error: ${response.error}');
}

// Token is automatically refreshed if expired
// 401 responses automatically trigger retry with new token
```

---

## Architecture Overview

### Core Components

```
NetworkFramework (Singleton)
├── UnifiedNetworkClient (HTTP Client) ✨ NEW: Integrated AuthInterceptor
│   ├── Request/Response handling
│   ├── Auto authentication headers
│   ├── Token auto-refresh
│   ├── 401 auto-retry
│   ├── Timeout management
│   └── Error handling
├── AuthInterceptor (Authentication) ✨ NEW: Automatic Auth
│   ├── Bearer token injection
│   ├── Token expiry detection
│   ├── Auto refresh (5 min before expiry)
│   └── Auth error callbacks
├── UnifiedAuthManager (Auth Config)
│   ├── JWT, Session, Client Key
│   └── Token storage
├── GlobalLoadingSystem (Loading States)
│   ├── Global loading overlay
│   └── Request-level tracking
├── NetworkRequestQueue (Request Queue)
│   ├── Priority management
│   └── Offline queueing
└── CacheManager (Caching)
    ├── Memory cache
    └── Disk cache
```

### Service Hierarchy

```
AdvancedNetworkService (Abstract)
├── Endpoint-based API calls
├── Automatic auth injection
├── Loading management
└── Error handling

Your Service extends AdvancedNetworkService
├── Service-specific endpoints
├── Business logic
└── Data transformation
```

---

## Basic Usage

### HTTP Client Direct Usage

```dart
import 'package:qyflutter/common/network/core/unified_network_client.dart';

// Create client
final client = UnifiedNetworkClient.create(
  config: ApiConfig(
    baseUrl: 'https://api.example.com',
    authenticationType: AuthenticationType.none,
    responseValidation: ResponseValidationConfig.standard(),
  ),
);

// Make request
final response = await client.request<Map<String, dynamic>>(
  NetworkRequest(
    endpoint: '/users/123',
    method: RequestMethod.get,
  ),
);

if (response.isSuccess) {
  print('Data: ${response.data}');
}
```

### Request Types

```dart
// GET request
final response = await service.get<UserModel>(
  'getUser',
  queryParameters: {'page': '1', 'limit': '10'},
);

// POST request
final response = await service.post<UserModel>(
  'createUser',
  data: {
    'name': 'John Doe',
    'email': 'john@example.com',
  },
);

// PUT request
final response = await service.put<UserModel>(
  'updateUser',
  pathParams: {'userId': '123'},
  data: {'name': 'Jane Doe'},
);

// DELETE request
final response = await service.delete<void>(
  'deleteUser',
  pathParams: {'userId': '123'},
);

// PATCH request
final response = await service.patch<UserModel>(
  'patchUser',
  pathParams: {'userId': '123'},
  data: {'email': 'newemail@example.com'},
);
```

---

## Advanced Features

### 1. Retry with Exponential Backoff

```dart
final response = await service.withRetry<UserModel>(
  'getUser',
  pathParams: {'userId': '123'},
  maxRetries: 3,
  initialDelay: Duration(seconds: 1),
  backoffMultiplier: 2.0,
);
```

### 2. Parallel Requests

```dart
final responses = await service.parallel([
  ParallelRequest(
    endpointName: 'getUser',
    pathParams: {'userId': '1'},
  ),
  ParallelRequest(
    endpointName: 'getUser',
    pathParams: {'userId': '2'},
  ),
  ParallelRequest(
    endpointName: 'getUser',
    pathParams: {'userId': '3'},
  ),
]);

for (final response in responses) {
  if (response.isSuccess) {
    print('User: ${response.data}');
  }
}
```

### 3. Sequential Requests

```dart
final responses = await service.sequence([
  ParallelRequest(
    endpointName: 'createUser',
    data: {'name': 'User 1'},
    stopOnError: true, // Stop if this fails
  ),
  ParallelRequest(
    endpointName: 'createUser',
    data: {'name': 'User 2'},
  ),
]);
```

### 4. Request with Loading

```dart
final response = await service.withLoading<UserModel>(
  'getUser',
  pathParams: {'userId': '123'},
  loadingMessage: 'Loading user...',
  loadingType: LoadingType.request,
);
```

### 5. Request Cancellation

```dart
final cancelToken = CancelToken();

// Start request
final responseFuture = service.get<UserModel>(
  'getUser',
  pathParams: {'userId': '123'},
  cancelToken: cancelToken,
);

// Cancel after 2 seconds
Future.delayed(Duration(seconds: 2), () {
  cancelToken.cancel('User cancelled');
});

try {
  final response = await responseFuture;
} catch (e) {
  print('Request cancelled: $e');
}
```

---

## Service Implementation

### Define Endpoints

```dart
class UserEndpointConfig extends EndpointConfig {
  UserEndpointConfig() : super(
    appName: 'user_service',
    version: 'v1',
  );
  
  @override
  void defineEndpoints() {
    // Define endpoint groups
    group('users', basePath: '/users', endpoints: {
      'getUser': EndpointDefinition(
        method: 'GET',
        path: '/:userId',
        authType: AuthType.jwt,
        enableCache: true,
        cacheDuration: Duration(minutes: 5),
      ),
      'createUser': EndpointDefinition(
        method: 'POST',
        path: '',
        authType: AuthType.jwt,
      ),
      'updateUser': EndpointDefinition(
        method: 'PUT',
        path: '/:userId',
        authType: AuthType.jwt,
      ),
      'deleteUser': EndpointDefinition(
        method: 'DELETE',
        path: '/:userId',
        authType: AuthType.jwt,
      ),
    });
  }
}
```

### Service Best Practices

```dart
class UserService extends AdvancedNetworkService {
  static final UserService instance = UserService._();
  UserService._();
  
  @override
  String get serviceName => 'UserService';
  
  @override
  EndpointConfig get endpointConfig => UserEndpointConfig();
  
  @override
  ApiConfig get apiConfig => ApiConfig(
    baseUrl: AppConfig.apiBaseUrl, // Use app config
    authenticationType: AuthenticationType.headerAuth,
    responseValidation: ResponseValidationConfig.standard(),
    defaultHeaders: {
      'X-App-Version': AppConfig.version,
      'X-Platform': Platform.operatingSystem,
    },
  );
  
  // Type-safe API methods
  Future<UserModel?> getUserById(String userId) async {
    final response = await get<Map<String, dynamic>>(
      'getUser',
      pathParams: {'userId': userId},
    );
    
    if (response.isSuccess && response.data != null) {
      return UserModel.fromJson(response.data!);
    }
    return null;
  }
  
  // Handle errors gracefully
  Future<List<UserModel>> getUserList({int page = 1, int limit = 10}) async {
    try {
      final response = await get<Map<String, dynamic>>(
        'getUserList',
        queryParameters: {
          'page': page.toString(),
          'limit': limit.toString(),
        },
      );
      
      if (response.isSuccess && response.data != null) {
        final List users = response.data!['users'] ?? [];
        return users.map((json) => UserModel.fromJson(json)).toList();
      }
    } catch (e) {
      debugPrint('Failed to get user list: $e');
    }
    
    return [];
  }
}
```

---

## Authentication

### ✨ NEW: Automatic Authentication with AuthInterceptor

**UnifiedNetworkClient** now automatically handles authentication via integrated `AuthInterceptor`.

#### Features:
- ✅ **Auto header injection** - Bearer token added automatically
- ✅ **Auto token refresh** - Refreshes when expired or expiring soon (5 min)
- ✅ **401 auto-retry** - Retries request after token refresh
- ✅ **Zero manual work** - No need to manage headers manually

### Quick Example

```dart
// 1. Create client
final client = UnifiedNetworkClient.create(
  config: ApiConfig(
    baseUrl: 'https://api.example.com',
    authenticationType: AuthenticationType.headerAuth,
    responseValidation: ResponseValidationConfig.standard(),
  ),
);

// 2. Set tokens (after login)
client.setAuthTokens(
  accessToken: 'your-jwt-token',
  refreshToken: 'your-refresh-token',
  expiry: DateTime.now().add(Duration(hours: 1)),
);

// 3. Make requests - Auth is automatic!
final response = await client.request(NetworkRequest(
  endpoint: '/api/user/profile',
  method: RequestMethod.get,
));
// ✅ Authorization header automatically added
// ✅ Token auto-refreshed if expiring
// ✅ Request auto-retried on 401

// 4. Check auth status
print('Authenticated: ${client.isAuthenticated}');
print('Token expiring soon: ${client.isTokenExpiringSoon}');

// 5. Logout
client.clearAuthTokens();
```

### Complete Login Flow Example

```dart
class AuthService {
  final UnifiedNetworkClient client;
  
  Future<bool> login(String email, String password) async {
    // Login request
    final response = await client.request<Map<String, dynamic>>(
      NetworkRequest(
        endpoint: '/auth/login',
        method: RequestMethod.post,
        body: {'email': email, 'password': password},
      ),
    );
    
    if (response.isSuccess && response.data != null) {
      // Extract and set tokens
      final data = response.data!;
      client.setAuthTokens(
        accessToken: data['access_token'],
        refreshToken: data['refresh_token'],
        expiry: DateTime.now().add(
          Duration(seconds: data['expires_in']),
        ),
      );
      return true;
    }
    
    return false;
  }
  
  Future<void> logout() async {
    // Call logout endpoint (authenticated automatically)
    await client.request(NetworkRequest(
      endpoint: '/auth/logout',
      method: RequestMethod.post,
    ));
    
    // Clear tokens
    client.clearAuthTokens();
  }
}
```

### Auth Event Callbacks

```dart
// Set up callbacks for auth events
final authInterceptor = AuthInterceptor.instance;

authInterceptor.onTokenUpdated = (newToken) {
  print('Token updated: $newToken');
  // Save to secure storage
};

authInterceptor.onTokenExpired = () {
  print('Token expired');
  // Navigate to login
};

authInterceptor.onAuthenticationFailed = () {
  print('Auth failed');
  // Show error
};
```

### Authentication Methods

```dart
// Set tokens
client.setAuthTokens(
  accessToken: 'token',
  refreshToken: 'refresh',
  expiry: DateTime.now().add(Duration(hours: 1)),
);

// Clear tokens
client.clearAuthTokens();

// Check status
client.isAuthenticated;          // bool
client.isTokenExpired;            // bool
client.isTokenExpiringSoon;       // bool (< 5 min)
client.accessToken;               // String?

// Manual refresh
await client.refreshToken();      // Returns bool
```

📖 **Full documentation**: [AUTH_INTERCEPTOR_INTEGRATION.md](doc/AUTH_INTERCEPTOR_INTEGRATION.md)

---

### Legacy: JWT Authentication (Manual)

For manual authentication (not recommended), you can still use `UnifiedAuthManager`:

```dart
// Initialize with JWT
await NetworkFramework.initialize(
  config: BaseNetworkConfig(
    baseUrl: 'https://api.example.com',
    authConfig: AuthConfig(
      authType: AuthType.jwt,
      tokenKey: 'Authorization',
      tokenPrefix: 'Bearer',
      autoRefreshToken: true,
      tokenRefreshThreshold: Duration(minutes: 5),
    ),
  ),
);

// Set token
await UnifiedAuthManager.instance.setToken('your-jwt-token');

// Set refresh token
await UnifiedAuthManager.instance.setRefreshToken('your-refresh-token');

// Manually refresh token
final success = await UnifiedAuthManager.instance.refreshToken();

// Clear auth
await UnifiedAuthManager.instance.clearAuth();
```

### Session Authentication

```dart
await NetworkFramework.initialize(
  config: BaseNetworkConfig(
    baseUrl: 'https://api.example.com',
    authConfig: AuthConfig(
      authType: AuthType.session,
      sessionKey: 'session_id',
    ),
  ),
);

// Set session
await UnifiedAuthManager.instance.setSessionId('your-session-id');
```

### Client Key Authentication

```dart
await NetworkFramework.initialize(
  config: BaseNetworkConfig(
    baseUrl: 'https://api.example.com',
    authConfig: AuthConfig(
      authType: AuthType.clientKey,
      clientIdKey: 'X-Client-ID',
      clientSecretKey: 'X-Client-Secret',
    ),
  ),
);

// Set credentials
await UnifiedAuthManager.instance.setClientCredentials(
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
);
```

### Check Auth Status

```dart
// Check if authenticated
final isAuthenticated = UnifiedAuthManager.instance.isAuthenticated;

// Get auth summary
final summary = UnifiedAuthManager.instance.getAuthSummary();
print('Auth Type: ${summary['authType']}');
print('Has Token: ${summary['hasToken']}');
```

---

## Error Handling

### Response Handling

```dart
final response = await service.getUser('123');

// Check success
if (response.isSuccess) {
  final user = response.data;
  print('Success: ${user.name}');
} else {
  // Handle error
  print('Error ${response.statusCode}: ${response.error}');
  
  // Check specific status codes
  if (response.statusCode == 401) {
    // Unauthorized - redirect to login
    navigateToLogin();
  } else if (response.statusCode == 404) {
    // Not found
    showError('User not found');
  } else if (response.statusCode == 500) {
    // Server error
    showError('Server error, please try again later');
  }
}
```

### Try-Catch Pattern

```dart
try {
  final response = await service.getUser('123');
  
  if (response.isSuccess) {
    return response.data;
  } else {
    throw NetworkException(
      'Failed to get user: ${response.error}',
      statusCode: response.statusCode,
    );
  }
} catch (e) {
  debugPrint('Error: $e');
  rethrow;
}
```

---

## Caching

### Endpoint-Level Caching

```dart
// Define cached endpoint
'getUser': EndpointDefinition(
  method: 'GET',
  path: '/:userId',
  enableCache: true,
  cacheDuration: Duration(minutes: 5),
  cacheStrategy: CacheStrategy.cacheFirst,
),
```

### Cache Strategies

```dart
enum CacheStrategy {
  noCache,              // No caching
  cacheFirst,           // Use cache if available
  networkFirst,         // Try network first, fallback to cache
  cacheOnly,            // Only use cache
  networkOnly,          // Only use network
  staleWhileRevalidate, // Use cache, update in background
}
```

### Manual Cache Control

```dart
// Clear specific cache
await service.clearCache('getUser_123');

// Clear all cache for service
await service.clearAllCache();

// Clear all framework cache
await CacheManager.instance.clear('all');
```

---

## Loading States

### Global Loading

```dart
// Show global loading
GlobalLoadingSystem.instance.show(
  message: 'Loading...',
  type: LoadingType.request,
);

// Hide global loading
GlobalLoadingSystem.instance.hide();
```

### Request-Level Loading

```dart
// Automatic loading with request
final response = await service.withLoading<UserModel>(
  'getUser',
  pathParams: {'userId': '123'},
  loadingMessage: 'Loading user...',
);
```

### Loading Widget

```dart
// In your widget
class UserProfile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: GlobalLoadingSystem.instance,
      child: Consumer<GlobalLoadingSystem>(
        builder: (context, loadingSystem, child) {
          if (loadingSystem.isGlobalLoading) {
            return Center(child: CircularProgressIndicator());
          }
          return UserProfileContent();
        },
      ),
    );
  }
}
```

---

## Best Practices

### 1. Service Singleton Pattern

```dart
class MyService extends AdvancedNetworkService {
  static final MyService instance = MyService._();
  MyService._();
  
  // Initialize once in app startup
  static Future<void> init() async {
    await instance.initialize();
  }
}
```

### 2. Typed Responses

```dart
// Always specify response type
Future<NetworkResponse<UserModel>> getUser(String id) async {
  return await get<UserModel>('getUser', pathParams: {'id': id});
}
```

### 3. Error Handling

```dart
// Always handle errors
try {
  final response = await service.getUser('123');
  if (response.isSuccess) {
    // Success path
  } else {
    // Error path
    _handleError(response.statusCode, response.error);
  }
} catch (e) {
  // Exception path
  debugPrint('Unexpected error: $e');
}
```

### 4. Loading States

```dart
// Use loading for user-facing operations
final response = await service.withLoading(
  'getUser',
  pathParams: {'userId': '123'},
  loadingMessage: 'Loading user...',
);
```

### 5. Cancellation Support

```dart
// Provide cancellation for long operations
class UserListScreen extends StatefulWidget {
  @override
  _UserListScreenState createState() => _UserListScreenState();
}

class _UserListScreenState extends State<UserListScreen> {
  final _cancelToken = CancelToken();
  
  @override
  void dispose() {
    _cancelToken.cancel('Screen disposed');
    super.dispose();
  }
  
  Future<void> loadUsers() async {
    final response = await service.get(
      'getUserList',
      cancelToken: _cancelToken,
    );
  }
}
```

---

## Migration Guide

### ✨ Migrating to v2.1 (AuthInterceptor)

#### Before (Manual Auth):
```dart
// Manually add auth header to every request
final headers = {
  'Authorization': 'Bearer $token',
};

final response = await http.get(
  Uri.parse('https://api.example.com/profile'),
  headers: headers,
);

// Manually handle 401
if (response.statusCode == 401) {
  // Manually refresh token
  final newToken = await refreshToken();
  // Retry request with new token
  final retryResponse = await http.get(
    Uri.parse('https://api.example.com/profile'),
    headers: {'Authorization': 'Bearer $newToken'},
  );
}
```

#### After (Automatic Auth):
```dart
// Set token once
client.setAuthTokens(
  accessToken: token,
  refreshToken: refreshToken,
  expiry: expiry,
);

// Make request - auth is automatic!
final response = await client.request(NetworkRequest(
  endpoint: '/profile',
  method: RequestMethod.get,
));
// ✅ Auth header added automatically
// ✅ Token refreshed automatically if needed
// ✅ 401 handled and retried automatically
```

**Benefits**:
- ✅ No manual header management
- ✅ Automatic token refresh
- ✅ Automatic 401 retry
- ✅ Cleaner code

---

### From Old SimpleNetworkClient

**Before**:
```dart
final client = SimpleNetworkClient(); // Was non-functional stub
```

**After**:
```dart
final client = UnifiedNetworkClient.create(
  config: ApiConfig(
    baseUrl: 'https://api.example.com',
    authenticationType: AuthenticationType.none,
    responseValidation: ResponseValidationConfig.standard(),
  ),
);
```

### From LegacyNetworkClient

**Before**:
```dart
final response = await LegacyNetworkClient.instance.get<UserModel>('/users/123');
```

**After**:
```dart
// Use service-based approach
final response = await UserService.instance.getUser('123');

// Or direct client
final response = await client.request<Map<String, dynamic>>(
  NetworkRequest(
    endpoint: '/users/123',
    method: RequestMethod.get,
  ),
);
```

### Service Implementation Changes

**Before**:
```dart
class MyService extends AdvancedNetworkService {
  @override
  String get serviceName => 'MyService';
  
  @override
  EndpointConfig get endpointConfig => MyEndpointConfig();
}
```

**After** (Add apiConfig):
```dart
class MyService extends AdvancedNetworkService {
  @override
  String get serviceName => 'MyService';
  
  @override
  EndpointConfig get endpointConfig => MyEndpointConfig();
  
  // REQUIRED: Add API configuration
  @override
  ApiConfig get apiConfig => ApiConfig(
    baseUrl: 'https://api.example.com',
    authenticationType: AuthenticationType.headerAuth,
    responseValidation: ResponseValidationConfig.standard(),
  );
}
```

---

## Troubleshooting

### Issue: "NetworkClient requires ApiConfig"

**Solution**: Implement `apiConfig` getter in your service.

```dart
@override
ApiConfig get apiConfig => ApiConfig(
  baseUrl: 'https://api.example.com',
  authenticationType: AuthenticationType.none,
  responseValidation: ResponseValidationConfig.standard(),
);
```

### Issue: "All requests return null data"

**Cause**: Using old `SimpleNetworkClient` stub.

**Solution**: Update to new `UnifiedNetworkClient` (automatically done in Phase 2).

### Issue: "CancelToken type mismatch"

**Solution**: Import `CancelToken` from `network_types.dart`:

```dart
import 'package:qyflutter/common/network/core/network_types.dart' show CancelToken;
```

### Issue: "LoadingManager not found"

**Cause**: `LoadingManager` was removed in Phase 2.

**Solution**: Use `GlobalLoadingSystem`:

```dart
import 'package:qyflutter/common/network/ui/global_loading_system.dart';

// Show loading
GlobalLoadingSystem.instance.show(message: 'Loading...');

// Hide loading
GlobalLoadingSystem.instance.hide();
```

### Issue: "RequestQueue not found"

**Cause**: `queue/request_queue.dart` was removed.

**Solution**: Use `NetworkRequestQueue` from `network_queue_and_offline.dart`:

```dart
import 'package:qyflutter/common/network/core/network_queue_and_offline.dart';
```

---

## API Reference

### Core Classes

| Class | Purpose | Location |
|-------|---------|----------|
| `NetworkFramework` | Main framework entry | `network_framework.dart` |
| `UnifiedNetworkClient` | HTTP client | `core/unified_network_client.dart` |
| `AdvancedNetworkService` | Service base class | `services/advanced_network_service.dart` |
| `UnifiedAuthManager` | Authentication | `auth/unified_auth_manager.dart` |
| `GlobalLoadingSystem` | Loading states | `ui/global_loading_system.dart` |
| `NetworkRequest` | Request model | `core/network_types.dart` |
| `NetworkResponse<T>` | Response model | `core/network_types.dart` |
| `EndpointConfig` | Endpoint configuration | `endpoints/endpoint_config.dart` |
| `ApiConfig` | API configuration | `models/api_config.dart` |

### Key Enums

| Enum | Purpose | Values |
|------|---------|--------|
| `AuthType` | Authentication type | `none`, `jwt`, `session`, `clientKey`, etc. |
| `RequestMethod` | HTTP method | `get`, `post`, `put`, `delete`, `patch` |
| `RequestPriority` | Request priority | `low`, `normal`, `high`, `critical` |
| `CacheStrategy` | Caching strategy | `noCache`, `cacheFirst`, `networkFirst`, etc. |
| `LoadingType` | Loading type | `request`, `operation`, `page` |

---

## Additional Resources

- **Architecture Analysis**: See `doc/ARCHITECTURE_ANALYSIS.md`
- **Refactoring Log**: See `doc/REFACTORING_LOG.md`
- **Phase 2 Details**: See `doc/PHASE2_REFACTORING.md`
- **Code Examples**: Check `services/` directory for real implementations

---

## Support

For issues or questions:
1. Check this README
2. Review documentation in `doc/` directory
3. Check code comments marked with `// REFACTOR:` or `// FIXED:`
4. Review existing service implementations

---

**Version**: 2.0  
**Last Updated**: 2025-01-07  
**Status**: ✅ Production Ready

