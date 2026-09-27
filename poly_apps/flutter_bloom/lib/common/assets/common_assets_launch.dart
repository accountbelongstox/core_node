/// Common launch assets (shared across all apps)
class CommonAssetsLaunch {
  static const String _base = 'assets/common/launch';

  static const String icon = '$_base/icon.png';
  static const String launchIcon = '$_base/launch_icon.png';
  static const String appIcon = '$_base/app_icon.png';

  static const String splash = '$_base/splash.png';
  static const String splashLight = '$_base/splash_light.png';
  static const String splashDark = '$_base/splash_dark.png';

  static const String launchBackground = '$_base/light_launch.jpg';
  static const String launchBackgroundLight = '$_base/light_launch.jpg';
  static const String launchBackgroundDark = '$_base/dark_launch.jpg';

  static const String brandLogo = '$_base/brand_logo.png';
  static const String brandLogoLight = '$_base/brand_logo_light.png';
  static const String brandLogoDark = '$_base/brand_logo_dark.png';

  /// Get all launch assets as a map for easy access
  static Map<String, String> getAllLaunchAssets() {
    return {
      // Launch Icons
      'icon': icon,
      'launchIcon': launchIcon,
      'appIcon': appIcon,

      // Splash Screens
      'splash': splash,
      'splashLight': splashLight,
      'splashDark': splashDark,

      // Background Images
      'launchBackground': launchBackground,
      'launchBackgroundLight': launchBackgroundLight,
      'launchBackgroundDark': launchBackgroundDark,

      // Branding
      'brandLogo': brandLogo,
      'brandLogoLight': brandLogoLight,
      'brandLogoDark': brandLogoDark,
    };
  }
}


