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