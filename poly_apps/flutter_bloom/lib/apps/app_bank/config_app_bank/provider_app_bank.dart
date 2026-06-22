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

import 'prefs_app_bank.dart';
// Fix: Use providers_app_bank/bank_user_provider.dart (correct implementation)
import '../providers_app_bank/bank_user_provider.dart';

/// Bank App Provider
/// 
/// This file exports the instantiated PrefsAppBank object that can be used
/// throughout the Bank app without re-instantiation.
/// 
/// DESIGN:
/// - Provides a single, shared instance of PrefsAppBank
/// - Ensures consistency across the entire Bank app
/// - Follows the app naming convention: provider_app_{appname}
/// 
/// USAGE:
/// - Import this file to access the shared PrefsAppBank instance
/// - Use in main_app_bank.dart for initialization
/// - Use in other classes like settings_controller_persistent.dart
/// - Register with Provider system for dependency injection

/// Exported PrefsAppBank instance
/// This is the single, shared instance that should be used throughout the Bank app
final PrefsAppBank prefsAppBank = PrefsAppBank();

/// Exported BankUserProvider instance
/// This is the single, shared instance for managing bank user data
final BankUserProvider bankUserProvider = BankUserProvider();

/// Provider key for PrefsAppBank
/// Used when registering with the Provider system
const String prefsAppBankProviderKey = 'prefsAppBank';

/// Provider key for BankUserProvider
/// Used when registering with the Provider system
const String bankUserProviderKey = 'bankUserProvider';
