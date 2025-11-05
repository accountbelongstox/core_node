import 'package:flutter/foundation.dart';
import 'package:qyflutter/common/auth_v2/auth_v2.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/user_model_app_vipclub.dart';

/// VipClub authentication adapter that bridges auth_v2 with VipClub's user model
/// Provides platform-aware authentication with fallbacks for web
class VipClubAuthAdapter {
  final AuthenticationManager? _authManager;
  final bool _isWeb;

  VipClubAuthAdapter({AuthenticationManager? authManager})
      : _authManager = authManager,
        _isWeb = kIsWeb;

  /// Check if a provider is available on the current platform
  Future<bool> isProviderAvailable(AuthProvider provider) async {
    // On web, only email/username authentication is fully supported
    if (_isWeb) {
      return provider == AuthProvider.email;
    }

    // On native platforms, check with auth manager
    if (_authManager != null) {
      return _authManager!.isProviderAvailable(provider);
    }

    return false;
  }

  /// Get platform-specific message for unsupported providers
  String getUnsupportedProviderMessage(AuthProvider provider) {
    if (_isWeb) {
      switch (provider) {
        case AuthProvider.wechat:
          return 'WeChat login is only available in the native mobile app. Please download our app from the App Store or Google Play.';
        case AuthProvider.google:
          return 'Google Sign-In is coming soon for web. Please use username/password login or download our mobile app.';
        case AuthProvider.phone:
          return 'Phone verification is only available in the native mobile app. Please use username/password login or download our app.';
        default:
          return 'This login method is not available on web. Please use username/password login.';
      }
    }

    return 'This login method is not available. Please try another option.';
  }

  /// Authenticate with WeChat
  Future<AuthResult> authenticateWithWeChat() async {
    if (_isWeb || _authManager == null) {
      return AuthResult.failure(
        errorMessage: getUnsupportedProviderMessage(AuthProvider.wechat),
        errorCode: AuthError.providerNotAvailable,
      );
    }

    try {
      return await _authManager!.authenticate(AuthProvider.wechat);
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'WeChat authentication failed: ${e.toString()}',
        errorCode: AuthError.unknownError,
      );
    }
  }

  /// Authenticate with Google
  Future<AuthResult> authenticateWithGoogle() async {
    if (_isWeb || _authManager == null) {
      return AuthResult.failure(
        errorMessage: getUnsupportedProviderMessage(AuthProvider.google),
        errorCode: AuthError.providerNotAvailable,
      );
    }

    try {
      return await _authManager!.authenticate(AuthProvider.google);
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'Google authentication failed: ${e.toString()}',
        errorCode: AuthError.unknownError,
      );
    }
  }

  /// Send phone verification code
  Future<PhoneAuthResult> sendPhoneVerificationCode(
    String phoneNumber, {
    String? countryCode,
  }) async {
    if (_isWeb || _authManager == null) {
      return PhoneAuthResult.failure(
        errorMessage: getUnsupportedProviderMessage(AuthProvider.phone),
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }

    try {
      final phoneProvider = _authManager!.availableProviders
          .where((p) => p == AuthProvider.phone)
          .firstOrNull;

      if (phoneProvider == null) {
        return PhoneAuthResult.failure(
          errorMessage: 'Phone authentication not configured',
          errorCode: PhoneAuthError.serviceUnavailable,
        );
      }

      // Note: This requires access to the underlying phone provider
      // For now, return not available message
      return PhoneAuthResult.failure(
        errorMessage: getUnsupportedProviderMessage(AuthProvider.phone),
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    } catch (e) {
      return PhoneAuthResult.failure(
        errorMessage: 'Failed to send verification code: ${e.toString()}',
        errorCode: PhoneAuthError.serviceUnavailable,
      );
    }
  }

  /// Verify phone code
  Future<AuthResult> verifyPhoneCode(
    String verificationId,
    String code,
  ) async {
    if (_isWeb || _authManager == null) {
      return AuthResult.failure(
        errorMessage: getUnsupportedProviderMessage(AuthProvider.phone),
        errorCode: AuthError.providerNotAvailable,
      );
    }

    try {
      // Note: This requires access to the underlying phone provider
      // For now, return not available message
      return AuthResult.failure(
        errorMessage: getUnsupportedProviderMessage(AuthProvider.phone),
        errorCode: AuthError.providerNotAvailable,
      );
    } catch (e) {
      return AuthResult.failure(
        errorMessage: 'Phone verification failed: ${e.toString()}',
        errorCode: AuthError.unknownError,
      );
    }
  }

  /// Convert auth_v2 AuthUser to VipClub UserModel
  VipClubUserModel convertAuthUserToVipClubUser(AuthUser authUser) {
    return VipClubUserModel(
      id: authUser.id,
      email: authUser.email ?? '',
      name: authUser.displayName ?? authUser.username ?? 'User',
      phone: authUser.phone ?? '',
      avatar: authUser.avatar,
      memberType: 'regular', // Default member type
      isVipMember: false,
      vipPoints: 0,
      discountRate: 0.0,
      memberSince: authUser.createdAt ?? DateTime.now(),
      memberExpiry: null,
    );
  }

  /// Initialize auth manager with VipClub configuration
  Future<void> initializeAuth() async {
    if (_isWeb || _authManager == null) {
      if (kDebugMode) {
        print('VipClubAuthAdapter: Running on web, skipping native auth initialization');
      }
      return;
    }

    try {
      // Create basic auth configuration for native platforms
      final config = AppAuthConfig(
        providers: {
          AuthProvider.wechat: const WeChatAuthConfig(
            appId: 'YOUR_WECHAT_APP_ID',
            appSecret: 'YOUR_WECHAT_APP_SECRET',
            universalLink: 'YOUR_UNIVERSAL_LINK',
            enabled: false, // Disabled until configured
          ),
          AuthProvider.google: const GoogleAuthConfig(
            webClientId: 'YOUR_GOOGLE_CLIENT_ID',
            enabled: false, // Disabled until configured
          ),
          AuthProvider.phone: const PhoneAuthConfig(
            countryCode: '+86',
            enabled: false, // Disabled until configured
          ),
        },
        enableAutoLogin: true,
        enableBiometric: false,
        sessionTimeoutMinutes: 1440,
      );

      await _authManager!.initialize(config);

      if (kDebugMode) {
        print('VipClubAuthAdapter: Auth manager initialized');
      }
    } catch (e) {
      if (kDebugMode) {
        print('VipClubAuthAdapter: Failed to initialize auth manager: $e');
      }
    }
  }

  /// Sign out from auth_v2
  Future<void> signOut() async {
    if (_authManager != null && !_isWeb) {
      try {
        await _authManager!.signOut();
      } catch (e) {
        if (kDebugMode) {
          print('VipClubAuthAdapter: Sign out error: $e');
        }
      }
    }
  }
}
