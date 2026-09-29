/// Main app launch assets
/// Uses standardized paths: assets/apps/app_main/launch/
class AssetsLaunchAppMain {
  static const String _base = 'assets/apps/app_main/launch';
  static const String _commonBase = 'assets/common/launch';

  static const String launchIconMain = '$_base/main_launch_icon.png';
  static const String splashMain = '$_base/main_splash.png';

  static const String defaultLaunchIcon = '$_commonBase/default_launch_icon.png';
  static const String defaultSplash = '$_commonBase/default_splash.png';

  /// Get all launch assets as a map for easy access
  static Map<String, String> getAllLaunchAssets() {
    return {
      // Main app specific
      'launchIconMain': launchIconMain,
      'launch_icon': launchIconMain,
      'main_launch_icon': launchIconMain,
      'splashMain': splashMain,
      'splash': splashMain,
      'main_splash': splashMain,

      // Common launch assets
      'defaultLaunchIcon': defaultLaunchIcon,
      'default_launch_icon': defaultLaunchIcon,
      'defaultSplash': defaultSplash,
      'default_splash': defaultSplash,
    };
  }
}
