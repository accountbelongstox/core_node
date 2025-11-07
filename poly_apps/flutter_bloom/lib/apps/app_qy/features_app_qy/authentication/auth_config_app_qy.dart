/// Authentication configuration for app_qy
library;

import 'package:flutter/foundation.dart';
import '../../../../../common/auth_v2/auth_v2.dart';

/// App-specific authentication configuration
class AuthConfigAppQy {
  /// Get development configuration
  static AppAuthConfig get developmentConfig {
    return AppAuthConfig(
      providers: {
        AuthProvider.wechat: WeChatAuthConfig(
          appId: kDebugMode ? 'wx1234567890abcdef' : 'your-production-wechat-app-id',
          appSecret: kDebugMode ? 'debug-secret' : 'your-production-wechat-secret',
          universalLink: kDebugMode ? 'https://dev.shanbay.com' : 'https://shanbay.com',
          enableUserInfo: true,
        ),
        AuthProvider.phone: PhoneAuthConfig(
          countryCode: '+86',
          autoVerification: true,
          timeoutSeconds: 60,
          retryIntervalSeconds: 30,
          maxRetries: 3,
        ),
      },
      enableAutoLogin: true,
      sessionTimeoutMinutes: 1440, // 24 hours
      enableTokenRefresh: true,
      enableBiometric: false, // Can be enabled later
    );
  }

  /// Get production configuration
  static AppAuthConfig get productionConfig {
    return AppAuthConfig(
      providers: {
        AuthProvider.wechat: WeChatAuthConfig(
          appId: 'your-production-wechat-app-id',
          appSecret: 'your-production-wechat-secret',
          universalLink: 'https://shanbay.com',
          enableUserInfo: true,
        ),
        AuthProvider.phone: PhoneAuthConfig(
          countryCode: '+86',
          autoVerification: true,
          timeoutSeconds: 60,
          retryIntervalSeconds: 30,
          maxRetries: 3,
        ),
      },
      enableAutoLogin: true,
      sessionTimeoutMinutes: 720, // 12 hours in production
      enableTokenRefresh: true,
      enableBiometric: true,
    );
  }

  /// Get configuration based on current environment
  static AppAuthConfig get currentConfig {
    return kDebugMode ? developmentConfig : productionConfig;
  }
}