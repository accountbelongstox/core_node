import 'assets_icons_app_main.dart';
import 'assets_images_app_main.dart';
import 'assets_fonts_app_main.dart';
import 'assets_launch_app_main.dart';

/// Main App Assets Manager
/// Provides unified assets configuration for the main app
/// Following design specification: integrates all assets_*_app_{name}.dart files
class MainAppAssets {
  static const String appId = 'main';

  /// Get main app specific assets (for runCommonApp)
  static Map<String, dynamic> getMainAssets() {
    final assetsList = getMainAssetsList();
    final categories = getAssetsByCategory();

    return {
      'appId': appId,
      'assets': assetsList,
      'categories': categories,
      'totalAssets': assetsList.length,
    };
  }

  /// Get main app assets list
  static List<String> getMainAssetsList() {
    return [
      // Icons
      ...AssetsIconsAppMain.getAllIcons().values,

      // Images
      ...AssetsImagesAppMain.getAllImages().values,

      // Fonts
      ...AssetsFontsAppMain.getAllFonts().values,

      // Launch assets
      ...AssetsLaunchAppMain.getAllLaunchAssets().values,
    ];
  }

  /// Get asset by key
  static String? getAsset(String key) {
    // Try icons first
    final icons = AssetsIconsAppMain.getAllIcons();
    if (icons.containsKey(key)) return icons[key];

    // Try images
    final images = AssetsImagesAppMain.getAllImages();
    if (images.containsKey(key)) return images[key];

    // Try fonts
    final fonts = AssetsFontsAppMain.getAllFonts();
    if (fonts.containsKey(key)) return fonts[key];

    // Try launch assets
    final launchAssets = AssetsLaunchAppMain.getAllLaunchAssets();
    if (launchAssets.containsKey(key)) return launchAssets[key];

    return null;
  }

  /// Get assets by category
  static Map<String, List<String>> getAssetsByCategory() {
    return {
      'icons': AssetsIconsAppMain.getAllIcons().values.toList(),
      'images': AssetsImagesAppMain.getAllImages().values.toList(),
      'fonts': AssetsFontsAppMain.getAllFonts().values.toList(),
      'launch': AssetsLaunchAppMain.getAllLaunchAssets().values.toList(),
    };
  }

  /// Get asset statistics
  static Map<String, dynamic> getAssetStatistics() {
    final assets = getMainAssetsList();
    final categories = getAssetsByCategory();

    return {
      'appId': appId,
      'totalAssets': assets.length,
      'categories': categories.keys.toList(),
      'assetsByCategory': categories.map((key, value) => MapEntry(key, value.length)),
      'mainSpecificAssets': assets.where((asset) => asset.contains('app_main')).length,
      'commonAssets': assets.where((asset) => asset.contains('common')).length,
    };
  }

  /// Validate assets
  static Map<String, dynamic> validateAssets() {
    final assets = getMainAssetsList();
    final issues = <String>[];

    // Basic validation
    for (final asset in assets) {
      if (!asset.startsWith('assets/')) {
        issues.add('Asset path should start with "assets/": $asset');
      }
    }

    return {
      'isValid': issues.isEmpty,
      'totalAssets': assets.length,
      'issues': issues,
      'summary': issues.isEmpty
          ? 'All assets are valid'
          : 'Found ${issues.length} issues',
    };
  }

  // Legacy compatibility methods for existing code
  static String get iconMain => AssetsIconsAppMain.iconMain;
  static String get logoMain => AssetsImagesAppMain.logoMain;
  static String get backgroundMain => AssetsImagesAppMain.backgroundMain;
  static String get launchIconMain => AssetsLaunchAppMain.launchIconMain;
  static String get splashMain => AssetsLaunchAppMain.splashMain;
}
