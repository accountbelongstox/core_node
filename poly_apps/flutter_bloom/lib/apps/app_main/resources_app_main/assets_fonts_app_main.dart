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
