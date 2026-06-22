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
