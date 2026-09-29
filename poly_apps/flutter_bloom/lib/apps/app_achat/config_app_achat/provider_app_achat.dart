import 'package:qyflutter/apps/app_achat/config_app_achat/prefs_app_achat.dart';

/// AChat App Provider
/// 
/// This file exports the instantiated PrefsAppAChat object that can be used
/// throughout the AChat app without re-instantiation.
/// 
/// DESIGN:
/// - Provides a single, shared instance of PrefsAppAChat
/// - Ensures consistency across the entire AChat app
/// - Follows the app naming convention: provider_app_{appname}
/// 
/// USAGE:
/// - Import this file to access the shared PrefsAppAChat instance
/// - Use in main_app_achat.dart for initialization
/// - Use in other classes like settings_controller_persistent.dart
/// - Register with Provider system for dependency injection

/// Exported PrefsAppAChat instance
/// This is the single, shared instance that should be used throughout the AChat app
final PrefsAppAChat prefsAppAChat = PrefsAppAChat();

/// Provider key for PrefsAppAChat
/// Used when registering with the Provider system
const String prefsAppAChatProviderKey = 'prefsAppAChat';
