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


