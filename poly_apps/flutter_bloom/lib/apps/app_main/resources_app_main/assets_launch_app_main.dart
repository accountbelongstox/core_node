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
