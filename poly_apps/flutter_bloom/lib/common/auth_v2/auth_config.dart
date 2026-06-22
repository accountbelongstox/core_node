
/// Authentication configuration models for multi-provider login system
/// Supports WeChat, QQ, Google, GitHub, and phone number authentication
library;

import 'dart:convert';

/// Authentication provider types supported by the system
enum AuthProvider {
  wechat,
  qq,
  google,
  github,
  phone,
  email,
}

/// Base configuration class for all authentication providers
abstract class AuthConfig {
  final AuthProvider provider;
  final bool enabled;
  final String? clientId;
  final String? clientSecret;
  final String? redirectUri;
  final Map<String, dynamic> customParameters;

  const AuthConfig({
    required this.provider,
    required this.enabled,
    this.clientId,
    this.clientSecret,
    this.redirectUri,
    this.customParameters = const {},
  });

  Map<String, dynamic> toJson();

  factory AuthConfig.fromJson(Map<String, dynamic> json) {
    final providerString = json['provider'] as String;
    final provider = AuthProvider.values.firstWhere(
      (p) => p.name == providerString,
      orElse: () => throw ArgumentError('Unknown provider: $providerString'),
    );

    switch (provider) {
      case AuthProvider.wechat:
        return WeChatAuthConfig.fromJson(json);
      case AuthProvider.qq:
        return QQAuthConfig.fromJson(json);
      case AuthProvider.google:
        return GoogleAuthConfig.fromJson(json);
      case AuthProvider.github:
        return GitHubAuthConfig.fromJson(json);
      case AuthProvider.phone:
        return PhoneAuthConfig.fromJson(json);
      case AuthProvider.email:
        return EmailAuthConfig.fromJson(json);
    }
  }
}

/// WeChat authentication configuration
class WeChatAuthConfig extends AuthConfig {
  final String appId;
  final String appSecret;
  final String universalLink;
  final bool enableUserInfo;

  const WeChatAuthConfig({
    required this.appId,
    required this.appSecret,
    required this.universalLink,
    this.enableUserInfo = true,
    super.enabled = true,
    super.clientSecret,
    super.redirectUri,
    super.customParameters = const {},
  }) : super(provider: AuthProvider.wechat, clientId: appId);

  @override
  Map<String, dynamic> toJson() {
    return {
      'provider': provider.name,
      'appId': appId,
      'appSecret': appSecret,
      'universalLink': universalLink,
      'enableUserInfo': enableUserInfo,
      'enabled': enabled,
      'clientId': clientId,
      'clientSecret': clientSecret,
      'redirectUri': redirectUri,
      'customParameters': customParameters,
    };
  }

  factory WeChatAuthConfig.fromJson(Map<String, dynamic> json) {
    return WeChatAuthConfig(
      appId: json['appId'] as String,
      appSecret: json['appSecret'] as String,
      universalLink: json['universalLink'] as String,
      enableUserInfo: json['enableUserInfo'] as bool? ?? true,
      enabled: json['enabled'] as bool? ?? true,
      clientSecret: json['clientSecret'] as String?,
      redirectUri: json['redirectUri'] as String?,
      customParameters: Map<String, dynamic>.from(
        json['customParameters'] as Map? ?? {},
      ),
    );
  }
}

/// QQ authentication configuration
class QQAuthConfig extends AuthConfig {
  final String appId;
  final String appKey;
  final String universalLink;

  const QQAuthConfig({
    required this.appId,
    required this.appKey,
    required this.universalLink,
    super.enabled = true,
    super.clientSecret,
    super.redirectUri,
    super.customParameters = const {},
  }) : super(provider: AuthProvider.qq, clientId: appId);

  @override
  Map<String, dynamic> toJson() {
    return {
      'provider': provider.name,
      'appId': appId,
      'appKey': appKey,
      'universalLink': universalLink,
      'enabled': enabled,
      'clientId': clientId,
      'clientSecret': clientSecret,
      'redirectUri': redirectUri,
      'customParameters': customParameters,
    };
  }

  factory QQAuthConfig.fromJson(Map<String, dynamic> json) {
    return QQAuthConfig(
      appId: json['appId'] as String,
      appKey: json['appKey'] as String,
      universalLink: json['universalLink'] as String,
      enabled: json['enabled'] as bool? ?? true,
      clientSecret: json['clientSecret'] as String?,
      redirectUri: json['redirectUri'] as String?,
      customParameters: Map<String, dynamic>.from(
        json['customParameters'] as Map? ?? {},
      ),
    );
  }
}

/// Google authentication configuration
class GoogleAuthConfig extends AuthConfig {
  final String webClientId;
  final String? iosClientId;
  final String? androidClientId;
  final List<String> scopes;
  final bool hostedDomain;

  const GoogleAuthConfig({
    required this.webClientId,
    this.iosClientId,
    this.androidClientId,
    this.scopes = const [
      'email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    this.hostedDomain = false,
    super.enabled = true,
    super.clientSecret,
    super.redirectUri,
    super.customParameters = const {},
  }) : super(provider: AuthProvider.google, clientId: webClientId);

  @override
  Map<String, dynamic> toJson() {
    return {
      'provider': provider.name,
      'webClientId': webClientId,
      'iosClientId': iosClientId,
      'androidClientId': androidClientId,
      'scopes': scopes,
      'hostedDomain': hostedDomain,
      'enabled': enabled,
      'clientId': clientId,
      'clientSecret': clientSecret,
      'redirectUri': redirectUri,
      'customParameters': customParameters,
    };
  }

  factory GoogleAuthConfig.fromJson(Map<String, dynamic> json) {
    return GoogleAuthConfig(
      webClientId: json['webClientId'] as String,
      iosClientId: json['iosClientId'] as String?,
      androidClientId: json['androidClientId'] as String?,
      scopes: List<String>.from(json['scopes'] as List? ?? [
        'email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ]),
      hostedDomain: json['hostedDomain'] as bool? ?? false,
      enabled: json['enabled'] as bool? ?? true,
      clientSecret: json['clientSecret'] as String?,
      redirectUri: json['redirectUri'] as String?,
      customParameters: Map<String, dynamic>.from(
        json['customParameters'] as Map? ?? {},
      ),
    );
  }
}

/// GitHub authentication configuration
class GitHubAuthConfig extends AuthConfig {
  final String scopes;
  final bool allowSignup;

  const GitHubAuthConfig({
    required super.clientId,
    super.clientSecret,
    this.scopes = 'user:email',
    this.allowSignup = true,
    super.enabled = true,
    super.redirectUri,
    super.customParameters = const {},
  }) : super(provider: AuthProvider.github);

  @override
  Map<String, dynamic> toJson() {
    return {
      'provider': provider.name,
      'scopes': scopes,
      'allowSignup': allowSignup,
      'enabled': enabled,
      'clientId': clientId,
      'clientSecret': clientSecret,
      'redirectUri': redirectUri,
      'customParameters': customParameters,
    };
  }

  factory GitHubAuthConfig.fromJson(Map<String, dynamic> json) {
    return GitHubAuthConfig(
      clientId: json['clientId'] as String,
      clientSecret: json['clientSecret'] as String?,
      scopes: json['scopes'] as String? ?? 'user:email',
      allowSignup: json['allowSignup'] as bool? ?? true,
      enabled: json['enabled'] as bool? ?? true,
      redirectUri: json['redirectUri'] as String?,
      customParameters: Map<String, dynamic>.from(
        json['customParameters'] as Map? ?? {},
      ),
    );
  }
}

/// Phone number authentication configuration
class PhoneAuthConfig extends AuthConfig {
  final String? countryCode;
  final bool autoVerification;
  final int timeoutSeconds;
  final int retryIntervalSeconds;
  final int maxRetries;

  const PhoneAuthConfig({
    this.countryCode,
    this.autoVerification = true,
    this.timeoutSeconds = 60,
    this.retryIntervalSeconds = 30,
    this.maxRetries = 3,
    super.enabled = true,
    super.customParameters = const {},
  }) : super(provider: AuthProvider.phone);

  @override
  Map<String, dynamic> toJson() {
    return {
      'provider': provider.name,
      'countryCode': countryCode,
      'autoVerification': autoVerification,
      'timeoutSeconds': timeoutSeconds,
      'retryIntervalSeconds': retryIntervalSeconds,
      'maxRetries': maxRetries,
      'enabled': enabled,
      'customParameters': customParameters,
    };
  }

  factory PhoneAuthConfig.fromJson(Map<String, dynamic> json) {
    return PhoneAuthConfig(
      countryCode: json['countryCode'] as String?,
      autoVerification: json['autoVerification'] as bool? ?? true,
      timeoutSeconds: json['timeoutSeconds'] as int? ?? 60,
      retryIntervalSeconds: json['retryIntervalSeconds'] as int? ?? 30,
      maxRetries: json['maxRetries'] as int? ?? 3,
      enabled: json['enabled'] as bool? ?? true,
      customParameters: Map<String, dynamic>.from(
        json['customParameters'] as Map? ?? {},
      ),
    );
  }
}

/// Email authentication configuration
class EmailAuthConfig extends AuthConfig {
  final bool requireVerification;
  final int passwordMinLength;
  final bool requireStrongPassword;
  final bool enableTwoFactor;

  const EmailAuthConfig({
    this.requireVerification = true,
    this.passwordMinLength = 8,
    this.requireStrongPassword = false,
    this.enableTwoFactor = false,
    super.enabled = true,
    super.customParameters = const {},
  }) : super(provider: AuthProvider.email);

  @override
  Map<String, dynamic> toJson() {
    return {
      'provider': provider.name,
      'requireVerification': requireVerification,
      'passwordMinLength': passwordMinLength,
      'requireStrongPassword': requireStrongPassword,
      'enableTwoFactor': enableTwoFactor,
      'enabled': enabled,
      'customParameters': customParameters,
    };
  }

  factory EmailAuthConfig.fromJson(Map<String, dynamic> json) {
    return EmailAuthConfig(
      requireVerification: json['requireVerification'] as bool? ?? true,
      passwordMinLength: json['passwordMinLength'] as int? ?? 8,
      requireStrongPassword: json['requireStrongPassword'] as bool? ?? false,
      enableTwoFactor: json['enableTwoFactor'] as bool? ?? false,
      enabled: json['enabled'] as bool? ?? true,
      customParameters: Map<String, dynamic>.from(
        json['customParameters'] as Map? ?? {},
      ),
    );
  }
}

/// Complete authentication configuration for an app
class AppAuthConfig {
  final Map<AuthProvider, AuthConfig> providers;
  final String? apiBaseUrl;
  final String? authEndpoint;
  final String? tokenEndpoint;
  final String? userInfoEndpoint;
  final bool enableAutoLogin;
  final bool enableBiometric;
  final int sessionTimeoutMinutes;
  final bool enableTokenRefresh;

  const AppAuthConfig({
    required this.providers,
    this.apiBaseUrl,
    this.authEndpoint,
    this.tokenEndpoint,
    this.userInfoEndpoint,
    this.enableAutoLogin = true,
    this.enableBiometric = false,
    this.sessionTimeoutMinutes = 1440, // 24 hours
    this.enableTokenRefresh = true,
  });

  /// Get enabled providers
  List<AuthProvider> get enabledProviders {
    return providers.entries
        .where((entry) => entry.value.enabled)
        .map((entry) => entry.key)
        .toList();
  }

  /// Get configuration for a specific provider
  T? getProviderConfig<T extends AuthConfig>(AuthProvider provider) {
    final config = providers[provider];
    return config is T ? config : null;
  }

  /// Check if a provider is enabled
  bool isProviderEnabled(AuthProvider provider) {
    final config = providers[provider];
    return config?.enabled ?? false;
  }

  Map<String, dynamic> toJson() {
    return {
      'providers': providers.map(
        (key, value) => MapEntry(key.name, value.toJson()),
      ),
      'apiBaseUrl': apiBaseUrl,
      'authEndpoint': authEndpoint,
      'tokenEndpoint': tokenEndpoint,
      'userInfoEndpoint': userInfoEndpoint,
      'enableAutoLogin': enableAutoLogin,
      'enableBiometric': enableBiometric,
      'sessionTimeoutMinutes': sessionTimeoutMinutes,
      'enableTokenRefresh': enableTokenRefresh,
    };
  }

  factory AppAuthConfig.fromJson(Map<String, dynamic> json) {
    final providersMap = <AuthProvider, AuthConfig>{};
    final providersJson = json['providers'] as Map<String, dynamic>? ?? {};

    for (final entry in providersJson.entries) {
      final provider = AuthProvider.values.firstWhere(
        (p) => p.name == entry.key,
        orElse: () => throw ArgumentError('Unknown provider: ${entry.key}'),
      );

      providersMap[provider] = AuthConfig.fromJson(entry.value);
    }

    return AppAuthConfig(
      providers: providersMap,
      apiBaseUrl: json['apiBaseUrl'] as String?,
      authEndpoint: json['authEndpoint'] as String?,
      tokenEndpoint: json['tokenEndpoint'] as String?,
      userInfoEndpoint: json['userInfoEndpoint'] as String?,
      enableAutoLogin: json['enableAutoLogin'] as bool? ?? true,
      enableBiometric: json['enableBiometric'] as bool? ?? false,
      sessionTimeoutMinutes: json['sessionTimeoutMinutes'] as int? ?? 1440,
      enableTokenRefresh: json['enableTokenRefresh'] as bool? ?? true,
    );
  }

  String toJsonString() => jsonEncode(toJson());

  factory AppAuthConfig.fromJsonString(String jsonString) {
    return AppAuthConfig.fromJson(jsonDecode(jsonString) as Map<String, dynamic>);
  }
}