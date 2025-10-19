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

/// English localization for QY App
class EnAppQy {
  static const Map<String, String> values = {
    // App Identity
    'qy_app_name': 'QY App',
    'qy_app_description': 'A comprehensive qy application',
    'qy_app_slogan': 'Learn, Build, Grow',
    'qy_app_version': 'Version 1.0.0',

    // Common Actions
    'qy_home': 'Home',
    'qy_next': 'Next',
    'qy_previous': 'Previous',
    'qy_skip': 'Skip',
    'qy_cancel': 'Cancel',
    'qy_confirm': 'Confirm',
    'qy_save': 'Save',
    'qy_delete': 'Delete',
    'qy_edit': 'Edit',
    'qy_back': 'Back',
    'qy_close': 'Close',
    'qy_ok': 'OK',
    'qy_yes': 'Yes',
    'qy_no': 'No',
    'qy_continue': 'Continue',
    'qy_submit': 'Submit',
    'qy_retry': 'Retry',
    'qy_refresh': 'Refresh',
    'qy_search': 'Search',
    'qy_filter': 'Filter',
    'qy_sort': 'Sort',
    'qy_clear': 'Clear',
    'qy_reset': 'Reset',

    // Status Messages
    'qy_success': 'Success',
    'qy_error': 'Error',
    'qy_warning': 'Warning',
    'qy_info': 'Information',
    'qy_loading': 'Loading...',
    'qy_completed': 'Completed',
    'qy_pending': 'Pending',
    'qy_failed': 'Failed',

    // Authentication
    'qy_sign_in': 'Sign In',
    'qy_sign_up': 'Sign Up',
    'qy_sign_out': 'Sign Out',
    'qy_logout': 'Logout',
    'qy_login': 'Login',
    'qy_register': 'Register',
    'qy_forgot_password': 'Forgot Password',
    'qy_reset_password': 'Reset Password',
    'qy_change_password': 'Change Password',
    'qy_email': 'Email',
    'qy_password': 'Password',
    'qy_confirm_password': 'Confirm Password',
    'qy_username': 'Username',
    'qy_remember_me': 'Remember Me',
    'qy_create_account': 'Create Account',
    'qy_have_account': 'Already have an account?',
    'qy_no_account': 'Don\'t have an account?',

    // Settings
    'qy_settings': 'Settings',
    'qy_dark_mode': 'Dark Mode',
    'qy_light_mode': 'Light Mode',
    'qy_language': 'Language',
    'qy_notifications': 'Notifications',
    'qy_privacy': 'Privacy',
    'qy_security': 'Security',
    'qy_help': 'Help',
    'qy_about': 'About',
  };

  /// Get locales for runCommonApp
  static List<Map<String, String>> get locales => [values];
}
