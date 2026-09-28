import 'package:qyflutter/apps/app_example/config_app_example/prefs_app_example.dart';

/// Example App Provider
/// 
/// This file exports the instantiated PrefsAppExample object that can be used
/// throughout the Example app without re-instantiation.
/// 
/// DESIGN:
/// - Provides a single, shared instance of PrefsAppExample
/// - Ensures consistency across the entire Example app
/// - Follows the app naming convention: provider_app_{appname}
/// - Located in app root directory following development guide
/// 
/// USAGE:
/// - Import this file to access the shared PrefsAppExample instance
/// - Use in main_app_example.dart for initialization
/// - Use in other classes like settings_controller_persistent.dart
/// - Register with Provider system for dependency injection

/// Exported PrefsAppExample instance
/// This is the single, shared instance that should be used throughout the Example app
final PrefsAppExample prefsAppExample = PrefsAppExample();

/// Provider key for PrefsAppExample
/// Used when registering with the Provider system
const String prefsAppExampleProviderKey = 'prefsAppExample';
