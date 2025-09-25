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

/// Wuy App Images Assets
/// This file defines all image assets for the Wuy app
class WuyAppAssetsImages {
  // Base path for Wuy app images
  static const String _basePath = 'assets/apps/app_wuy/images';

  // Background images
  static const String wuy_splash_background = '$_basePath/splash_background.png';
  static const String wuy_home_background = '$_basePath/home_background.png';
  static const String wuy_login_background = '$_basePath/login_background.png';
  
  // Placeholder images
  static const String wuy_avatar_placeholder = '$_basePath/avatar_placeholder.png';
  static const String wuy_image_placeholder = '$_basePath/image_placeholder.png';
  static const String wuy_banner_placeholder = '$_basePath/banner_placeholder.png';
  
  // State images
  static const String wuy_empty_state = '$_basePath/empty_state.png';
  static const String wuy_error_state = '$_basePath/error_state.png';
  static const String wuy_no_internet = '$_basePath/no_internet.png';
  static const String wuy_maintenance = '$_basePath/maintenance.png';
  
  // Onboarding images
  static const String wuy_onboarding_1 = '$_basePath/onboarding_1.png';
  static const String wuy_onboarding_2 = '$_basePath/onboarding_2.png';
  static const String wuy_onboarding_3 = '$_basePath/onboarding_3.png';
}