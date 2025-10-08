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

    // Friends related
    LocalizationKeysAppWuy.wuyFriendsTitle: 'Friends & Groups',
    LocalizationKeysAppWuy.wuyFriendsSearch: 'Search Friends',
    LocalizationKeysAppWuy.wuyFriendsNoFriends: 'No Friends',
    LocalizationKeysAppWuy.wuyFriendsAddFriend: 'Add Friend',
    LocalizationKeysAppWuy.wuyFriendsOnline: 'Online',
    LocalizationKeysAppWuy.wuyFriendsOffline: 'Offline',

    // Chat related
    LocalizationKeysAppWuy.wuyChatTitle: 'Chat',
    LocalizationKeysAppWuy.wuyChatTypeMessage: 'Type a message...',
    LocalizationKeysAppWuy.wuyChatSend: 'Send',
    LocalizationKeysAppWuy.wuyChatSending: 'Sending',
    LocalizationKeysAppWuy.wuyChatSent: 'Sent',
    LocalizationKeysAppWuy.wuyChatRead: 'Read',

    // Search related
    LocalizationKeysAppWuy.wuySearchTitle: 'Search Friends',
    LocalizationKeysAppWuy.wuySearchName: 'Name',
    LocalizationKeysAppWuy.wuySearchSignature: 'Signature',
    LocalizationKeysAppWuy.wuySearchPhone: 'Phone Number',
    LocalizationKeysAppWuy.wuySearchGender: 'Gender',
    LocalizationKeysAppWuy.wuySearchMale: 'Male',
    LocalizationKeysAppWuy.wuySearchFemale: 'Female',
    LocalizationKeysAppWuy.wuySearchReset: 'Reset',
    LocalizationKeysAppWuy.wuySearchNoResults: 'No friends found',

    // Profile related
    LocalizationKeysAppWuy.wuyProfileTitle: 'Profile',
    LocalizationKeysAppWuy.wuyProfilePersonalInfo: 'Personal Information',
    LocalizationKeysAppWuy.wuyProfileAbout: 'About Us',
    LocalizationKeysAppWuy.wuyProfileEdit: 'Edit',
    LocalizationKeysAppWuy.wuyProfileSave: 'Save',
    LocalizationKeysAppWuy.wuyProfileSignOut: 'Sign Out',

    // About related
    LocalizationKeysAppWuy.wuyAboutTitle: 'About Us',
    LocalizationKeysAppWuy.wuyAboutFeatures: 'Features',
    LocalizationKeysAppWuy.wuyAboutVersion: 'Version Update',
    LocalizationKeysAppWuy.wuyAboutAppInfo: 'App Information',
    LocalizationKeysAppWuy.wuyAboutVersionInfo: 'View latest version information',
    LocalizationKeysAppWuy.wuyAboutFeatureInfo: 'Learn about main features',

    // History related
    LocalizationKeysAppWuy.wuyHistoryTitle: 'History Tracking',
    LocalizationKeysAppWuy.wuyHistoryActivity: 'Activity History',
    LocalizationKeysAppWuy.wuyHistoryLogin: 'Login',
    LocalizationKeysAppWuy.wuyHistorySuccess: 'Success',
    LocalizationKeysAppWuy.wuyHistoryAction: 'Action',
    LocalizationKeysAppWuy.wuyHistoryMessage: 'Message',
    LocalizationKeysAppWuy.wuyHistoryUpdate: 'Update',

    // Network related
    LocalizationKeysAppWuy.wuyNetworkTitle: 'Network Records',
    LocalizationKeysAppWuy.wuyNetworkActivity: 'Network Activity',
    LocalizationKeysAppWuy.wuyNetworkSuccess: 'Success',
    LocalizationKeysAppWuy.wuyNetworkError: 'Error',
    LocalizationKeysAppWuy.wuyNetworkPending: 'Pending',

    // Map related
    LocalizationKeysAppWuy.wuyMapTitle: 'Map',
    LocalizationKeysAppWuy.wuyMapLocation: 'Location',
    LocalizationKeysAppWuy.wuyMapSearch: 'Search',

    // Authentication related
    LocalizationKeysAppWuy.wuyAuthLogin: 'Login',
    LocalizationKeysAppWuy.wuyAuthRegister: 'Register',
    LocalizationKeysAppWuy.wuyAuthEmail: 'Email',
    LocalizationKeysAppWuy.wuyAuthPassword: 'Password',
    LocalizationKeysAppWuy.wuyAuthConfirmPassword: 'Confirm Password',
    LocalizationKeysAppWuy.wuyAuthPhone: 'Phone Number',
    LocalizationKeysAppWuy.wuyAuthForgotPassword: 'Forgot Password?',
    LocalizationKeysAppWuy.wuyAuthSignIn: 'Sign In',
    LocalizationKeysAppWuy.wuyAuthSignUp: 'Sign Up',
    LocalizationKeysAppWuy.wuyAuthAlreadyHaveAccount: 'Already have an account?',
    LocalizationKeysAppWuy.wuyAuthDontHaveAccount: 'Don\'t have an account?',

    // Common actions
    LocalizationKeysAppWuy.wuyCommonOk: 'OK',
    LocalizationKeysAppWuy.wuyCommonCancel: 'Cancel',
    LocalizationKeysAppWuy.wuyCommonYes: 'Yes',
    LocalizationKeysAppWuy.wuyCommonNo: 'No',
    LocalizationKeysAppWuy.wuyCommonClose: 'Close',
    LocalizationKeysAppWuy.wuyCommonDone: 'Done',
    LocalizationKeysAppWuy.wuyCommonNext: 'Next',
    LocalizationKeysAppWuy.wuyCommonPrevious: 'Previous',
    LocalizationKeysAppWuy.wuyCommonRefresh: 'Refresh',
    LocalizationKeysAppWuy.wuyCommonRetry: 'Retry',
  };
}

/// Alias for compatibility with locales provider
class EnAppWuy {
  static Map<String, dynamic> get locales => WuyEnTranslations.translations;
}
