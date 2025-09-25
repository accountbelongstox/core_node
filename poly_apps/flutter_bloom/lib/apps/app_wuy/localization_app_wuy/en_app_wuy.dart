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

import 'localization_keys_app_wuy.dart';

/// English translations for Wuy App
/// All keys must match LocalizationKeysAppWuy constants
class WuyEnTranslations {
  static const Map<String, String> translations = {
    LocalizationKeysAppWuy.wuyHomeTitle: 'Wuy Test App',
    LocalizationKeysAppWuy.wuyHomeWelcome: 'Welcome to Wuy App',
    LocalizationKeysAppWuy.wuyHomeDescription: 'This is a test page for the Wuy application.',
    LocalizationKeysAppWuy.wuyHomeTestButton: 'Test Button',

    LocalizationKeysAppWuy.wuyMenuHome: 'Home',
    LocalizationKeysAppWuy.wuyMenuProfile: 'Profile',
    LocalizationKeysAppWuy.wuyMenuSettings: 'Settings',
    LocalizationKeysAppWuy.wuyMenuNotifications: 'Notifications',
    LocalizationKeysAppWuy.wuyMenuMessages: 'Messages',
    LocalizationKeysAppWuy.wuyMenuSearch: 'Search',

    LocalizationKeysAppWuy.wuyActionSave: 'Save',
    LocalizationKeysAppWuy.wuyActionCancel: 'Cancel',
    LocalizationKeysAppWuy.wuyActionDelete: 'Delete',
    LocalizationKeysAppWuy.wuyActionEdit: 'Edit',
    LocalizationKeysAppWuy.wuyActionConfirm: 'Confirm',
    LocalizationKeysAppWuy.wuyActionBack: 'Back',

    LocalizationKeysAppWuy.wuyStatusLoading: 'Loading...',
    LocalizationKeysAppWuy.wuyStatusSuccess: 'Success!',
    LocalizationKeysAppWuy.wuyStatusError: 'An error occurred',
    LocalizationKeysAppWuy.wuyStatusNoData: 'No data available',

    LocalizationKeysAppWuy.wuyValidationRequired: 'This field is required',
    LocalizationKeysAppWuy.wuyValidationInvalidEmail: 'Please enter a valid email address',
    LocalizationKeysAppWuy.wuyValidationPasswordTooShort: 'Password must be at least 8 characters',
    LocalizationKeysAppWuy.wuyValidationPasswordsNoMatch: 'Passwords do not match',
  };
}

/// Alias for compatibility with locales provider
class EnAppWuy {
  static Map<String, dynamic> get locales => WuyEnTranslations.translations;
}
