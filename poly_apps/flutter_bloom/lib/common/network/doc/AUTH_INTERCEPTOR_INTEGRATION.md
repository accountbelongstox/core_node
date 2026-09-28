# AuthInterceptor Integration Guide

**Date**: 2025-01-07  
**Status**: ✅ Integrated  
**Version**: 2.0

---

## Overview

`AuthInterceptor` has been successfully integrated into `UnifiedNetworkClient`, providing automatic authentication management for all HTTP requests.

---

## Features

### ✅ Automatic Authentication Header Injection

Every request automatically includes the `Authorization: Bearer <token>` header if a token is available.

```dart
// No need to manually add auth headers
final response = await client.request(NetworkRequest(
  endpoint: '/api/user/profile',
  method: RequestMethod.get,
));
// Auth header is automatically added: Authorization: Bearer xxx
```

---

### ✅ Token Auto-Refresh

Tokens are automatically refreshed when:
- Token is expired
- Token will expire soon (within 5 minutes)

```dart
// Token refresh happens automatically before request
final response = await client.request(NetworkRequest(
  endpoint: '/api/user/data',
  method: RequestMethod.get,
));
// If token is expiring, it's refreshed before making the request
```

---

### ✅ 401 Unauthorized Auto-Retry

When a request returns `401 Unauthorized`:
1. AuthInterceptor automatically attempts to refresh the token
2. If refresh succeeds, the original request is retried with the new token
3. If refresh fails, the authentication error is handled

```dart
// Request flow on 401:
// 1. Request → 401 Unauthorized
// 2. Auto refresh token
// 3. Retry request with new token
// 4. Return result
```

**Console logs**:
```
→ GET https://api.example.com/protected/resource
   🔐 Authenticated request
← 401 https://api.example.com/protected/resource
⚠️  Received 401 Unauthorized, attempting token refresh...
✅ Token refreshed, retrying request...
→ GET https://api.example.com/protected/resource
   🔐 Authenticated request
← 200 https://api.example.com/protected/resource
```

---

### ✅ Token Management

Built-in methods for managing authentication tokens:

```dart
// Set tokens
client.setAuthTokens(
  accessToken: 'your-jwt-token',
  refreshToken: 'your-refresh-token',
  expiry: DateTime.now().add(Duration(hours: 1)),
);

// Clear tokens (logout)
client.clearAuthTokens();

// Check authentication status
if (client.isAuthenticated) {
  print('User is authenticated');
}

// Get current token
final token = client.accessToken;

// Check token status
if (client.isTokenExpired) {
  print('Token is expired');
}

if (client.isTokenExpiringSoon) {
  print('Token will expire in less than 5 minutes');
}

// Manually refresh token
final refreshSuccess = await client.refreshToken();
```

---

## Usage Examples

### Example 1: Basic Authenticated Request

```dart
// 1. Initialize client
final client = UnifiedNetworkClient.create(
  config: ApiConfig(
    baseUrl: 'https://api.example.com',
    authenticationType: AuthenticationType.headerAuth,
    responseValidation: ResponseValidationConfig.standard(),
  ),
);

// 2. Set authentication token (after login)
client.setAuthTokens(
  accessToken: loginResponse.accessToken,
  refreshToken: loginResponse.refreshToken,
  expiry: DateTime.parse(loginResponse.expiresAt),
);

// 3. Make authenticated requests
final response = await client.request(NetworkRequest(
  endpoint: '/api/user/profile',
  method: RequestMethod.get,
));

// 4. Token is automatically included, no manual header management needed
```

---

### Example 2: Login Flow

```dart
class AuthService {
  final UnifiedNetworkClient client;
  
  AuthService(this.client);
  
  Future<LoginResult> login(String email, String password) async {
    // 1. Login request (no auth needed)
    final response = await client.request<Map<String, dynamic>>(
      NetworkRequest(
        endpoint: '/auth/login',
        method: RequestMethod.post,
        body: {
          'email': email,
          'password': password,
        },
      ),
    );
    
    if (response.isSuccess && response.data != null) {
      // 2. Extract tokens from response
      final accessToken = response.data!['access_token'];
      final refreshToken = response.data!['refresh_token'];
      final expiresIn = response.data!['expires_in']; // seconds
      
      // 3. Set tokens in client
      client.setAuthTokens(
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiry: DateTime.now().add(Duration(seconds: expiresIn)),
      );
      
      return LoginResult.success();
    }
    
    return LoginResult.failure(response.error);
  }
  
  Future<void> logout() async {
    // 1. Call logout endpoint (authenticated)
    await client.request(NetworkRequest(
      endpoint: '/auth/logout',
      method: RequestMethod.post,
    ));
    
    // 2. Clear tokens
    client.clearAuthTokens();
  }
}
```

---

### Example 3: Token Expiry Handling

```dart
class UserService {
  final UnifiedNetworkClient client;
  
  UserService(this.client);
  
  Future<User?> getProfile() async {
    // Check token status before request (optional)
    if (client.isTokenExpired) {
      print('Token expired, refresh will happen automatically');
    } else if (client.isTokenExpiringSoon) {
      print('Token expiring soon, will be refreshed before request');
    }
    
    // Make request - token refresh happens automatically if needed
    final response = await client.request<Map<String, dynamic>>(
      NetworkRequest(
        endpoint: '/api/user/profile',
        method: RequestMethod.get,
      ),
    );
    
    if (response.isSuccess && response.data != null) {
      return User.fromJson(response.data!);
    }
    
    return null;
  }
}
```

---

### Example 4: Manual Token Refresh

```dart
// Check if token needs refresh
if (client.isTokenExpiringSoon) {
  print('Token expiring soon, refreshing...');
  
  // Manually trigger refresh
  final refreshSuccess = await client.refreshToken();
  
  if (refreshSuccess) {
    print('Token refreshed successfully');
    print('New token: ${client.accessToken}');
  } else {
    print('Token refresh failed, user needs to login again');
    // Navigate to login screen
  }
}
```

---

### Example 5: Auth Error Callbacks

```dart
// Set up callbacks for auth events
final authInterceptor = AuthInterceptor.instance;

authInterceptor.onTokenUpdated = (newToken) {
  print('Token updated: $newToken');
  // Save to secure storage
  secureStorage.write(key: 'access_token', value: newToken);
};

authInterceptor.onTokenExpired = () {
  print('Token expired');
  // Navigate to login screen
  navigatorKey.currentState?.pushReplacementNamed('/login');
};

authInterceptor.onAuthenticationFailed = () {
  print('Authentication failed');
  // Show error message
  showSnackBar('Session expired, please login again');
};
```

---

## Integration with AdvancedNetworkService

Services extending `AdvancedNetworkService` automatically benefit from auth integration:

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
    baseUrl: 'https://api.example.com',
    authenticationType: AuthenticationType.headerAuth,
    responseValidation: ResponseValidationConfig.standard(),
  );
  
  // All methods automatically use auth
  Future<NetworkResponse<User>> getProfile() async {
    return await get<User>('getProfile'); // Auth header auto-added
  }
  
  Future<NetworkResponse<User>> updateProfile(UserUpdateData data) async {
    return await put<User>('updateProfile', data: data.toJson());
  }
}

// Usage
await UserService.instance.initialize();

// Set tokens after login
UserService.instance._client.setAuthTokens(...);

// Make authenticated requests
final response = await UserService.instance.getProfile();
```

---

## Architecture

### Request Flow with Authentication

```
1. User calls client.request()
   ↓
2. UnifiedNetworkClient._makeRequestWithAuth()
   ↓
3. _buildHeaders() - Calls AuthInterceptor.getAuthHeaders()
   ↓
4. AuthInterceptor checks token status
   - If expired/expiring soon → auto refresh
   - Add Authorization header
   ↓
5. Make HTTP request
   ↓
6. If response is 401 && !isRetry:
   - Attempt token refresh
   - If success → retry request with new token
   - If failure → call onAuthError()
   ↓
7. Return response
```

---

## Configuration

### Default Behavior

By default, `UnifiedNetworkClient` uses `AuthInterceptor.instance` (singleton).

```dart
final client = UnifiedNetworkClient.create(
  config: apiConfig,
);
// Uses shared AuthInterceptor.instance
```

### Custom AuthInterceptor

You can provide a custom interceptor instance:

```dart
final customAuthInterceptor = AuthInterceptor.instance;
customAuthInterceptor.onTokenUpdated = (token) {
  // Custom handling
};

final client = UnifiedNetworkClient.create(
  config: apiConfig,
  authInterceptor: customAuthInterceptor,
);
```

---

## Best Practices

### 1. Set Tokens After Login

Always set tokens immediately after successful login:

```dart
final loginResponse = await authService.login(email, password);
if (loginResponse.success) {
  client.setAuthTokens(
    accessToken: loginResponse.accessToken,
    refreshToken: loginResponse.refreshToken,
    expiry: loginResponse.expiresAt,
  );
}
```

### 2. Clear Tokens on Logout

Always clear tokens when logging out:

```dart
Future<void> logout() async {
  await authService.logout(); // Call logout endpoint
  client.clearAuthTokens();   // Clear local tokens
  navigateToLogin();
}
```

### 3. Monitor Token Status

Use getters to monitor token health:

```dart
// In your app's lifecycle
Timer.periodic(Duration(minutes: 1), (timer) {
  if (client.isAuthenticated && client.isTokenExpiringSoon) {
    // Proactively refresh
    client.refreshToken();
  }
});
```

### 4. Handle Auth Errors

Set up callbacks to handle auth errors gracefully:

```dart
AuthInterceptor.instance.onAuthenticationFailed = () {
  // Clear local user data
  // Navigate to login
  // Show notification
};
```

### 5. Secure Token Storage

Always store tokens securely:

```dart
AuthInterceptor.instance.onTokenUpdated = (token) async {
  await secureStorage.write(key: 'access_token', value: token);
};

// On app start, restore tokens
final savedToken = await secureStorage.read(key: 'access_token');
if (savedToken != null) {
  client.setAuthTokens(accessToken: savedToken, ...);
}
```

---

## Testing

### Mock Authentication

```dart
// For testing, you can set mock tokens
client.setAuthTokens(
  accessToken: 'mock_token_for_testing',
  refreshToken: 'mock_refresh_token',
  expiry: DateTime.now().add(Duration(hours: 24)),
);
```

### Disable Auth for Tests

```dart
// Create client without auth for public endpoints
final publicClient = UnifiedNetworkClient.create(
  config: ApiConfig(
    baseUrl: 'https://api.example.com',
    authenticationType: AuthenticationType.none, // No auth
    responseValidation: ResponseValidationConfig.standard(),
  ),
);
```

---

## Troubleshooting

### Issue: 401 errors keep happening

**Cause**: Token refresh is failing

**Solution**:
1. Check refresh token is valid
2. Verify refresh endpoint is correct
3. Check AuthInterceptor.refreshToken() implementation

### Issue: Token not added to requests

**Cause**: Token not set or expired

**Solution**:
```dart
// Check token status
print('Authenticated: ${client.isAuthenticated}');
print('Token: ${client.accessToken}');
print('Expired: ${client.isTokenExpired}');
```

### Issue: Infinite refresh loop

**Cause**: Refresh endpoint also returns 401

**Solution**: Ensure refresh endpoint doesn't trigger another refresh

---

## Migration from Manual Auth

**Before** (Manual auth):
```dart
final headers = {
  'Authorization': 'Bearer $token',
};

final response = await http.get(
  Uri.parse('https://api.example.com/profile'),
  headers: headers,
);
```

**After** (Automatic auth):
```dart
client.setAuthTokens(accessToken: token, ...);

final response = await client.request(NetworkRequest(
  endpoint: '/profile',
  method: RequestMethod.get,
));
// Auth header automatically added
```

---

## Summary

✅ **Automatic auth header injection**  
✅ **Token auto-refresh on expiry**  
✅ **401 auto-retry with token refresh**  
✅ **Simple token management API**  
✅ **Event callbacks for auth events**  
✅ **Zero manual header management**

**Status**: Production Ready 🚀

---

**Last Updated**: 2025-01-07  
**Version**: 2.0  
**Maintainer**: Network Layer Team

