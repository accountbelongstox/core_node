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
