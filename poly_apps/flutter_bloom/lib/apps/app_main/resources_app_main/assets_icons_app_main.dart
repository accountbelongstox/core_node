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
