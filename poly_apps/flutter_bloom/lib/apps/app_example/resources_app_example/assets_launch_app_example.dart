/// Example app launch assets - 符合文档规范
/// Uses standardized paths: assets/apps/app_example/launch/
/// All asset keys have 'example' prefix as required by documentation
class AssetsLaunchAppExample {
  static const String _base = 'assets/apps/app_example/launch';

  static const String exampleIcon = '$_base/icon.png';
  static const String exampleSplash = '$_base/splash.png';
  static const String exampleBackground = '$_base/background.jpg';
  static const String exampleDarkLaunch = '$_base/dark_launch.png';
  static const String exampleLightLaunch = '$_base/light_launch.png';
  static const String exampleLogo = '$_base/logo.png';
  static const String exampleBrandingImage = '$_base/branding.png';

  static const String exampleAdaptiveIcon = '$_base/adaptive_icon.png';
  static const String exampleAdaptiveForeground = '$_base/adaptive_foreground.png';
  static const String exampleAdaptiveBackground = '$_base/adaptive_background.png';

  static const String exampleAndroidIcon = '$_base/android_icon.png';
  static const String exampleIosIcon = '$_base/ios_icon.png';
  static const String exampleWebIcon = '$_base/web_icon.png';

  /// Get all launch assets as a map for easy access
  /// All keys use 'example' prefix as required by documentation
  static Map<String, String> getAllLaunchAssets() {
    return {
      'exampleIcon': exampleIcon,
      'exampleSplash': exampleSplash,
      'exampleBackground': exampleBackground,
      'exampleDarkLaunch': exampleDarkLaunch,
      'exampleLightLaunch': exampleLightLaunch,
      'exampleLogo': exampleLogo,
      'exampleBrandingImage': exampleBrandingImage,
      'exampleAdaptiveIcon': exampleAdaptiveIcon,
      'exampleAdaptiveForeground': exampleAdaptiveForeground,
      'exampleAdaptiveBackground': exampleAdaptiveBackground,
      'exampleAndroidIcon': exampleAndroidIcon,
      'exampleIosIcon': exampleIosIcon,
      'exampleWebIcon': exampleWebIcon,
    };
  }

  /// Get launch asset by key (with example prefix)
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


