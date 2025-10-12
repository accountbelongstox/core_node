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
/// Only includes assets that actually exist in the file system
class WuyAppAssetsIcons {
  // Base path for Wuy app icons
  static const String _basePath = 'assets/apps/app_wuy/icons';

  // App logos
  static const String logo = '$_basePath/logo.png';
  static const String logoBak = '$_basePath/logo.png';

  // Placeholder images
  static const String avatarPlaceholder = '$_basePath/avatar_placeholder.png';
  static const String bannerPlaceholder = '$_basePath/banner_placeholder.png';
  static const String imagePlaceholder = '$_basePath/image_placeholder.png';

  // State images
  static const String emptyState = '$_basePath/empty_state.png';
  static const String errorState = '$_basePath/error_state.png';
  static const String noInternet = '$_basePath/no_internet.png';
  static const String maintenance = '$_basePath/maintenance.png';

  // Onboarding images
  static const String onboarding = '$_basePath/onboarding.png';
  static const String onboardingD = '$_basePath/onboarding_d.png';
  static const String on1 = '$_basePath/on1.png';
  static const String staffOnboarding = '$_basePath/staff_onboarding.png';

  // UI elements
  static const String enable = '$_basePath/enable.png';

  /// Get all icons as a map for easy access
  static Map<String, String> getAllIcons() {
    return {
      'logo': logo,
      'logoBak': logoBak,
      'avatarPlaceholder': avatarPlaceholder,
      'bannerPlaceholder': bannerPlaceholder,
      'imagePlaceholder': imagePlaceholder,
      'emptyState': emptyState,
      'errorState': errorState,
      'noInternet': noInternet,
      'maintenance': maintenance,
      'onboarding': onboarding,
      'onboardingD': onboardingD,
      'on1': on1,
      'staffOnboarding': staffOnboarding,
      'enable': enable,
    };
  }
}