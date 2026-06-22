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

/// Main app image assets
/// Uses standardized paths: assets/apps/app_main/images/
class AssetsImagesAppMain {
  static const String _base = 'assets/apps/app_main/images';
  static const String _commonBase = 'assets/common/images';

  static const String logoMain = '$_base/main_logo.png';
  static const String backgroundMain = '$_base/main_background.png';

  static const String defaultBackground = '$_commonBase/default_background.png';
  static const String placeholderImage = '$_commonBase/placeholder_image.png';

  /// Get all images as a map for easy access
  static Map<String, String> getAllImages() {
    return {
      // Main app specific
      'logoMain': logoMain,
      'logo': logoMain,
      'main_logo': logoMain,
      'backgroundMain': backgroundMain,
      'background': backgroundMain,
      'main_background': backgroundMain,

      // Common images
      'defaultBackground': defaultBackground,
      'default_background': defaultBackground,
      'placeholderImage': placeholderImage,
      'placeholder': placeholderImage,
    };
  }
}
