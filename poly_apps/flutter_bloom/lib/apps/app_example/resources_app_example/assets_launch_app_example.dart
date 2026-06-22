// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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


