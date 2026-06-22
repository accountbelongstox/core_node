/// Flutter Bloom Authentication Library v2
///
/// A comprehensive authentication library supporting multiple providers:
/// - WeChat, QQ, Google, GitHub OAuth
/// - Phone number SMS verification
/// - Email authentication
///
/// Features:
/// - Unified authentication interface
/// - Session management
/// - Token refresh
/// - Provider linking
/// - Biometric authentication support
///
/// Usage:
/// ```dart
/// import 'package:flutter_bloom/common/auth_v2/auth_v2.dart';
///
/// // Initialize with configuration
/// final authManager = AuthenticationManager();
/// await authManager.initialize(appAuthConfig);
///
/// // Authenticate with specific provider
/// final result = await authManager.authenticate(AuthProvider.google);
///
/// // Check authentication state
/// if (authManager.isAuthenticated) {
///   final user = authManager.currentUser;
/// }
/// ```
library;

export 'auth_config.dart';
export 'auth_interface.dart';
export 'auth_models.dart';
export 'auth_manager.dart';
export 'auth_provider_factory.dart';
export 'providers/wechat_auth_provider.dart';
export 'providers/qq_auth_provider.dart';
export 'providers/google_auth_provider.dart';
export 'providers/github_auth_provider.dart';
export 'providers/phone_auth_provider.dart';