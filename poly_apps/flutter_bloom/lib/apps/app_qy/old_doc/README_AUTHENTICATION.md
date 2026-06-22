# App_QY Authentication Implementation

This document describes the authentication implementation for app_qy (扇贝单词) using the Flutter Bloom auth_v2 library.

## Overview

The app_qy authentication system provides:

- **Phone Number Authentication**: SMS verification with countdown timer
- **WeChat Authentication**: OAuth integration with WeChat
- **Debug Mode**: Skip login for development purposes
- **Session Management**: Automatic token refresh and session validation
- **User Profile Management**: Store and update user information

## Architecture

### Components

1. **Authentication Layer** (`features_app_qy/authentication/`)
   - `login_screen_app_qy.dart`: Main login UI matching the design
   - `auth_service_app_qy.dart`: Business logic for authentication flows
   - `auth_config_app_qy.dart`: Environment-specific configuration
   - `auth_routes_app_qy.dart`: Route definitions and guards

2. **State Management** (`provider_app_qy/`)
   - `user_provider_app_qy.dart`: User authentication state management

3. **Services** (`services_app_qy/`)
   - `cache_service_app_qy.dart`: Local data persistence with SharedPreferences

4. **UI Widgets** (`features_app_qy/authentication/widgets/`)
   - `phone_login_button.dart`: Phone number login button
   - `wechat_login_button.dart`: WeChat login button
   - `agreement_checkbox.dart`: Terms and privacy agreement

## Usage

### Initialize Authentication

```dart
final userProvider = Provider.of<UserProviderAppQy>(context, listen: false);
await userProvider.initializeAuth();
```

### Phone Authentication

```dart
// Send verification code
final result = await userProvider.sendVerificationCode('13800138000');

// Login with verification code
final success = await userProvider.loginWithPhone('13800138000', '123456');
```

### WeChat Authentication

```dart
final success = await userProvider.loginWithWeChat();
```

### Check Authentication State

```dart
if (userProvider.isAuthenticated) {
  // User is logged in
  final user = userProvider.currentUser;
}
```

## Configuration

### Development Environment

```dart
AppAuthConfig(
  providers: {
    AuthProvider.wechat: WeChatAuthConfig(
      appId: 'wx1234567890abcdef',
      appSecret: 'debug-secret',
      universalLink: 'https://dev.shanbay.com',
    ),
    AuthProvider.phone: PhoneAuthConfig(
      countryCode: '+86',
      timeoutSeconds: 60,
    ),
  },
  sessionTimeoutMinutes: 1440, // 24 hours
)
```

### Production Environment

```dart
AppAuthConfig(
  providers: {
    AuthProvider.wechat: WeChatAuthConfig(
      appId: 'production-wechat-app-id',
      appSecret: 'production-secret',
      universalLink: 'https://shanbay.com',
    ),
  },
  sessionTimeoutMinutes: 720, // 12 hours
  enableBiometricAuth: true,
)
```

## Security Features

1. **Token Management**: Automatic refresh and expiration handling
2. **Session Validation**: Periodic validation of active sessions
3. **Local Storage**: Encrypted storage of sensitive data
4. **Input Validation**: Phone number and verification code validation
5. **Error Handling**: Comprehensive error management

## Integration with Flutter Bloom

The authentication system integrates seamlessly with Flutter Bloom's:

- **Storage System**: Uses common storage patterns
- **Network Layer**: Follows Flutter Bloom networking standards
- **State Management**: Compatible with Provider pattern
- **Routing**: Integrates with GoRouter navigation
- **Theming**: Follows Flutter Bloom design system

## Debug Mode

For development purposes, the app includes a debug mode that allows:

- Skip login functionality
- Mock authentication responses
- Test credentials acceptance
- Extended session timeouts

Enable debug mode by using the development configuration in `auth_config_app_qy.dart`.

## Future Enhancements

1. **Biometric Authentication**: Fingerprint and face recognition
2. **Social Logins**: Additional provider support (QQ, GitHub, Google)
3. **Multi-factor Authentication**: Enhanced security options
4. **Account Recovery**: Password reset and account recovery flows
5. **Profile Management**: Enhanced user profile features

## Testing

The authentication system includes comprehensive error handling and validation:

- Phone number format validation
- Verification code format validation
- Network error handling
- Provider-specific error mapping
- Session timeout handling

## Dependencies

- `flutter_bloom_auth_v2`: Core authentication library
- `provider`: State management
- `shared_preferences`: Local storage
- `http`: HTTP requests
- `url_launcher`: OAuth redirects
- `equatable`: Value equality