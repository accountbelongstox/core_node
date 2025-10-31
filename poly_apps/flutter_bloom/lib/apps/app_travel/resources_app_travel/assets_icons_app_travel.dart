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

/// Travel app icon assets and icon font definitions
/// Uses standardized paths: assets/apps/app_travel/fonts/
/// All asset keys have 'travel' prefix as required by documentation
class AssetsIconsAppTravel {
  static const String _baseFonts = 'assets/apps/app_travel/fonts';

  // Icon Font Files
  static const String travelIconFontEot = '$_baseFonts/iconfont.eot';
  static const String travelIconFontSvg = '$_baseFonts/iconfont.svg';
  static const String travelIconFontTtf = '$_baseFonts/iconfont.ttf';
  static const String travelIconFontWoff = '$_baseFonts/iconfont.woff';
  static const String travelIconFontWoff2 = '$_baseFonts/iconfont.woff2';
  static const String travelIconFontCss = '$_baseFonts/iconfont.css';
  static const String travelIconFontJs = '$_baseFonts/iconfont.js';

  // Icon Font Family Name
  static const String iconFontFamily = 'TravelIconFont';

  /// Get all icon font files
  static Map<String, String> getIconFontFiles() {
    return {
      'travelIconFontEot': travelIconFontEot,
      'travelIconFontSvg': travelIconFontSvg,
      'travelIconFontTtf': travelIconFontTtf,
      'travelIconFontWoff': travelIconFontWoff,
      'travelIconFontWoff2': travelIconFontWoff2,
      'travelIconFontCss': travelIconFontCss,
      'travelIconFontJs': travelIconFontJs,
    };
  }

  /// Get icon font path for pubspec.yaml configuration
  static String getIconFontPath() {
    return travelIconFontTtf;
  }
}
