
/// Base authentication interface for all authentication providers
library auth_interface;

import 'dart:async';
import 'auth_models.dart';
import 'auth_config.dart';

/// Base interface for all authentication providers
abstract class IAuthProvider {
  /// Get the provider type
  AuthProvider get providerType;

  /// Check if the provider is available on the current platform
  Future<bool> get isAvailable;

  /// Initialize the provider with configuration
  Future<void> initialize(AuthConfig config);

  /// Check if the provider is properly initialized
  bool get isInitialized;

  /// Authenticate the user (main entry point)
  Future<AuthResult> authenticate({
    Map<String, dynamic>? additionalParameters,
  });

  /// Sign out the user
  Future<void> signOut();

  /// Refresh the authentication token if applicable
  Future<AuthToken?> refreshToken(String? refreshToken);

  /// Get current authenticated user if available
  Future<AuthUser?> getCurrentUser();

  /// Check if user is currently authenticated
  Future<bool> get isAuthenticated;

  /// Get user profile information
  Future<Map<String, dynamic>?> getUserProfile();

  /// Update user profile if supported
  Future<bool> updateUserProfile(Map<String, dynamic> profile);

  /// Link additional authentication methods
  Future<AuthResult> linkAdditionalProvider(
    AuthProvider provider,
    AuthConfig config,
  );

  /// Unlink authentication method
  Future<bool> unlinkProvider(AuthProvider provider);

  /// Get linked providers for current user
  Future<List<AuthProvider>> getLinkedProviders();

  /// Dispose provider resources
  void dispose();
}

/// Phone authentication interface for phone-based authentication
abstract class IPhoneAuthProvider extends IAuthProvider {
  /// Send verification code to phone number
  Future<PhoneAuthResult> sendVerificationCode(
    String phoneNumber, {
    String? countryCode,
    Map<String, dynamic>? additionalParameters,
  });

  /// Verify the received SMS code
  Future<PhoneAuthResult> verifyCode(
    String verificationId,
    String smsCode, {
    Map<String, dynamic>? additionalParameters,
  });

  /// Resend verification code
  Future<PhoneAuthResult> resendCode(
    String phoneNumber, {
    String? countryCode,
    Map<String, dynamic>? additionalParameters,
  });

  /// Check phone number format and validity
  Future<bool> validatePhoneNumber(String phoneNumber, {String? countryCode});

  /// Get current phone authentication state
  Stream<PhoneAuthState> get authStateStream;
}

/// Phone authentication result
class PhoneAuthResult {
  final bool success;
  final String? verificationId;
  final String? errorMessage;
  final PhoneAuthError? errorCode;
  final int? timeoutSeconds;

  const PhoneAuthResult._({
    required this.success,
    this.verificationId,
    this.errorMessage,
    this.errorCode,
    this.timeoutSeconds,
  });

  factory PhoneAuthResult.success({
    String? verificationId,
    int? timeoutSeconds,
  }) {
    return PhoneAuthResult._(
      success: true,
      verificationId: verificationId,
      timeoutSeconds: timeoutSeconds,
    );
  }

  factory PhoneAuthResult.failure({
    required String errorMessage,
    PhoneAuthError? errorCode,
    int? timeoutSeconds,
  }) {
    return PhoneAuthResult._(
      success: false,
      errorMessage: errorMessage,
      errorCode: errorCode,
      timeoutSeconds: timeoutSeconds,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'verificationId': verificationId,
      'errorMessage': errorMessage,
      'errorCode': errorCode?.name,
      'timeoutSeconds': timeoutSeconds,
    };
  }

  factory PhoneAuthResult.fromJson(Map<String, dynamic> json) {
    if (json['success'] as bool == true) {
      return PhoneAuthResult.success(
        verificationId: json['verificationId'] as String?,
        timeoutSeconds: json['timeoutSeconds'] as int?,
      );
    } else {
      return PhoneAuthResult.failure(
        errorMessage: json['errorMessage'] as String,
        errorCode: json['errorCode'] != null
            ? PhoneAuthError.values.firstWhere(
                (error) => error.name == json['errorCode'],
                orElse: () => PhoneAuthError.unknownError,
              )
            : null,
        timeoutSeconds: json['timeoutSeconds'] as int?,
      );
    }
  }
}

/// Phone authentication specific errors
enum PhoneAuthError {
  invalidPhoneNumber,
  invalidCountryCode,
  invalidVerificationCode,
  codeExpired,
  tooManyAttempts,
  networkError,
  serviceUnavailable,
  quotaExceeded,
  carrierNotSupported,
  unknownError,
}

/// Authentication state listener interface
abstract class IAuthStateListener {
  /// Called when authentication state changes
  void onAuthStateChanged(AuthResult? result);

  /// Called when user profile is updated
  void onUserProfileUpdated(AuthUser user);

  /// Called when authentication token is refreshed
  void onTokenRefreshed(AuthToken newToken);

  /// Called when authentication session expires
  void onSessionExpired();

  /// Called when authentication error occurs
  void onAuthError(AuthError error, String message);
}

/// Authentication storage interface for persisting auth data
abstract class IAuthStorage {
  /// Store authentication token
  Future<void> storeToken(AuthToken token);

  /// Retrieve stored authentication token
  Future<AuthToken?> getToken();

  /// Store user information
  Future<void> storeUser(AuthUser user);

  /// Retrieve stored user information
  Future<AuthUser?> getUser();

  /// Store session information
  Future<void> storeSession(AuthSession session);

  /// Retrieve stored session information
  Future<AuthSession?> getSession();

  /// Store authentication configuration
  Future<void> storeConfig(AppAuthConfig config);

  /// Retrieve stored authentication configuration
  Future<AppAuthConfig?> getConfig();

  /// Clear all authentication data
  Future<void> clearAuthData();

  /// Clear specific provider data
  Future<void> clearProviderData(AuthProvider provider);

  /// Check if stored data is valid and not expired
  Future<bool> isDataValid();
}

/// Authentication provider factory interface
abstract class IAuthProviderFactory {
  /// Create an authentication provider instance
  IAuthProvider createProvider(AuthProvider provider);

  /// Register a custom authentication provider
  void registerProvider<T extends IAuthProvider>(
    AuthProvider type,
    T Function() factory,
  );

  /// Get all available providers
  List<AuthProvider> getAvailableProviders();

  /// Check if a provider is supported
  bool isProviderSupported(AuthProvider provider);
}

/// Authentication manager interface for coordinating multiple providers
abstract class IAuthenticationManager {
  /// Initialize authentication system with configuration
  Future<void> initialize(AppAuthConfig config);

  /// Authenticate using specified provider
  Future<AuthResult> authenticate(
    AuthProvider provider, {
    Map<String, dynamic>? additionalParameters,
  });

  /// Sign out from current authentication
  Future<void> signOut();

  /// Sign out from specific provider
  Future<void> signOutFrom(AuthProvider provider);

  /// Get current authenticated user
  AuthUser? get currentUser;

  /// Get current authentication token
  AuthToken? get currentToken;

  /// Check if user is authenticated
  bool get isAuthenticated;

  /// Get authentication state stream
  Stream<AuthResult?> get authStateStream;

  /// Add authentication state listener
  void addAuthStateListener(IAuthStateListener listener);

  /// Remove authentication state listener
  void removeAuthStateListener(IAuthStateListener listener);

  /// Refresh authentication token
  Future<bool> refreshToken();

  /// Get available authentication providers
  List<AuthProvider> get availableProviders;

  /// Check if provider is available
  bool isProviderAvailable(AuthProvider provider);

  /// Link additional provider to current user
  Future<AuthResult> linkProvider(
    AuthProvider provider,
    AuthConfig config,
  );

  /// Unlink provider from current user
  Future<bool> unlinkProvider(AuthProvider provider);

  /// Get linked providers for current user
  Future<List<AuthProvider>> getLinkedProviders();

  /// Switch to different authentication provider
  Future<AuthResult> switchProvider(AuthProvider newProvider);

  /// Get authentication session information
  AuthSession? get currentSession;

  /// Validate current session
  Future<bool> validateSession();

  /// Update user profile
  Future<bool> updateUserProfile(Map<String, dynamic> profile);

  /// Dispose authentication manager
  void dispose();
}

/// Authentication UI interface for provider-specific UI components
abstract class IAuthUIProvider {
  /// Build login button for specific provider
  Widget buildLoginButton({
    required AuthProvider provider,
    required VoidCallback onPressed,
    String? text,
    double? width,
    double? height,
    Map<String, dynamic>? style,
  });

  /// Build provider-specific login flow
  Widget buildLoginFlow({
    required AuthProvider provider,
    required Function(AuthResult) onComplete,
    required Function(String) onError,
    Map<String, dynamic>? parameters,
  });

  /// Build phone number input screen
  Widget buildPhoneInput({
    required Function(String) onSubmit,
    String? initialCountryCode,
    Map<String, dynamic>? style,
  });

  /// Build SMS code verification screen
  Widget buildSmsVerification({
    required String phoneNumber,
    required Function(String) onVerify,
    required VoidCallback onResend,
    int? remainingTime,
    Map<String, dynamic>? style,
  });

  /// Build loading indicator for authentication
  Widget buildLoadingIndicator({
    String? message,
    Map<String, dynamic>? style,
  });

  /// Build error display for authentication errors
  Widget buildErrorDisplay({
    required String error,
    required VoidCallback onRetry,
    Map<String, dynamic>? style,
  });
}

/// Biometric authentication interface
abstract class IBiometricAuth {
  /// Check if biometric authentication is available
  Future<bool> get isAvailable;

  /// Get available biometric types
  Future<List<BiometricType>> getAvailableTypes;

  /// Authenticate with biometrics
  Future<BiometricResult> authenticate({
    String? reason,
    List<BiometricType>? allowedTypes,
    bool useErrorDialogs = true,
  });

  /// Check if biometrics are enrolled
  Future<bool> get areBiometricsEnrolled;
}

/// Biometric authentication result
class BiometricResult {
  final bool success;
  final String? errorMessage;
  final BiometricError? errorCode;

  const BiometricResult._({
    required this.success,
    this.errorMessage,
    this.errorCode,
  });

  factory BiometricResult.success() {
    return const BiometricResult._(success: true);
  }

  factory BiometricResult.failure({
    required String errorMessage,
    BiometricError? errorCode,
  }) {
    return BiometricResult._(
      success: false,
      errorMessage: errorMessage,
      errorCode: errorCode,
    );
  }
}

/// Biometric authentication types
enum BiometricType {
  fingerprint,
  face,
  iris,
  voice,
}

/// Biometric authentication errors
enum BiometricError {
  notAvailable,
  notEnrolled,
  notConfigured,
  userCancel,
  userFallback,
  systemCancel,
  lockout,
  lockoutPermanent,
  unknownError,
}

/// Import necessary UI components
import 'package:flutter/widgets.dart';