/// About model - Use localization key instead of hardcoded text
/// All about content should be loaded from localization system
/// Use QyAppLocalizationKeys.qyAppAboutDescription for about text
class AboutModel {
  /// Get about description from localization
  /// This method should be called with BuildContext to get localized text
  static String getAboutDescriptionKey() {
    return 'qy_app_about_description';
  }
}
