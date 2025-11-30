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
/// Uses standardized paths: assets/apps/app_travel/fonts/ and assets/apps/app_travel/images/
/// All asset keys have 'travel' prefix as required by documentation
class AssetsIconsAppTravel {
  static const String _baseFonts = 'assets/apps/app_travel/fonts';
  static const String _baseImages = 'assets/apps/app_travel/images';

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

  // PNG Icon Files - Recommend Section Icons
  static const String travelRecommendIcon1 = '$_baseImages/icon_1.png';
  static const String travelRecommendIcon2 = '$_baseImages/icon_2.png';
  static const String travelRecommendIcon3 = '$_baseImages/icon_3.png';
  static const String travelRecommendIcon4 = '$_baseImages/icon_4.png';
  static const String travelRecommendIcon5 = '$_baseImages/icon_5.png';

  // PNG Background Images - Recommend Card Backgrounds
  static const String travelRecommendBg1 = '$_baseImages/icon_bg_1.png';
  static const String travelRecommendBg2 = '$_baseImages/icon_bg_2.png';
  static const String travelRecommendBg3 = '$_baseImages/icon_bg_3.png';
  static const String travelRecommendBg4 = '$_baseImages/icon_bg_4.png';
  static const String travelRecommendBg5 = '$_baseImages/icon_bg_5.png';

  // Legacy Recommend Icons (for backward compatibility)
  static const String travelRecommendIconLegacy1 = '$_baseImages/recommend_icon_1.png';
  static const String travelRecommendIconLegacy2 = '$_baseImages/recommend_icon_2.png';
  static const String travelRecommendIconLegacy3 = '$_baseImages/recommend_icon_3.png';
  static const String travelRecommendIconLegacy4 = '$_baseImages/recommend_icon_4.png';
  static const String travelRecommendIconLegacy5 = '$_baseImages/recommend_icon_5.png';

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

  /// Get all recommend icon files
  static Map<String, String> getRecommendIcons() {
    return {
      'travelRecommendIcon1': travelRecommendIcon1,
      'travelRecommendIcon2': travelRecommendIcon2,
      'travelRecommendIcon3': travelRecommendIcon3,
      'travelRecommendIcon4': travelRecommendIcon4,
      'travelRecommendIcon5': travelRecommendIcon5,
    };
  }

  /// Get all recommend background files
  static Map<String, String> getRecommendBackgrounds() {
    return {
      'travelRecommendBg1': travelRecommendBg1,
      'travelRecommendBg2': travelRecommendBg2,
      'travelRecommendBg3': travelRecommendBg3,
      'travelRecommendBg4': travelRecommendBg4,
      'travelRecommendBg5': travelRecommendBg5,
    };
  }

  /// Get icon font path for pubspec.yaml configuration
  static String getIconFontPath() {
    return travelIconFontTtf;
  }
}
