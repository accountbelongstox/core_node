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

/// English localization for Example App
class EnAppExample {
  static const Map<String, String> values = {
    // App Identity
    'example_app_name': 'Example App',
    'example_app_description': 'A comprehensive example application',
    'example_app_slogan': 'Learn, Build, Grow',
    'example_app_version': 'Version 1.0.0',

    // Common Actions
    'example_home': 'Home',
    'example_next': 'Next',
    'example_previous': 'Previous',
    'example_skip': 'Skip',
    'example_cancel': 'Cancel',
    'example_confirm': 'Confirm',
    'example_save': 'Save',
    'example_delete': 'Delete',
    'example_edit': 'Edit',
    'example_back': 'Back',
    'example_close': 'Close',
    'example_ok': 'OK',
    'example_yes': 'Yes',
    'example_no': 'No',
    'example_continue': 'Continue',
    'example_submit': 'Submit',
    'example_retry': 'Retry',
    'example_refresh': 'Refresh',
    'example_search': 'Search',
    'example_filter': 'Filter',
    'example_sort': 'Sort',
    'example_clear': 'Clear',
    'example_reset': 'Reset',

    // Status Messages
    'example_success': 'Success',
    'example_error': 'Error',
    'example_warning': 'Warning',
    'example_info': 'Information',
    'example_loading': 'Loading...',
    'example_completed': 'Completed',
    'example_pending': 'Pending',
    'example_failed': 'Failed',

    // Authentication
    'example_sign_in': 'Sign In',
    'example_sign_up': 'Sign Up',
    'example_sign_out': 'Sign Out',
    'example_logout': 'Logout',
    'example_login': 'Login',
    'example_register': 'Register',
    'example_forgot_password': 'Forgot Password',
    'example_reset_password': 'Reset Password',
    'example_change_password': 'Change Password',
    'example_email': 'Email',
    'example_password': 'Password',
    'example_confirm_password': 'Confirm Password',
    'example_username': 'Username',
    'example_remember_me': 'Remember Me',
    'example_create_account': 'Create Account',
    'example_have_account': 'Already have an account?',
    'example_no_account': 'Don\'t have an account?',

    // Settings
    'example_settings': 'Settings',
    'example_dark_mode': 'Dark Mode',
    'example_light_mode': 'Light Mode',
    'example_language': 'Language',
    'example_notifications': 'Notifications',
    'example_privacy': 'Privacy',
    'example_security': 'Security',
    'example_help': 'Help',
    'example_about': 'About',
  };

  /// Get locales for runCommonApp
  static List<Map<String, String>> get locales => [values];
}
