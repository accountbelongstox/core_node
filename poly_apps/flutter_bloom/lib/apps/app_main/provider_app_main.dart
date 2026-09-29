import 'package:qyflutter/apps/app_main/config_app_main/prefs_app_main.dart';

/// Main App Provider
/// 
/// This file exports the instantiated PrefsAppMain object that can be used
/// throughout the Main app without re-instantiation.
/// 
/// DESIGN:
/// - Provides a single, shared instance of PrefsAppMain
/// - Ensures consistency across the entire Main app
/// - Follows the app naming convention: provider_app_{appname}
/// - Located in app root directory following development guide
/// 
/// USAGE:
/// - Import this file to access the shared PrefsAppMain instance
/// - Use in main_app_main.dart for initialization
/// - Use in other classes like settings_controller_persistent.dart
/// - Register with Provider system for dependency injection

/// Exported PrefsAppMain instance
/// This is the single, shared instance that should be used throughout the Main app
final PrefsAppMain prefsAppMain = PrefsAppMain();

/// Provider key for PrefsAppMain
/// Used when registering with the Provider system
const String prefsAppMainProviderKey = 'prefsAppMain';
