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

/// Main app font assets
/// Uses standardized paths: assets/common/fonts/ (main app uses common fonts)
class AssetsFontsAppMain {
  static const String _commonBase = 'assets/common/fonts';

  static const String defaultFont = '$_commonBase/default_font.ttf';
  static const String boldFont = '$_commonBase/bold_font.ttf';

  /// Get all fonts as a map for easy access
  static Map<String, String> getAllFonts() {
    return {
      'defaultFont': defaultFont,
      'default': defaultFont,
      'regular': defaultFont,
      'boldFont': boldFont,
      'bold': boldFont,
    };
  }
}
