/// Wuy App Launch Assets
/// This file defines all launch/splash screen assets for the Wuy app
/// Only includes assets that actually exist in the file system
class WuyAppAssetsLaunch {
  // Base path for Wuy app launch assets
  static const String _basePath = 'assets/apps/app_wuy/launch';

  // Launch screens
  static const String splash = '$_basePath/splash.png';
  static const String splashWebp = '$_basePath/splash.webp';
  static const String logo = '$_basePath/logo.png';

  /// Get all launch assets as a map for easy access
  static Map<String, String> getAllLaunchAssets() {
    return {
      'splash': splash,
      'splashWebp': splashWebp,
      'logo': logo,
    };
  }
}