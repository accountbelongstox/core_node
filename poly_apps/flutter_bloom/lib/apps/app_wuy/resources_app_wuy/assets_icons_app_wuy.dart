// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Wuy App Icons Assets
/// This file defines all icon assets for the Wuy app
class WuyAppAssetsIcons {
  // Base path for Wuy app icons
  static const String _basePath = 'assets/apps/app_wuy/icons';

  // App icons
  static const String wuy_logo = '$_basePath/logo.png';
  static const String wuy_app_icon = '$_basePath/app_icon.png';
  static const String wuy_logo_blue = '$_basePath/logo_blue.png';
  static const String wuy_logo_white = '$_basePath/logo_white.png';
  
  // Navigation icons
  static const String wuy_home = '$_basePath/home.png';
  static const String wuy_profile = '$_basePath/profile.png';
  static const String wuy_settings = '$_basePath/settings.png';
  static const String wuy_dashboard = '$_basePath/dashboard.png';
  
  // Action icons
  static const String wuy_search = '$_basePath/search.png';
  static const String wuy_notification = '$_basePath/notification.png';
  static const String wuy_menu = '$_basePath/menu.png';
  static const String wuy_back = '$_basePath/back.png';
  
  // User icons
  static const String wuy_user = '$_basePath/user.png';
  static const String wuy_guest = '$_basePath/guest.png';
  
  // Status icons
  static const String wuy_success = '$_basePath/success.png';
  static const String wuy_error = '$_basePath/error.png';
  static const String wuy_warning = '$_basePath/warning.png';
  static const String wuy_info = '$_basePath/info.png';
}