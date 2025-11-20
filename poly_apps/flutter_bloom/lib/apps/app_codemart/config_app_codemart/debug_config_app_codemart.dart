/// Debug configuration for app_codemart
///
/// Control debug mode globally for the application
/// When debug mode is enabled:
/// - Login bypass is activated (no actual API call)
/// - Mock data is used for user profiles
/// - Additional developer tools are available
class DebugConfigAppCodemart {
  /// Global debug mode flag
  /// Set this to false in production
  static const bool isDebugMode = true;

  /// Mock user credentials for debug mode
  static const String mockEmail = 'dev@codemart.com';
  static const String mockPassword = '123456';

  /// Mock developer email
  static const String mockDeveloperEmail = 'developer@codemart.com';

  /// Mock client email
  static const String mockClientEmail = 'client@codemart.com';

  /// Enable/disable debug logging
  static const bool enableDebugLogging = true;

  /// Enable/disable debug UI indicators
  static const bool showDebugBanner = true;

  /// Mock data delay (milliseconds) to simulate network latency
  static const int mockApiDelayMs = 500;
}
