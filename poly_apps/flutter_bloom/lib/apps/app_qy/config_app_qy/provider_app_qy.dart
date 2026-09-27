import 'package:qyflutter/apps/app_qy/config_app_qy/prefs_app_qy.dart';

/// QY App Provider
/// 
/// This file exports the instantiated PrefsAppQy object that can be used
/// throughout the QY app without re-instantiation.
/// 
/// DESIGN:
/// - Provides a single, shared instance of PrefsAppQy
/// - Ensures consistency across the entire QY app
/// - Follows the app naming convention: provider_app_{appname}
/// - Located in app root directory following development guide
/// 
/// USAGE:
/// - Import this file to access the shared PrefsAppQy instance
/// - Use in main_app_qy.dart for initialization
/// - Use in other classes like settings_controller_persistent.dart
/// - Register with Provider system for dependency injection

/// Exported PrefsAppQy instance
/// This is the single, shared instance that should be used throughout the QY app
final PrefsAppQy prefsAppQy = PrefsAppQy();

/// Provider key for PrefsAppQy
/// Used when registering with the Provider system
const String prefsAppQyProviderKey = 'prefsAppQy';
