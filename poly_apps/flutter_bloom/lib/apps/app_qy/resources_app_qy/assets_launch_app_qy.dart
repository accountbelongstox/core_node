/// QY app launch assets - 符合文档规范
/// Uses standardized paths: assets/apps/app_qy/launch/
/// All asset keys have 'example' prefix as required by documentation
class AssetsLaunchAppQy {
  static const String _base = 'assets/apps/app_qy/launch';

  static const String qyIcon = '$_base/icon.png';
  static const String qySplash = '$_base/splash.png';
  static const String qyBackground = '$_base/background.jpg';
  static const String qyDarkLaunch = '$_base/dark_launch.png';
  static const String qyLightLaunch = '$_base/light_launch.png';
  static const String qyLogo = '$_base/logo.png';
  static const String qyBrandingImage = '$_base/branding.png';

  static const String qyAdaptiveIcon = '$_base/adaptive_icon.png';
  static const String qyAdaptiveForeground = '$_base/adaptive_foreground.png';
  static const String qyAdaptiveBackground = '$_base/adaptive_background.png';

  static const String qyAndroidIcon = '$_base/android_icon.png';
  static const String qyIosIcon = '$_base/ios_icon.png';
  static const String qyWebIcon = '$_base/web_icon.png';

  /// Get all launch assets as a map for easy access
  /// All keys use 'example' prefix as required by documentation
  static Map<String, String> getAllLaunchAssets() {
    return {
      'qyIcon': qyIcon,
      'qySplash': qySplash,
      'qyBackground': qyBackground,
      'qyDarkLaunch': qyDarkLaunch,
      'qyLightLaunch': qyLightLaunch,
      'qyLogo': qyLogo,
      'qyBrandingImage': qyBrandingImage,
      'qyAdaptiveIcon': qyAdaptiveIcon,
      'qyAdaptiveForeground': qyAdaptiveForeground,
      'qyAdaptiveBackground': qyAdaptiveBackground,
      'qyAndroidIcon': qyAndroidIcon,
      'qyIosIcon': qyIosIcon,
      'qyWebIcon': qyWebIcon,
    };
  }

  /// Get launch asset by key (with qy prefix)
  static String? getLaunchAsset(String key) {
    return getAllLaunchAssets()[key];
  }

  /// Check if launch asset exists
  static bool hasLaunchAsset(String key) {
    return getAllLaunchAssets().containsKey(key);
  }

  /// Get all launch asset keys
  static List<String> getAllLaunchAssetKeys() {
    return getAllLaunchAssets().keys.toList();
  }
}


