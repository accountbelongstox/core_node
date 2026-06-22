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

/// Main app icon assets
/// Uses standardized paths: assets/apps/app_main/icons/
class AssetsIconsAppMain {
  static const String _base = 'assets/apps/app_main/icons';
  static const String _commonBase = 'assets/common/icons';

  static const String iconMain = '$_base/main_icon.png';

  static const String defaultAppIcon = '$_commonBase/default_app_icon.png';
  static const String settingsIcon = '$_commonBase/settings_icon.png';
  static const String aboutIcon = '$_commonBase/about_icon.png';
  static const String debugIcon = '$_commonBase/debug_icon.png';

  /// Get all icons as a map for easy access
  static Map<String, String> getAllIcons() {
    return {
      // Main app specific
      'iconMain': iconMain,
      'main': iconMain,
      'icon': iconMain,

      // Common icons
      'defaultAppIcon': defaultAppIcon,
      'default': defaultAppIcon,
      'settingsIcon': settingsIcon,
      'settings': settingsIcon,
      'aboutIcon': aboutIcon,
      'about': aboutIcon,
      'debugIcon': debugIcon,
      'debug': debugIcon,
    };
  }
}
