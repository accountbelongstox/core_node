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
