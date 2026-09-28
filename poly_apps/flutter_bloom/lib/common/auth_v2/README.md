# Flutter Bloom Authentication Library v2

A comprehensive authentication library for Flutter Bloom multi-app applications, supporting multiple authentication providers including WeChat, QQ, Google, GitHub, and phone number authentication.

## Features

- 🔄 **Multi-Provider Support**: WeChat, QQ, Google, GitHub, Phone number
- 🔐 **Secure Authentication**: OAuth 2.0, JWT, SMS verification
- 📱 **Cross-Platform**: iOS, Android, Web support
- 🎯 **Easy Integration**: Simple API for Flutter Bloom apps
- 💾 **Session Management**: Automatic token refresh and session handling
- 🔗 **Provider Linking**: Link multiple auth methods to one account
- 📊 **State Management**: Real-time authentication state updates
- 🛡️ **Error Handling**: Comprehensive error management

## Quick Start

### 1. Add Dependencies

Add to your `pubspec.yaml`:

```yaml
dependencies:
  flutter_bloom_auth_v2:
    path: ../../common/auth_v2
  equatable: ^2.0.5
  http: ^1.1.0
  url_launcher: ^6.1.12
```

### 2. Configure Authentication

```dart
import 'package:flutter_bloom/common/auth_v2/auth_v2.dart';

// Create authentication configuration
final appAuthConfig = AppAuthConfig(
  providers: {
    AuthProvider.google: GoogleAuthConfig(
      webClientId: 'your-web-client-id',
      iosClientId: 'your-ios-client-id',
      androidClientId: 'your-android-client-id',
    ),
    AuthProvider.wechat: WeChatAuthConfig(
      appId: 'your-wechat-app-id',
      appSecret: 'your-wechat-app-secret',
      universalLink: 'https://your-app.com',
    ),
    AuthProvider.phone: PhoneAuthConfig(
      timeoutSeconds: 60,
      autoVerification: true,
    ),
  },
  enableAutoLogin: true,
  sessionTimeoutMinutes: 1440, // 24 hours
);

// Initialize authentication manager
final authManager = AuthenticationManager();
await authManager.initialize(appAuthConfig);
```

### 3. Authenticate User

```dart
// Google authentication
final result = await authManager.authenticate(AuthProvider.google);
if (result.success) {
  print('User logged in: ${result.user?.displayName}');
  print('Token: ${result.token?.accessToken}');
}

// Phone authentication
final phoneProvider = authManager.availableProviders
    .firstWhere((p) => p == AuthProvider.phone) as IPhoneAuthProvider;

final phoneResult = await phoneProvider.sendVerificationCode('+1234567890');
if (phoneResult.success) {
  final verifyResult = await phoneProvider.verifyCode(
    phoneResult.verificationId!,
    '123456',
  );
  if (verifyResult.success) {
    print('Phone authentication successful');
  }
}
```

### 4. Listen to Authentication State

```dart
class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late final AuthenticationManager _authManager;
  StreamSubscription<AuthResult?>? _authSubscription;

  @override
  void initState() {
    super.initState();
    _authManager = AuthenticationManager();
    _authSubscription = _authManager.authStateStream.listen((result) {
      if (result != null && result.success) {
        setState(() {
          // Handle successful authentication
        });
      } else {
        setState(() {
          // Handle authentication failure or logout
        });
      }
    });
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    _authManager.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: _authManager.isAuthenticated ? HomeScreen() : LoginScreen(),
    );
  }
}
```

## Provider-Specific Configuration

### WeChat Authentication

```dart
final wechatConfig = WeChatAuthConfig(
  appId: 'wx1234567890abcdef',
  appSecret: 'your-app-secret',
  universalLink: 'https://your-app.com',
  enableUserInfo: true,
);
```

### QQ Authentication

```dart
final qqConfig = QQAuthConfig(
  appId: '1234567890',
  appKey: 'your-app-key',
  universalLink: 'https://your-app.com',
);
```

### Google Authentication

```dart
final googleConfig = GoogleAuthConfig(
  webClientId: 'your-web-client-id.apps.googleusercontent.com',
  iosClientId: 'your-ios-client-id.apps.googleusercontent.com',
  androidClientId: 'your-android-client-id.apps.googleusercontent.com',
  scopes: [
    'email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
);
```

### GitHub Authentication

```dart
final githubConfig = GitHubAuthConfig(
  clientId: 'your-github-client-id',
  clientSecret: 'your-github-client-secret',
  scopes: 'user:email',
  redirectUri: 'https://your-app.com/auth/callback',
);
```

### Phone Authentication

```dart
final phoneConfig = PhoneAuthConfig(
  timeoutSeconds: 60,
  autoVerification: true,
  retryIntervalSeconds: 30,
  maxRetries: 3,
);
```

## Advanced Usage

### Custom Authentication State Listener

```dart
class MyAuthListener implements IAuthStateListener {
  @override
  void onAuthStateChanged(AuthResult? result) {
    // Handle authentication state changes
  }

  @override
  void onUserProfileUpdated(AuthUser user) {
    // Handle profile updates
  }

  @override
  void onTokenRefreshed(AuthToken newToken) {
    // Handle token refresh
  }

  @override
  void onSessionExpired() {
    // Handle session expiration
  }

  @override
  void onAuthError(AuthError error, String message) {
    // Handle authentication errors
  }
}

// Add listener
authManager.addAuthStateListener(MyAuthListener());
```

### Provider Linking

```dart
// Link additional provider to existing account
final linkResult = await authManager.linkAdditionalProvider(
  AuthProvider.wechat,
  wechatConfig,
);

if (linkResult.success) {
  print('WeChat linked successfully');
}

// Get linked providers
final linkedProviders = await authManager.getLinkedProviders();
print('Linked providers: $linkedProviders');
```

### Custom Provider Registration

```dart
class CustomAuthProvider extends IAuthProvider {
  @override
  AuthProvider get providerType => AuthProvider.custom;

  @override
  Future<bool> get isAvailable async => true;

  @override
  Future<void> initialize(AuthConfig config) async {
    // Initialize custom provider
  }

  @override
  Future<AuthResult> authenticate({Map<String, dynamic>? additionalParameters}) async {
    // Implement custom authentication logic
    return AuthResult.success(
      user: AuthUser(id: 'custom-id', provider: AuthProvider.custom),
      token: AuthToken(accessToken: 'custom-token'),
    );
  }

  // Implement other required methods...
}

// Register custom provider
final factory = AuthProviderFactory();
factory.registerProvider<CustomAuthProvider>(
  AuthProvider.custom,
  () => CustomAuthProvider(),
);
```

## Error Handling

The library provides comprehensive error handling with specific error codes:

```dart
final result = await authManager.authenticate(AuthProvider.google);
if (!result.success) {
  switch (result.errorCode) {
    case AuthError.userCancelled:
      print('User cancelled authentication');
      break;
    case AuthError.networkError:
      print('Network error occurred');
      break;
    case AuthError.providerNotAvailable:
      print('Google authentication not available');
      break;
    default:
      print('Authentication error: ${result.errorMessage}');
  }
}
```

## Integration with Flutter Bloom

This authentication library integrates seamlessly with Flutter Bloom's existing infrastructure:

- **Storage**: Uses Flutter Bloom's unified storage system
- **Network**: Integrates with Flutter Bloom's networking layer
- **State Management**: Compatible with Flutter Bloom's provider pattern
- **Theming**: Follows Flutter Bloom's theming conventions
- **Localization**: Supports Flutter Bloom's internationalization system

## Platform Requirements

### Android
- Add required permissions to `android/app/src/main/AndroidManifest.xml`:
  ```xml
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  ```

### iOS
- Add URL schemes to `ios/Runner/Info.plist`:
  ```xml
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>com.your.app</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>your-app-scheme</string>
      </array>
    </dict>
  </array>
  ```

### Web
- Configure OAuth redirect URLs in your provider's developer console

## Troubleshooting

### Common Issues

1. **WeChat Authentication Not Working**
   - Ensure WeChat app is installed on the device
   - Verify app ID and universal link configuration
   - Check WeChat developer console settings

2. **Google Sign-In Errors**
   - Verify SHA-1 fingerprint in Google Cloud Console
   - Ensure correct client IDs for each platform
   - Check that Google Sign-In is enabled

3. **Phone Authentication Issues**
   - Verify Firebase Authentication is properly configured
   - Check phone number format and country code
   - Ensure SMS delivery is working

### Debug Mode

Enable debug logging to troubleshoot issues:

```dart
// In your app initialization
import 'package:flutter/foundation.dart';

// Authentication errors will be logged in debug mode
```

## Support

For issues and questions:

1. Check the Flutter Bloom documentation
2. Review provider-specific documentation
3. Enable debug logging for detailed error information
4. Check platform-specific requirements