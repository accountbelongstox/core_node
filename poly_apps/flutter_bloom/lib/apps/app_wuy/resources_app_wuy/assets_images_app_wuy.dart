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
/// Only includes assets that actually exist in the file system
class WuyAppAssetsImages {
  // Base path for Wuy app images
  static const String _basePath = 'assets/apps/app_wuy/images';

  // Background images - only include existing files
  static const String background = '$_basePath/bg.png';

  /// Get all images as a map for easy access
  static Map<String, String> getAllImages() {
    return {
      'background': background,
    };
  }
}